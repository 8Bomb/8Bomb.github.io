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

        ui_graphics_1.lineStyle(0);
        ui_graphics_1.beginFill(0x000000, this._fade_pc);
        ui_graphics_1.drawRect(0, 0, WIDTH, HEIGHT);
        ui_graphics_1.endFill();

        ui_graphics_1.beginFill(color_scheme.title, this._fade_pc**4);
        ui_graphics_1.drawCircle(WIDTH/2, HEIGHT/2, 50);
        ui_graphics_1.endFill();

        ui_graphics_1.lineStyle(20, color_scheme.text, this._fade_pc**4);
        const v0 = Math.max(this._arcval, this._arcval2);
        const v1 = Math.min(this._arcval, this._arcval2);
        ui_graphics_1.arc(WIDTH/2, HEIGHT/2, 50, v0, v1, true);
    }
}

class UI_Online {
    constructor() {
        this.paused = false;
        this._fade = 0;
        this._fade_alpha = 0.5;

        this._ping_text = new PIXI.Text("- ms",
            {fontFamily:"monospace", fontSize:14, fill:0xffffff, align:"right"});
        this._ping_text.position.set(WIDTH - 10, 14);
        this._ping_text.anchor.set(1, 0.5);
        ui.addChild(this._ping_text);
    }

    Tick(dT) {
        if (this.paused) {
            if (this._fade < this._fade_alpha) {
                this._fade += 0.05;
                if (this._fade > this._fade_alpha) {
                    this._fade = this._fade_alpha;
                }
            }
        } else {
            if (this._fade > 0) {
                this._fade -= 0.05;
                if (this._fade < 0) {
                    this._fade = 0;
                }
            }
        }
    }

    SetPing(v) {
        this._ping_text.text = "" + v + " ms";
        this._ping_text.updateText();
    }

    Toggle() {
        this.paused = !this.paused;
    }

    Draw() {
        if (this._fade <= 0) { return; }

        ui_graphics_1.lineStyle(0);
        ui_graphics_1.beginFill(0x000000, this._fade);
        ui_graphics_1.drawRect(0, 0, WIDTH, HEIGHT);
        ui_graphics_1.endFill();
    }
}

class LocalPlay {
    constructor() {
        app.renderer.backgroundColor = MAP_COLORS[play_opts.map].bg;
        this._loading = true;

        this._objs = {};

        this._rxStr = "";

        this._ping = -1;
        this._ping_timer = 0;
        this._connected = false;
        this._checked = false;
        this._loaded = false;

        this._clientID = -1;

        this._ui = new UI_Online();
        
        const loader = new PIXI.Loader(); // you can also create your own if you want
        
        // Chainable `add` to enqueue a resource
        loader.add("balls", "gfx/ball_spritesheet.png");
        
        loader.load((loader, resources) => {
            textures_cache.ball_sprites = new PIXI.Texture(resources.balls.texture);
        });
        
        let self = this;
        loader.onComplete.add(function () {
            self._loaded = true;
        });
        this._ids_to_apply_tex = [];
    }

    _ClearWorld() {
        console.log("Manually cleared world. TODO is this necessary?");
        for (let k in this._objs) {
            this._objs[k].Destroy();
            delete this._objs[k];
        }
    }

