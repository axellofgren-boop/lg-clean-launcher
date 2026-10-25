// The moving background: sun, stars, clouds, rain, snow or fog, depending on
// the weather in Copenhagen. weather.js calls setSky() whenever it updates.
// The sun also moves with the time of day: it rises on the left in the
// morning, sits high in the afternoon, sets on the right in the evening, and
// becomes a moon at night.
// For testing on a computer, add ?scene=rain&time=evening to the address.

var SKY_W = 1920, SKY_H = 1080;
var skyCanvas = document.getElementById("sky");
var skyCtx = skyCanvas.getContext("2d");

// Background colours for each scene, top to bottom. They all stay in the
// Goblin Mansion pink/purple family so the logos still stand out.
var SKY_COLORS = {
  "clear-morning":   ["#7d4c7a", "#4a2a5c", "#1c1428"],
  "clear-afternoon": ["#6e3b6e", "#3a1f4f", "#1a1226"],
  "clear-evening":   ["#4f2457", "#33173f", "#2a1220"],
  "clear-night":     ["#1c1747", "#120f2e", "#0a0814"],
  "cloudy":          ["#463e58", "#2a2338", "#14111c"],
  "cloudy-night":    ["#2a2540", "#1a1628", "#0c0a12"],
  "rain":            ["#2a2d52", "#1a1a36", "#0c0b18"],
  "thunder":         ["#241f44", "#16132c", "#0a0814"],
  "snow":            ["#57527a", "#342f4f", "#1a1728"],
  "fog":             ["#4d4560", "#2e283d", "#16131e"]
};

// Where the sun sits, how big it is and its colours (centre, edge, glow).
var SUNS = {
  morning:   { x: 270,  y: 380, r: 62, core: "#fff0d6", edge: "#ffb38a", glow: "255, 170, 150", glowSize: 520 },
  afternoon: { x: 1450, y: 200, r: 58, core: "#fffbe8", edge: "#ffd36e", glow: "255, 200, 140", glowSize: 650 },
  evening:   { x: 1660, y: 390, r: 82, core: "#ffc890", edge: "#ff5f6d", glow: "255, 100, 120", glowSize: 700 },
  night:     { x: 1450, y: 200, r: 50 }
};

