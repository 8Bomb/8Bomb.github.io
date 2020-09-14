// Sky Hoffert
// Back end for 8Bomb.io.

console.log("Starting 8Bomb backend.");

const fs = require("fs");
const http = require("http");
const https = require("https");
const SocketServer = require("ws").Server;

const Matter = require("matter-js");
const FMATH = require("fmath");
const fmath = new FMATH();

const E8B = require("./engine");
const NET = require("./network");

const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;

const DEFAULT_PORT = 5061;
const PORT = process.argv.length === 3 ? parseInt(process.argv[2], 10) : DEFAULT_PORT;
if (PORT === NaN) {
    console.log("ERR. Caught error with parsing port num.");
    process.exit();
}

let LOCAL = true;
try {
	if (fs.existsSync("./LOCAL")) {
		console.log("Running on local server, port " + PORT + ".");
		LOCAL = true;
	} else {
		console.log("Running on the www, port " + PORT + ".");
		LOCAL = false;
	}
} catch (err) {
	console.log("ERR. Caught an err with existsSync.");
    process.exit();
}

var credentials = null;
if (!LOCAL) {
	const privateKey  = fs.readFileSync("/etc/letsencrypt/live/skyhoffert-backend.com/privkey.pem", "utf8");
	const certificate = fs.readFileSync("/etc/letsencrypt/live/skyhoffert-backend.com/fullchain.pem", "utf8");
	credentials = {key: privateKey, cert: certificate};
}
 
var express = require("express");
const { timeStamp } = require("console");
var app = express();
 
//pass in your express app and credentials to create an https server
var server = null;
if (!LOCAL) {
	server = https.createServer(credentials, app);
} else {
	server = http.createServer(app);
}
server.listen(PORT);

const wss = new SocketServer({ server : server });

console.log("listening.");

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Engine! ////////////////////////////////////////////////////////////////////////////////////////

const matter_engine = Engine.create();
matter_engine.world.gravity.y = 0.2;

// A way to pause the ENTIRE engine.
//matter_engine.timing.timeScale = 0;

let prevTime = Date.now();
let tick_timer = 0;
let tick_frames = 0;
function Tick() {
    setTimeout(Tick, FPS);
    
	let now = Date.now();
	let dT = now - prevTime;
	prevTime = now;

    tick_timer += dT;
    tick_frames++;
    if (tick_timer > FPS_LOG_RATE) {
        console.log("fps: " + E8B.Sigs(tick_frames / tick_timer * 1000));
        tick_timer = 0;
        tick_frames = 0;
    }

	Engine.update(matter_engine, dT);

	engine.Tick(dT);
}

const ENGINE_WIDTH = 1200;
const ENGINE_HEIGHT = Math.round(ENGINE_WIDTH*9/16);

const FPS = 1000/60;
const FPS_LOG_RATE = 10000; // ms

const GROUND_COLLISION_RATE = 1000; // ms

const play_opts = {
	map: "Kansas",
	gravity: 1,
	bomb_factor: 1,
};

class Engine_8Bomb {
    constructor() {
        this._objs = {};
        // _bodies is used for collisions.
        this._bodies = {grounds: [], walls: [], bombs: [], users: [], powerups: []};
        // _bodies_map is a parallel array, used to map "matter body id" back to Engine id.
        this._bodies_map = {};
        
        this._ge_wid = 2;
        this._ground_wid = ENGINE_WIDTH / this._ge_wid;
        this._ground_height = -ENGINE_HEIGHT/2 + 300;
        this._ground_dist_to_bot = ENGINE_HEIGHT/2 - this._ground_height;

        this._clients = {};

        this._leader = null;

        this._tasks = [];

        this._update_period = 100;
        this._update_time = 0;

        this.bomb_spawning = false;

        this._net_set = false;

        this._rmQ = [];
        this._addQ = [];

        this._keylen = 5;

        this._updates_num = 0;
		this._updates_timer = 0;
		
        this._magma = -1;
        this._bomb_spawner = -1;

        this._actionQ = [];

        this._num_players = 0;

        this._CreateWorld();
    }