    _HandleNetwork() {
        // Handle network.
        while (network.HasData()) {
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
                    //console.log("ping: " + Sigs(this._ping) + " ms");
                    this._ui.SetPing(Sigs(this._ping, 0));
                } else if (rxp.type === "open-response") {
                    this._clientID = rxp.spec.cID;
                    console.log("Given client ID " + this._clientID);

                    // Whie loading, make a ping request.
                    network.ClientSend(JSON.stringify({
                        type: "ping",
                        reqID: GenRequestID(6),
                        spec: {
                            tsent: Sigs(window.performance.now()),
                            cID: this._clientID,
                        },
                    }));
            
                    // While loading, make a connection request.
                    network.ClientSend(JSON.stringify({
                        type: "check",
                        reqID: GenRequestID(6),
                        spec: {
                            game: "8Bomb",
                            version: "0.1",
                            cID: this._clientID,
                        },
                    }));
                } else if (rxp.type === "check-response") {
                    if (rxp.spec.good) {
                        this._checked = true;

                        network.ClientSend(JSON.stringify({
                            type: "connect",
                            reqID: GenRequestID(6),
                            spec: {
                                cID: this._clientID,
                            },
                        }));
                    } else {
                        console.log("FAILED. Check got good=false.");
                        this._failed = true;
                        stage_actions.push("check failed");
                    }
                } else if (rxp.type === "connect-response") {
                    if (rxp.spec.good) {
                        console.log("Got good connection to server");
                        //console.log("color: " + rxp.spec.color);
                        this._connected = true;

                        this._debug_text = new PIXI.Text("your color",
                            {fontFamily:"monospace", fontSize:50, fill:rxp.spec.color, align:"left", fontWeight:"bold"});
                        this._debug_text.position.set(20, 30);
                        this._debug_text.anchor.set(0, 0.5);
                        ui.addChild(this._debug_text);
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
                                    if (o.t === "w") {
                                        this._objs[o.i] = new Draw_Wall(o.s.x, o.s.y, o.s.w, o.s.h);
                                    } else if (o.t === "g") {
                                        this._objs[o.i] = new Draw_GroundElement(o.s.x, o.s.y, o.s.w, o.s.h);
                                    } else if (o.t === "b") {
                                        this._objs[o.i] = new Draw_Bomb(o.s.x, o.s.y, o.s.r, o.s.c);
                                    } else if (o.t === "u") {
                                        this._objs[o.i] = new Draw_UserBall(o.s.x, o.s.y, o.s.r, o.s.c);
                                    } else if (o.t === "bs") {
                                        this._objs[o.i] = new Draw_BombSpawner();
                                    } else if (o.t === "m") {
                                        this._objs[o.i] = new Draw_Magma(o.s.x, o.s.y, o.s.w, o.s.h);
                                    }
                                    this._ids_to_apply_tex.push(o.i);
                                } else {
                                }
                                
                                // Update all objects.
                                if (o.t === "w" || o.t === "g" || o.t === "m") {
                                    this._objs[o.i].Update(o.s.x, o.s.y);
                                } else if (o.t === "b" || o.t === "u") {
                                    this._objs[o.i].Update(o.s.x, o.s.y, o.s.vx, o.s.vy, o.s.va, o.s.a);
                                }
                            } else if (o.a === "r") {
                                if (o.i in this._objs) {
                                    this._objs[o.i].Destroy();
                                    delete this._objs[o.i];
                                } else {
                                    console.log("TODO: this should never appear???");
                                    lost += "" + o.i + ",";
                                }
                            }
                        }
                    } else if (rxp.spec.a === "cw") {
                        this._ClearWorld();
                    } else if (rxp.spec.a === "str") {
                        // engine_local.timing.timeScale = 1;
                    } else if (rxp.spec.a === "yd") {
                        console.log("DIED");
                        this._died_text = new PIXI.Text("WASTED",
                            {fontFamily:"monospace", fontSize:80, fill:0xff3333, align:"center", fontWeight:"bold"});
                        this._died_text.position.set(WIDTH/2, HEIGHT/2);
                        this._died_text.anchor.set(0.5);
                        ui.addChild(this._died_text);

                        // TODO: probably not the best way to remove.
                        this._objs[rxp.spec.i].Destroy();
                    }
                } else {
                    console.log("Client couldn't handle " + rxp.type);
                }
            }
        }
    }

    Start() {
        /* DEBUG - starting from scratch
        network.ClientSend(JSON.stringify({
            type: "admin",
            reqID: GenRequestID(6),
            spec: {
                action: "destroy",
            },
        }));
        network.ClientSend(JSON.stringify({
            type: "admin",
            reqID: GenRequestID(6),
            spec: {
                action: "create",
            },
        }));
        network.ClientSend(JSON.stringify({
            type: "connect",
            reqID: GenRequestID(6),
            spec: {},
        }));
        network.ClientSend(JSON.stringify({
            type: "admin",
            reqID: GenRequestID(6),
            spec: {
                action: "start",
            },
        }));
        */
    }

    Stop() {
        /*
        network.ClientSend(JSON.stringify({
            type: "admin",
            reqID: GenRequestID(6),
            spec: {
                action: "stop",
            },
        }));
        network.ClientSend(JSON.stringify({
            type: "admin",
            reqID: GenRequestID(6),
            spec: {
                action: "destroy",
            },
        }));
        */
    }

    Destroy() {
        this.Stop();
    }

    Tick(dT) {
        this._HandleNetwork();

        if (this._loaded) {
            while (this._ids_to_apply_tex.length > 0) {
                this._objs[this._ids_to_apply_tex[0]].ApplyTexture();
                this._ids_to_apply_tex.splice(0, 1);
            }
        }

        for (let k in this._objs) {
            this._objs[k].Tick(dT);
        }

        this._ui.Tick(dT);

        this._ping_timer += dT;
        if (this._ping_timer >= PING_RATE) {
            this._ping_timer = 0;
            // Whie loading, make a ping request.
            network.ClientSend(JSON.stringify({
                type: "ping",
                reqID: GenRequestID(6),
                spec: {
                    tsent: Sigs(window.performance.now()),
                    cID: this._clientID,
                },
            }));
        }
    }

    Loaded() {
        return this._ping !== -1 && this._connected && this._loaded;
    }

    MouseMove(x, y) {}
    MouseDown(x, y, b) {
        // TODO: move to engine.js
        //const pt = viewport.toWorld(x, y);
        //this.Bomb(pt.x, pt.y);
    }
    Key(k, d) {
        if (!this._connected) { return; }

        if (k === "Escape" && d) {
            this._ui.Toggle();
            return;
        }

        if (this._ui.paused) {
            return;
        }

        network.ClientSend(JSON.stringify({
            type: "input",
            reqID: GenRequestID(6),
            spec: {
                cID: this._clientID,
                type: "key",
                key: k,
                down: d,
            }
        }));
    }

    Draw() {
        for (let k in this._objs) {
            this._objs[k].Draw();
        }

        this._ui.Draw();
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

    ApplyTexture() {}

    Tick(dT) {}

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

    ApplyTexture() {}

    Tick(dT) {}

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
    constructor(x, y, r, c) {
        this.x = x;
        this.y = y;
        this.radius = r;
        this.color = PIXI.utils.string2hex(c);
        
        this._body = Bodies.circle(this.x, this.y, this.radius, 12);
        this._body.restitution = 0.5;
        this._body.slop = 0.02;
        World.add(engine_local.world, [this._body]);

        this._texture = null;
        this._texture_num = Math.floor(Math.random() * 3);
        this._tint = null;
        this._sprite = null;
    }
    
    ApplyTexture() {
        this._texture = new PIXI.Texture(textures_cache.ball_sprites, 
            new PIXI.Rectangle(128*this._texture_num, 0, 128, 128));
        this._sprite = new PIXI.Sprite(this._texture);
        this._sprite.width = this.radius*2;
        this._sprite.height = this.radius*2;
        this._sprite.position.set(this.x, this.y);
        this._sprite.anchor.set(0.5);
        this._sprite.tint = this.color;
        stage.addChild(this._sprite);
    }

    Destroy() {
        World.remove(engine_local.world, [this._body]);

        if (this._sprite !== null) {
            stage.removeChild(this._sprite);
        }
    }

    Update(x, y, vx, vy, va, a) {
        this.x = x;
        this.y = y;
        Body.setPosition(this._body, {x:x, y:y});
        Body.setVelocity(this._body, {x:vx, y:vy});
        Body.setAngularVelocity(this._body, va);
        Body.setAngle(this._body, a);

        if (this._sprite !== null) {
            this._sprite.angle = a * RAD_TO_DEG;
        }
    }

    Tick(dT) {
        this.x = this._body.position.x;
        this.y = this._body.position.y;

        if (this._sprite !== null) {
            this._sprite.position.set(this.x, this.y);
            this._sprite.angle = this._body.angle * RAD_TO_DEG;
        }
    }

    Draw() {
        return;
        stage_graphics.lineStyle(1, 0xffff00, 1);
        stage_graphics.beginFill(this.color);
        stage_graphics.drawCircle(this.x, this.y, this.radius);
        stage_graphics.endFill();
    }
}

