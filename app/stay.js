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
  current: "",       // the app on screen right now, as far as we know
  lastAction: "",
  how: "not started",
  watching: false,   // true once the TV is telling us about app changes
  starting: false,
  bridge: null,
  seen: []           // the last few apps the TV reported, for the report
};

// While switching apps the TV briefly reports "nothing"; that isn't the home
// screen, so it's ignored.
function isLgHome(appId) {
  return /^com\.webos\.app\.(home|launcher)/.test(appId || "");
}

function onForegroundApp(appId) {
  stay.seen.push(appId || "(nothing)");
  if (stay.seen.length > 6) stay.seen.shift();
  stay.current = appId;
  if (!stay.armed || !isLgHome(appId)) return;
  // Only pull you back once per app you opened from here, so pressing Home
  // on Goblin Mansion itself still takes you to LG's home screen.
  stay.armed = false;
  stay.lastAction = "bringing Goblin Mansion back";
  // Wait a moment so LG's home screen has finished opening, then come back.
  // If it's still on screen two seconds later, try once more.
  setTimeout(function () {
    bringBack(function () {
      setTimeout(function () {
        if (!isLgHome(stay.current)) return;
        // Still on LG's home: try the app manager as well.
        callService("luna://com.webos.applicationManager/launch", { id: SELF_ID }, function (res) {
          stay.lastAction += " · then app manager: " + (res.returnValue ? "accepted" : (res.errorText || "refused")) +
            (stay.relaunched ? " (relaunch seen)" : "");
        });
      }, 2000);
    });
  }, 800);
}

// When an app that's already running (in the background) is "launched"
// again, webOS doesn't show it by itself: it sends the app a webOSRelaunch
// event, and the app asks to be shown with PalmSystem.activate(). We ask
// right away and once more half a second later, in case the TV was busy.
function activateSelf() {
  if (!window.PalmSystem || !PalmSystem.activate) return;
  PalmSystem.activate();
  setTimeout(function () { PalmSystem.activate(); }, 500);
}

document.addEventListener("webOSRelaunch", function () {
  activateSelf();
  stay.relaunched = true;
});

// Ask the TV to put Goblin Mansion in front. On Julia's TV the app manager
// accepts the request but leaves LG's home on top, so the phone-remote
// connection's "launch" command (what a phone remote uses to switch apps,
// which the TV treats like a button press) goes first.
function bringBack(done) {
  stay.relaunched = false;
  if (remote.ready) {
    remoteRequest("ssap://system.launcher/launch", function (msg) {
      stay.lastAction = "phone-remote launch: " + (msg.type === "error" ? (msg.error || "refused") : "accepted");
      done();
    }, { id: SELF_ID });
    return;
  }
  callService("luna://com.webos.applicationManager/launch", { id: SELF_ID }, function (res) {
    stay.lastAction = "app manager launch: " + (res.returnValue ? "accepted" : (res.errorText || "refused"));
    done();
  });
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
    (stay.lastAction ? " · last: " + stay.lastAction : "") +
    "\napps the TV reported → " + (stay.seen.length ? stay.seen.join(", ") : "none yet");
}

startStaying();
