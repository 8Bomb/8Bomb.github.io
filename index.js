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
    for (let i = 0; i < stage_actions.length; i++) {
        CommenceStageAction(stage_actions[i]);
        stage_actions.splice(i, 1);
        i--;
    }

    // Ticking
    ui_menu.Tick(dT);

    // Drawing
    ui_graphics.clear();
    ui_menu.Draw();
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

let stage_actions = [];

let playing_soundfx = true;
let playing_music = true;

/* Matter.js stuff. TODO
let Engine = Matter.Engine;
let World = Matter.World;
let Bodies = Matter.Bodies;
let engine = Engine.create();

engine.world.gravity.y = 0.2;

Engine.run(engine);
*/

// Setup //////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Functions //////////////////////////////////////////////////////////////////////////////////////

function CommenceStageAction(a) {
    const tok = a.split(" ");
    if (tok[0] === "open") {
        ui_menu.Destroy();

        if (tok[1] === "main-menu") {
            ui_menu = new UI_MainMenu();
        } else if (tok[1] === "settings") {
            ui_menu = new UI_Settings();
        } else if (tok[1] === "about") {
            ui_menu = new UI_About();
        }
    } else if (tok[0] === "soundfx") {
        console.log("TODO: turn sfx " + tok[1]);
        playing_soundfx = tok[1] === "on";
    } else if (tok[0] === "music") {
        console.log("TODO: turn music " + tok[1]);
        playing_music = tok[1] === "on";
    } else if (tok[0] === "donate") {
        console.log("TODO: open donate page.");
    }
}

// Functions //////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Classes ////////////////////////////////////////////////////////////////////////////////////////

class UI_Button {
    constructor(x, y, w, h, r, t, fs, a) {
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

        this._selected = false; // Selected highlights
        this._enabled = false; // Enabled is for "radio buttons"

        this._action = a;

        this._bbox = new PIXI.Rectangle(this._x - this._width/2, this._y - this._height/2,
            this._width, this._height);

        this._select_alpha = 0;
    }

    Tick(dT) {
        if (this._selected && this._select_alpha < 1) {
            if (this._select_alpha < 0.01) {
                this._select_alpha = 0.01;
            }
            this._select_alpha *= 1.3;
            if (this._select_alpha > 1) {
                this._select_alpha = 1;
            }
        } else if (!this._selected && this._select_alpha > 0) {
            this._select_alpha *= 0.8;
            if (this._select_alpha < 0.01) {
                this._select_alpha = 0;
            }
        }
    }

    Contains(x, y) {
        return this._bbox.contains(x, y);
    }
    
    Destroy() {
        ui.removeChild(this._text);
    }

    Action() {
        stage_actions.push(this._action);
    }

    Select() { this._selected = true; }
    Deselect() { this._selected = false; }
    IsSelected() { return this._selected; }
    Enable() { this._enabled = true; }
    Disable() { this._enabled = false; }
    IsEnabled() { return this._enabled; }

    Draw() {
        if (this._enabled) {
            if (this._selected) {
                ui_graphics.lineStyle(6, 0xefe29e, this._select_alpha);
            } else {
                ui_graphics.lineStyle(4, 0xb7bb8e, 1);
            }
        } else {
            ui_graphics.lineStyle(6, 0xefe29e, this._select_alpha);
        }

        ui_graphics.beginFill(0x663e3b);
        ui_graphics.drawRoundedRect(this._x - this._width/2, this._y - this._height/2, 
            this._width, this._height, this._corner_radius);
        ui_graphics.endFill();
    }
}

class UI_Menu {
    constructor() {
        this._buttons = [];
        this._selected_button = 0;
        this._title_str = "NONE";
        this._KEY_TO_DIR = {"w":"N", "a":"W", "s":"S", "d":"E",
            "ArrowUp":"N", "ArrowLeft":"W", "ArrowDown":"S", "ArrowRight":"E"};
    }
    
    _Select(i) {
        this._buttons[this._selected_button].Deselect();
        this._selected_button = i;
        this._buttons[this._selected_button].Select();
    }
    
    Tick(dT) {
        for (let i = 0; i < this._buttons.length; i++) {
            this._buttons[i].Tick(dT);
        }
    }

    Key(k, d) {}

    MouseMove(x, y) {
        for (let i = 0; i < this._buttons.length; i++) {
            if (this._buttons[i].Contains(x, y)) {
                this._Select(i);
                return;
            }
        }
    }

    MouseDown(x, y, b) {
        if (this._buttons[this._selected_button].Contains(x, y)) {
            this._buttons[this._selected_button].Action();
        }
    }

    Destroy() {
        for (let i = 0; i < this._buttons.length; i++) {
            this._buttons[i].Destroy();
        }
        ui.removeChild(this._title_text);
    }

