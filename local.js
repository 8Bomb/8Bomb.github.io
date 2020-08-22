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
        this._arcval = Math.cos(this._elapsed / 20) * Math.PI*2;
        this._arcval2 = Math.cos(this._elapsed / 25) * Math.PI*2;

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
                    for (let i = 0; i < rxp.spec.s.length; i++) {
                        const o = rxp.spec.s[i];
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
                                    console.log("couldn't add/update bomb spawner.");
                                } else if (o.t === "m") {
                                    this._objs[o.i] = new Draw_Magma(o.s.x, o.s.y, o.s.w, o.s.h);
                                }
                            }
                            
                            // Update all objects.
                            if (o.t === "w" || o.t === "g" || o.t === "m") {
                                this._objs[o.i].Update(o.s.x, o.s.y);
                            } else if (o.t === "b" || o.t === "u") {
                                this._objs[o.i].Update(o.s.x, o.s.y);
                            }
                        } else if (o.a === "r") {
                            this._objs[o.i].Destroy();
                            this._ids.splice(this._ids.indexOf(o.a), 1);
                            delete this._objs[o.i];
                        }
                    }
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
                "action": "start",
            },
        }));
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
    Key(k, d) {}

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
        this._x = x;
        this._y = y;
        this._left = x - w/2;
        this._top = y - h/2;
        this._width = w;
        this._height = h;
        this._bottom = y + h/2;
        this._right = x + w/2;
    }

    Destroy() {}

    Update(x, y) {
        this._x = x;
        this._y = y;
    }

    Draw() {
        stage_graphics.lineStyle(0);
        stage_graphics.beginFill(MAP_COLORS[play_opts.map].wall);
        stage_graphics.drawRect(this._left, this._top, this._width, this._height);
        stage_graphics.endFill();
    }
}

class Draw_GroundElement {
    constructor(x, y, w, h) {
        this._x = x;
        this._y = y;
        this._width = w;
        this._height = h;
        this._left = x - w/2;
        this._right = x + w/2;
        this._top = y - h/2;
        this._bottom = y + h/2;
    }

    Destroy() {}

    Update(x, y) {
        this._x = x;
        this._y = y;
    }

    Draw() {
        stage_graphics.lineStyle(0);
        stage_graphics.beginFill(MAP_COLORS[play_opts.map].ground);
        stage_graphics.drawRect(this._left, this._top, this._width, this._height);
        stage_graphics.endFill();
    }
}

class Draw_UserBall {
    constructor(x, y, r) {
        this._x = x;
        this._y = y;
        this._radius = r;
    }

    Destroy() {}

    Update(x, y) {
        this._x = x;
        this._y = y;
    }

    Tick(dT) {}

    Draw() {
        stage_graphics.lineStyle(1, 0xffff00, 1);
        stage_graphics.beginFill(0xff0000);
        stage_graphics.drawCircle(this._x, this._y, this._radius);
        stage_graphics.endFill();
    }
}

class Draw_Bomb {
    constructor(x, y, r) {
        this._x = x;
        this._y = y;
        this._radius = r;

        this.active = true;
    }

    Destroy() {}
    
    Update(x, y) {
        this._x = x;
        this._y = y;
    }

    Tick(dT) {}

    Draw() {
        if (this.active === false) { return; }

        stage_graphics.lineStyle(1, 0x42e3f5, 1);
        stage_graphics.beginFill(MAP_COLORS[play_opts.map].bomb);
        stage_graphics.drawCircle(this._x, this._y, this._radius);
        stage_graphics.endFill();
    }
}

// TODO: what to do here?
class Draw_BombExplosion {
    constructor(x, y, r, c) {
        this._x = x;
        this._y = y;
        this._radius = r;
        this._alpha = 1;
        this._color = c;

        this._active = true;
    }

    Destroy() {}

    Tick(dT) {
        this._radius *= 0.95;
        this._alpha *= 0.95;

        if (this._radius < 1) {
            this.active = false;
        }
    }

    Draw() {
        stage_graphics.lineStyle(0);
        stage_graphics.beginFill(this._color, this._alpha);
        stage_graphics.drawCircle(this._x, this._y, this._radius);
        stage_graphics.endFill();
    }
}

class Draw_Magma {
    constructor(x, y, w, h) {
        this._x = x;
        this._y = y;
        this._width = w;
        this._height = h;
        this._left = x - w/2;
        this._right = x + w/2;
        this._top = y - h/2;
        this._bottom = y + h/2;
    }

    Destroy() {}

    Update(x, y) {
        this._x = x;
        this._y = y;
    }

    Tick(dT) {}

    Draw() {
        stage_graphics.lineStyle(0);
        stage_graphics.beginFill(MAP_COLORS[play_opts.map].magma);
        stage_graphics.drawRect(this._left, this._top, this._width, this._height);
        stage_graphics.endFill();
    }
}
