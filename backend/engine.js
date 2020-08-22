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
        console.log("msglen: " + msg.length);
        const msgc = LZUTF8.compress(msg, {outputEncoding:"Base64"});
        console.log("cmprlen: " + msgc.length);
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

        let id = GenRequestID(3);
        for (let i = 0; i < this._ground_wid; i++) {
            while (id in this._objs) {
                id = GenRequestID(3);
            }

            this._ids.push(id);
            this._objs[id] = new GroundElement(-WIDTH/2 + this._ge_wid*i, this._ground_height, this._ge_wid, this._ground_dist_to_bot);
        }

        // Bomb spawner.
        while (id in this._objs) {
            id = GenRequestID(3);
        }
        this._ids.push(id);
        this._bomb_spawner = id;
        this._objs[id] = new BombSpawner(0, -HEIGHT/2 - 20, WIDTH - 40);
        
        // Magma.
        while (id in this._objs) {
            id = GenRequestID(3);
        }
        this._ids.push(id);
        this._magma = id;
        this._objs[id] = new Magma(0, HEIGHT/2 - 40, WIDTH, 80);
        
        // Left wall.
        while (id in this._objs) {
            id = GenRequestID(3);
        }
        this._ids.push(id);
        this._objs[id] = new Wall(-WIDTH/2 - 20, -HEIGHT/2, 40, HEIGHT);

        // Right wall.
        while (id in this._objs) {
            id = GenRequestID(3);
        }
        this._ids.push(id);
        this._objs[id] = new Wall(WIDTH/2 - 20, -HEIGHT/2, 40, HEIGHT);

        this._clientIDs = [];

        this._tasks = [];
    }

    _InitClient() {
        let msg = {
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
            if (type === "w" || type === "bs" || type === "g") {
                specs.s = {
                    x: this._objs[this._ids[i]].x,
                    y: this._objs[this._ids[i]].y,
                    w: this._objs[this._ids[i]].width,
                    h: this._objs[this._ids[i]].height,
                };
            }
        }
    }

    Start() { engine.timing.timeScale = 1; }
    Stop() { engine.timing.timeScale = 0; }

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

    Tick(dT) {
        // Handle network.
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
                while (id in this._objs) {
                    id = GenRequestID(3);
                }
                this._ids.push(id);
                this._balls.push(id);
                this._objs[id] = new UserBall(0, -HEIGHT/2);

                this._InitClient(id);
            } else {
                console.log("Server couldn't handle " + rxp.type);
            }
        }

        if (!this._started) { return; }

        this._bomb_spawner.Tick(dT);

        this._user_ball.Tick(dT);

        for (let i = 0; i < this._explosions.length; i++) {
            this._explosions[i].Tick(dT);
            if (this._explosions[i].active === false) {
                this._explosions.splice(i, 1);
                i--;
            }
        }

        const userpos = this._user_ball.Position();
        if (this._magma.Contains(userpos.x, userpos.y)) {
            this._user_ball.Destroy();
        }
    }
    
    Collides(b) {
        for (let i = 0; i < this._elems.length; i++) {
            if (Matter.SAT.collides(b, this._elems[i]._body).collided) { return true; }
        }
    }
    
    Bomb(x, y, r=30) {
        for (let xp = x - r + 1; xp < x + r - 1; xp += this._ge_wid/2) {
            const yd = fmath.sin(Math.acos((x - xp) / r)) * r;
            const yb = y + yd;
            const yt = y - yd;
            for (let i = 0; i < this._elems.length; i++) {
                if (this._elems[i].WithinXBounds(xp)) {
                    // If bomb explosion bottom reaches past top of elem.
                    if (this._elems[i].Top() < yb) {
                        let gotone = false;
                        // Add lower element.
                        if (yb < this._elems[i].Bottom()) {
                            this._elems.push(new GroundElement(this._elems[i].Left(), yb + 1, this._elems[i].Width(), this._elems[i].Bottom() - (yb + 1)));
                            gotone = true;
                        }

                        // Check if upper element should be added.
                        if (this._elems[i].Top() < yt && yt < this._elems[i].Bottom()) {
                            const ht = (yt - this._elems[i].Top()) - 1;
                            if (ht > 2) {
                                this._elems.push(new GroundElement(this._elems[i].Left(), this._elems[i].Top(), this._elems[i].Width(), ht));
                            }
                            gotone = true;
                        }

                        // finally, check if the entire element is within the blast.
                        if (this._elems[i].Top() > yt && this._elems[i].Bottom() < yb) {
                            gotone = true;
                        }

                        // Remove old element.
                        if (gotone) {
                            this._elems[i].Destroy();
                            this._elems.splice(i, 1);
                            i--;
                        }
                    }
                }
            }
        }

        this._user_ball.Bomb(x, y, r);
    }

    Destroy() {
        for (let i = 0; i < this._walls.length; i++) {
            this._walls[i].Destroy();
        }

        // TODO: destroy other stuff
    }
}

class Wall {
    constructor(l, t, w, h, e) {
        this._x = l + w/2;
        this._y = t + h/2;
        this._left = l;
        this._top = t;
        this._width = w;
        this._height = h;
        this._bottom = t + h;
        this._right = l + w;

        this.active = true;
        this.type = "w";

        this._body = Bodies.rectangle(this._x, this._y, this._width, this._height, {isStatic:true})

        World.add(engine.world, [this._body]);
    }
    
    Tick(dT) {}

    Destroy() {
        World.remove(engine.world, [this._body]);
    }

    Draw() {
        stage_graphics.lineStyle(0);
        stage_graphics.beginFill(MAP_COLORS[play_opts.map].wall);
        stage_graphics.drawRect(this._left, this._top, this._width, this._height);
        stage_graphics.endFill();
    }
}

