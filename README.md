# Clean Launcher for LG webOS

*Welcome to Goblin Mansion.* A tiny, ad-free launcher for my LG TV (55NANO82T6B, webOS 25). It shows only
the five apps I use and nothing else.

![Screenshot](screenshot.png)

## Using it

- **Arrow keys** move between tiles, **OK** opens the app.
- **Number keys 1-5** open an app straight away (on remotes that have them).
- With the Magic Remote, point at a tile and click.
- **Back** closes the launcher.

## How it's built

A webOS TV app is just a small website packaged for the TV:

| File | What it does |
|---|---|
| `app/appinfo.json` | The app's "ID card": its name, icon, and which TV services it may use. |
| `app/index.html` | The page skeleton: a clock, a row of tiles, a status line. |
| `app/style.css` | How it looks: dark background, big tiles, a white ring on the focused tile. |
| `app/apps.js` | **The list of apps.** Edit this to add, remove, or reorder tiles, or change their logo and colour. |
| `app/logos/` | The logo images. Tiles without one borrow the app's own icon from the TV. |
| `app/fonts/` | The Cinzel Decorative font used for the welcome title. |
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

- Netflix, HBO and YouTube logos from [Simple Icons](https://simpleicons.org) (CC0). The logos are trademarks of their owners and are used here only for a personal launcher.
- Moonlight logo from [moonlight-stream](https://github.com/moonlight-stream/moonlight-qt).
- Cinzel Decorative font by Natanael Gama, SIL Open Font License, via [Fontsource](https://fontsource.org).
