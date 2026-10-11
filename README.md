# Jellyfin Custom Theme

A sleek, dark streaming-style skin for **Jellyfin 12.0+**. Install the plugin and the theme is applied automatically — all settings live on the server, so they follow you to every device. No manual CSS, no client tweaks.

![Jellyfin](https://img.shields.io/badge/Jellyfin-12.0+-00A4DC?logo=jellyfin&logoColor=white)
[![Build](https://github.com/drinktree/jellyfixed/actions/workflows/build.yml/badge.svg)](https://github.com/drinktree/jellyfixed/actions/workflows/build.yml)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## How it works

The plugin generates a complete stylesheet from your settings and writes it to Jellyfin's built-in **Custom CSS** (branding) configuration. Because the entire theme is plain CSS:

- it works on **every client** that loads the web CSS — no per-device setup;
- there is **no client-side JavaScript runtime** driving the look;
- changing a setting regenerates and re-applies the CSS instantly.

The plugin also injects a small script that adds a **palette settings button** in the header and the **hover autoplay preview** on cards. This is **fully self-contained** — a built-in ASP.NET middleware injects it into `index.html` at serve time, so **no File Transformation plugin is required** (works on Docker / read-only installs too). The CSS theme always works regardless.

> **Bundled File Transformation:** this plugin also *provides* the File Transformation service to other plugins. So companion plugins like the [Jellyfin Media Bar](https://github.com/IAmParadox27/jellyfin-plugin-media-bar) (the big hero banner) work **without** installing the separate File Transformation plugin — Custom Theme applies their `index.html` transformations for them. (If you already run the real File Transformation plugin, turn this off in the settings to avoid two providers.)

## Features

- Sleek dark UI with backdrop gradients and smooth animations
- **Server-side settings** stored in the plugin configuration (persist across all devices)
- **Dashboard settings page** at *Plugins → Custom Theme*
- **Optional header settings button** (palette icon) with the same options
- **15 Google Fonts** — Inter, Poppins, Montserrat, Roboto, Oswald, Raleway, Nunito, Bebas Neue, Lato, Source Sans, Ubuntu, Playfair Display, Quicksand, Comfortaa, Righteous (only the selected family is loaded)
- **Two house styles** — Netflix (default) or **Villa Cocquette**: the same layout with a gold accent and the villa's crest in the header, in the navigation drawer and above the sign-in page — and outside the page too: the browser tab's icon and name, the loading screen, and the icon and name the site gets on a phone's home screen or in a dock
- **An intro before films** (off by default) — one video of yours, played by the theme itself: full screen, with sound, no player controls, and the film follows. See [Intro before films](#intro-before-films)
- **Logo options** — red "N" (default), Jellyfin, custom letter, custom image URL, or none
- **Color presets** — Default, Monochrome, Colorful, Christmas, Halloween, Summer, Ocean (override the colour palette)
- Color customization — accent, background, text, muted text, progress bar
- Round cast/crew images, full-backdrop detail page, card hover zoom
- **Sign-in as a profile gate** — the user picker is a "Who's watching?" screen and every sign-in form shares one card. Turn on Jellyfin's splash screen (*Dashboard → General*) and a collage of your library's posters sits behind it
- Albums, artists, playlists and people get a cover header and a proper track list instead of an empty backdrop band
- Toggle visibility of badges, watched marks, backdrop, description, tags, external links, similar titles
- Toggle the detail-page circle buttons (watched, favorite, more)
- Adjustable card rounding, card size & shape, gradient strength, title size, font size
- Animation speed control, compact sidebar, ambient glow, spoiler mode

## Installation

### Via plugin repository (recommended)

1. In Jellyfin go to **Dashboard → Plugins → Repositories**.
2. Add the repository URL:
   ```
   https://raw.githubusercontent.com/drinktree/jellyfixed/main/manifest.json
   ```
3. Open **Catalog** and install **Custom Theme**.
4. Restart Jellyfin. The theme is applied automatically.

> The header button and previews are injected by the plugin's own middleware — nothing else to install. If you prefer, you can turn the built-in injection off in the settings and use the separate [File Transformation plugin](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) instead.

### Manual

Download `custom-theme-vX.Y.Z.zip` from the [releases](https://github.com/drinktree/jellyfixed/releases), extract it into `<config>/plugins/Custom Theme/`, and restart Jellyfin.

## Settings

Open **Dashboard → Plugins → Custom Theme**, or click the palette icon in the header.

| Section | Options |
|---------|---------|
| Brand | Theme: Netflix (default) or Villa Cocquette. Villa Cocquette brings its own gold accent and its own marks, so the accent colour and the logo style do not apply while it is selected |
| Injection | Self-contained middleware injection (on by default), provide File Transformation to other plugins (on by default) |
| Features | Clean home takeover, hero carousel, genre rows, top nav tabs, hover expand card, autoplay preview clips, Top 10 rank numbers (off by default), green "x% Match" score, glass blur (off), OLED black (off) — all others on by default |
| Colors | Color preset, accent, background, text, muted text, progress bar |
| Intro | Play an intro before films (off by default), the video file on the server, also before episodes (on), skippable (on), also on iPhone / iPad / Safari (experimental, off) |
| Logo & Header | Logo style (red "N" default / Jellyfin / letter / custom image / none), left-aligned nav, header blur |
| Elements | Badges, watched marks, backdrop, round cast, description, tags, external links, similar titles, spoiler mode |
| Detail buttons | Watched, favorite, more |
| Layout | 15 fonts, font size, card rounding, card size, card shape, hover zoom, info overlay, gradient strength, title size, animation speed, compact sidebar, ambient glow |

After saving, reload the web page to see the new theme.

### Intro before films

Jellyfin can only play a pre-roll as a separate entry in the player's queue: a second playback with the player's controls and the file's name on screen, loaded from scratch every time. With **Intro** switched on the theme plays one video itself instead — full screen, with sound, nothing else on screen — and only then lets Jellyfin start the film, which opens without its controls flashing up.

- **The file** is a video on the *server*: an MP4 with H.264 video and AAC sound plays everywhere (`.mp4`, `.m4v` and `.webm` are accepted, up to 300 MB). On the dashboard page, **Browse…** picks it with Jellyfin's own file browser, and the line under the field says whether the server can read it. The path is the one the server sees — in Docker, the path inside the container.
- **When it plays:** when a film, or an episode started on its own (from its page, an episode card or Next Up), starts from the beginning. Not when resuming, and not between auto-playing episodes. As with Jellyfin's own intros, it is also left out when a season's Play button starts at a later episode because the earlier ones are watched, and with "play all from here". Jellyfin's own *Cinema mode* playback setting has to be on (it is by default).
- **Skipping:** Esc, Enter, Space or a click jumps to the film (can be switched off); on a remote, OK skips. Back leaves without starting the film.
- **Loading:** a file of up to 64 MB is fetched once when the app starts and kept in memory, so it starts the moment Play is pressed; the browser may also keep it between sessions. A larger file is streamed when Play is pressed and may start a moment later. If the intro cannot be shown — missing file, a format the device cannot play, nothing on screen within two and a half seconds — the film simply starts as usual.
- **Where:** browsers, Jellyfin Media Player and the other apps that load the server's web interface. On iPhone, iPad and Safari it is a separate, experimental switch (off by default), because Apple's engine may ask for a second tap to start the film. Apps with their own interface (most TV apps) never run the theme at all.
- **With an intros plugin** (Local Intros and the like): where the theme plays its intro, the plugin's is not played as well; everywhere else Jellyfin behaves exactly as before, so the plugin still covers the TV apps.

## Build from source

Requires the **.NET 10 SDK**.

```bash
dotnet build -c Release
# Output: bin/Release/net10.0/Jellyfin.Plugin.CustomTheme.dll
```

To package a release zip manually, bundle **both** built DLLs
(`Jellyfin.Plugin.CustomTheme.dll` and `CustomTheme.FileTransformation.dll`)
together with `meta.json` — the main assembly references the bundled
File Transformation provider and will not load without it.

### Releasing (maintainers)

Every push and pull request to `main` is built by the
[Build workflow](.github/workflows/build.yml). Releases are fully automatic:
when a push to `main` carries a `meta.json` version that has no release yet, the
workflow builds the plugin, creates the `vX.Y.Z` tag + GitHub release with
`custom-theme-vX.Y.Z.zip` attached, and pins the zip's MD5 into the matching
`manifest.json` entry (make sure that entry exists — unmatched versions are
skipped silently). To release: merge a PR that bumps the version in `meta.json`,
both `.csproj` files and `NF_JS_VERSION` in `headerButton.js`, and adds the
`manifest.json` entry at the TOP of `versions` (the dashboard installs
`versions[0]` by array position). `.github/validate-release-metadata.py` runs
first in CI and fails the build if any of those disagree or if the entry is on
the wrong ABI lane.

## Project structure

```
Plugin.cs                  # Plugin entry; serves configPage.html and headerButton.js
PluginConfiguration.cs     # Every setting, with defaults — fully consumed by CssGenerator
CssGenerator.cs            # Builds the stylesheet from config (base CSS + :root overrides + option rules)
EntryPoint.cs              # Hosted service: applies CSS, sets up injection on startup
IndexInjectionMiddleware.cs# Built-in middleware: injects the script + applies other plugins' transformations
ThemeTransformation.cs     # Builds/strips the inline headerButton.js injection (and the Villa icons/title in <head>)
ThemeAssetsController.cs   # Serves the Villa icons + web-app manifest, and the intro video
Assets/                    # The Villa Cocquette marks and icons (embedded resources)
FileTransformation/        # Bundled File Transformation provider (separate CustomTheme.FileTransformation.dll)
ServiceRegistrator.cs      # Registers the services with Jellyfin's DI container
*.css                      # Base skin stylesheet (embedded resource)
configPage.html            # Dashboard settings page
headerButton.js            # Header button + slide-in settings panel + hero/preview/Top 10
manifest.json              # Plugin repository manifest
meta.json                  # Plugin metadata (shipped inside the zip)
LICENSE                    # MIT license
.github/workflows/build.yml # CI: build on push/PR, package & release on tags
```

## Jellyfin version

Jellyfin 12.0 moved the server to .NET 10, so plugins have to be rebuilt for it and a single
build cannot serve both generations.

| Plugin | Server | Status |
| --- | --- | --- |
| 3.0.0 and newer | Jellyfin 12.0+ | current |
| 2.5.77 | Jellyfin 10.11 | final 10.11 build, kept on the `release/10.11` branch |

Both lines stay in the repository manifest with their own `targetAbi`, and Jellyfin only offers
a server the build it can actually load — so nothing has to be done by hand when upgrading.

Jellyfin 12.0 also made its new **Modern** layout the default. The theme skins that layout's app
bar directly (logo, scrim, colours and the theme's settings button), and still skins the Legacy
layout the way it always did, so either choice looks right.

## Requirements

- Jellyfin 12.0+ (on Jellyfin 10.11 the plugin repository serves the final 10.11 build, 2.5.77)
- *(optional)* [Jellyfin Media Bar](https://github.com/IAmParadox27/jellyfin-plugin-media-bar) — for the big cinematic hero banner; works without the separate File Transformation plugin because Custom Theme provides that service
- No File Transformation plugin required (it is bundled/provided by this plugin)
- .NET 10 SDK (only to build from source)

## License

[MIT](LICENSE) © Kuschel-code
