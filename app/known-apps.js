// Backup list for the "+" screen. If the TV won't hand over its list of
// installed apps, the launcher asks about each of these one by one (with the
// official getAppLoadStatus call) and shows the ones that are installed.
// Some IDs are best guesses; a wrong guess simply doesn't show up.
var KNOWN_APPS = [
  { name: "Prime Video",   ids: ["amazon"],                                   color: "#00a8e1" },
  { name: "Spotify",       ids: ["spotify-beehive"],                          color: "#1db954" },
  { name: "Apple TV",      ids: ["com.apple.appletv"],                        color: "#111111" },
  { name: "Plex",          ids: ["cdp-30"],                                   color: "#e5a00d" },
  { name: "Jellyfin",      ids: ["org.jellyfin.webos"],                       color: "#7b5ab6" },
  { name: "Twitch",        ids: ["tv.twitch.tv.starshot.lg"],                 color: "#9146ff" },
  { name: "Crunchyroll",   ids: ["crunchyroll"],                              color: "#f47521" },
  { name: "Viaplay",       ids: ["com.viaplay.ott", "viaplay", "com.viaplay"], color: "#2a0a3a" },
  { name: "DRTV",          ids: ["dk.dr.drtv", "dk.dr.tv", "drtv"],           color: "#c00000" },
  { name: "TV 2 Play",     ids: ["dk.tv2.play", "dk.tv2.tv2play", "tv2play"], color: "#e4002b" },
  { name: "SkyShowtime",   ids: ["com.skyshowtime.app", "skyshowtime"],       color: "#1a1a6e" },
  { name: "Pluto TV",      ids: ["com.pluto.tv", "pluto.tv"],                 color: "#2d2d2d" },
  { name: "Live TV",       ids: ["com.webos.app.livetv"],                     color: "#444444" },
  { name: "HDMI 1",        ids: ["com.webos.app.hdmi1"],                      color: "#555555" },
  { name: "HDMI 2",        ids: ["com.webos.app.hdmi2"],                      color: "#555555" },
  { name: "HDMI 3",        ids: ["com.webos.app.hdmi3"],                      color: "#555555" },
  { name: "Web Browser",   ids: ["com.webos.app.browser"],                    color: "#2d6cdf" },
  { name: "LG Channels",   ids: ["com.webos.app.lgchannels"],                 color: "#c4003b" },
  { name: "Photo & Video", ids: ["com.webos.app.photovideo"],                 color: "#e05a8a" },
  { name: "Music",         ids: ["com.webos.app.music"],                      color: "#e0457b" }
];
