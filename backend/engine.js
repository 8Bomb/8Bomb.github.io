// Sky Hoffert
// Engine for 8Bomb.

// Matter.js stuff
const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;

const engine = Engine.create();
engine.world.gravity.y = 0.2;
engine.timing.timeScale = 0;
Engine.run(engine);

const ENGINE_WIDTH = 1200;
const ENGINE_HEIGHT = Math.round(ENGINE_WIDTH*9/16);

class LocalNetworkEmulator {
    constructor() {
        this._rxC = [];
        this._rxS = [];
    }

    ClientSend(msg) {
        const msgc = LZUTF8.compress(msg, {outputEncoding:"Base64"});
        this._rxS.push(msgc);
    }

    // @return str: received message
    ClientRecv() {
        if (this._rxC.length > 0) {
            const r = this._rxC[0];
            this._rxC.splice(0, 1);
            return LZUTF8.decompress(r, {inputEncoding:"Base64"});
        }
        return "";
    }

    ServerSend(msg) {
        const msgc = LZUTF8.compress(msg, {outputEncoding:"Base64"});
        this._rxC.push(msgc);
    }

    ServerRecv() {
        if (this._rxS.length > 0) {
            const r = this._rxS[0];
            this._rxS.splice(0, 1);
            return LZUTF8.decompress(r, {inputEncoding:"Base64"});
        }
        return "";
    }
}

class Engine_8Bomb {
    constructor() {
        this._objs = {};
        
        this._ge_wid = 2;
        this._ground_wid = ENGINE_WIDTH / this._ge_wid;
        this._ground_height = -ENGINE_HEIGHT/2 + 300;
        this._ground_dist_to_bot = ENGINE_HEIGHT/2 - this._ground_height;

        this._clients = {};

        this._tasks = [];

        this._update_period = 100;
        this._update_time = 0;

        this._running = false;

        this._rmQ = [];
        this._addQ = [];

        this._bomb_added = 0;
        this._bomb_removed = 0;

        this._keylen = 5;

        this._updates_num = 0;
        this._updates_timer = 0;

        this._CreateWorld();
    }

    _CreateWorld() {
        console.log("ENGINE creating new world.");

        for (let i = 0; i < this._ground_wid; i++) {
            this._objs[this._NewID(this._keylen)] = new GroundElement(-ENGINE_WIDTH/2 + this._ge_wid*i, this._ground_height, this._ge_wid, this._ground_dist_to_bot);
        }

        // Bomb spawner.
        this._bomb_spawner = this._NewID(this._keylen);
        this._objs[this._bomb_spawner] = new BombSpawner(0, -ENGINE_HEIGHT/2 - 20, ENGINE_WIDTH - 40);
        
        // Magma.
        this._magma = this._NewID(this._keylen);
        this._objs[this._magma] = new Magma(0, ENGINE_HEIGHT/2 - 40, ENGINE_WIDTH, 80);
        
        // Left wall.
        this._objs[this._NewID(this._keylen)] = new Wall(-ENGINE_WIDTH/2 - 20, -ENGINE_HEIGHT/2, 40, ENGINE_HEIGHT);

        // Right wall.
        this._objs[this._NewID(this._keylen)] = new Wall(ENGINE_WIDTH/2 - 20, -ENGINE_HEIGHT/2, 40, ENGINE_HEIGHT);

        this._objs[this._NewID(this._keylen)] = new UserBall(-ENGINE_WIDTH/3, -ENGINE_HEIGHT/2);
    }

    _NewID(n) {
        let id = GenRequestID(n);
        while (id in this._objs) {
            id = GenRequestID(n);
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
        } else if (type === "b" || type === "u") {
            specs.s = {
                x: o.x, y: o.y, r: o.radius,
                vx: o.vx, vy: o.vy, va: o.va,
            }
        }
        return specs;
    }

    _InitClient(id, cid) {
        network.ServerSend(JSON.stringify({
            type: "8B",
            resID: GenRequestID(6),
            spec: {
                a: "cw"
            },
        }));

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

        network.ServerSend(JSON.stringify({
            type: "8B",
            resID: GenRequestID(6),
            spec: msg_8B,
        }));
    }

