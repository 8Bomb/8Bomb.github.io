// Sky Hoffert
// js for local play.

class Load_LocalPlay {
    constructor() {
        this._arcval = 0;
        this._arcval2 = 0;
        this._elapsed = 0;
        console.log("loading local play");
    }

    MouseMove(x, y) {}
    MouseDown(x, y, b) {}
    Key(k, d) {}

    Tick(dT) {
        this._elapsed += dT;
        this._arcval = Math.cos(this._elapsed / 100) * Math.PI*2;
        this._arcval2 = Math.sin(this._elapsed / 100) * Math.PI*2;
    }

    Draw() {
        ui_graphics.beginFill(0x000000);
        ui_graphics.drawRect(0, 0, WIDTH, HEIGHT);
        ui_graphics.endFill();

        ui_graphics.beginFill(color_scheme.title);
        ui_graphics.drawCircle(WIDTH/2, HEIGHT/2, 50);
        ui_graphics.endFill();

        ui_graphics.lineStyle(20, color_scheme.text);
        ui_graphics.arc(WIDTH/2, HEIGHT/2, 50, this._arcval, this._arcval2);
    }
}

class LocalPlay {
    constructor() {

    }

    MouseMove(x, y) {}
    MouseDown(x, y, b) {}
    Key(k, d) {}

    Tick(dT) {

    }

    Draw() {

    }
}
