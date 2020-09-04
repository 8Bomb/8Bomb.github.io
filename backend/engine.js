// Sky Hoffert
// Module used for the engine in 8Bomb.io.
// Should be used on both the front and back end.

if (LZUTF8 === undefined) {
    var LZUTF8 = require("lzutf8");
}
if (Matter === undefined) {
    var Matter = require("matter-js");
}

const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;

const WORDS_ADJ = ["Elite", "Devilish", "Decent", "Even", "Cuddly", "Graceful", "Lovely",
    "Mundane", "Macabre", "Fantastic", "Angry", "Nasty", "Fine"];
const WORDS_NOUN = ["Beetle", "Warthog", "Bear", "Fox", "Horse", "Mongoose", "Rooster",
    "Jackal", "Sheep", "Iguana", "Worm", "Buffalo", "Weasel"];

function GenRequestID(n) {
    return Math.round((Math.pow(36, n + 1) - Math.random() * Math.pow(36, n))).toString(36).slice(1);
}

function Sigs(n, dig=3) {
    return Math.round(n * Math.pow(10, dig)) / Math.pow(10, dig);
}

function RandomColor() {
	return '#'+(Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0');
}

function DarkenColor(c) {
    return (c & 0xfefefe) >> 1;
}

// Generates a random name with given format.
// @param s (string): format string a=adj, n=noun
// @return string: name in the format given
function RandomName(s="an") {
    s = s.trim().toLowerCase();
    let str = "";
    for (let i = 0; i < s.length; i++) {
        const w = s[i] === "a" ? WORDS_ADJ : s[i] === "n" ? WORDS_NOUN : [];
        if (w.length === 0) { continue; }
        str += w[Math.round(Math.random() * w.length)] + " ";
    }
    return str.trim();
}

function Compress(m) {
    return LZUTF8.compress(m, {outputEncoding:"Base64"});
}

function Decompress(m) {
    return LZUTF8.decompress(m, {inputEncoding:"Base64"});
}

function NewBomb(x, y, r) {
    const b = Bodies.circle(x, y, r, 6);
    b.restitution = 0.1;
    return b;
}

function NewPowerup(x, y, s) {
    const p = Bodies.polygon(x, y, 3, s);
    return p;
}

// Everything below is included so that Node.js can parse this file.
this.GenRequestID = GenRequestID;
this.Sigs = Sigs;
this.RandomColor = RandomColor;
this.DarkenColor = DarkenColor;
this.Compress = Compress;
this.Decompress = Decompress;
this.NewBomb = NewBomb;
this.NewPowerup = NewPowerup;
this.RandomName = RandomName;
