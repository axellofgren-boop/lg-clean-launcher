// One shared connection to the TV's phone-remote service (the same one LG's
// ThinQ phone app uses). discover.js uses it to list apps, stay.js uses it to
// hear when the app on screen changes. The first time, the TV asks
// "allow this device?"; after that it remembers us by a saved key.

// ws://127.0.0.1:3000 is the one that answered on Julia's TV, so it goes first.
var REMOTE_URLS = ["ws://127.0.0.1:3000", "wss://127.0.0.1:3001", "ws://localhost:3000", "wss://localhost:3001"];
var REMOTE_KEY = "goblinMansion.remoteKey";

// The TV only answers apps that introduce themselves with this "manifest".
// It's the public one from LG's Connect SDK, as used by open-source remote
// apps (copied from the MIT-licensed lgtv2 project).
var REMOTE_MANIFEST = {
  manifestVersion: 1,
  appVersion: "1.1",
  signed: {
    created: "20140509",
    appId: "com.lge.test",
    vendorId: "com.lge",
    localizedAppNames: { "": "LG Remote App", "ko-KR": "리모컨 앱", "zxx-XX": "ЛГ Rэмotэ AПП" },
    localizedVendorNames: { "": "LG Electronics" },
    permissions: ["TEST_SECURE", "CONTROL_INPUT_TEXT", "CONTROL_MOUSE_AND_KEYBOARD", "READ_INSTALLED_APPS",
      "READ_LGE_SDX", "READ_NOTIFICATIONS", "SEARCH", "WRITE_SETTINGS", "WRITE_NOTIFICATION_ALERT",
      "CONTROL_POWER", "READ_CURRENT_CHANNEL", "READ_RUNNING_APPS", "READ_UPDATE_INFO",
      "UPDATE_FROM_REMOTE_APP", "READ_LGE_TV_INPUT_EVENTS", "READ_TV_CURRENT_TIME"],
    serial: "2f930e2d2cfe083771f68e4fe7bb07"
  },
  permissions: ["LAUNCH", "LAUNCH_WEBAPP", "APP_TO_APP", "CLOSE", "READ_APP_STATUS", "READ_RUNNING_APPS",
    "READ_INSTALLED_APPS", "READ_INPUT_DEVICE_LIST", "READ_NETWORK_STATE", "READ_POWER_STATE",
    "READ_COUNTRY_INFO", "READ_SETTINGS"],
  signatures: [{
    signatureVersion: 1,
    signature: "eyJhbGdvcml0aG0iOiJSU0EtU0hBMjU2Iiwia2V5SWQiOiJ0ZXN0LXNpZ25pbmctY2VydCIsInNpZ25hdHVyZVZlcnNpb24iOjF9.hrVRgjCwXVvE2OOSpDZ58hR+59aFNwYDyjQgKk3auukd7pcegmE2CzPCa0bJ0ZsRAcKkCTJrWo5iDzNhMBWRyaMOv5zWSrthlf7G128qvIlpMT0YNY+n/FaOHE73uLrS/g7swl3/qH/BGFG2Hu4RlL48eb3lLKqTt2xKHdCs6Cd4RMfJPYnzgvI4BNrFUKsjkcu+WD4OO2A27Pq1n50cMchmcaXadJhGrOqH5YmHdOCj5NSHzJYrsW0HPlpuAx/ECMeIZYDh6RMqaFM2DXzdKX9NmmyqzJ3o/0lkk/N97gfVRLW5hA29yeAwaCViZNCP8iC9aO0q9fQojoa7NQnAtw=="
  }]
};

// Newer TVs reject the signed manifest; LG's own apps then retry unsigned.
function unsignedManifest() {
  var m = JSON.parse(JSON.stringify(REMOTE_MANIFEST));
  delete m.signed;
  m.appVersion = "1.0";
  return m;
}

var remote = {
  ws: null,
  ready: false,
  connecting: false,
  url: "",
  status: "not connected",
  waiting: [],        // callbacks waiting for the connection
  replies: {},        // request id → callback
  subscriptions: [],  // kept so we can subscribe again after reconnecting
  nextId: 1
};

function hasRemoteKey() {
  try { return !!localStorage.getItem(REMOTE_KEY); } catch (e) { return false; }
}

