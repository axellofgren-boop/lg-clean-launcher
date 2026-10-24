// Remote control key codes on LG webOS.
var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13 };

// Where the apps you add with the "+" tile are remembered on the TV.
var STORAGE_KEY = "goblinMansion.addedApps";
var SELF_ID = "com.julia.cleanlauncher";

var apps = [];       // everything shown on the home row, including added apps
var tiles = [];      // the tile elements currently on screen
var focusIndex = 0;
var picker = null;   // the "add an app" screen, while it's open

// ---------- Talking to the TV ----------

// Ask a TV service to do something. PalmServiceBridge is how webOS web apps
// talk to the TV; the reply comes back as JSON.
function callService(uri, params, done) {
  if (typeof PalmServiceBridge === "undefined") {
    done({ returnValue: false, errorText: "Not running on a TV" });
    return;
  }
  var bridge = new PalmServiceBridge();
  bridge.onservicecallback = function (msg) {
    done(JSON.parse(msg));
    bridge.cancel && bridge.cancel();
  };
  bridge.call(uri, JSON.stringify(params));
}

// Turn an icon path from the TV into something an <img> can load.
function iconUrl(icon, folderPath) {
  if (!icon) return "";
  if (icon.charAt(0) !== "/" && icon.indexOf("://") < 0 && folderPath) icon = folderPath + "/" + icon;
  if (icon.charAt(0) === "/") icon = "file://" + icon;
  return icon;
}

// Get every app installed on the TV. LG doesn't officially offer this to
// apps, so we try every known way in turn and note what the TV answered.
var LIST_CALLS = [
  ["luna://com.webos.applicationManager/listLaunchPoints", "launchPoints"],
  ["luna://com.webos.service.applicationmanager/listLaunchPoints", "launchPoints"],
  ["luna://com.webos.applicationManager/listApps", "apps"],
  ["luna://com.webos.service.applicationmanager/listApps", "apps"],
  ["palm://com.palm.applicationManager/listLaunchPoints", "launchPoints"]
];

// What the TV said for each try, shown on screen if everything fails.
var listReplies = [];

function describeReply(uri, res) {
  var short = uri.replace(/^[a-z]+:\/\//, "");
  return short + " → " + (res.errorText || res.errorCode || "no list in reply");
}

function listInstalledApps(done) {
  listReplies = [];
  tryListCall(0, done);
}

function tryListCall(n, done) {
  if (n >= LIST_CALLS.length) { checkKnownApps(done); return; }
  var uri = LIST_CALLS[n][0], key = LIST_CALLS[n][1];
  callService(uri, {}, function (res) {
    var list = res.returnValue && res[key];
    if (!list) {
      listReplies.push(describeReply(uri, res));
      tryListCall(n + 1, done);
      return;
    }
    done(list.filter(function (a) { return a.visible !== false; }).map(function (a) {
      return { id: a.id, name: a.title, icon: iconUrl(a.largeIcon || a.icon, a.folderPath), color: a.bgColor };
    }), "full");
  });
}

// Backup plan: ask about each app in known-apps.js with the official
// getAppLoadStatus call, and keep the ones the TV says are installed.
function checkKnownApps(done) {
  var found = [];
  var pending = 0;
  var firstReply = null;
  KNOWN_APPS.forEach(function (app) {
    app.ids.forEach(function (id) {
      pending++;
      callService("luna://com.webos.applicationManager/getAppLoadStatus", { appId: id }, function (res) {
        if (!firstReply) firstReply = res;
        if (res.returnValue && (res.exist || res.installed) &&
            !found.some(function (f) { return f.name === app.name; })) {
          found.push({ id: id, name: app.name, icon: "", color: app.color });
        }
        if (--pending === 0) finish();
      });
    });
  });

  function finish() {
    if (found.length) { done(found, "known"); return; }
    listReplies.push(describeReply("getAppLoadStatus", firstReply || {}) +
      (firstReply && firstReply.returnValue ? " " + JSON.stringify(firstReply) : ""));
    done(null);
  }
}

// ---------- Remembering added apps ----------

function loadAddedApps() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { return []; }
}

function saveAddedApps(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
}

function isOnHomeRow(id) {
  return apps.some(function (a) { return a.ids.indexOf(id) >= 0; });
}