    _CreateWorld() {
        console.log("ENGINE creating new world.");

        for (let i = 0; i < this._ground_wid; i++) {
            this._AddObj(this._NewID(this._keylen),
                new GroundElement(-ENGINE_WIDTH/2 + this._ge_wid*i, this._ground_height, this._ge_wid, this._ground_dist_to_bot));
        }

        // Bomb spawner.
        this._bomb_spawner = this._NewID(this._keylen);
        this._AddObj(this._bomb_spawner, new BombSpawner(0, -ENGINE_HEIGHT/2 - 20, ENGINE_WIDTH - 40));
        
        // Magma.
        //this._magma = this._NewID(this._keylen);
        //this._objs[this._magma] = new Magma(0, ENGINE_HEIGHT/2 - 40, ENGINE_WIDTH, 80);
        
        // Left wall.
        //this._objs[this._NewID(this._keylen)] = new Wall(-ENGINE_WIDTH/2 - 20, -ENGINE_HEIGHT/2, 40, ENGINE_HEIGHT);

        // Right wall.
        //this._objs[this._NewID(this._keylen)] = new Wall(ENGINE_WIDTH/2 - 20, -ENGINE_HEIGHT/2, 40, ENGINE_HEIGHT);
    }

    _ResetWorld() {
        this._bomb_spawning = false;
        
        for (let k in this._objs) {
            if (this._objs[k].type === "u") {
                this._objs[k].MoveTo(0, -ENGINE_HEIGHT/2, true);
                continue;
            }

            this._RemoveObj(k);
        }
    }

    _NewID(n) {
        let id = E8B.GenRequestID(n);
        while (id in this._objs) {
            id = E8B.GenRequestID(n);
        }
        return id;
    }

    _AddObjToSpec(id) {
        if (this._objs[id] === undefined) { return null; }
        const type = this._objs[id].type;
        let specs = {
            a: "u",
            i: id,
            t: type,
            s: {}
        };
        const o = this._objs[id];
        if (type === "w" || type === "bs" || type === "g" || type === "m") {
            specs.s = {
                x: o.x,
                y: o.y,
                w: o.width,
                h: o.height,
            };
        } else if (type === "b" || type === "u" || type === "p") {
            specs.s = {
                x: o.x, y: o.y, r: o.radius,
                vx: o.vx, vy: o.vy, va: o.va,
                a: o.angle, c: o.color,
            }
            if (type === "u" || type === "p") {
                specs.s.tn = o.texture_num;
            }
        }
        return specs;
    }

    _InitClient(id, cid) {
        let msg_8B = {
            a: "aur",
            s: [],
        };
        for (let k in this._objs) {
            const res = this._AddObjToSpec(k);
            if (res !== null) {
                msg_8B.s.push(res);
            }
        }

		if (cid !== "") {
            // Send to a specific client.
			network.ServerSend(JSON.stringify({
				type: "8B",
				resID: E8B.GenRequestID(6),
				spec: {
					a: "cw"
				},
            }), cid);
            network.ServerSend(JSON.stringify({
                type: "8B",
                resID: E8B.GenRequestID(6),
                spec: msg_8B,
            }), cid);
		} else {
            // Send to ALL clients.
			network.ServerSend(JSON.stringify({
				type: "8B",
				resID: E8B.GenRequestID(6),
				spec: {
					a: "cw"
				},
            }));
            network.ServerSend(JSON.stringify({
                type: "8B",
                resID: E8B.GenRequestID(6),
                spec: msg_8B,
            }));
		}
    }

    _UpdateClient() {
        this._updates_num++;
        let msg_8B = {
            a: "aur",
            s: [],
        };
        for (let k in this._objs) {
            const o = this._objs[k];

            if (o.type !== "b" && o.type !== "u" && o.type !== "p") { continue; }

            msg_8B.s.push(this._AddObjToSpec(k));
        }

        while (this._rmQ.length > 0) {
            const id = this._rmQ[0];
            msg_8B.s.push({
                a: "r",
                i: id,
            });
            this._RemoveObj(id);
            this._rmQ.splice(0, 1);
        }

        while (this._addQ.length > 0) {
            const res = this._AddObjToSpec(this._addQ[0]);
            if (res !== null) {
                msg_8B.s.push(res);
            }
            this._addQ.splice(0, 1);
        }

        network.ServerSend(JSON.stringify({
            type: "8B",
            resID: E8B.GenRequestID(6),
            spec: msg_8B,
        }));
    }
    
