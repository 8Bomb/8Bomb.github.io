// Sky Hoffert
// Engine for 8Bomb.

// Matter.js stuff
const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;

engine = Engine.create();
engine.world.gravity.y = 0.2;
engine.timing.timeScale = 0;
Engine.run(engine);

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
        this._ids = [];
        this._objs = {};
        
        this._ge_wid = 2;
        this._ground_wid = WIDTH / this._ge_wid;
        this._ground_height = -HEIGHT/2 + 300;
        this._ground_dist_to_bot = HEIGHT/2 - this._ground_height;

        let id = this._NewID(3);
        for (let i = 0; i < this._ground_wid; i++) {
            id = this._NewID(3);
            this._ids.push(id);
            this._objs[id] = new GroundElement(-WIDTH/2 + this._ge_wid*i, this._ground_height, this._ge_wid, this._ground_dist_to_bot);
        }

        // Bomb spawner.
        id = this._NewID(3);
        this._ids.push(id);
        this._bomb_spawner = id;
        this._objs[id] = new BombSpawner(0, -HEIGHT/2 - 20, WIDTH - 40);
        
        // Magma.
        id = this._NewID(3);
        this._ids.push(id);
        this._magma = id;
        this._objs[id] = new Magma(0, HEIGHT/2 - 40, WIDTH, 80);
        
        // Left wall.
        id = this._NewID(3);
        this._ids.push(id);
        this._objs[id] = new Wall(-WIDTH/2 - 20, -HEIGHT/2, 40, HEIGHT);

        // Right wall.
        id = this._NewID(3);
        this._ids.push(id);
        this._objs[id] = new Wall(WIDTH/2 - 20, -HEIGHT/2, 40, HEIGHT);

        this._clientIDs = [];

        this._tasks = [];

        this._update_period = 10;
        this._update_time = 0;

        this._running = false;

        this._rmQ = [];
    }

    _NewID(n) {
        let id = GenRequestID(n);
        while (id in this._objs) {
            id = GenRequestID(n);
        }
        return id;
    }

    _InitClient(id, cid) {
        let msg_8B = {
            a: "aur",
            s: [],
        };
        for (let i = 0; i < this._ids.length; i++) {
            const type = this._objs[this._ids[i]].type;
            let specs = {
                a: "u",
                i: this._ids[i],
                t: type,
                s: {}
            };
            if (type === "w" || type === "bs" || type === "g" || type === "m") {
                specs.s = {
                    x: this._objs[this._ids[i]].x,
                    y: this._objs[this._ids[i]].y,
                    w: this._objs[this._ids[i]].width,
                    h: this._objs[this._ids[i]].height,
                };
            } else if (type === "b" || type === "u") {
                specs.s = {
                    x: this._objs[this._ids[i]].x,
                    y: this._objs[this._ids[i]].y,
                    r: this._objs[this._ids[i]].radius,
                }
            }
            msg_8B.s.push(specs);
        }

        network.ServerSend(JSON.stringify({
            type: "8B",
            resID: GenRequestID(6),
            spec: msg_8B,
        }));
    }

    _UpdateClient() {
        let msg_8B = {
            a: "aur",
            s: [],
        };
        for (let i = 0; i < this._ids.length; i++) {
            const o = this._objs[this._ids[i]];

            if (o.type !== "b" && o.type !== "u") { continue; }

            msg_8B.s.push({
                a: "u",
                i: this._ids[i],
                t: o.type,
                s: {
                    x: o.x, y: o.y, r:o.radius,
                },
            });
        }
        while (this._rmQ.length > 0) {
            msg_8B.s.push({
                a: "r",
                i: this._rmQ[0],
            });
            this._rmQ.splice(0, 1);
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
        const id = this._NewID(3);
        this._ids.push(id);
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
                this._clientIDs.push(cid);
                
                // generate a user ball upon connect.
                let id = this._NewID(3);
                this._ids.push(id);
                this._objs[id] = new UserBall(0, -HEIGHT/2);

                this._InitClient(id, cid);
            } else if (rxp.type === "admin") {
                console.log("ADMIN: Got an admin action!");
                if (rxp.spec.action === "start") {
                    this.Start();
                } else if (rxp.spec.action === "stop") {
                    this.Stop();
                }
            } else {
                console.log("Server couldn't handle " + rxp.type);
            }
        }
    }

    Tick(dT) {
        this._HandleNetwork();

        if (!this._running) { return; }

        for (let i = 0; i < this._ids.length; i++) {
            const o = this._objs[this._ids[i]];
            o.Tick(dT);

            if (o.active === false) {
                o.Destroy();
                delete this._objs[this._ids[i]];
                this._rmQ.push(this._ids[i]);
                this._ids.splice(i, 1);
                i--;
            }
        }

        // See if clients need updated.
        if (this._update_time >= this._update_period) {
            console.log("updating client.");
            this._update_time = 0;
            this._UpdateClient();
        } else {
            this._update_time += dT;
        }
    }
    
    Collides(b) {
        for (let i = 0; i < this._ids.length; i++) {
            const o = this._objs[this._ids[i]];
            if (o.type === "g" || o.type === "w" || o.type === "b") {
                if (Matter.SAT.collides(b, o._body).collided) { return true; }
            }
        }
        return false;
    }
    
    Bomb(x, y, r=30) {
        for (let xp = x - r + 1; xp < x + r - 1; xp += this._ge_wid/2) {
            const yd = fmath.sin(Math.acos((x - xp) / r)) * r;
            const yb = y + yd;
            const yt = y - yd;
            for (let i = 0; i < this._ids.length; i++) {
                const o = this._objs[this._ids[i]];
                if (o.type !== "g") { continue; }

                if (o.WithinXBounds(xp)) {
                    // If bomb explosion bottom reaches past top of elem.
                    if (o.top < yb) {
                        let gotone = false;
                        // Add lower element.
                        if (yb < o.bottom) {
                            // TODO
                            gotone = true;
                            continue;
                            this._elems.push(new GroundElement(o.left, yb + 1, o.width, o.bottom - (yb + 1)));
                        }

                        // Check if upper element should be added.
                        if (o.top < yt && yt < o.bottom) {
                            const ht = (yt - o.top) - 1;
                            if (ht > 2) {
                                // TODO
                                continue;
                                this._elems.push(new GroundElement(o.left, o.top, o.width, ht));
                            }
                            console.log("a");
                            gotone = true;
                        }

                        // finally, check if the entire element is within the blast.
                        if (o.top > yt && o.bottom < yb) {
                            console.log("b");
                            gotone = true;
                        }

                        // Remove old element.
                        if (gotone) {
                            console.log("here");
                            o.Destroy();
                            delete this._objs[this._ids[i]];
                            this._rmQ.push(this._ids[i]);
                            this._ids.splice(i, 1);
                            i--;
                        }
                    }
                }
            }
        }

        for (let i = 0; i < this._ids.length; i++) {
            const o = this._objs[this._ids[i]];
            if (o.type === "u") {
                o.Bomb(x, y, r);
            }
        }
    }

    Destroy() {
        for (let i = 0; i < this._walls.length; i++) {
            this._walls[i].Destroy();
        }

        // TODO: destroy other stuff
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

        this._falling = true;
        
        this._body = Bodies.circle(this.x, this.y, this.radius, 12);
        this._body.restitution = 0.5;
        this._body.slop = 0.02;
        World.add(engine.world, [this._body]);

        this._jumpcd_max = 30;
        this._jumpcd = 0;

        this._jumpframes_max = 10;
        this._jumpframes = this._jumpframes_max;

        this.active = true;
        this.type = "u";

        this._keys = {w:false, a:false, s:false, d:false};
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

        const grounded = engine_local.Collides(this._body);

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

        this.x = this._body.position.x;
        this.y = this._body.position.y;
    }
}

class Bomb {
    constructor(x, y, r, t) {
        this.x = x;
        this.y = y;
        this.radius = r;
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
        this._lifetime -= dT;
        
        if (this._lifetime <= 0) {
            this.Destroy();
        }

        this.x = this._body.position.x;
        this.y = this._body.position.y;
    }

    Destroy() {
        World.remove(engine.world, [this._body]);

        // TODO: needs to be moved to front end
        //ui_menu.AddExplosion(new BombExplosion(this.x, this.y, this._explosion_radius, this._color));

        engine_local.Bomb(this.x, this.y, this._explosion_radius);

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

    Tick(dT) {
        if (Math.random() < this._spawn_chance) {
            this._spawn_chance = this._spawn_chance_starting;
            engine_local.AddBomb(this.left + this.width * Math.random(), this.y, 4+Math.random()*6, 200 + 80*Math.random());
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

    Tick(dT) {}

    Contains(x, y) {
        return x > this.left && x < this.right && y > this.top && y < this.bottom;
    }
}

function GenRequestID(n) {
    return Math.round((Math.pow(36, n + 1) - Math.random() * Math.pow(36, n))).toString(36).slice(1);
}