class GroundElement {
    constructor(l, t, w, h) {
        this._x = l + w/2;
        this._y = t + h/2;
        this._width = w;
        this._height = h;
        
        this._left = l;
        this._right = l + w;
        this._top = t;
        this._bottom = t + h;

        this.active = true;
        this.type = "g";

        this._body = Bodies.rectangle(this._x, this._y, this._width, this._height, {isStatic:true});

        World.add(engine.world, [this._body]);
    }

    Left() { return this._left; }
    Right() { return this._right; }
    Top() { return this._top; }
    Bottom() { return this._bottom; }
    Width() { return this._width; }
    Height() { return this._height; }
    WithinXBounds(x) { return x > this._left && x < this._right; }
    
    Tick(dT) {}

    Destroy() {
        World.remove(engine.world, [this._body]);
    }
}

class UserBall {
    constructor(x, y) {
        this._x = x;
        this._y = y;
        this._radius = 8;

        this._falling = true;
        
        this._body = Bodies.circle(this._x, this._y, this._radius, 12);
        this._body.restitution = 0.5;
        this._body.slop = 0.02;
        World.add(engine.world, [this._body]);

        this._jumpcd_max = 30;
        this._jumpcd = 0;

        this._jumpframes_max = 10;
        this._jumpframes = this._jumpframes_max;

        this.active = true;
        this.type = "u";
    }

    Destroy() {
        World.remove(engine.world, [this._body]);
        this.active = false;
    }

    Position() { return {x:this._x, y:this._y} };

    Bomb(x, y, r) {
        if (!this.active) { return; }

        const hyp = Math.hypot(this._x - x, this._y - y);
        const str = Math.min(r - hyp / 1000000, 0.0001);

        if (hyp < r) {
            Matter.Body.applyForce(this._body, {x:this._x, y:this._x}, 
                {x: (this._x - x)*str, y: (this._y - y)*str});
        }
    }

    Tick(dT) {
        if (!this.active) { return; }

        const grounded = ui_menu.Collides(this._body);

        // The player moves faster when grounded.
        if (grounded) {
            this._jumpframes = this._jumpframes_max;
            if (keys.a) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y - this._radius/3}, {x:-0.0001,y:0});
            } else if (keys.d) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y - this._radius/3}, {x:0.0001,y:0});
            }
        } else {
            if (keys.a) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y}, {x:-0.00005,y:0});
            } else if (keys.d) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y}, {x:0.00005,y:0});
            }
        }

        if (this._jumpcd <= 0 && this._jumpframes > 0 && keys[" "]) {
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

        this._x = this._body.position.x;
        this._y = this._body.position.y;
    }
}

class Bomb {
    constructor(x, y, r, t) {
        this._x = x;
        this._y = y;
        this._radius = r;
        if (this._radius < 4) {
            this._color = 0xf5ce42;
        } else if (this._radius < 8) {
            this._color = 0xf58a42;
        } else {
            this._color = 0xf55d42;
        }

        this.active = true;

        this._lifetime = t;

        this._explosion_radius = this._radius * 5;

        this.active = true;
        this.type = "b";
        
        this._body = Bodies.circle(this._x, this._y, this._radius, 6);
        this._body.restitution = 0.1;
        World.add(engine.world, [this._body]);

        // TODO: rather than a total lifetime timer, make the timer begin when the bomb hits ground
    }

    Tick(dT) {
        this._lifetime -= dT;
        
        if (this._lifetime <= 0) {
            this.Destroy();
        }

        this._x = this._body.position.x;
        this._y = this._body.position.y;
    }

    Destroy() {
        World.remove(engine.world, [this._body]);

        ui_menu.AddExplosion(new BombExplosion(this._x, this._y, this._explosion_radius, this._color));

        ui_menu.Bomb(this._x, this._y, this._explosion_radius);

        this.active = false;
    }
}

class BombSpawner {
    constructor(x, y, w) {
        this._x = x;
        this._y = y;
        this._width = w;
        this._height = 20;

        this._left = this._x - this._width/2;
        this._right = this._x + this._width/2;
        this._top = this._y - this._height/2;
        this._bottom = this._y + this._height/2;
        
        this.active = true;
        this.type = "bs";

        this._bombs = [];

        this._spawn_chance_starting = play_opts.bomb_factor === 0 ? 0.002 : play_opts.bomb_factor === 1 ? 0.008 : 0.02;
        this._spawn_chance = this._spawn_chance_starting;
    }

    Tick(dT) {
        for (let i = 0; i < this._bombs.length; i++) {
            this._bombs[i].Tick(dT);
            if (this._bombs[i].active === false) {
                this._bombs.splice(i, 1);
                i--;
            }
        }

        if (Math.random() < this._spawn_chance) {
            this._spawn_chance = this._spawn_chance_starting;
            this._bombs.push(new Bomb(this._left + this._width * Math.random(), this._y, 4+Math.random()*6, 200 + 80*Math.random()));
        } else {
            this._spawn_chance *= play_opts.bomb_factor === 0 ? 1.01 : 1.02;
        }
    }
}

class Magma {
    constructor(x, y, w, h) {
        this._x = x;
        this._y = y;
        this._width = w;
        this._height = h;
        this._left = x - w/2;
        this._right = x + w/2;
        this._top = y - h/2;
        this._bottom = y + h/2;
        
        this.active = true;
        this.type = "m";
    }

    Tick(dT) {}

    Contains(x, y) {
        return x > this._left && x < this._right && y > this._top && y < this._bottom;
    }
}

function GenRequestID(n) {
    return Math.round((Math.pow(36, n + 1) - Math.random() * Math.pow(36, n))).toString(36).slice(1);
}