    _RemoveClient(cid) {
        this._rmQ.push(this._clients[cid].id);
        delete this._clients[cid];
        console.log("Removing client " + cid + " from world.");
        
        this._num_players--;

        if (this._leader === cid) {
            this._leader = null;

            const acs = Object.keys(this._clients);
            if (acs.length > 0) {
                this._leader = acs[0];
                console.log("Selected new leader " + this._leader);
                network.ServerSend(JSON.stringify({
                    type: "become-leader",
                    resID: E8B.GenRequestID(6),
                    spec: {},
                }), this._leader);
            }
        }
    }

    Start() {
        console.log("ADMIN: starting engine.");
		//this.bomb_spawning = true;

		// Send start signal to all clients.
		network.ServerSend(JSON.stringify({
			type: "8B",
			resID: E8B.GenRequestID(6),
			spec: {
				a: "str",
			}
		}));
    }

    Stop() {
        console.log("ADMIN: stopping engine.");
		//this.bomb_spawning = true;
    }

    ActionQueue() { return this._actionQ; }
	
	NetSet() {
		this._net_set = true;
	}

    AddBomb(x, y, r, t) {
        const id = this._NewID(this._keylen);
        this._AddObj(id, new Bomb(x, y, r, t));
    }
    
    AddPowerup(x, y, s) {
        const id = this._NewID(this._keylen);
        this._AddObj(id, new Powerup(x, y, s, 0));
    }
	
	Magma() {
		if (this._magma !== -1) {
			return this._objs[this._magma];
		}
		return null;
	}

    // Set gravity to certain level
    // @param type: one of 0, 1, 2
    SetGravity(type) {
        if (type === 0) {
            matter_engine.world.gravity.y = 0.05;
        } else if (type === 1) {
            matter_engine.world.gravity.y = 0.2;
        } else {
            matter_engine.world.gravity.y = 0.5;
        }
    }