// Same times of day as the greeting in app.js.
function timeOfDay(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

var sky = { scene: "clear", time: "afternoon", lockScene: false, lockTime: false, bg: null, clouds: [], bits: [], flash: 0, nextFlash: 0 };

function isNight() { return sky.time === "night"; }
function sunShows() { return sky.scene === "clear" || sky.scene === "partly"; }

function skyKey() {
  if (sunShows()) return "clear-" + sky.time;
  if (sky.scene === "cloudy" && isNight()) return "cloudy-night";
  return sky.scene;
}

function rand(a, b) { return a + Math.random() * (b - a); }

// Paint the parts that don't move once, so each frame is cheap for the TV.
function paintBackground() {
  var c = document.createElement("canvas");
  c.width = SKY_W; c.height = SKY_H;
  var g = c.getContext("2d");
  var colors = SKY_COLORS[skyKey()];
  var grad = g.createLinearGradient(0, 0, 0, SKY_H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.5, colors[1]);
  grad.addColorStop(1, colors[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, SKY_W, SKY_H);

  paintSun(g);
  return c;
}

// The sun (or moon). In clear or partly cloudy weather it's a proper disc
// with a glow; behind thick clouds you only see a faint brighter patch.
function paintSun(g) {
  var sun = SUNS[sky.time];
  var bright = sunShows();
  if (sky.time === "night") {
    if (bright) paintMoon(g, sun);
    return;
  }
  var glow = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sun.glowSize);
  glow.addColorStop(0, "rgba(" + sun.glow + "," + (bright ? 0.55 : 0.18) + ")");
  glow.addColorStop(1, "rgba(" + sun.glow + ",0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, SKY_W, SKY_H);
  if (!bright) return;

  // A warm glow along the bottom of the screen at sunset.
  if (sky.time === "evening") {
    var horizon = g.createLinearGradient(0, SKY_H * 0.55, 0, SKY_H);
    horizon.addColorStop(0, "rgba(255, 110, 110, 0)");
    horizon.addColorStop(1, "rgba(255, 110, 110, 0.28)");
    g.fillStyle = horizon;
    g.fillRect(0, 0, SKY_W, SKY_H);
  }

  var disc = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sun.r);
  disc.addColorStop(0, sun.core);
  disc.addColorStop(0.7, sun.core);
  disc.addColorStop(1, sun.edge);
  g.fillStyle = disc;
  g.beginPath();
  g.arc(sun.x, sun.y, sun.r, 0, Math.PI * 2);
  g.fill();
}

// A crescent moon: a pale circle with a bite taken out of it.
function paintMoon(g, moon) {
  var glow = g.createRadialGradient(moon.x, moon.y, 0, moon.x, moon.y, 380);
  glow.addColorStop(0, "rgba(220, 210, 255, 0.3)");
  glow.addColorStop(1, "rgba(220, 210, 255, 0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, SKY_W, SKY_H);

  var c = document.createElement("canvas");
  c.width = c.height = moon.r * 2 + 4;
  var m = c.getContext("2d");
  var mid = moon.r + 2;
  m.fillStyle = "#f6efff";
  m.beginPath(); m.arc(mid, mid, moon.r, 0, Math.PI * 2); m.fill();
  m.globalCompositeOperation = "destination-out";
  m.beginPath(); m.arc(mid + moon.r * 0.45, mid - moon.r * 0.2, moon.r * 0.85, 0, Math.PI * 2); m.fill();
  g.drawImage(c, moon.x - mid, moon.y - mid);
}

// One fluffy cloud, drawn once and then slid across the sky.
function makeCloud(color, alpha) {
  var c = document.createElement("canvas");
  c.width = 520; c.height = 220;
  var g = c.getContext("2d");
  var puffs = [[150, 140, 90], [250, 110, 110], [360, 140, 90], [210, 160, 80], [310, 165, 80]];
  puffs.forEach(function (p) {
    var grad = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], p[2]);
    grad.addColorStop(0, "rgba(" + color + "," + alpha + ")");
    grad.addColorStop(1, "rgba(" + color + ",0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(p[0], p[1], p[2], 0, Math.PI * 2);
    g.fill();
  });
  return c;
}

function addClouds(count, color, alpha) {
  for (var i = 0; i < count; i++) {
    var scale = rand(0.8, 1.8);
    sky.clouds.push({
      img: makeCloud(color, alpha), x: rand(-600, SKY_W), y: rand(-60, 380),
      scale: scale, speed: rand(0.15, 0.4) * scale
    });
  }
}

// Called by weather.js with the weather, and every minute with the time.
function setSky(scene) {
  if (sky.lockScene) scene = sky.scene;
  var time = sky.lockTime ? sky.time : timeOfDay(new Date().getHours());
  if (scene === sky.scene && time === sky.time && sky.bg) return;
  sky.scene = scene;
  sky.time = time;
  var isDay = !isNight();
  sky.bg = paintBackground();
  sky.clouds = [];
  sky.bits = [];
  var i;

  if (scene === "partly") addClouds(4, isDay ? "255,230,245" : "190,180,230", 0.4);
  if (scene === "cloudy") addClouds(8, "200,190,220", 0.3);
  if (scene === "rain" || scene === "thunder") addClouds(6, "120,115,160", 0.35);
  if (scene === "snow") addClouds(5, "230,225,250", 0.25);
  if (scene === "fog") addClouds(9, "220,210,235", 0.22);

  if (scene === "clear" && !isDay || scene === "partly" && !isDay) {
    for (i = 0; i < 140; i++) sky.bits.push({ x: rand(0, SKY_W), y: rand(0, SKY_H * 0.7), r: rand(0.8, 2.4), t: rand(0, 6.28), s: rand(0.01, 0.04) });
  }
  if (scene === "clear" && isDay) {
    for (i = 0; i < 50; i++) sky.bits.push({ x: rand(0, SKY_W), y: rand(0, SKY_H), r: rand(1.5, 4), t: rand(0, 6.28), s: rand(0.2, 0.6) });
  }
  if (scene === "rain" || scene === "thunder") {
    for (i = 0; i < 200; i++) sky.bits.push({ x: rand(0, SKY_W), y: rand(0, SKY_H), len: rand(18, 34), s: rand(16, 26) });
  }
  if (scene === "snow") {
    for (i = 0; i < 160; i++) sky.bits.push({ x: rand(0, SKY_W), y: rand(0, SKY_H), r: rand(2, 5), t: rand(0, 6.28), s: rand(0.6, 1.8) });
  }
  sky.nextFlash = Date.now() + rand(4000, 9000);
}

function drawSky() {
  var g = skyCtx;
  g.drawImage(sky.bg, 0, 0);

  sky.clouds.forEach(function (c) {
    c.x += c.speed;
    if (c.x > SKY_W) c.x = -520 * c.scale;
    g.drawImage(c.img, c.x, c.y, 520 * c.scale, 220 * c.scale);
  });

  var scene = sky.scene;
  if (sunShows() && isNight()) {
    // Twinkling stars
    sky.bits.forEach(function (b) {
      b.t += b.s;
      g.fillStyle = "rgba(255, 245, 255," + (0.35 + 0.65 * Math.abs(Math.sin(b.t))) + ")";
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
    });
  } else if (scene === "clear") {
    // Little pink sparkles drifting up in the sunshine
    sky.bits.forEach(function (b) {
      b.y -= b.s; b.t += 0.02;
      if (b.y < -10) { b.y = SKY_H + 10; b.x = rand(0, SKY_W); }
      g.fillStyle = "rgba(255, 200, 235," + (0.25 + 0.3 * Math.sin(b.t)) + ")";
      g.beginPath(); g.arc(b.x + Math.sin(b.t) * 20, b.y, b.r, 0, Math.PI * 2); g.fill();
    });
  } else if (scene === "rain" || scene === "thunder") {
    g.strokeStyle = "rgba(170, 190, 255, 0.45)";
    g.lineWidth = 2;
    g.beginPath();
    sky.bits.forEach(function (b) {
      b.y += b.s; b.x -= b.s * 0.15;
      if (b.y > SKY_H) { b.y = -b.len; b.x = rand(0, SKY_W + 200); }
      g.moveTo(b.x, b.y);
      g.lineTo(b.x - b.len * 0.15, b.y + b.len);
    });
    g.stroke();
  } else if (scene === "snow") {
    g.fillStyle = "rgba(255, 255, 255, 0.85)";
    sky.bits.forEach(function (b) {
      b.y += b.s; b.t += 0.02;
      if (b.y > SKY_H + 10) { b.y = -10; b.x = rand(0, SKY_W); }
      g.beginPath(); g.arc(b.x + Math.sin(b.t) * 30, b.y, b.r, 0, Math.PI * 2); g.fill();
    });
  }

  // Lightning: a quick purple-white flash every few seconds.
  if (scene === "thunder") {
    if (Date.now() > sky.nextFlash) { sky.flash = 1; sky.nextFlash = Date.now() + rand(5000, 12000); }
    if (sky.flash > 0) {
      g.fillStyle = "rgba(235, 220, 255," + sky.flash * 0.5 + ")";
      g.fillRect(0, 0, SKY_W, SKY_H);
      sky.flash -= 0.08;
    }
  }
}

// About 30 frames a second is smooth enough and easy on the TV.
var lastFrame = 0;
function skyLoop(t) {
  if (t - lastFrame > 32) { lastFrame = t; drawSky(); }
  requestAnimationFrame(skyLoop);
}

(function startSky() {
  var params = new URLSearchParams(location.search);
  if (params.get("time")) { sky.time = params.get("time"); sky.lockTime = true; }
  if (params.get("scene")) { sky.scene = params.get("scene"); sky.lockScene = true; }
  setSky(sky.scene); // clear skies until the real weather arrives
  setInterval(function () { setSky(sky.scene); }, 60 * 1000); // let the sun move on
  requestAnimationFrame(skyLoop);
})();