    Draw() {
        for (let i = 0; i < this._buttons.length; i++) {
            this._buttons[i].Draw();
        }
    }
}

class UI_MainMenu extends UI_Menu {
    constructor() {
        super();

        this._btn_width = 400;
        this._btn_height = 140;
        this._btn_rad = 20;
        this._btn_fs = 30;
        this._padding = 20;
        this._horizontal_offset = this._btn_width/2 + this._padding;
        this._vertical_offset = this._btn_height/2 + this._padding;

        this._buttons.push(new UI_Button(
            WIDTH/2 - this._horizontal_offset, HEIGHT/2 - this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Local Play", this._btn_fs,
            "open local-play"));
        this._buttons.push(new UI_Button(
            WIDTH/2 - this._horizontal_offset, HEIGHT/2 + this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Online Play", this._btn_fs,
            "open online-play"));
        this._buttons.push(new UI_Button(
            WIDTH/2 + this._horizontal_offset, HEIGHT/2 - this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Settings", this._btn_fs,
            "open settings"));
        this._buttons.push(new UI_Button(
            WIDTH/2 + this._horizontal_offset, HEIGHT/2 + this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "About", this._btn_fs,
            "open about"));

        this._title_str = "8Bomb";
        this._title_text = new PIXI.Text(this._title_str,
            {fontFamily:"monospace", fontSize:100, fill:0xefe29e, align:"center", fontWeight:"bold"});
        this._title_text.position.set(WIDTH/2, 120);
        this._title_text.anchor.set(0.5);
        ui.addChild(this._title_text);

        this._selected_button = 0;
        this._buttons[this._selected_button].Select();
        this._round_selection = false;
    }

    Key(k, d) {
        if (k in this._KEY_TO_DIR) {
            const dir = this._KEY_TO_DIR[k];
            if (d) {
                this._MoveSelection(dir);
            }
        } else if (k === "Enter") {
            this._buttons[this._selected_button].Action();
        }
    }

    _MoveSelect(n) {
        this._buttons[this._selected_button].Deselect();
        this._selected_button += n;
        this._buttons[this._selected_button].Select();
    }

    _MoveSelection(dir) {
        const cs = this._selected_button;
        let n = 0;
        if (dir === "N") {
            n = cs === 0 || cs === 2 ? 0 : -1;
        } else if (dir === "S") {
            n = cs === 1 || cs === 3 ? 0 : 1;
        } else if (dir === "E") {
            n = cs === 2 || cs === 3 ? 0 : 2;
        } else if (dir === "W") {
            n = cs === 0 || cs === 1 ? 0 : -2;
        }

        this._MoveSelect(n);
    }
}

class UI_Settings extends UI_Menu {
    constructor() {
        super();
        
        this._buttons = [];

        this._btn_width = 300;
        this._btn_height = 120;
        this._btn_rad = 20;
        this._btn_fs = 30;
        this._padding = 40;
        this._horizontal_offset = this._btn_width/2 + this._padding;
        this._vertical_offset = 120;

        this._buttons.push(new UI_Button(
            this._horizontal_offset, this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Back", this._btn_fs,
            "open main-menu"));
        
        // Sound FX
        // Buttons idx 1 and 2 are for sfx.
        this._sound_text = new PIXI.Text("Sound FX:",
            {fontFamily:"monospace", fontSize:40, fill:0xefe29e, align:"right"});
        this._sound_text.position.set(280, 300);
        this._sound_text.anchor.set(1, 0.5);
        ui.addChild(this._sound_text);

        this._buttons.push(new UI_Button(
            450, 300, 150, 60, this._btn_rad, "On", this._btn_fs,
            "soundfx on"));
        this._buttons[1].Enable();
        this._buttons.push(new UI_Button(
            650, 300, 150, 60, this._btn_rad, "Off", this._btn_fs,
            "soundfx off"));
        
        // Music
        // Buttons idx 3 and 4 are for music.
        this._music_text = new PIXI.Text("Music:",
            {fontFamily:"monospace", fontSize:40, fill:0xefe29e, align:"right"});
        this._music_text.position.set(280, 400);
        this._music_text.anchor.set(1, 0.5);
        ui.addChild(this._music_text);

        this._buttons.push(new UI_Button(
            450, 400, 150, 60, this._btn_rad, "On", this._btn_fs,
            "music on"));
        this._buttons[3].Enable();
        this._buttons.push(new UI_Button(
            650, 400, 150, 60, this._btn_rad, "Off", this._btn_fs,
            "music off"));

        // TODO: figure out how dropdown menus will work
        //   Add color scheme option.
        //   Implement different color schemes for 8Bomb.
        
        this._title_str = "Settings";
        this._title_text = new PIXI.Text(this._title_str,
            {fontFamily:"monospace", fontSize:100, fill:0xefe29e, align:"center", fontWeight:"bold"});
        this._title_text.position.set(WIDTH/2, 120);
        this._title_text.anchor.set(0.5);
        ui.addChild(this._title_text);

        this._selected_button = 0;
        this._buttons[this._selected_button].Select();
    }