    _UpdateClient() {
        this._updates_num++;
        let msg_8B = {
            a: "aur",
            s: [],
        };
        for (let k in this._objs) {
            const o = this._objs[k];

            if (o.type !== "b" && o.type !== "u") { continue; }

            msg_8B.s.push(this._AddObjToSpec(k));
        }

        while (this._rmQ.length > 0) {
            const id = this._rmQ[0];
            msg_8B.s.push({
                a: "r",
                i: id,
            });
            if (this._objs[id] !== undefined) {
                this._objs[id].Destroy();
            }
            delete this._objs[id];
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
            resID: GenRequestID(6),
            spec: msg_8B,
        }));
    }

    Start() {
        console.log("ADMIN: starting engine.");
        engine.timing.timeScale = 1;
        this._running = true;
    }

    Stop() {
        console.log("ADMIN: stopping engine.");
        engine.timing.timeScale = 0;
        this._running = false;
    }

    AddBomb(x, y, r, t) {
        const id = this._NewID(this._keylen);
        this._objs[id] = new Bomb(x, y, r, t);
    }

    // Set gravity to certain level
    // @param type: one of 0, 1, 2
    SetGravity(type) {
        if (type === 0) {
            engine.world.gravity.y = 0.05;
        } else if (type === 1) {
            engine.world.gravity.y = 0.2;
        } else {
            engine.world.gravity.y = 0.5;
        }
    }

    _HandleNetwork() {
        const rx = network.ServerRecv();
        if (rx !== "") {
            let rxp = {};
            try {
                rxp = JSON.parse(rx);
            } catch {
                console.log("ERR. Could not parse rx message in client.");
            }

            if (rxp.type === "ping") {
                network.ServerSend(JSON.stringify({
                    type: "pong",
                    resID: GenRequestID(6),
                    spec: {
                        reqID: rxp.reqID,
                        tsent: rxp.spec.tsent,
                    },
                }));
            } else if (rxp.type === "check") {
                if (rxp.spec.game === "8Bomb" && rxp.spec.version === "0.1") {
                    network.ServerSend(JSON.stringify({
                        type: "check-response",
                        resID: GenRequestID(6),
                        spec: {
                            reqID: rxp.reqID,
                            good: true,
                        }
                    }));
                } else {
                    console.log("Server got a check with bad game or version");
                    network.ServerSend(JSON.stringify({
                        type: "check-response",
                        resID: GenRequestID(6),
                        spec: {
                            reqID: rxp.reqID,
                            good: false,
                        }
                    }));
                }
            } else if (rxp.type === "connect") {
                // TODO: this probably needs some auth, eh?
                const cid = GenRequestID(8);
                console.log("Providing a new client id " + cid);
                network.ServerSend(JSON.stringify({
                    type: "connect-response",
                    resID: GenRequestID(6),
                    spec: {
                        reqID: rxp.reqID,
                        good: true,
                        cID: cid,
                    }
                }));
                
                // generate a user ball upon connect.
                let id = this._NewID(this._keylen);
                this._objs[id] = new UserBall(0, -ENGINE_HEIGHT/2);
                this._clients[cid] = {
                    id: id,
                };

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
                this._objs[this._clients[rxp.spec.cID].id].Key(rxp.spec.key, rxp.spec.down);
            } else {
                console.log("Server couldn't handle " + rxp.type);
            }
        }
    }

    Tick(dT) {
        this._HandleNetwork();

        if (!this._running) { return; }

        for (let k in this._objs) {
            const o = this._objs[k];
            o.Tick(dT);

            if (o.active === false) {
                this._rmQ.push(k);
            }
        }

        // See if clients need updated.
        this._update_time += dT;
        if (this._update_time >= this._update_period) {
            this._update_time = 0;
            this._UpdateClient();
        }

        //console.log("DEBUG nID: " + Object.keys(this._objs).length + ", b+: " + this._bomb_added + ", b-: " + this._bomb_removed);
    }
    
    Collides(b) {
        for (let k in this._objs) {
            const o = this._objs[k];
            if (o.type === "g" || o.type === "w" || o.type === "b") {
                if (Matter.SAT.collides(b, o._body).collided) { return true; }
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

                // NOTE
                // perhaps this adds way more than 2 ground elemnts on each bomb?

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
                            this._bomb_added++;
                        }

                        // Check if upper element should be added.
                        if (o.top < yt && yt < o.bottom) {
                            const ht = (yt - o.top) - 1;
                            if (ht > this._ge_wid) {
                                let id = this._NewID(this._keylen);
                                changes[id] = new GroundElement(o.left, o.top, o.width, ht);
                                this._addQ.push(id);
                                this._bomb_added++;
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
                            this._bomb_removed++;
                        }
                    }
                }
            }
        }

        // This seems to fix the increasing object count.
        for (let k in changes) {
            this._objs[k] = changes[k];
        }

        for (let k in this._objs) {
            const o = this._objs[k];
            if (o.type === "u") {
                o.Bomb(x, y, r);
            }
        }
    }

    Destroy() {
        console.log("ENGINE destroying.");

        for (let k in this._objs) {
            this._objs[k].Destroy();
            delete this._objs[k];
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

        World.add(engine.world, [this._body]);
    }
    
    Tick(dT) {}

    Destroy() {
        World.remove(engine.world, [this._body]);
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

        World.add(engine.world, [this._body]);
    }

    WithinXBounds(x) { return x > this.left && x < this.right; }
    
    Tick(dT) {}

    Destroy() {
        World.remove(engine.world, [this._body]);
    }
}

