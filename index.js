// Sky Hoffert
// Main menu for 8Bomb game.

///////////////////////////////////////////////////////////////////////////////////////////////////
// Setup //////////////////////////////////////////////////////////////////////////////////////////

// Disable right click menu. Avoid this line.
// document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

const COLORS = {
    GRAND_CANYON: {
        "name": "Grand Canyon",
        "bg": 0x3d232b,
        "fill": 0x663e3b,
        "title": 0xd28b3d,
        "text": 0xdac376,
        "misc": 0xb1b637,
    },
    KODIAK: {
        "name": "Kodiak",
        "bg": 0x59B8BF,
        "fill": 0xE3E0E2,
        "title": 0xF4E7DD,
        "text": 0xF2B0A2,
        "misc": 0xF6A889,
    },
    PORTLAND: {
        "name": "Portland",
        "bg": 0x301D31,
        "fill": 0xAC373E,
        "title": 0xF37D61,
        "text": 0xEE9651,
        "misc": 0xA7C3B2,
    },
}
let color_scheme = COLORS.GRAND_CANYON;

const app = new PIXI.Application({
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: color_scheme.bg,
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
    const lines = a.split(";");

    for (let i = 0; i < lines.length; i++) {
        const tok = lines[i].trim().split(" ");

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
        } else if (tok[0] === "submenu") {
            if (tok[1] === "open") {
                console.log("opening submenu " + tok[2]);
                ui_menu.OpenSubmenu(parseInt(tok[2]));
            } else if (tok[1] === "close") {
                console.log("closing submenu " + tok[2]);
                ui_menu.CloseSubmenu(parseInt(tok[2]));
            }
        } else if (tok[0] === "color-scheme") {
            UpdateColorScheme(tok[1]);
        } else if (tok[0] === "radio") {
            ui_menu.ActivateRadioButton(parseInt(tok[1]), parseInt(tok[2]));
        }
    }
}

function UpdateColorScheme(c) {
    color_scheme = COLORS[c];
    app.renderer.backgroundColor = color_scheme.bg;
    ui_menu.UpdateColorScheme();
}

function DarkenColor(c) {
    return (c & 0xfefefe) >> 1;
}

// Functions //////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Classes ////////////////////////////////////////////////////////////////////////////////////////

class UI_Button {
    constructor(x, y, w, h, r, t, fs, a, act=true, dd=false) {
        this._x = x;
        this._y = y;
        this._width = w;
        this._height = h;
        this._corner_radius = r;
        this._text_str = t;
        this._font_size = fs;

        this._text = new PIXI.Text(this._text_str,
            {fontFamily:"monospace", fontSize:this._font_size, fill:color_scheme.text, align:"center"});
        this._text.position.set(this._x, this._y);
        this._text.anchor.set(0.5);
        ui.addChild(this._text);

        this._selected = false; // Selected highlights
        this._enabled = false; // Enabled is for "radio buttons"

        this._action = a;

        this._bbox = new PIXI.Rectangle(this._x - this._width/2, this._y - this._height/2,
            this._width, this._height);

        this._select_alpha = 0;

        this._active = act;
        if (!this._active) {
            this._text.visible = false;
        }

        this._has_dropdown = dd;

        if (this._has_dropdown) {
            this._dd_pts = [
                this._x + this._width/2 - 30, this._y - 10,
                this._x + this._width/2 - 10, this._y - 10,
                this._x + this._width/2 - 20, this._y + 10,
            ];
            this._dd_poly = new PIXI.Polygon(this._dd_pts);
        }
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
        if (!this._active) { return false; }

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
    Activate() {
        this._text.visible = true;
        this._active = true;
    }
    Deactivate() {
        this._text.visible = false;
        this._active = false;
    }

    UpdateColorScheme() {
        this._text.style.fill = color_scheme.text;
    }

    SetText(t) {
        this._text.text = t;
        this._text.updateText();
    }

    Draw() {
        if (!this._active) { return; }

        ui_graphics.lineStyle(0);
        ui_graphics.beginFill(color_scheme.fill/2);
        ui_graphics.drawRoundedRect(this._x - this._width/2 + 10, this._y - this._height/2 + 10,
            this._width, this._height, this._corner_radius);
        ui_graphics.endFill();

        if (this._enabled) {
            if (this._selected) {
                ui_graphics.lineStyle(6, color_scheme.title, this._select_alpha);
            } else {
                ui_graphics.lineStyle(4, color_scheme.text, 1);
            }
        } else {
            ui_graphics.lineStyle(6, color_scheme.title, this._select_alpha);
        }

        ui_graphics.beginFill(color_scheme.fill);
        ui_graphics.drawRoundedRect(this._x - this._width/2, this._y - this._height/2, 
            this._width, this._height, this._corner_radius);
        ui_graphics.endFill();

        if (this._has_dropdown) {
            ui_graphics.lineStyle(0);
            ui_graphics.beginFill(color_scheme.text);
            ui_graphics.drawPolygon(this._dd_poly);
            ui_graphics.endFill();
        }
    }
}

class UI_Menu {
    constructor() {
        this._buttons = [];
        this._selected_button = 0;
        this._title_str = "NONE";
        this._KEY_TO_DIR = {"w":"N", "a":"W", "s":"S", "d":"E",
            "ArrowUp":"N", "ArrowLeft":"W", "ArrowDown":"S", "ArrowRight":"E"};
        this._button_transitions = {};
        this._submenus = [];
        this._texts = [];
        this._open_submenu = -1;
        this._radio_buttons = [];
        
        // TODO: mouse movement when submenu is open should not go beyond submenu.
        // TODO: make radio buttons more natural.
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

    Key(k, d) {
        if (!d) { return; }
        if (k in this._KEY_TO_DIR) {
            const dir = this._KEY_TO_DIR[k];
            if (dir in this._button_transitions[this._selected_button]) {
                this._Select(this._button_transitions[this._selected_button][dir]);
            }
        } else if (k === "Enter") {
            this._buttons[this._selected_button].Action();
        }
    }

    MouseMove(x, y) {
        if (this._open_submenu !== -1) {
            for (let i = 0; i < this._submenus[this._open_submenu].length; i++) {
                if (this._buttons[this._submenus[this._open_submenu][i]].Contains(x, y)) {
                    this._Select(this._submenus[this._open_submenu][i]);
                    return;
                }
            }
            return;
        }

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
        } else {
            if (this._open_submenu !== -1) {
                this.CloseSubmenu(this._open_submenu);
            }
        }
    }