class Draw_Bomb {
    constructor(x, y, r, c) {
        this.x = x;
        this.y = y;
        this.radius = r;
        this.color = c;

        this.active = true;

        this._body = Bodies.circle(this.x, this.y, this.radius, 6);
        this._body.restitution = 0.1;
        World.add(engine_local.world, [this._body]);
    }

    ApplyTexture() {}

    Destroy() {
        World.remove(engine_local.world, [this._body]);
    }
    
    Update(x, y, vx, vy, va, a) {
        this.x = x;
        this.y = y;
        Body.setPosition(this._body, {x:x, y:y});
        Body.setVelocity(this._body, {x:vx, y:vy});
        Body.setAngularVelocity(this._body, va);
        Body.setAngle(this._body, a);
    }

    Tick(dT) {
        this.x = this._body.position.x;
        this.y = this._body.position.y;
    }

    Draw() {
        if (this.active === false) { return; }

        stage_graphics.lineStyle(1, MAP_COLORS[play_opts.map].magma, 1);
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
    
    ApplyTexture() {}

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
    
    ApplyTexture() {}

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
    ApplyTexture() {}
    Tick(dt) {}
    Destroy() {}
    Draw() {}
}

class Network {
    constructor(addr) {
        this._addr = addr;

        this._rxQ = [];

        this._open = false;

        this._ws = new WebSocket(this._addr);
        let self = this;
        this._ws.onopen = function (evt) {
            self._WSOpen(evt);
        }
        this._ws.onmessage = function (evt) {
            self._WSRecv(evt);
        }

        this._measure_rx = 0;
        this._measure_tx = 0;
        this._measure_timer = window.performance.now();
        this._measure_ticks = 0;
    }

