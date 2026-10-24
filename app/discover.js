// Finding out which apps are installed on the TV, and their icons.
//
// LG doesn't give apps an official "list everything" call, so we try several
// ways and combine whatever works:
//   1. Ask the TV's app manager directly (usually refused on newer TVs).
//   2. Ask the TV through its own phone-remote connection (the same one LG's
//      ThinQ app uses). The TV pops up "allow this device?" the first time.
//   3. Look in the folder where the TV keeps apps from the LG store.
//   4. Ask "is this app installed?" for every app in known-apps.js.
// Every attempt writes a line to discoveryLog, shown at the bottom of the
// "+" screen, so we can see what worked.

var discoveryLog = [];

function logDiscovery(how, result) {
  discoveryLog.push(how + " → " + result);
}

// Turn an icon path from the TV into something an <img> can load.
function iconUrl(icon, folderPath) {
  if (!icon) return "";
  if (icon.charAt(0) !== "/" && icon.indexOf("://") < 0 && folderPath) icon = folderPath + "/" + icon;
  if (icon.charAt(0) === "/") icon = "file://" + icon;
  return icon;
}

function errorOf(res) {
  return res.errorText || res.errorCode || "no list in reply";
}

// ---------- 1. The app manager ----------

var LIST_CALLS = [
  ["luna://com.webos.applicationManager/listLaunchPoints", "launchPoints"],
  ["luna://com.webos.service.applicationmanager/listLaunchPoints", "launchPoints"],
  ["luna://com.webos.applicationManager/listApps", "apps"],
  ["luna://com.webos.service.applicationmanager/listApps", "apps"]
];

function fromAppManager(done) {
  (function next(n) {
    if (n >= LIST_CALLS.length) { done([]); return; }
    var uri = LIST_CALLS[n][0], key = LIST_CALLS[n][1];
    callService(uri, {}, function (res) {
      var list = res.returnValue && res[key];
      var name = uri.replace("luna://", "");
      if (!list) { logDiscovery(name, errorOf(res)); next(n + 1); return; }
      logDiscovery(name, "found " + list.length);
      done(list.filter(function (a) { return a.visible !== false; }).map(function (a) {
        return { id: a.id, name: a.title, icon: iconUrl(a.largeIcon || a.icon, a.folderPath), color: a.bgColor };
      }));
    });
  })(0);
}

// ---------- 2. The phone-remote connection ----------

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

// ws://127.0.0.1:3000 is the one that answered on Julia's TV, so it goes first.
var REMOTE_URLS = ["ws://127.0.0.1:3000", "wss://127.0.0.1:3001", "ws://localhost:3000", "wss://localhost:3001"];
var REMOTE_KEY = "goblinMansion.remoteKey";

// Newer TVs reject the signed manifest; LG's own apps then retry unsigned.
function unsignedManifest() {
  var m = JSON.parse(JSON.stringify(REMOTE_MANIFEST));
  delete m.signed;
  m.appVersion = "1.0";
  return m;
}

function fromRemoteConnection(onPrompt, done) {
  if (typeof WebSocket === "undefined") { logDiscovery("remote connection", "no WebSocket"); done([]); return; }
  (function next(n) {
    if (n >= REMOTE_URLS.length) { done([]); return; }
    tryRemote(REMOTE_URLS[n], onPrompt, function (list) {
      if (list) done(list); else next(n + 1);
    });
  })(0);
}

function tryRemote(url, onPrompt, done) {
  var finished = false;
  var ws;
  var timer = setTimeout(function () { finish(null, "no answer"); }, 4000);

  function finish(list, why) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    logDiscovery(url, list ? "found " + list.length : why);
    try { ws.close(); } catch (e) {}
    done(list);
  }

  function register(manifest) {
    var payload = { forcePairing: false, pairingType: "PROMPT", manifest: manifest };
    var key = null;
    try { key = localStorage.getItem(REMOTE_KEY); } catch (e) {}
    if (key) payload["client-key"] = key;
    ws.send(JSON.stringify({ id: "register", type: "register", payload: payload }));
  }

  try { ws = new WebSocket(url); } catch (e) { finish(null, String(e.message || e)); return; }
  var signed = true;
  ws.onerror = function () { finish(null, "couldn't connect"); };
  ws.onclose = function () { finish(null, "connection closed"); };
  ws.onopen = function () { register(REMOTE_MANIFEST); };
  ws.onmessage = function (event) {
    var msg;
    try { msg = JSON.parse(event.data); } catch (e) { return; }
    if (msg.id === "register") {
      if (msg.type === "error") {
        if (signed && /certificate/i.test(msg.error || "")) { signed = false; register(unsignedManifest()); return; }
        finish(null, msg.error || "refused");
      } else if (msg.type === "response" && msg.payload && msg.payload.pairingType === "PROMPT") {
        // The TV is showing "allow this device?". Give the person time to answer.
        clearTimeout(timer);
        timer = setTimeout(function () { finish(null, "the TV's question wasn't answered"); }, 60000);
        onPrompt();
      } else if (msg.type === "registered") {
        try { localStorage.setItem(REMOTE_KEY, msg.payload["client-key"]); } catch (e) {}
        ws.send(JSON.stringify({ id: "apps", type: "request", uri: "ssap://com.webos.applicationManager/listLaunchPoints" }));
      }
    } else if (msg.id === "apps") {
      var points = msg.payload && msg.payload.launchPoints;
      if (!points) { finish(null, msg.error || "no list in reply"); return; }
      finish(points.map(function (p) {
        return { id: p.id, name: p.title, icon: p.largeIcon || p.icon || "", color: p.bgColor };
      }));
    }
  };
}