    OpenSubmenu(idx) {
        for (let i = 0; i < this._submenus[idx].length; i++) {
            this._buttons[this._submenus[idx][i]].Activate();
        }
        this._Select(this._submenus[idx][0]);
        this._open_submenu = idx;
    }

    CloseSubmenu(idx) {
        for (let i = 0; i < this._submenus[idx].length; i++) {
            this._buttons[this._submenus[idx][i]].Deactivate();
        }
        this._Select(this._submenus[idx][0] - 1);
        this._open_submenu = -1;
    }

    UpdateColorScheme() {
        for (let i = 0; i < this._buttons.length; i++) {
            this._buttons[i].UpdateColorScheme();
        }
        for (let i = 0; i < this._texts.length; i++) {
            this._texts[i].style.fill = color_scheme.title;
            this._texts[i].style.dropShadowColor = DarkenColor(color_scheme.title);
        }
    }

    ActivateRadioButton(ri, bi) {
        const rbi = this._radio_buttons[ri];
        for (let i = 0; i < rbi.length; i++) {
            if (i === bi) {
                this._buttons[rbi[i]].Enable();
            } else {
                this._buttons[rbi[i]].Disable();
            }
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
            {fontFamily:"monospace", fontSize:100, fill:color_scheme.title, align:"center", fontWeight:"bold",
            dropShadow:true, dropShadowAngle:Math.PI/4, dropShadowBlur:3, dropShadowColor:(color_scheme.title & 0xfefefe) >> 1});
            // TODO: fix drop shadow color
        this._title_text.position.set(WIDTH/2, 120);
        this._title_text.anchor.set(0.5);
        ui.addChild(this._title_text);
        this._texts.push(this._title_str);

        this._selected_button = 0;
        this._buttons[this._selected_button].Select();
        this._round_selection = false;

        this._button_transitions = {
            0: {E:2, S:1},
            1: {E:3, N:0},
            2: {W:0, S:3},
            3: {W:1, N:2},
        };
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

        // button 0.
        this._buttons.push(new UI_Button(
            this._horizontal_offset, this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Back", this._btn_fs,
            "open main-menu"));
        
        // Sound FX
        // Buttons idx 1 and 2 are for sfx.
        this._sound_text = new PIXI.Text("Sound FX:",
            {fontFamily:"monospace", fontSize:40, fill:color_scheme.title, align:"right"});
        this._sound_text.position.set(350, 300);
        this._sound_text.anchor.set(1, 0.5);
        ui.addChild(this._sound_text);
        this._texts.push(this._sound_text);

        // button 1 and 2 (radio 0).
        this._radio_buttons.push([1, 2]);
        this._buttons.push(new UI_Button(
            450, 300, 150, 60, this._btn_rad, "On", this._btn_fs,
            "soundfx on; radio 0 0"));
        this._buttons[1].Enable();
        this._buttons.push(new UI_Button(
            650, 300, 150, 60, this._btn_rad, "Off", this._btn_fs,
            "soundfx off; radio 0 1"));
        
        // Music
        // Buttons idx 3 and 4 are for music.
        this._music_text = new PIXI.Text("Music:",
            {fontFamily:"monospace", fontSize:40, fill:color_scheme.title, align:"right"});
        this._music_text.position.set(350, 400);
        this._music_text.anchor.set(1, 0.5);
        ui.addChild(this._music_text);
        this._texts.push(this._music_text);

        // button 3 and 4 (radio 1).
        this._radio_buttons.push([3, 4]);
        this._buttons.push(new UI_Button(
            450, 400, 150, 60, this._btn_rad, "On", this._btn_fs,
            "music on; radio 1 0"));
        this._buttons[3].Enable();
        this._buttons.push(new UI_Button(
            650, 400, 150, 60, this._btn_rad, "Off", this._btn_fs,
            "music off; radio 1 1"));

        // Color Scheme
        this._colors_text = new PIXI.Text("Color Scheme:",
            {fontFamily:"monospace", fontSize:40, fill:color_scheme.title, align:"right"});
        this._colors_text.position.set(350, 500);
        this._colors_text.anchor.set(1, 0.5);
        ui.addChild(this._colors_text);
        this._texts.push(this._colors_text);

        // button 5.
        this._buttons.push(new UI_Button(
            550, 500, 350, 60, this._btn_rad, ""+color_scheme.name, this._btn_fs, "submenu open 0", true, true));
            
        // button 6, 7, and 8 (dropdown 0).
        this._buttons.push(new UI_Button(
            550, 540, 350, 60, this._btn_rad, "Grand Canyon", this._btn_fs, 
            "color-scheme GRAND_CANYON; submenu close 0", false));
        this._buttons.push(new UI_Button(
            550, 580, 350, 60, this._btn_rad, "Kodiak", this._btn_fs,
            "color-scheme KODIAK; submenu close 0", false));
        this._buttons.push(new UI_Button(
            550, 620, 350, 60, this._btn_rad, "Portland", this._btn_fs,
            "color-scheme PORTLAND; submenu close 0", false));
        
        this._title_str = "Settings";
        this._title_text = new PIXI.Text(this._title_str,
            {fontFamily:"monospace", fontSize:100, fill:color_scheme.title, align:"center", fontWeight:"bold",
            dropShadow:true, dropShadowAngle:Math.PI/4, dropShadowBlur:3, dropShadowColor:(color_scheme.title & 0xfefefe) >> 1});
        this._title_text.position.set(WIDTH/2, 120);
        this._title_text.anchor.set(0.5);
        ui.addChild(this._title_text);
        this._texts.push(this._title_text);

        this._selected_button = 0;
        this._buttons[this._selected_button].Select();

        this._button_transitions = {
            0: {S:1},
            1: {N:0, E:2, S:3},
            2: {N:0, W:1, S:4},
            3: {N:1, E:4, S:5},
            4: {N:2, W:3, S:5},
            5: {N:3}, // Dropdown 0
            6: {S:7},
            7: {N:6, S:8},
            8: {N:7},
        };

        this._submenus.push([6, 7, 8]);
    }

