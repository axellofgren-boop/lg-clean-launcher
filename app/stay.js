// "Stay in Goblin Mansion": when you leave an app you opened from here
// (Netflix, YouTube…) and the TV goes to LG's own home screen, Goblin
// Mansion brings itself back to the front.
//
// Ways out to the real LG home screen, in case you need it:
//   - Press Back twice on the Goblin Mansion screen.
//   - Press Home twice in a row (the first time Goblin Mansion comes back,
//     the second time within 20 seconds it lets you through).
//
// To notice which app is on screen, Goblin Mansion asks the TV to tell it
// whenever the foreground app changes, either through the app manager or
// through the TV's phone-remote connection (see discover.js).

var stay = {
  armed: false,      // true after you open an app from Goblin Mansion
  lastBounce: 0,     // when we last brought ourselves back
  how: "not started",
  bridge: null,
  socket: null
};

function isLgHome(appId) {
  return !appId || /^com\.webos\.app\.(home|homeconnect|launcher)/.test(appId);
}

function onForegroundApp(appId) {
  if (appId === SELF_ID || !stay.armed || !isLgHome(appId)) return;
  var now = Date.now();
  if (now - stay.lastBounce < 20000) {
    // Home again right after we came back: you really want LG's home screen.
    stay.armed = false;
    return;
  }
  stay.lastBounce = now;
  stay.armed = false;
  callService("luna://com.webos.applicationManager/launch", { id: SELF_ID }, function () {});
}

// Called by app.js whenever Goblin Mansion opens another app.
function armStay() { stay.armed = true; }

// Called when you leave with Back twice: don't pull you back.
function disarmStay() { stay.armed = false; }

// 1. Ask the app manager to keep us posted.
function watchWithAppManager(failed) {
  if (typeof PalmServiceBridge === "undefined") { failed("not on a TV"); return; }
  var first = true;
  stay.bridge = new PalmServiceBridge(); // kept, so the subscription stays alive
  stay.bridge.onservicecallback = function (msg) {
    var res = {};
    try { res = JSON.parse(msg); } catch (e) {}
    if (first) {
      first = false;
      if (!res.returnValue) { failed(res.errorText || "refused"); return; }
      stay.how = "app manager";
    }
    if (res.appId !== undefined) onForegroundApp(res.appId);
  };
  stay.bridge.call("luna://com.webos.applicationManager/getForegroundAppInfo", JSON.stringify({ subscribe: true }));
}

// 2. Ask through the phone-remote connection, using the key saved when the
// TV said "Allow" on the Your apps screen.
function watchWithRemote(urls, failed) {
  var key = null;
  try { key = localStorage.getItem(REMOTE_KEY); } catch (e) {}
  if (!key) { failed("not allowed yet (open + once and choose Allow)"); return; }
  if (!urls.length) { failed("couldn't connect"); return; }
  var ws;
  try { ws = new WebSocket(urls[0]); } catch (e) { watchWithRemote(urls.slice(1), failed); return; }
  var connected = false;
  ws.onopen = function () {
    ws.send(JSON.stringify({ id: "register", type: "register",
      payload: { forcePairing: false, pairingType: "PROMPT", manifest: REMOTE_MANIFEST, "client-key": key } }));
  };
  ws.onmessage = function (event) {
    var msg;
    try { msg = JSON.parse(event.data); } catch (e) { return; }
    if (msg.type === "registered") {
      connected = true;
      stay.socket = ws;
      stay.how = "phone-remote connection";
      ws.send(JSON.stringify({ id: "fg", type: "subscribe", uri: "ssap://com.webos.applicationManager/getForegroundAppInfo" }));
    } else if (msg.id === "fg" && msg.payload && msg.payload.appId !== undefined) {
      onForegroundApp(msg.payload.appId);
    }
  };
  ws.onclose = function () {
    if (connected) setTimeout(startStaying, 5000); // reconnect if the TV dropped us
    else watchWithRemote(urls.slice(1), failed);
  };
}

function startStaying() {
  watchWithAppManager(function (why) {
    stay.how = "app manager: " + why;
    watchWithRemote(REMOTE_URLS.slice(), function (why2) {
      stay.how += " · phone-remote connection: " + why2;
    });
  });
}

startStaying();
