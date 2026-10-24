// The apps shown on the launcher, in order. Number keys 1-5 open them directly.
// Each app lists one or more webOS app IDs: the launcher tries them in order,
// because some apps (like HBO Max) have used different IDs over the years.
var APPS = [
  { name: "Netflix",  color: "#e50914", ids: ["netflix"] },
  { name: "HBO Max",  color: "#002be7", ids: ["com.hbo.hbomax", "com.wbd.stream", "hbo-go-2"] },
  { name: "Disney+",  color: "#0b3c8c", ids: ["com.disney.disneyplus-prod"] },
  { name: "YouTube",  color: "#ff0000", ids: ["youtube.leanback.v4"] },
  { name: "Moonlight", color: "#4a4f5c", ids: ["com.limelight.webos"] }
];
