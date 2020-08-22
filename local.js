// Sky Hoffert
// js for local play.

class Load_LocalPlay {
    constructor() {
        this._arcval = 0;
        this._arcval2 = 0;

        this._elapsed = 0;

        this._loadpc = 0;

        this._fading = false;
        this._fade_pc = 1;
        this._active = true;
    }

    Destroy() {}

    MouseMove(x, y) {}
    MouseDown(x, y, b) {}
    Key(k, d) {}

    Tick(dT) {
        if (!this._active) { return; }

        this._elapsed += dT;
        this._arcval = Math.cos(this._elapsed / 600) * Math.PI*2;
        this._arcval2 = Math.cos(this._elapsed / 850) * Math.PI*2;

        if (this._loadpc >= 1) {
            this._fading = true;
        }

        if (this._fading) {
            this._fade_pc -= 0.01;
            if (this._fade_pc <= 0) {
                stage_actions.push("play start");
                this._active = false;
            }
        }

        if (loading_stage.Loaded()) {
            this._loadpc = 1;
        }
    }

    Draw() {
        if (!this._active) { return; }

        ui_graphics.beginFill(0x000000, this._fade_pc);
        ui_graphics.drawRect(0, 0, WIDTH, HEIGHT);
        ui_graphics.endFill();

        ui_graphics.beginFill(color_scheme.title, this._fade_pc**4);
        ui_graphics.drawCircle(WIDTH/2, HEIGHT/2, 50);
        ui_graphics.endFill();

        ui_graphics.lineStyle(20, color_scheme.text, this._fade_pc**4);
        const v0 = Math.max(this._arcval, this._arcval2);
        const v1 = Math.min(this._arcval, this._arcval2);
        ui_graphics.arc(WIDTH/2, HEIGHT/2, 50, v0, v1, true);
    }
}

class LocalPlay {
    constructor() {
        app.renderer.backgroundColor = MAP_COLORS[play_opts.map].bg;
        this._loading = true;

        this._ids = [];
        this._objs = {};

        this._rxStr = "";

        this._ping = -1;
        this._connected = false;

        this._clientID = -1;

        // Whie loading, make a ping request.
        network.ClientSend(JSON.stringify({
            "type": "ping",
            "reqID": GenRequestID(6),
            "spec": {
                "tsent": window.performance.now(),
            },
        }));

        // While loading, make a connection request.
        network.ClientSend(JSON.stringify({
            "type": "check",
            "reqID": GenRequestID(6),
            "spec": {
                "game": "8Bomb",
                "version": "0.1",
            },
        }));
    }

    _ClearWorld() {
        while (this._ids.length > 0) {
            this._objs[this._ids[0]].Destroy();
            delete this._objs[this._ids[0]];
            this._ids.splice(0, 1);
        }
    }

