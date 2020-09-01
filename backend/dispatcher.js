// Sky Hoffert

console.log("Starting 8Bomb dispatcher.");

const fs = require("fs");
const http = require("http");
const https = require("https");
const SocketServer = require("ws").Server;
const { spawn } = require("child_process");

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
// Dispatcher /////////////////////////////////////////////////////////////////////////////////////

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

    dispatcher.Tick(dT);
}

const FPS = 1000/60;
const FPS_LOG_RATE = 5000; // ms

class Dispatcher {
    constructor() {
        this.active = true;
        this._actionQ = [];
		this._net_set = false;
		this._servers = {};

		this._AddServer("Test Server", 5061);
		this._AddServer("Other Test Server", 5062);
	}

	Destroy() {
		for (let k in this._servers) {
			this._DestroyServer(k);
		}
	}
	
	_AddServer(n, p, m="Kansas", pl={current:0,max:8}, pr=false) {
		if (n in this._servers) {
			console.log("ERR. Already a server with name " + n);
			return;
		}

		this._servers[n] = {
			port: p,
			map: m,
			players: pl,
			private: pr,
			process: spawn("node", ["backend.js", p]),
		};
		this._servers[n].process.stdout.on("data", function (data) {
			process.stdout.write("P("+p+"): " + data);
		});
		this._servers[n].process.stderr.on("data", function (data) {
			process.stdout.write("E("+p+"): " + data);
		});
	}

	_DestroyServer(n) {
		if (!(n in this._servers)) {
			console.log("ERR. No subprocess with name " + n);
			return;
		}

		this._servers[n].process.kill();

		let tstart = Date.now();
		let failed = false;
		while (this._servers[n].process.killed === false) {
			const now = Date.now();

			// wait 500 ms before failing.
			if (now - tstart > 2000) {
				failed = true;
				break;
			}
		}

		if (failed) {
			console.log("ERR. Failed to kill subprocess on port " + this._servers[n].port);
		} else {
			console.log("Killed server on port " + this._servers[n].port);
			delete this._servers[n];
		}
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
                } else if (rxp.type === "check") {
					if (rxp.spec.game === "8Bomb" && rxp.spec.version === "0.1") {
						network.ServerSend(JSON.stringify({
							type: "check-response",
							resID: E8B.GenRequestID(6),
							spec: {
								reqID: rxp.reqID,
								good: true,
							}
						}), rxp.spec.cID);
					} else {
						console.log("Server got a check with bad game or version");
						network.ServerSend(JSON.stringify({
							type: "check-response",
							resID: E8B.GenRequestID(6),
							spec: {
								reqID: rxp.reqID,
								good: false,
							}
						}), rxp.spec.cID);
					}
				} else if (rxp.type === "servers") {
					let srm = {
						type: "servers-response",
						resID: E8B.GenRequestID(6),
						spec: {
							reqID: rxp.reqID,
							servers: [],
						}
					};
					for (let k in this._servers) {
						srm.spec.servers.push({
							name: k,
							port: this._servers[k].port,
							map: this._servers[k].map,
							players: this._servers[k].players,
							private: this._servers[k].private,
						});
					}
					network.ServerSend(JSON.stringify(srm));
				}
            }
        }
    }
}

let dispatcher = new Dispatcher();
let network = new NET.Network(wss, dispatcher.ActionQueue());
dispatcher.NetSet();

setTimeout(Tick, FPS);

// Disconnect from clients before closing.
function Destroy() {
	console.log("Sending disconnect to all clients.");
	dispatcher.Destroy();
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
