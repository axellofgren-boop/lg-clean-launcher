// Remote control key codes on LG webOS.
var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13 };

var tiles = [];
var focusIndex = 0;

// Draw one tile per app.
function buildTiles() {
  var container = document.getElementById("tiles");
  APPS.forEach(function (app, i) {
    var tile = document.createElement("div");
    tile.className = "tile";
    tile.style.background = app.background;
    if (app.logo) showImage(tile, app.logo, app.name, "");
    else showTvIcon(tile, app);
    tile.addEventListener("click", function () { launch(i); });
    tile.addEventListener("mouseenter", function () { setFocus(i); }); // Magic Remote pointer
    container.appendChild(tile);
    tiles.push(tile);
  });
  setFocus(0);
}

function showImage(tile, src, name, className) {
  var img = document.createElement("img");
  img.src = src;
  img.alt = name;
  img.className = className;
  img.onerror = function () { showName(tile, name); };
  tile.innerHTML = "";
  tile.appendChild(img);
}

function showName(tile, name) {
  tile.innerHTML = '<span class="name">' + name + "</span>";
}

// Ask the TV where an installed app keeps its icon, and use that.
function showTvIcon(tile, app) {
  showName(tile, app.name);
  callService("luna://com.webos.applicationManager/getAppInfo", { id: app.ids[0] }, function (res) {
    var info = res.returnValue && res.appInfo;
    var icon = info && (info.largeIcon || info.icon);
    if (!icon) return;
    if (icon.charAt(0) !== "/" && icon.indexOf("://") < 0) icon = info.folderPath + "/" + icon;
    if (icon.charAt(0) === "/") icon = "file://" + icon;
    showImage(tile, icon, app.name, "tv-icon");
  });
}

function setFocus(i) {
  tiles[focusIndex].classList.remove("focused");
  focusIndex = (i + tiles.length) % tiles.length;
  tiles[focusIndex].classList.add("focused");
}

// Ask the TV's Application Manager to open an app. This is the official
// webOS service call; PalmServiceBridge is how web apps talk to the TV.
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

// Try each known ID for the app until one works.
function launch(i) {
  var app = APPS[i];
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

var statusTimer;
function showStatus(text) {
  document.getElementById("status").textContent = text;
  clearTimeout(statusTimer);
  if (text) statusTimer = setTimeout(function () { showStatus(""); }, 5000);
}

function updateClock() {
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, "0");
  var mm = String(now.getMinutes()).padStart(2, "0");
  document.getElementById("clock").textContent = hh + ":" + mm;
}

document.addEventListener("keydown", function (e) {
  var k = e.keyCode;
  if (k === KEY.LEFT || k === KEY.UP) setFocus(focusIndex - 1);
  else if (k === KEY.RIGHT || k === KEY.DOWN) setFocus(focusIndex + 1);
  else if (k === KEY.OK) launch(focusIndex);
  else if (k >= 49 && k < 49 + APPS.length) launch(k - 49); // number keys 1-5
  else return;
  e.preventDefault();
});

buildTiles();
updateClock();
setInterval(updateClock, 10000);
