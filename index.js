// Sky Hoffert
// Main menu for 8Bomb.io.

///////////////////////////////////////////////////////////////////////////////////////////////////
// Setup //////////////////////////////////////////////////////////////////////////////////////////

// Disable right click menu. Avoid this line.
// document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

const fmath = new FMath();

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

const canvas = document.getElementById("canvas");

const COLORS = {
    GRAND_CANYON: {
        name: "Grand Canyon",
        bg: 0x3D232B,
        fill: 0x663E3B,
        title: 0xD28B3D,
        text: 0xDAC376,
        misc: 0xB1B637,
    },
    KODIAK: {
        name: "Kodiak",
        bg: 0x59B8BF,
        fill: 0xE3E0E2,
        title: 0xF4E7DD,
        text: 0xF2B0A2,
        misc: 0xF6A889,
    },
    PORTLAND: {
        name: "Portland",
        bg: 0x301D31,
        fill: 0xAC373E,
        title: 0xF37D61,
        text: 0xEE9651,
        misc: 0xA7C3B2,
    },
};
const MAP_COLORS = {
    Kansas: {
        name: "Kansas",
        bg: 0x176B7D,
        wall: 0x389276,
        ground: 0x9D8E3A,
        bomb: 0xCE8F36,
        magma: 0xF05B52,
    }
};
const BOMB_COLORS = {
    Dynamite: {
        main: 0xF05B52,
    }
};
let color_scheme = COLORS.GRAND_CANYON;

const app = new PIXI.Application({
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: color_scheme.bg,
    resolution: window.devicePixelRatio || 1,
    antialias: true,
    canvas: canvas,
});

document.body.appendChild(app.view);

let prev_tick = window.performance.now();
let updates_num = 0;
let updates_timer = 0;

let textures_cache = {
    loaded: false,
    ball_sprites: null,
    explosion_sprites: null,
};

const FPS_LOG_RATE = 10000; // ms
const DATA_LOG_RATE = 10000; // ms
const PING_RATE = 3000; // ms

const RAD_TO_DEG = 57.296;

function Tick() {
    let now = window.performance.now();
    let dT = Sigs(now - prev_tick);
    prev_tick = now;

    Engine.update(engine_local, dT);

    updates_num++;
    updates_timer += dT;
    if (updates_timer > FPS_LOG_RATE) {
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

    // Ticking
    ui_menu.Tick(dT);

    // Drawing
    ui_graphics_1.clear();
    ui_graphics_2.clear();
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

// UI elements go in the UI - ui_graphics_1 is a child.
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
const ui_graphics_1 = new PIXI.Graphics();
ui.addChild(ui_graphics_1);
const ui_graphics_2 = new PIXI.Graphics();
ui.addChild(ui_graphics_2);

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

// TODO: add for local play
//let network = new LocalNetworkEmulator();
let network_addr_base = "wss://skyhoffert-backend.com:";
let network_dispatcher = network_addr_base + "5060";
let network_addr = network_dispatcher;

// If there is a file in the backend folder named LOCAL - use a local server.
// For development purposes.
var xhr = new XMLHttpRequest();
xhr.open("HEAD", "backend/LOCAL");
xhr.send();
xhr.onreadystatechange = function() {
    if (this.status === 200) {
        network_addr_base = "ws://localhost:";
        network_dispatcher = network_addr_base + "5060";
        network_addr = network_dispatcher;
    }
};

let network = null;
//let engine_network = new Engine_8Bomb();

let engine_local = Engine.create();
engine_local.world.gravity.y = 0.2;
// engine_local.timing.timeScale = 0;

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
                if (network !== null) {
                    network.Destroy();
                    network = null;
                    network_addr = network_dispatcher;
                }

                ui_menu = new UI_MainMenu();
            } else if (tok[1] === "settings") {
                ui_menu = new UI_Settings();
            } else if (tok[1] === "about") {
                ui_menu = new UI_About();
            } else if (tok[1] === "local-play") {
                ui_menu = new UI_LocalPlay();
            } else if (tok[1] === "online-play") {
                network = new Network(network_addr);
                ui_menu = new UI_OnlinePlay();
            } else if (tok[1] === "create-server") {
                ui_menu = new UI_CreateServer();
            }
        } else if (tok[0] === "soundfx") {
            console.log("TODO: turn sfx " + tok[1]);
            playing_soundfx = tok[1] === "on";
        } else if (tok[0] === "music") {
            console.log("TODO: turn music " + tok[1]);
            playing_music = tok[1] === "on";
        } else if (tok[0] === "donate") {
            //window.location = "https://paypal.me/skyhoffert";
            const win = window.open("https://paypal.me/skyhoffert");
            win.focus();
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
                network = new Network(network_addr);
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
        } else if (tok[0] === "resume") {
            console.log("Resuming play.");
            ui_menu.Resume();
        } else if (tok[0] === "lobby") {
            network_addr = network_addr_base + tok[1];
            console.log("Going to game server at  " + network_addr);
        }
    }
}

