// Sky Hoffert
// Main menu for 8Bomb game.

///////////////////////////////////////////////////////////////////////////////////////////////////
// Setup //////////////////////////////////////////////////////////////////////////////////////////

// Disable right click menu. Avoid this line.
// document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

const app = new PIXI.Application({
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: 0x3d232b,
    resolution: window.devicePixelRatio || 1,
    antialias: true,
});

app.ticker.add(Tick);

document.body.appendChild(app.view);

function Tick(dT) {
    // Ticking

    // Drawing
    ui_graphics.clear();
    ui_main_menu.Draw();
}

const viewport = new Viewport.Viewport({
    screenWidth: WIDTH,
    screenHeight: HEIGHT,
    worldWidth: WIDTH,
    worldHeight: HEIGHT,
    interaction: app.renderer.plugins.interation,
});

app.stage.addChild(viewport);

viewport
    .drag({mouseButtons: "right"})
    .pinch()
    .decelerate()
    .wheel();

viewport.moveCenter(0,0);

// UI elements go in the UI - ui_graphics is a child.
const ui = new PIXI.Container();
app.stage.addChild(ui);

// Stage elements go in stage - stage_graphics is a child.
const stage = new PIXI.Container();
viewport.addChild(stage);

const stage_graphics = new PIXI.Graphics();
stage.addChild(stage_graphics);
const ui_graphics = new PIXI.Graphics();
ui.addChild(ui_graphics);

let Engine = Matter.Engine;
let World = Matter.World;
let Bodies = Matter.Bodies;
let engine = Engine.create();

// TODO: adjust gravity for proper feeling.
engine.world.gravity.y = 0.2;

Engine.run(engine);

// Setup //////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Classes ////////////////////////////////////////////////////////////////////////////////////////

class UI_Button {
    constructor(x, y, w, h, r, t, fs) {
        this._x = x;
        this._y = y;
        this._width = w;
        this._height = h;
        this._corner_radius = r;
        this._text_str = t;
        this._font_size = fs;

        this._text = new PIXI.Text(this._text_str,
            {fontFamily:"monospace", fontSize:this._font_size, fill:0xb7bb8e, align:"center"});
        this._text.position.set(this._x, this._y);
        this._text.anchor.set(0.5);
        ui.addChild(this._text);

        this._selected = false;
    }

    Select() {
        this._selected = true;
    }

    Deselect() {
        this._selected = false;
    }

    Draw() {
        if (this._selected) {
            ui_graphics.lineStyle(6, 0xefe29e, 1);
        } else {
            ui_graphics.lineStyle(0);
        }

        ui_graphics.beginFill(0x663e3b);
        ui_graphics.drawRoundedRect(this._x - this._width/2, this._y - this._height/2, 
            this._width, this._height, this._corner_radius);
        ui_graphics.endFill();
    }
}

class UI_MainMenu {
    constructor() {
        this._buttons = [];

        this._btn_width = 400;
        this._btn_height = 140;
        this._btn_rad = 20;
        this._btn_fs = 30;
        this._padding = 20;
        this._horizontal_offset = this._btn_width/2 + this._padding;
        this._vertical_offset = this._btn_height/2 + this._padding;

        this._buttons.push(new UI_Button(
            WIDTH/2 - this._horizontal_offset, HEIGHT/2 - this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Local Play", this._btn_fs));
        this._buttons.push(new UI_Button(
            WIDTH/2 - this._horizontal_offset, HEIGHT/2 + this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Online Play", this._btn_fs));
        this._buttons.push(new UI_Button(
            WIDTH/2 + this._horizontal_offset, HEIGHT/2 - this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Settings", this._btn_fs));
        this._buttons.push(new UI_Button(
            WIDTH/2 + this._horizontal_offset, HEIGHT/2 + this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "About", this._btn_fs));

        this._title_str = "8Bomb";

        this._title_text = new PIXI.Text(this._title_str,
            {fontFamily:"monospace", fontSize:100, fill:0xefe29e, align:"center", fontWeight:"bold"});
        this._title_text.position.set(WIDTH/2, 120);
        this._title_text.anchor.set(0.5);
        ui.addChild(this._title_text);

        this._selected_button = 0;
        this._buttons[this._selected_button].Select();
    }

    Draw() {
        for (let i = 0; i < this._buttons.length; i++) {
            this._buttons[i].Draw();
        }
    }
}

// Classes ////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Stage //////////////////////////////////////////////////////////////////////////////////////////

const ui_main_menu = new UI_MainMenu();

// Stage //////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////