    Destroy() {
        super.Destroy();
        ui.removeChild(this._sound_text);
        ui.removeChild(this._music_text);
    }

    Key(k, d) {
        if (k in this._KEY_TO_DIR) {
            // TODO: Add key control for navigating buttons.
            // TODO: Pressing enter changes menu TWICE.
            return;
            const dir = this._KEY_TO_DIR[k];
            if (d) {
                this._MoveSelection(dir);
            }
        } else if (k === "Enter") {
            this._buttons[this._selected_button].Action();
        }
    }
    
    MouseDown(x, y, b) {
        super.MouseDown(x,y,b);

        // Sound FX
        if (this._selected_button === 1 && this._buttons[1].Contains(x, y)) {
            this._buttons[1].Enable();
            this._buttons[2].Disable();
        } else if (this._selected_button === 2 && this._buttons[2].Contains(x, y)) {
            this._buttons[1].Disable();
            this._buttons[2].Enable();
        }

        // Music
        if (this._selected_button === 3 && this._buttons[3].Contains(x, y)) {
            this._buttons[3].Enable();
            this._buttons[4].Disable();
        } else if (this._selected_button === 4 && this._buttons[4].Contains(x, y)) {
            this._buttons[3].Disable();
            this._buttons[4].Enable();
        }
    }
}

class UI_About extends UI_Menu {
    constructor() {
        super();
        
        this._buttons = [];

        this._btn_width = 300;
        this._btn_height = 120;
        this._btn_rad = 20;
        this._btn_fs = 30;
        this._padding = 40;
        this._horizontal_offset = this._btn_width/2 + this._padding;
        this._vertical_offset = 120;

        this._buttons.push(new UI_Button(
            this._horizontal_offset, this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Back", this._btn_fs,
            "open main-menu"));
        this._buttons.push(new UI_Button(
            WIDTH - this._horizontal_offset, this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Donate", this._btn_fs,
            "donate"));
            
        this._title_str = "About";
        this._title_text = new PIXI.Text(this._title_str,
            {fontFamily:"monospace", fontSize:100, fill:0xefe29e, align:"center", fontWeight:"bold"});
        this._title_text.position.set(WIDTH/2, 120);
        this._title_text.anchor.set(0.5);
        ui.addChild(this._title_text);
        
        this._about_str = "No circles were harmed in the making of this game.\n\n\
This game was designed and written by Sky Hoffert. It is written in javascript using \
WebSockets, pixi.js, pixi-viewport.js, matter.js, fmath.js, and stats.js.\n\n\
Independent game development is a labor of love. Consider donating to support development \
of new, exciting games :)";
        this._about_text = new PIXI.Text(this._about_str,
            {fontFamily:"monospace", fontSize:30, fill:0xefe29e, align:"left",
            wordWrap:true, wordWrapWidth:WIDTH*0.8, lineHeight:35});
        this._about_text.position.set(WIDTH/2, 300);
        this._about_text.anchor.set(0.5, 0);
        ui.addChild(this._about_text);

        this._selected_button = 0;
        this._buttons[this._selected_button].Select();
    }

    Destroy() {
        super.Destroy();
        ui.removeChild(this._about_text);
    }
    
    Key(k, d) {
        if (k in this._KEY_TO_DIR) {
            const dir = this._KEY_TO_DIR[k];
            if (d) {
                this._MoveSelection(dir);
            }
        } else if (k === "Enter") {
            this._buttons[this._selected_button].Action();
        }
    }

    _MoveSelection(dir) {
        if (dir === "E") {
            this._Select(1);
        } else if (dir === "W") {
            this._Select(0);
        }
    }
}

// Classes ////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Stage //////////////////////////////////////////////////////////////////////////////////////////

let ui_menu = new UI_MainMenu();

// Stage //////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Events /////////////////////////////////////////////////////////////////////////////////////////

document.addEventListener("keydown", function (evt) {
    ui_menu.Key(evt.key, true);
}, false);

document.addEventListener("keyup", function (evt) {
    ui_menu.Key(evt.key, false);
}, false);

document.addEventListener("mousemove", function (evt) {
    ui_menu.MouseMove(evt.x, evt.y);
}, false);

document.addEventListener("mousedown", function (evt) {
    ui_menu.MouseDown(evt.x, evt.y, evt.button);
}, false);

// Events /////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////