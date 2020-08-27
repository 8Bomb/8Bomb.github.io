// Sky Hoffert

console.log("Starting 8Bomb dispatcher.");

const fs = require("fs");
const http = require("http");
const https = require("https");
const SocketServer = require("ws").Server;

const E8B = require("./engine");
const NET = require("./network");

const DEFAULT_PORT = 5060;
const PORT = process.argv.length === 3 ? parseInt(process.argv[2], 10) : DEFAULT_PORT;
if (PORT === NaN) {
    console.log("ERR. Caught error with parsing port num.");
    process.exit();
}

let LOCAL = true;
try {
	if (fs.existsSync("./LOCAL")) {
		console.log("Running on local server, port " + PORT + ".");
		LOCAL = true;
	} else {
		console.log("Running on the www, port " + PORT + ".");
		LOCAL = false;
	}
} catch (err) {
	console.log("ERR. Caught an err with existsSync.");
    process.exit();
}

var credentials = null;
if (!LOCAL) {
	const privateKey  = fs.readFileSync("/etc/letsencrypt/live/skyhoffert-backend.com/privkey.pem", "utf8");
	const certificate = fs.readFileSync("/etc/letsencrypt/live/skyhoffert-backend.com/fullchain.pem", "utf8");
	credentials = {key: privateKey, cert: certificate};
}
 
var express = require("express");
var app = express();
 
//pass in your express app and credentials to create an https server
var server = null;
if (!LOCAL) {
	server = https.createServer(credentials, app);
} else {
	server = http.createServer(app);
}
server.listen(PORT);

const wss = new SocketServer({ server : server });

console.log("listening.");

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
// Engine! ////////////////////////////////////////////////////////////////////////////////////////

let prevTime = Date.now();
let tick_timer = 0;
let tick_frames = 0;
function Tick() {
    setTimeout(Tick, FPS);
    
	let now = Date.now();
	let dT = now - prevTime;
	prevTime = now;

    tick_timer += dT;
    tick_frames++;
    if (tick_timer > FPS_LOG_RATE) {
        console.log("fps: " + E8B.Sigs(tick_frames / tick_timer * 1000));
        tick_timer = 0;
        tick_frames = 0;
    }

    engine.Tick(dT);
}

const FPS = 1000/60;
const FPS_LOG_RATE = 5000; // ms

class Dispatcher {
    constructor() {
        this.active = true;
        this._actionQ = [];
        this._net_set = false;
    }

    ActionQueue() { return this._actionQ; }
    NetSet() { return this._net_set = true; }

    Tick(dT) {
        while (this._actionQ.length > 0) {
            // TODO: handle action

            this._actionQ.splice(0, 1);
        }
        
        this._HandleNetwork();
    }

    _HandleNetwork() {
        if (!this._net_set) { return; }

		while (network.HasData()) {
			const rx = network.ServerRecv().data;
			if (rx !== "") {
				let rxp = {};
				try {
					rxp = JSON.parse(rx);
				} catch (err) {
					console.log("ERR. Could not parse rx message in client.");
					return;
				}

				if (rxp.type === "ping") {
					network.ServerSend(JSON.stringify({
						type: "pong",
						resID: E8B.GenRequestID(6),
						spec: {
							reqID: rxp.reqID,
							tsent: rxp.spec.tsent,
						},
					}), rxp.spec.cID);
                }
            }
        }
    }
}

let dispatcher = new Dispatcher();
let network = new NET.Network(wss, dispatcher.ActionQueue());
dispatcher.NetSet();

// Disconnect from clients before closing.
function Destroy() {
    console.log("Sending disconnect to all clients.");
    network.Destroy();
}

process.on("SIGINT", function() {
    Destroy();
    console.log("Got SIGINT. Exiting.");
    process.exit();
});
process.on("SIGTERM", function() {
    Destroy();
    console.log("Got SIGTERM. Exiting.");
    process.exit();
});