    Destroy() {
        this._ws.close();
    }

    _WSOpen(evt) {
        console.log("WS opened");
        this._open = true;
    }

    _WSRecv(evt) {
        this._rxQ.push(evt.data);

        this._measure_rx += evt.data.length;
        this._measure_ticks++;
        
        if (this._measure_ticks > 100) {
            const now = window.performance.now();
            const elapsed = now - this._measure_timer;
            this._measure_timer = now;

            const rx_kbps = Sigs(this._measure_rx / elapsed * 8);
            const tx_kbps = Sigs(this._measure_tx / elapsed * 8);

            console.log("" + rx_kbps + " kbps down, " + tx_kbps + " kbps up");

            this._measure_ticks = 0;
            this._measure_rx = 0;
            this._measure_tx = 0;
        }
    }

    HasData() {
        return this._rxQ.length > 0;
    }

    ClientRecv() {
        if (this._rxQ.length > 0) {
            const r = this._rxQ[0];
            this._rxQ.splice(0, 1);
            return LZUTF8.decompress(r, {inputEncoding:"Base64"});
        }
        return "";
    }

    ClientSend(msg) {
        if (!this._open) { return; }

        const msgc = LZUTF8.compress(msg, {outputEncoding:"Base64"});
        this._ws.send(msgc);
        this._measure_tx += msgc.length;
    }
}
