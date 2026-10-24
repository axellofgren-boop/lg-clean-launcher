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

// ---------- 2. The phone-remote connection (see remote.js) ----------

function fromRemoteConnection(onPrompt, done) {
  remoteConnect(onPrompt, function (err) {
    if (err) { logDiscovery("phone-remote connection", err); done([]); return; }
    remoteRequest("ssap://com.webos.applicationManager/listLaunchPoints", function (msg) {
      var points = msg.payload && msg.payload.launchPoints;
      logDiscovery("phone-remote connection (" + remote.url + ")", points ? "found " + points.length : (msg.error || "no list in reply"));
      done((points || []).map(function (p) {
        return { id: p.id, name: p.title, icon: p.largeIcon || p.icon || "", color: p.bgColor };
      }));
    });
  });
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