    _HandleNetwork() {
        if (!this._net_set) { return; }
		
		while (network.HasData()) {
			const rx = network.ServerRecv().data;
			if (rx !== "") {
				let rxp = {};
				try {
					rxp = JSON.parse(rx);
				} catch (err) {
					console.log("ERR. Could not parse rx message in client.");
					return;
				}

				if (rxp.type === "ping") {
					network.ServerSend(JSON.stringify({
						type: "pong",
						resID: E8B.GenRequestID(6),
						spec: {
							reqID: rxp.reqID,
							tsent: rxp.spec.tsent,
						},
					}), rxp.spec.cID);
				} else if (rxp.type === "check") {
					if (rxp.spec.game === "8Bomb" && rxp.spec.version === "0.1") {
						network.ServerSend(JSON.stringify({
							type: "check-response",
							resID: E8B.GenRequestID(6),
							spec: {
								reqID: rxp.reqID,
								good: true,
							}
						}), rxp.spec.cID);
					} else {
						console.log("Server got a check with bad game or version");
						network.ServerSend(JSON.stringify({
							type: "check-response",
							resID: E8B.GenRequestID(6),
							spec: {
								reqID: rxp.reqID,
								good: false,
							}
						}), rxp.spec.cID);
					}
				} else if (rxp.type === "connect") {
					console.log("DEBUG: got connect message");
					// TODO: this probably needs some auth, eh?
                    const cid = rxp.spec.cID;
                    const cc = rxp.spec.color;
                    const ctn = rxp.spec.texture_num;

                    console.log("DEBUG: cc: " + cc + ", tn: " + ctn);
					
					// generate a user ball upon connect.
					if (cid in this._clients) {
						console.log("TODO: got a duplicated connect?");
					}
					let id = this._NewID(this._keylen);
					this._AddObj(id, new UserBall(0, -ENGINE_HEIGHT/2, cc, ctn));
					this._clients[cid] = {
                        id: id,
                    };
                    this._num_players++;

					network.ServerSend(JSON.stringify({
						type: "connect-response",
						resID: E8B.GenRequestID(6),
						spec: {
							reqID: rxp.reqID,
							good: true,
                            color: cc,
                            texture_num: ctn,
						}
                    }), cid);
                    
                    if (this._leader === null) {
                        this._leader = cid;
                        console.log("Selected a leader " + this._leader);
                        network.ServerSend(JSON.stringify({
                            type: "become-leader",
                            resID: E8B.GenRequestID(6),
                            spec: {},
                        }), cid);
                    }

                    console.log("ENGINE adding new user ball");

					this._InitClient(id, cid);
				} else if (rxp.type === "admin") {
					console.log("ADMIN: Got an admin action!");
					if (rxp.spec.action === "start") {
						this.Start();
					} else if (rxp.spec.action === "stop") {
						this.Stop();
					} else if (rxp.spec.action === "destroy") {
						this.Destroy();
					} else if (rxp.spec.action === "create") {
						this._CreateWorld();
						this._InitClient();
					} else {
						console.log("Couldn't handle admin action " + rxp.spec.action);
					}
				} else if (rxp.type === "input") {
                    if (rxp.spec.cID === this._leader) {
                        if (rxp.spec.key === "1" && rxp.spec.down === true) {
                            console.log("DEBUG: got 1 special code from leader");
                            this._ResetWorld();
                            this._CreateWorld();
                            this._InitClient();
                        } else if (rxp.spec.key === "2" && rxp.spec.down === true) {
                            console.log("DEBUG: got '2' special code from leader");
                            this.Start();
                            this.bomb_spawning = !this.bomb_spawning;
                        }
                    }
					this._objs[this._clients[rxp.spec.cID].id].Key(rxp.spec.key, rxp.spec.down);
				} else if (rxp.type === "players") {
                    network.ServerSend(JSON.stringify({
                        type: "players-response",
                        resID: E8B.GenRequestID(6),
                        spec: {
                            reqID: rxp.reqID,
                            players: {
                                current: this._num_players,
                                max: 8,
                            }
                        },
                    }), rxp.spec.cID);
                } else {
					console.log("Server couldn't handle " + rxp.type);
				}
			}
		}
    }

    _AddObj(id, o) {
        this._objs[id] = o;
        let added = false;
        if (o.type === "g") {
            this._bodies.grounds.push(o._body);
            added = true;
        } else if (o.type === "p") {
            this._bodies.powerups.push(o._body);
            added = true;
        }

        if (added) {
            this._bodies_map[o._body.id] = id;
        }
    }

    _RemoveObj(id) {
        const o = this._objs[id];

        // TODO: why does this need to be checked?
        if (o !== undefined) {
            // Need to remove mapping from bodies_map
            let a = null;
            if (o.type === "g") {
                a = this._bodies.grounds;
            } else if (o.type === "p") {
                a = this._bodies.powerups;
            }
            if (a !== null) {
                delete this._bodies_map[o._body.id];
                a.splice(a.indexOf(o._body), 1);
            }

            o.Destroy();
        }
        delete this._objs[id];
    }

    Tick(dT) {
        while (this._actionQ.length > 0) {
            if (this._actionQ[0].type === "remove-client") {
                this._RemoveClient(this._actionQ[0].cid);
            }
            this._actionQ.splice(0, 1);
        }

        this._HandleNetwork();

        for (let k in this._objs) {
			const o = this._objs[k];
			let wasactive = o.active;
            o.Tick(dT);

            // If an object was just killed.
            if (wasactive && o.active === false) {
				if (o.type === "u") {
                    // And if that object was a player, tell them that they died.
					o.Destroy();
					
					// TODO: better way? Seems inefficient?
					for (let c in this._clients) {
						if (this._clients[c].id === k) {
							network.ServerSend(JSON.stringify({
								type: "8B",
								resID: E8B.GenRequestID(6),
								spec: {
									a: "yd",
									i: k,
								},
							}), c);
						}
					}
				} else {
					this._rmQ.push(k);
				}
			}
        }

        // See if clients need updated.
        this._update_time += dT;
        if (this._update_time >= this._update_period) {
            this._update_time = 0;
            this._UpdateClient();
        }
    }
    