// ---------- 3. The LG store apps folder ----------

var STORE_FOLDER = "file:///media/cryptofs/apps/usr/palm/applications/";

function readFile(url, done) {
  var xhr = new XMLHttpRequest();
  try {
    xhr.open("GET", url);
    xhr.onload = function () { done(xhr.status === 0 || xhr.status === 200 ? xhr.responseText : null); };
    xhr.onerror = function () { done(null); };
    xhr.send();
  } catch (e) { done(null); }
}

// Read an app's own appinfo.json to learn its name and icon.
function readAppInfo(folder, done) {
  readFile(folder + "appinfo.json", function (text) {
    var info = null;
    try { info = JSON.parse(text); } catch (e) {}
    if (!info) { done(null); return; }
    var path = folder.replace("file://", "");
    done({ id: info.id, name: info.title, icon: iconUrl(info.largeIcon || info.icon, path), color: info.bgColor });
  });
}

function fromStoreFolder(done) {
  readFile(STORE_FOLDER, function (html) {
    var ids = [];
    var re = /addRow\("([^"]+)"/g, m;
    while (html && (m = re.exec(html))) if (m[1] !== "..") ids.push(m[1]);
    if (!ids.length) { logDiscovery("store apps folder", html ? "empty" : "not readable"); done([]); return; }
    var found = [], pending = ids.length;
    ids.forEach(function (id) {
      readAppInfo(STORE_FOLDER + id + "/", function (app) {
        if (app && app.name) found.push(app);
        if (--pending === 0) { logDiscovery("store apps folder", "found " + found.length); done(found); }
      });
    });
  });
}

// ---------- 4. Asking about known apps one by one ----------

function fromKnownApps(done) {
  var found = [], pending = 0, firstError = null;
  KNOWN_APPS.forEach(function (app) {
    app.ids.forEach(function (id) {
      pending++;
      callService("luna://com.webos.applicationManager/getAppLoadStatus", { appId: id }, function (res) {
        if (!res.returnValue && !firstError) firstError = errorOf(res);
        if (res.returnValue && (res.exist || res.installed) &&
            !found.some(function (f) { return f.name === app.name; })) {
          found.push({ id: id, name: app.name, icon: "", color: app.color });
        }
        if (--pending === 0) {
          logDiscovery("known apps", firstError && !found.length ? firstError : "found " + found.length);
          done(found);
        }
      });
    });
  });
}

// ---------- Icons ----------

// Find an icon for an app we only know the ID of. Tries the app manager,
// then the app's own folder (store apps first, then the TV's built-in apps).
function findIcon(id, done) {
  callService("luna://com.webos.applicationManager/getAppInfo", { id: id }, function (res) {
    var info = res.returnValue && res.appInfo;
    var icon = info && iconUrl(info.largeIcon || info.icon, info.folderPath);
    if (icon) { done(icon, "app manager"); return; }
    readAppInfo(STORE_FOLDER + id + "/", function (app) {
      if (app && app.icon) { done(app.icon, "store folder"); return; }
      readAppInfo("file:///usr/palm/applications/" + id + "/", function (sys) {
        done(sys && sys.icon ? sys.icon : "", sys && sys.icon ? "system folder" : errorOf(res));
      });
    });
  });
}

// ---------- Putting it together ----------

// Runs every way at once and merges what they find (by app ID).
// onPrompt is called if the TV shows its "allow this device?" question.
function discoverApps(onPrompt, done) {
  discoveryLog = [];
  var results = {};
  var ways = [fromAppManager, function (cb) { fromRemoteConnection(onPrompt, cb); }, fromStoreFolder, fromKnownApps];
  var pending = ways.length;
  ways.forEach(function (way) {
    way(function (list) {
      list.forEach(function (app) {
        if (!app.id || app.id === SELF_ID) return;
        var known = results[app.id];
        if (!known) results[app.id] = app;
        else if (!known.icon && app.icon) known.icon = app.icon;
      });
      if (--pending === 0) finishDiscovery();
    });
  });

  function finishDiscovery() {
    var list = Object.keys(results).map(function (id) { return results[id]; });
    var missing = list.filter(function (a) { return !a.icon; });
    var left = missing.length;
    if (!left) { done(list); return; }
    var iconWays = {};
    missing.forEach(function (app) {
      findIcon(app.id, function (icon, how) {
        if (icon) app.icon = icon;
        iconWays[how] = (iconWays[how] || 0) + 1;
        if (--left === 0) {
          logDiscovery("icons", Object.keys(iconWays).map(function (k) { return k + " ×" + iconWays[k]; }).join(", "));
          done(list);
        }
      });
    });
  }
}
