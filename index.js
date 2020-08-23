// Sky Hoffert
// Main menu for 8Bomb game.

///////////////////////////////////////////////////////////////////////////////////////////////////
// Setup //////////////////////////////////////////////////////////////////////////////////////////

// Disable right click menu. Avoid this line.
// document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

const fmath = new FMath();

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

const COLORS = {
    GRAND_CANYON: {
        "name": "Grand Canyon",
        "bg": 0x3D232B,
        "fill": 0x663E3B,
        "title": 0xD28B3D,
        "text": 0xDAC376,
        "misc": 0xB1B637,
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
};
const MAP_COLORS = {
    Kansas: {
        "name": "Kansas",
        "bg": 0x176B7D,
        "wall": 0x389276,
        "ground": 0x9D8E3A,
        "bomb": 0xCE8F36,
        "magma": 0xF05B52,
    }
}
const BOMB_COLORS = {
    Dynamite: {
        "main": 0xF05B52,
    }
}
let color_scheme = COLORS.GRAND_CANYON;

const app = new PIXI.Application({
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: color_scheme.bg,
    resolution: window.devicePixelRatio || 1,
    antialias: true,
});

document.body.appendChild(app.view);

let prev_tick = window.performance.now();
let updates_num = 0;
let updates_timer = 0;

function Tick() {
    let now = window.performance.now();
    let dT = Sigs(now - prev_tick);
    prev_tick = now;

    updates_num++;
    updates_timer += dT;
    if (updates_timer > 3000) {
        const fps = Sigs(updates_num / updates_timer) * 1000;
        console.log("fps: " + fps);
        updates_num = 0;
        updates_timer = 0;
    }

    for (let i = 0; i < stage_actions.length; i++) {
        CommenceStageAction(stage_actions[i]);
        stage_actions.splice(i, 1);
        i--;
    }

    engine_network.Tick(dT);

    // Ticking
    ui_menu.Tick(dT);

    // Drawing
    ui_graphics.clear();
    stage_graphics.clear();
    fore_graphics.clear();

    if (loading_stage) {
        loading_stage.Tick(dT);
        loading_stage.Draw();
    }
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
//    .drag({mouseButtons: "right"})
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
viewport.moveCenter(0, 0);

const stage_graphics = new PIXI.Graphics();
stage.addChild(stage_graphics);
const fore_graphics = new PIXI.Graphics();
stage.addChild(fore_graphics);
const ui_graphics = new PIXI.Graphics();
ui.addChild(ui_graphics);

let keys = {w:false,a:false,s:false,d:false};

let stage_actions = [];

let playing_soundfx = true;
let playing_music = true;

let play_opts = {
    map: "Kansas",
    bomb_shape: "Dynamite",
    gravity: 1,
    bomb_factor: 1,
};

// DEBUG
let loading_stage = null;

let network = new LocalNetworkEmulator();
let engine_network = new Engine_8Bomb();

let engine_local = Engine.create();
engine_local.world.gravity.y = 0.2;
engine_local.timing.timeScale = 0;
Engine.run(engine_local);

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
            } else if (tok[1] === "local-play") {
                ui_menu = new UI_LocalPlay();
            } else if (tok[1] === "online-play") {
                ui_menu = new UI_OnlinePlay();
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
        } else if (tok[0] === "play") {
            if (tok[1] === "fade") {
                ui_menu.FadeOut("play load");
            } else if (tok[1] === "load") {
                ui_menu.Destroy();
                ui_menu = new Load_LocalPlay();
                loading_stage = new LocalPlay();
            } else if (tok[1] === "start") {
                ui_menu.Destroy();
                ui_menu = loading_stage;
                ui_menu.Start();
                loading_stage = null;
            }
        } else if (tok[0] === "map") {
            console.log("setting map to " + tok[1]);
            play_opts.map = tok[1];
        } else if (tok[0] === "gravity") {
            console.log("setting gravity to " + tok[1]);
            if (tok[1] === "low") {
                play_opts.gravity = 0;
            } else if (tok[1] === "medium") {
                play_opts.gravity = 1;
            } else if (tok[1] === "high") {
                play_opts.gravity = 2;
            }
        } else if (tok[0] === "bomb-factor") {
            console.log("setting bomb factor to " + tok[1]);
            if (tok[1] === "low") {
                play_opts.bomb_factor = 0;
            } else if (tok[1] === "medium") {
                play_opts.bomb_factor = 1;
            } else if (tok[1] === "high") {
                play_opts.bomb_factor = 2;
            }
        } else if (tok[0] === "connect") {
            console.log("handling connect " + tok[1]);
            if (tok[1] === "failed") {
                ui_menu.Destroy();
                ui_menu = new UI_MainMenu();
                loading_stage = null;
            }
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

function Sigs(n, dig=3) {
    return Math.round(n * Math.pow(10, dig)) / 1000;
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

    SetTextAlpha(a) {
        this._text.alpha = a;
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
    constructor(s="NONE") {
        app.renderer.backgroundColor = color_scheme.bg;
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

        this._title_str = s;
        this._title_text = new PIXI.Text(this._title_str,
            {fontFamily:"monospace", fontSize:100, fill:color_scheme.title, align:"center", fontWeight:"bold",
            dropShadow:true, dropShadowAngle:Math.PI/4, dropShadowBlur:3, dropShadowColor:(color_scheme.title & 0xfefefe) >> 1});
        this._title_text.position.set(WIDTH/2, 120);
        this._title_text.anchor.set(0.5);
        ui.addChild(this._title_text);
        this._texts.push(this._title_text);

        this._fade_act = "none";
        this._fading = false;
        this._fade_pc = 0;
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

        if (this._fading) {
            if (this._fade_pc < 1) {
                this._fade_pc += 0.01;
                for (let i = 0; i < this._texts.length; i++) {
                    this._texts[i].alpha = 1 - this._fade_pc;
                }
                for (let i = 0; i < this._buttons.length; i++) {
                    this._buttons[i].SetTextAlpha(1 - this._fade_pc);
                }
            } else {
                this._fade_pc = 1;
                stage_actions.push(this._fade_act);
            }
        }
    }

    Key(k, d) {
        if (!d) { return; }
        if (this._fading) { return; }

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
        if (this._fading) { return; }

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
        if (this._fading) { return; }

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

    FadeOut(act) {
        this._fading = true;
        this._fade_act = act;
    }

    Destroy() {
        for (let i = 0; i < this._buttons.length; i++) {
            this._buttons[i].Destroy();
        }
        for (let i = 0; i < this._texts.length; i++) {
            ui.removeChild(this._texts[i]);
        }
    }

    Draw() {
        for (let i = 0; i < this._buttons.length; i++) {
            this._buttons[i].Draw();
        }

        if (this._fading) {
            ui_graphics.beginFill(0x000000, this._fade_pc);
            ui_graphics.drawRect(0, 0, WIDTH, HEIGHT);
            ui_graphics.endFill();
        }
    }
}

class UI_MainMenu extends UI_Menu {
    constructor() {
        super("8Bomb");

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
        super("Settings");

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

        // button 5, dropdown 0.
        this._buttons.push(new UI_Button(
            550, 500, 350, 60, this._btn_rad, ""+color_scheme.name, this._btn_fs, "submenu open 0", true, true));
            
        // button 6, 7, and 8 (dropdown 0).
        this._buttons.push(new UI_Button(
            550, 540, 350, 70, this._btn_rad, "Grand Canyon", this._btn_fs, 
            "color-scheme GRAND_CANYON; submenu close 0", false));
        this._buttons.push(new UI_Button(
            550, 580, 350, 70, this._btn_rad, "Kodiak", this._btn_fs,
            "color-scheme KODIAK; submenu close 0", false));
        this._buttons.push(new UI_Button(
            550, 620, 350, 60, this._btn_rad, "Portland", this._btn_fs,
            "color-scheme PORTLAND; submenu close 0", false));

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
}

class UI_About extends UI_Menu {
    constructor() {
        super("About");

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
        this._texts.push(this._about_text);

        this._selected_button = 0;
        this._buttons[this._selected_button].Select();

        this._button_transitions = {
            0: {E:1},
            1: {W:0}
        }
    }
}

class UI_LocalPlay extends UI_Menu {
    constructor() {
        super("Local Play");

        this._btn_width = 300;
        this._btn_height = 120;
        this._btn_rad = 20;
        this._btn_fs = 30;
        this._padding = 40;
        this._horizontal_offset = this._btn_width/2 + this._padding;
        this._vertical_offset = 120;

        // button 0 and 1: back and play.
        this._buttons.push(new UI_Button(
            this._horizontal_offset, this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Back", this._btn_fs,
            "open main-menu"));
        this._buttons.push(new UI_Button(
            WIDTH - this._horizontal_offset, this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Play", this._btn_fs,
            "play fade"));

        // Map dropdown menu.
        this._map_text = new PIXI.Text("Map:",
            {fontFamily:"monospace", fontSize:40, fill:color_scheme.title, align:"right"});
        this._map_text.position.set(350, 300);
        this._map_text.anchor.set(1, 0.5);
        ui.addChild(this._map_text);
        this._texts.push(this._map_text);

        // button 2, dropdown 0.
        this._buttons.push(new UI_Button(
            550, 300, 350, 60, this._btn_rad, ""+play_opts.map, this._btn_fs, "submenu open 0", true, true));
            
        // button 3 (dropdown 0).
        this._buttons.push(new UI_Button(
            550, 340, 350, 60, this._btn_rad, "Kansas", this._btn_fs, 
            "map Kansas; submenu close 0", false));
        
        this._submenus.push([3]);

        // Bomb shape dropdown menu.
        this._bomb_text = new PIXI.Text("Bomb Shape:",
            {fontFamily:"monospace", fontSize:40, fill:color_scheme.title, align:"right"});
        this._bomb_text.position.set(350, 400);
        this._bomb_text.anchor.set(1, 0.5);
        ui.addChild(this._bomb_text);
        this._texts.push(this._bomb_text);

        // button 4, dropdown 1.
        this._buttons.push(new UI_Button(
            550, 400, 350, 60, this._btn_rad, ""+play_opts.bomb_shape, this._btn_fs, "submenu open 1", true, true));
            
        // button 5 (dropdown 1).
        this._buttons.push(new UI_Button(
            550, 440, 350, 60, this._btn_rad, "Dynamite", this._btn_fs, 
            "bomb-shape Dynamite; submenu close 1", false));
        
        this._submenus.push([5]);

        // Gravity selection.
        this._grav_text = new PIXI.Text("Gravity:",
            {fontFamily:"monospace", fontSize:40, fill:color_scheme.title, align:"right"});
        this._grav_text.position.set(350, 500);
        this._grav_text.anchor.set(1, 0.5);
        ui.addChild(this._grav_text);
        this._texts.push(this._grav_text);

        // button 6, 7, and 8 (radio 0).
        this._radio_buttons.push([6, 7, 8]);
        this._buttons.push(new UI_Button(
            425, 500, 100, 60, this._btn_rad, "Low", this._btn_fs - 6,
            "gravity low; radio 0 0"));
        this._buttons.push(new UI_Button(
            550, 500, 100, 60, this._btn_rad, "Medium", this._btn_fs - 6,
            "gravity medium; radio 0 1"));
        this._buttons.push(new UI_Button(
            675, 500, 100, 60, this._btn_rad, "High", this._btn_fs - 6,
            "gravity high; radio 0 2"));
        this._buttons[play_opts.gravity + 6].Enable();
            
        // Bomb factor selection.
        this._factor_text = new PIXI.Text("Bomb Factor:",
            {fontFamily:"monospace", fontSize:40, fill:color_scheme.title, align:"right"});
        this._factor_text.position.set(350, 600);
        this._factor_text.anchor.set(1, 0.5);
        ui.addChild(this._factor_text);
        this._texts.push(this._factor_text);

        // button 9, 10, 11 (radio 1).
        this._radio_buttons.push([9, 10, 11]);
        this._buttons.push(new UI_Button(
            425, 600, 100, 60, this._btn_rad, "Low", this._btn_fs - 6,
            "bomb-factor low; radio 1 0"));
        this._buttons.push(new UI_Button(
            550, 600, 100, 60, this._btn_rad, "Medium", this._btn_fs - 6,
            "bomb-factor medium; radio 1 1"));
        this._buttons.push(new UI_Button(
            675, 600, 100, 60, this._btn_rad, "High", this._btn_fs - 6,
            "bomb-factor high; radio 1 2"));
        this._buttons[play_opts.bomb_factor + 9].Enable();
        
        this._selected_button = 0;
        this._buttons[this._selected_button].Select();

        this._button_transitions = {
            0: {E:1, S:2},
            1: {W:0, S:2},
            2: {N:0, S:4},
            3: {},
            4: {N:2, S:7},
            5: {},
            6: {N:4, E:7, S:9},
            7: {N:4, W:6, E:8, S:10},
            8: {N:4, W:7, S:11},
            9: {N:6, E:10},
            10: {N:7, W:9, E:11},
            11: {N:8, W:10},
        }
    }
}

class UI_OnlinePlay extends UI_Menu {
    constructor() {
        super("Online Play");

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
        
        this._selected_button = 0;
        this._buttons[this._selected_button].Select();

        this._button_transitions = {
            0: {E:1},
            1: {W:0}
        }

        this._about_str = "Online play is currently under development.\n\n\
Please donate to support this effort!\n\n\
We look forward to dodging bombs with you!";
        this._about_text = new PIXI.Text(this._about_str,
            {fontFamily:"monospace", fontSize:30, fill:color_scheme.text, align:"left",
            wordWrap:true, wordWrapWidth:WIDTH*0.8, lineHeight:35});
        this._about_text.position.set(WIDTH/2, 300);
        this._about_text.anchor.set(0.5, 0);
        ui.addChild(this._about_text);
        this._texts.push(this._about_text);
    }
}

// Classes ////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Stage //////////////////////////////////////////////////////////////////////////////////////////

let ui_menu = new UI_MainMenu();

app.ticker.add(Tick);

// Stage //////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Events /////////////////////////////////////////////////////////////////////////////////////////

document.addEventListener("keydown", function (evt) {
    ui_menu.Key(evt.key, true);
    keys[evt.key] = true;
}, false);

document.addEventListener("keyup", function (evt) {
    ui_menu.Key(evt.key, false);
    keys[evt.key] = false;
}, false);

document.addEventListener("mousemove", function (evt) {
    ui_menu.MouseMove(evt.x, evt.y);
}, false);

document.addEventListener("mousedown", function (evt) {
    ui_menu.MouseDown(evt.x, evt.y, evt.button);
}, false);

document.addEventListener("mouseup", function (evt) {
    //ui_menu.MouseUp(evt.x, evt.y, evt.button);
}, false);

// Events /////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////