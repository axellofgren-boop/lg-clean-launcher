// Copenhagen weather in the top-left corner, from Open-Meteo
// (https://open-meteo.com), a free weather service that needs no account.
var WEATHER_URL = "https://api.open-meteo.com/v1/forecast" +
  "?latitude=55.6761&longitude=12.5683" +
  "&current=temperature_2m,weather_code,is_day" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
  "&timezone=Europe%2FCopenhagen&forecast_days=4";

// Small drawings for each kind of weather.
var SUN = '<circle cx="32" cy="32" r="12" fill="#ffd36e"/>' +
  '<g stroke="#ffd36e" stroke-width="4" stroke-linecap="round">' +
  '<path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5"/></g>';
var MOON = '<path d="M40 10a22 22 0 1 0 14 34A18 18 0 0 1 40 10z" fill="#f4e3a1"/>';
var CLOUD = '<path d="M20 50h26a11 11 0 0 0 0-22 15 15 0 0 0-29 4 9 9 0 0 0 3 18z" fill="#e8e2f0"/>';
var SMALL_SUN = '<g transform="translate(-6 -8) scale(0.75)">' + SUN + "</g>";
var DROPS = '<g stroke="#7cc4ff" stroke-width="4" stroke-linecap="round"><path d="M24 54l-3 7M34 54l-3 7M44 54l-3 7"/></g>';
var FLAKES = '<g fill="#ffffff"><circle cx="22" cy="58" r="3"/><circle cx="33" cy="60" r="3"/><circle cx="44" cy="58" r="3"/></g>';
var BOLT = '<path d="M34 50l-8 10h7l-4 9 11-13h-7l4-6z" fill="#ffd36e"/>';
var FOG = '<g stroke="#e8e2f0" stroke-width="4" stroke-linecap="round"><path d="M12 26h40M8 36h44M14 46h36"/></g>';

// Turn a WMO weather code (what Open-Meteo sends) into a picture and a word.
function describeWeather(code, isDay) {
  var sky = isDay === 0 ? MOON : SUN;
  if (code === 0) return { icon: sky, text: isDay === 0 ? "Clear" : "Sunny", scene: "clear" };
  if (code <= 2) return { icon: (isDay === 0 ? MOON : SMALL_SUN) + CLOUD, text: "Partly cloudy", scene: "partly" };
  if (code === 3) return { icon: CLOUD, text: "Cloudy", scene: "cloudy" };
  if (code <= 48) return { icon: FOG, text: "Foggy", scene: "fog" };
  if (code <= 57) return { icon: CLOUD + DROPS, text: "Drizzle", scene: "rain" };
  if (code <= 67) return { icon: CLOUD + DROPS, text: "Rain", scene: "rain" };
  if (code <= 77) return { icon: CLOUD + FLAKES, text: "Snow", scene: "snow" };
  if (code <= 82) return { icon: CLOUD + DROPS, text: "Showers", scene: "rain" };
  if (code <= 86) return { icon: CLOUD + FLAKES, text: "Snow showers", scene: "snow" };
  return { icon: CLOUD + BOLT, text: "Thunder", scene: "thunder" };
}

function weatherSvg(inner, size) {
  return '<svg viewBox="0 0 64 70" width="' + size + '" height="' + size + '">' + inner + "</svg>";
}

var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function showWeather(data) {
  var now = describeWeather(data.current.weather_code, data.current.is_day);
  var daily = data.daily;
  var days = "";
  for (var i = 1; i < daily.time.length; i++) {
    var d = describeWeather(daily.weather_code[i], 1);
    var name = DAY_NAMES[new Date(daily.time[i] + "T12:00:00").getDay()];
    days += '<div class="day"><span>' + name + "</span>" + weatherSvg(d.icon, 44) +
      "<span>" + Math.round(daily.temperature_2m_max[i]) + "° / " +
      Math.round(daily.temperature_2m_min[i]) + "°</span></div>";
  }
  document.getElementById("weather").innerHTML =
    '<div class="now">' + weatherSvg(now.icon, 96) +
    '<div><div class="temp">' + Math.round(data.current.temperature_2m) + "°</div>" +
    '<div class="place">Copenhagen · ' + now.text + "</div></div></div>" +
    '<div class="days">' + days + "</div>";
  setSky(now.scene);
}

function updateWeather() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", WEATHER_URL);
  xhr.onload = function () {
    if (xhr.status !== 200) return;
    try { showWeather(JSON.parse(xhr.responseText)); } catch (e) {}
  };
  xhr.send();
}

updateWeather();
setInterval(updateWeather, 30 * 60 * 1000); // refresh every half hour
