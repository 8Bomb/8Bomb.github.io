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

        console.log("loading local play");
    }

    Destroy() {}

    MouseMove(x, y) {}
    MouseDown(x, y, b) {}
    Key(k, d) {}

    Tick(dT) {
        this._elapsed += dT;
        this._arcval = Math.cos(this._elapsed / 20) * Math.PI*2;
        this._arcval2 = Math.cos(this._elapsed / 25) * Math.PI*2;
        this._loadpc += 0.01;

        if (this._loadpc >= 1) {
            this._fading = true;
        }

        if (this._fading) {
            this._fade_pc -= 0.01;
            if (this._fade_pc <= 0) {
                stage_actions.push("play start");
            }
        }
    }

    Draw() {
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

        this._elems = [];
        this._ge_wid = 3;
        this._ground_wid = 200 / this._ge_wid;
        this._ground_height = 300;
        let num = 0;
        for (let i = 0; i < this._ground_wid; i++) {
            num++;
            this._elems.push(new GroundElement(this._ge_wid*i, this._ground_height, this._ge_wid, HEIGHT/2 - this._ground_height));
        }
        console.log("added " + num);

        //this._user_ball = new UserBall(0, -100);
    }

    Loaded(b) { this._loading = !b; }

    Collides(b) {
        for (let i = 0; i < this._elems.length; i++) {
            if (Matter.SAT.collides(b, this._elems[i]._body).collided) { return true; }
        }
    }

    Bomb(x, y, r=30) {
        /* for triangles
        for (let i = 0; i < this._elems.length; i++) {
            if (this._elems[i].DistTo(x, y) < r) {
                this._elems[i].Destroy();
                this._elems.splice(i, 1);
                i--;
            }
        }*/

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
                            this._elems.push(new GroundElement_Rect(this._elems[i].Left(), yb + 1, this._elems[i].Width(), this._elems[i].Bottom() - (yb + 1)));
                            gotone = true;
                        }

                        // Check if upper element should be added.
                        if (this._elems[i].Top() < yt && yt < this._elems[i].Bottom()) {
                            const ht = (yt - this._elems[i].Top()) - 1;
                            if (ht > 2) {
                                this._elems.push(new GroundElement_Rect(this._elems[i].Left(), this._elems[i].Top(), this._elems[i].Width(), ht));
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
    }

    Destroy() {}

    MouseMove(x, y) {}
    MouseDown(x, y, b) {}
    Key(k, d) {}

    Tick(dT) {
        if (this._loading) { return; }

        //this._user_ball.Tick(dT);
    }

    Draw() {
        if (this._loading) { return; }

        for (let i = 0; i < this._elems.length; i++) {
            this._elems[i].Draw();
        }

        //this._user_ball.Draw();
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

        this._body = Bodies.rectangle(this._x, this._y, this._width, this._height, {isStatic:true});
        this._poly = new PIXI.Rectangle(this._left, this._top, this._width, this._height);

        World.add(engine.world, [this._body]);
    }

    Left() { return this._left; }
    Right() { return this._right; }
    Top() { return this._top; }
    Bottom() { return this._bottom; }
    Width() { return this._width; }
    Height() { return this._height; }
    WithinXBounds(x) { return x > this._left && x < this._right; }

    Destroy() {
        World.remove(engine.world, [this._body]);
    }

    Contains(x, y) {
        return this._poly.contains(x, y);
    }

    Draw() {
        stage_graphics.lineStyle(0);
        stage_graphics.beginFill(0x0000ff);
        stage_graphics.drawRect(this._left, this._top, this._width, this._height);
        stage_graphics.endFill();
    }
}

class UserBall {
    constructor(x, y, g) {
        this._x = x;
        this._y = y;
        this._radius = 8;

        this._falling = true;
        
        this._body = Bodies.circle(this._x, this._y, this._radius, 12);
        this._body.restitution = 0.5;
        this._body.slop = 0.02;
        World.add(engine.world, [this._body]);

        this._jumpcd = 0;
    }

    Bomb(x, y, r) {
        const hyp = Math.hypot(this._x - x, this._y - y);
        const str = Math.min(r - hyp / 1000000, 0.0001);

        if (hyp < r) {
            Matter.Body.applyForce(this._body, {x:this._x, y:this._x}, 
                {x: (this._x - x)*str, y: (this._y - y)*str});
        }
    }

    Tick(dT) {
        const grounded = ui_menu.Collides(this._body);

        // The player moves faster when grounded.
        if (grounded) {
            if (keys.a) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y - this._radius/3}, {x:-0.0001,y:0});
            } else if (keys.d) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y - this._radius/3}, {x:0.0001,y:0});
            }

            if (this._jumpcd <= 0) {
                if (keys[" "]) {
                    Matter.Body.applyForce(this._body, this._body.position, {x:0, y:-0.001});
                    this._jumpcd = 20;
                }
            } else {
                this._jumpcd -= dT;
            }
        } else {
            if (keys.a) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y}, {x:-0.00005,y:0});
            } else if (keys.d) {
                Matter.Body.applyForce(this._body, {x:this._body.position.x, y:this._body.position.y}, {x:0.00005,y:0});
            }
        }

        if (Math.abs(this._body.angularVelocity) > 1) {
            Matter.Body.setAngularVelocity(this._body, Math.sign(this._body.angularVelocity));
        }

        this._x = this._body.position.x;
        this._y = this._body.position.y;
    }

    Draw() {
        stage_graphics.lineStyle(1, 0xffff00, 1);
        stage_graphics.beginFill(0xff0000);
        stage_graphics.drawCircle(this._x, this._y, this._radius);
        stage_graphics.endFill();
    }
}

/*
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

        this._lifetime = t;

        this._explosion_radius = this._radius * 5;

        this.active = true;
        
        this._body = Bodies.circle(this._x, this._y, this._radius, 6);
        this._body.restitution = 0.1;
        World.add(engine.world, [this._body]);
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

        stage_fx.push(new BombExplosion(this._x, this._y, this._explosion_radius, this._color));

        ground.Bomb(this._x, this._y, this._explosion_radius);

        player.Bomb(this._x, this._y, this._explosion_radius);

        this.active = false;
    }

    Draw() {
        if (this.active === false) { return; }

        stage_graphics.lineStyle(1, 0x42e3f5, 1);
        stage_graphics.beginFill(this._color);
        stage_graphics.drawCircle(this._x, this._y, this._radius);
        stage_graphics.endFill();
    }
}

class BombExplosion {
    constructor(x, y, r, c) {
        this._x = x;
        this._y = y;
        this._radius = r;
        this._alpha = 1;
        this._color = c;

        this._active = true;
    }

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

        this._bombs = [];

        this._spawn_chance_starting = 0.001;
        this._spawn_chance = this._spawn_chance_starting;

        this._bombs.push(new Bomb(this._x, this._y, 4, 200));
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
            this._bombs.push(new Bomb(this._left + this._width * Math.random(), this._y, 2+Math.random()*8, 180 + 50*Math.random()));
        } else {
            this._spawn_chance *= 1.01;
        }
    }

    Draw() {
        stage_graphics.lineStyle(1, 0x000000, 0.8);
        stage_graphics.beginFill(0x555555, 0.4);
        stage_graphics.drawRect(this._left, this._top, this._width, this._height);
        stage_graphics.endFill();

        for (let i = 0; i < this._bombs.length; i++) {
            this._bombs[i].Draw();
        }
    }
}
*/