    Collides(u) {
        let colls = Matter.Query.collides(u._body, this._bodies.grounds);
        let pcolls = Matter.Query.collides(u._body, this._bodies.powerups);

        if (pcolls.length > 0) {
            const id = this._bodies_map[pcolls[0].bodyB.id];
            if (u.CollectPowerup(this._objs[id])) {
                this._rmQ.push(id);
            }
        }

        return colls;
    }

    PointInsideGround(x, y) {
        for (let k in this._objs) {
            const o = this._objs[k];
            if (o.type !== "g") { continue; }

            const res = Matter.Query.point([o._body], {x:x, y:y});
            if (res.length !== 0) {
                return true;
            }
        }

        return false;
    }
    
    Bomb(x, y, r=30) {
        let changes = {};
        for (let xp = x - r + 1; xp < x + r - 1; xp += this._ge_wid) {
            const yd = fmath.sin(Math.acos((x - xp) / r)) * r;
            const yb = y + yd;
            const yt = y - yd;
            for (let k in this._objs) {
                const o = this._objs[k];
                if (o.type !== "g") { continue; }

                if (o.WithinXBounds(xp)) {
                    // If bomb explosion bottom reaches past top of elem.
                    if (o.top < yb) {
                        let gotone = false;
                        // Add lower element.
                        if (yb < o.bottom) {
                            gotone = true;
                            let id = this._NewID(this._keylen);
                            changes[id] = new GroundElement(o.left, yb + 1, o.width, o.bottom - (yb + 1));
                            this._addQ.push(id);
                        }

                        // Check if upper element should be added.
                        if (o.top < yt && yt < o.bottom) {
                            const ht = (yt - o.top) - 1;
                            if (ht > this._ge_wid) {
                                let id = this._NewID(this._keylen);
                                changes[id] = new GroundElement(o.left, o.top, o.width, ht);
                                this._addQ.push(id);
                            }
                            gotone = true;
                        }

                        // finally, check if the entire element is within the blast.
                        if (o.top > yt && o.bottom < yb) {
                            gotone = true;
                        }

                        // Remove old element.
                        if (gotone) {
                            this._rmQ.push(k);
                        }
                    }
                }
            }
        }

        // This seems to fix the increasing object count.
        for (let k in changes) {
            this._AddObj(k, changes[k]);
        }

        for (let k in this._objs) {
            const o = this._objs[k];
            if (o.type === "u") {
                o.Bomb(x, y, r);
            }
        }
    }

    ApplyPowerup(o, t) {
        // Types: 0=vertical blast
        if (t === 0) {
            o.ApplyForce(0, -0.001);
            this._VerticalBlast(o.x, o.y, 20);
        }
    }

    _VerticalBlast(x, y, w) {
        for (let xp = x - w/2; xp < x + w/2; xp += this._ge_wid) {
            for (let k in this._objs) {
                const o = this._objs[k];
                if (o.type !== "g") { continue; }

                if (o.WithinXBounds(xp)) {
                    this._rmQ.push(k);
                }
            }
        }
    }

    Destroy() {
        console.log("ENGINE destroying.");

        for (let k in this._objs) {
            this._RemoveObj(k);
        }
    }
}

class Wall {
    constructor(l, t, w, h) {
        this.x = l + w/2;
        this.y = t + h/2;
        this.left = l;
        this.top = t;
        this.width = w;
        this.height = h;
        this.bottom = t + h;
        this.right = l + w;

        this.active = true;
        this.type = "w";

        this._body = Bodies.rectangle(this.x, this.y, this.width, this.height, {isStatic:true})

        World.add(matter_engine.world, [this._body]);
    }
    
