// The two Couch Quiz goblins, drawn as pictures (SVG) so they stay sharp on
// the big screen. goblinSvg("pink") or goblinSvg("green") gives the picture.

var GOBLIN_LOOKS = {
  // skin, darker shade for the outfit and ears, and a little extra on top
  pink:  { skin: "#ff9ad9", dark: "#c2479a", extra: "bow" },
  green: { skin: "#7fdc8a", dark: "#2f8a4a", extra: "hood" }
};

function goblinSvg(look, crowned) {
  var g = GOBLIN_LOOKS[look];
  var extra = "";
  if (g.extra === "bow") {
    // A bow on top of her head
    extra =
      '<path d="M60 26 L42 16 Q36 26 42 36 Z M60 26 L78 16 Q84 26 78 36 Z" fill="#ffe14d" stroke="#d9a400" stroke-width="2"/>' +
      '<circle cx="60" cy="26" r="6" fill="#ffd000"/>';
  } else {
    // A floppy pointed hood
    extra =
      '<path d="M30 40 Q36 8 64 4 Q88 2 98 14 Q84 14 82 24 Q90 32 90 40 Z" fill="#8a5a2b" stroke="#5e3a17" stroke-width="2"/>' +
      '<circle cx="98" cy="14" r="5" fill="#ffe14d"/>';
  }
  var crown = crowned ?
    '<path d="M38 18 L44 -4 L54 10 L60 -8 L66 10 L76 -4 L82 18 Z" fill="#ffd34d" stroke="#c99400" stroke-width="2"/>' +
    '<circle cx="60" cy="-6" r="3.5" fill="#ff5b9a"/>' : "";
  return '<svg class="goblin" viewBox="0 -12 120 162" xmlns="http://www.w3.org/2000/svg">' +
    // arms reaching up for the ladder
    '<path d="M36 92 Q22 74 24 58" stroke="' + g.skin + '" stroke-width="9" stroke-linecap="round" fill="none"/>' +
    '<path d="M84 92 Q98 74 96 58" stroke="' + g.skin + '" stroke-width="9" stroke-linecap="round" fill="none"/>' +
    // legs
    '<path d="M48 128 L44 146 M72 128 L76 146" stroke="' + g.dark + '" stroke-width="10" stroke-linecap="round"/>' +
    // body (a little tunic)
    '<path d="M38 88 Q60 80 82 88 L88 132 Q60 140 32 132 Z" fill="' + g.dark + '"/>' +
    '<circle cx="60" cy="108" r="4" fill="#ffe14d"/>' +
    // big pointy ears
    '<path d="M30 52 L2 34 L30 70 Z" fill="' + g.skin + '" stroke="' + g.dark + '" stroke-width="2"/>' +
    '<path d="M90 52 L118 34 L90 70 Z" fill="' + g.skin + '" stroke="' + g.dark + '" stroke-width="2"/>' +
    // head
    '<ellipse cx="60" cy="58" rx="34" ry="31" fill="' + g.skin + '"/>' +
    extra + crown +
    // eyes, cheeks, nose and a grin with one tooth
    '<ellipse cx="47" cy="54" rx="9" ry="10" fill="#fff"/><ellipse cx="73" cy="54" rx="9" ry="10" fill="#fff"/>' +
    '<circle class="pupil" cx="49" cy="56" r="5" fill="#241430"/><circle class="pupil" cx="75" cy="56" r="5" fill="#241430"/>' +
    '<circle cx="51" cy="54" r="1.6" fill="#fff"/><circle cx="77" cy="54" r="1.6" fill="#fff"/>' +
    '<ellipse cx="38" cy="70" rx="6" ry="4" fill="#ff6fa8" opacity="0.5"/><ellipse cx="82" cy="70" rx="6" ry="4" fill="#ff6fa8" opacity="0.5"/>' +
    '<ellipse cx="60" cy="66" rx="5" ry="4" fill="' + g.dark + '" opacity="0.6"/>' +
    '<path d="M46 74 Q60 86 74 74" stroke="#241430" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M64 77 L66 83 L69 76 Z" fill="#fff"/>' +
    "</svg>";
}
