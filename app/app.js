// Remote control key codes on LG webOS.
var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 461, ESCAPE: 27 };

// Where your choices from the "+" screen are remembered on the TV.
var LAYOUT_KEY = "goblinMansion.layout";
var OLD_ADDED_KEY = "goblinMansion.addedApps"; // used before version 1.8
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

// ---------- Remembering your choices ----------

// The layout has two lists: built-in apps (from apps.js) you've hidden, and
// apps you've added from the "+" screen.
function loadLayout() {
  var layout = null;
  try { layout = JSON.parse(localStorage.getItem(LAYOUT_KEY)); } catch (e) {}
  if (!layout) {
    var added = [];
    try { added = JSON.parse(localStorage.getItem(OLD_ADDED_KEY)) || []; } catch (e) {}
    layout = { hidden: [], added: added };
  }
  return layout;
}

function saveLayout(layout) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch (e) {}
}

function builtInFor(id) {
  return APPS.filter(function (a) { return a.ids.indexOf(id) >= 0; })[0];
}

function isOnHomeRow(entry) {
  var layout = loadLayout();
  if (entry.builtIn) return layout.hidden.indexOf(entry.builtIn.name) < 0;
  return layout.added.some(function (a) { return a.id === entry.app.id; });
}

// Show the app if it's hidden, hide it if it's showing.
function toggleOnHomeRow(entry) {
  var layout = loadLayout();
  if (entry.builtIn) {
    var name = entry.builtIn.name;
    if (layout.hidden.indexOf(name) >= 0) layout.hidden = layout.hidden.filter(function (n) { return n !== name; });
    else layout.hidden.push(name);
  } else if (layout.added.some(function (a) { return a.id === entry.app.id; })) {
    layout.added = layout.added.filter(function (a) { return a.id !== entry.app.id; });
  } else {
    layout.added.push(entry.app);
  }
  saveLayout(layout);
  buildHomeRow();
}

// ---------- The home row ----------

function buildHomeRow() {
  var layout = loadLayout();
  apps = APPS.filter(function (a) { return layout.hidden.indexOf(a.name) < 0; });
  layout.added.forEach(function (a) {
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
  var note = document.getElementById("picker-note");
  grid.innerHTML = "";
  note.textContent = "Looking for your apps…";
  overlay.classList.add("open");

  // The built-in apps are always listed first, so they can be hidden too.
  APPS.forEach(function (app) {
    addPickerItem({ builtIn: app, app: { id: app.ids[0], name: app.name } });
  });
  setPickerFocus(0);

  discoverApps(function () {
    note.textContent = "Your TV is asking whether to allow a connection. Choose Allow, and your apps will appear here.";
  }, function (found) {
    if (!picker) return;
    found
      .filter(function (a) { return !builtInFor(a.id); })
      .sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (app) { addPickerItem({ app: app }); });
    note.textContent = found.length ? "" :
      "Your TV wouldn't share its list of apps right now. Try opening this screen again.";
  });
}

function addPickerItem(entry) {
  var item = document.createElement("div");
  item.className = "pick";
  var icon;
  if (entry.builtIn) {
    icon = makeTile(entry.builtIn.background);
    showImage(icon, entry.builtIn.logo, entry.builtIn.name.charAt(0), "");
  } else {
    var initial = entry.app.name.charAt(0);
    icon = makeTile(entry.app.color || "#3a2a4a");
    if (entry.app.icon) showImage(icon, entry.app.icon, initial, "tv-icon");
    else showName(icon, initial);
  }
  item.appendChild(icon);
  var label = document.createElement("span");
  label.textContent = entry.app.name;
  item.appendChild(label);
  entry.el = item;
  item.classList.toggle("picked", isOnHomeRow(entry));
  var index = picker.items.length;
  item.addEventListener("click", function () { pick(index); });
  item.addEventListener("mouseenter", function () { setPickerFocus(index); });
  document.getElementById("picker-grid").appendChild(item);
  picker.items.push(entry);
}

function pick(i) {
  var entry = picker.items[i];
  toggleOnHomeRow(entry);
  entry.el.classList.toggle("picked", isOnHomeRow(entry));
  setPickerFocus(i);
}

function setPickerFocus(i) {
  var items = picker.items;
  if (!items.length) return;
  if (items[picker.focus]) items[picker.focus].el.classList.remove("focused");
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

// Back twice to leave: the first press shows a hint, a second press within
// three seconds closes Goblin Mansion. (appinfo.json's disableBackHistoryAPI
// lets the launcher handle Back itself instead of the TV closing it.)
var backPressedAt = 0;

function handleBack() {
  if (picker) { closePicker(); return; }
  var now = Date.now();
  if (now - backPressedAt < 3000) {
    if (window.PalmSystem && PalmSystem.platformBack) PalmSystem.platformBack();
    else window.close();
    return;
  }
  backPressedAt = now;
  showStatus("Press Back again to leave Goblin Mansion");
}

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
    else if (k === KEY.BACK || k === KEY.ESCAPE) handleBack(); // Escape is for testing on a computer
    else return;
  } else {
    if (k === KEY.LEFT || k === KEY.UP) setFocus(focusIndex - 1);
    else if (k === KEY.RIGHT || k === KEY.DOWN) setFocus(focusIndex + 1);
    else if (k === KEY.OK) tiles[focusIndex].onSelect();
    else if (k >= 49 && k <= 57 && k - 49 < apps.length) launch(k - 49); // number keys
    else if (k === KEY.BACK || k === KEY.ESCAPE) handleBack();
    else return;
  }
  e.preventDefault();
});

buildHomeRow();
setFocus(0);
updateClock();
setInterval(updateClock, 10000);
