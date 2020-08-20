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
        this._loadpc += 0.005;

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

        ui_graphics.beginFill(color_scheme.title, this._fade_pc);
        ui_graphics.drawCircle(WIDTH/2, HEIGHT/2, 50);
        ui_graphics.endFill();

        ui_graphics.lineStyle(20, color_scheme.text, this._fade_pc);
        const v0 = Math.max(this._arcval, this._arcval2);
        const v1 = Math.min(this._arcval, this._arcval2);
        ui_graphics.arc(WIDTH/2, HEIGHT/2, 50, v0, v1, true);
    }
}

class LocalPlay {
    constructor() {
    }

    Destroy() {}

    MouseMove(x, y) {}
    MouseDown(x, y, b) {}
    Key(k, d) {}

    Tick(dT) {

    }

    Draw() {

    }
}
