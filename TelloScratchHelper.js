const http = require("http");
const url = require("url");
const dgram = require("dgram");

const TELLO_HOST = "192.168.10.1";
const TELLO_PORT = 8889;

const SCRATCH_LISTEN_HOST = "127.0.0.1";
const SCRATCH_LISTEN_PORT = 8001;

const showLog = msg => {
  const dateString = new Date().toISOString();
  console.log(dateString + " " + msg);
};

const showScratchLog = msg => {
  showLog("[Scratch] " + msg);
};

const showTelloLog = msg => {
  showLog("[Tello] " + msg);
};

// UDP (Helper <-> Tello)
const socket = dgram.createSocket("udp4");

socket.on("listening", () => {
  showTelloLog("Listening UDP...");
});

socket.on("message", (msg, rinfo) => {
  showTelloLog("=> " + decodeURIComponent(msg));
  //showTelloLog("=> " + JSON.stringify(rinfo))
});

socket.on("error", (err) => {
  showTelloLog(err.name + ": " + err.message);
})

socket.on("close", () => {
  showTelloLog("Closed.")
})

const sendToTello = msg => {
  socket.send(msg, TELLO_PORT, TELLO_HOST, (error, bytes) => {
    showTelloLog("<= " + msg);
  });
};

socket.bind();

var busyId = null;
var speed = 100.0; // cm/s

const directionMapping = {
  前: "f",
  後ろ: "b",
  左: "l",
  右: "r",
  左斜め前: "lf",
  左斜め後ろ: "lb",
  右斜め前: "rf",
  右斜め後ろ: "rb"
};

// HTTP (Scratch <-> Helper)
http
  .createServer((req, res) => {
    const requestUrl = url.parse(req.url);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const paths = pathname.split("/");

    if (!requestUrl.pathname.startsWith("/poll")) {
      showScratchLog("=> " + pathname);
    }

    switch (paths[1]) {
      case "poll":
        if (busyId == null) {
          res.end("");
        } else {
          var data = "_busy " + busyId;
          //showScratchLog("<= " + data);
          res.end(data);
        }
        return;

      case "reset_all":
        var data = "dummy 20";
        showScratchLog("<= " + data);
        res.end(data);
        return;

      case "takeoff":
        jobId = paths[2];
        busyId = jobId;
        var data = "OK " + jobId;
        setTimeout(() => (busyId = null), 6000);
        sendToTello("command");
        sendToTello("speed?")
        sendToTello("battery?")
        //sendToTello("speed " + speed);
        sendToTello("takeoff");
        res.end(data);
        showScratchLog("<= " + data);
        return;

      case "land":
        jobId = paths[2];
        busyId = jobId;
        var data = "OK " + jobId;
        setTimeout(() => (busyId = null), 6000);
        sendToTello("land");
        res.end(data);
        showScratchLog("<= " + data);
        return;

      case "up":
      case "down":
      case "left":
      case "right":
      case "forward":
      case "back":
        jobId = paths[2];
        busyId = jobId;
        length = parseInt(paths[3]);

        if (length >= 20 && length <= 500) {
          executionTimeInMillis = (1000 * length / speed) * 1.8;
          setTimeout(() => (busyId = null), executionTimeInMillis);
          sendToTello(paths[1] + " " + paths[3]);
          var data = "OK " + jobId;
          res.end(data);
          showScratchLog("<= " + data);
        } else {
          busyId = null;
          var data = "_problem Length is out of range (20-500)";
          res.end(data);
          showScratchLog("<= " + data);
        }
        return;

      case "cw":
      case "ccw":
        jobId = paths[2];
        busyId = jobId;
        degree = parseInt(paths[3]);
        if (degree >= 1 && degree <= 3600) {
          rotationSpeed = 60; // degree/s
          executionTimeInMillis = 1000 * degree / rotationSpeed + 1000;
          setTimeout(() => (busyId = null), executionTimeInMillis);
          sendToTello(paths[1] + " " + paths[3]);
          var data = "OK " + jobId;
          res.end(data);
          showScratchLog("<= " + data);
        } else {
          busyId = null;
          var data = "_problem Degree is out of range (1-3600)";
          res.end(data);
          showScratchLog("<= " + data);
        }
        return;

      case "flip":
        jobId = paths[2];
        busyId = jobId;
        requestedDirection = paths[3];
        var direction;
        if (requestedDirection in directionMapping) {
          direction = directionMapping[requestedDirection];
        } else {
          direction = requestedDirection;
        }
        setTimeout(() => (busyId = null), 2500);
        sendToTello("flip " + direction);
        var data = "OK " + jobId;
        res.end(data);
        showScratchLog("<= " + data);
        return;

      case "setspeed":
        jobId = paths[2];
        busyId = jobId;
        requestedSpeed = parseInt(paths[3]);
        if (requestedSpeed >= 1 && requestedSpeed <= 100) {
          speed = requestedSpeed;
        }
        sendToTello("speed " + paths[2]);
        data = "OK 10";
        res.end(data);
        showScratchLog("<= " + data);
        return;
    }
  })
  .listen(SCRATCH_LISTEN_PORT, SCRATCH_LISTEN_HOST);

showScratchLog(
  "Listening HTTP on " + SCRATCH_LISTEN_HOST + ":" + SCRATCH_LISTEN_PORT
);