    Tick(dT) {}

    Destroy() {
        World.remove(matter_engine.world, [this._body]);
    }

    Draw() {
        stage_graphics.lineStyle(0);
        stage_graphics.beginFill(MAP_COLORS[play_opts.map].wall);
        stage_graphics.drawRect(this.left, this.top, this.width, this.height);
        stage_graphics.endFill();
    }
}

class GroundElement {
    constructor(l, t, w, h) {
        this.x = l + w/2;
        this.y = t + h/2;
        this.width = w;
        this.height = h;
        
        this.left = l;
        this.right = l + w;
        this.top = t;
        this.bottom = t + h;

        this.active = true;
        this.type = "g";

        this._body = Bodies.rectangle(this.x, this.y, this.width, this.height, {isStatic:true});

        World.add(matter_engine.world, [this._body]);
    }

    WithinXBounds(x) { return x > this.left && x < this.right; }
    
    Tick(dT) {}

    Destroy() {
        World.remove(matter_engine.world, [this._body]);
    }
}

class UserBall {
    constructor(x, y, c, tn) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.vx = 0;
        this.vy = 0;
        this.va = 0;
        this.angle = 0;
		
		// TODO: better colors.
        this.color = c;
        this.texture_num = tn;

        this._falling = true;
        
        this._body = Bodies.circle(this.x, this.y, this.radius, 12);
        this._body.restitution = 0.5;
        this._body.slop = 0.02;
        World.add(matter_engine.world, [this._body]);

        this._jumpcd_max = 1000;
        this._jumpcd = 0;

        this._jumpframes_max = 10;
        this._jumpframes = this._jumpframes_max;

        this.active = true;
        this.type = "u";
        this.powerup = -1;

        this._keys = {w:false, a:false, s:false, d:false};
        
        this._inside_ground_rate = GROUND_COLLISION_RATE; // ms
        this._inside_ground_timer = this._inside_ground_rate;
        this._inside_ground = false;

        this._max_speed = 15;