class UserBall {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.vx = 0;
        this.vy = 0;
        this.va = 0;

        this._falling = true;
        
        this._body = Bodies.circle(this.x, this.y, this.radius, 12);
        this._body.restitution = 0.5;
        this._body.slop = 0.02;
        World.add(engine.world, [this._body]);

        this._jumpcd_max = 1000;
        this._jumpcd = 0;

        this._jumpframes_max = 10;
        this._jumpframes = this._jumpframes_max;

        this.active = true;
        this.type = "u";

        this._keys = {w:false, a:false, s:false, d:false};
    }

    Key(k, d) {
        this._keys[k] = d;
    }

    Destroy() {
        World.remove(engine.world, [this._body]);
        this.active = false;
    }

    Position() { return {x:this.x, y:this.y} };

    Bomb(x, y, r) {
        if (!this.active) { return; }

        const hyp = Math.hypot(this.x - x, this.y - y);
        const str = Math.min(r - hyp / 1000000, 0.0001);

        if (hyp < r) {
            Matter.Body.applyForce(this._body, {x:this.x, y:this.x}, 
                {x: (this.x - x)*str, y: (this.y - y)*str});
        }
    }

    Tick(dT) {
        if (!this.active) { return; }

        const grounded = engine_network.Collides(this._body);

        // The player moves faster when grounded.
        if (grounded) {
            this._jumpframes = this._jumpframes_max;
            if (this._keys.a) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y - this.radius/3}, {x:-0.0001,y:0});
            } else if (this._keys.d) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y - this.radius/3}, {x:0.0001,y:0});
            }
        } else {
            if (this._keys.a) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y}, {x:-0.00005,y:0});
            } else if (this._keys.d) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y}, {x:0.00005,y:0});
            }
        }

        if (this._jumpcd <= 0 && this._jumpframes > 0 && this._keys[" "]) {
            Matter.Body.applyForce(this._body, this._body.position, {x:0, y:-0.001});
            this._jumpcd = this._jumpcd_max;
        }
        if (this._jumpcd > 0) {
            this._jumpcd -= dT;
        }
        if (this._jumpframes > 0 && !grounded) {
            this._jumpframes--;
        }

        if (Math.abs(this._body.angularVelocity) > 1) {
            Matter.Body.setAngularVelocity(this._body, Math.sign(this._body.angularVelocity));
        }

        this.x = Sigs(this._body.position.x);
        this.y = Sigs(this._body.position.y);
        this.vx = Sigs(this._body.velocity.x);
        this.vy = Sigs(this._body.velocity.y);
        this.va = Sigs(this._body.angularVelocity);
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

        if (this.radius < 4) {
            this._color = 0xf5ce42;
        } else if (this.radius < 8) {
            this._color = 0xf58a42;
        } else {
            this._color = 0xf55d42;
        }

        this.active = true;

        this._lifetime = t;

        this._explosion_radius = this.radius * 5;

        this.active = true;
        this.type = "b";
        
        this._body = Bodies.circle(this.x, this.y, this.radius, 6);
        this._body.restitution = 0.1;
        World.add(engine.world, [this._body]);

        // TODO: rather than a total lifetime timer, make the timer begin when the bomb hits ground
    }

    Tick(dT) {
        if (!this.active) { return; }

        this._lifetime -= dT;
        
        if (this._lifetime <= 0) {
            this.Destroy();
        }

        this.x = Sigs(this._body.position.x);
        this.y = Sigs(this._body.position.y);
        this.vx = Sigs(this._body.velocity.x);
        this.vy = Sigs(this._body.velocity.y);
        this.va = Sigs(this._body.angularVelocity);
    }

    Destroy() {
        if (!this.active) { return; }

        World.remove(engine.world, [this._body]);

        // TODO: needs to be moved to front end
        //ui_menu.AddExplosion(new BombExplosion(this.x, this.y, this._explosion_radius, this._color));

        engine_network.Bomb(this.x, this.y, this._explosion_radius);

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
    }

    Destroy() {}

    Tick(dT) {
        if (Math.random() < this._spawn_chance) {
            this._spawn_chance = this._spawn_chance_starting;
            engine_network.AddBomb(this.left + this.width * Math.random(), this.y, 4+Math.random()*6, 3000 + 3000*Math.random());
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

function GenRequestID(n) {
    return Math.round((Math.pow(36, n + 1) - Math.random() * Math.pow(36, n))).toString(36).slice(1);
}