    _HandleNetwork() {
        // Handle network.
        const rx = network.ClientRecv();
        if (rx !== "") {
            let rxp = {};
            try {
                rxp = JSON.parse(rx);
            } catch {
                console.log("ERR. Could not parse rx message in client.");
            }

            if (rxp.type === "pong") {
                const now = window.performance.now();
                this._ping = now - parseFloat(rxp.spec.tsent);
                console.log("ping: " + this._ping + " ms");
            } else if (rxp.type === "check-response") {
                if (rxp.spec.good) {
                    this._checked = true;

                    network.ClientSend(JSON.stringify({
                        "type": "connect",
                        "reqID": GenRequestID(6),
                        "spec": {},
                    }));
                } else {
                    console.log("FAILED. Check got good=false.");
                    this._failed = true;
                    stage_actions.push("check failed");
                }
            } else if (rxp.type === "connect-response") {
                if (rxp.spec.good) {
                    this._clientID = rxp.spec.cID;
                    console.log("Given client ID " + this._clientID);
                } else {
                    console.log("FAILED. Connect got good=false.");
                    this._failed = true;
                    stage_actions.push("connect failed");
                }
            } else if (rxp.type === "8B") {
                if (rxp.spec.a === "aur") {
                    let lost = "LOST ";
                    for (let i = 0; i < rxp.spec.s.length; i++) {
                        const o = rxp.spec.s[i];
                        //console.log("" + i);
                        //console.log(rxp.spec);
                        if (o.a === "u") {
                            if (!(o.i in this._objs)) {
                                this._ids.push(o.i);
                                if (o.t === "w") {
                                    this._objs[o.i] = new Draw_Wall(o.s.x, o.s.y, o.s.w, o.s.h);
                                } else if (o.t === "g") {
                                    this._objs[o.i] = new Draw_GroundElement(o.s.x, o.s.y, o.s.w, o.s.h);
                                } else if (o.t === "b") {
                                    this._objs[o.i] = new Draw_Bomb(o.s.x, o.s.y, o.s.r);
                                } else if (o.t === "u") {
                                    this._objs[o.i] = new Draw_UserBall(o.s.x, o.s.y, o.s.r);
                                } else if (o.t === "bs") {
                                    this._objs[o.i] = new Draw_BombSpawner();
                                } else if (o.t === "m") {
                                    this._objs[o.i] = new Draw_Magma(o.s.x, o.s.y, o.s.w, o.s.h);
                                }
                            }
                            
                            // Update all objects.
                            if (o.t === "w" || o.t === "g" || o.t === "m") {
                                this._objs[o.i].Update(o.s.x, o.s.y);
                            } else if (o.t === "b" || o.t === "u") {
                                this._objs[o.i].Update(o.s.x, o.s.y, o.s.vx, o.s.vy);
                            }
                        } else if (o.a === "r") {
                            if (o.i in this._objs) {
                                this._objs[o.i].Destroy();
                                this._ids.splice(this._ids.indexOf(o.i), 1);
                                delete this._objs[o.i];
                            } else {
                                //console.log("TODO: this should never appear???");
                                //console.log("idx: " + this._ids.indexOf(o.i));
                                lost += "" + o.i + ",";
                            }
                        }
                    }
                } else if (rxp.spec.a === "cw") {
                    this._ClearWorld();
                }
            } else {
                console.log("Client couldn't handle " + rxp.type);
            }
        }
    }

    Start() {
        network.ClientSend(JSON.stringify({
            "type": "admin",
            "reqID": GenRequestID(6),
            "spec": {
                "action": "destroy",
            },
        }));
        network.ClientSend(JSON.stringify({
            "type": "admin",
            "reqID": GenRequestID(6),
            "spec": {
                "action": "create",
            },
        }));
        network.ClientSend(JSON.stringify({
            "type": "connect",
            "reqID": GenRequestID(6),
            "spec": {},
        }));
        network.ClientSend(JSON.stringify({
            "type": "admin",
            "reqID": GenRequestID(6),
            "spec": {
                "action": "start",
            },
        }));
    }

    Stop() {
        network.ClientSend(JSON.stringify({
            "type": "admin",
            "reqID": GenRequestID(6),
            "spec": {
                "action": "stop",
            },
        }));
        network.ClientSend(JSON.stringify({
            "type": "admin",
            "reqID": GenRequestID(6),
            "spec": {
                "action": "destroy",
            },
        }));
    }

    Destroy() {
        this.Stop();
    }

    Tick(dT) {
        this._HandleNetwork();
    }

    Loaded() {
        return this._ping !== -1 && this._checked;
    }

    MouseMove(x, y) {}
    MouseDown(x, y, b) {
        // TODO: move to engine.js
        //const pt = viewport.toWorld(x, y);
        //this.Bomb(pt.x, pt.y);
    }
    Key(k, d) {
        // DEBUG
        if (k === "Escape") {
            stage_actions.push("connect failed");
        }
    }

    Draw() {
        for (let i = 0; i < this._ids.length; i++) {
            if (this._ids[i] in this._objs) {
                this._objs[this._ids[i]].Draw();
            }
        }
    }
}

class Draw_Wall {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.left = x - w/2;
        this.top = y - h/2;
        this.width = w;
        this.height = h;
        this.bottom = y + h/2;
        this.right = x + w/2;

        this._body = Bodies.rectangle(this.x, this.y, this.width, this.height, {isStatic:true})