    CloseSubmenu(idx) {
        super.CloseSubmenu(idx);
        if (idx === 0) {
            this._buttons[5].SetText(""+color_scheme.name);
        }
    }

    Destroy() {
        super.Destroy();
        ui.removeChild(this._sound_text);
        ui.removeChild(this._music_text);
        ui.removeChild(this._colors_text);
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
            {fontFamily:"monospace", fontSize:100, fill:color_scheme.title, align:"center", fontWeight:"bold",
            dropShadow:true, dropShadowAngle:Math.PI/4, dropShadowBlur:3, dropShadowColor:(color_scheme.title & 0xfefefe) >> 1});
        this._title_text.position.set(WIDTH/2, 120);
        this._title_text.anchor.set(0.5);
        ui.addChild(this._title_text);
        
        this._about_str = "No circles were harmed in the making of this game.\n\n\
This game was designed and written by Sky Hoffert. It is written in javascript using \
WebSockets, pixi.js, pixi-viewport.js, matter.js, fmath.js, and stats.js.\n\n\
Independent game development is a labor of love. Consider donating to support development \
of new, exciting games :)";
        this._about_text = new PIXI.Text(this._about_str,
            {fontFamily:"monospace", fontSize:30, fill:color_scheme.text, align:"left",
            wordWrap:true, wordWrapWidth:WIDTH*0.8, lineHeight:35});
        this._about_text.position.set(WIDTH/2, 300);
        this._about_text.anchor.set(0.5, 0);
        ui.addChild(this._about_text);

        this._selected_button = 0;
        this._buttons[this._selected_button].Select();

        this._button_transitions = {
            0: {E:1},
            1: {W:0}
        }
    }

    Destroy() {
        super.Destroy();
        ui.removeChild(this._about_text);
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