// Connect (or reuse the connection). done(error) gets null when it worked.
function remoteConnect(onPrompt, done) {
  if (remote.ready) { done(null); return; }
  remote.waiting.push(done);
  if (remote.connecting) return;
  if (typeof WebSocket === "undefined") { remoteFinished("no WebSocket"); return; }
  remote.connecting = true;
  var errors = [];
  (function next(n) {
    if (n >= REMOTE_URLS.length) { remoteFinished(errors.join(" · ")); return; }
    remoteTry(REMOTE_URLS[n], onPrompt || function () {}, function (err) {
      if (!err) { remoteFinished(null); return; }
      errors.push(REMOTE_URLS[n] + ": " + err);
      next(n + 1);
    });
  })(0);
}

function remoteFinished(err) {
  remote.connecting = false;
  remote.status = err ? err : "connected to " + remote.url;
  var waiting = remote.waiting;
  remote.waiting = [];
  waiting.forEach(function (cb) { cb(err); });
}

function remoteTry(url, onPrompt, done) {
  var ws, finished = false, signed = true;
  var timer = setTimeout(function () { fail("no answer"); }, 4000);

  function fail(why) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    try { ws.close(); } catch (e) {}
    done(why);
  }

  function register(manifest) {
    var payload = { forcePairing: false, pairingType: "PROMPT", manifest: manifest };
    var key = null;
    try { key = localStorage.getItem(REMOTE_KEY); } catch (e) {}
    if (key) payload["client-key"] = key;
    ws.send(JSON.stringify({ id: "register", type: "register", payload: payload }));
  }

  try { ws = new WebSocket(url); } catch (e) { fail(String(e.message || e)); return; }
  ws.onerror = function () { fail("couldn't connect"); };
  ws.onopen = function () { register(REMOTE_MANIFEST); };
  ws.onclose = function () {
    if (!finished) { fail("connection closed"); return; }
    if (remote.ws === ws) {
      // We were connected and the TV dropped us: reconnect if anyone listens.
      remote.ready = false;
      remote.ws = null;
      remote.status = "disconnected, reconnecting";
      if (remote.subscriptions.length) setTimeout(function () { remoteConnect(null, resubscribe); }, 5000);
    }
  };
  ws.onmessage = function (event) {
    var msg;
    try { msg = JSON.parse(event.data); } catch (e) { return; }
    if (msg.id === "register") {
      if (msg.type === "error") {
        // Try once more without the signed part (newer TVs prefer that).
        if (signed) { signed = false; register(unsignedManifest()); return; }
        fail(msg.error || "refused");
      } else if (msg.type === "response" && msg.payload && msg.payload.pairingType === "PROMPT") {
        // The TV is showing "allow this device?". Give the person time to answer.
        clearTimeout(timer);
        timer = setTimeout(function () { fail("the TV's question wasn't answered"); }, 60000);
        onPrompt();
      } else if (msg.type === "registered") {
        try { localStorage.setItem(REMOTE_KEY, msg.payload["client-key"]); } catch (e) {}
        finished = true;
        clearTimeout(timer);
        remote.ws = ws;
        remote.url = url;
        remote.ready = true;
        done(null);
      }
      return;
    }
    var cb = remote.replies[msg.id];
    if (cb) cb(msg);
  };
}

// Ask the TV something once. done(message) gets the TV's reply.
function remoteRequest(uri, done) {
  if (!remote.ready) { done({ type: "error", error: "not connected" }); return; }
  var id = "req" + remote.nextId++;
  remote.replies[id] = function (msg) { delete remote.replies[id]; done(msg); };
  remote.ws.send(JSON.stringify({ id: id, type: "request", uri: uri }));
}

// Ask the TV to keep telling us about something. onUpdate gets every reply.
function remoteSubscribe(uri, onUpdate) {
  var sub = { uri: uri, onUpdate: onUpdate, id: "sub" + remote.nextId++ };
  remote.subscriptions.push(sub);
  sendSubscription(sub);
}

function sendSubscription(sub) {
  if (!remote.ready) return;
  remote.replies[sub.id] = sub.onUpdate;
  remote.ws.send(JSON.stringify({ id: sub.id, type: "subscribe", uri: sub.uri }));
}

function resubscribe(err) {
  if (!err) remote.subscriptions.forEach(sendSubscription);
}
