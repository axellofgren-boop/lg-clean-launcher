# Clean Launcher for LG webOS

*Welcome to Goblin Mansion.* A tiny, ad-free launcher for my LG TV (55NANO82T6B, webOS 25). It shows only
the five apps I use and nothing else.

![Screenshot](screenshot.png)

## Using it

- **Arrow keys** move between tiles, **OK** opens the app.
- **Number keys 1-5** open an app straight away (on remotes that have them).
- With the Magic Remote, point at a tile and click.
- **Back** twice (within 3 seconds) closes the launcher. On the "Your apps" screen, Back just goes back.
- The **+** tile opens "Your apps": the built-in five plus the apps the launcher can find on the TV. Press OK to show or hide any of them. Your choices are remembered on the TV.

## How it's built

A webOS TV app is just a small website packaged for the TV:

| File | What it does |
|---|---|
| `app/appinfo.json` | The app's "ID card": its name, icon, and which TV services it may use. |
| `app/index.html` | The page skeleton: a clock, a row of tiles, a status line. |
| `app/style.css` | How it looks: dark background, big tiles, a white ring on the focused tile. |
| `app/apps.js` | **The list of apps.** Edit this to add, remove, or reorder tiles, or change their logo and colour. |
| `app/logos/` | The logo images. Tiles without one borrow the app's own icon from the TV. |
| `app/fonts/` | The Cherry Bomb One and Fredoka fonts used for the text. |
| `app/weather.js` | Fetches the Copenhagen forecast from Open-Meteo every half hour and draws it in the top-left corner. |
| `app/sky.js` | The moving background: sun, stars, clouds, rain, snow, fog or lightning, matching the weather. The sun moves with the time of day (morning, afternoon, evening) and becomes a moon at night. Add `?scene=snow&time=evening` to the address to preview a scene in a browser. |
| `app/remote.js` | One shared connection to the TV's phone-remote service (what LG's ThinQ app uses). Used for the app list and for noticing which app is on screen. |
| `app/discover.js` | Finds installed apps and their icons. LG has no official "list all apps" call, so it tries several ways (the app manager, the TV's phone-remote connection, the LG store apps folder, and known-apps.js) and logs what each one answered at the bottom of the + screen. |
| `app/stay.js` | "Stay in Goblin Mansion": after you leave an app you opened from here, it tries to bring the launcher back instead of LG's home screen: first a normal launch, then closing LG's home and launching again, then pressing OK on the highlighted home tile (so keep Goblin Mansion first in the app row). Back twice on the launcher, or Home on the launcher itself, gets you to LG's real home. |
| `app/known-apps.js` | Backup list for the + screen: if the TV won't share its app list, the launcher checks for each of these apps one by one. |
| `app/app.js` | The logic: draws the tiles, listens to the remote, and asks the TV to open an app. |

Opening another app uses the TV's official Application Manager service
(`luna://com.webos.applicationManager/launch`), which is why `appinfo.json`
asks for the `applications.operation` permission.

## Installing

The ready-made package is in `dist/`.
Install it with the same PC app used for Moonlight (Developer Mode must be on).

## Changing it

1. Edit `app/apps.js` (or the colours in `app/style.css`).
2. Bump `version` in `app/appinfo.json`.
3. Rebuild the package: `ares-package app -o dist` (from `@webos-tools/cli`).
4. Install the new `.ipk` the same way as before.

## Credits

- The phone-remote connection manifest in `remote.js` is LG Connect SDK's public one, as published in [lgtv2](https://github.com/hobbyquaker/lgtv2) (MIT).

- Weather data by [Open-Meteo](https://open-meteo.com) (CC BY 4.0).

- Netflix, HBO and YouTube logos from [Simple Icons](https://simpleicons.org) (CC0). The logos are trademarks of their owners and are used here only for a personal launcher.
- Disney+ logo supplied by Julia. Moonlight logo from [moonlight-stream](https://github.com/moonlight-stream/moonlight-qt).
- Cherry Bomb One and Fredoka fonts, SIL Open Font License, via [Fontsource](https://fontsource.org).
