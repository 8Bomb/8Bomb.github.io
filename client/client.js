
var exampleSocket = new WebSocket("wss://skyhoffert-backend.com:5030");
exampleSocket.onopen = function (evt) {
    exampleSocket.send("foo");
};
exampleSocket.onmessage = function (evt) {
    console.log("received from server: ");
    console.log(evt.data);
};
