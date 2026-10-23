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
- **An intro before films** (off by default) — one video of yours, played by the theme itself: full screen, with sound, no player controls, and the film follows. Apps that do not show the theme (Android TV and the like) are offered it through Jellyfin, as a light copy the server makes for them. See [Intro before films](#intro-before-films)
- **Requests through Seerr** (with the Jellyseerr Bridge plugin) — films and series that are not in the library can be requested inside the app: a Requests page in the navigation with a trending billboard, rows and a search of its own, a "Not in your library" row on Jellyfin's search, and a request window with seasons for series. No script to run on the server. See [Requests (Seerr)](#requests-seerr)
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
| Intro | Play an intro before films (off by default), the video file on the server, also before episodes (on), skippable (on), also on iPhone / iPad / Safari (experimental, off), also in apps that do not show the theme (on) |
| Requests | Requests in the app, through Seerr and the Jellyseerr Bridge plugin (on by default; does nothing without the bridge), with a line under it that says where the bridge stands |
| Logo & Header | Logo style (red "N" default / Jellyfin / letter / custom image / none), left-aligned nav, header blur |
| Elements | Badges, watched marks, backdrop, round cast, description, tags, external links, similar titles, spoiler mode |
| Detail buttons | Watched, favorite, more |
| Layout | 15 fonts, font size, card rounding, card size, card shape, hover zoom, info overlay, gradient strength, title size, animation speed, compact sidebar, ambient glow |

After saving, reload the web page to see the new theme.

### Intro before films

Jellyfin can only play a pre-roll as a separate entry in the player's queue: a second playback with the player's controls and the file's name on screen, loaded from scratch every time. With **Intro** switched on the theme plays one video itself instead — full screen, with sound, nothing else on screen — and only then lets Jellyfin start the film, which opens without its controls flashing up.

- **The file** is a video on the *server*: an MP4 with H.264 video and AAC sound plays everywhere (`.mp4`, `.m4v` and `.webm` are accepted, up to 300 MB). On the dashboard page, **Browse…** picks it with Jellyfin's own file browser, and the line under the field says whether the server can read it. The path is the one the server sees — in Docker, the path inside the container. Keep it outside your library folders, so that it does not also turn up as a film.
- **When it plays:** when a film, or an episode started on its own (from its page, an episode card or Next Up), starts from the beginning. Not when resuming, and not between auto-playing episodes. As with Jellyfin's own intros, it is also left out when a season's Play button starts at a later episode because the earlier ones are watched, and with "play all from here". Jellyfin's own *Cinema mode* playback setting has to be on (it is by default).
- **Skipping:** Esc, Enter, Space or a click jumps to the film (can be switched off); on a remote, OK skips. Back leaves without starting the film — the browser's Back, a remote's Back, and Esc in the TV layout.
- **Loading:** a file of up to 64 MB is fetched once and kept on the device (in the browser's own storage), so it is there the moment the app starts — also after the app was closed — and Play never waits for the network. A changed file is fetched once more. A larger file is streamed when Play is pressed and may start a moment later. If the intro cannot be shown — missing file, a format the device cannot play, nothing on screen within two and a half seconds — the film simply starts as usual.
- **Where the theme plays it:** browsers, Jellyfin Media Player and the other apps that load the server's web interface (the phone apps, LG's TV app). On iPhone, iPad and Safari it is a separate, experimental switch (off by default), because Apple's engine may ask for a second tap to start the film.
- **In apps that do not show the theme** — Android TV and Fire TV, Roku, Kodi, Samsung's TV app: such an app never runs the theme. It asks Jellyfin for a pre-roll and plays what it is given with its own player. With **Also in apps that do not show the theme** on (it is by default) the intro is offered there too, as a copy made for those apps (see below). What happens then is the app's own doing:
  - its own *Cinema mode* setting has to be on — it is by default on Android TV (the gear icon → Playback → Cinema mode), and off by default on Roku (Settings → Playback → Cinema Mode) and in Kodi (the add-on's settings → Playback → Enable cinema mode);
  - the Android TV app asks before films only, never before episodes, and only when a film starts from the beginning (*Play*, not *Resume*);
  - skipping is the app's, and the *Skippable* switch above does not apply there: on Android TV the fast-forward key goes on to the film, and so does OK (which brings up the player's bar), then down and *next*; Back leaves without the film;
  - if the app is set to use an external player, Android TV plays a film that has an intro in front of it with its built-in player;
  - apps that never ask for a pre-roll (Swiftfin, Findroid, Streamyfin) show none, whatever is set here.

  For this Jellyfin needs the file as an entry of its own. That entry belongs to no library and is in no list, search or row that a signed-in user sees; the dashboard's activity names it "Intro", and so does a tool that reads the whole catalogue with an API key. It is removed again when the option or the intro is switched off — the entry, never your file. Two kinds of viewer are not offered it: one whose parental settings would hide the entry, and one who has *Play next episode automatically* switched off and watches in Jellyfin's own web player (Samsung's TV app), where playback would stop after the intro.

  These apps keep nothing: the Android TV app fetches the intro from the server on every Play, the way it fetches a film, and shows it once it holds a few seconds of it. A file exported the way editing programs export it — 4K, or 25–30 Mbit/s, with the file's index at its end — keeps a television waiting for that. So the apps are not given your file but a **copy made for them**: H.264 at most 1080p and 8 Mbit/s, AAC stereo sound, with the index first, which every app plays as it is. The server makes it once, in the background with its own ffmpeg, whenever the file is new or has changed; where your file is all that already, its picture and sound are copied over unchanged. Measured with the Android TV app over a 20 Mbit/s connection, from Play to the intro playing: a 10-second 4K intro of 31 MB took 6.5 s, its copy 0.7 s; a 1080p one of 36 MB at 30 Mbit/s took 9 s, its copy 1 s. Over 10 Mbit/s the 4K one took 13 s and then stopped twice on the way; its copy started after 1.3 s and played straight through.
  - Until the copy is ready — seconds to a few minutes, once, after the file was chosen or changed — these apps start films without the intro rather than wait for the file itself. Only if no copy can be made do they get the file itself (an HDR file on a server whose ffmpeg cannot turn it into ordinary picture, for one — Jellyfin's own ffmpeg can). The line under the file's path on the dashboard page says where the copy stands.
  - The copy is kept in the server's data folder (`data/custom-theme`) and goes when the option, the intro or the plugin does. Once it is there, deleting the "Intro" entry by hand (Jellyfin's *Delete media*) deletes the copy, not your file, and while the setting names the file the next Play makes the entry again; switch the option off to be rid of it.
  - On a 4K television the intro is therefore shown in 1080p. The theme itself (browsers, Jellyfin Media Player, the phone apps) goes on playing your original file.

  The film that follows starts with the viewer's usual audio and subtitle track, not the intro's: the Android TV app and Jellyfin's web player would otherwise carry "the intro's audio stream, no subtitles" over to the film, and Jellyfin would remember that for the film. This is put right for those two players (measured with the Android TV app 0.19.10; its 0.20 beta switches subtitles off by itself after an intro, which a server cannot undo). Two things remain: a subtitle track picked on the film's page before pressing Play (Samsung's TV app has that page) does not survive the intro — the film starts with the viewer's default subtitles — and on Android TV a film whose default subtitles have to be burned into the picture starts twice.
- **With an intros plugin** (Local Intros and the like): where the theme plays its intro, the plugin's is not played as well. In the apps above both would play, one after the other (Roku plays only the first it is given) — the plugin is no longer needed for them.

### Requests (Seerr)

Films and series that are not in the library can be asked for from inside the app, through a [Seerr](https://github.com/seerr-team/seerr) server (formerly Jellyseerr). The navigation gets a **Requests** page in the theme's own look: today's trending title as the billboard, then rows of what is trending, popular films and series, and what is coming soon. The page has a search of its own, which stays in the address, so Back and a reload come back to it. Jellyfin's own search gets a **Not in your library** row under its results. A title opens in a window like the theme's own popups, with the request button: a series is requested season by season or all at once, and the billboard's *Request* asks for a film in one click. A request that cannot be made says why (already requested, switched off, not allowed, Seerr out of reach), and a title the library already has offers *Play* instead, to a profile that may watch it.

- **What to install:** the third-party [Jellyseerr Bridge](https://github.com/monjaka/jellyfin-plugin-jellyseerr-bridge) plugin. Add its repository (`https://raw.githubusercontent.com/monjaka/jellyfin-plugin-jellyseerr-bridge/main/manifest.json`) in *Dashboard → Plugins → Repositories*, install it from the catalogue and restart Jellyfin. In its settings, enter Seerr's address as the server reaches it and Seerr's API key (Seerr → *Settings → General*), and tick *Enable request submission*: it is off by default, and until it is on the catalogue can be browsed and searched but nothing can be requested. The theme's own switch, **Requests in the app** under *Requests*, is on by default and does nothing until the bridge is there. The line under it, on the dashboard page and in the palette drawer, says where the bridge stands: not installed, waiting for a restart, disabled, not given a Seerr yet, requests switched off, your own account not on its allowed list, Seerr not answering, or connected.
- **No script on the server:** the bridge also offers a web loader (`install-web-loader.sh`, run with sudo) that writes a tag into Jellyfin's web files for an entry of its own. The theme does not need it: it draws its own entry. If you ran it already, the theme leaves that loader out of the pages it serves while **Requests in the app** is on, and hides what it would add. To take it out with the bridge's `uninstall-web-loader.sh`, restart Jellyfin once *before* you run that script. The script deletes every whole line that holds the loader, and a tag typed onto the `</body></html>` line would take the end of the page with it; a restart is what moves such a tag onto a line of its own.
- **Where it shows:** wherever the theme itself runs — browsers, Jellyfin Media Player and the iPhone and Android phone apps, in English and German. Apps that do not show the theme (Android TV, Roku, Kodi) have no Requests.
- **Who sees it:** profiles with a parental rating limit (*Max parental rating*) do not see Requests at all, because Seerr's lists carry no age rating to filter by. A profile restricted only by tags, or only by blocking unrated items, still sees the whole catalogue.
- **Requests go in as Seerr's administrator:** the bridge talks to Seerr with its API key, so every request reaches Seerr as its administrator and is approved at once. Seerr starts on it straight away, and there is no undo from the app. Who may send requests is the bridge's own list, *Allowed Jellyfin User IDs*: left empty, every signed-in user may; once it names anyone, everyone else has no Requests. In that list the user IDs go without dashes — written with dashes they match nobody, and the line in the settings says so for your own account. Requests are always for the regular version, never 4K.
- **Language:** titles and summaries come in Seerr's display language, set in Seerr's general settings (*Settings → General → Display Language*).
- **Pictures** come straight from TMDB (`image.tmdb.org`), so a device needs internet access to show them.

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
ThemeIntroProvider.cs      # The intro for apps that do not show the theme: Jellyfin's intro provider + the library-less entry it hands out
IdentCopy.cs               # The light copy of the intro those apps are given (made once per file, with the server's ffmpeg)
SeerrBridge.cs             # Looks for the Jellyseerr Bridge plugin at start-up: Requests are offered only while it is loaded
Assets/                    # The Villa Cocquette marks and icons (embedded resources)
FileTransformation/        # Bundled File Transformation provider (separate CustomTheme.FileTransformation.dll)
ServiceRegistrator.cs      # Registers the services with Jellyfin's DI container
netflix.css                # Base skin stylesheet (embedded resource)
seerr.css                  # The Requests styles (embedded resource, served only while Requests in the app is on)
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
- *(optional)* [Jellyseerr Bridge](https://github.com/monjaka/jellyfin-plugin-jellyseerr-bridge) and a [Seerr](https://github.com/seerr-team/seerr) server — to request films and series inside the app (see [Requests (Seerr)](#requests-seerr))
- No File Transformation plugin required (it is bundled/provided by this plugin)
- .NET 10 SDK (only to build from source)

## License

[MIT](LICENSE) © Kuschel-code