        World.add(engine_local.world, [this._body]);
    }

    Destroy() {
        World.remove(engine_local.world, [this._body]);
    }

    Update(x, y) {
        this.x = x;
        this.y = y;
    }

    Draw() {
        fore_graphics.lineStyle(0);
        fore_graphics.beginFill(MAP_COLORS[play_opts.map].wall);
        fore_graphics.drawRect(this.left, this.top, this.width, this.height);
        fore_graphics.endFill();
    }
}

class Draw_GroundElement {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.left = x - w/2;
        this.right = x + w/2;
        this.top = y - h/2;
        this.bottom = y + h/2;
        
        this._body = Bodies.rectangle(this.x, this.y, this.width, this.height, {isStatic:true});

        World.add(engine_local.world, [this._body]);
    }

    Destroy() {
        World.remove(engine_local.world, [this._body]);
    }

    Update(x, y) {
        this.x = x;
        this.y = y;
    }

    Draw() {
        stage_graphics.lineStyle(0);
        stage_graphics.beginFill(MAP_COLORS[play_opts.map].ground);
        stage_graphics.drawRect(this.left, this.top, this.width, this.height);
        stage_graphics.endFill();
    }
}

class Draw_UserBall {
    constructor(x, y, r) {
        this.x = x;
        this.y = y;
        this.radius = r;
        
        this._body = Bodies.circle(this.x, this.y, this.radius, 12);
        this._body.restitution = 0.5;
        this._body.slop = 0.02;
        World.add(engine_local.world, [this._body]);
    }

    Destroy() {
        World.remove(engine_local.world, [this._body]);
    }

    Update(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        Body.setPosition(this._body, {x:x, y:y});
        Body.setVelocity(this._body, {x:vx, y:vy});
    }

    Tick(dT) {}

    Draw() {
        stage_graphics.lineStyle(1, 0xffff00, 1);
        stage_graphics.beginFill(0xff0000);
        stage_graphics.drawCircle(this.x, this.y, this.radius);
        stage_graphics.endFill();
    }
}

class Draw_Bomb {
    constructor(x, y, r) {
        this.x = x;
        this.y = y;
        this.radius = r;

        this.active = true;

        this._body = Bodies.circle(this.x, this.y, this.radius, 6);
        this._body.restitution = 0.1;
        World.add(engine_local.world, [this._body]);
    }

    Destroy() {
        World.remove(engine_local.world, [this._body]);
    }
    
    Update(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        Body.setPosition(this._body, {x:x, y:y});
        Body.setVelocity(this._body, {x:vx, y:vy});
    }

    Tick(dT) {}

    Draw() {
        if (this.active === false) { return; }

        stage_graphics.lineStyle(1, 0x42e3f5, 1);
        stage_graphics.beginFill(MAP_COLORS[play_opts.map].bomb);
        stage_graphics.drawCircle(this.x, this.y, this.radius);
        stage_graphics.endFill();
    }
}

// TODO: what to do here?
class Draw_BombExplosion {
    constructor(x, y, r, c) {
        this.x = x;
        this.y = y;
        this.radius = r;
        this._alpha = 1;
        this._color = c;

        this._active = true;
    }

    Destroy() {}

    Tick(dT) {
        this.radius *= 0.95;
        this._alpha *= 0.95;

        if (this.radius < 1) {
            this.active = false;
        }
    }

    Draw() {
        stage_graphics.lineStyle(0);
        stage_graphics.beginFill(this._color, this._alpha);
        stage_graphics.drawCircle(this.x, this.y, this.radius);
        stage_graphics.endFill();
    }
}

class Draw_Magma {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.left = x - w/2;
        this.right = x + w/2;
        this.top = y - h/2;
        this.bottom = y + h/2;
    }

    Destroy() {}

    Update(x, y) {
        this.x = x;
        this.y = y;
    }

    Tick(dT) {}

    Draw() {
        fore_graphics.lineStyle(0);
        fore_graphics.beginFill(MAP_COLORS[play_opts.map].magma);
        fore_graphics.drawRect(this.left, this.top, this.width, this.height);
        fore_graphics.endFill();
    }
}

// DEBUG: placeholder class
class Draw_BombSpawner {
    constructor() {}
    Tick(dt) {}
    Destroy() {}
    Draw() {}
}
