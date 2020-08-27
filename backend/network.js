// Sky Hoffert
// Network used in 8Bomb.io backend and dispatcher.

const E8B = require("./engine");

class Network {
	constructor(s, aq) {
		this._server = s;
		this._conns = {};
        this._rxQ = [];
        this._actionQ = aq;

		let self = this;
		this._server.on("connection", function (evt) {
			self.Connection(evt);
        });
        
        this._measure_rx = 0;
        this._measure_tx = 0;
        this._measure_timer = Date.now();
        this._measure_ticks = 0;
	}

	Connection(evt) {
        console.log("Got new connection");

        // TODO: possible collision here?
		const cid = E8B.GenRequestID(8);
        this._conns[cid] = {connection: evt, id: cid};
        
		let self = this;
		evt.on("close", function (evt) {
			self.Close(evt, cid);
		});
		evt.on("message", function (evt) {
			self.Message(evt, cid);
		});

		evt.send(E8B.Compress(JSON.stringify({
			type: "open-response",
			resID: E8B.GenRequestID(6),
			spec: {
				cID: cid,
			},
		}), {outputEncoding:"Base64"}));
	}

	Close(evt, cid) {
        this._actionQ.push({type:"remove-client", cid:cid});
        delete this._conns[cid];
        console.log("connection to client " + cid + " closed.");
	}

	Message(evt) {
        this._measure_rx += evt.length;
		const msg = E8B.Decompress(evt);
        this._rxQ.push({id:"", data:msg});
	}
	
    ServerSend(msg, id="") {
        const msgc = E8B.Compress(msg);
        const len = msgc.length;
		if (id === "") {
			for (let k in this._conns) {
                this._conns[k].connection.send(msgc);
                this._measure_tx += len;
			}
		} else {
			this._conns[id].connection.send(msgc);
            this._measure_tx += len;
        }

        // Keep track of data rate every 100 send messages.
        this._measure_ticks++;
        if (this._measure_ticks > 100) {
            const now = Date.now();
            const elapsed = now - this._measure_timer;
            this._measure_timer = now;

            const rx_kbps = E8B.Sigs(this._measure_rx / elapsed * 8);
            const tx_kbps = E8B.Sigs(this._measure_tx / elapsed * 8);

            console.log("" + rx_kbps + " kbps down, " + tx_kbps + " kbps up");

            this._measure_ticks = 0;
            this._measure_rx = 0;
            this._measure_tx = 0;
        }
    }

    ServerRecv() {
		let resp = {id:"", data:""};
        if (this._rxQ.length > 0) {
            resp = this._rxQ[0];
            this._rxQ.splice(0, 1);
        }
        return resp;
	}
	
	HasData() {
		return this._rxQ.length !== 0;
    }
    
    Destroy() {
        while (this._conns.length > 0) {
            this._conns[0].connection.close();
            this._conns.splice(0, 1);
        }
    }
}

this.Network = Network;
