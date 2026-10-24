// The moving background: sun, stars, clouds, rain, snow or fog, depending on
// the weather in Copenhagen. weather.js calls setSky() whenever it updates.
// For testing on a computer, add ?scene=rain&day=0 to the address.

var SKY_W = 1920, SKY_H = 1080;
var skyCanvas = document.getElementById("sky");
var skyCtx = skyCanvas.getContext("2d");

// Background colours for each scene, top to bottom. They all stay in the
// Goblin Mansion pink/purple family so the logos still stand out.
var SKY_COLORS = {
  "clear-day":    ["#6e3b6e", "#3a1f4f", "#1a1226"],
  "clear-night":  ["#1c1747", "#120f2e", "#0a0814"],
  "partly-day":   ["#5a3a6e", "#33204a", "#171124"],
  "partly-night": ["#231c4a", "#141030", "#0a0814"],
  "cloudy":       ["#463e58", "#2a2338", "#14111c"],
  "rain":         ["#2a2d52", "#1a1a36", "#0c0b18"],
  "thunder":      ["#241f44", "#16132c", "#0a0814"],
  "snow":         ["#57527a", "#342f4f", "#1a1728"],
  "fog":          ["#4d4560", "#2e283d", "#16131e"]
};

var sky = { scene: "clear", day: true, locked: false, bg: null, clouds: [], bits: [], flash: 0, nextFlash: 0 };

function skyKey() {
  if (sky.scene === "clear" || sky.scene === "partly") return sky.scene + (sky.day ? "-day" : "-night");
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

  // A warm sun glow by day, a soft moon glow at night.
  if (sky.scene === "clear" || sky.scene === "partly") {
    var x = 1500, y = 140;
    var glow = g.createRadialGradient(x, y, 0, x, y, sky.day ? 700 : 420);
    glow.addColorStop(0, sky.day ? "rgba(255, 190, 150, 0.55)" : "rgba(220, 210, 255, 0.35)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, SKY_W, SKY_H);
  }
  return c;
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

function setSky(scene, isDay) {
  if (sky.locked) return;
  if (scene === sky.scene && isDay === sky.day && sky.bg) return;
  sky.scene = scene;
  sky.day = isDay;
  sky.bg = paintBackground();
  sky.clouds = [];
  sky.bits = [];
  var i;

  if (scene === "partly") addClouds(4, isDay ? "255,230,245" : "190,180,230", 0.35);
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
  if ((scene === "clear" || scene === "partly") && !sky.day) {
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
  var hour = new Date().getHours();
  if (params.get("scene")) {
    setSky(params.get("scene"), params.get("day") !== "0");
    sky.locked = true;
  } else {
    setSky("clear", hour >= 7 && hour < 19); // until the real weather arrives
  }
  requestAnimationFrame(skyLoop);
})();