// Add the app if it isn't there yet, remove it if it is (only apps added
// with "+" can be removed; the five built-in ones always stay).
function toggleAddedApp(app) {
  var added = loadAddedApps();
  var existing = added.filter(function (a) { return a.id === app.id; })[0];
  if (existing) added = added.filter(function (a) { return a.id !== app.id; });
  else added.push(app);
  saveAddedApps(added);
  buildHomeRow();
}

// ---------- The home row ----------

function buildHomeRow() {
  apps = APPS.slice();
  loadAddedApps().forEach(function (a) {
    apps.push({ name: a.name, ids: [a.id], tvIcon: a.icon, background: a.color || "#3a2a4a", added: true });
  });

  var container = document.getElementById("tiles");
  container.innerHTML = "";
  // Shrink the tiles a bit when there are many, so they fit on one row.
  var count = apps.length + 1;
  var gap = count > 6 ? 36 : 48;
  var size = Math.max(180, Math.min(300, Math.floor((1800 - gap * (count - 1)) / count)));
  container.style.gap = gap + "px";
  container.style.setProperty("--tile", size + "px");
  tiles = [];

  apps.forEach(function (app, i) {
    var tile = makeTile(app.background);
    if (app.logo) showImage(tile, app.logo, app.name, "");
    else if (app.tvIcon) showImage(tile, app.tvIcon, app.name, "tv-icon");
    else showName(tile, app.name);
    addTile(container, tile, function () { launch(i); });
  });

  var plus = makeTile("");
  plus.classList.add("plus");
  plus.innerHTML = '<span class="plus-sign">+</span>';
  addTile(container, plus, openPicker);

  setFocus(Math.min(focusIndex, tiles.length - 1));
}

function makeTile(background) {
  var tile = document.createElement("div");
  tile.className = "tile";
  if (background) tile.style.background = background;
  return tile;
}

function addTile(container, tile, onSelect) {
  var i = tiles.length;
  tile.onSelect = onSelect;
  tile.addEventListener("click", onSelect);
  tile.addEventListener("mouseenter", function () { setFocus(i); }); // Magic Remote pointer
  container.appendChild(tile);
  tiles.push(tile);
}

// Show a picture on a tile; if it won't load, show the fallback text instead.
function showImage(tile, src, fallback, className) {
  var img = document.createElement("img");
  img.src = src;
  img.alt = fallback;
  img.className = className;
  img.onerror = function () { showName(tile, fallback); };
  tile.innerHTML = "";
  tile.appendChild(img);
}

function showName(tile, name) {
  tile.innerHTML = '<span class="name">' + name + "</span>";
}

function setFocus(i) {
  if (tiles[focusIndex]) tiles[focusIndex].classList.remove("focused");
  focusIndex = (i + tiles.length) % tiles.length;
  tiles[focusIndex].classList.add("focused");
}

// Try each known ID for the app until one works.
function launch(i) {
  var app = apps[i];
  setFocus(i);
  showStatus("Opening " + app.name + "…");

  function attempt(n) {
    if (n >= app.ids.length) {
      showStatus("Couldn't open " + app.name + ". Is it installed?");
      return;
    }
    callService("luna://com.webos.applicationManager/launch", { id: app.ids[n] }, function (res) {
      if (res.returnValue) showStatus("");
      else attempt(n + 1);
    });
  }
  attempt(0);
}

// ---------- The "add an app" screen ----------