        this._powerup = -1;
    }

    Key(k, d) {
        this._keys[k] = d;
    }

    Destroy() {
        World.remove(matter_engine.world, [this._body]);
        this.active = false;
    }

    Position() { return {x:this.x, y:this.y} };

    MoveTo(x, y, full_reset=false) {
        Body.setPosition(this._body, {x:x, y:y});
        if (full_reset) {
            Body.setVelocity(this._body, {x:0, y:0});
            Body.setAngle(this._body, 0);
            Body.setAngularVelocity(this._body, 0);
        }
    }

    Bomb(x, y, r) {
        if (!this.active) { return; }

        const hyp = Math.hypot(this.x - x, this.y - y);
        const str = Math.min(r - hyp / 1000000, 0.0001);

        if (hyp < r) {
            Body.applyForce(this._body, {x:this.x, y:this.y},
                {x: (this.x - x)*str, y: (this.y - y)*str});
        }
    }

    ApplyForce(x, y) {
        Body.applyForce(this._body, {x:this.x, y:this.y}, {x:x, y:y});
    }

    CollectPowerup(t) {
        if (this._powerup === -1) {
            this._powerup = t.texture_num;
            return true;
        }
        return false;
    }

    Tick(dT) {
        if (!this.active) { return; }
        
        if (this._body.speed > this._max_speed) {
            console.log("DEBUG had to reduce player velocity.");
            Body.setVelocity(this._body, {x:this._body.velocity.x / this._body.speed * this._max_speed,
                y:this._body.velocity.y / this._body.speed * this._max_speed});
        }

        const colls = engine.Collides(this);
        const grounded = colls.length !== 0;

        // The player moves faster when grounded.
        if (grounded) {
            this._jumpframes = this._jumpframes_max;
            if (this._keys.a) {
                Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y - this.radius/3}, {x:-0.0001,y:0});
            } else if (this._keys.d) {
                Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y - this.radius/3}, {x:0.0001,y:0});
            }
        } else {
            if (this._keys.a) {
                Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y}, {x:-0.00005,y:0});
            } else if (this._keys.d) {
                Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y}, {x:0.00005,y:0});
            }
        }

        if (this._jumpcd <= 0 && this._jumpframes > 0 && this._keys[" "]) {
            Body.applyForce(this._body, this._body.position, {x:0, y:-0.001});
            this._jumpcd = this._jumpcd_max;
        }
        if (this._jumpcd > 0) {
            this._jumpcd -= dT;
        }
        if (this._jumpframes > 0 && !grounded) {
            this._jumpframes--;
        }

        // Don't rotate too fast.
        if (Math.abs(this._body.angularVelocity) > 1) {
            Body.setAngularVelocity(this._body, Math.sign(this._body.angularVelocity));
        }

        // If we found that this was stuck in the ground previously.
        if (this._inside_ground) {
            // Check again until out.
            this._inside_ground = engine.PointInsideGround(this.x + Math.random(), this.y + this.radius*0.8);

            // If stuck in the ground, move upwards.
            // TODO: not an ideal solution, but it works for now.
            if (this._inside_ground) {
                Body.setPosition(this._body, {x:this.x - 0.01, y:this.y - 2});
            }
        } else {
            // Every so often (this._inside_ground_rate ms) check if inside ground.
            this._inside_ground_timer -= dT;
            if (this._inside_ground_timer < 0) {
                this._inside_ground_timer = this._inside_ground_rate;
                this._inside_ground = engine.PointInsideGround(this.x + Math.random(), this.y + this.radius*0.8);
            }
        }

        if (this._keys["e"] && this._powerup !== -1) {
            engine.ApplyPowerup(this, this._powerup);
            this._powerup = -1;
        }

        this.x = E8B.Sigs(this._body.position.x);
        this.y = E8B.Sigs(this._body.position.y);
        this.vx = E8B.Sigs(this._body.velocity.x);
        this.vy = E8B.Sigs(this._body.velocity.y);
        this.va = E8B.Sigs(this._body.angularVelocity);
        this.angle = E8B.Sigs(this._body.angle);

        // Conditions for killing a player.
		if (this.y > ENGINE_HEIGHT) {
			this.active = false;
        }
        const magma = engine.Magma();
		if (magma !== null && magma.Contains(this.x, this.y)) {
			this.active = false;
		}
    }
}

class Bomb {
    constructor(x, y, r, t) {
        this.x = x;
        this.y = y;
        this.radius = r;
        this.vx = 0;
        this.vy = 0;
		this.va = 0;
        this.color = 0;
        this.angle = 0;

        this.active = true;

        this._lifetime = t;
        this._hit_ground = false;

        this._explosion_radius = this.radius * 5;

        this.active = true;
        this.type = "b";
        
        this._body = E8B.NewBomb(this.x, this.y, this.radius);
        World.add(matter_engine.world, [this._body]);

        this._inside_ground_rate = GROUND_COLLISION_RATE; // ms
        this._inside_ground_timer = this._inside_ground_rate;
        this._inside_ground = false;

        // TODO: rather than a total lifetime timer, make the timer begin when the bomb hits ground
    }

    Tick(dT) {
        if (!this.active) { return; }

        if (this._hit_ground) {
            this._lifetime -= dT;
            
            if (this._lifetime <= 0) {
                this.Destroy();
            }
        }

        // If we found that this was stuck in the ground previously.
        if (this._inside_ground) {
            // Check again until out.
            this._inside_ground = engine.PointInsideGround(this.x + Math.random(), this.y + this.radius*0.8);

            // If stuck in the ground, move upwards.
            // TODO: not an ideal solution, but it works for now.
            if (this._inside_ground) {
                Body.setPosition(this._body, {x:this.x - 0.01, y:this.y - 2});
            }
        } else {
            // Every so often (this._inside_ground_rate ms) check if inside ground.
            this._inside_ground_timer -= dT;
            if (this._inside_ground_timer < 0) {
                this._inside_ground_timer = this._inside_ground_rate;
                this._inside_ground = engine.PointInsideGround(this.x + Math.random(), this.y + this.radius*0.8);
            }
        }

        const newvy = E8B.Sigs(this._body.velocity.y);
        if (Math.abs(newvy - this.vy) > 1) {
            this._hit_ground = true;
        }
        this.x = E8B.Sigs(this._body.position.x);
        this.y = E8B.Sigs(this._body.position.y);
        this.vx = E8B.Sigs(this._body.velocity.x);
        this.vy = newvy;
        this.va = E8B.Sigs(this._body.angularVelocity);
        this.angle = E8B.Sigs(this._body.angle);
    }

