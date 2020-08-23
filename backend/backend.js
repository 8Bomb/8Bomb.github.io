console.log("starting.");

const fs = require("fs");
const https = require("https");
const SocketServer = require("ws").Server;

var privateKey  = fs.readFileSync('/etc/letsencrypt/live/skyhoffert-backend.com/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/skyhoffert-backend.com/fullchain.pem', 'utf8');
 
var credentials = {key: privateKey, cert: certificate};
var express = require('express');
var app = express();
 
//... bunch of other express stuff here ...
 
//pass in your express app and credentials to create an https server
var httpsServer = https.createServer(credentials, app);
httpsServer.listen(5030);

const wss = new SocketServer({ server : httpsServer });

console.log("listening.");

wss.on("connection", function (conn) {
    conn.send("hi");
});