function openPicker() {
  picker = { items: [], focus: 0 };
  var overlay = document.getElementById("picker");
  var grid = document.getElementById("picker-grid");
  grid.innerHTML = '<p class="picker-note">Looking for your apps…</p>';
  overlay.classList.add("open");
  history.pushState({ picker: true }, ""); // so the Back button closes this screen

  listInstalledApps(function (installed, how) {
    if (!picker) return;
    if (!installed) {
      grid.innerHTML = '<p class="picker-note">Your TV wouldn\'t share its list of apps.<br>' +
        "Take a photo of this screen and send it to Claude, so it can see what the TV said:</p>" +
        '<pre class="picker-details"></pre>';
      grid.querySelector(".picker-details").textContent = listReplies.join("\n");
      return;
    }
    grid.innerHTML = "";
    document.querySelector(".picker-help").textContent = how === "known"
      ? "Your TV keeps its full list private, so these are the apps Claude knew how to look for. Press OK to add or remove one, and Back when you're done."
      : "Press OK to add or remove an app. Press Back when you're done.";
    installed
      .filter(function (a) { return a.id !== SELF_ID; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (app) {
        var item = document.createElement("div");
        item.className = "pick";
        var icon = makeTile(app.color || "#3a2a4a");
        var initial = app.name.charAt(0);
        if (app.icon) showImage(icon, app.icon, initial, "tv-icon");
        else showName(icon, initial);
        item.appendChild(icon);
        var label = document.createElement("span");
        label.textContent = app.name;
        item.appendChild(label);
        markPicked(item, app);
        var index = picker.items.length;
        item.addEventListener("click", function () { pick(index); });
        item.addEventListener("mouseenter", function () { setPickerFocus(index); });
        grid.appendChild(item);
        picker.items.push({ el: item, app: app });
      });
    setPickerFocus(0);
  });
}

function markPicked(item, app) {
  item.classList.toggle("picked", isOnHomeRow(app.id));
}

function pick(i) {
  var entry = picker.items[i];
  var builtIn = APPS.some(function (a) { return a.ids.indexOf(entry.app.id) >= 0; });
  if (builtIn) return;
  toggleAddedApp(entry.app);
  markPicked(entry.el, entry.app);
  setPickerFocus(i);
}

function setPickerFocus(i) {
  var items = picker.items;
  if (!items.length) return;
  items[picker.focus].el.classList.remove("focused");
  picker.focus = Math.max(0, Math.min(items.length - 1, i));
  var el = items[picker.focus].el;
  el.classList.add("focused");
  el.scrollIntoView({ block: "nearest" });
}

function pickerColumns() {
  var items = picker.items;
  if (items.length < 2) return 1;
  var top = items[0].el.offsetTop;
  for (var i = 1; i < items.length; i++) if (items[i].el.offsetTop !== top) return i;
  return items.length;
}

function closePicker() {
  if (!picker) return;
  picker = null;
  document.getElementById("picker").classList.remove("open");
  setFocus(tiles.length - 1);
}

window.addEventListener("popstate", closePicker);

// ---------- Status line and clock ----------

var statusTimer;
function showStatus(text) {
  document.getElementById("status").textContent = text;
  clearTimeout(statusTimer);
  if (text) statusTimer = setTimeout(function () { showStatus(""); }, 5000);
}

var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

// The greeting above "Goblin Mansion" changes with the time of day.
function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return "Good morning! Welcome to";
  if (hour >= 12 && hour < 18) return "Good afternoon! Welcome to";
  if (hour >= 18 && hour < 23) return "Good evening! Welcome to";
  return "Up late? Welcome to";
}

function updateClock() {
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, "0");
  var mm = String(now.getMinutes()).padStart(2, "0");
  document.getElementById("time").textContent = hh + ":" + mm;
  document.getElementById("date").textContent =
    DAYS[now.getDay()] + " " + now.getDate() + " " + MONTHS[now.getMonth()];
  document.getElementById("greeting").textContent = greetingFor(now.getHours());
}

// ---------- Remote control ----------

document.addEventListener("keydown", function (e) {
  var k = e.keyCode;
  if (picker) {
    var cols = pickerColumns();
    if (k === KEY.LEFT) setPickerFocus(picker.focus - 1);
    else if (k === KEY.RIGHT) setPickerFocus(picker.focus + 1);
    else if (k === KEY.UP) setPickerFocus(picker.focus - cols);
    else if (k === KEY.DOWN) setPickerFocus(picker.focus + cols);
    else if (k === KEY.OK && picker.items.length) pick(picker.focus);
    else if (k === 27) history.back(); // Escape, for testing on a computer
    else return;
  } else {
    if (k === KEY.LEFT || k === KEY.UP) setFocus(focusIndex - 1);
    else if (k === KEY.RIGHT || k === KEY.DOWN) setFocus(focusIndex + 1);
    else if (k === KEY.OK) tiles[focusIndex].onSelect();
    else if (k >= 49 && k <= 57 && k - 49 < apps.length) launch(k - 49); // number keys
    else return;
  }
  e.preventDefault();
});

buildHomeRow();
setFocus(0);
updateClock();
setInterval(updateClock, 10000);