    Destroy() {
        if (!this.active) { return; }

        World.remove(matter_engine.world, [this._body]);

        engine.Bomb(this.x, this.y, this._explosion_radius);

        this.active = false;
    }
}

class BombSpawner {
    constructor(x, y, w) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = 20;

        this.left = this.x - this.width/2;
        this.right = this.x + this.width/2;
        this.top = this.y - this.height/2;
        this.bottom = this.y + this.height/2;
        
        this.active = true;
        this.type = "bs";

        this._spawn_chance_starting = play_opts.bomb_factor === 0 ? 0.002 : play_opts.bomb_factor === 1 ? 0.008 : 0.02;
        this._spawn_chance = this._spawn_chance_starting;
        this._bomb_chance = 0.8; // vs powerup chance
    }

    Destroy() {}

    Tick(dT) {
		if (!engine.bomb_spawning) { return; }

        if (Math.random() < this._spawn_chance) {
            this._spawn_chance = this._spawn_chance_starting;
            if (Math.random() < this._bomb_chance) {
                engine.AddBomb(this.left + this.width * Math.random(), this.y, 4+Math.random()*6, 2000*Math.random());
            } else {
                engine.AddPowerup(this.left + this.width * Math.random(), this.y, 10);
            }
        } else {
            this._spawn_chance *= play_opts.bomb_factor === 0 ? 1.01 : 1.02;
        }
    }
}

class Magma {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.left = x - w/2;
        this.right = x + w/2;
        this.top = y - h/2;
        this.bottom = y + h/2;
        
        this.active = true;
        this.type = "m";
    }

    Destroy() {}

    Tick(dT) {}

    Contains(x, y) {
        return x > this.left && x < this.right && y > this.top && y < this.bottom;
    }
}

class Powerup {
    constructor(x, y, s, t) {
        this.x = x;
        this.y = y;
        this.radius = s;
        this.left = x - s;
        this.right = x + s;
        this.top = y - s;
        this.bottom = y + s;

        this.active = true;
        this.type = "p";

        this.vx = 0;
        this.vy = 0;
        this.va = 0;
        this.color = 0;
        this.texture_num = t;
        
        this._body = E8B.NewPowerup(this.x, this.y, s);
        World.add(matter_engine.world, [this._body]);
        Body.setAngle(this._body, Math.random() * Math.PI*2);
        this.angle = this._body.angle;

        this._life_max = 10000;
        this._life = this._life_max;
    }

    Destroy() {
        this.active = false;
        World.remove(matter_engine.world, [this._body]);
    }

    Tick(dT) {
        this._life -= dT;

        if (this._life < 0) {
            this.active = false;
        }
        
        this.x = E8B.Sigs(this._body.position.x);
        this.y = E8B.Sigs(this._body.position.y);
        this.vx = E8B.Sigs(this._body.velocity.x);
        this.vy = E8B.Sigs(this._body.velocity.y);
        this.va = E8B.Sigs(this._body.angularVelocity);
        this.angle = E8B.Sigs(this._body.angle);
    }
}

let engine = new Engine_8Bomb();
let network = new NET.Network(wss, engine.ActionQueue());
engine.NetSet();

setTimeout(Tick, FPS);

// Disconnect from clients before closing.
function Destroy() {
    console.log("Sending disconnect to all clients.");
    network.Destroy();
}

process.on("SIGINT", function() {
    Destroy();
    console.log("Got SIGINT. Exiting.");
    process.exit();
});
process.on("SIGTERM", function() {
    Destroy();
    console.log("Got SIGTERM. Exiting.");
    process.exit();
});
