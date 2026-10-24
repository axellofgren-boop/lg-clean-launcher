// The apps shown on the launcher, in order.
// - ids: one or more webOS app IDs. The launcher tries them in order, because
//   some apps (like HBO Max) have used different IDs over the years.
// - logo: an image in the logos folder. Without one, the tile shows the name.
// Apps added with the "+" tile on the TV are stored on the TV, not here.
// - background: the tile's colour.
// - open: instead of ids, a tile can open one of Goblin Mansion's own screens.
var APPS = [
  { name: "Netflix",   ids: ["netflix"],                                     logo: "logos/netflix.svg",   background: "#000000" },
  { name: "HBO Max",   ids: ["com.hbo.hbomax", "com.wbd.stream", "hbo-go-2"], logo: "logos/hbo.svg",       background: "linear-gradient(135deg, #002be7, #6a00d9)" },
  { name: "Disney+",   ids: ["com.disney.disneyplus-prod"],                      logo: "logos/disneyplus.png", background: "linear-gradient(135deg, #0a1446, #143c9e 55%, #1b8fbf)" },
  { name: "YouTube",   ids: ["youtube.leanback.v4"],                         logo: "logos/youtube.svg",   background: "#ffffff" },
  { name: "Moonlight", ids: ["com.limelight.webos"],                         logo: "logos/moonlight.svg", background: "#2b2f36" },
  { name: "Couch Quiz", open: function () { openQuiz(); },                logo: "logos/quiz.svg",      background: "linear-gradient(135deg, #ff8fd8, #8a4dff)" },
  { name: "What do we watch?", open: function () { openMoviePicker(); }, logo: "logos/popcorn.svg", background: "linear-gradient(135deg, #ff5fa8, #8a3ffc)" }
];