function UpdateColorScheme(c) {
    color_scheme = COLORS[c];
    app.renderer.backgroundColor = color_scheme.bg;
    ui_menu.UpdateColorScheme();
}

// Functions //////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Classes ////////////////////////////////////////////////////////////////////////////////////////

class UI_Button {
    constructor(x, y, w, h, r, t, fs, a, act=true, dd=false, ss=false) {
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
        this._filled = true;

        this._action = a;

        this._bbox = new PIXI.Rectangle(this._x - this._width/2, this._y - this._height/2,
            this._width, this._height);

        this._select_alpha = 0;

        this._active = act;
        if (!this._active) {
            this._text.visible = false;
        }

        this._has_dropdown = dd;

        this._small_selection = ss;

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

        ui_graphics_1.lineStyle(0);
        if (this._filled) {
            ui_graphics_1.beginFill(color_scheme.fill/2);
            ui_graphics_1.drawRoundedRect(this._x - this._width/2 + 10, this._y - this._height/2 + 10,
                this._width, this._height, this._corner_radius);
            ui_graphics_1.endFill();
        }

        let has_outline = false;
        if (this._enabled) {
            if (this._selected) {
                ui_graphics_2.lineStyle(6, color_scheme.title, this._select_alpha);
                has_outline = true;
            } else {
                ui_graphics_2.lineStyle(4, color_scheme.text, 1);
                has_outline = true;
            }
        } else {
            ui_graphics_2.lineStyle(6, color_scheme.title, this._select_alpha);
            has_outline = true;
        }

        if (has_outline) {
            if (this._small_selection) {
                const sel_ht = this._font_size + 8;
                ui_graphics_2.drawRoundedRect(this._x - this._width/2, this._y - sel_ht/2, 
                    this._width, sel_ht, this._corner_radius);
            } else {
                ui_graphics_2.drawRoundedRect(this._x - this._width/2, this._y - this._height/2, 
                    this._width, this._height, this._corner_radius);
            }
        }

        if (this._filled) {
            ui_graphics_1.beginFill(color_scheme.fill);
            ui_graphics_1.drawRoundedRect(this._x - this._width/2, this._y - this._height/2, 
                this._width, this._height, this._corner_radius);
            ui_graphics_1.endFill();
        }

        if (this._has_dropdown) {
            ui_graphics_1.lineStyle(0);
            ui_graphics_1.beginFill(color_scheme.text);
            ui_graphics_1.drawPolygon(this._dd_poly);
            ui_graphics_1.endFill();
        }
    }
}

class UI_ServerLine extends UI_Button {
    constructor(y, w, ln, m, pl, pr, p, port) {
        super(WIDTH/2, y, w, 60, 0, ln, 14, "lobby "+port+";play fade");

        this._filled = false;

        this._text.anchor.set(0, 0.5);

        this._map_text = new PIXI.Text(m,
            {fontFamily:"monospace", fontSize:this._font_size, fill:color_scheme.text, align:"left"});
        this._map_text.anchor.set(0, 0.5);
        ui.addChild(this._map_text);

        this._players_str = "" + pl.current + "/" + pl.max;
        this._players_text = new PIXI.Text(this._players_str,
            {fontFamily:"monospace", fontSize:this._font_size, fill:color_scheme.text, align:"left"});
        this._players_text.anchor.set(0, 0.5);
        ui.addChild(this._players_text);
        
        this._private_str = pr ? "Yes" : "No";
        this._private_text = new PIXI.Text(this._private_str,
            {fontFamily:"monospace", fontSize:this._font_size, fill:color_scheme.text, align:"left"});
        this._private_text.anchor.set(0, 0.5);
        ui.addChild(this._private_text);

        this._ping_text = new PIXI.Text(""+p+" ms",
            {fontFamily:"monospace", fontSize:this._font_size, fill:color_scheme.text, align:"left"});
        this._ping_text.anchor.set(0, 0.5);
        ui.addChild(this._ping_text);
    }
    
