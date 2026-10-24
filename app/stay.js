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
  watching: false,   // true once the TV is telling us about app changes
  starting: false,
  bridge: null,
  seen: []           // the last few apps the TV reported, for the report
};

function isLgHome(appId) {
  return !appId || /^com\.webos\.app\.(home|launcher)/.test(appId);
}

function onForegroundApp(appId) {
  stay.seen.push(appId || "(nothing)");
  if (stay.seen.length > 6) stay.seen.shift();
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
      stay.watching = true;
    }
    if (res.appId !== undefined) onForegroundApp(res.appId);
  };
  stay.bridge.call("luna://com.webos.applicationManager/getForegroundAppInfo", JSON.stringify({ subscribe: true }));
}

// 2. Ask through the phone-remote connection (remote.js), using the key
// saved when the TV said "Allow" on the Your apps screen.
function watchWithRemote(failed) {
  if (!hasRemoteKey()) { failed("not allowed yet (open + once and choose Allow)"); return; }
  remoteConnect(null, function (err) {
    if (err) { failed(err); return; }
    stay.how = "phone-remote connection";
    stay.watching = true;
    remoteSubscribe("ssap://com.webos.applicationManager/getForegroundAppInfo", function (msg) {
      if (msg.type === "error") { stay.how = "phone-remote connection: " + (msg.error || "refused"); return; }
      if (msg.payload && msg.payload.appId !== undefined) onForegroundApp(msg.payload.appId);
    });
  });
}

function startStaying() {
  if (stay.watching || stay.starting) return;
  stay.starting = true;
  watchWithAppManager(function (why) {
    stay.how = "app manager: " + why;
    watchWithRemote(function (why2) {
      stay.how += " · phone-remote connection: " + why2;
      stay.starting = false;
    });
  });
}

// One line for the report at the bottom of the Your apps screen.
function stayReport() {
  return "stay in Goblin Mansion → " + stay.how + (stay.armed ? " (armed)" : "") +
    "\napps the TV reported → " + (stay.seen.length ? stay.seen.join(", ") : "none yet");
}

startStaying();