    SetTextAlpha(a) {
        super.SetTextAlpha(a);
        this._map_text.alpha = a;
        this._players_text.alpha = a;
        this._private_text.alpha = a;
        this._ping_text.alpha = a;
    }

    Destroy() {
        super.Destroy();
        ui.removeChild(this._map_text);
        ui.removeChild(this._players_text);
        ui.removeChild(this._private_text);
        ui.removeChild(this._ping_text);
    }

    UpdateTextLefts(l) {
        this._text.position.set(l.lobby, this._y);
        this._map_text.position.set(l.map, this._y);
        this._players_text.position.set(l.players, this._y);
        this._private_text.position.set(l.private, this._y);
        this._ping_text.position.set(l.ping, this._y);
    }
    
    UpdateServerLine(s) {
        this._text.text = s.name;
        this._map_text.text = s.map;

        this._players_str = "" + s.players.current + "/" + s.players.max;
        this._players_text.text = this._players_str;

        this._private_str = s.private ? "Yes" : "No";
        this._private_text.text = this._private_str;
        // TODO: ping text...
    }
}

class UI_Menu {
    constructor(s="NONE") {
        app.renderer.backgroundColor = color_scheme.bg;
        this._buttons = [];
        this._selected_button = -1;
        this._title_str = "NONE";
        this._KEY_TO_DIR = {"w":"N", "a":"W", "s":"S", "d":"E",
            "ArrowUp":"N", "ArrowLeft":"W", "ArrowDown":"S", "ArrowRight":"E"};
        this._button_transitions = {};
        this._submenus = [];
        this._texts = [];
        this._open_submenu = -1;
        this._radio_buttons = [];

        this._title_str = s;
        if (s === "NONE") {
            this._title_text = null;
        } else {
            this._title_text = new PIXI.Text(this._title_str,
                {fontFamily:"monospace", fontSize:100, fill:color_scheme.title, align:"center", fontWeight:"bold",
                dropShadow:true, dropShadowAngle:Math.PI/4, dropShadowBlur:3, dropShadowColor:(color_scheme.title & 0xfefefe) >> 1});
            this._title_text.position.set(WIDTH/2, 120);
            this._title_text.anchor.set(0.5);
            ui.addChild(this._title_text);
            this._texts.push(this._title_text);
        }

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
            if (this._selected_button !== -1) {
                this._buttons[this._selected_button].Action();
            }
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
            ui_graphics_2.lineStyle(0);
            ui_graphics_2.beginFill(0x000000, this._fade_pc);
            ui_graphics_2.drawRect(0, 0, WIDTH, HEIGHT);
            ui_graphics_2.endFill();
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
            "color-scheme GRAND_CANYON; submenu close 0", false, false, true));
        this._buttons.push(new UI_Button(
            550, 580, 350, 70, this._btn_rad, "Kodiak", this._btn_fs,
            "color-scheme KODIAK; submenu close 0", false, false, true));
        this._buttons.push(new UI_Button(
            550, 620, 350, 60, this._btn_rad, "Portland", this._btn_fs,
            "color-scheme PORTLAND; submenu close 0", false, false, false));

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
        };
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
            this._btn_width, this._btn_height, this._btn_rad, "Donate", this._btn_fs,
            "donate"));
            
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

        /*
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
        };
        */

        this._button_transitions = {
            0: {E:1},
            1: {W:0},
        };
        
        this._selected_button = 0;
        this._buttons[this._selected_button].Select();
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
        
        // List vars, some used for drawing.
        this._list_left_bound = WIDTH * 0.05;
        this._list_width = WIDTH * 0.9;
        this._list_height = HEIGHT - 300;
        this._list_right_bound = this._list_left_bound + this._list_width;
        this._list_label_fs = 20;

        this._buttons.push(new UI_Button(
            this._horizontal_offset, this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Back", this._btn_fs,
            "open main-menu"));
        this._buttons.push(new UI_Button(
            WIDTH - this._horizontal_offset, this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Create Server", this._btn_fs,
            "open create-server"));
        
        this._selected_button = 0;
        this._buttons[this._selected_button].Select();

        this._button_transitions = {
            0: {E:1},
            1: {W:0},
        };

        this._ping_timer = PING_RATE;
        this._ping = -1;

        // Ping is shown in the bottom right (mostly for debugging).
        this._ping_text = new PIXI.Text("- ms",
            {fontFamily:"monospace", fontSize:14, fill:0xffffff, align:"right"});
        this._ping_text.position.set(WIDTH - 10, HEIGHT - 14);
        this._ping_text.anchor.set(1, 0.5);
        ui.addChild(this._ping_text);
        this._texts.push(this._ping_text);
        
        this._list_lobby_text_left = this._list_left_bound + 20;
        this._lobby_name_text = new PIXI.Text("Lobby Name",
            {fontFamily:"monospace", fontSize:this._list_label_fs, fill:color_scheme.text, align:"left"});
        this._lobby_name_text.position.set(this._list_lobby_text_left, 230);
        this._lobby_name_text.anchor.set(0, 0.5);
        ui.addChild(this._lobby_name_text);
        this._texts.push(this._lobby_name_text);

        this._list_ping_left = this._list_right_bound - 100;
        this._list_ping_text_left = this._list_ping_left + 20;
        this._list_ping_text = new PIXI.Text("Ping",
            {fontFamily:"monospace", fontSize:this._list_label_fs, fill:color_scheme.text, align:"left"});
        this._list_ping_text.position.set(this._list_ping_text_left, 230);
        this._list_ping_text.anchor.set(0, 0.5);
        ui.addChild(this._list_ping_text);
        this._texts.push(this._list_ping_text);
        
        this._list_private_left = this._list_ping_left - 120;
        this._list_private_text_left = this._list_private_left + 20;
        this._list_private_text = new PIXI.Text("Private?",
            {fontFamily:"monospace", fontSize:this._list_label_fs, fill:color_scheme.text, align:"left"});
        this._list_private_text.position.set(this._list_private_text_left, 230);
        this._list_private_text.anchor.set(0, 0.5);
        ui.addChild(this._list_private_text);
        this._texts.push(this._list_private_text);
        
        this._list_players_left = this._list_private_left - 120;
        this._list_players_text_left = this._list_players_left + 20;
        this._list_players_text = new PIXI.Text("Players",
            {fontFamily:"monospace", fontSize:this._list_label_fs, fill:color_scheme.text, align:"left"});
        this._list_players_text.position.set(this._list_players_text_left, 230);
        this._list_players_text.anchor.set(0, 0.5);
        ui.addChild(this._list_players_text);
        this._texts.push(this._list_players_text);
        
        this._list_map_left = this._list_players_left - 160;
        this._list_map_text_left = this._list_map_left + 20;
        this._list_map_text = new PIXI.Text("Map",
            {fontFamily:"monospace", fontSize:this._list_label_fs, fill:color_scheme.text, align:"left"});
        this._list_map_text.position.set(this._list_map_text_left, 230);
        this._list_map_text.anchor.set(0, 0.5);
        ui.addChild(this._list_map_text);
        this._texts.push(this._list_map_text);

        this._clientID = "";
        this._checked = false;

        this._net_failed = false;

        this._servers = {};
    }

    _UpdatePing(p) {
        this._ping = p;
        this._ping_text.text = "" + p + " ms";
    }

    _PingServer() {
        network.ClientSend(JSON.stringify({
            type: "ping",
            reqID: GenRequestID(6),
            spec: {
                tsent: Sigs(window.performance.now()),
                cID: this._clientID,
            },
        }));
        
        // Get a list of active servers.
        network.ClientSend(JSON.stringify({
            type: "servers",
            reqID: GenRequestID(6),
            spec: {},
        }));
    }

    _HandleNetwork() {
        if (network === null) { return; }

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
                    this._UpdatePing(Sigs(this._ping, 0));
                } else if (rxp.type === "open-response") {
                    this._clientID = rxp.spec.cID;
                    console.log("Given client ID " + this._clientID);

                    // Whie loading, make a ping request.
                    this._PingServer();
            
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
                    if (rxp.spec.good === true) {
                        this._checked = true;
                        console.log("Got good server check.");
    
                        // Get a list of active servers.
                        network.ClientSend(JSON.stringify({
                            type: "servers",
                            reqID: GenRequestID(6),
                            spec: {},
                        }));
                    } else {
                        console.log("Failed server check!!");
                    }
                } else if (rxp.type === "servers-response") {
                    let servers_got = [];
                    for (let i = 0; i < rxp.spec.servers.length; i++) {
                        const serv = rxp.spec.servers[i];

                        if (serv.name in this._servers) {
                            this._buttons[this._servers[serv.name]].UpdateServerLine(rxp.spec.servers[i]);
                        } else {
                            const esl = new UI_ServerLine(300+i*60, this._list_width, serv.name, serv.map, serv.players, serv.private, -1, serv.port);
                            esl.UpdateTextLefts(this._TextLeftPositions());
                            this._servers[serv.name] = this._buttons.length;
                            this._buttons.push(esl);
                        }

                        servers_got.push(serv.name);
                    }

                    // Remove servers that no longer exist (if any).
                    for (let k in this._servers) {
                        if (servers_got.indexOf(k) === -1) {
                            console.log("Found a dead (old) server");
                            console.log("TODO: push servers below this one upwards.");

                            this._buttons[this._servers[k]].Destroy();
                            this._buttons.splice(this._servers[k], 1);
                            delete this._servers[k];
                        }
                    }
                }
            }
        }
    }

    _TextLeftPositions() {
        return {
            lobby: this._list_lobby_text_left,
            map: this._list_map_text_left,
            players: this._list_players_text_left,
            private: this._list_private_text_left,
            ping: this._list_ping_text_left,
        };
    }

    Tick(dT) {
        super.Tick(dT);

        if (this._net_failed) { return; }

        if (network === null) { return; }

        this._HandleNetwork();

        this._ping_timer -= dT;
        if (this._ping_timer < 0) {
            this._ping_timer = PING_RATE;
            this._PingServer();
        }

        if (network.failed) {
            this._net_failed = true;
            
            this._failed_text = new PIXI.Text("Connection to server failed. Retry later.",
                {fontFamily:"monospace", fontSize:36, fill:color_scheme.fill, align:"center"});
            this._failed_text.position.set(WIDTH/2, HEIGHT/2);
            this._failed_text.anchor.set(0.5);
            ui.addChild(this._failed_text);
            this._texts.push(this._failed_text);
        }
    }

    Destroy() {
        super.Destroy();
    }

    Draw() {
        super.Draw();

        ui_graphics_1.lineStyle(0);
        ui_graphics_1.beginFill(color_scheme.text);
        ui_graphics_1.drawRect(this._list_left_bound, 250, this._list_width, 4);
        ui_graphics_1.endFill();

        ui_graphics_1.beginFill(color_scheme.text);
        ui_graphics_1.drawRect(this._list_ping_left, 210, 4, this._list_height);
        ui_graphics_1.endFill();
        
        ui_graphics_1.beginFill(color_scheme.text);
        ui_graphics_1.drawRect(this._list_private_left, 210, 4, this._list_height);
        ui_graphics_1.endFill();
        
        ui_graphics_1.beginFill(color_scheme.text);
        ui_graphics_1.drawRect(this._list_players_left, 210, 4, this._list_height);
        ui_graphics_1.endFill();
        
        ui_graphics_1.beginFill(color_scheme.text);
        ui_graphics_1.drawRect(this._list_map_left, 210, 4, this._list_height);
        ui_graphics_1.endFill();

        if (this._net_failed) {
            ui_graphics_1.beginFill(color_scheme.misc);
            ui_graphics_1.drawRoundedRect(this._list_left_bound, HEIGHT/2 - 24, this._list_width, 48);
            ui_graphics_1.endFill();
        }
    }
}

class UI_CreateServer extends UI_Menu {
    constructor() {
        super("Create Server");

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
            "open online-play"));
        this._buttons.push(new UI_Button(
            WIDTH - this._horizontal_offset, this._vertical_offset, 
            this._btn_width, this._btn_height, this._btn_rad, "Donate", this._btn_fs,
            "donate"));
        
        this._selected_button = 0;
        this._buttons[this._selected_button].Select();

        this._button_transitions = {
            0: {E:1},
            1: {W:0}
        };
        
        this._about_str = "Create Server is currently under development.\n\n\
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
    // Don't continuously send data when holding down a key.
    if (keys[evt.key] === false || !(evt.key in keys)) {
        ui_menu.Key(evt.key, true);
        keys[evt.key] = true;
    }
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

document.addEventListener("beforeunload", function (evt) {
    if (network !== null) {
        console.log("here");
        network.Destroy();
    }
}, false);

// Events /////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
