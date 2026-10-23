(function () {
    'use strict';

    // Bumped with meta.json at every release. The CSS carries its own stamp in
    // --nf-version; if the two disagree, one of the halves is being served from a
    // cache and that — not the stylesheet — is why a fix "did not work".
    // Declared FIRST: `var` hoists the declaration but not the assignment, so the
    // marker below would write "undefined" if this sat under it.
    var NF_JS_VERSION = '3.4.0';

    // The configuration as the server baked it into THIS page load. CT_CONFIG is
    // replaced for administrators by the live copy from the plugin API, which is
    // the raw settings object; the baked one also carries what only the server can
    // work out (IdentUrl), and it is what the page was actually served with.
    var NF_BOOT = (window.__ctConfig && typeof window.__ctConfig === 'object') ? window.__ctConfig : null;
    function nfBoot(key) { return NF_BOOT ? NF_BOOT[key] : undefined; }

    // Whether this page carries the Requests code. Where requests are off - no Jellyseerr
    // Bridge loaded, or the option off - the server leaves the whole Requests block out of
    // the script (ThemeTransformation.CutRequests: ~95 KB that every page load would carry),
    // so every use of a name of that block outside it asks this first. A function
    // declaration is hoisted, so the answer is right from the first line, and typeof never
    // throws on a name that is not there.
    var nfRqHere = typeof setupSeerrNav === 'function';

    // ---- Keyboard-focus state (html.nf-kb) ----
    // Chromium 83 (JMP's QtWebEngine 5.15) and WebView < 86 cannot parse
    // :focus-visible, so every focus rule in the sheet is dropped there and
    // keyboard / TV-remote users get NO focus indication at all. This reproduces
    // the intent: the class is set while the user navigates with keys and cleared
    // the moment a pointer is used, and netflix.css mirrors each :focus-visible
    // rule as a standalone `html.nf-kb X:focus`.
    // Capture-phase so nothing can swallow it first; the handlers only flip one
    // class and never read layout, and a nav key during video playback is not a
    // hot path. Old engines report 'Up'/'Left'/'Spacebar' instead of the modern
    // key names, so both spellings are accepted.
    (function () {
        try {
            var de = document.documentElement;
            // Deliberately NO Space/Spacebar: it neither moves focus nor needs a ring,
            // and it is the pause key — including it made the most common keypress
            // during playback flip a class on <html>.
            var NAV = { Tab: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
                        Enter: 1, Home: 1, End: 1, PageUp: 1, PageDown: 1,
                        Up: 1, Down: 1, Left: 1, Right: 1 };
            document.addEventListener('keydown', function (e) {
                if (e && NAV[e.key] && !de.classList.contains('nf-kb')) de.classList.add('nf-kb');
            }, true);
            var off = function () { if (de.classList.contains('nf-kb')) de.classList.remove('nf-kb'); };
            document.addEventListener('pointerdown', off, true);
            document.addEventListener('mousedown', off, true);
        } catch (e) {}
    })();

    // Fail-open marker: the generated CSS keys its instant-hide rules on html.nf-js,
    // so a missing/broken script can never blank the home page again.
    try {
        document.documentElement.classList.add('nf-js');
        document.documentElement.setAttribute('data-nf-js', NF_JS_VERSION);
    } catch (e) {}

    var PLUGIN_ID = '78b7b285-8d9e-4e4c-8e4d-7a71f76d4e2a';
    var CT_CONFIG = null;

    // ---- Locale: user-facing strings follow the client language (Jellyfin sets
    // <html lang>); everything else falls back to English. CSS-generated labels
    // (detail play button, tooltips) are driven via custom properties below.
    var LOCALES = {
        en: { home: 'Home', play: 'Play', moreInfo: 'More Info', myList: 'My List', like: 'Like', cw: 'Continue Watching', season: 'Season', seasons: 'Seasons', sound: 'Toggle sound', pause: 'Pause', slide: 'Slide', themeSettings: 'Theme settings', scrollBack: 'Scroll left', scrollFwd: 'Scroll right', labelPlay: 'Play', labelResume: 'Resume', labelReplay: 'Replay', tipWatched: 'Watched', tipFavorite: 'Favorite', tipMore: 'More',
             newReleases: 'New Releases', watchAgain: 'Watch It Again', becauseYouWatched: 'Because you watched {0}', newBadge: 'Recently Added', match: '{0}% Match', minLeft: '{0} min left', hourAbbr: '{0}h', minAbbr: '{0}m', removeRow: 'Remove from row', page: 'Page', more: 'more',
             // Requests (Seerr, through the Jellyseerr Bridge). 'with' is quoted: a
             // reserved word, which only ES5 and later take as a bare key.
             requests: 'Requests', request: 'Request', requesting: 'Requesting…', requested: 'Requested', pending: 'Pending', partial: 'Partly available', available: 'Available',
             // A tile's state tab is one word: "Teilweise verfügbar" overflows a phone's poster.
             partialTab: 'Partial',
             requestMore: 'Request more seasons', requestAll: 'Request all seasons', requestN: 'Request {0} seasons', request1: 'Request 1 season', toTitle: 'Go to title',
             searchPh: 'Search movies and series', notInLib: 'Not in your library', notInLibAny: 'Not in your library – but you can request it',
             rowTrending: 'Trending Now', rowMovies: 'Popular Movies', rowTv: 'Popular Series', rowUpMovies: 'Coming Soon: Movies', rowUpTv: 'Coming Soon: Series',
             movie: 'Movie', series: 'Series', episodes: '{0} episodes', episode1: '1 episode', noEpisodes: 'No episodes yet', done: '“{0}” requested',
             errAlready: 'Already requested', errNone: 'All available seasons are already requested', errForbidden: 'Your profile may not request titles',
             errDisabled: 'Requests are switched off right now', errBlocked: 'This title is blocked', errDown: 'The request service is not reachable right now', errOther: 'Something went wrong. Please try again.',
             close: 'Close', noResults: 'No results', 'with': 'With', genres: 'Genres', creator: 'Created by', director: 'Director', streaming: 'Streaming on' },
        de: { home: 'Startseite', play: 'Abspielen', moreInfo: 'Mehr Infos', myList: 'Meine Liste', like: 'Gefällt mir', cw: 'Weiterschauen', season: 'Staffel', seasons: 'Staffeln', sound: 'Ton an/aus', pause: 'Pause', slide: 'Folie', themeSettings: 'Theme-Einstellungen', scrollBack: 'Nach links', scrollFwd: 'Nach rechts', labelPlay: 'Abspielen', labelResume: 'Weiter', labelReplay: 'Erneut', tipWatched: 'Gesehen', tipFavorite: 'Favorit', tipMore: 'Mehr',
             newReleases: 'Neu hinzugefügt', watchAgain: 'Nochmal ansehen', becauseYouWatched: 'Weil du {0} gesehen hast', newBadge: 'Neu hinzugefügt', match: '{0} % Übereinstimmung', minLeft: 'Noch {0} Min.', hourAbbr: '{0}h', minAbbr: '{0}m', removeRow: 'Aus Zeile entfernen', page: 'Seite', more: 'mehr',
             requests: 'Anfragen', request: 'Anfragen', requesting: 'Wird angefragt…', requested: 'Angefragt', pending: 'Ausstehend', partial: 'Teilweise verfügbar', available: 'Verfügbar',
             partialTab: 'Teilweise',
             requestMore: 'Weitere Staffeln anfragen', requestAll: 'Alle Staffeln anfragen', requestN: '{0} Staffeln anfragen', request1: '1 Staffel anfragen', toTitle: 'Zur Titelseite',
             searchPh: 'Filme und Serien suchen', notInLib: 'Nicht in deiner Bibliothek', notInLibAny: 'Nicht in deiner Bibliothek – aber anfragbar',
             rowTrending: 'Im Trend', rowMovies: 'Beliebte Filme', rowTv: 'Beliebte Serien', rowUpMovies: 'Demnächst: Filme', rowUpTv: 'Demnächst: Serien',
             movie: 'Film', series: 'Serie', episodes: '{0} Folgen', episode1: '1 Folge', noEpisodes: 'Noch keine Folgen', done: '„{0}“ angefragt',
             errAlready: 'Bereits angefragt', errNone: 'Alle verfügbaren Staffeln sind schon angefragt', errForbidden: 'Dein Profil darf keine Titel anfragen',
             errDisabled: 'Anfragen sind gerade ausgeschaltet', errBlocked: 'Dieser Titel ist gesperrt', errDown: 'Der Anfragedienst ist gerade nicht erreichbar', errOther: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
             close: 'Schließen', noResults: 'Keine Ergebnisse', 'with': 'Mit', genres: 'Genres', creator: 'Idee', director: 'Regie', streaming: 'Verfügbar bei' }
    };
    function nfL() {
        var l = (document.documentElement.getAttribute('lang') || navigator.language || 'en').toLowerCase();
        return l.indexOf('de') === 0 ? LOCALES.de : LOCALES.en;
    }
    var nfLastLang = null;
    function applyCssLabels() {
        var l = nfL();
        if (nfLastLang === l) return;
        nfLastLang = l;
        var r = document.documentElement.style;
        r.setProperty('--ct-label-play', "'" + l.labelPlay + "'");
        r.setProperty('--ct-label-resume', "'" + l.labelResume + "'");
        r.setProperty('--ct-label-replay', "'" + l.labelReplay + "'");
        r.setProperty('--ct-tip-watched', "'" + l.tipWatched + "'");
        r.setProperty('--ct-tip-favorite', "'" + l.tipFavorite + "'");
        r.setProperty('--ct-tip-more', "'" + l.tipMore + "'");
    }

    // 10.11 ships NO .btnResume: a resumable title shows .btnPlay plus an un-hidden
    // .btnReplay, so netflix.css reads that state with :has(). Chromium 83 (JMP)
    // cannot parse :has(), so a half-watched title's button said "Play" there.
    // Mirror the state as a plain class those engines can match. Cheap: one
    // querySelectorAll over a container that exists only on detail pages, and the
    // class is only touched when the state actually changes.
    function syncResumeLabel() {
        try {
            // Only the detail template ships .mainDetailButtons — skip the
            // document-wide query on every other route.
            if (!/#!?\/details/i.test(location.hash || '')) return;
            var wraps = document.querySelectorAll('.mainDetailButtons');
            for (var i = 0; i < wraps.length; i++) {
                var replay = wraps[i].querySelector('.btnReplay');
                var resumable = !!(replay && !replay.classList.contains('hide'));
                if (resumable !== wraps[i].classList.contains('nf-resumable')) {
                    wraps[i].classList.toggle('nf-resumable', resumable);
                }
            }
        } catch (e) {}
    }

    // matchMedia() parses the query and allocates a fresh MediaQueryList on EVERY
    // call, and applyDynamic runs once per DOM-mutation frame — the guards below
    // were burning ~180 throwaway objects/sec on pages that then bailed anyway.
    // Cache the LIST objects, not the answers: .matches stays live, so a late
    // layout-tv/layout-mobile class or a viewport change is still honoured.
    var nfMQ = {};
    function nfMM(q) {
        try {
            if (!nfMQ[q]) nfMQ[q] = window.matchMedia(q);
            return !!nfMQ[q].matches;
        } catch (e) { return false; }
    }

    function nfReducedMotion() {
        return nfMM('(prefers-reduced-motion: reduce)');
    }

    // ---- Ambient color: sample the dominant hue of the hero backdrop / detail
    // poster and bleed it as a soft glow into the page background (Apple-TV style).
    // The colour is driven into --nf-ambient-glow, a registered <color> property
    // that cross-fades, so the page subtly shifts hue as the hero rotates.
    var nfAmbientCanvas = null;
    var nfLastAmbientUrl = null;   // dedupe sampling by image URL, not by DOM element
    var nfAmbientTries = {};       // url -> failed load attempts; give up after 2
    var nfAmbientToken = 0;        // only the LATEST sample in flight may write the glow
    function nfApplyAmbient(r, g, b) {
        var s = document.documentElement.style;
        s.setProperty('--nf-ambient', 'rgb(' + r + ',' + g + ',' + b + ')');
        // Alpha clamped to 0.05: the glow is a tint, never a wash over the page.
        s.setProperty('--nf-ambient-glow', 'rgba(' + r + ',' + g + ',' + b + ',0.05)');
    }
    function nfClearAmbient() {
        document.documentElement.style.setProperty('--nf-ambient-glow', 'rgba(0,0,0,0)');
        nfLastAmbientUrl = null;   // so returning to the same page re-samples
    }
    function nfSampleAmbient(url) {
        if (!url || cfg('AmbientColor', true) === false) return;
        // Phones/TVs: a 64px fetch + canvas readback per hero rotation for a
        // 0.05-alpha glow that is near-invisible on those panels. Skip it.
        if (nfCheapMode()) return;
        if (url === nfLastAmbientUrl) return;   // same image (incl. a reused backdrop element) — skip
        if (nfAmbientTries[url] >= 2) return;   // failed twice — stop retrying this image
        nfLastAmbientUrl = url;
        var token = ++nfAmbientToken;
        try {
            var img = new Image();
            img.decoding = 'async';
            // Only CORS-tag cross-origin hosts (Jellyfin behind a CDN/proxy): a same-origin
            // tag would force a second, non-cache-shared fetch of the already-painted backdrop.
            try { if (new URL(url, location.href).origin !== location.origin) img.crossOrigin = 'anonymous'; } catch (e) {}
            img.onload = function () {
                if (token !== nfAmbientToken) return;   // superseded by a newer sample — don't race the write
                try {
                    if (!nfAmbientCanvas) { nfAmbientCanvas = document.createElement('canvas'); nfAmbientCanvas.width = 16; nfAmbientCanvas.height = 16; }
                    var ctx = nfAmbientCanvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 16, 16);
                    var d = ctx.getImageData(0, 0, 16, 16).data;   // throws if cross-origin tainted
                    var r = 0, g = 0, b = 0, w = 0;
                    for (var i = 0; i < d.length; i += 4) {
                        var rr = d[i], gg = d[i + 1], bb = d[i + 2];
                        var mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
                        var sat = mx ? (mx - mn) / mx : 0;
                        var lum = (rr + gg + bb) / 3;
                        if (lum < 26 || lum > 232) continue;   // skip near-black / near-white
                        var wt = sat * sat + 0.12;             // favour the saturated pixels
                        r += rr * wt; g += gg * wt; b += bb * wt; w += wt;
                    }
                    if (!w) return;
                    nfApplyAmbient(Math.round(r / w), Math.round(g / w), Math.round(b / w));
                } catch (e) {}
            };
            img.onerror = function () {
                // A failed load stays retryable (busy server) — but never loops:
                // count the attempts and give this URL up after the second failure.
                nfAmbientTries[url] = (nfAmbientTries[url] || 0) + 1;
                if (nfLastAmbientUrl === url) { nfLastAmbientUrl = null; }
            };
            img.src = url;
        } catch (e) {}
    }
    function nfBackdropAmbientUrl(item) {
        if (typeof ApiClient === 'undefined' || !ApiClient.getScaledImageUrl) return '';
        if (item.BackdropImageTags && item.BackdropImageTags.length) {
            return ApiClient.getScaledImageUrl(item.Id, { type: 'Backdrop', maxWidth: 64, tag: item.BackdropImageTags[0] });
        }
        return '';
    }
    // Detail pages: sample the backdrop image the client already painted (cached),
    // so a detail page glows in the film's palette. Runs even when clips are off.
    var nfDetailAmbLast = 0;
    function setupDetailAmbient() {
        try {
            if (!/#\/details/i.test(location.hash)) return;
            if (nfCheapMode()) return;   // getComputedStyle probe ~4x/sec — not on phones
            var bd = document.querySelector('.backdropImage') || document.querySelector('#itemBackdrop');
            if (!bd) return;
            // getComputedStyle() flushes style for the WHOLE document, and applyDynamic
            // runs on every mutation frame while a detail page streams in its cast,
            // similar and episode rows — so this was a forced style recalc per frame
            // for a value that changes once per item. ~4x/sec is imperceptible for a
            // glow that cross-fades over 1.2s, and nfSampleAmbient still dedupes by
            // URL, so a reused #itemBackdrop with a new film re-samples.
            var now = Date.now();
            if (now - nfDetailAmbLast < 250) return;
            nfDetailAmbLast = now;
            var bg = getComputedStyle(bd).backgroundImage;
            var m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
            if (!m || !m[1] || m[1] === 'none') return;
            nfSampleAmbient(m[1]);
        } catch (e) {}
    }

    // ---- NARROW-VIEWPORT DETAIL BACKDROP ------------------------------------
    // jellyfin-web leaves a gap on the detail page. renderBackdrop() raises the
    // fixed app backdrop only when `!layoutManager.mobile && innerWidth >= 1000`
    // (apps/legacy/controllers/itemDetails/index.js:517), and the in-flow 40vh
    // banner is filled by renderHeaderBackdrop() only `if (layoutManager.mobile)`
    // (:566). A DESKTOP layout in a window under 1000px — a half-screen browser,
    // a small Jellyfin Media Player window, a tablet that does not claim a mobile
    // user agent — matches NEITHER: .backgroundContainer never gains .withBackdrop
    // and #itemBackdrop keeps its height with nothing in it. That height is not
    // ours to collapse; librarybrowser.scss:953 re-asserts `40vh` for exactly
    // `.layout-desktop` under `max-width: 62.5em`, so stock deliberately reserves
    // the band and then leaves it empty. Netflix shows the artwork at every width,
    // so fill the band in that one gap and leave both stock paths alone.
    // The detail page that is actually on screen. The view manager keeps earlier
    // detail pages in the DOM, hidden, and every one of them owns an #itemBackdrop —
    // so document.getElementById answers with whichever came FIRST, which stops
    // being the visible one as soon as a second title has been opened.
    function nfDetailPage() {
        return document.querySelector('.itemDetailPage:not(.hide)');
    }

    // data-nf-art on the page says what artwork its header has to work with:
    //   full — the fixed app backdrop is up (.backgroundContainer.withBackdrop)
    //   band — only the in-flow #itemBackdrop band carries a picture
    //   none — the title has no backdrop of its own or its parent's: albums,
    //          artists, people, most playlists. The sheet then drops the empty
    //          band and brings the cover back beside the title, instead of
    //          opening the page on half a screen of flat black.
    function nfSetArt(page, art) {
        if (page && page.getAttribute('data-nf-art') !== art) page.setAttribute('data-nf-art', art);
    }

    function setupNarrowBackdrop() {
        try {
            // Off a detail page the class has to COME OFF, not just stop being
            // added: applyDynamic re-runs on every route, and leaving it stamped
            // after navigating away is stale state on the documentElement that a
            // later rule would silently inherit.
            if (!/#\/details/i.test(location.hash)) {
                document.documentElement.classList.remove('nf-inflow-backdrop');
                return;
            }
            var page = nfDetailPage();
            var el = page && page.querySelector('#itemBackdrop');
            if (!el) { document.documentElement.classList.remove('nf-inflow-backdrop'); return; }
            // The >=1000px path is live. Nothing to do — and if a resize brought it
            // up over a band WE filled, take ours back down: jellyfin re-runs
            // renderBackdrop() on resize, so both layers would otherwise show the
            // same art at two different scales.
            if (document.querySelector('.backgroundContainer.withBackdrop')) {
                if (el.getAttribute('data-nf-bd')) {
                    el.removeAttribute('data-nf-bd');
                    el.style.backgroundImage = '';
                    el.style.backgroundAttachment = '';
                    el.style.backgroundPosition = '';
                }
                document.documentElement.classList.remove('nf-inflow-backdrop');
                nfSetArt(page, 'full');
                return;
            }
            // The layout-mobile path is live: stock's imageLoader already put the
            // art here inline. Claim nothing, just stamp the class so the seam
            // dissolve below applies on engines without :has().
            var id = (location.hash.match(/[?&]id=([a-f0-9]+)/i) || [])[1];
            if (!id) return;
            if (el.style.backgroundImage && !el.getAttribute('data-nf-bd')) {
                // Stock's chain ends on the PRIMARY image, so for an album or a
                // playlist this band is the cover, cropped to a letterbox. That
                // is not a backdrop — the cover is shown whole beside the title.
                if (/\/Images\/Primary/i.test(el.style.backgroundImage)) {
                    document.documentElement.classList.remove('nf-inflow-backdrop');
                    nfSetArt(page, 'none');
                } else {
                    document.documentElement.classList.add('nf-inflow-backdrop');
                    nfSetArt(page, 'band');
                }
                return;
            }
            // Guard by ITEM ID rather than a boolean: in-app forward navigation
            // (pushState) never fires hashchange and this element is reused, so a
            // boolean would paint the first film's art behind every later one.
            // Set BEFORE the async hop — applyDynamic runs on every mutation frame
            // and would otherwise launch a request per frame until the first lands.
            if (el.getAttribute('data-nf-bd') === id) return;
            if (typeof ApiClient === 'undefined' || !ApiClient.getItem || !ApiClient.getCurrentUserId || !ApiClient.getScaledImageUrl) return;
            var uid = ApiClient.getCurrentUserId();
            if (!uid) return;
            el.setAttribute('data-nf-bd', id);
            ApiClient.getItem(uid, id).then(function (item) {
                // Follows getItemBackdropImageUrl (utils/jellyfin-apiclient/backdropImage.ts)
                // for the item's own backdrop and then the parent's (how an episode
                // or a season borrows the series art) — but NOT its last step, the
                // primary image: a square cover or a headshot stretched across a
                // 40vh band is a crop of the wrong picture. Those pages take the
                // cover header instead (data-nf-art="none").
                var w = nfW(window.innerWidth || 1000);
                var url = '';
                if (item.BackdropImageTags && item.BackdropImageTags.length) {
                    url = ApiClient.getScaledImageUrl(item.Id, { type: 'Backdrop', index: 0, tag: item.BackdropImageTags[0], maxWidth: w });
                } else if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) {
                    url = ApiClient.getScaledImageUrl(item.ParentBackdropItemId, { type: 'Backdrop', index: 0, tag: item.ParentBackdropImageTags[0], maxWidth: w });
                }
                if (!url) {
                    // data-nf-bd STAYS on this id: it is the "already answered"
                    // latch, and clearing it would re-ask the server on every
                    // mutation frame for as long as the page is open. What does go
                    // is any picture this function painted for the PREVIOUS title —
                    // the element is reused across in-app navigation.
                    if (el.getAttribute('data-nf-bd') !== id || location.hash.indexOf(id) === -1) return;
                    el.style.backgroundImage = '';
                    document.documentElement.classList.remove('nf-inflow-backdrop');
                    nfSetArt(page, 'none');
                    return;
                }
                // Decode before painting, or the band flashes its empty colour and
                // then snaps. Re-check the route on load: a slow image must not
                // paint itself over whatever page the user has moved on to.
                var pre = new Image();
                pre.onload = function () {
                    if (el.getAttribute('data-nf-bd') !== id) return;
                    if (location.hash.indexOf(id) === -1) return;
                    el.style.backgroundImage = 'url("' + url + '")';
                    // Stock's own mobile treatment (librarybrowser.scss:576): a band
                    // this short with `attachment: fixed` would window a
                    // viewport-sized image and hold still while the page scrolls.
                    el.style.backgroundAttachment = 'scroll';
                    el.style.backgroundPosition = 'top center';
                    document.documentElement.classList.add('nf-inflow-backdrop');
                    nfSetArt(page, 'band');
                };
                pre.onerror = function () { el.removeAttribute('data-nf-bd'); };
                pre.src = url;
            }, function () { el.removeAttribute('data-nf-bd'); });
        } catch (e) {}
    }

    // Detail-page episode / season strips are hidden-scrollbar horizontal rows
    // exactly like the home rows, but they never got the chevrons — and a mouse
    // wheel does not scroll a horizontal-only container in Chromium, so on
    // Jellyfin Media Player or any mouse-only desktop episode 5 onward was simply
    // unreachable. Throttled because scrollWidth/clientWidth are forced-layout
    // reads and applyDynamic runs on every body-mutation frame.
    // The episode strip turns a season's rows into a shelf of cards. Jellyfin renders
    // an album's tracks and a playlist's entries into the SAME container with the
    // same row markup, and as a shelf those became a sideways strip of song titles.
    // Mark what the rows are, so the sheet only shelves episodes. Cheap: two id
    // lookups under the one visible page, and an attribute write only on change.
    function setupDetailLists() {
        try {
            if (!/#\/details/i.test(location.hash)) return;
            var page = nfDetailPage();
            if (!page) return;
            ['listChildrenCollapsible', 'childrenCollapsible'].forEach(function (id) {
                var sec = page.querySelector('#' + id);
                if (!sec) return;
                var first = sec.querySelector('.itemsContainer > .listItem');
                var kind = !first ? '' : (first.getAttribute('data-type') === 'Episode' ? 'strip' : 'rows');
                if ((sec.getAttribute('data-nf-list') || '') === kind) return;
                if (kind) sec.setAttribute('data-nf-list', kind); else sec.removeAttribute('data-nf-list');
            });
            nfMarkAbout(page);
            nfClampTags(page);
        } catch (e) {}
    }

    // data-nf-about="bare": the About column has nothing to read — no synopsis,
    // tagline, tags, track pickers or life dates — so the facts beside it would
    // hang alone in the second column (an album's "Genre: Electronic" floating
    // over its track list). The sheet then sets them in the first column. Class
    // and text reads only, no layout: this runs on every mutation frame.
    var NF_ABOUT_CONTENT = '.overview:not(.hide), .tagline:not(.hide), .itemTags:not(.hide), ' +
        '.trackSelections:not(.hide), #itemBirthday:not(.hide), #itemBirthLocation:not(.hide), ' +
        '#itemDeathDate:not(.hide), #seriesAirTime:not(.hide)';
    function nfMarkAbout(page) {
        var sec = page.querySelector('.detailPagePrimaryContent > .detailSection');
        if (!sec) return;
        var bare = true;
        var nodes = sec.querySelectorAll(NF_ABOUT_CONTENT);
        for (var i = 0; i < nodes.length; i++) {
            if (/\S/.test(nodes[i].textContent || '')) { bare = false; break; }
        }
        var want = bare ? 'bare' : '';
        if ((page.getAttribute('data-nf-about') || '') !== want) {
            if (want) page.setAttribute('data-nf-about', want); else page.removeAttribute('data-nf-about');
        }
        // data-nf-cover="none": the title has no poster either. Jellyfin still builds
        // the image card, with an EMPTY data-src (a loaded one has had the attribute
        // removed by the lazy loader; one still loading carries its URL), and the
        // cover header would show it as a blank square beside the title.
        var img = page.querySelector('.detailImageContainer .cardImageContainer');
        var cover = (img && img.getAttribute('data-src') === '') ? 'none' : '';
        if ((page.getAttribute('data-nf-cover') || '') !== cover) {
            if (cover) page.setAttribute('data-nf-cover', cover); else page.removeAttribute('data-nf-cover');
        }
    }

    // Tags: two lines, then "more". A metadata provider hands over every keyword it
    // has — thirty is ordinary — and Jellyfin prints them all between the synopsis
    // and the rest of the page. The links that do not fit on two lines move into a
    // hidden span and a "more" control takes their place in the sentence, after the
    // last comma — Netflix's "Cast: A, B, C, more".
    // Judged once per render AND per layout epoch. Jellyfin rebuilds the list with
    // innerHTML, which drops everything added here and replaces the first link, so
    // a new first link means a new list. nfLayoutEpoch moves when the window is
    // resized or a webfont arrives: where the second line ends depends on both, and
    // a list measured in the fallback face wrapped its control onto a third line
    // the moment Inter loaded. The layout reads happen only on those two signals.
    var nfLayoutEpoch = 0;
    function nfClampTags(page) {
        var tags = page.querySelector('.itemTags');
        if (!tags) return;
        var first = tags.querySelector('a');
        var sameList = tags._nfFirst === first;
        if (sameList && tags._nfEpoch === nfLayoutEpoch) return;
        tags._nfFirst = first;
        tags._nfEpoch = nfLayoutEpoch;
        // Opened by the reader: it stays open for as long as this list is on screen.
        if (sameList && tags.classList.contains('nf-tags-open')) return;
        tags.classList.remove('nf-tags-open');
        // Put back whatever an earlier pass moved, so the list is measured whole.
        var oldRest = tags.querySelector('.nf-tags-rest');
        if (oldRest) {
            while (oldRest.firstChild) tags.insertBefore(oldRest.firstChild, oldRest);
            tags.removeChild(oldRest);
        }
        var oldMore = tags.querySelector('.nf-tags-more');
        if (oldMore) tags.removeChild(oldMore);
        if (!first || tags.classList.contains('hide')) return;

        var links = tags.querySelectorAll('a');
        var top0 = first.offsetTop;
        var lh = parseFloat(getComputedStyle(tags).lineHeight) || 20;
        var limit = top0 + lh * 1.5;                 // anything starting below this is line three
        var keep = links.length;
        for (var i = 0; i < links.length; i++) {
            if (links[i].offsetTop >= limit) { keep = i; break; }
        }
        if (keep >= links.length || keep < 1) return;

        var rest = document.createElement('span');
        rest.className = 'nf-tags-rest';
        var more = document.createElement('button');
        more.type = 'button';
        more.className = 'nf-tags-more';
        more.textContent = nfL().more;
        more.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            tags.classList.add('nf-tags-open');
        });
        // Everything from link `keep` on goes into the rest; the comma before it
        // stays, so the control reads as the next item in the list.
        var node = links[keep];
        while (node) { var next = node.nextSibling; rest.appendChild(node); node = next; }
        tags.appendChild(more);
        tags.appendChild(rest);
        // The control itself needs room on line two: hand back links until it has it.
        for (var guard = 0; guard < 8 && more.offsetTop >= limit && keep > 1; guard++) {
            keep--;
            var link = links[keep];
            var comma = link.nextSibling;            // the ", " that followed it
            if (comma && comma.nodeType === 3) rest.insertBefore(comma, rest.firstChild);
            rest.insertBefore(link, rest.firstChild);
        }
    }

    function setupDetailRowNav() {
        try {
            if (!/#\/details/i.test(location.hash)) return;
            var now = Date.now();
            if (!nfSettlePass && now - nfLastDetailNav < 1000) return;
            nfLastDetailNav = now;
            document.querySelectorAll('.itemDetailPage .detailPagePrimaryContent #listChildrenCollapsible, .itemDetailPage .detailPagePrimaryContent #childrenCollapsible').forEach(function (sec) {
                // A vertical list has nothing to page sideways.
                if (sec.getAttribute('data-nf-list') === 'rows') return;
                var strip = sec.querySelector('.itemsContainer');
                if (!strip || strip._nfNav) return;
                if (strip.scrollWidth <= strip.clientWidth + 4) return;   // nothing to page
                strip._nfNav = true;
                // The strip IS the flex track: cardStep() reads track.firstElementChild
                // and pageCount() reads track.children.length, which are the cards
                // only when track === the flex container.
                nfRowNav(sec, strip, strip);
            });
        } catch (e) {}
    }

    // ---- Jellyfin 12.0 "Modern" layout ----
    // 12.0 made the Modern layout the default for every non-TV client. The legacy
    // .skinHeader still exists there — libraryMenu still builds .headerLeft /
    // .headerRight inside it, and this script still injects the logo, nav tabs and
    // settings button successfully — but its wrapper carries an inline
    // `display: none`, so none of it is ever painted. The real chrome is a MUI
    // AppBar. Everything below keys on the RENDERED DOM rather than on a layout
    // setting, because:
    //   * html.layout-desktop / .layout-mobile are set in BOTH layouts (Modern
    //     re-adds them), so the root classes cannot discriminate;
    //   * the `layout` app setting is only ever persisted from the Display
    //     preferences save path, so on a default install the key is absent;
    //   * this script runs inline at the end of the body, before layoutManager has run at all.
    //
    // offsetParent is NOT usable as the visibility probe: .skinHeader is
    // position:fixed in stock and in this theme, and offsetParent is null for any
    // fixed element — the test would report "hidden" in every layout. getClientRects()
    // is empty inside a display:none ancestor and non-empty for a visible fixed bar.
    // getComputedStyle is no good either: a child of a display:none parent still
    // computes its own display normally.
    //
    // getClientRects() forces a style + layout flush, and applyDynamic calls this —
    // directly and through addButton / syncHeaderScrolled / setupHeaderScroll — several
    // times per mutation frame. Memoised on nfPassId (bumped once per applyDynamic
    // pass, the same pattern activeHomeContainer uses) so the flush happens at most
    // once per pass instead of four times.
    var nfHdrCache = { frame: -1, el: null };
    function nfLegacyHeader() {
        if (nfHdrCache.frame === nfPassId && (nfHdrCache.el === null || nfHdrCache.el.isConnected)) {
            return nfHdrCache.el;
        }
        // No `|| querySelector('.skinHeader')` fallback: if the :not() form found
        // nothing then every .skinHeader carries .osdHeader, and this function must
        // return null for those anyway — the fallback could only ever be discarded.
        var h = document.querySelector('.skinHeader:not(.osdHeader)');
        nfHdrCache.frame = nfPassId;
        nfHdrCache.el = (h && h.getClientRects().length > 0) ? h : null;
        return nfHdrCache.el;
    }

    // True on the 12.0 dashboard, where the branding CustomCss carrying this
    // theme is not mounted at all — so nothing injected there can be styled.
    function nfIsDashboard() {
        return document.body && document.body.classList.contains('dashboardDocument');
    }

    // True when the visible chrome is the Modern MUI app bar. Keyed on the BAR, not
    // its toolbar: on the /video route AppToolbar renders null, so the AppBar is
    // present but empty — and that is exactly when html.nf-modern still has to be
    // set, because the stylesheet uses it to scope the player's OSD header rules
    // (in the legacy layout that same .skinHeader.osdHeader element is the real
    // header and must keep its own geometry). Excludes the dashboard, where the
    // branding CustomCss carrying this theme is not mounted at all.
    function nfIsModernChrome() {
        return !nfIsDashboard() && !!document.querySelector('header.MuiAppBar-root');
    }

    // The Modern toolbar to hang the settings button off, or null. Unlike
    // nfIsModernChrome this DOES require the toolbar, so nothing is inserted into
    // the empty AppBar the /video route leaves over the player.
    function nfModernToolbar() {
        if (nfIsDashboard()) return null;
        var bar = document.querySelector('header.MuiAppBar-root');
        if (!bar) return null;
        return bar.querySelector('.MuiToolbar-root');
    }

    // "Cheap mode" — touch/low-power WebViews (phone/tablet/TV layout) and metered /
    // save-data links. Gates the extras that dominate mobile data/CPU/battery: autoplay
    // preview clips are skipped entirely here (a single idle Home page otherwise streams
    // full-bitrate video every ~20s). Re-checked per call so a late layout-tv/layout-mobile
    // class is honoured; matchMedia/connection reads are cheap.
    function nfCheapMode() {
        try {
            // The official mobile apps inject window.NativeShell before jellyfin-web
            // boots — but so does Jellyfin Media Player / Jellyfin Desktop (it is how
            // jellyfin-web loads mpv), so bare presence is NOT a mobile signal.
            // Exclude JMP by its own globals (jmpInfo / Qt webchannel) and by
            // AppHost.appName ("Jellyfin Media Player" / "Jellyfin Desktop"), then
            // trust the prong for the real mobile shells.
            if (window.NativeShell && !window.jmpInfo && !(window.qt && window.qt.webChannelTransport)) {
                var nfShellApp = '';
                try { nfShellApp = String((window.NativeShell.AppHost && window.NativeShell.AppHost.appName && window.NativeShell.AppHost.appName()) || ''); } catch (eApp) {}
                if (!/media player|desktop/i.test(nfShellApp)) return true;
            }
            if (nfMM('(hover: none)') || nfMM('(prefers-reduced-data: reduce)')) return true;
            // Samsung Android devices (phones AND tablets, browsers AND WebViews)
            // misreport (hover: hover) — the firmware registers the touchscreen as
            // a touchpad (crbug 41445959, unfixed since ~2015). Catch touch-first
            // hardware positively: touch points + a mobile UA. Touch LAPTOPS have
            // maxTouchPoints > 0 too but no mobile token, so they stay desktop.
            var nfUa = navigator.userAgent || '';
            if (navigator.maxTouchPoints > 0 && /android|iphone|ipad|ipod|mobile|silk/i.test(nfUa)) return true;
            // iPadOS 13+ masquerades as macOS; the touch points give it away.
            if (navigator.maxTouchPoints > 1 && /macintosh/i.test(nfUa)) return true;
            var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (conn && (conn.saveData === true || /(^|[^0-9])(2g|slow-2g)/.test(conn.effectiveType || ''))) return true;
            // Check BOTH roots: jellyfin's layoutManager has moved the layout
            // class between <html> and <body> across versions — a wrong guess
            // here silently re-enables every clip stream on phones.
            var c = document.documentElement.classList;
            var b = document.body ? document.body.classList : c;
            return c.contains('layout-tv') || c.contains('layout-mobile')
                || b.contains('layout-tv') || b.contains('layout-mobile');
        } catch (e) { return false; }
    }

    // ---- Session cache (stale-while-revalidate): home rows/hero/CW build in ONE
    // frame from cached data on every revisit instead of popping in row by row.
    // Keys carry the user id (never cross accounts) and a fingerprint of the
    // settings that change what the cached HTML would contain.
    function nfCacheKey(part, uid) {
        // uid is passed explicitly on WRITES (captured when the fetch started):
        // resolving it at write time could file a slow response arriving after a
        // user switch under the NEW account's key.
        uid = uid || (typeof ApiClient !== 'undefined' && ApiClient.getCurrentUserId && ApiClient.getCurrentUserId()) || 'anon';
        // Every setting that changes WHAT a cached row contains must be in the
        // fingerprint, or turning a rail off would leave it on screen until the
        // TTL expired.
        var fp = [cfg('CardStyle', 'mixed'), String(cfg('GenreRowsExclude', '')),
            cfg('MyListRow', true), cfg('BecauseYouWatched', true),
            cfg('NewReleasesRow', true), cfg('WatchAgainRow', true)].join('|');
        return 'nfct1:' + uid + ':' + fp + ':' + part;
    }
    function nfCacheGet(part, maxAgeMs) {
        try {
            var raw = sessionStorage.getItem(nfCacheKey(part));
            if (!raw) return null;
            var obj = JSON.parse(raw);
            if (!obj || (Date.now() - obj.ts) > maxAgeMs) return null;
            return obj.v;
        } catch (e) { return null; }
    }
    // The My List rail is served from cache; adding/removing a favourite must
    // invalidate it or the + button appears to do nothing until the TTL expires.
    function nfInvalidateRails(uid) {
        try { sessionStorage.removeItem(nfCacheKey('rails', uid)); } catch (e) {}
    }

    function nfCacheSet(part, v, uid) {
        try { sessionStorage.setItem(nfCacheKey(part, uid), JSON.stringify({ ts: Date.now(), v: v })); } catch (e) {}
    }

    // ---- Artwork sizing: request at the DEVICE's pixel density, snapped to a
    // ladder so the server's resize cache stays bounded. Asking for CSS pixels
    // on a Retina/4K screen means every tile is upscaled — the single biggest
    // reason a themed UI looks soft next to the real thing. Capped at 2x:
    // 3x phones cost 2.25x the bytes for no perceptible gain.
    var NF_W = [240, 320, 400, 500, 640, 800, 1000, 1280, 1600, 1920, 2560, 3200];
    function nfW(cssPx) {
        var want = cssPx * Math.min(window.devicePixelRatio || 1, 2);
        for (var i = 0; i < NF_W.length; i++) { if (NF_W[i] >= want) return NF_W[i]; }
        return NF_W[NF_W.length - 1];
    }
    function nfImg(id, type, tag, cssPx) {
        if (!id || !tag) return '';
        return ApiClient.getScaledImageUrl(id, { type: type, tag: tag, maxWidth: nfW(cssPx) });
    }

    // ---- The size a row tile ACTUALLY renders at. This used to be a hardcoded 340
    // ("widest a landscape row card reaches") — the DESKTOP maximum — so a 149px
    // phone tile pulled the 800px ladder rung: 4x the pixels and ~3x the bytes on
    // every one of ~120 lazily-loaded tiles per home build, plus the decode cost of
    // an 800x450 bitmap into a 149x84 box on a low-end WebView.
    // netflix.css divides the row into N whole tiles (--nf-tile); mirror that ladder
    // here. The CardSize/CardStyle branches mirror CssGenerator.cs, whose width
    // rules are !important and appended AFTER netflix.css — a mirror that only knew
    // the defaults would UNDER-request on "large" and make those tiles soft.
    function nfTilesAcross() {
        var vw = window.innerWidth || 1280;
        var narrow = vw <= 559;
        var n = narrow ? 2.35 : vw <= 799 ? 3 : vw <= 1099 ? 4 : vw <= 1399 ? 5 : vw >= 1900 ? 7 : 6;
        var d = 0;
        var size = cfg('CardSize', 'normal');
        if (size === 'small') d += 1;
        else if (size === 'large') d -= 1;
        if (cfg('CardStyle', 'mixed') === 'portrait') d += 2;   // 2:3 tiles are much narrower
        // The phone rung caps the delta at +1, exactly like CssGenerator.AppendTileLadder.
        n += narrow ? Math.min(d, 1) : d;
        // Sum FIRST, then floor at the same 1.6 CssGenerator.TileExpr uses. Flooring
        // mid-expression (at 2) made the mirror disagree with the CSS on
        // CardSize=large, and it under-requested artwork exactly where the presets
        // stretch the ladder — the thing this mirror exists to prevent.
        return Math.max(1.6, n);
    }
    function nfTileCssWidth() {
        var vw = window.innerWidth || 1280;
        return Math.ceil((vw * 0.92) / nfTilesAcross());
    }
    // --nf-tile-wide: Continue Watching and the episode strip. One row tile, except
    // on the portrait card style, where CssGenerator makes it two poster columns —
    // and a still requested at one column's width would be upscaled 2x.
    function nfWideTileCssWidth() {
        var w = nfTileCssWidth();
        return cfg('CardStyle', 'mixed') === 'portrait' ? w * 2 + 6 : w;
    }

    // The server's own artwork, or a third party's (TMDB's, on the Requests page): an
    // absolute URL on another origin than the server's - ApiClient's address, else the
    // page's. A relative URL is the server's.
    var NF_ORIGIN = /^(?:[a-z][a-z0-9+.-]*:)?\/\/[^\/?#]+/i;
    function nfOwnArt(u) {
        var m = NF_ORIGIN.exec(u || '');
        if (!m) return true;
        var srv = '';
        try { srv = (typeof ApiClient !== 'undefined' && ApiClient.serverAddress && ApiClient.serverAddress()) || ''; } catch (e) {}
        var s = NF_ORIGIN.exec(srv || location.href);
        return !!s && s[0].toLowerCase() === m[0].toLowerCase();
    }

    // ---- Lazy row artwork: a home build used to fire ~120 thumbnail requests at
    // once. Cards carry data-nf-bg; one shared observer fills them near-viewport,
    // decoding BEFORE the swap so tiles cross-fade in instead of popping.
    var nfImgIO = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            nfImgIO.unobserve(el);
            var u = el.getAttribute('data-nf-bg');
            if (!u) return;
            var pre = new Image();
            var swapped = false;
            var swap = function () {
                if (swapped || !el.isConnected) return;
                swapped = true;
                el.style.backgroundImage = "url('" + u + "')";
                el.removeAttribute('data-nf-bg');
                el.classList.add('nf-img-in');
                // Done with it — drop it from the tracking array. A JS reference to
                // any node in a detached tree retains the ENTIRE tree in Blink, so
                // one stale card here pinned a whole home container (hero + 8-10
                // rows + ~150 cards) for as long as the user browsed elsewhere.
                var oi = nfObserved.indexOf(el);
                if (oi !== -1) nfObserved.splice(oi, 1);
            };
            pre.onload = swap;
            // A preload that failed on a third party's server is NOT handed to CSS: the
            // browser would fetch it a second time, and that fetch carries the page's
            // address as its Referer (measured: no-referrer keeps it off the Image, not
            // off the CSS fetch). The tile keeps its placeholder, and is done with. The
            // server's own art keeps the old way: CSS asks for it all the same.
            pre.onerror = function () {
                if (nfOwnArt(u)) { swap(); return; }
                if (swapped) return;
                swapped = true;   // the hand-over below leaves it alone too
                el.removeAttribute('data-nf-bg');
                var oi = nfObserved.indexOf(el);
                if (oi !== -1) nfObserved.splice(oi, 1);
            };
            // A request that neither loads nor errors (busy server) would otherwise
            // leave the tile blank forever — hand it to the browser after 4s.
            setTimeout(swap, 4000);
            pre.src = u;
        });
    }, { rootMargin: '50%' }) : null;
    // ---- Stuck/failed artwork rescue -------------------------------------
    // Jellyfin's own image loader sets the element to opacity:0 and only
    // restores it when the image LOADS — it has NO error path (verified in
    // 10.11 imageLoader.js). So any request that fails or times out (busy
    // server, transcode hogging it, transient network) leaves a permanently
    // invisible circle: the "cast faces don't load" symptom. We retry those,
    // then fall back to a readable initial instead of an empty dark disc.
    function nfInitialFallback(el) {
        var card = el.closest && el.closest('.card');
        var nameEl = card && card.querySelector('.cardText-first, .cardText');
        var name = ((nameEl && nameEl.textContent) || '').trim();
        el.removeAttribute('data-src');
        el.classList.remove('lazy-hidden');
        el.classList.add('nf-noimg');
        el.setAttribute('data-nf-initial', (name.charAt(0) || '?').toUpperCase());
    }

    function nfArmRescue(el) {
        if (el._nfImgTimer) return;
        el._nfImgTimer = setTimeout(function () {
            el._nfImgTimer = null;
            if (!document.body.contains(el)) return;
            // Loaded in the meantime? Jellyfin drops both on success.
            if (!el.classList.contains('lazy-hidden')) return;
            var src = el.getAttribute('data-src');
            if (!src) return;
            var tries = (el._nfTries || 0) + 1;
            el._nfTries = tries;
            var probe = new Image();
            probe.onload = function () {
                el.style.backgroundImage = "url('" + src + "')";
                el.removeAttribute('data-src');
                el.classList.remove('lazy-hidden');
                el.classList.add('lazy-image-fadein');
            };
            probe.onerror = function () {
                // Re-arm THIS element only. Recursing into the full scanner meant a
                // burst of N failures fired N whole-document attribute-selector
                // queries — O(n^2), on a page that is already struggling, which is
                // the exact condition this rescue exists for.
                if (tries < 2) { nfArmRescue(el); return; }
                nfInitialFallback(el);
            };
            probe.src = src;
        }, 5000 * (el._nfTries ? 2 : 1));
    }

    function nfRescueStuckImages() {
        try {
            document.querySelectorAll('.cardImageContainer.lazy-hidden[data-src]').forEach(nfArmRescue);
        } catch (e) {}
    }

    var nfObserved = [];
    function nfLazyImages(root) {
        if (nfImgIO) {
            // Prune targets that left the DOM before ever intersecting — the
            // observer would otherwise pin their whole card subtrees forever.
            nfObserved = nfObserved.filter(function (el) {
                if (el.isConnected) return true;
                nfImgIO.unobserve(el);
                return false;
            });
        }
        root.querySelectorAll('[data-nf-bg]').forEach(function (el) {
            if (nfImgIO) { nfImgIO.observe(el); nfObserved.push(el); }
            else {
                el.style.backgroundImage = "url('" + el.getAttribute('data-nf-bg') + "')";
                el.removeAttribute('data-nf-bg');
            }
        });
    }

    var FONTS = [
        ['inter', 'Inter'], ['poppins', 'Poppins'], ['montserrat', 'Montserrat'],
        ['roboto', 'Roboto'], ['oswald', 'Oswald'], ['raleway', 'Raleway'],
        ['nunito', 'Nunito'], ['bebas', 'Bebas Neue'], ['lato', 'Lato'],
        ['sourcesans', 'Source Sans'], ['ubuntu', 'Ubuntu'], ['playfair', 'Playfair Display'],
        ['quicksand', 'Quicksand'], ['comfortaa', 'Comfortaa'], ['righteous', 'Righteous']
    ];

    var AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (c) { return [c, c]; });

    // Mirrors the dashboard configuration page.
    var SECTIONS = [
        // `netflix` first: when the stored value matches no option (an older server
        // DLL without the property) the browser shows the first one.
        ['Brand', [
            ['Brand', 'select', 'Theme', [['netflix','Netflix'],['villa','Villa Cocquette']]]
        ]],
        ['Features', [
            ['CleanHome', 'toggle', 'Clean Netflix home (hide native rows)'],
            ['OwnInjection', 'toggle', 'Self-contained inject (no File Transformation)'],
            ['ProvideFileTransformation', 'toggle', 'Provide File Transformation to other plugins'],
            ['HeroBillboard', 'toggle', 'Hero carousel (replaces Media Bar)'],
            ['GenreRows', 'toggle', 'Genre rows (replaces Home Sections)'],
            ['GenreRowsExclude', 'text', 'Hidden genre rows (comma-separated)'],
            ['MyListRow', 'toggle', '"My List" row'],
            ['BecauseYouWatched', 'toggle', '"Because you watched" rows'],
            ['NewReleasesRow', 'toggle', '"New Releases" row'],
            ['WatchAgainRow', 'toggle', '"Watch It Again" row'],
            ['RatingPlate', 'toggle', 'Rating plate at playback start'],
            ['AmbientColor', 'toggle', 'Ambient colour glow from artwork'],
            ['FilmGrain', 'toggle', 'Film-grain texture'],
            ['NavTabs', 'toggle', 'Top nav tabs (replaces Custom Tabs)'],
            ['HoverPreviewCard', 'toggle', 'Hover expand card'],
            ['PreviewClips', 'toggle', 'Autoplay preview on hover'],
            ['TopTenRow', 'toggle', 'Top 10 numbers (first row)'],
            ['MatchScore', 'toggle', 'Green "x% Match" rating'],
            ['GlassEffect', 'toggle', 'Glass blur'],
            ['OledBlack', 'toggle', 'OLED pure black']
        ]],
        ['Colors', [
            ['SeasonalTheme', 'select', 'Color preset', [['default','Default'],['monochrome','Monochrome'],['colorful','Colorful'],['christmas','Christmas'],['halloween','Halloween'],['summer','Summer'],['ocean','Ocean']]],
            ['AccentColor', 'color', 'Accent color'],
            ['BgColor', 'color', 'Background'],
            ['TextColor', 'color', 'Text color'],
            ['MutedColor', 'color', 'Muted text'],
            ['ProgressColor', 'select', 'Progress bar', [['accent','Accent'],['red','Red'],['green','Green'],['blue','Blue'],['purple','Purple']]]
        ]],
        ['Intro', [
            ['IdentEnabled', 'toggle', 'Play an intro before films (the theme plays it)'],
            ['IdentPath', 'text', 'Intro video file on the server (MP4)'],
            ['IdentEpisodes', 'toggle', 'Also before an episode started on its own'],
            ['IdentSkippable', 'toggle', 'Skippable (Esc, Enter, a click, OK on a remote)'],
            ['IdentApple', 'toggle', 'Also on iPhone, iPad and Safari (experimental)'],
            ['IdentApps', 'toggle', 'Also in apps without the theme (Android TV, Roku …)']
        ]],
        ['Requests', [
            ['SeerrRequests', 'toggle', 'Requests in the app (Seerr, through the Jellyseerr Bridge plugin)']
        ]],
        ['Logo & Header', [
            ['LogoStyle', 'select', 'Logo style', [['jellyfin','Jellyfin'],['netflix','Netflix N'],['letter','Letter'],['custom','Custom image'],['none','None']]],
            ['LogoLetter', 'select', 'Logo letter', AZ],
            ['CustomLogoUrl', 'text', 'Logo image URL'],
            ['NavLeft', 'toggle', 'Left-aligned nav (Netflix)'],
            ['HeaderBlur', 'toggle', 'Header blur effect']
        ]],
        ['Elements', [
            ['ShowBadges', 'toggle', 'Unplayed badges'],
            ['ShowPlayed', 'toggle', 'Watched checkmarks'],
            ['ShowBackdrop', 'toggle', 'Backdrop image'],
            ['RoundCast', 'toggle', 'Round cast images'],
            ['ShowDescription', 'toggle', 'Description'],
            ['ShowTags', 'toggle', 'Tags'],
            ['ShowExternalLinks', 'toggle', 'External links'],
            ['ShowSimilar', 'toggle', 'Similar titles'],
            ['SpoilerMode', 'toggle', 'Spoiler mode']
        ]],
        ['Detail Buttons', [
            ['ShowBtnWatched', 'toggle', 'Watched'],
            ['ShowBtnFavorite', 'toggle', 'Favorite'],
            ['ShowBtnMore', 'toggle', 'More']
        ]],
        ['Layout', [
            ['FontFamily', 'select', 'Font', FONTS],
            ['FontSize', 'select', 'Font size', [['small','Small'],['normal','Normal'],['large','Large']]],
            ['CardRadius', 'select', 'Card rounding', [['0','Square'],['4','Light'],['8','Medium'],['16','Round']]],
            ['CardSize', 'select', 'Card size', [['small','Small'],['normal','Normal'],['large','Large']]],
            ['CardStyle', 'select', 'Card shape', [['mixed','Mixed'],['portrait','Portrait'],['landscape','Landscape']]],
            ['CardHoverScale', 'toggle', 'Card hover zoom'],
            ['CardInfoOverlay', 'toggle', 'Card info overlay'],
            ['GradientStrength', 'select', 'Gradient', [['light','Light'],['medium','Medium'],['heavy','Heavy']]],
            ['TitleSize', 'select', 'Title size', [['small','Small'],['large','Large'],['huge','Huge']]],
            ['AnimSpeed', 'select', 'Animations', [['fast','Fast'],['normal','Normal'],['slow','Slow'],['off','Off']]],
            ['SidebarCompact', 'toggle', 'Compact sidebar'],
            ['AmbientGlow', 'toggle', 'Ambient glow']
        ]]
    ];

    var INT_KEYS = { CardRadius: true };

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function cfg(key, def) {
        if (!CT_CONFIG || CT_CONFIG[key] === undefined || CT_CONFIG[key] === null) return def;
        return CT_CONFIG[key];
    }

    // Netflix-style "x% Match" from a community rating. Community ratings are on a
    // 0-10 scale, so we guard the range — a stray value (e.g. a percent-scale or
    // bad metadata rating) must never render "764% Match". Returns '' when invalid.
    function matchHtml(rating, cls) {
        var n = parseFloat(rating);
        if (isNaN(n) || n < 0 || n > 10) return '';
        return '<span class="' + cls + '">' + nfL().match.replace('{0}', Math.round(n * 10)) + '</span>';
    }

    // Runtime text from RunTimeTicks: "1h 42m", in every language. That is the form
    // Jellyfin itself prints on the detail page, the episode cards and the lists,
    // and it does not translate it — so the German popup's "1 Std. 42 Min." was one
    // runtime read two ways a click apart. Still routed through LOCALES, so a
    // language whose Jellyfin output differs can say so in one place.
    function nfRuntimeText(ticks) {
        var mins = Math.round((parseInt(ticks, 10) || 0) / 600000000);
        if (mins <= 0) return '';
        var l = nfL();
        var h = Math.floor(mins / 60);
        var m = mins % 60;
        var parts = [];
        if (h) { parts.push(l.hourAbbr.replace('{0}', h)); }
        if (m || !h) { parts.push(l.minAbbr.replace('{0}', m)); }
        return parts.join(' ');
    }

    // ============ Header settings button ============
    // The plugin-configuration endpoints require an administrator, so the palette
    // button is only shown to admins (non-admins used to get a button that could
    // only ever show an error panel).
    // `limited` is kept for EVERY user, not only admins: a profile with a parental-
    // rating limit (a Kids profile) is never offered Requests, because Seerr's lists
    // carry no age rating to filter by. null = not known yet.
    var nfAdminState = { uid: null, admin: false, limited: null };
    function updateAdmin() {
        if (typeof ApiClient === 'undefined' || !ApiClient.getCurrentUserId || !ApiClient.getCurrentUser) return;
        var uid = ApiClient.getCurrentUserId();
        if (!uid || nfAdminState.uid === uid) return;
        nfAdminState.uid = uid;
        nfAdminState.admin = false;
        nfAdminState.limited = null;
        ApiClient.getCurrentUser().then(function (u) {
            nfAdminState.admin = !!(u && u.Policy && u.Policy.IsAdministrator);
            // Only for the user it was asked for: a slow answer that lands after a
            // switch of user must not open (or close) Requests for the next one.
            if (nfAdminState.uid === uid) nfAdminState.limited = !!(u && u.Policy && u.Policy.MaxParentalRating != null);
            if (nfAdminState.admin) addButton();
            else document.querySelectorAll('.ct-settings-btn').forEach(function (b) { b.remove(); });
            // The Requests gate has been waiting on this answer (nfRqUser), and for a
            // user who is not an admin nothing above changes the page, so no pass
            // would follow it until something else did.
            if (nfAdminState.uid === uid && nfAdminState.limited === false && nfBoot('SeerrBridge')) {
                try { applyDynamic(); } catch (e) {}
            }
        }).catch(function () { nfAdminState.uid = null; });
    }

    function addButton() {
        if (!nfAdminState.admin) return;

        // The legacy header is the preferred home, but on Jellyfin 12.0's Modern
        // layout it is inside a display:none wrapper — where .headerRight still
        // RESOLVES, so the old code inserted the button, saw it on the next pass and
        // concluded it had succeeded. The admin then had no in-app way to open the
        // drawer at all, which is also the only place the version readout lives.
        // So: only treat an existing button as "done" if it is in the container we
        // would put it in now, and re-home it otherwise.
        var legacy = nfLegacyHeader();
        var host = legacy ? legacy.querySelector('.headerRight') : nfModernToolbar();
        if (!host) return;

        // Modern: the button belongs immediately before the user menu. The toolbar is
        // built in stages, and "before the last child" — which is what this used to
        // do, once — meant before whatever happened to be last at that moment: on a
        // page whose avatar box had not rendered yet that was the search/cast group,
        // so the palette ended up beside the nav tabs on some page loads and beside
        // the avatar on others. Anchor on the avatar's own box, and re-home an
        // existing button the first time that box is there.
        var anchor = null;
        if (!legacy) {
            var avatar = host.querySelector('.MuiAvatar-root');
            anchor = avatar;
            while (anchor && anchor.parentNode !== host) anchor = anchor.parentNode;
            if (!anchor) anchor = host.lastElementChild;
        }

        var existing = document.querySelector('.ct-settings-btn');
        if (existing) {
            if (host.contains(existing)) {
                if (!legacy && anchor && anchor !== existing && existing.nextElementSibling !== anchor) {
                    host.insertBefore(existing, anchor);
                }
                return;
            }
            existing.remove();
        }

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ct-settings-btn headerButton headerButtonRight';
        btn.title = nfL().themeSettings;
        btn.setAttribute('aria-label', nfL().themeSettings);
        btn.innerHTML = '<span class="material-icons" style="font-size:24px" aria-hidden="true">palette</span>';
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); togglePanel(); });

        if (legacy) {
            var userBtn = host.querySelector('.headerUserButton');
            if (userBtn) host.insertBefore(btn, userBtn);
            else host.appendChild(btn);
            return;
        }

        // Modern: before the user-menu Box (or, on a public path with no avatar, the
        // last Box) — which matches where the button lives in the legacy header.
        // MUI's utility classes carry no CSS of their own, so the button is styled
        // by the theme's own .ct-settings-btn rules, not by borrowing MuiIconButton.
        if (anchor) host.insertBefore(btn, anchor);
        else host.appendChild(btn);
    }

    function ctPanelKeydown(e) {
        if (e.key === 'Escape') { closePanel(); }
    }

    function togglePanel() {
        if (document.querySelector('.ct-overlay')) { closePanel(); return; }

        var bg = document.createElement('div');
        bg.className = 'ct-overlay-bg';
        bg.addEventListener('click', closePanel);

        var panel = document.createElement('div');
        panel.className = 'ct-overlay';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', nfL().themeSettings);
        var cssVer = '';
        try {
            cssVer = (getComputedStyle(document.documentElement).getPropertyValue('--nf-version') || '')
                .trim().replace(/^["']|["']$/g, '');
        } catch (e) {}
        // Shown so "is the update actually live?" is answerable without devtools.
        // A mismatch means one half is cached: CSS comes from the server's branding
        // stylesheet, JS from the injected script.
        var verLine = 'v' + NF_JS_VERSION + (cssVer && cssVer !== NF_JS_VERSION ? ' · CSS v' + cssVer + ' (MISMATCH)' : '');
        panel.innerHTML = '<div class="ct-header"><h2>Theme Settings<span class="ct-ver">' + esc(verLine) + '</span></h2>'
            + '<button type="button" class="ct-close" aria-label="Close">&times;</button></div>'
            + '<div class="ct-body"><p style="color:#888">Loading…</p></div>';

        document.body.appendChild(bg);
        document.body.appendChild(panel);
        // Scroll-lock the page: without it, scrolling past the panel's own end chains
        // to the document and the home page slides around underneath the open drawer.
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', ctPanelKeydown);
        panel.querySelector('.ct-close').addEventListener('click', closePanel);
        panel.querySelector('.ct-close').focus();
        requestAnimationFrame(function () { panel.classList.add('open'); bg.classList.add('open'); });

        loadConfig(panel);
    }

    function closePanel() {
        document.removeEventListener('keydown', ctPanelKeydown);
        document.body.style.overflow = '';
        var panel = document.querySelector('.ct-overlay');
        var bg = document.querySelector('.ct-overlay-bg');
        if (panel) { panel.classList.remove('open'); setTimeout(function () { panel.remove(); }, 300); }
        if (bg) { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 300); }
    }

    function loadConfig(panel) {
        if (typeof ApiClient === 'undefined' || !ApiClient.getPluginConfiguration) {
            panel.querySelector('.ct-body').innerHTML = '<p style="color:#E50914">Settings unavailable here. Use Dashboard &gt; Plugins &gt; Custom Theme.</p>';
            return;
        }
        ApiClient.getPluginConfiguration(PLUGIN_ID).then(function (config) {
            CT_CONFIG = config;
            renderPanel(panel, config);
        }).catch(function (err) {
            panel.querySelector('.ct-body').innerHTML = '<p style="color:#E50914">Error: ' + esc(err) + '</p>';
        });
    }

    function renderPanel(panel, config) {
        var html = '';
        SECTIONS.forEach(function (section) {
            html += '<div class="ct-sec"><div class="ct-sec-title">' + section[0] + '</div>';
            section[1].forEach(function (f) {
                var key = f[0], type = f[1], label = f[2];
                html += '<div class="ct-row"><span>' + label + '</span>';
                var aria = ' aria-label="' + esc(label) + '"';
                if (type === 'toggle') {
                    html += '<label class="ct-switch"><input type="checkbox" data-key="' + key + '"' + aria + (config[key] !== false ? ' checked' : '') + '><span class="ct-slider"></span></label>';
                } else if (type === 'color') {
                    html += '<input type="color" data-key="' + key + '"' + aria + ' value="' + esc(config[key] || '#000000') + '">';
                } else if (type === 'text') {
                    html += '<input type="text" data-key="' + key + '"' + aria + ' value="' + esc(config[key] || '') + '"' + (key === 'CustomLogoUrl' ? ' placeholder="https://..."' : (key === 'IdentPath' ? ' placeholder="e.g. /media/intro.mp4" spellcheck="false" autocomplete="off"' : '')) + '>';
                } else {
                    html += '<select data-key="' + key + '"' + aria + '>';
                    f[3].forEach(function (o) {
                        html += '<option value="' + o[0] + '"' + (String(config[key]) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
                    });
                    html += '</select>';
                }
                html += '</div>';
            });
            html += '</div>';
        });
        html += '<button type="button" class="ct-save-btn">Save &amp; Apply</button><div class="ct-save-status"></div>';

        var body = panel.querySelector('.ct-body');
        body.innerHTML = html;
        body.querySelector('.ct-save-btn').addEventListener('click', function () { saveConfig(panel, config); });

        // The Villa theme brings its own accent and its own marks (CssGenerator), so
        // those four controls would be dead rows — and the colour well would go on
        // showing red on a gold page. Hidden, not removed: saveConfig still reads
        // them, so switching back finds every value where it was left.
        var brandSel = body.querySelector('[data-key="Brand"]');
        var syncBrandRows = function () {
            var villa = !!brandSel && brandSel.value === 'villa';
            ['AccentColor', 'LogoStyle', 'LogoLetter', 'CustomLogoUrl'].forEach(function (k) {
                var el = body.querySelector('[data-key="' + k + '"]');
                if (el && el.parentNode) el.parentNode.style.display = villa ? 'none' : '';
            });
        };
        if (brandSel) { brandSel.addEventListener('change', syncBrandRows); syncBrandRows(); }

        // The intro's file is the one setting that can be wrong without anything
        // looking wrong: a path as this computer sees it, a folder, a file the
        // server's account may not read — and then films simply start without it.
        // The server is asked (the same check the dashboard page uses; the drawer is
        // administrators-only, and so is the check) and its answer is put under the
        // field. Inline styles: the stylesheet is generated and does not know this
        // line.
        var identPath = body.querySelector('[data-key="IdentPath"]');
        var identOn = body.querySelector('[data-key="IdentEnabled"]');
        if (identPath && identOn && identPath.parentNode && identPath.parentNode.parentNode) {
            var note = document.createElement('div');
            note.setAttribute('role', 'status');
            note.style.cssText = 'font-size:12px;line-height:1.4;padding:0 0 8px;display:none;';
            identPath.parentNode.parentNode.insertBefore(note, identPath.parentNode.nextSibling);
            var say = function (text, good) {
                note.textContent = text;
                note.style.display = text ? 'block' : 'none';
                note.style.color = good ? '#46d369' : '#ff7a7a';
            };
            var why = {
                missing: 'The server cannot find a file at this path (use the path as the server sees it).',
                folder: 'That is a folder. Enter the video file itself.',
                type: 'Not a video the theme can play: use an .mp4, .m4v or .webm file.',
                empty: 'The file is empty.',
                large: 'The file is larger than 300 MB.',
                unreadable: 'The server is not allowed to read this file, or to open its folder.',
                slow: 'The disk did not answer in time.'
            };
            var asked = 0, slowAsks = 0;
            var check = function (again) {
                if (again !== true) slowAsks = 0;
                var ask = ++asked;
                var value = (identPath.value || '').replace(/^\s+|\s+$/g, '');
                if (!value) { say(identOn.checked ? 'Enter the video file on the server to play before films.' : '', false); return; }
                try {
                    ApiClient.getJSON(ApiClient.getUrl('CustomTheme/Ident/Check', { path: value })).then(function (r) {
                        if (ask !== asked) return;
                        r = r || {};
                        var ok = r.Ok !== undefined ? r.Ok : r.ok;
                        var reason = r.Reason || r.reason || '';
                        // A disk that was asleep: this question woke it. Ask again.
                        if (!ok && reason === 'slow' && slowAsks < 3) {
                            slowAsks++;
                            note.textContent = 'The disk is slow to answer. Asking again\u2026';
                            note.style.display = 'block';
                            note.style.color = '#aaa';
                            setTimeout(function () { if (ask === asked) check(true); }, 2500);
                            return;
                        }
                        // Apps without the theme get a copy made for them (IdentCopy.cs);
                        // where it stands is reported for the saved file only.
                        var apps = r.Apps || r.apps || '';
                        if (ok) say('\u2713 The server can read this file.'
                            + (apps === 'ready' ? ' Apps without the theme get a light copy of it.'
                                : apps === 'making' ? ' A light copy for apps without the theme is being made.'
                                : apps === 'failed' ? ' No copy for apps without the theme could be made; they get the file itself.'
                                : ''), true);
                        else say('\u2717 ' + (why[reason] || 'The server cannot use this file.'), false);
                    }, function () { if (ask === asked) say('', false); });
                } catch (e) {}
            };
            identPath.addEventListener('change', check);
            identOn.addEventListener('change', check);
            check();
        }

        // Requests: where the Jellyseerr Bridge stands (nfRqSetupLine), under its switch, the
        // way the intro's line sits under its path. Asked when the drawer opens and when the
        // switch is turned on; switched off, there is nothing to report and nothing is asked.
        // The counter keeps a slow answer to an earlier ask from writing over a newer one.
        var rqOn = body.querySelector('[data-key="SeerrRequests"]');
        var rqRow = rqOn && rqOn.parentNode ? rqOn.parentNode.parentNode : null;   // input, label.ct-switch, .ct-row
        if (rqRow && rqRow.parentNode) {
            var rqNote = document.createElement('div');
            rqNote.setAttribute('role', 'status');
            rqNote.style.cssText = 'font-size:12px;line-height:1.4;padding:0 0 8px;display:none;';
            rqRow.parentNode.insertBefore(rqNote, rqRow.nextSibling);
            var rqAsked = 0;
            var rqSay = function (line) {
                rqNote.textContent = line[0];
                rqNote.style.display = line[0] ? 'block' : 'none';
                rqNote.style.color = line[1] === 'ok' ? '#46d369' : (line[1] === 'bad' ? '#ff7a7a' : '#aaa');
            };
            var rqCheck = function () {
                var ask = ++rqAsked;
                if (!rqOn.checked) { rqSay(['', '']); return; }
                nfRqSetupLine().then(function (line) { if (ask === rqAsked) rqSay(line); });
            };
            rqOn.addEventListener('change', rqCheck);
            rqCheck();
        }
    }

    // Jellyfin 12.0 persists its react-query cache to IndexedDB (idb-keyval:
    // database "keyval-store", store "keyval", key "jellyfin-query-cache") with a
    // 24-hour gcTime and a 60-second staleTime, and nothing filters what goes in.
    // The BrandingOptions response is in there — and that response carries this
    // plugin's ENTIRE generated stylesheet, ~210 KB of it. So after a settings save
    // the next load re-renders the OLD CSS from that snapshot: within 60s react-query
    // does not even refetch, and past it the stale sheet paints first. The theme's own
    // version readout reports the previous version too, which makes the project's
    // first diagnostic ("check the version in the drawer") say the release never
    // arrived. The cache buster is the WEB CLIENT build id, which a plugin update
    // never changes, so waiting it out is not an option either.
    //
    // Drop the entry before reloading. Always calls back — including when IndexedDB
    // is unavailable, when the database does not exist (every Jellyfin 10.11 install),
    // and when another tab blocks the open.
    //
    // It only ever opens a database it has first CONFIRMED exists. Opening one that
    // does not would create it, and the only way back out is aborting the
    // versionchange transaction; if that abort ever failed to roll back we would
    // leave `keyval-store` at version 1 with no object stores, and idb-keyval's own
    // `open(name, 1)` would then never fire onupgradeneeded — permanently breaking
    // jellyfin-web's cache persister for that user. Not worth the risk for a cache
    // eviction, so where indexedDB.databases() is unavailable this simply does
    // nothing (Chromium 71+, Safari 14+ and Firefox 126+ all have it).
    function nfEvictQueryCache(done) {
        var finished = false;
        function finish() {
            if (finished) return;
            finished = true;
            done();
        }
        // A blocked open or a hung transaction must never strand the save.
        setTimeout(finish, 1500);
        try {
            if (!window.indexedDB || !indexedDB.databases) { finish(); return; }
            indexedDB.databases().then(function (list) {
                var exists = false;
                for (var i = 0; i < (list || []).length; i++) {
                    if (list[i] && list[i].name === 'keyval-store') { exists = true; }
                }
                if (!exists) { finish(); return; }

                var req = indexedDB.open('keyval-store');
                req.onerror = finish;
                req.onblocked = finish;
                // Cannot happen — the database exists, so no version change is needed —
                // but if it somehow did, doing nothing is the safe answer.
                req.onupgradeneeded = finish;
                req.onsuccess = function () {
                    var db = req.result;
                    try {
                        if (!db.objectStoreNames.contains('keyval')) { db.close(); finish(); return; }
                        var tx = db.transaction('keyval', 'readwrite');
                        tx.objectStore('keyval')['delete']('jellyfin-query-cache');
                        tx.oncomplete = function () { db.close(); finish(); };
                        tx.onerror = function () { db.close(); finish(); };
                        tx.onabort = function () { db.close(); finish(); };
                    } catch (e) { try { db.close(); } catch (e2) {} finish(); }
                };
            })['catch'](finish);
        } catch (e) { finish(); }
    }

    function saveConfig(panel, config) {
        panel.querySelectorAll('[data-key]').forEach(function (el) {
            var key = el.dataset.key;
            if (el.type === 'checkbox') config[key] = el.checked;
            else if (INT_KEYS[key]) config[key] = parseInt(el.value, 10);
            else config[key] = el.value;
        });

        var status = panel.querySelector('.ct-save-status');
        status.textContent = 'Saving…';
        status.style.color = '#aaa';

        ApiClient.updatePluginConfiguration(PLUGIN_ID, config).then(function () {
            status.textContent = '✓ Saved — reloading…';
            status.style.color = '#46d369';
            setTimeout(function () {
                nfEvictQueryCache(function () { location.reload(); });
            }, 1200);
        }).catch(function (err) {
            status.textContent = 'Error: ' + err;
            status.style.color = '#E50914';
        });
    }

    // ============ Top nav tabs (header) — replaces Custom Tabs ============
    var navViews = null;
    var navViewsUid = null;   // the user the cached views were fetched for
    var navFetching = false;
    var nfNavHash = null;
    var nfNavRq = false;      // the strip was built with the Requests tab
    // The Requests page's address. jellyfin-web lets nobody add a route: an unknown one is
    // its "page not found", and on a phone it takes the drawer away. So the Requests page
    // lives on the search route, under a parameter of the theme's own that jellyfin's
    // search page ignores and keeps. Here, not in the Requests block, because the strip
    // compares every tab with it, and that block is not on every page (nfRqHere).
    var NF_RQ_PAGE = '/search?nfview=requests';
    var NF_RQ_HREF = '#' + NF_RQ_PAGE;

    // Mirrors appRouter.getRouteUrl in jellyfin-web 10.11 exactly. The old
    // ".html" legacy paths (movies.html, list.html, …) no longer exist as
    // routes there — a tab pointing at one (e.g. Collections -> list.html)
    // just spun forever. The list route also requires serverId.
    function navRouteFor(v) {
        var ct = (v.CollectionType || '').toLowerCase();
        var sid = (ApiClient.serverId && ApiClient.serverId()) || v.ServerId || '';
        if (ct === 'tvshows') return '#/tv?topParentId=' + v.Id + '&collectionType=tvshows';
        if (ct === 'movies') return '#/movies?topParentId=' + v.Id + '&collectionType=movies';
        if (ct === 'music') return '#/music?topParentId=' + v.Id + '&collectionType=music';
        if (ct === 'livetv') return '#/livetv?collectionType=livetv';
        return '#/list?parentId=' + v.Id + (sid ? '&serverId=' + sid : '');
    }

    function navIsActive(href) {
        var hash = (location.hash || '').toLowerCase();
        var h = href.toLowerCase();
        // The Requests page is a parameter on the search route. Only that parameter
        // is the tab's: jellyfin's own search page belongs to no tab.
        if (h === NF_RQ_HREF) return nfRqHere && nfRqRoute() === 'page';
        var base = h.replace('#', '').split('?')[0];
        if (base.indexOf('home') !== -1) return isHomePage();
        if (base === '' || hash.indexOf(base) === -1) return false;
        // Two list-type libraries share the /list base — require the same id.
        var idm = h.match(/(?:top)?parentid=([a-f0-9-]+)/i);
        if (idm) return hash.indexOf(idm[1]) !== -1;
        return true;
    }

    function renderNavTabs() {
        if (cfg('NavTabs', true) !== true) {
            document.querySelectorAll('.nf-nav-tabs').forEach(function (n) { n.remove(); });
            return;
        }
        var anchor = document.querySelector('.headerLeft');
        if (!anchor || !navViews) return;

        // Requests come and go with their gate, whose answers from the bridge can land
        // after the strip was built: the strip is then built again, with or without the
        // tab, and the memo below goes with the old one. A remote's (or keyboard's)
        // focus on the old strip moves to the same tab of the new one: dropped with the
        // old strip it fell to <body>, and the TV user's place was gone (measured with a
        // bridge that answered 4 s late). The Requests tab itself hands it to its
        // neighbour, the last tab.
        var rq = nfRqHere && nfRqLive();
        var existing = anchor.querySelector('.nf-nav-tabs');
        var refocus = null;
        if (existing && nfNavRq !== rq) {
            var was = document.activeElement;
            if (was && was !== existing && existing.contains(was)) refocus = was.getAttribute('href') || '';
            existing.parentNode.removeChild(existing);
            existing = null;
            nfNavHash = null;
        }
        if (existing) {
            // navIsActive() is a getAttribute + toLowerCase + replace + split +
            // indexOf plus a regex, PER TAB — and the answer depends only on
            // location.hash, yet this ran on every mutation frame forever.
            // renderNavTabs is already re-called on hashchange, so the memo cannot
            // go stale.
            if (nfNavHash === location.hash) return;
            nfNavHash = location.hash;
            existing.querySelectorAll('.nf-nav-tab').forEach(function (a) {
                var on = navIsActive(a.getAttribute('href'));
                a.classList.toggle('active', on);
                if (nfRqHere && a.classList.contains('nf-nav-req')) nfRqCurrent(a, on);
            });
            return;
        }
        nfNavHash = location.hash;
        nfNavRq = rq;

        var tabs = [[nfL().home, '#/home']];
        navViews.forEach(function (v) { tabs.push([v.Name, navRouteFor(v)]); });
        // Last, where Netflix keeps "New & Popular".
        if (rq) tabs.push([nfL().requests, NF_RQ_HREF]);
        var nav = document.createElement('div');
        nav.className = 'nf-nav-tabs';
        nav.innerHTML = tabs.map(function (t) {
            var on = navIsActive(t[1]);
            var req = t[1] === NF_RQ_HREF;
            return '<a class="nf-nav-tab' + (req ? ' nf-nav-req' : '') + (on ? ' active' : '') + '" href="' + t[1] + '"'
                + (req && on ? ' aria-current="page"' : '') + '>' + esc(t[0]) + '</a>';
        }).join('');
        anchor.appendChild(nav);
        if (refocus !== null) {
            var to = nav.lastElementChild;
            for (var c = nav.firstElementChild; c; c = c.nextElementSibling) {
                if (c.getAttribute('href') === refocus) { to = c; break; }
            }
            try { if (to) to.focus(); } catch (e) {}
        }
    }

    function setupNavTabs() {
        try {
            if (cfg('NavTabs', true) !== true) {
                document.querySelectorAll('.nf-nav-tabs').forEach(function (n) { n.remove(); });
                return;
            }
            if (typeof ApiClient === 'undefined' || !ApiClient.getUserViews || !ApiClient.getCurrentUserId) return;
            if (!document.querySelector('.headerLeft')) return;
            var navUid = ApiClient.getCurrentUserId();
            // The cached views are per-account: an SPA user switch must never keep
            // rendering the previous user's libraries. A still-unknown (falsy) uid —
            // login resolving — keeps the cache rather than refetch-spamming.
            if (navViews && navUid && navViewsUid !== navUid) {
                navViews = null;
                document.querySelectorAll('.nf-nav-tabs').forEach(function (n) { n.remove(); });
            }
            if (navViews) { renderNavTabs(); return; }
            if (navFetching) return;
            if (!navUid) return; // not logged in yet — avoid GET /Users/null/Views -> 400
            navFetching = true;
            ApiClient.getUserViews({ UserId: navUid }).then(function (res) {
                navFetching = false;
                navViews = (res && res.Items) || [];
                navViewsUid = navUid;
                renderNavTabs();
            }).catch(function () { navFetching = false; });
        } catch (e) {}
    }

    // ============ Hero billboard carousel (home page) ============
    var heroBusy = false;
    var HERO_INTERVAL = 20000;
    var HERO_MAX = 6;

    function isHomePage() {
        // Exact base match — a loose '/home' substring test used to treat
        // '#/homevideos?...' (a Home Videos library) as the home page.
        var h = (location.hash || '').toLowerCase().split('?')[0];
        return h === '' || h === '#/' || h === '#/home' || h === '#/home.html';
    }

    // Memoized per applyDynamic pass: the querySelectorAll + offsetParent reads force
    // layout and this runs up to ~6x per pass. nfPassId (bumped at every applyDynamic
    // entry) invalidates the memo; isConnected guards async callers between passes
    // against a container the SPA has since detached.
    var nfPassId = 0;
    var nfHomeCache = { frame: -1, el: null };
    function activeHomeContainer() {
        if (nfHomeCache.frame === nfPassId && (nfHomeCache.el === null || nfHomeCache.el.isConnected)) {
            return nfHomeCache.el;
        }
        var el = null;
        var pages = document.querySelectorAll('.homeSectionsContainer');
        for (var i = 0; i < pages.length; i++) {
            if (pages[i].offsetParent !== null) { el = pages[i]; break; }
        }
        nfHomeCache.frame = nfPassId;
        nfHomeCache.el = el;
        return el;
    }

    function removeHero() {
        document.querySelectorAll('.nf-hero').forEach(function (h) {
            if (h._timer) { clearInterval(h._timer); h._timer = null; }
            if (h._nfIO) { try { h._nfIO.disconnect(); } catch (e) {} h._nfIO = null; }
            // A live clip must die through nfKillVideo (the single teardown path) —
            // h.remove() alone leaves the stream/transcode running server-side.
            h.querySelectorAll('.nf-hero-video').forEach(nfKillVideo);
            h.remove();
        });
    }

    // We are the hero now: hide a detected external billboard (e.g. the Jellyfin
    // Media Bar) and undo the top margin it adds to the home container, so there is
    // never a double hero. Lets our hero fully replace Media Bar without uninstalling it.
    // The scan is a full-document case-insensitive attribute-substring query — far
    // too heavy for every mutation frame. Run it at most once per second, and after
    // 3 consecutive no-match scans stop entirely until the route (hash) changes.
    var nfExtHeroLast = 0;
    var nfExtHeroMisses = 0;
    var nfExtHeroHash = null;
    function suppressExternalHero(container) {
        var hash = location.hash || '';
        if (hash !== nfExtHeroHash) { nfExtHeroHash = hash; nfExtHeroMisses = 0; }
        if (nfExtHeroMisses >= 3) return;
        var now = Date.now();
        if (now - nfExtHeroLast < 1000) return;
        nfExtHeroLast = now;
        var ext = document.querySelectorAll('#slides-container, [id*="slideshow" i], [class*="mediabar" i]');
        if (!ext.length) { nfExtHeroMisses++; return; }
        nfExtHeroMisses = 0;
        ext.forEach(function (el) { if (!el.closest || !el.closest('.nf-hero')) el.style.display = 'none'; });
        if (container) { container.style.marginTop = '0px'; }
    }

    // Cache the hero item set briefly so navigating away and back doesn't refetch
    // and re-download six 1920px backdrops every time. Keyed by user id: a SPA
    // user switch must never show another account's items (parental controls!).
    var heroCache = { uid: null, items: null, ts: 0 };
    var HERO_CACHE_MS = 10 * 60 * 1000;

    function setupHero() {
        try {
            if (cfg('HeroBillboard', true) !== true) { removeHero(); return; }
            if (!isHomePage()) { removeHero(); return; }
            suppressExternalHero(activeHomeContainer());
            if (heroBusy) return;
            if (typeof ApiClient === 'undefined' || !ApiClient.getItems || !ApiClient.getCurrentUserId) return;
            var container = activeHomeContainer();
            // :not(.nf-hero-skel) — the placeholder shell carries .nf-hero so it can
            // reserve the height, but it must NOT satisfy the "already built" guard.
            if (!container || container.querySelector('.nf-hero:not(.nf-hero-skel)')) return;
            // A library with no eligible items must not refetch on every DOM mutation.
            if (container.getAttribute('data-nf-hero-empty') === '1') return;

            var userId = ApiClient.getCurrentUserId();
            if (!userId) return;

            // Reserve the billboard's height IMMEDIATELY with a shimmer shell, so
            // the rows below don't paint first and then get shoved down 80vh when
            // the hero arrives. renderHero swaps itself in over the shell.
            if (!container.querySelector('.nf-hero-skel')) {
                var shell = document.createElement('div');
                shell.className = 'nf-hero nf-hero-skel';
                shell.setAttribute('data-nf-order', String(NF_ORDER.hero));
                container.insertBefore(shell, container.firstChild);
            }

            if (heroCache.uid !== userId || !heroCache.items) {
                // Survive full page reloads too (sessionStorage, same TTL).
                var stored = nfCacheGet('hero', HERO_CACHE_MS);
                if (stored && stored.length) { heroCache.uid = userId; heroCache.items = stored; heroCache.ts = Date.now(); }
            }
            if (heroCache.uid === userId && heroCache.items && heroCache.items.length && (Date.now() - heroCache.ts) < HERO_CACHE_MS) {
                renderHero(container, heroCache.items);
                return;
            }

            heroBusy = true;
            ApiClient.getItems(userId, {
                SortBy: 'Random',
                IncludeItemTypes: 'Movie,Series',
                Recursive: true,
                ImageTypes: 'Backdrop',
                HasOverview: true,   // Media Bar's quality filters: only good-looking slides
                IsPlayed: false,
                Limit: 30,
                // MediaSources feeds nfCanDirect so undecodable sources (HEVC on desktop)
                // go straight to the transcode instead of a 5s black box.
                Fields: 'Overview,Genres,ProductionYear,CommunityRating,RunTimeTicks,MediaSources'
            }).then(function (res) {
                heroBusy = false;
                var items = ((res && res.Items) || []).filter(function (i) {
                    return i.BackdropImageTags && i.BackdropImageTags.length;
                }).slice(0, HERO_MAX);
                // Any exit from here on must sweep the placeholder, or it shimmers
                // forever AND blocks the entry guard from ever retrying.
                var c = activeHomeContainer();
                var skel = c && c.querySelector('.nf-hero-skel');
                if (!isHomePage() || !c) { if (skel) { skel.remove(); } return; }
                if (!items.length) {
                    c.setAttribute('data-nf-hero-empty', '1');
                    if (skel) { skel.remove(); }
                    return;
                }
                heroCache.uid = userId;
                heroCache.items = items;
                heroCache.ts = Date.now();
                nfCacheSet('hero', items, userId);
                if (!c.querySelector('.nf-hero:not(.nf-hero-skel)')) renderHero(c, items);
            }).catch(function () {
                heroBusy = false;
                var cErr = activeHomeContainer();
                var sErr = cErr && cErr.querySelector('.nf-hero-skel');
                if (sErr) { sErr.remove(); }
            });
        } catch (e) { heroBusy = false; }
    }

    // ---- Dark title logos ----
    // TMDb logo art comes in whatever colour the studio drew it, and a black or
    // near-black wordmark over a dark scrim is simply not there: the billboard
    // showed a metadata line under nothing, on a slide nobody could name. Sample
    // the logo's opaque pixels once; when they are dark the sheet redraws the
    // mark in white (.nf-logo-dark). A failed or tainted read answers "leave it
    // alone" — so does anything with a bright stroke, which stays as drawn.
    var nfToneCache = {};
    function nfLogoIsDark(img) {
        try {
            var w = img.naturalWidth, h = img.naturalHeight;
            if (!w || !h) return false;
            var cw = 48, ch = Math.max(1, Math.round(48 * h / w));
            var c = document.createElement('canvas');
            c.width = cw; c.height = ch;
            var ctx = c.getContext('2d');
            if (!ctx) return false;
            ctx.drawImage(img, 0, 0, cw, ch);
            var d = ctx.getImageData(0, 0, cw, ch).data, sum = 0, cnt = 0, bright = 0;
            for (var i = 0; i < d.length; i += 4) {
                if (d[i + 3] < 96) continue;
                var y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
                sum += y; cnt++;
                if (y > 110) bright++;
            }
            if (cnt < 12) return false;
            return (sum / cnt) < 62 && (bright / cnt) < 0.12;
        } catch (e) { return false; }
    }
    function nfToneLogo(url, apply) {
        if (!url) return;
        if (nfToneCache[url] !== undefined) { if (nfToneCache[url]) apply(); return; }
        nfToneCache[url] = false;   // latch: one probe per URL, whatever happens to it
        var im = new Image();
        // A web client served from somewhere other than the server (the desktop
        // app's bundled one) needs a CORS read, and must not be answered from the
        // cache entry the visible <img> made without one.
        var probe = url;
        try {
            if (new URL(url, location.href).origin !== location.origin) {
                im.crossOrigin = 'anonymous';
                probe = url + (url.indexOf('?') === -1 ? '?' : '&') + 'nfTone=1';
            }
        } catch (e) {}
        im.onload = function () { if (nfLogoIsDark(im)) { nfToneCache[url] = true; apply(); } };
        im.src = probe;
    }

    function heroSlideHtml(item, active) {
        // Cover-fit is HEIGHT-driven whenever the box is taller than 9/16 of its
        // width — i.e. on every portrait viewport. Sizing from window.innerWidth
        // alone asked for a 1920px image where an iPad portrait crop needs ~3060
        // device px, so the single largest, most-looked-at image in the theme was
        // visibly soft on exactly the devices that needed the most work.
        // Phones stay one rung lower: 1600 covers their ~1860px need at 1.16x,
        // visually indistinguishable, at roughly a third of the bytes.
        var nfVw = window.innerWidth, nfNarrow = nfVw <= 768;
        var nfHeroH = Math.min(Math.max(window.innerHeight * (nfNarrow ? 0.62 : 0.80), nfNarrow ? 360 : 480), 860);
        var nfDpr = Math.min(window.devicePixelRatio || 1, 2);
        var nfHeroPx = Math.min(Math.round(Math.max(nfVw, nfHeroH * 16 / 9) * 1.12), (nfNarrow ? 1600 : 2560) / nfDpr);
        var bg = nfImg(item.Id, 'Backdrop', item.BackdropImageTags[0], nfHeroPx);
        var serverId = item.ServerId || (ApiClient.serverId && ApiClient.serverId());
        var detailUrl = '#/details?id=' + item.Id + (serverId ? '&serverId=' + serverId : '');

        var titleHtml;
        if (item.ImageTags && item.ImageTags.Logo) {
            var logo = nfImg(item.Id, 'Logo', item.ImageTags.Logo, 560);
            titleHtml = '<img class="nf-hero-logo" src="' + logo + '" alt="' + esc(item.Name) + '">';
        } else {
            titleHtml = '<div class="nf-hero-title">' + esc(item.Name || '') + '</div>';
        }

        var match = matchHtml(item.CommunityRating, 'nf-hero-match');
        var year = item.ProductionYear ? '<span>' + item.ProductionYear + '</span>' : '';
        // Maturity rating as a right-edge billboard badge (real Netflix), not an
        // inline meta chip — emitted per slide so it crossfades with the slide.
        // netflix.css owns its positioning at the slide's right edge.
        var maturity = item.OfficialRating ? '<span class="nf-hero-maturity">' + esc(item.OfficialRating) + '</span>' : '';
        var genres = (item.Genres || []).slice(0, 3).map(esc).join(' • ');
        var meta = '<div class="nf-hero-meta">' + match + year + (genres ? '<span>' + genres + '</span>' : '') + '</div>';
        var overview = item.Overview ? '<div class="nf-hero-overview">' + esc(item.Overview) + '</div>' : '';

        var fav = !!(item.UserData && item.UserData.IsFavorite);
        return '<div class="nf-hero-slide' + (active ? ' active' : '') + '">' +
            // Only slide 0 (active) loads its backdrop eagerly; the rest carry the URL in
            // data-nf-hero-bg and are filled in go() as they rotate in — a Home visit fetches
            // one right-sized backdrop up front instead of six.
            '<div class="nf-hero-bg"' + (active ? ' style="background-image:url(\'' + bg + '\')"' : ' data-nf-hero-bg="' + bg + '"') + '></div>' +
            '<div class="nf-hero-content">' + titleHtml + meta + overview +
                '<div class="nf-hero-actions">' +
                    // nf-autoplay: the delegated handler in init() stamps a short-lived
                    // sessionStorage flag; the detail page consumes it by clicking the
                    // STOCK Play button — so ▶ actually starts playback through the
                    // client's own stack (works in browsers, JMP and the mobile apps'
                    // native players alike), with the detail page as graceful fallback.
                    '<a class="nf-hero-btn nf-hero-play nf-autoplay" data-id="' + item.Id + '" href="' + detailUrl + '"><span class="material-icons" aria-hidden="true">play_arrow</span> ' + nfL().play + '</a>' +
                    '<a class="nf-hero-btn nf-hero-info" href="' + detailUrl + '"><span class="material-icons" aria-hidden="true">info</span> ' + nfL().moreInfo + '</a>' +
                    '<button type="button" class="nf-hero-btn nf-hero-list' + (fav ? ' active' : '') + '" data-id="' + item.Id + '" title="' + nfL().myList + '" aria-label="' + nfL().myList + '"><span class="material-icons" aria-hidden="true">' + (fav ? 'check' : 'add') + '</span></button>' +
                '</div>' +
            '</div>' + maturity + '</div>';
    }

    function renderHero(container, items) {
        var hero = document.createElement('div');
        hero.className = 'nf-hero';
        hero.setAttribute('data-nf-order', String(NF_ORDER.hero));
        var slides = items.map(function (it, i) { return heroSlideHtml(it, i === 0); }).join('');
        var dots = items.map(function (_, i) { return '<button type="button" class="nf-hero-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" aria-label="' + nfL().slide + ' ' + (i + 1) + '"></button>'; }).join('');
        hero.innerHTML = slides +
            '<div class="nf-hero-controls">' +
                '<button type="button" class="nf-hero-ctrl nf-hero-mute" title="' + nfL().sound + '" aria-label="' + nfL().sound + '"><span class="material-icons" aria-hidden="true">volume_off</span></button>' +
                '<button type="button" class="nf-hero-ctrl nf-hero-pause" title="' + nfL().pause + '" aria-label="' + nfL().pause + '"><span class="material-icons" aria-hidden="true">pause</span></button>' +
                '<div class="nf-hero-dots">' + dots + '</div>' +
            '</div>';
        var skel = container.querySelector('.nf-hero-skel');
        if (skel) { container.insertBefore(hero, skel); skel.remove(); }
        else { container.insertBefore(hero, container.firstChild); }

        // Initial ambient bleed from the first slide (go() handles later slides).
        if (items[0]) nfSampleAmbient(nfBackdropAmbientUrl(items[0]));
        hero.querySelectorAll('img.nf-hero-logo').forEach(function (lg) {
            nfToneLogo(lg.getAttribute('src'), function () { lg.classList.add('nf-logo-dark'); });
        });

        var cur = 0, paused = false;
        var slideEls = hero.querySelectorAll('.nf-hero-slide');
        if (slideEls[0]) hero.classList.toggle('nf-hero-noplate', !slideEls[0].querySelector('.nf-hero-maturity'));
        var dotEls = hero.querySelectorAll('.nf-hero-dot');
        var clipTimer = null;
        // Preload slide 1's backdrop (loadSlideBg is hoisted) so the first rotation is ready.
        if (slideEls.length > 1) loadSlideBg(1);

        // Self-contained hero clip: a muted, looping REMUX of the actual title (the file
        // itself, not a YouTube trailer) fades in over the backdrop of the active slide.
        function stopClip() {
            if (clipTimer) { clearTimeout(clipTimer); clipTimer = null; }
            hero.querySelectorAll('.nf-hero-video').forEach(nfKillVideo);
            // Restore the hero copy when no clip is playing (choreography off).
            hero.querySelectorAll('.nf-hero-slide.nf-clip-on').forEach(function (s) { s.classList.remove('nf-clip-on'); });
        }
        // Offscreen guard: a hero scrolled out of view kills its clip immediately and
        // must not attach new ones or rotate (each rotation fetches a full-width
        // backdrop and can start a stream/transcode nobody can see).
        var heroInView = true;
        if ('IntersectionObserver' in window) {
            hero._nfIO = new IntersectionObserver(function (en) {
                heroInView = en[en.length - 1].isIntersecting;
                if (!heroInView) stopClip();
            }, { threshold: 0 });
            hero._nfIO.observe(hero);
        }
        function attachClip(slideEl, playId, ms, ticks) {
            // Guarded here too — playClip's Series branch is async and can resolve
            // after a scroll-away or after real playback has started.
            if (!heroInView) return;
            if (document.documentElement.classList.contains('nf-playing') || nfIdentBusy()) return;
            if (!slideEl || !slideEl.classList.contains('active') || !document.body.contains(slideEl)) return;
            var v = nfNewClipVideo('nf-hero-video');
            // Netflix choreography: once the trailer actually renders, shrink the
            // title logo and fade the synopsis; stopClip/go() restore it.
            v.addEventListener('playing', function () {
                v.classList.add('show');
                if (!slideEl) return;
                // The synopsis fades but keeps its box, so the title has to travel
                // the height it leaves empty or a hole opens between the metadata
                // and the buttons. One layout read per clip start; 0 when the
                // synopsis is not laid out at all (short viewports hide it).
                var ov = slideEl.querySelector('.nf-hero-overview');
                var drop = ov && ov.offsetHeight ? ov.offsetHeight + 20 : 0;
                slideEl.style.setProperty('--nf-hero-drop', drop + 'px');
                slideEl.classList.add('nf-clip-on');
            });
            nfClaim(v);
            nfClipSrc(v, playId, ms, ticks);
            var bg = slideEl.querySelector('.nf-hero-bg');
            slideEl.insertBefore(v, bg ? bg.nextSibling : slideEl.firstChild);
            nfPlay(v);
            // Preview window cap: without it a paused or single-slide hero streams
            // (and on the fallback path transcodes) the whole title in a loop.
            v._stopTimer = setTimeout(function () {
                nfKillVideo(v);
                if (slideEl) slideEl.classList.remove('nf-clip-on');   // restore the copy even if paused
            }, PREVIEW_SECONDS * 1000);
            nfClipWatch(v);
            nfClipLoop(v);
        }
        function playClip(idx) {
            if (!heroInView) return;
            // Never start a hero preview stream UNDER real playback — the applyDynamic
            // fast-path returns early while nf-playing, so nothing else would stop it.
            if (document.documentElement.classList.contains('nf-playing') || nfIdentBusy()) return;
            if (cfg('PreviewClips', true) === false) return;
            if (document.hidden || nfReducedMotion() || nfCheapMode()) return;
            var item = items[idx], slideEl = slideEls[idx];
            if (!item || !slideEl) return;
            var type = item.Type || '';
            if (type === 'Series' || type === 'Season' || item.IsFolder) {
                var uid = ApiClient.getCurrentUserId && ApiClient.getCurrentUserId();
                if (!uid || !ApiClient.getItems) return;
                ApiClient.getItems(uid, { ParentId: item.Id, IncludeItemTypes: 'Episode', Recursive: true, Limit: 1, SortBy: 'SortName', SortOrder: 'Ascending', Fields: 'MediaSources,RunTimeTicks' }).then(function (res) {
                    if (!slideEl.classList.contains('active')) return;
                    var ep = res && res.Items && res.Items[0]; if (!ep) return;
                    attachClip(slideEl, ep.Id, ep.MediaSources && ep.MediaSources[0], ep.RunTimeTicks || 0);
                }).catch(function () {});
            } else {
                attachClip(slideEl, item.Id, item.MediaSources && item.MediaSources[0], item.RunTimeTicks || 0);
            }
        }
        function scheduleClip() {
            stopClip();
            clipTimer = setTimeout(function () { playClip(cur); }, 1800);
        }
        function loadSlideBg(k) {
            var b = slideEls[k] && slideEls[k].querySelector('.nf-hero-bg[data-nf-hero-bg]');
            if (b) { b.style.backgroundImage = "url('" + b.getAttribute('data-nf-hero-bg') + "')"; b.removeAttribute('data-nf-hero-bg'); }
        }
        function go(n) {
            cur = (n + slideEls.length) % slideEls.length;
            // Fill this slide's backdrop (and prefetch the next) so the crossfade is ready.
            loadSlideBg(cur); loadSlideBg((cur + 1) % slideEls.length);
            for (var i = 0; i < slideEls.length; i++) { slideEls[i].classList.toggle('active', i === cur); }
            for (var j = 0; j < dotEls.length; j++) { dotEls[j].classList.toggle('active', j === cur); }
            // The controls sit to the left of the slide's maturity plate. A title with
            // no certification has no plate, and they were left hanging 170px in from
            // the edge with nothing beside them.
            hero.classList.toggle('nf-hero-noplate', !slideEls[cur].querySelector('.nf-hero-maturity'));
            // A fresh slide's clip always starts muted — resync the mute icon.
            var mi = hero.querySelector('.nf-hero-mute .material-icons');
            if (mi) mi.textContent = 'volume_off';
            // Bleed the new slide's palette into the page background.
            if (items[cur]) nfSampleAmbient(nfBackdropAmbientUrl(items[cur]));
            scheduleClip();
        }

        // Netflix's mobile billboard is STATIC. On cheap-mode devices every 20s
        // rotation cross-fades two 62vh layers and fetches a ~1600px backdrop —
        // pure battery/data drain, with the pause control hidden by the phone CSS
        // anyway. Dots stay wired for manual browsing where they are visible.
        var nfStaticHero = nfCheapMode();
        if (slideEls.length > 1 && !nfStaticHero) {
            hero._timer = setInterval(function () {
                // The SPA can drop the whole home container — removeHero only reaches
                // ATTACHED heroes (document.querySelectorAll), so a detached hero must
                // clean itself up or its interval (and any live clip) leaks forever.
                if (!document.contains(hero)) {
                    clearInterval(hero._timer); hero._timer = null;
                    if (hero._nfIO) { try { hero._nfIO.disconnect(); } catch (e) {} hero._nfIO = null; }
                    stopClip();
                    return;
                }
                // Hold rotation while scrolled offscreen or during REAL playback (the
                // applyDynamic fast-path never reaches the hero then).
                if (!paused && !popEl && !document.hidden && heroInView && !nfIdentBusy()
                    && !document.documentElement.classList.contains('nf-playing')) go(cur + 1);
            }, HERO_INTERVAL);
            dotEls.forEach(function (el) {
                el.addEventListener('click', function () { go(+el.getAttribute('data-idx')); });
            });
            var pauseBtn = hero.querySelector('.nf-hero-pause');
            pauseBtn.addEventListener('click', function () {
                paused = !paused;
                this.querySelector('.material-icons').textContent = paused ? 'play_arrow' : 'pause';
            });
        } else if (slideEls.length > 1) {
            // Static multi-slide hero: manual navigation only — nothing to pause.
            dotEls.forEach(function (el) {
                el.addEventListener('click', function () { go(+el.getAttribute('data-idx')); });
            });
            var psStatic = hero.querySelector('.nf-hero-pause');
            if (psStatic) psStatic.style.display = 'none';
        } else {
            var ctrlsSingle = hero.querySelector('.nf-hero-controls');
            // keep the mute button even with one slide; only hide pause/dots
            var ps = hero.querySelector('.nf-hero-pause'); if (ps) ps.style.display = 'none';
            var ds = hero.querySelector('.nf-hero-dots'); if (ds) ds.style.display = 'none';
        }

        // Mute-Toggle (Netflix-style): clips autoplay muted; this unmutes the current clip on
        // a real user gesture (autoplay can't start unmuted, so we only toggle on click).
        var muteBtn = hero.querySelector('.nf-hero-mute');
        if (muteBtn) {
            muteBtn.addEventListener('click', function (e) {
                e.preventDefault(); e.stopPropagation();
                var v = hero.querySelector('.nf-hero-video');
                if (v) {
                    v.muted = !v.muted;
                    var p = v.play(); if (p && p.catch) { p.catch(function () {}); }
                }
                this.querySelector('.material-icons').textContent = (v && !v.muted) ? 'volume_up' : 'volume_off';
            });
        }

        // "+ Meine Liste" toggles the Jellyfin favorite flag (Netflix My List).
        hero.querySelectorAll('.nf-hero-list').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                var id = btn.getAttribute('data-id');
                var uid = ApiClient.getCurrentUserId && ApiClient.getCurrentUserId();
                if (!id || !uid || !ApiClient.updateFavoriteStatus) return;
                var nowFav = !btn.classList.contains('active');
                ApiClient.updateFavoriteStatus(uid, id, nowFav).then(function () {
                    btn.classList.toggle('active', nowFav);
                    btn.querySelector('.material-icons').textContent = nowFav ? 'check' : 'add';
                    // Write through to the backing item so a cache-hit re-render
                    // shows the current state, not the state at fetch time.
                    items.forEach(function (it) {
                        if (it.Id === id) {
                            it.UserData = it.UserData || {};
                            it.UserData.IsFavorite = nowFav;
                        }
                    });
                    nfInvalidateRails(uid);
                }).catch(function () {});
            });
        });

        // Start the clip for the first slide (subsequent slides are handled by go()).
        scheduleClip();
    }

    // ============ Curated genre rows (home page) — replaces Home Screen Sections ============
    var genreBusy = false;
    var GENRE_MAX_ROWS = 6;
    // Cache the computed top-genre list so returning to home skips the 400-item
    // scan. Keyed by user id — accounts can see different libraries.
    var genreCache = { uid: null, genres: null, ts: 0 };
    var GENRE_CACHE_MS = 10 * 60 * 1000;

    // Netflix-style hover chevrons for our hidden-scrollbar rows: without them,
    // desktop users without a horizontal-scroll gesture can't reach off-screen
    // cards at all. Wraps the row scroller and adds two keyboard-reachable buttons.
    function nfRowNav(sec, scroller, track) {
        scroller = scroller || sec.querySelector('.nf-row-scroll, .nf-cw-scroll');
        if (!scroller || (scroller.parentNode && scroller.parentNode.classList.contains('nf-row-wrap'))) return;
        var wrap = document.createElement('div');
        wrap.className = 'nf-row-wrap nf-at-start';
        scroller.parentNode.insertBefore(wrap, scroller);
        wrap.appendChild(scroller);

        track = track || scroller.firstElementChild;

        // The arrows and page dots are display:none under
        // (max-width:768px),(hover:none) — and the scroll handler below writes two
        // classes and then reads clientWidth/scrollWidth, which forces a style
        // recalc + layout flush PER ROW PER FRAME during a fling (up to eight a
        // frame on a home page, on exactly the WebViews least able to absorb it).
        // So skip the WORK there — but keep building the DOM, and re-check the
        // query live: an early return here would bake the answer in at row-build
        // time, and a desktop window opened narrow and then maximised would be
        // left with no chevrons, no dots, no scrollbar and no wheel scrolling.
        var narrowMQ = (function () {
            try { return window.matchMedia('(max-width: 768px), (hover: none)'); }
            catch (e) { return { matches: false }; }
        })();

        // Netflix paginates by whole screens and always lands on a card boundary —
        // never a sliced card. Step = card width + gap, page = as many whole cards
        // as fit; both are re-measured on resize.
        function cardStep() {
            var card = track && track.firstElementChild;
            if (!card) return 0;
            var w = card.getBoundingClientRect().width;
            if (!w) return 0;
            var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0') || 0;
            return w + gap;
        }
        function perPage() {
            var step = cardStep();
            if (!step) return 1;
            // clientWidth includes the row's own horizontal padding — subtract it
            // so the page count matches the cards actually visible.
            var cs = getComputedStyle(scroller);
            var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
            return Math.max(1, Math.floor((scroller.clientWidth - pad + 1) / step));
        }
        // cardStep()/perPage() each force layout (getBoundingClientRect + getComputedStyle).
        // They only change on resize, so measure once there and reuse the cached product on
        // every scroll frame instead of doing ~4 forced reads per frame during a touch fling.
        var mStep = 0, mPerPage = 0;
        function measure() { if (narrowMQ.matches) return; mStep = cardStep(); mPerPage = perPage(); }
        function pageCount() {
            var n = track ? track.children.length : 0;
            return Math.max(1, Math.ceil(n / (mPerPage || perPage())));
        }

        var dots = document.createElement('div');
        dots.className = 'nf-row-pages';
        var header = sec.querySelector('.sectionTitle');
        if (header) { header.appendChild(dots); }

        function renderDots() {
            var total = pageCount();
            if (total < 2) { dots.innerHTML = ''; return; }
            if (dots.children.length !== total) {
                var html = '';
                for (var i = 0; i < total; i++) { html += '<span class="nf-row-page"></span>'; }
                dots.innerHTML = html;
            }
            var step = (mStep || cardStep()) * (mPerPage || perPage());
            // abs(): RTL scrollLeft runs negative.
            var cur = step ? Math.round(Math.abs(scroller.scrollLeft) / step) : 0;
            for (var j = 0; j < dots.children.length; j++) {
                dots.children[j].classList.toggle('active', j === Math.min(cur, dots.children.length - 1));
            }
        }

        function upd() {
            if (narrowMQ.matches) return;   // arrows + dots are display:none here
            wrap.classList.toggle('nf-at-start', scroller.scrollLeft <= 4);
            wrap.classList.toggle('nf-at-end', scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4);
            renderDots();
        }

        [['back', 'chevron_left', -1], ['fwd', 'chevron_right', 1]].forEach(function (a) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'nf-row-arrow nf-row-arrow-' + a[0];
            b.setAttribute('aria-label', a[2] < 0 ? nfL().scrollBack : nfL().scrollFwd);
            b.innerHTML = '<span class="material-icons" aria-hidden="true">' + a[1] + '</span>';
            b.addEventListener('click', function () {
                var step = (mStep || cardStep()) * (mPerPage || perPage());
                var target;
                if (!step) {
                    target = scroller.scrollLeft + a[2] * Math.round(scroller.clientWidth * 0.8);
                } else {
                    // Quantize the CURRENT offset to a page first, so a stray manual
                    // scroll can't leave every later jump off-grid. RTL scrollLeft is
                    // negative, so work in absolute pages and re-apply the sign.
                    var sign = getComputedStyle(scroller).direction === 'rtl' ? -1 : 1;
                    var page = Math.round(sign * scroller.scrollLeft / step) + a[2];
                    target = sign * Math.max(0, Math.min(page, pageCount() - 1)) * step;
                }
                scroller.scrollTo({ left: target, behavior: nfReducedMotion() ? 'auto' : 'smooth' });
            });
            wrap.appendChild(b);
        });

        scroller.addEventListener('scroll', function () { requestAnimationFrame(upd); }, { passive: true });
        if (window.ResizeObserver) {
            // Re-measure card-step/per-page only on resize (RO also fires once immediately).
            var ro = new ResizeObserver(function () { requestAnimationFrame(function () { measure(); upd(); }); });
            ro.observe(scroller);
        } else { measure(); }
        // Exposed so code that mutates a row's cards (Continue Watching removal /
        // diff-refresh) can refresh the page dots — neither scroll nor resize fires.
        sec._nfUpd = upd;
        measure(); upd();
    }

    // Home rows arrive asynchronously; insert each at its Netflix slot instead of
    // whatever order the fetches happen to finish in.
    var NF_ORDER = { hero: 0, cw: 10, mylist: 20, because: 30, newly: 45, again: 50, genre: 60 };
    function nfInsertOrdered(container, sec, order) {
        sec.setAttribute('data-nf-order', String(order));
        var kids = container.children;
        for (var i = 0; i < kids.length; i++) {
            var o = parseInt(kids[i].getAttribute('data-nf-order') || '', 10);
            if (!isNaN(o) && o > order) { container.insertBefore(sec, kids[i]); return; }
        }
        container.appendChild(sec);
    }

    // cardFn draws one tile (buildCardHtml for a library item); the Requests rows pass
    // their own, so a Seerr title gets the same row shell, ladder and chevrons.
    function nfRowSection(title, items, sid, extraClass, cardFn) {
        var card = cardFn || buildCardHtml;
        var sec = document.createElement('div');
        sec.className = 'verticalSection nf-genre-section' + (extraClass ? ' ' + extraClass : '');
        // "Recently Added" is an exception marker. On a row where most tiles would
        // carry it — a freshly scanned library, or the New Releases row, whose
        // heading already says so — it marks nothing and just stripes the shelf red.
        var fresh = 0;
        items.forEach(function (it) { if (nfIsNew(it)) fresh++; });
        var quiet = fresh * 2 > items.length;
        sec.innerHTML = '<h2 class="sectionTitle sectionTitle-cards">' + esc(title) + '</h2>' +
            '<div class="nf-row-scroll"><div class="nf-row-track">' +
            items.map(function (it) { return card(it, sid, quiet); }).join('') +
            '</div></div>';
        return sec;
    }

    // Row-card artwork must MATCH the configured card shape: portrait mode uses the
    // poster (Primary) art; landscape/mixed keep the titled Thumb boxart. Cropping
    // landscape art into a 2:3 frame (the old behavior) cut title art in half.
    function nfCardImage(item) {
        if (cfg('CardStyle', 'mixed') === 'portrait') {
            var t = item.ImageTags || {};
            if (t.Primary) return nfImg(item.Id, 'Primary', t.Primary, nfTileCssWidth());
        }
        return cwImage(item);
    }

    // Added in the last two weeks.
    function nfIsNew(item) {
        return !!item.DateCreated && (Date.now() - Date.parse(item.DateCreated)) < 14 * 864e5;
    }

    // What a landscape tile needs when its artwork carries no title. cwImage() falls
    // from the titled Thumb to the plain Backdrop, and backdrops are textless by
    // design — so those tiles were anonymous stills in a row of named boxart. The
    // title logo goes over the corner, the way Netflix composes its own boxart, and
    // a title with no logo gets its name in type.
    function nfCardTitleHtml(item) {
        if (cfg('CardStyle', 'mixed') === 'portrait') return '';
        var t = item.ImageTags || {};
        if (t.Thumb || (item.ParentThumbItemId && item.ParentThumbImageTag)) return '';
        var hasBackdrop = (item.BackdropImageTags && item.BackdropImageTags.length)
            || (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length);
        if (!hasBackdrop) return '';   // the poster fallback carries its own title
        var logo = t.Logo ? nfImg(item.Id, 'Logo', t.Logo, 240)
            : (item.ParentLogoItemId && item.ParentLogoImageTag ? nfImg(item.ParentLogoItemId, 'Logo', item.ParentLogoImageTag, 240) : '');
        if (logo) return '<img class="nf-card-logo" loading="lazy" alt="" src="' + esc(logo) + '">';
        return '<div class="nf-card-name">' + esc(item.SeriesName || item.Name || '') + '</div>';
    }

    function buildCardHtml(item, sid, quiet) {
        // Netflix uses LANDSCAPE 16:9 boxart by default. Prefer the titled Thumb
        // (true boxart), then Backdrop/ParentBackdrop, then the portrait Primary —
        // unless the card shape is set to portrait (see nfCardImage).
        var img = nfCardImage(item) || '';
        var href = '#/details?id=' + item.Id + (sid ? '&serverId=' + sid : '');
        var year = item.ProductionYear || '';
        // Netflix's red "Recently Added" badge — unless the row is all of them.
        var newFlag = (!quiet && nfIsNew(item)) ? '<div class="nf-new-flag">' + nfL().newBadge + '</div>' : '';
        // Mirror Jellyfin's native overflow backdrop-card markup for native styling + delegation.
        return '<div data-id="' + item.Id + '" data-serverid="' + (sid || '') + '" data-type="' + item.Type + '" data-mediatype="Video" data-isfolder="false" class="card overflowBackdropCard card-hoverable card-withuserdata nf-card nf-card-landscape">' +
            '<div class="cardBox cardBox-bottompadded">' +
              '<div class="cardScalable">' +
                '<div class="cardPadder cardPadder-overflowBackdrop"></div>' +
                '<a href="' + href + '" data-action="link" class="cardImageContainer cardContent itemAction" aria-label="' + esc(item.Name) + '" data-nf-bg="' + esc(img) + '"></a>' +
                '<div class="cardOverlayContainer itemAction" data-action="link">' +
                  '<a href="' + href + '" data-action="link" class="cardImageContainer"></a>' +
                  '<div class="cardOverlayButtonContainer cardOverlayButtonContainer-centered">' +
                    '<button type="button" is="paper-icon-button-light" class="cardOverlayButton cardOverlayButton-hover itemAction paper-icon-button-light" data-action="resume" title="' + nfL().play + '" aria-label="' + nfL().play + '"><span class="material-icons cardOverlayButtonIcon" aria-hidden="true">play_arrow</span></button>' +
                  '</div>' +
                '</div>' + nfCardTitleHtml(item) + newFlag +
              '</div>' +
              '<div class="cardText cardTextCentered cardText-first"><bdi>' + esc(item.Name) + '</bdi></div>' +
              (year ? '<div class="cardText cardTextCentered cardText-secondary"><bdi>' + esc(year) + '</bdi></div>' : '') +
            '</div>' +
          '</div>';
    }

    // ============ Netflix personal rails ============
    // My List (favorites), Because you watched X (server-side similarity),
    // New Releases (recently added) and Watch It Again (finished titles).
    // Each is cached, self-hides when thin, and shares the genre-row plumbing
    // (chevrons, page dots, lazy artwork, hover preview).
    var railsBusy = false;
    var RAILS_CACHE_MS = 10 * 60 * 1000;
    var RAIL_MIN_ITEMS = 3;
    // No MediaSources here: only the hero streams straight from its list payload
    // (the hover popup re-fetches the full item), and MediaSources would bloat
    // both the responses and the session cache several-fold.
    var RAIL_FIELDS = 'Genres,ProductionYear,CommunityRating,RunTimeTicks,DateCreated';

    function nfHasArt(x) {
        return (x.BackdropImageTags && x.BackdropImageTags.length) || (x.ImageTags && (x.ImageTags.Thumb || x.ImageTags.Primary));
    }

    function setupExtraRows() {
        try {
            if (!isHomePage() || railsBusy) { return; }
            if (typeof ApiClient === 'undefined' || !ApiClient.getItems || !ApiClient.getCurrentUserId) { return; }
            var container = activeHomeContainer();
            if (!container || container.getAttribute('data-nf-rails') === '1') { return; }
            var userId = ApiClient.getCurrentUserId();
            if (!userId) { return; }

            var wantList = cfg('MyListRow', true) === true;
            var wantNew = cfg('NewReleasesRow', true) === true;
            var wantAgain = cfg('WatchAgainRow', true) === true;
            var wantBecause = cfg('BecauseYouWatched', true) === true;
            if (!wantList && !wantNew && !wantAgain && !wantBecause) { return; }

            container.setAttribute('data-nf-rails', '1');
            railsBusy = true;
            var sid = ApiClient.serverId && ApiClient.serverId();
            var seen = {};   // dedupe across rails so rows don't echo each other

            // Returns true when a rail was actually rendered. Items are only
            // committed to `seen` on success — a discarded (too-thin) rail used to
            // burn its titles and starve the rails that came after it.
            function place(title, items, order, extraClass) {
                if (!isHomePage()) { return false; }
                var c = activeHomeContainer();
                if (!c || c.getAttribute('data-nf-rails') !== '1') { return false; }
                var local = {};
                var fresh = (items || []).filter(function (x) {
                    if (!x || !x.Id || seen[x.Id] || local[x.Id] || !nfHasArt(x)) { return false; }
                    local[x.Id] = true;
                    return true;
                });
                if (fresh.length < RAIL_MIN_ITEMS) { return false; }  // Netflix hides thin rails
                Object.keys(local).forEach(function (k) { seen[k] = true; });
                var sec = nfRowSection(title, fresh, sid, extraClass);
                nfInsertOrdered(c, sec, order);
                nfRowNav(sec);
                nfLazyImages(sec);
                return true;
            }

            // Serve instantly from cache, then refresh in the background.
            var cached = nfCacheGet('rails', RAILS_CACHE_MS);
            if (cached && cached.length) {
                railsBusy = false;
                cached.forEach(function (r) { place(r.title, r.items, r.order, r.cls); });
                return;
            }

            var built = [];
            function collect(title, items, order, cls) {
                if (place(title, items, order, cls)) { built.push({ title: title, items: items, order: order, cls: cls }); }
            }
            var pending = 0;
            var failed = 0;
            function retryLater() {
                // Clear the marker so the next pass can try again — but only after a
                // real failure, so a legitimately empty library doesn't refetch on
                // every mutation frame.
                var c = activeHomeContainer();
                if (c) { c.removeAttribute('data-nf-rails'); }
            }
            function done() {
                pending--;
                if (pending <= 0) {
                    railsBusy = false;
                    if (built.length) { nfCacheSet('rails', built, userId); }
                    else if (failed) { retryLater(); }
                }
            }

            // 1) My List — the destination for every + button in the theme.
            if (wantList) {
                pending++;
                ApiClient.getItems(userId, {
                    Filters: 'IsFavorite', IncludeItemTypes: 'Movie,Series', Recursive: true,
                    SortBy: 'DateCreated', SortOrder: 'Descending', Limit: 30,
                    Fields: RAIL_FIELDS, ImageTypeLimit: 1, EnableImageTypes: 'Thumb,Backdrop,Primary'
                }).then(function (r) {
                    collect(nfL().myList, (r && r.Items) || [], NF_ORDER.mylist, 'nf-mylist-section');
                }).catch(function () { failed++; }).then(done);
            }

            // 2) Because you watched X — seeded from the last titles finished.
            if (wantBecause && ApiClient.getSimilarItems) {
                pending++;
                ApiClient.getItems(userId, {
                    Filters: 'IsPlayed', IncludeItemTypes: 'Movie,Series', Recursive: true,
                    SortBy: 'DatePlayed', SortOrder: 'Descending', Limit: 2
                }).then(function (r) {
                    var seeds = (r && r.Items) || [];
                    if (!seeds.length) { return; }
                    return Promise.all(seeds.map(function (seed, i) {
                        return ApiClient.getSimilarItems(seed.Id, {
                            UserId: userId, Limit: 20, Fields: RAIL_FIELDS
                        }).then(function (sim) {
                            collect(nfL().becauseYouWatched.replace('{0}', seed.Name),
                                (sim && sim.Items) || [], NF_ORDER.because + i, 'nf-because-section');
                        }).catch(function () {});
                    }));
                }).catch(function () { failed++; }).then(done);
            }

            // 3) New Releases — recently added to the server.
            if (wantNew) {
                pending++;
                ApiClient.getItems(userId, {
                    IncludeItemTypes: 'Movie,Series', Recursive: true,
                    SortBy: 'DateCreated', SortOrder: 'Descending', Limit: 20,
                    Fields: RAIL_FIELDS, ImageTypeLimit: 1, EnableImageTypes: 'Thumb,Backdrop,Primary'
                }).then(function (r) {
                    collect(nfL().newReleases, (r && r.Items) || [], NF_ORDER.newly, 'nf-new-section');
                }).catch(function () { failed++; }).then(done);
            }

            // 4) Watch It Again — finished titles, most recently completed first.
            if (wantAgain) {
                pending++;
                ApiClient.getItems(userId, {
                    Filters: 'IsPlayed', IncludeItemTypes: 'Movie,Series', Recursive: true,
                    SortBy: 'DatePlayed', SortOrder: 'Descending', Limit: 20,
                    Fields: RAIL_FIELDS, ImageTypeLimit: 1, EnableImageTypes: 'Thumb,Backdrop,Primary'
                }).then(function (r) {
                    collect(nfL().watchAgain, (r && r.Items) || [], NF_ORDER.again, 'nf-again-section');
                }).catch(function () { failed++; }).then(done);
            }

            if (!pending) { railsBusy = false; retryLater(); }
        } catch (e) { railsBusy = false; }
    }

    function setupGenreRows() {
        try {
            if (cfg('GenreRows', true) !== true) { return; }
            if (!isHomePage()) { return; }
            if (genreBusy) { return; }
            if (typeof ApiClient === 'undefined' || !ApiClient.getItems || !ApiClient.getCurrentUserId) { return; }
            var container = activeHomeContainer();
            // Build once per freshly-rendered home container.
            if (!container || container.getAttribute('data-nf-rows') === '1') { return; }
            var userId = ApiClient.getCurrentUserId();
            if (!userId) { return; }

            genreBusy = true;
            container.setAttribute('data-nf-rows', '1');
            var sid = ApiClient.serverId && ApiClient.serverId();

            // Excluded genres are dropped at build time (so a cached list still
            // honours the current setting).
            var excluded = {};
            String(cfg('GenreRowsExclude', 'Documentary, Dokumentarfilm, Dokumentation'))
                .split(',').forEach(function (g) { g = g.trim().toLowerCase(); if (g) excluded[g] = true; });

            var genreIdx = 0;
            function addGenreSection(g, its) {
                if (!its.length || !isHomePage()) { return; }
                var c = activeHomeContainer();
                if (!c || c.getAttribute('data-nf-rows') !== '1') { return; }
                var sec = nfRowSection(g, its, sid);
                nfInsertOrdered(c, sec, NF_ORDER.genre + (genreIdx++));
                nfRowNav(sec);
                nfLazyImages(sec);
            }

            // Instant path: fully cached rows (name + items) build in one frame —
            // no network, no row-by-row pop-in. Rows rotate when the cache expires.
            var cachedRows = nfCacheGet('rows', GENRE_CACHE_MS);
            if (cachedRows && cachedRows.length) {
                genreBusy = false;
                cachedRows.forEach(function (row) { addGenreSection(row.g, row.items); });
                return;
            }

            function buildRows(genres) {
                var picked = genres.filter(function (g) { return !excluded[String(g).trim().toLowerCase()]; })
                    .slice(0, GENRE_MAX_ROWS);
                var collected = [];
                var settled = 0;
                picked.forEach(function (g) {
                    ApiClient.getItems(userId, {
                        IncludeItemTypes: 'Movie,Series', Recursive: true, Genres: g,
                        SortBy: 'Random', Limit: 20, ImageTypeLimit: 1, EnableImageTypes: 'Backdrop,Thumb,Primary',
                        Fields: 'DateCreated'
                    }).then(function (r) {
                        var its = ((r && r.Items) || []).filter(function (x) { return (x.BackdropImageTags && x.BackdropImageTags.length) || (x.ImageTags && (x.ImageTags.Thumb || x.ImageTags.Primary)); });
                        if (its.length) { collected.push({ g: g, items: its }); }
                        addGenreSection(g, its);
                    }).catch(function () {}).then(function () {
                        settled++;
                        if (settled === picked.length && collected.length) { nfCacheSet('rows', collected, userId); }
                    });
                });
            }

            if (genreCache.uid === userId && genreCache.genres && (Date.now() - genreCache.ts) < GENRE_CACHE_MS) {
                genreBusy = false;
                buildRows(genreCache.genres);
                return;
            }

            ApiClient.getItems(userId, {
                IncludeItemTypes: 'Movie,Series', Recursive: true, Fields: 'Genres', Limit: 400
            }).then(function (res) {
                genreBusy = false;
                var items = (res && res.Items) || [];
                var counts = {};
                items.forEach(function (it) {
                    (it.Genres || []).forEach(function (g) { counts[g] = (counts[g] || 0) + 1; });
                });
                // Keep more than GENRE_MAX_ROWS candidates so exclusions still
                // leave a full set of rows; buildRows filters + slices.
                var genres = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 24);
                genreCache.uid = userId;
                genreCache.genres = genres;
                genreCache.ts = Date.now();
                buildRows(genres);
            }).catch(function () {
                genreBusy = false;
                // Allow a retry on the next pass instead of leaving the home permanently rowless.
                var c = activeHomeContainer();
                if (c) c.removeAttribute('data-nf-rows');
            });
        } catch (e) { genreBusy = false; }
    }

    // ============ Continue Watching row (home page) — own sharp landscape cards ============
    var cwBusy = false;

    function cwImage(item, wide) {
        var t = item.ImageTags || {};
        // Prefer the Thumb image: it's the landscape asset WITH title art (Netflix boxart
        // style). Backdrops are textless by design (TMDB/fanart guidelines), so they only
        // serve as fallback. For episodes, the series' Thumb (ParentThumb) comes next.
        // the tile's REAL width at this viewport + card size (`wide`: a --nf-tile-wide tile)
        var w = wide ? nfWideTileCssWidth() : nfTileCssWidth();
        if (t.Thumb) return nfImg(item.Id, 'Thumb', t.Thumb, w);
        if (item.ParentThumbItemId && item.ParentThumbImageTag) return nfImg(item.ParentThumbItemId, 'Thumb', item.ParentThumbImageTag, w);
        if (item.BackdropImageTags && item.BackdropImageTags.length) return nfImg(item.Id, 'Backdrop', item.BackdropImageTags[0], w);
        if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) return nfImg(item.ParentBackdropItemId, 'Backdrop', item.ParentBackdropImageTags[0], w);
        if (t.Primary) return nfImg(item.Id, 'Primary', t.Primary, w);
        return '';
    }

    function setupContinueWatching() {
        try {
            if (cfg('CleanHome', true) !== true) { return; }
            if (!isHomePage()) { return; }
            if (cwBusy) { return; }
            if (typeof ApiClient === 'undefined' || !ApiClient.getItems || !ApiClient.getCurrentUserId) { return; }
            var container = activeHomeContainer();
            if (!container || container.getAttribute('data-nf-cw') === '1') { return; }
            var userId = ApiClient.getCurrentUserId();
            if (!userId) { return; }

            cwBusy = true;
            container.setAttribute('data-nf-cw', '1');
            var sid = ApiClient.serverId && ApiClient.serverId();

            function cwFingerprint(items) {
                return items.map(function (i) { return i.Id + ':' + Math.round((i.UserData && i.UserData.PlayedPercentage) || 0); }).join(',');
            }

            // Netflix's second line: "S2:E4 · 23 min left".
            function cwSubtitle(item) {
                var bits = [];
                if (item.Type === 'Episode' && item.ParentIndexNumber != null && item.IndexNumber != null) {
                    bits.push('S' + item.ParentIndexNumber + ':E' + item.IndexNumber);
                }
                var total = item.RunTimeTicks || 0;
                var pos = (item.UserData && item.UserData.PlaybackPositionTicks) || 0;
                if (total > pos) {
                    var mins = Math.round((total - pos) / 600000000);
                    if (mins > 0) { bits.push(nfL().minLeft.replace('{0}', mins)); }
                }
                return bits.join(' · ');
            }

            function cwCardsHtml(items) {
                return items.map(function (item) {
                    var pct = (item.UserData && item.UserData.PlayedPercentage) || 0;
                    var name = item.Type === 'Episode' ? (item.SeriesName || item.Name) : item.Name;
                    var href = '#/details?id=' + item.Id + (sid ? '&serverId=' + sid : '');
                    var sub = cwSubtitle(item);
                    // data-* mirrors the card contract so the shared preview popup
                    // and eligibleCard() work on these tiles; aria-label because the
                    // tile's only text nodes are display:none on desktop, so screen
                    // readers announced an empty link.
                    return '<a class="nf-cw-card" href="' + href + '" data-id="' + item.Id + '"' +
                        ' data-serverid="' + (sid || '') + '" data-type="' + (item.Type || '') + '"' +
                        ' data-mediatype="Video" data-isfolder="false"' +
                        ' aria-label="' + esc(name || '') + (sub ? ' — ' + esc(sub) : '') + '">' +
                        '<div class="nf-cw-thumb" data-nf-bg="' + esc(cwImage(item, true)) + '">' +
                            '<div class="nf-cw-play"><span class="material-icons" aria-hidden="true">play_arrow</span></div>' +
                            '<button type="button" class="nf-cw-remove" title="' + nfL().removeRow + '" aria-label="' + nfL().removeRow + '"><span class="material-icons" aria-hidden="true">close</span></button>' +
                            '<div class="nf-cw-prog"><i style="width:' + Math.max(2, Math.min(100, pct)) + '%"></i></div>' +
                        '</div>' +
                        '<div class="nf-cw-title">' + esc(name || '') + '</div>' +
                        (sub ? '<div class="nf-cw-sub">' + esc(sub) + '</div>' : '') +
                        '</a>';
                }).join('');
            }

            // "Remove from row" — clearing the resume position is exactly what
            // Netflix's remove does: the title stops being "in progress".
            function wireCwRemove(sec) {
                sec.querySelectorAll('.nf-cw-remove').forEach(function (btn) {
                    btn.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var card = btn.closest('.nf-cw-card');
                        var id = card && card.getAttribute('data-id');
                        if (!id || !ApiClient.markUnplayed) { return; }
                        ApiClient.markUnplayed(userId, id, new Date()).then(function () {
                            if (card.parentNode) { card.parentNode.removeChild(card); }
                            // Evict just this title so the rest of the row still paints
                            // instantly from cache on the next visit.
                            var keep = (nfCacheGet('cw', 30 * 60 * 1000) || []).filter(function (i) { return i.Id !== id; });
                            nfCacheSet('cw', keep, userId);
                            var track = sec.querySelector('.nf-cw-track');
                            if (track && !track.children.length) { sec.remove(); }
                            else if (sec._nfUpd) { sec._nfUpd(); }
                        }).catch(function () {});
                    });
                });
            }

            function insertCwSection(items) {
                var c = activeHomeContainer();
                if (!c || c.getAttribute('data-nf-cw') !== '1' || c.querySelector('.nf-cw-section')) { return null; }
                var sec = document.createElement('div');
                sec.className = 'verticalSection nf-cw-section';
                sec.setAttribute('data-nf-fp', cwFingerprint(items));
                sec.innerHTML = '<h2 class="sectionTitle sectionTitle-cards">' + nfL().cw + '</h2>' +
                    '<div class="nf-cw-scroll"><div class="nf-cw-track">' + cwCardsHtml(items) + '</div></div>';
                nfInsertOrdered(c, sec, NF_ORDER.cw);
                nfRowNav(sec);
                nfLazyImages(sec);
                wireCwRemove(sec);
                return sec;
            }

            // Instant path: paint the cached row immediately, then refresh below —
            // Continue Watching must stay CURRENT (progress changes constantly), so
            // the fresh result diff-updates the row only when it actually changed.
            var cachedCw = nfCacheGet('cw', 30 * 60 * 1000);
            if (cachedCw && cachedCw.length) { insertCwSection(cachedCw); }

            ApiClient.getItems(userId, {
                Filters: 'IsResumable', SortBy: 'DatePlayed', SortOrder: 'Descending',
                Recursive: true, MediaTypes: 'Video', Limit: 12,
                ImageTypeLimit: 1, EnableImageTypes: 'Thumb,Backdrop,Primary',
                // RunTimeTicks + UserData drive the "23 min left" line.
                Fields: 'RunTimeTicks,UserData,DateCreated'
            }).then(function (res) {
                cwBusy = false;
                var items = (res && res.Items) || [];
                if (!isHomePage()) { return; }
                var c = activeHomeContainer();
                if (!c || c.getAttribute('data-nf-cw') !== '1') { return; }
                nfCacheSet('cw', items, userId);
                var sec = c.querySelector('.nf-cw-section');
                if (!sec) {
                    if (items.length) { insertCwSection(items); }
                    return;
                }
                if (!items.length) { sec.remove(); return; }
                if (sec.getAttribute('data-nf-fp') === cwFingerprint(items)) { return; }
                sec.setAttribute('data-nf-fp', cwFingerprint(items));
                var track = sec.querySelector('.nf-cw-track');
                if (track) {
                    track.innerHTML = cwCardsHtml(items);
                    nfLazyImages(sec); wireCwRemove(sec);
                    if (sec._nfUpd) { sec._nfUpd(); }   // card count changed -> page dots
                }
            }).catch(function () {
                cwBusy = false;
                var c = activeHomeContainer();
                if (c && !c.querySelector('.nf-cw-section')) c.removeAttribute('data-nf-cw');
            });
        } catch (e) { cwBusy = false; }
    }

    // Take ownership of the home page: tag the container so CSS hides native / other-plugin
    // rows + the page tab bar — but only once OUR rows exist, so a slow/failed build never
    // leaves an empty home. Also toggles html.nf-home for header-tab hiding scoped to home.
    function markHomeOwned() {
        try {
            var onHome = isHomePage();
            // nf-home hides the native home tab bar — that only makes sense when the
            // clean-home takeover is actually enabled.
            document.documentElement.classList.toggle('nf-home', onHome && cfg('CleanHome', true) === true);
            if (cfg('CleanHome', true) !== true || !onHome) { return; }
            var c = activeHomeContainer();
            if (!c) { return; }
            if (c.querySelector('.nf-genre-section') || c.querySelector('.nf-cw-section')) {
                c.classList.add('nf-owned');
                c.classList.remove('nf-reveal-native');
            }
            // Failsafe for the instant native-row hide the generated CSS applies
            // under Clean Home: if OUR rows fail to build (API down, empty
            // library), reveal the native home instead of leaving it blank.
            // (The hero coexists with native rows, so it doesn't count as "built".)
            if (!c.getAttribute('data-nf-failsafe')) {
                c.setAttribute('data-nf-failsafe', '1');
                setTimeout(function () {
                    if (!document.body.contains(c)) { return; }
                    if (!c.querySelector('.nf-genre-section') && !c.querySelector('.nf-cw-section')) {
                        c.classList.add('nf-reveal-native');
                    }
                }, 7000);
            }
        } catch (e) {}
    }

    // ============ Netflix hover-expand popup (card preview) ============
    // On card hover, float a larger preview card over the row: backdrop (with a
    // muted ~30s autoplay clip), action buttons, title, % match, rating, genres.
    var popCard = null;
    var popTimer = null;
    var popEl = null;
    var popHideTimer = null;
    var POP_DELAY = 300;   // snappier hover-to-preview (was 500ms) — still deliberate enough to ignore pass-throughs
    var PREVIEW_SECONDS = 30;

    function destroyPopEl() {
        if (!popEl) { return; }
        var el = popEl;
        popEl = null;
        var v = el.querySelector('video');
        if (v) nfKillVideo(v);
        el.classList.remove('show');
        setTimeout(function () { if (el.parentNode) { el.remove(); } }, 180);
    }

    function clearPreview() {
        if (popTimer) { clearTimeout(popTimer); popTimer = null; }
        if (popHideTimer) { clearTimeout(popHideTimer); popHideTimer = null; }
        destroyPopEl();
        popCard = null;
    }

    function eligibleCard(card) {
        if (!card || !card.getAttribute) return false;
        if (card.classList.contains('personCard')) return false;
        var id = card.getAttribute('data-id');
        if (!id) return false;
        var type = (card.getAttribute('data-type') || '').toLowerCase();
        var mediaType = (card.getAttribute('data-mediatype') || '').toLowerCase();
        if (type === 'person' || type === 'photo' || type === 'musicalbum' || type === 'audio') return false;
        // Library tiles are containers, not titles — no preview popup for them on
        // any input (and hijacking their first tap broke navigation on touch).
        if (type === 'collectionfolder' || type === 'userview') return false;
        if (mediaType && mediaType !== 'video') return false;
        return true;
    }

    // Build a muted preview <video> into the popup. We REMUX (copy h264+aac into a
    // fragmented mp4) rather than force a downscale transcode: forcing maxWidth/videoBitRate
    // makes the server re-encode via its hardware encoder, which fails (ffmpeg code 187) for
    // these short on-the-fly clips, and source containers like MPEG-TS can't direct-play in
    // the browser. Copy-remux to mp4 plays everywhere and is light on the server.
    //
    // DELIVERY: iOS/Safari only autoplays a <video> whose source answers HTTP byte-range
    // requests (206). Jellyfin's live transcode stream usually returns 200 with no range
    // support, so iOS refuses it — which is why previews showed "image zoom but no video" on
    // iPhone/iPad (and in the mobile app's WebView) while desktop Chrome played them fine. So
    // we play the DIRECT original file (static=true serves it with 206 + Accept-Ranges, the
    // same path normal direct-play uses) whenever the browser says it can decode it, and use
    // the h264 copy-remux only for sources it can't (e.g. HEVC/MKV on desktops).
    var NF_TPS = 10000000; // Jellyfin ticks per second (ticks are 100ns units)
    function nfVideoUrl(playId, path, query, msId) {
        // ApiKey, not api_key: Jellyfin 12.0 disables legacy authorization by
        // default (and migrates existing installs to disable it too), and the
        // lower-case form is part of it — verified live, an authenticated request
        // carrying api_key= answers 401 on 12.0 and 200 on 10.11, while ApiKey=
        // answers 200 on both. The trickplay prefetch already uses this spelling.
        return ApiClient.serverAddress() + '/Videos/' + playId + path + '?' + query
            + (msId ? '&mediaSourceId=' + msId : '')
            + '&ApiKey=' + ApiClient.accessToken();
    }
    function nfTransUrl(playId, msId, startTicks) {
        return nfVideoUrl(playId, '/stream.mp4',
            'videoCodec=h264&audioCodec=aac&allowVideoStreamCopy=true&allowAudioStreamCopy=true'
            + (startTicks ? '&startTimeTicks=' + startTicks : ''), msId);
    }
    function nfStaticUrl(playId, msId) {
        return nfVideoUrl(playId, '/stream', 'static=true', msId);
    }
    function nfPlay(v) {
        var p = v.play(); if (p && p.catch) { p.catch(function () {}); }
    }
    // Full teardown for a preview <video>: cancel its timers, abort the in-flight stream
    // (removeAttribute + load) and drop the element. A detached-but-loaded video keeps
    // streaming/transcoding server-side, so every discard path must come through here.
    function nfKillVideo(v) {
        if (!v) return;
        v._nfDead = true; // events fired by the teardown itself must not resurrect the clip
        if (v._nfVwTimer) { clearTimeout(v._nfVwTimer); v._nfVwTimer = null; }
        if (v._nfWatchTimer) { clearTimeout(v._nfWatchTimer); v._nfWatchTimer = null; }
        if (v._stopTimer) { clearTimeout(v._stopTimer); v._stopTimer = null; }
        // Hero choreography (.nf-clip-on: shrunk logo, hidden synopsis) is bound to a
        // LIVE clip. Every teardown funnels through here — nfClaim eviction, the stall
        // watchdog, errors — so restore the copy here or it stays stuck when a kill
        // path bypasses stopClip()/_stopTimer.
        try { var s = v.closest && v.closest('.nf-hero-slide'); if (s) s.classList.remove('nf-clip-on'); } catch (e) {}
        // Same for the hover popup: the media-title overlay fades out while a clip
        // renders (clip-on) and must come back on every teardown path.
        try { var pm = v.closest && v.closest('.nf-pop-media'); if (pm) pm.classList.remove('clip-on'); } catch (e) {}
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
        try { v.remove(); } catch (e) {}
    }
    // Tear down EVERY preview clip in the document, wherever it lives.
    //
    // Every other nf-playing guard in this file is an ENTRY guard: it stops a NEW clip
    // starting. Nothing stopped one already in flight, and none of the five paths that
    // normally end a clip can fire once playback begins:
    //   * stopClip() <- go() <- the hero setInterval — the interval body early-returns
    //     on nf-playing;
    //   * stopClip() <- the hero IntersectionObserver — IO reports INTERSECTION, not
    //     OCCLUSION, so a full-screen video leaves the hero 100% intersecting and
    //     heroInView stays true;
    //   * removeHero() <- setupHero() <- applyDynamic — the fast path returns first;
    //   * nfClaim() eviction — only runs when a new clip starts, which is blocked;
    //   * v._stopTimer — the ONLY one, and it is up to PREVIEW_SECONDS (30s) away.
    // So pressing Play within ~30s of a slide activating left a second <video> decoding
    // AND streaming a server-side remux underneath the movie, which is exactly why the
    // seek-bar trickplay preview stuttered while playing and was smooth while paused.
    // Called on the false->true EDGE of nf-playing (see applyDynamic).
    function nfStopAllPreviewMedia() {
        try {
            // A PENDING detail clip counts as preview media: attachNow used to fire
            // its 2.5s timer INTO real playback (stillHere() passes whenever the
            // hash never changed — JMP State-A, casting from the detail page) and
            // start a fresh stream under the movie. cleanupDetailClip clears that
            // timer AND the data-nf-clip marker — without the marker sweep, a
            // visibility/pagehide kill left the detail clip permanently disabled
            // for that page (the id-match early return never re-armed it).
            cleanupDetailClip();
            document.querySelectorAll('video[data-nf-preview], .nf-hero-video, .nf-detail-video, .nf-pop video')
                .forEach(nfKillVideo);
            nfActiveVideo = null;
            clearPreview();   // also drops the hover popup that may own one
        } catch (e) {}
    }

    // One muted, inline-autoplay clip element — shared by hero, hover popup and detail.
    function nfNewClipVideo(className) {
        var v = document.createElement('video');
        if (className) v.className = className;
        // Marks EVERY clip the theme creates, whatever it is for. nfStopAllPreviewMedia
        // kills by this attribute as well as by class, so a future clip type cannot be
        // left decoding under the player just because someone forgot to add its
        // selector to the teardown list.
        v.setAttribute('data-nf-preview', '');
        v.muted = true; v.defaultMuted = true; v.autoplay = true;
        v.setAttribute('playsinline', ''); v.setAttribute('preload', 'auto');
        return v;
    }
    // Netflix previews skip the intro and play from inside the title. Start ~20% in for
    // titles long enough to have a middle; shorter clips start at 0.
    function nfSeekStart(ticks) {
        var t = parseInt(ticks, 10) || 0;
        return t >= 90 * NF_TPS ? Math.floor(t * 0.2) : 0; // >= 90s -> 20% in
    }
    // Can this browser decode the original file? Decided up front from the item's
    // MediaSource (container + video codec) via canPlayType, so undecodable sources go
    // straight to the transcode instead of wasting a blind 5s direct attempt (black box +
    // full-bitrate download). Anything unknown errs toward trying the direct file.
    function nfCanDirect(ms) {
        try {
            if (!ms || !ms.Container) return true;
            var mimes = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', ts: 'video/mp2t', mpegts: 'video/mp2t', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv' };
            var container = String(ms.Container).toLowerCase().split(',')[0];
            var mime = mimes[container];
            if (!mime) return true;
            var codecs = { h264: 'avc1.640029', hevc: 'hvc1.1.6.L120.B0', h265: 'hvc1.1.6.L120.B0', av1: 'av01.0.08M.08', vp9: 'vp09.00.40.08', vp8: 'vp8' };
            var vs = (ms.MediaStreams || []).filter(function (s) { return s.Type === 'Video'; })[0];
            var codec = vs && vs.Codec && codecs[String(vs.Codec).toLowerCase()];
            var probe = document.createElement('video');
            return probe.canPlayType(codec ? mime + '; codecs="' + codec + '"' : mime) !== '';
        } catch (e) { return true; }
    }
    // Point a clip <video> at its source. Direct file when decodable (iOS-compatible),
    // seeked ~20% in via a #t= media fragment so the browser's FIRST range request lands at
    // the offset (no wasted head download). Otherwise — or on error — the h264 copy-remux,
    // seeked via startTimeTicks with a retry at 0: a mid-file seek can 500 on MPEG-TS
    // sources without a keyframe there (the historical clip-500 bug), and start-0 is the
    // remux that always worked. Removed only after every stage fails.
    function nfClipSrc(v, playId, ms, ticks) {
        var msId = ms && ms.Id;
        var start = nfSeekStart(ticks);  // ticks offset for the transcode seek
        var startSec = start / NF_TPS;   // seconds for the direct-file fragment/seek
        v._nfLoopStart = 0;              // where nfClipLoop re-enters after 'ended'
        function toTranscode(startTicks) {
            if (v._nfDead) return;
            v._nfFell = true;
            v._nfSeeked = !!startTicks;  // a seeked remux may 500 -> retried at 0
            if (v._nfVwTimer) { clearTimeout(v._nfVwTimer); v._nfVwTimer = null; }
            v._nfLoopStart = 0;          // the transcode's timeline already begins mid-title
            try {
                v.src = nfTransUrl(playId, msId, startTicks); v.load(); nfPlay(v);
                nfClipWatch(v);          // fresh stall budget for the new source
            } catch (e) {}
        }
        v.addEventListener('error', function () {
            if (v._nfDead || !document.body.contains(v)) return;
            if (!v._nfFell) { toTranscode(start); }
            else if (v._nfSeeked) { toTranscode(0); }
            else { nfKillVideo(v); }
        });
        if (!nfCanDirect(ms)) { toTranscode(start); return; }
        v.addEventListener('loadedmetadata', function onMeta() {
            v.removeEventListener('loadedmetadata', onMeta);
            if (v._nfFell || !startSec) return;
            // Safety seek for browsers that ignore the #t= media fragment.
            try { if (isFinite(v.duration) && v.duration > startSec + 2 && v.currentTime < startSec - 1) v.currentTime = startSec; } catch (e) {}
        });
        // No-picture watchdog: data is decoding but no video frame appeared (an HEVC track on
        // a desktop without HEVC support plays audio only and never fires 'error'). A file
        // that is merely still buffering gets another 5s instead of a spurious transcode;
        // true stalls are nfClipWatch's job.
        v._nfVwTimer = setTimeout(function check() {
            v._nfVwTimer = null;
            if (!document.body.contains(v) || v._nfFell || v.videoWidth > 0) return;
            if (v.readyState >= 2) { toTranscode(start); }
            else { v._nfVwTimer = setTimeout(check, 5000); }
        }, 5000);
        v._nfLoopStart = startSec;
        v.src = nfStaticUrl(playId, msId) + (startSec ? '#t=' + startSec : '');
    }
    // Stall watchdog: if a clip hasn't actually started progressing within ~10s (slow or
    // failed on-the-fly remux), drop it so the static backdrop/poster image stays instead of
    // a frozen or endlessly-loading video box.
    function nfClipWatch(v) {
        if (v._nfWatchTimer) { clearTimeout(v._nfWatchTimer); }
        v._nfWatchTimer = setTimeout(function () {
            v._nfWatchTimer = null;
            try {
                if (!v || !document.body.contains(v)) return;
                if (v.currentTime < 0.3 || v.readyState < 3) nfKillVideo(v);
            } catch (e) {}
        }, 10000);
    }
    // Ambient re-loop WITHOUT the native `loop` attribute. A copy-remux of an
    // MPEG-TS source has no global duration up front (duration === NaN); with
    // loop=true the browser hits the early buffered/fragment boundary, treats it
    // as end-of-media and seeks back to 0 — over and over — so the clip "skips
    // like a record". Letting it play un-looped lets the duration resolve and the
    // clip plays straight through; we then restart manually on `ended`, but only
    // once the duration is known, finite and long enough to be a real clip.
    function nfClipLoop(v) {
        v.addEventListener('ended', function () {
            if (!document.body.contains(v)) return;
            if (isFinite(v.duration) && v.duration > 6) {
                // Re-enter at the clip's start point (the ~20% intro-skip on the direct
                // file; 0 on a transcode whose timeline already begins there) — looping to
                // absolute 0 would replay the very intro the seek exists to skip.
                try { v.currentTime = v._nfLoopStart || 0; nfPlay(v); } catch (e) {}
            } else {
                try { v.pause(); } catch (e) {}
            }
        });
    }
    // Single active clip across the whole UI: only ONE clip remux runs at a time. On a box
    // with a busy/limited transcoder, several concurrent remuxes (rotating hero + hover +
    // detail) saturate it and ALL stall (clip "ends" / detail "won't play"). Before starting a
    // new clip we stop the previous one, so there is never more than one transcode in flight.
    var nfActiveVideo = null;
    function nfClaim(v) {
        try {
            if (nfActiveVideo && nfActiveVideo !== v) nfKillVideo(nfActiveVideo);
        } catch (e) {}
        nfActiveVideo = v;
    }
    function makeClip(pop, playId, ms, ticks) {
        var media = pop.querySelector('.nf-pop-media');
        if (!media || popEl !== pop) return;
        var video = nfNewClipVideo('');
        // Fade in only once frames are actually rendering — a <video> without a
        // decoded frame paints SOLID BLACK over the artwork (the "black screen").
        // clip-on lets CSS fade the media-title overlay out with the clip;
        // nfKillVideo removes it again on every teardown path.
        video.addEventListener('playing', function () { video.classList.add('show'); media.classList.add('clip-on'); });
        nfClaim(video);
        nfClipSrc(video, playId, ms, ticks);
        media.insertBefore(video, media.firstChild);
        nfPlay(video);
        // End of the preview window: tear the clip down fully (not just pause) so the
        // browser stops buffering the rest of the file; the card artwork shows again.
        video._stopTimer = setTimeout(function () { nfKillVideo(video); }, PREVIEW_SECONDS * 1000);
        nfClipWatch(video);
    }

    // Decide what to stream for the hovered item. Movies/episodes stream themselves; a
    // Series/Season has no own runtime, so we fetch one representative episode and stream that.
    function streamClipInto(pop, item) {
        if (cfg('PreviewClips', true) === false) return;
        if (nfReducedMotion() || nfCheapMode()) return;
        var type = item.Type || '';
        if (type !== 'Series' && type !== 'Season' && (item.RunTimeTicks || 0) >= 120 * NF_TPS) {
            makeClip(pop, item.Id, item.MediaSources && item.MediaSources[0], item.RunTimeTicks || 0);
            return;
        }
        if (type === 'Series' || type === 'Season' || item.IsFolder) {
            var uid = ApiClient.getCurrentUserId && ApiClient.getCurrentUserId();
            if (!uid || !ApiClient.getItems) return;
            ApiClient.getItems(uid, {
                ParentId: item.Id, IncludeItemTypes: 'Episode', Recursive: true,
                Limit: 1, SortBy: 'SortName', SortOrder: 'Ascending', Fields: 'MediaSources,RunTimeTicks'
            }).then(function (res) {
                if (popEl !== pop) return;
                var ep = res && res.Items && res.Items[0];
                if (!ep) return;
                makeClip(pop, ep.Id, ep.MediaSources && ep.MediaSources[0], ep.RunTimeTicks || 0);
            }).catch(function () {});
        }
    }

    function buildPop(card) {
        if (typeof ApiClient === 'undefined' || !ApiClient.getItem) return;
        var id = card.getAttribute('data-id');
        if (!id) return;
        var sid = card.getAttribute('data-serverid') || (ApiClient.serverId && ApiClient.serverId());
        var uid = ApiClient.getCurrentUserId && ApiClient.getCurrentUserId();

        ApiClient.getItem(uid, id).then(function (item) {
            if (popCard !== card || !item) return;
            var cr = card.getBoundingClientRect();
            if (!cr.width) return;
            var vw = window.innerWidth;
            // 1.6x the tile, as Netflix's mini-modal is — but that is a rule for a tile
            // of ordinary width. Continue Watching on the portrait card style spans
            // two poster columns (~380px), and 1.6x of that was a 610px panel that
            // covered the billboard's buttons. Past ~260px the popup only has to
            // clear the tile it grew out of.
            var Wp = Math.max(Math.min(cr.width * 1.6, Math.max(cr.width + 48, 420)), 300);
            var left = Math.min(Math.max(cr.left + cr.width / 2 - Wp / 2, 8), vw - Wp - 8);
            var top = Math.max(cr.top - 36, 72);

            // Same preference as the row cards: titled Thumb first, textless Backdrop as fallback.
            var pt = item.ImageTags || {};
            var bd = item.BackdropImageTags && item.BackdropImageTags[0];
            var popW = Math.round(Wp);
            var media = pt.Thumb
                ? nfImg(item.Id, 'Thumb', pt.Thumb, popW)
                : (bd
                    ? nfImg(item.Id, 'Backdrop', bd, popW)
                    : (pt.Primary ? nfImg(item.Id, 'Primary', pt.Primary, popW) : ''));
            var detailUrl = '#/details?id=' + item.Id + (sid ? '&serverId=' + sid : '');
            var match = matchHtml(item.CommunityRating, 'nf-pop-match');
            var rating = item.OfficialRating ? '<span class="nf-pop-rating">' + esc(item.OfficialRating) + '</span>' : '';
            // Netflix meta order: match %, maturity, then duration (movies) or season
            // count (series), then an HD chip. Year only when neither length is known.
            var extra = '';
            if (item.ChildCount) {
                extra = '<span>' + item.ChildCount + ' ' + (item.ChildCount > 1 ? nfL().seasons : nfL().season) + '</span>';
            } else if (item.Type !== 'Series' && item.RunTimeTicks) {
                var dur = nfRuntimeText(item.RunTimeTicks);
                if (dur) { extra = '<span>' + dur + '</span>'; }
            }
            if (!extra && item.ProductionYear) { extra = '<span>' + item.ProductionYear + '</span>'; }
            var hd = (item.IsHD === true || (item.IsHD === undefined && item.Width >= 1280)) ? '<span class="nf-pop-hd">HD</span>' : '';
            var genres = (item.Genres || []).slice(0, 3).map(function (g) { return '<span>' + esc(g) + '</span>'; }).join('');

            var pop = document.createElement('div');
            pop.className = 'nf-pop';
            pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.width = Wp + 'px';
            pop.innerHTML =
                '<a class="nf-pop-media" href="' + detailUrl + '"' + (media ? ' style="background-image:url(\'' + media + '\')"' : '') + '><div class="nf-pop-fade"></div><span class="nf-pop-media-title">' + esc(item.Name || '') + '</span></a>' +
                '<div class="nf-pop-info">' +
                    '<div class="nf-pop-actions">' +
                        // nf-autoplay: ▶ used to be a second More-Info link — it now
                        // routes through the detail page's STOCK Play button (see init).
                        '<a class="nf-pop-btn play nf-autoplay" data-id="' + item.Id + '" href="' + detailUrl + '" title="' + nfL().play + '" aria-label="' + nfL().play + '"><span class="material-icons" aria-hidden="true">play_arrow</span></a>' +
                        '<button type="button" class="nf-pop-btn nf-pop-list" title="' + nfL().myList + '" aria-label="' + nfL().myList + '"><span class="material-icons" aria-hidden="true">add</span></button>' +
                        '<button type="button" class="nf-pop-btn nf-pop-like" title="' + nfL().like + '" aria-label="' + nfL().like + '"><span class="material-icons" aria-hidden="true">thumb_up_off_alt</span></button>' +
                        '<a class="nf-pop-btn more" href="' + detailUrl + '" title="' + nfL().moreInfo + '" aria-label="' + nfL().moreInfo + '"><span class="material-icons" aria-hidden="true">expand_more</span></a>' +
                    '</div>' +
                    '<div class="nf-pop-meta">' + match + rating + ((extra || hd) ? '<span class="nf-pop-tail">' + extra + hd + '</span>' : '') + '</div>' +
                    (genres ? '<div class="nf-pop-genres">' + genres + '</div>' : '') +
                '</div>';

            pop.addEventListener('mouseenter', function () { if (popHideTimer) { clearTimeout(popHideTimer); popHideTimer = null; } });
            pop.addEventListener('mouseleave', function () { clearPreview(); });

            var listBtn = pop.querySelector('.nf-pop-list');
            if (listBtn && item.UserData && item.UserData.IsFavorite) {
                listBtn.classList.add('active');
                listBtn.querySelector('.material-icons').textContent = 'check';
            }
            if (listBtn) {
                listBtn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    if (!uid || !ApiClient.updateFavoriteStatus) return;
                    var nowFav = !listBtn.classList.contains('active');
                    ApiClient.updateFavoriteStatus(uid, item.Id, nowFav).then(function () {
                        listBtn.classList.toggle('active', nowFav);
                        listBtn.querySelector('.material-icons').textContent = nowFav ? 'check' : 'add';
                        if (item.UserData) { item.UserData.IsFavorite = nowFav; }
                        nfInvalidateRails(uid);
                    }).catch(function () {});
                });
            }

            // Like (👍) — Netflix thumbs. Maps to Jellyfin's Likes rating.
            var likeBtn = pop.querySelector('.nf-pop-like');
            if (likeBtn && item.UserData && item.UserData.Likes === true) {
                likeBtn.classList.add('active');
                likeBtn.querySelector('.material-icons').textContent = 'thumb_up';
            }
            if (likeBtn) {
                likeBtn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    if (!uid || !ApiClient.updateUserItemRating) return;
                    var nowLike = !likeBtn.classList.contains('active');
                    ApiClient.updateUserItemRating(uid, item.Id, nowLike).then(function () {
                        likeBtn.classList.toggle('active', nowLike);
                        likeBtn.querySelector('.material-icons').textContent = nowLike ? 'thumb_up' : 'thumb_up_off_alt';
                    }).catch(function () {});
                });
            }

            // Continue Watching tiles carry a ✕ that this popup now covers: .nf-pop is
            // fixed at z-index 10010 and centred ON the tile, and moving the pointer
            // toward the ✕ enters the popup (whose mouseenter cancels the hide timer),
            // so with a mouse the button became unreachable the moment CW tiles joined
            // the preview. Surface the same action inside the popup instead.
            if (card.classList && card.classList.contains('nf-cw-card') && ApiClient.markUnplayed) {
                var rmBtn = document.createElement('button');
                rmBtn.type = 'button';
                rmBtn.className = 'nf-pop-btn nf-pop-remove';
                rmBtn.title = nfL().removeRow;
                rmBtn.setAttribute('aria-label', nfL().removeRow);
                rmBtn.innerHTML = '<span class="material-icons" aria-hidden="true">close</span>';
                rmBtn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    if (!uid) return;
                    ApiClient.markUnplayed(uid, item.Id, new Date()).then(function () {
                        var cwSec = card.closest && card.closest('.nf-cw-section');
                        if (card.parentNode) { card.parentNode.removeChild(card); }
                        // Evict just this title so the rest of the row still paints
                        // instantly from cache on the next visit (mirrors wireCwRemove).
                        var keep = (nfCacheGet('cw', 30 * 60 * 1000) || []).filter(function (i) { return i.Id !== item.Id; });
                        nfCacheSet('cw', keep, uid);
                        clearPreview();
                        if (cwSec) {
                            var tr = cwSec.querySelector('.nf-cw-track');
                            if (tr && !tr.children.length) { cwSec.remove(); }
                            else if (cwSec._nfUpd) { cwSec._nfUpd(); }
                        }
                    }).catch(function () {});
                });
                var acts = pop.querySelector('.nf-pop-actions');
                var moreBtn = acts && acts.querySelector('.nf-pop-btn.more');
                if (acts) { acts.insertBefore(rmBtn, moreBtn || null); }
            }

            destroyPopEl();
            popEl = pop;
            document.body.appendChild(pop);
            // Centre it ON the tile, then clamp. The height is only measurable once
            // the content is in the DOM. Anchoring the TOP 36px above the card meant
            // a popup ~2.5x the card's height extended ~184px BELOW it, so the reveal
            // read as a panel dropping down over the row underneath rather than the
            // tile expanding in place (Netflix's mini-modal grows from the centre).
            var popH = pop.offsetHeight;
            if (popH) {
                top = Math.round(cr.top + cr.height / 2 - popH / 2);
                top = Math.min(top, window.innerHeight - 8 - popH);
                top = Math.max(top, 76);                        // clear the fixed header
                if (popH > window.innerHeight - 84) { top = 8; } // taller than the viewport
                pop.style.top = top + 'px';
            }

            // Reveal only once the artwork is ALREADY painted — showing the tile
            // while the image was still loading flashed a black box first.
            var shown = false;
            function reveal() {
                if (shown || popEl !== pop) return;
                shown = true;
                requestAnimationFrame(function () { pop.classList.add('show'); });
                streamClipInto(pop, item);
            }
            if (media) {
                var im = new Image();
                im.onload = reveal;
                im.onerror = reveal;
                im.src = media;
                setTimeout(reveal, 400); // slow network: show anyway with the fade
            } else {
                reveal();
            }
        }).catch(function () {});
    }

    function nfIsTouch() {
        // (hover: none) alone misfires on VMs / RDP / headless setups, which would
        // silently disable the desktop hover popup. Real touch devices (iPad, phone)
        // report a coarse pointer too, so require both.
        return nfMM('(hover: none)') && nfMM('(any-pointer: coarse)');
    }

    // Touch devices (iPad / phone) have no hover. Netflix-on-touch: the FIRST tap on a card
    // shows the preview popup (instead of opening the title); a second tap on the same card —
    // or its Play / More buttons — opens it. Reuses the same buildPop()/popup as desktop hover.
    function setupTouchPreviews() {
        document.body.addEventListener('click', function (e) {
            if (cfg('HoverPreviewCard', true) === false) return;
            // The popup is display:none below 769px — intercepting the tap there
            // would swallow every first tap with nothing to show. Let phones navigate.
            // (max-height too: a LANDSCAPE phone is 844+px wide but ~390px tall —
            // the width gate alone armed the intercept on a screen with no room
            // for the popup. Mirrored by the CSS gate at the end of netflix.css.)
            if (nfMM('(max-width: 768px)') || nfMM('(max-height: 500px)')) return;
            if (popEl && popEl.contains(e.target)) return;            // inside popup -> let its links act
            // This listener is CAPTURE phase, so its stopPropagation() would fire
            // before .nf-cw-remove's own bubble handler and swallow the first tap.
            // Explicit play controls act on the FIRST tap too — converting a tap
            // on a visible ▶ into "open a preview" reads as a broken button.
            if (e.target.closest && e.target.closest('.nf-cw-remove, .cardOverlayButton, [data-action="resume"], [data-action="play"], .nf-autoplay, .nf-pop-btn')) return;
            var card = e.target.closest && e.target.closest('.card, .nf-cw-card');
            // Reset unconditionally on a non-card tap: skipping it when popEl was
            // null left popCard poisoned after a failed buildPop.
            if (!card || !eligibleCard(card)) { clearPreview(); return; }
            // Second tap on the same card navigates WHETHER OR NOT the popup
            // materialized. Requiring popEl here meant every buildPop failure
            // (getItem rejection, deleted item, zero-width rect) re-swallowed the
            // tap forever — the title became un-openable on tablets.
            if (card === popCard) return;
            e.preventDefault();                                       // first tap -> preview only
            e.stopPropagation();
            clearPreview();
            popCard = card;
            buildPop(card);
        }, true);
        window.addEventListener('scroll', function () { clearPreview(); }, true);
    }

    // Phones hide the Continue Watching ✕ (one mistap from clearing a resume
    // point), which left NO remove path at all below 769px. Netflix mobile uses a
    // long-press: a ~550ms hold (or the long-press contextmenu on Android) adds
    // .nf-lp to the tile, revealing the ✕ for a few seconds — removal stays a
    // deliberate two-step. Passive listeners only; a >10px drift cancels the hold
    // so flings never trigger it.
    function setupCwLongPress() {
        if (window.__nfCwLp) return;
        window.__nfCwLp = true;
        var lpTimer = null, sx = 0, sy = 0;
        function reveal(card) {
            card.classList.add('nf-lp');
            // Stamped so the dismiss handler can tell the synthesized click iOS
            // fires ON RELEASE of the hold apart from a real second tap — without
            // this the ✕ vanished the instant the finger lifted.
            card._nfLpAt = Date.now();
            if (card._nfLpT) { clearTimeout(card._nfLpT); }   // re-reveal resets the window
            card._nfLpT = setTimeout(function () { card._nfLpT = null; card.classList.remove('nf-lp'); }, 3500);
        }
        function cancel() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }
        document.body.addEventListener('touchstart', function (e) {
            var card = e.target && e.target.closest && e.target.closest('.nf-cw-card');
            if (!card) return;
            var t = e.touches && e.touches[0];
            if (!t) return;
            sx = t.clientX; sy = t.clientY;
            cancel();
            lpTimer = setTimeout(function () { lpTimer = null; reveal(card); }, 550);
        }, { passive: true });
        document.body.addEventListener('touchmove', function (e) {
            if (!lpTimer) return;
            var t = e.touches && e.touches[0];
            if (t && (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10)) cancel();
        }, { passive: true });
        document.body.addEventListener('touchend', cancel, { passive: true });
        document.body.addEventListener('touchcancel', cancel, { passive: true });
        // Android fires contextmenu on a long-press over the <a>: claim it as the
        // gesture instead of showing the browser menu. Touch layouts only —
        // nfCheapMode covers Samsung WebViews whose hover MQ misreports, while a
        // desktop right-click keeps its normal context menu.
        document.body.addEventListener('contextmenu', function (e) {
            if (!nfMM('(hover: none)') && !nfCheapMode()) return;
            var card = e.target && e.target.closest && e.target.closest('.nf-cw-card');
            if (!card) return;
            e.preventDefault();
            reveal(card);
        });
        // While the ✕ is revealed, a tap on the tile BODY dismisses the reveal
        // instead of navigating — otherwise the hold flows straight into the
        // click and opens the title under the user's finger. Clicks landing
        // within 700ms of the reveal are the HOLD's own release (iOS synthesizes
        // one) — swallow them but keep the ✕ up.
        document.body.addEventListener('click', function (e) {
            var card = e.target && e.target.closest && e.target.closest('.nf-cw-card.nf-lp');
            if (!card) return;
            if (e.target.closest('.nf-cw-remove')) return;   // let the remove act
            e.preventDefault();
            e.stopPropagation();
            if (Date.now() - (card._nfLpAt || 0) < 700) return;   // release-click: keep the reveal
            if (card._nfLpT) { clearTimeout(card._nfLpT); card._nfLpT = null; }
            card.classList.remove('nf-lp');
        }, true);
    }

    function setupCardPreviews() {
        if (nfIsTouch()) { setupTouchPreviews(); return; }
        document.body.addEventListener('mouseover', function (e) {
            if (cfg('HoverPreviewCard', true) === false) return;
            if (popEl && popEl.contains(e.target)) return; // inside the popup
            // .nf-cw-card is a bare <a> with no `card` class, so the preview popup
            // never fired for Continue Watching — that whole row was unlabelled
            // thumbnails with no way to learn what any of them was. Plain comma
            // list, no :has(), so it is safe on old engines.
            var card = e.target.closest && e.target.closest('.card, .nf-cw-card');
            if (!card || card === popCard) return;
            if (!eligibleCard(card)) return;
            if (popHideTimer) { clearTimeout(popHideTimer); popHideTimer = null; }
            if (popTimer) { clearTimeout(popTimer); popTimer = null; }
            destroyPopEl();
            popCard = card;
            popTimer = setTimeout(function () { if (popCard === card) buildPop(card); }, POP_DELAY);
        });
        document.body.addEventListener('mouseout', function (e) {
            var card = e.target.closest && e.target.closest('.card, .nf-cw-card');
            var inPop = popEl && popEl.contains(e.target);
            if (!card && !inPop) return;
            var to = e.relatedTarget;
            if (to && ((card && card.contains(to)) || (popEl && popEl.contains(to)))) return;
            if (popTimer) { clearTimeout(popTimer); popTimer = null; }
            if (popHideTimer) { clearTimeout(popHideTimer); }
            popHideTimer = setTimeout(clearPreview, 140);
        });
        window.addEventListener('scroll', function () { clearPreview(); }, true);
    }

    // ============ Top 10 rank numbers ============
    function setupTopTen() {
        try {
            if (cfg('TopTenRow', false) !== true) return;
            if (!isHomePage()) return;
            var container = activeHomeContainer();
            if (!container) return;
            var target = null;
            if (cfg('CleanHome', true) === true) {
                // Clean home hides every native row, so the ranks must land on our
                // own first genre row — not on a display:none native section.
                target = container.querySelector('.nf-genre-section');
            } else {
                // First VISIBLE content row that isn't the library ("My Media") section.
                var sections = container.querySelectorAll('.verticalSection');
                for (var s = 0; s < sections.length; s++) {
                    if (sections[s].offsetParent === null) continue;
                    var firstCard = sections[s].querySelector('.card');
                    if (!firstCard) continue;
                    var t = (firstCard.getAttribute('data-type') || '').toLowerCase();
                    if (t === 'collectionfolder' || t === 'userview') continue;
                    target = sections[s];
                    break;
                }
            }
            if (!target) return;
            var cards = target.querySelectorAll('.card');
            for (var i = 0; i < Math.min(10, cards.length); i++) {
                if (cards[i].querySelector('.ct-rank')) continue;
                cards[i].classList.add('ct-rank-card');
                var rank = document.createElement('div');
                rank.className = 'ct-rank';
                rank.textContent = String(i + 1);
                cards[i].insertBefore(rank, cards[i].firstChild);
            }
        } catch (e) {}
    }

    // ============ Green "x% Match" rating ============
    var nfLastMatchScan = 0;
    function setupMatchScore() {
        try {
            if (cfg('MatchScore', true) !== true) return;
            // A selector LIST defeats the engine's single-class bucket fast path, so
            // this walks the whole tree — and it ran unthrottled on every mutation
            // frame (a 100-card library grid is ~2500 elements). The generated CSS
            // fail-opens after 2.5s, so a 250ms floor is invisible.
            var now = Date.now();
            if (!nfSettlePass && now - nfLastMatchScan < 250) return;
            nfLastMatchScan = now;
            // .starRatingValue is the classic markup; detail pages render the value
            // directly inside .starRatingContainer (verified live on 10.11).
            document.querySelectorAll('.starRatingValue, .starRatingContainer').forEach(function (el) {
                if (el.dataset.ctMatch) return;
                // A container that WRAPS a .starRatingValue is handled by that child.
                if (el.classList.contains('starRatingContainer') && el.querySelector('.starRatingValue')) {
                    el.dataset.ctMatch = '1';
                    return;
                }
                // 10.11 detail pages render <span class="starIcon">star</span>7.8 directly
                // inside .starRatingContainer, so textContent was "star7.8" and parseFloat
                // returned NaN — the score was marked invalid and the raw "7.8" stayed on
                // screen instead of "78% Match", i.e. the feature silently did nothing
                // exactly where Netflix shows it most. Pull the first NUMBER out instead.
                var mm = (el.textContent || '').replace(',', '.').match(/\d+(?:\.\d+)?/);
                var n = mm ? parseFloat(mm[0]) : NaN;
                // Mark even invalid values: unmarked elements are visibility-hidden
                // by the generated CSS to stop the "7.8 -> 78% Match" text flicker.
                if (isNaN(n) || n < 0 || n > 10) { el.dataset.ctMatch = '0'; return; }
                el.dataset.ctMatch = '1';
                var label = nfL().match.replace('{0}', Math.round(n * 10));
                // Rewrite the numeric TEXT NODE, not textContent: textContent deletes
                // the .starIcon child, and that childList mutation re-fires our own
                // MutationObserver — a free extra applyDynamic pass per rating element.
                var tn = null;
                for (var k = el.childNodes.length - 1; k >= 0; k--) {
                    if (el.childNodes[k].nodeType === 3 && /\d/.test(el.childNodes[k].nodeValue)) { tn = el.childNodes[k]; break; }
                }
                if (tn) { tn.nodeValue = label; } else { el.textContent = label; }
                // The match score leads the metadata row via CSS (flex `order` on
                // .starRatingContainer in netflix.css) — no DOM reordering needed here.
            });
        } catch (e) {}
    }

    // The sign-in page alone (of the five session routes): a brand may stand its full
    // mark above the gate there and take it out of the bar (CssGenerator,
    // AppendVillaMarks) — and it needs to know when the CARD is the open view, because
    // the manual sign-in form is a good deal taller than the row of profile tiles.
    // Jellyfin swaps gate and card by toggling `.hide` on the form: on a click, or by
    // itself once /Users/Public has answered on a server that lists no users (the
    // default). That is an attribute change, which the childList observer never
    // sees, so the form's own class is watched — it fires before the next paint.
    var nfLoginForm = null;
    var nfLoginFormObs = null;
    function nfStampLogin() {
        var root = document.documentElement;
        var on = /^#\/login\b/i.test(location.hash);
        var form = on ? document.querySelector('#loginPage:not(.hide) form.manualLoginForm') : null;
        if (form !== nfLoginForm) {
            if (nfLoginFormObs) { try { nfLoginFormObs.disconnect(); } catch (e) {} nfLoginFormObs = null; }
            nfLoginForm = form;
            if (form && window.MutationObserver) {
                try {
                    nfLoginFormObs = new MutationObserver(nfStampLogin);
                    nfLoginFormObs.observe(form, { attributes: true, attributeFilter: ['class'] });
                } catch (e) {}
            }
        }
        root.classList.toggle('nf-login', on);
        root.classList.toggle('nf-login-card', !!form && !form.classList.contains('hide'));
    }

    // ============ Logo -> Home ============
    // The theme HIDES Jellyfin's page-title elements, so a click handler bound to
    // them was dead. Build a real "N" logo as the FIRST child of .headerLeft (the
    // SPA recreates the header on navigation — the existence check re-adds it there
    // without ever duplicating) and delegate to Jellyfin's own home button.
    // netflix.css owns all styling of .nf-logo.
    function setupLogoHome(hdr) {
        try {
            // '.skinHeader .headerLeft' is a DESCENDANT selector — no single-compound
            // fast path, so it traversed the whole document on every mutation frame.
            // applyDynamic already has the header element; scope the lookup to it.
            var left = (hdr && hdr.querySelector('.headerLeft')) || document.querySelector('.headerLeft');
            if (!left || left.querySelector('.nf-logo')) return;
            var a = document.createElement('a');
            a.className = 'nf-logo';
            a.href = '#/home';
            a.setAttribute('aria-label', nfL().home);
            a.textContent = 'N';
            a.addEventListener('click', function (e) {
                e.preventDefault();
                var home = document.querySelector('.headerHomeButton');
                if (home) { home.click(); } else { window.location.hash = '#/home'; }
            });
            left.insertBefore(a, left.firstChild);
        } catch (e) {}
    }

    // Jellyfin 12.0's Modern bar normally carries the mark itself — a Button
    // linking to the home route with the server icon and name — and the stylesheet
    // restyles THAT into the configured logo. But below the md breakpoint, where a
    // drawer is available, AppToolbar does not render that Button at all: the
    // hamburger takes the slot and the logo moves into the drawer. The bar is then
    // the only chrome on screen and it carries no mark, which is the one place the
    // phone layout stops looking like Netflix.
    //
    // So: when the Modern toolbar has no home Button, give it the theme's own
    // .nf-logo element — the same one the legacy header gets, so LogoStyle and all
    // the existing .nf-logo styling apply unchanged. Deliberately NOT done when the
    // home Button IS present; that path already works and this would double the mark.
    function setupModernLogo() {
        try {
            var tb = nfModernToolbar();
            if (!tb) return;
            var own = tb.querySelector('.nf-logo');
            // The stock mark is here — the stylesheet restyles it, nothing to add. And
            // if ours is still in the bar from when the window was narrower (crossing
            // MUI's md breakpoint upward brings the home Button back), take it out:
            // this used to return on its own node first, and the bar then carried
            // the mark twice until the next reload.
            if (tb.querySelector('a.MuiButton-root[href="#/"]')) {
                if (own && own.parentNode) own.parentNode.removeChild(own);
                return;
            }
            if (own) return;

            var a = document.createElement('a');
            a.className = 'nf-logo nf-logo-modern';
            a.href = '#/home';
            a.setAttribute('aria-label', nfL().home);
            a.textContent = 'N';
            a.addEventListener('click', function (e) {
                e.preventDefault();
                var home = document.querySelector('.headerHomeButton');
                if (home) { home.click(); } else { window.location.hash = '#/home'; }
            });
            // After the drawer button, the way Netflix sits the mark beside the menu.
            var menuBtn = tb.querySelector('.MuiIconButton-root');
            if (menuBtn && menuBtn.nextSibling) tb.insertBefore(a, menuBtn.nextSibling);
            else if (menuBtn) tb.appendChild(a);
            else tb.insertBefore(a, tb.firstChild);
        } catch (e) {}
    }

    // Netflix's nav opens on "Home". Modern's UserViewNav opens on Favorites — a
    // sub-tab of a page that has no entry of its own — so the mark was the only way
    // back and the first word in the bar was the wrong one. Same foreign-node
    // technique as the mark above: the link goes BEFORE React's first nav button,
    // never between two of its nodes, so nothing React inserts or removes is ever
    // positioned relative to it. On phones the nav lives in the drawer, there is
    // no Favorites button in the bar, and this does nothing.
    function setupModernHome() {
        try {
            var tb = nfModernToolbar();
            if (!tb) return;
            var fav = tb.querySelector('a.MuiButton-sizeMedium[href*="home?tab=1"]');
            var home = tb.querySelector('.nf-nav-home');
            if (!fav) { if (home && home.parentNode) home.parentNode.removeChild(home); return; }
            if (!home) {
                home = document.createElement('a');
                home.href = '#/home';
                home.textContent = nfL().home;
            }
            if (home.parentNode !== fav.parentNode) fav.parentNode.insertBefore(home, fav);
            // MUI's own classes, so the bar's nav rules style it as one of theirs —
            // minus the "current" colour pair the Favorites button carries on /home.
            var cls = fav.className.replace(/MuiButton-(color|text)Primary/g, 'MuiButton-$1Inherit') + ' nf-nav-home';
            if (isHomePage() && !/[?&]tab=1\b/.test(location.hash)) cls += ' nf-nav-active';
            if (home.className !== cls) home.className = cls;
        } catch (e) {}
    }

    // ============ Real Play-button wiring ============
    // The theme's ▶ buttons (hero billboard, hover/touch popup) are anchors to the
    // detail page — the theme has no access to jellyfin's playbackManager module.
    // Instead of faking playback, the click stamps a short-lived sessionStorage
    // flag and the DETAIL page consumes it by clicking the STOCK Play button,
    // which routes through the client's own playback stack — correct in browsers,
    // JMP AND the mobile apps' native players. TTL + id match + remove-before-
    // click keep it single-shot; if the button never appears (permissions, error)
    // the flag simply expires.
    // The detail page visible AT STAMP TIME. jellyfin-web keeps the OLD detail
    // view un-hidden until the new one mounts, so a ▶ pressed on page A's
    // More-Like-This card for title B could match A's still-visible .btnPlay and
    // start the WRONG title — the matched button's page must not be this one.
    var nfAutoplayAvoid = null;
    function nfPendingAutoplay() {
        try {
            var raw = sessionStorage.getItem('nf-autoplay');
            if (!raw) return null;
            var sep = raw.lastIndexOf(':');
            var id = raw.slice(0, sep);
            var ts = parseInt(raw.slice(sep + 1), 10) || 0;
            if (Date.now() - ts > 15000) { sessionStorage.removeItem('nf-autoplay'); nfAutoplayAvoid = null; return null; }
            return id;
        } catch (e) { return null; }
    }
    function setupAutoPlay() {
        try {
            var id = nfPendingAutoplay();
            if (!id) return;
            if (!/#\/details/i.test(location.hash) || location.hash.indexOf(id) === -1) return;
            // :not(.hide) on the page AND the button — the view manager caches
            // detail pages, and a resumable title keeps .btnPlay as its resume
            // control (gotcha J: there is no .btnResume in 10.11).
            var btn = document.querySelector('#itemDetailPage:not(.hide) .mainDetailButtons .btnPlay:not(.hide)');
            if (!btn) return;   // page still streaming in — applyDynamic retries on the next mutation frame
            // Still the pre-navigation page: wait for it to hide and the target's
            // own view to mount (retried on every mutation frame; 15s TTL bounds it).
            var page = btn.closest && btn.closest('#itemDetailPage');
            if (page && page === nfAutoplayAvoid) return;
            try { sessionStorage.removeItem('nf-autoplay'); } catch (e2) {}
            nfAutoplayAvoid = null;
            btn.click();
        } catch (e) {}
    }

    // ============ Init ============
    // ============ Detail page ("Mehr Infos") — autoplay clip over the backdrop ============
    // When a detail page is open, play a muted, looping cut of the title (past the intro)
    // over the top backdrop — the same self-contained remux used by the hero / hover preview.
    // Runs on EVERY hashchange — including details -> details (cast member, similar
    // title). Killing unconditionally prevents a detached, still-streaming video from
    // the previous page surviving; setupDetailClip rebuilds for the new item.
    var detailClipTimer = null;
    function cleanupDetailClip() {
        if (detailClipTimer) { clearTimeout(detailClipTimer); detailClipTimer = null; }
        document.querySelectorAll('.nf-detail-video').forEach(nfKillVideo);
        document.querySelectorAll('[data-nf-clip]').forEach(function (el) { el.removeAttribute('data-nf-clip'); });
    }
    function setupDetailClip() {
        try {
            // Route test FIRST — it is a regex over a string. The two capability
            // probes below used to run on every non-detail mutation frame before
            // this line rejected the pass anyway.
            if (!/#\/details/i.test(location.hash)) return;
            if (cfg('PreviewClips', true) === false) return;
            if (nfReducedMotion() || nfCheapMode()) return;
            // The user came here by pressing ▶ — they asked for the MOVIE. Starting
            // the ambient clip in that window is exactly the reported "I pressed
            // Play and got the preview clip" experience (and its stream competes
            // with the movie's own spin-up on small servers).
            if (nfPendingAutoplay()) return;
            // …and while the theme's own ident is on its way or on screen, the same
            // holds: none of the player's signals is up yet (see nfIdentBusy).
            if (nfIdentBusy()) return;
            if (typeof ApiClient === 'undefined' || !ApiClient.getItem || !ApiClient.getCurrentUserId) return;
            // Attach into the FULL-VIEWPORT fixed backdrop container (the element the
            // theme uses as the detail backdrop). The page's own #itemBackdrop is only
            // 40vh tall — clips there played in the top band while the lower half kept
            // showing the still image. Fall back to #itemBackdrop if backdrops are off.
            var backdrop = document.querySelector('.backdropContainer') || document.querySelector('#itemBackdrop');
            if (!backdrop) return;
            var idm = location.hash.match(/[?&]id=([a-f0-9]+)/i);
            var id = idm && idm[1];
            if (!id) return;
            // Guard by ITEM ID, self-cleaning on mismatch: in-app forward navigation
            // (pushState) never fires hashchange, and the marker now lives on a
            // singleton that survives navigation — a boolean guard left the previous
            // page's clip running and blocked every later detail page's clip.
            if (backdrop.getAttribute('data-nf-clip') === id) return;
            cleanupDetailClip();
            var uid = ApiClient.getCurrentUserId();
            if (!uid) return;
            backdrop.setAttribute('data-nf-clip', id);
            var stillHere = function () { return location.hash.indexOf(id) !== -1; };
            // Hold the clip back for a moment: starting a stream (and possibly a
            // server-side transcode) the instant the page opens competes with the
            // page's own image requests — backdrop, poster and the whole cast row —
            // on small servers, and those images have no retry of their own.
            function attach(playId, ms, ticks) {
                if (detailClipTimer) { clearTimeout(detailClipTimer); }
                detailClipTimer = setTimeout(function () {
                    detailClipTimer = null;
                    attachNow(playId, ms, ticks);
                }, 2500);
            }
            function attachNow(playId, ms, ticks) {
                // Playback guard, mirroring the hero's: this fires 2.5s after the
                // page opened, and stillHere() passes whenever the hash never
                // changed (JMP State-A keeps the URL on the browse route; casting
                // from the detail page never changes it) — so without this, a
                // fresh clip stream started UNDER the just-started movie.
                if (nfSuspended || document.documentElement.classList.contains('nf-playing') || nfPlaybackActive() || nfIdentBusy()) return;
                if (document.hidden) return;   // covered WebView (external/native player)
                if (!stillHere() || backdrop.querySelector('.nf-detail-video')) return;
                var v = nfNewClipVideo('nf-detail-video');
                v.addEventListener('playing', function () { v.classList.add('show'); });
                nfClaim(v);
                nfClipSrc(v, playId, ms, ticks);
                backdrop.appendChild(v);
                nfPlay(v);
                // Bound the preview window — without this the clip streams (or keeps
                // the server transcoding) the entire remainder of the title in a loop.
                v._stopTimer = setTimeout(function () { nfKillVideo(v); }, PREVIEW_SECONDS * 1000);
                nfClipWatch(v);
                nfClipLoop(v);
            }
            ApiClient.getItem(uid, id).then(function (item) {
                if (!item || !stillHere()) return;
                var type = item.Type || '';
                if (type === 'Series' || type === 'Season' || item.IsFolder) {
                    ApiClient.getItems(uid, { ParentId: item.Id, IncludeItemTypes: 'Episode', Recursive: true, Limit: 1, SortBy: 'SortName', SortOrder: 'Ascending', Fields: 'MediaSources,RunTimeTicks' }).then(function (res) {
                        var ep = res && res.Items && res.Items[0]; if (!ep) return;
                        attach(ep.Id, ep.MediaSources && ep.MediaSources[0], ep.RunTimeTicks || 0);
                    }).catch(function () {});
                } else if (type === 'Movie' || type === 'Episode' || (item.RunTimeTicks || 0) > 0) {
                    attach(item.Id, item.MediaSources && item.MediaSources[0], item.RunTimeTicks || 0);
                }
            }).catch(function () {});
        } catch (e) {}
    }

    // ============ Maturity-rating plate at playback start ============
    // Netflix shows the certification on a white-barred plate for the first
    // seconds of playback. OfficialRating already rides on the now-playing item.
    var ratingPlateFor = null;
    var ratingPlateEl = null;
    function setupRatingPlate() {
        try {
            if (cfg('RatingPlate', true) !== true) return;
            var osd = document.querySelector('#videoOsdPage');
            // The OSD page element is CACHED by the view manager — it stays in the
            // DOM (hidden) after playback ends, so "playing" means present AND not
            // .hide. Re-arm for the next playback and drop any leftover plate.
            if (!osd || osd.classList.contains('hide')) {
                ratingPlateFor = null;
                if (osd) { osd.removeAttribute('data-nf-plate'); }
                if (ratingPlateEl) { ratingPlateEl.remove(); ratingPlateEl = null; }
                return;
            }
            if (typeof ApiClient === 'undefined' || !ApiClient.getSessions || !ApiClient.deviceId) return;
            if (osd.getAttribute('data-nf-plate') === '1') return;
            osd.setAttribute('data-nf-plate', '1');

            // The session is reported a beat after playback starts.
            setTimeout(function () {
                ApiClient.getSessions({ deviceId: ApiClient.deviceId() }).then(function (sessions) {
                    var item = sessions && sessions[0] && sessions[0].NowPlayingItem;
                    if (!item || !item.OfficialRating) return;
                    if (ratingPlateFor === item.Id) return;      // once per title
                    ratingPlateFor = item.Id;
                    if (!document.querySelector('#videoOsdPage')) return;
                    var plate = document.createElement('div');
                    plate.className = 'ct-rating-plate';
                    plate.innerHTML = '<div class="ct-rating-value">' + esc(item.OfficialRating) + '</div>';
                    document.body.appendChild(plate);
                    ratingPlateEl = plate;
                    requestAnimationFrame(function () { plate.classList.add('show'); });
                    setTimeout(function () {
                        plate.classList.remove('show');
                        setTimeout(function () {
                            if (plate.parentNode) { plate.remove(); }
                            if (ratingPlateEl === plate) { ratingPlateEl = null; }
                        }, 900);
                    }, 7000);
                }).catch(function () {});
            }, 600);
        } catch (e) {}
    }

    // Netflix header behaviour: transparent (top scrim) over a billboard at the
    // very top, solid #141414 once you scroll. Jellyfin's .skinHeader-withBackground
    // only marks "this view has a backdrop" — it is NOT scroll-driven — so we drive
    // the solid state ourselves with a .nf-scrolled class toggled on window scroll.
    var nfHdrScrollEl = null;
    var nfHdrScrollHash = null;
    function syncHeaderScrolled(hdr, force) {
        // nfLegacyHeader(), not a bare .skinHeader query: on Jellyfin 12.0's Modern
        // layout the legacy bar is display:none (so toggling .nf-scrolled on it is a
        // no-op that still costs a pageYOffset layout flush on every scroll frame),
        // and the Modern video page puts `skinHeader ... osdHeader` on the player's
        // OSD bar, which must never receive the browse-header scroll treatment.
        // The Modern app bar needs no help here: it swaps MuiAppBar-colorTransparent
        // for MuiAppBar-colorDefault on the first scroll pixel by itself, and the
        // stylesheet paints both states.
        var h = hdr && hdr.getClientRects && hdr.getClientRects().length > 0 && !hdr.classList.contains('osdHeader')
            ? hdr
            : nfLegacyHeader();
        if (!h) { nfHdrScrollEl = null; nfHdrScrollHash = null; return; }
        // Re-sync on NAVIGATION as well as on a new header element. Jellyfin keeps ONE
        // persistent .skinHeader across routes, so the element-identity guard below
        // never fires on a page change — and if the previous page was scrolled, the
        // stale .nf-scrolled rode along. On a page WITH a backdrop that swaps the
        // header's transparent scrim for a solid #141414 bar, i.e. an opaque black
        // band across the top of the artwork. Landing on a shorter page also clamps
        // scrollTop to 0 without necessarily firing a scroll event, so the passive
        // listener cannot be relied on to correct it. A string compare is free.
        if (location.hash !== nfHdrScrollHash) { nfHdrScrollHash = location.hash; force = true; }
        // Reading pageYOffset forces a style + layout flush. applyDynamic runs on
        // every DOM-mutation frame, so calling this unconditionally turned each of
        // Jellyfin's mutation bursts (virtual list, lazy image loader) into a
        // synchronous reflow of the whole grid. The passive rAF-throttled scroll
        // listener below already keeps the class current — from applyDynamic we
        // only need to re-sync when the SPA has handed us a NEW header element.
        if (!force && h === nfHdrScrollEl) return;
        nfHdrScrollEl = h;
        var y = window.pageYOffset || document.documentElement.scrollTop || 0;
        h.classList.toggle('nf-scrolled', y > 8);   // Netflix goes solid almost immediately
    }
    // Called from init() AND from every applyDynamic pass. init() alone is not
    // enough: this script is injected inline at the end of the body and runs before
    // jellyfin-web's bundles have mounted anything, so at init there is no
    // .skinHeader yet and the visibility guard below would reject it forever —
    // the Netflix transparent-to-solid header would simply never happen. The
    // window.__nfHeaderScroll flag keeps the listener single; the guard returns
    // WITHOUT setting it, so a later pass can still arm it.
    function setupHeaderScroll() {
        if (window.__nfHeaderScroll) return;
        // Nothing to drive on Modern — the MUI app bar swaps its own colour class
        // on scroll and the stylesheet paints both states. Without this guard a
        // permanent scroll listener would run a rAF per frame, and a pageYOffset
        // read per frame, for a class on an element nobody can see.
        if (!nfLegacyHeader()) return;
        window.__nfHeaderScroll = true;
        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () { ticking = false; syncHeaderScrolled(null, true); });
        }, { passive: true });
        syncHeaderScrolled(null, true);
    }

    var nfWasPlaying = false;
    // ---- PLAYBACK QUIESCE ---------------------------------------------------
    // While a video plays the theme does NOTHING. Previously it stayed fully wired
    // and simply bailed out early on each pass — which still meant a callback, a
    // rAF and four DOM queries for every OSD mutation, forever. On Jellyfin Media
    // Player the web UI is composited over an mpv surface, so main-thread work
    // there competes directly with presenting video frames.
    // The observer is disconnected outright and replaced by one cheap poll whose
    // ONLY job is to notice that playback ended and wire everything back up.
    var nfObserver = null;
    // True only inside the trailing settle pass (see scheduleDynamic): the scanners
    // that throttle themselves run unconditionally there.
    var nfSettlePass = false;
    var nfSuspended = false;
    var nfResumePoll = null;
    function nfObserveBody() {
        try { if (nfObserver) nfObserver.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    }
    function nfPlaybackActive() {
        var osd = document.getElementById('videoOsdPage');
        return document.documentElement.classList.contains('transparentDocument')
            || !!document.querySelector('.videoPlayerContainer')
            || !!(osd && !osd.classList.contains('hide'))
            || !!document.querySelector('.skinHeader.osdHeader');
    }
    function nfSuspendForPlayback() {
        if (nfSuspended) return;
        nfSuspended = true;
        nfStopAllPreviewMedia();
        try { if (nfObserver) nfObserver.disconnect(); } catch (e) {}
        // 750ms: the resume is not latency-critical, and this is the ONLY theme
        // code that runs for the whole duration of a film.
        if (!nfResumePoll) {
            var nfPollTick = 0;
            nfResumePoll = setInterval(function () {
                // Belt and braces: if anything managed to start a preview clip while
                // suspended, this kills it. Costs nothing when there is none.
                nfStopAllPreviewMedia();
                // Auto-play-next starts a NEW item with no fresh suspend edge — re-
                // check the warm every ~30s (the completed-item guard makes a repeat
                // for the same title one GET at most, and cheap mode skips entirely).
                if (++nfPollTick % 40 === 0) nfPrefetchTrickplay();
                if (!nfPlaybackActive()) nfResumeAfterPlayback();
            }, 750);
        }
        // Warm the trickplay tile sheets once the movie's own buffer has had 8s
        // to establish — never in the startup window it would compete with.
        setTimeout(function () { if (nfSuspended) nfPrefetchTrickplay(); }, 8000);
    }
    // Scrubbing across a trickplay tile-sheet boundary swaps the bubble's
    // background-image to a not-yet-fetched multi-megapixel JPEG; on JMP the
    // fetch+decode lands as a visible hitch mid-hover. A film has only a handful
    // of sheets (~8 at server defaults), all static pre-generated files — warm
    // them SEQUENTIALLY (one request in flight) so the hover path hits cache.
    var nfTrickplayFor = null;    // stamped only when a warm COMPLETES, so an aborted run retries
    var nfTrickplayBusy = false;  // one chain in flight at a time
    function nfPrefetchTrickplay() {
        try {
            if (nfCheapMode()) return;   // phones: no scrub-hover, don't burn data
            if (nfTrickplayBusy) return;
            if (typeof ApiClient === 'undefined' || !ApiClient.getSessions || !ApiClient.deviceId
                || !ApiClient.getCurrentUserId || !ApiClient.getItem) return;
            nfTrickplayBusy = true;
            var done = function () { nfTrickplayBusy = false; };
            ApiClient.getSessions({ deviceId: ApiClient.deviceId() }).then(function (sessions) {
                var s = sessions && sessions[0];
                var np = s && s.NowPlayingItem;
                if (!np || !np.Id || nfTrickplayFor === np.Id) { done(); return; }
                // The cache only helps if OUR URL byte-matches the OSD's. The OSD
                // requires a MediaSourceId — no msId, no warm (a guessed URL is 16
                // uncacheable downloads, strictly worse than skipping).
                var msId = (s.PlayState && s.PlayState.MediaSourceId) || '';
                var uid = ApiClient.getCurrentUserId();
                if (!msId || !uid) { done(); return; }
                ApiClient.getItem(uid, np.Id).then(function (item) {
                    var tp = item && item.Trickplay;
                    var perSource = tp && tp[msId];
                    if (!perSource) { done(); return; }
                    var widths = Object.keys(perSource).map(Number).filter(function (n) { return n > 0; });
                    if (!widths.length) { done(); return; }
                    // Mirror jellyfin-web's OSD selection EXACTLY (videoosd picks the
                    // highest width <= 20% of screen width x dpr, else the smallest) —
                    // warming any other width is a guaranteed cache miss.
                    var target = ((window.screen && window.screen.width) || 1280) * (window.devicePixelRatio || 1) * 0.2;
                    var w = null, smallest = null;
                    for (var k = 0; k < widths.length; k++) {
                        if (smallest === null || widths[k] < smallest) smallest = widths[k];
                        if (widths[k] <= target && (w === null || widths[k] > w)) w = widths[k];
                    }
                    if (w === null) w = smallest;
                    var info = perSource[String(w)] || perSource[w];
                    if (!info || !info.TileWidth || !info.TileHeight || !info.ThumbnailCount) { done(); return; }
                    var sheets = Math.min(Math.ceil(info.ThumbnailCount / (info.TileWidth * info.TileHeight)), 16);
                    var base = ApiClient.serverAddress() + '/Videos/' + np.Id + '/Trickplay/' + w + '/';
                    // Param NAME + ORDER byte-match the OSD's getUrl output
                    // (ApiKey first, MediaSourceId second) — api_key authenticated
                    // fine but never hit the cache entry the OSD looks up.
                    var tail = '.jpg?ApiKey=' + ApiClient.accessToken() + '&MediaSourceId=' + msId;
                    var i = 0;
                    (function next() {
                        if (!nfSuspended) { done(); return; }         // playback ended mid-warm: retry next time
                        if (i >= sheets) { nfTrickplayFor = np.Id; done(); return; }
                        var img = new Image();
                        img.onload = next;
                        img.onerror = next;
                        img.src = base + i + tail;
                        i++;
                    })();
                }).catch(done);
            }).catch(done);
        } catch (e) { nfTrickplayBusy = false; }
    }
    function nfResumeAfterPlayback() {
        if (!nfSuspended) return;
        nfSuspended = false;
        if (nfResumePoll) { clearInterval(nfResumePoll); nfResumePoll = null; }
        nfWasPlaying = false;
        try { document.documentElement.classList.remove('nf-playing'); } catch (e) {}
        nfObserveBody();
        applyDynamic();   // rebuild whatever the browse page needs
    }
    var nfLastHeroVisible = null;
    var nfLastRescue = 0;
    var nfLastPrune = 0;
    var nfLastDetailNav = 0;
    function applyDynamic() {
        nfPassId++;   // new pass — invalidates the activeHomeContainer memo
        // Jellyfin's boot assigns html.className wholesale, wiping the early
        // nf-js marker — re-assert it (idempotent) so the generated CleanHome
        // hide stays keyed on a live script.
        try { document.documentElement.classList.add('nf-js'); } catch (e) {}
        // PLAYBACK fast-path: while the video is up (html.transparentDocument) the OSD —
        // the seek bar, the scene-preview thumbnail that tracks the scrubber, and the
        // position/duration timers — mutates the DOM every frame. The document.body
        // MutationObserver would otherwise re-run EVERY scanner below (full-document
        // querySelectorAll in setupMatchScore / nfRescueStuckImages, forced-layout reads,
        // etc.) ~60x/sec and saturate the main thread — exactly what makes seek-bar
        // scrubbing stutter on desktop. Only the maturity-rating plate matters during
        // playback; when it ends, the OSD teardown is itself a body mutation that re-fires
        // this and resumes the full path.
        // transparentDocument covers jellyfin-web's inline player; #videoOsdPage:not(.hide)
        // ALSO catches the desktop app (Jellyfin Media Player / native mpv), which shows the
        // video OSD WITHOUT setting transparentDocument. html.nf-playing (driven off this)
        // suppresses the film grain + ambient over the app's player too — there they were
        // sitting on top of the seek-preview thumbnail and costing GPU every frame.
        // .skinHeader.osdHeader is the most reliable signal: jellyfin-web adds .osdHeader to
        // the header for the WHOLE duration of playback (kept, just opacity-faded, when the OSD
        // controls hide) — and it's present in Jellyfin Media Player too, which does NOT set
        // transparentDocument (native mpv). #videoOsdPage is a fallback.
        // .videoPlayerContainer is the UNIVERSAL signal (live-verified against jellyfin-web): this
        // build has a playback state — video mounted in .videoPlayerContainer-onTop while the URL
        // is still on the library route — where transparentDocument, #videoOsdPage:not(.hide) AND
        // .skinHeader.osdHeader are ALL absent. That is the exact JMP-lag window: none of the three
        // signals above fire, so nf-playing never set and the film grain (mix-blend, z-index 2.1e9)
        // recomposited over the seek-preview thumbnail every frame. .videoPlayerContainer is present
        // the whole time a video plays and gone when idle (verified: absent on Home, and audio
        // playback uses a different container, so no false positives).
        // ONE .skinHeader read per pass (it used to be queried twice), and the probe
        // is split into single-compound queries: querySelector only takes the
        // engine's class/id bucket fast path for a SINGLE compound selector — a
        // comma LIST falls back to walking every element under the document, and
        // this one ran on every mutation frame including during playback.
        // All four signals are unchanged, and .videoPlayerContainer (the universal
        // one) is still checked first.
        // Deliberately the FIRST .skinHeader in document order, hidden or not: on
        // Modern, RootAppLayout renders the legacy header before the router outlet,
        // so this resolves to the hidden legacy bar — which is exactly the element
        // jellyfin's own video controller stamps .osdHeader onto (it queries the same
        // way), so the fourth playback signal below keeps working there. The VISIBLE
        // OSD bar on Modern is a different element that also carries .skinHeader;
        // anything that needs the browse header must go through nfLegacyHeader().
        var nfHdr = document.querySelector('.skinHeader');
        var nfOsd = document.getElementById('videoOsdPage');
        var playing = document.documentElement.classList.contains('transparentDocument')
            || !!document.querySelector('.videoPlayerContainer')
            || !!(nfOsd && !nfOsd.classList.contains('hide'))
            || !!(nfHdr && nfHdr.classList.contains('osdHeader'));
        document.documentElement.classList.toggle('nf-playing', playing);
        // html.nf-modern gates the whole Modern-chrome block in the stylesheet. A
        // plain class on purpose: :has() is unsupported on Jellyfin Media Player's
        // QtWebEngine, where an unsupported :has() drops the entire rule — so it is
        // only ever a standalone backstop here, never the only gate for something
        // load-bearing. Re-evaluated every pass because the AppBar is absent in the
        // legacy layout and present-but-dashboard on /dashboard routes.
        document.documentElement.classList.toggle('nf-modern', !nfLegacyHeader() && nfIsModernChrome());
        // Which surfaces have ARTWORK behind the app bar: the home billboard
        // (html.nf-hero-top, stamped by setupHero) and the detail page. Netflix
        // scrims the bar over a picture; over flat page colour a black gradient
        // is a smear with nothing to protect, which is what Modern's unscrolled
        // `colorTransparent` state gave every library, search and settings page.
        // A plain class rather than :has(#itemDetailPage): an unsupported :has()
        // drops the whole rule on Jellyfin Media Player's QtWebEngine, and the
        // bar's colour is not something that may silently fall back.
        document.documentElement.classList.toggle('nf-detail-page', /#\/details/i.test(location.hash));
        // The sign-in routes: the app bar sits outside the page element, so the
        // sheet needs a root class to clear the bar over the gate's backdrop.
        document.documentElement.classList.toggle('nf-session', /^#\/(login|selectserver|addserver|forgotpassword|forgotpasswordpin)\b/i.test(location.hash));
        nfStampLogin();
        // jellyfin-web replaces window.ApiClient on sign-in, and the ident can only be
        // fetched once there is a token: both are a property read when already done.
        nfIdentWrap();
        nfIdentPreload();
        // EDGE-triggered teardown. Everything else here is an entry guard, which only
        // stops the NEXT clip — an in-flight one kept decoding and streaming under the
        // player for up to 30s. .videoPlayerContainer being inserted is itself a body
        // childList mutation, so this observer always fires on the transition.
        // A Requests window still open (a cast or a remote's "play") closes on the same edge -
        // here only: nfStopAllPreviewMedia also runs on tab switches and on every play-intent
        // click, and neither may close it.
        if (playing && !nfWasPlaying) { nfStopAllPreviewMedia(); if (nfRqHere) nfRqDlgShut(); }
        nfWasPlaying = playing;
        if (playing) {
            if (CT_CONFIG !== null) setupRatingPlate();
            // …and then go quiet entirely until playback ends.
            nfSuspendForPlayback();
            return;
        }
        applyCssLabels();
        syncResumeLabel();
        updateAdmin();
        addButton();
        setupLogoHome(nfHdr);
        setupModernLogo();
        setupModernHome();
        // Cheap: a single window.__nfHeaderScroll read once the listener is armed.
        // Here as well as in init() because at init the header does not exist yet.
        setupHeaderScroll();
        syncHeaderScrolled(nfHdr);
        // Before the CT_CONFIG gate: a pending ▶ must fire even on first paint.
        setupAutoPlay();
        // Config-gated builders must wait for CT_CONFIG: before it loads, cfg()
        // returns defaults (mostly true), so a disabled row (e.g. a home row the
        // user turned off) would be built on first paint and never removed —
        // that was the "toggle off but row still shows" bug. init() re-runs
        // applyDynamic() as soon as the configuration arrives.
        if (CT_CONFIG === null) return;
        setupNavTabs();
        if (nfRqHere) {
            // Requests: the "Anfragen" entries. Through nfRqLive it also asks the bridge,
            // once each, what the gate still needs to know.
            setupSeerrNav();
            // …and the Requests page itself, which lives on #/search?nfview=requests.
            setupSeerrPage();
            // …and the row under jellyfin's own search results, #/search?query=…, on the same page.
            setupSeerrSearch();
        }
        setupHero();   // self-gates + cleans up the hero when off-Home
        var onHome = isHomePage();
        // These build/scan the home container and each re-derives activeHomeContainer()
        // (a querySelectorAll + offsetParent FORCED-LAYOUT read). applyDynamic runs on
        // every document.body mutation frame, so off-Home (detail/library/playback) they
        // were burning several synchronous reflows per frame for nothing — gate them.
        if (onHome) {
            setupContinueWatching();
            setupExtraRows();
            setupGenreRows();
        }
        // markHomeOwned() must run OFF-Home too: it is the only code that CLEARS the
        // html.nf-home class (which hides library tab strips). It early-returns cheaply
        // off-Home, before the expensive activeHomeContainer() scan.
        markHomeOwned();
        setupRatingPlate();
        setupTopTen();
        setupMatchScore();
        setupNarrowBackdrop();
        setupDetailClip();
        setupDetailAmbient();
        setupDetailLists();
        setupDetailRowNav();
        // nfRescueStuckImages does a full-document querySelectorAll; it's a slow-path rescue
        // for images the lazy-loader dropped, not a per-frame concern — throttle it to ~1s so
        // it doesn't scan the whole document on every single mutation frame during scrolling.
        var nfNow = Date.now();
        if (nfNow - nfLastRescue > 1000) { nfLastRescue = nfNow; nfRescueStuckImages(); }
        // nfObserved is a module-level GC root and one stale card pins the whole
        // detached home container. The prune used to run ONLY when a new row was
        // built, so navigating away and staying away kept a full home page in
        // memory — which matters on the 1-2GB Android TV boxes this theme targets.
        if (nfNow - nfLastPrune > 5000 && nfImgIO) {
            nfLastPrune = nfNow;
            nfObserved = nfObserved.filter(function (el) {
                if (el.isConnected) return true;
                nfImgIO.unobserve(el);
                return false;
            });
        }
        // ---- Home billboard top-bleed fix ----
        // The home page keeps jellyfin's stock .libraryPage padding-top:7.5em, which
        // pushes .nf-hero ~120px down so it no longer bleeds under the header (a tall
        // dark band with a hard edge above the billboard). Zero that padding
        // (html.nf-hero-top) and give the header the transparent Netflix top-scrim
        // (.nf-hero-header) — but ONLY when a hero is actually VISIBLE (offsetParent
        // != null), the same test activeHomeContainer() uses. The hero also sits
        // hidden in #homeTab while the Favorites sub-tab is shown; those views keep
        // the solid header + stock padding.
        var heroVisible = false;
        if (onHome) {
            document.querySelectorAll('.nf-hero').forEach(function (h) { if (h.offsetParent !== null) heroVisible = true; });
        }
        // The ambient glow follows home's billboard (and the detail page) only. The Requests
        // page's is TMDB's art: reading its colours takes a CORS request, which would send
        // TMDB this server's address as Origin - so the glow is cleared there.
        var heroGlow = heroVisible;
        // The Requests page's billboard is the other artwork the bar floats over: the
        // same transparent bar, top scrim and zero page padding as home's.
        if (!heroVisible && nfRqHere && nfRqHeroVisible()) heroVisible = true;
        // Toggle the root classes only when the value CHANGES or the header lost its class
        // (Jellyfin recreates .skinHeader on client-side navigation) — so a settled home
        // page doesn't rewrite classes every frame, but a fresh header is still re-synced.
        var hdr = nfHdr;   // hoisted at the top of this pass
        if (heroVisible !== nfLastHeroVisible || (hdr && hdr.classList.contains('nf-hero-header') !== heroVisible)) {
            nfLastHeroVisible = heroVisible;
            document.documentElement.classList.toggle('nf-hero-top', heroVisible);
            if (hdr) hdr.classList.toggle('nf-hero-header', heroVisible);
        }
        // Fade the ambient glow out on any page that won't drive it: a detail page samples
        // the backdrop, home samples the hero — a home view without a visible hero has
        // nothing to re-sample, so clear the previous page's glow (and on the Requests page,
        // whose billboard drives none: heroGlow above).
        if (!(/#\/details/i.test(location.hash) || heroGlow)) { nfClearAmbient(); }
    }

    // ============ Brand outside the page: tab title and icons ============
    // The server adds the brand's own icon links, web-app manifest and splash image
    // to every page it serves, and takes Jellyfin's out of it
    // (ThemeTransformation.InjectBrandHead). Only the copy of index.html that is
    // written to disk keeps Jellyfin's — that file has to be restorable — so where
    // that copy is what the browser got, they go here; and only once the brand's own
    // icon has really loaded, so a page left behind by a plugin that is no longer
    // running keeps the icon it can still get.
    // jellyfin-web re-writes document.title on every navigation, to the SERVER'S NAME
    // on most routes, so the title is kept here as well: the server's name and
    // "Jellyfin" become the brand's, a film's or a page's own title is left alone.
    function nfBrandChrome() {
        try {
            if (nfBoot('Brand') !== 'villa' || !document.querySelector('[data-ct-brand]')) return;
            var name = 'Villa Cocquette';
            var own = document.querySelector('link[rel~="icon"][data-ct-brand]');
            var stock = [];
            ['link[rel~="icon"]', 'link[rel="apple-touch-icon"]', 'link[rel="manifest"]'].forEach(function (sel) {
                Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
                    if (!el.hasAttribute('data-ct-brand')) stock.push(el);
                });
            });
            if (own && stock.length) {
                var probe = new Image();
                probe.onload = function () {
                    stock.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
                    var app = document.querySelector('meta[name="application-name"]');
                    if (app) app.setAttribute('content', name);
                };
                probe.src = own.href;
            }
            // Never when the title already IS the brand's: writing a title, even the
            // same one, is a change to <title> — the observer below would call this
            // again, and on a server that is itself named like the brand that would
            // go round for ever and take the page with it.
            var fix = function () {
                var t = document.title, server = '';
                if (t === name) return;
                try { server = (window.ApiClient && ApiClient.serverName && ApiClient.serverName()) || ''; } catch (e) {}
                if (t === 'Jellyfin' || (server && t === server)) document.title = name;
            };
            fix();
            var titleEl = document.querySelector('title');
            if (titleEl && window.MutationObserver) {
                new MutationObserver(fix).observe(titleEl, { childList: true, characterData: true, subtree: true });
            }
        } catch (e) {}
    }

    // ============ Ident: the theme plays the pre-roll itself ============
    // A pre-roll plugin (Local Intros and the like) only tells Jellyfin WHICH file
    // to play; jellyfin-web then queues that file in front of the film as an ordinary
    // item — a second playback with the player's controls, the file's name as the
    // title, and everything loaded from scratch. The theme cannot change how the
    // player treats a queue entry, so it does not use one.
    //
    // Just before a film starts from the beginning the player asks the server "any
    // intros?" — ApiClient.getIntros, ONE call site in jellyfin-web 12, made only
    // when a pre-roll is due (start position 0, start index 0, full screen, a video
    // played on this device, the user's Cinema mode on) and awaited with no timeout.
    // That question is answered here: the theme plays its own full-screen <video> —
    // one element, no controls, with sound, from a copy it already holds — and only
    // then answers "none", so the film is the only thing the player ever starts.
    // Resume and auto-played next episodes never ask, exactly as with stock intros.
    //
    // Fails OPEN at every step: no file, a refused start, a media error, a picture
    // that has not come within 2.5 seconds, an engine this has not been proven on —
    // the original question goes to the server and playback is stock. The file is
    // served by the plugin (ThemeAssetsController); the page only ever sees its
    // address (IdentUrl), never the server path.
    //
    // ONE media element, and only while it plays: created when Play is pressed and
    // let go of — decoder and all — before the film is asked for. Nothing is kept
    // loaded in between (a television has one decoder, and Jellyfin Media Player's
    // web layer has no memory to spare under a film), only the file's bytes.
    var nfIdentBlob = '';        // object URL of the fetched file, for the life of the page
    var nfIdentFetching = false;
    var nfIdentTried = 0;
    var nfIdentFails = 0;        // loads that failed in a row
    var nfIdentMisses = 0;       // starts in a row that never came, though nothing was wrong with the load
    var nfIdentBad = false;      // this engine will not play it: no more tries on this page
    var nfIdentNoBlob = false;   // …or will not play it from a held copy: use the address
    var nfIdentRun = null;       // the answer in flight (one ident for a double Play)
    var nfIdentRunFor = '';      // …and the item it is for
    var NF_IDENT_HOLD_MAX = 64 * 1024 * 1024;

    function nfIdentApple() {
        var ua = navigator.userAgent || '';
        return /iPhone|iPad|iPod/i.test(ua)
            || (/AppleWebKit/i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua))
            || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
    }
    // Where the theme plays it itself. Apple's engine only on request: it decides
    // per element whether sound may start, and may refuse the FILM after the hold.
    function nfIdentHere() {
        if (nfBoot('IdentEnabled') !== true || !nfBoot('IdentUrl') || nfIdentBad) return false;
        if (nfIdentApple() && nfBoot('IdentApple') !== true) return false;
        return true;
    }
    // An ident is on screen, or still held over the film's start. The theme's own
    // preview clips ask this before they start: none of the player's signals is up
    // yet, and a clip started now would stream under the ident and into the film's
    // own start. The LAYER and nothing else: it is there from the first line of
    // nfIdentPlay until the hold lets go, and by then the player's own signals have
    // taken over — whereas an answer "in flight" can be the server's, which has no
    // time limit, and would keep previews off for good if it never came.
    function nfIdentBusy() {
        return !!document.querySelector('.nf-ident');
    }
    function nfIdentUrl() {
        try {
            if (!window.ApiClient || !ApiClient.accessToken || !ApiClient.getUrl) return '';
            var token = ApiClient.accessToken();
            if (!token) return '';
            var u = ApiClient.getUrl(nfBoot('IdentUrl'));
            return u + (u.indexOf('?') < 0 ? '?' : '&') + 'ApiKey=' + encodeURIComponent(token);
        } catch (e) { return ''; }
    }
    // Whether the file is held whole (in memory, and on the device: see below). A
    // file too big to be worth holding is not — the element then loads its own
    // beginning from the address when Play is pressed — and nor is one that
    // Apple's engine has refused to play from a held copy.
    function nfIdentHeld() {
        if (!nfIdentNoBlob) {
            // A device that would not play this very file from a held copy is not
            // asked to again at every start of the app.
            try { if (localStorage.getItem('nfIdentNoBlob') === (nfIdentVersion() || '-')) nfIdentNoBlob = true; } catch (e) {}
        }
        return !nfIdentNoBlob && nfBoot('IdentBytes') <= NF_IDENT_HOLD_MAX
            && !!window.fetch && !!window.URL && !!URL.createObjectURL;
    }
    // The file's version, as the server wrote it into the address.
    function nfIdentVersion() {
        var m = /[?&]v=([^&#]+)/.exec(String(nfBoot('IdentUrl') || ''));
        return m ? m[1] : '';
    }

    // ---- The copy that stays on the device ----
    // Held in memory, the file is gone with the page, and the next start of the app
    // fetches it again — and a film started in those first moments finds no copy and
    // has to stream the intro (which is what "buffering" was). So the file is also
    // put into the browser's own database, where it survives the app being closed:
    // from the second start on it is there within milliseconds and the network is
    // not asked at all. One record, replaced when the file's version changes.
    // IndexedDB and not the Cache API: that one needs https, and a home server is
    // usually plain http. Every step may fail (private window, no room, a blocked
    // database) and then the file is simply fetched as before.
    function nfIdentDb(done) {
        var over = false;
        var fin = function (db) {
            if (over) { if (db) { try { db.close(); } catch (e) {} } return; }
            over = true;
            done(db);
        };
        try {
            if (!window.indexedDB) { fin(null); return; }
            var req = indexedDB.open('nf-ident', 1);
            req.onupgradeneeded = function () { try { req.result.createObjectStore('files'); } catch (e) {} };
            req.onsuccess = function () { fin(req.result); };
            req.onerror = function () { fin(null); };
            req.onblocked = function () { fin(null); };
            setTimeout(function () { fin(null); }, 2000);
        } catch (e) { fin(null); }
    }
    function nfIdentKept(version, bytes, done) {
        nfIdentDb(function (db) {
            if (!db) { done(null); return; }
            var shut = function () { try { db.close(); } catch (e) {} };
            try {
                var get = db.transaction('files', 'readonly').objectStore('files').get('ident');
                get.onsuccess = function () {
                    var rec = get.result;
                    shut();
                    done(rec && rec.v === version && rec.blob && rec.blob.size === bytes ? rec.blob : null);
                };
                get.onerror = function () { shut(); done(null); };
            } catch (e) { shut(); done(null); }
        });
    }
    function nfIdentKeep(version, blob) {
        nfIdentDb(function (db) {
            if (!db) return;
            var shut = function () { try { db.close(); } catch (e) {} };
            try {
                var tx = db.transaction('files', 'readwrite');
                tx.objectStore('files').put({ v: version, blob: blob, at: Date.now() }, 'ident');
                tx.oncomplete = shut;
                tx.onerror = shut;
                tx.onabort = shut;
            } catch (e) { shut(); }
        });
    }
    function nfIdentWait() { return Math.min(8000 * Math.pow(4, nfIdentFails), 900000); }
    function nfIdentElement(src) {
        var v = document.createElement('video');
        v.preload = 'auto';
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        // No picture-in-picture button, no cast button: nothing of the browser's
        // own is to appear on it.
        v.disablePictureInPicture = true;
        v.setAttribute('disablepictureinpicture', '');
        v.setAttribute('disableremoteplayback', '');
        v.src = src;
        return v;
    }
    // Let go of whatever the element holds or is still downloading — and of its
    // decoder.
    function nfIdentRelease(v) {
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
    }
    // Made ready when the app starts, so that Play never waits for it: from the
    // device's own copy if it has this version, otherwise fetched once and kept.
    function nfIdentPreload() {
        if (nfIdentBlob || nfIdentFetching || nfIdentRun || !nfIdentHere() || !nfIdentHeld()) return;
        // Nobody signed in yet: asked again on the next pass, which costs nothing.
        var url = nfIdentUrl();
        if (!url) return;
        // A load that failed is not repeated at once, and less often each time.
        var now = Date.now();
        if (now - nfIdentTried < nfIdentWait()) return;
        nfIdentTried = now;
        nfIdentFetching = true;
        var version = nfIdentVersion(), bytes = nfBoot('IdentBytes');
        var ready = function (blob) {
            nfIdentBlob = URL.createObjectURL(blob);
            nfIdentFails = 0;
            nfIdentMisses = 0;
        };
        nfIdentKept(version, bytes, function (kept) {
            if (kept) {
                try { ready(kept); nfIdentFetching = false; return; } catch (e) {}
            }
            fetch(url).then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.blob();
            }).then(function (b) {
                ready(b);
                if (version) nfIdentKeep(version, b);
            })['catch'](function () { nfIdentFails++; }).then(function () { nfIdentFetching = false; });
        });
    }

    // Films, and episodes when asked for — not a trailer, a home video, a music video
    // or a television channel, which ask the same question. The question carries an
    // id, not a type, so the type is looked up: one small request on the way in.
    // No answer in a second and a half is a "no".
    function nfIdentScope(itemId) {
        return new Promise(function (resolve) {
            var t = setTimeout(function () { resolve(false); }, 1500);
            var done = function (yes) { clearTimeout(t); resolve(yes); };
            try {
                ApiClient.getItem(ApiClient.getCurrentUserId(), itemId).then(function (it) {
                    var type = it && it.Type;
                    done(type === 'Movie' || (type === 'Episode' && nfBoot('IdentEpisodes') !== false));
                }, function () { done(false); });
            } catch (e) { done(false); }
        });
    }

    // Whatever else is sounding would play on under the ident: stock only stops it
    // when the film starts, which is now seconds away. Elements of the page (a
    // browser's music player, a theme song) are muted here; Jellyfin Media Player's
    // own player is not an element and is seen to in nfIdentPlay.
    function nfIdentMuteOthers(own) {
        var list = [];
        try {
            Array.prototype.forEach.call(document.querySelectorAll('audio, video'), function (m) {
                if (m !== own && !m.muted && !m.paused) { m.muted = true; list.push(m); }
            });
        } catch (e) {}
        return list;
    }
    function nfIdentUnmute(list) {
        (list || []).forEach(function (m) { try { m.muted = false; } catch (e) {} });
    }
    // Resolves when the ident is over (ended, skipped, or cut short), with the layer
    // still up — or with { left: true } and nothing left behind when the viewer went
    // Back out of it; rejects when it could not be shown at all, also with nothing
    // left behind.
    function nfIdentPlay() {
        return new Promise(function (resolve, reject) {
            var held = !!nfIdentBlob;
            var src = nfIdentBlob || nfIdentUrl();
            if (!src) { reject(new Error('no file')); return; }
            var v = nfIdentElement(src);
            var layer = document.createElement('div');
            // focuscontainer: jellyfin-web's own word for "directional navigation
            // stays in here". A remote's arrows then have nowhere to go, and its OK
            // presses the layer itself — which is the skip.
            layer.className = 'nf-ident focuscontainer';
            layer.tabIndex = -1;
            // Inline, so it holds even with a stale stylesheet; above the film grain
            // (2.1e9) and the stock spinner, which is already turning underneath.
            // In place at once (it takes the keys and the clicks) but SEEN only from
            // the first frame: until then the page and its spinner stay, so a file
            // that never starts costs a wait, not a black screen.
            layer.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483600;background:#000;outline:0;opacity:0;';
            // The video takes no pointer of its own: a right-click on it would offer
            // the browser's "Show controls".
            var fit = 'width:100%;height:100%;object-fit:contain;display:block;background:#000;pointer-events:none;';
            v.style.cssText = fit;
            v.controls = false;
            v.muted = false;
            try { var vol = parseFloat(localStorage.getItem('volume')); v.volume = isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 1; } catch (e) {}
            layer.appendChild(v);
            var before = document.activeElement;
            document.body.appendChild(layer);
            function hold() { try { layer.focus({ preventScroll: true }); } catch (e) { try { layer.focus(); } catch (e2) {} } }
            hold();
            nfStopAllPreviewMedia();
            var muted = nfIdentMuteOthers(v);
            var skippable = nfBoot('IdentSkippable') !== false;
            var done = false, started = false, startedAt = 0, wd = 0, startWd = 0, black = false;
            var route = location.hash;
            // Jellyfin Media Player's music is not an element of the page: it is
            // mpv's, and it would play on under the ident. mpv is PAUSED, not muted:
            // its mute survives into the next file and the app's video player never
            // lifts it (a silent film), while "paused" is set afresh by every file
            // that is loaded — so whatever happens here, the film plays. Only if
            // something really is playing (it reports its position within moments),
            // and it is started again only if the viewer goes Back.
            var mpv = null, mpvTick = null, mpvPaused = false;
            try {
                mpv = window.api && window.api.player;
                if (mpv && mpv.positionUpdate && mpv.positionUpdate.connect && typeof mpv.pause === 'function') {
                    mpvTick = function () {
                        if (done || mpvPaused) return;
                        mpvPaused = true;
                        try { mpv.pause(); } catch (e) {}
                    };
                    mpv.positionUpdate.connect(mpvTick);
                    setTimeout(mpvOff, 600);
                } else { mpv = null; }
            } catch (e) { mpv = null; }
            function mpvOff() {
                try { if (mpv && mpvTick) mpv.positionUpdate.disconnect(mpvTick); } catch (e) {}
                mpvTick = null;
            }
            // A skip has to be meant: not the second half of a double-click on Play,
            // not the key that pressed Play still being held down.
            function meant(e) { return skippable && started && Date.now() - startedAt > 600 && !(e && e.repeat); }
            function back() {
                try { if (before && before !== document.body && document.body.contains(before)) before.focus(); } catch (e) {}
            }
            // The ident's last frame as a picture, so the element — and its decoder —
            // can be let go of BEFORE the film is asked for and the frame still
            // stands until the film's first. Where a frame cannot be read back (some
            // televisions) the hand-over is black instead.
            function still() {
                try {
                    if (black || !v.videoWidth || !v.videoHeight || v.videoWidth * v.videoHeight > 3840 * 2160) return null;
                    var c = document.createElement('canvas');
                    c.width = v.videoWidth;
                    c.height = v.videoHeight;
                    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
                    c.style.cssText = fit;
                    return c;
                } catch (e) { return null; }
            }

            function finish(shown, left) {
                if (done) return;
                done = true;
                clearTimeout(wd);
                clearTimeout(startWd);
                window.removeEventListener('keydown', onKey, true);
                window.removeEventListener('command', onCommand, true);
                window.removeEventListener('popstate', onRoute, true);
                window.removeEventListener('hashchange', onRoute, true);
                document.removeEventListener('focusin', onFocus, true);
                document.removeEventListener('visibilitychange', onHide, true);
                layer.removeEventListener('click', onClick, true);
                layer.removeEventListener('contextmenu', onMenu, true);
                mpvOff();
                // Back: what was playing plays on. (Otherwise a film is coming, and
                // it sets its own "playing".)
                if (left && mpvPaused && mpv) { try { mpv.play(); } catch (e) {} }
                if (left || !shown) {
                    if (!left) {
                        // From a copy that was already here: the engine will not
                        // have these bytes (that will not change), or simply never
                        // started them — which is not paid for a third time. Over
                        // the network it is the network: a rest, then another try.
                        if (held && nfIdentApple() && !nfIdentNoBlob) {
                            // Apple's engine and a held copy that did not start: the
                            // plain address is tried next time, as it always was there.
                            nfIdentNoBlob = true;
                            try { localStorage.setItem('nfIdentNoBlob', nfIdentVersion() || '-'); } catch (e) {}
                            try { URL.revokeObjectURL(nfIdentBlob); } catch (e) {}
                            nfIdentBlob = '';
                        }
                        else if (held) { if (v.error || ++nfIdentMisses >= 2) nfIdentBad = true; }
                        else { nfIdentFails++; nfIdentTried = Date.now(); }
                    }
                    nfIdentUnmute(muted);
                    nfIdentRelease(v);
                    try { layer.parentNode.removeChild(layer); } catch (e) {}
                    back();
                    if (left) resolve({ left: true }); else reject(new Error('ident'));
                    return;
                }
                nfIdentFails = 0;
                nfIdentMisses = 0;
                var frame = still();
                nfIdentRelease(v);
                try { layer.removeChild(v); } catch (e) {}
                if (frame) layer.appendChild(frame);
                resolve({ layer: layer, muted: muted, before: before });
            }
            // A skip goes to black: a frame frozen mid-move reads as "stuck" for the
            // moment the film takes to arrive. An ident that ran out keeps its last.
            function skip() { black = true; try { v.pause(); } catch (e) {} finish(true); }
            // While it is up every key is the ident's: nothing may reach the Play
            // button underneath, or the player's shortcuts. On window, in the capture
            // phase, so it is heard before jellyfin-web's own key handling.
            function onKey(e) {
                // The browser's own shortcuts stay the browser's: reload, full
                // screen, the developer tools.
                if (e.ctrlKey || e.metaKey || e.altKey || /^F\d{1,2}$/.test(e.key || '')) return;
                var k = e.key, c = e.keyCode;
                e.preventDefault();
                e.stopImmediatePropagation();
                // A television remote's or a gamepad's Back is leaving: the film is
                // not started and the viewer stays where they pressed Play. Handled
                // here and not handed on, because jellyfin-web's own "back" CLOSES
                // the app when there is no page to go back to. Some remotes send
                // their Back as an ordinary key: Escape in the TV layout (which is
                // how a gamepad's B arrives there), Backspace on Hisense sets.
                var tvBack = c === 461 || c === 10009 || c === 196 || k === 'GoBack' || k === 'BrowserBack' || k === 'XF86Back' || k === 'GamepadB';
                if (!tvBack && (k === 'Escape' || c === 27)) {
                    tvBack = document.documentElement.classList.contains('layout-tv') || document.body.classList.contains('layout-tv');
                }
                if (!tvBack && c === 8) {
                    var ua = (navigator.userAgent || '').toLowerCase();
                    tvBack = ua.indexOf('hisense') !== -1 && ua.indexOf('vidaa') !== -1;
                }
                if (tvBack) {
                    if (!e.repeat) finish(false, true);
                    return;
                }
                if (meant(e) && (k === 'Escape' || k === 'Enter' || k === ' ' || k === 'Backspace' || k === 'GamepadA' || c === 27 || c === 13 || c === 32 || c === 8 || c === 195)) skip();
            }
            // Remotes, gamepads and Jellyfin's own remote control do not press keys:
            // they send jellyfin-web COMMANDS (inputManager), which it announces as a
            // cancellable "command" event whenever anything is listening. Select is
            // the skip, Back is leaving, the rest is the ident's to ignore. (Where
            // nothing is listening there is no event: Select then presses whatever
            // has the focus — this layer — and Back goes back a page, which onRoute
            // reads as leaving too.)
            function onCommand(e) {
                var c = e && e.detail && e.detail.command;
                try { e.preventDefault(); e.stopPropagation(); } catch (x) {}
                if (c === 'back') finish(false, true);
                else if (c === 'select' && meant(null)) skip();
            }
            // Where nothing is listening the command acts on whatever has the focus:
            // so the focus stays here.
            function onFocus(e) { if (e.target !== layer && !layer.contains(e.target)) hold(); }
            function onClick(e) { e.preventDefault(); e.stopPropagation(); if (meant(e)) skip(); }
            function onMenu(e) { e.preventDefault(); }
            function onHide() { if (document.hidden) skip(); }
            // Nothing in the app changes the route while the ident is up, so a route
            // that changed — and stayed changed for a moment — is the viewer going
            // Back (the browser's button, a mouse's side button, a phone's gesture, a
            // remote's Back): they are leaving, not skipping.
            function onRoute() {
                if (location.hash === route) return;
                setTimeout(function () { if (location.hash !== route) finish(false, true); }, 120);
            }
            function arm() {
                clearTimeout(wd);
                wd = setTimeout(function () { finish(true); }, ((isFinite(v.duration) && v.duration > 0 ? v.duration : 17) + 3) * 1000);
            }
            window.addEventListener('keydown', onKey, true);
            window.addEventListener('command', onCommand, true);
            window.addEventListener('popstate', onRoute, true);
            window.addEventListener('hashchange', onRoute, true);
            document.addEventListener('focusin', onFocus, true);
            document.addEventListener('visibilitychange', onHide, true);
            layer.addEventListener('click', onClick, true);
            layer.addEventListener('contextmenu', onMenu, true);
            // Seen from its first FRAME, not from "playing": Jellyfin Media Player's
            // engine says "playing" a third of a second before it has a picture, and
            // that third would be a black screen. Until then the page stays.
            var seen = false;
            function reveal() {
                if (seen || done) return;
                seen = true;
                layer.style.opacity = '1';
                layer.style.cursor = 'none';
            }
            try { if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(reveal); } catch (e) {}
            v.addEventListener('timeupdate', function () { if (v.currentTime > 0) reveal(); });
            v.addEventListener('playing', function () {
                if (!started) startedAt = Date.now();
                started = true;
                clearTimeout(startWd);
                // An engine that reports neither frames nor time in good order.
                setTimeout(reveal, 700);
            });
            v.addEventListener('ended', function () { finish(true); });
            v.addEventListener('error', function () { finish(started); });
            // It is the tab's media session while it plays, so the keyboard's media
            // keys can pause it: that is a skip, or — where skipping is off — undone.
            v.addEventListener('pause', function () {
                if (done || v.ended || !started) return;
                if (skippable) skip(); else { try { v.play(); } catch (e) {} }
            });
            v.addEventListener('loadedmetadata', arm);
            arm();
            // No picture in two and a half seconds: the film should not wait for it.
            startWd = setTimeout(function () { if (!started) finish(false); }, 2500);
            var p;
            try { p = v.play(); } catch (e) { finish(false); return; }
            // An engine that will not start sound here says so by rejecting.
            if (p && p.then) p.then(null, function () { if (!started) finish(false); });
        });
    }

    // The ident is over and the film has only now been asked for: hold its last frame
    // until the film's first, and keep the stock controls from opening the film with
    // their three seconds on screen.
    function nfIdentHold(ctx) {
        var root = document.documentElement;
        var gone = false, poll = 0, t0 = Date.now(), filmAt = 0, stuckAt = 0;
        function pageIsUp() {
            var osd = document.getElementById('videoOsdPage');
            return !!(osd && !osd.classList.contains('hide')) && root.classList.contains('transparentDocument');
        }
        // What is already there is not the film: a theme video plays in the very
        // element the film will take over, and a player page that is already open
        // (a film started from inside the player) says nothing about the new one.
        var fv0 = document.querySelector('.videoPlayerContainer video');
        var src0 = fv0 ? fv0.currentSrc : '';
        var pageUp0 = pageIsUp();
        root.classList.add('nf-ident-hold');
        function remove() {
            try { ctx.layer.parentNode.removeChild(ctx.layer); } catch (e) {}
            // jellyfin-web noted "what had the focus" on the page it left for the
            // player, to give it back afterwards — and at that moment it was this
            // layer. Put the Play button back in its place.
            try {
                Array.prototype.forEach.call(document.querySelectorAll('.page'), function (pg) {
                    if (pg.activeElement === ctx.layer) pg.activeElement = ctx.before || null;
                });
            } catch (e) {}
        }
        function drop(fade) {
            if (gone) return;
            gone = true;
            clearInterval(poll);
            nfIdentUnmute(ctx.muted);
            armPress();
            if (fade) {
                ctx.layer.style.transition = 'opacity .25s ease';
                ctx.layer.style.opacity = '0';
                ctx.layer.style.pointerEvents = 'none';
                setTimeout(remove, 280);
            } else {
                remove();
            }
        }
        poll = setInterval(function () {
            var now = Date.now();
            // Every player, the browser's and a native one alike, opens the player
            // page on its first "playing" — and with it the page behind is put away
            // and the header becomes the player's (hidden by nf-ident-hold). That is
            // the moment to let go: a frame earlier the fade would show the page the
            // Play button was on.
            var pageUp = pageIsUp();
            var fv = document.querySelector('.videoPlayerContainer video');
            if (pageUp && (!pageUp0 || now - t0 > 1500)) {
                // A fade onto a film that is an element. A native player (Jellyfin
                // Media Player) draws the film itself, behind the page: nothing may
                // be painted over it, so there it is a cut.
                drop(!!fv);
            } else if (fv && !(fv === fv0 && fv.currentSrc === src0)) {
                if (!fv.paused && fv.currentTime > 0) {
                    if (!filmAt) filmAt = now;
                    // Half a second of film with no player page: someone else's player.
                    if (now - filmAt > 500) drop(true);
                } else if (fv.paused && fv.readyState >= 1 && !fv.ended) {
                    // Loaded, and not started: the engine wants the viewer's own
                    // hand on it (Apple's does, this long after the tap). Stand
                    // aside at once — the film's own Play, or any press at all.
                    if (!stuckAt) stuckAt = now;
                    if (now - stuckAt > 1200) { drop(true); wake(); nudge(fv); }
                } else {
                    stuckAt = 0;
                }
            }
            // The player has something to say — it could not play this, it wants an
            // answer — and it is saying it underneath.
            if (document.querySelector('.dialog.opened')) drop(true);
            // Nothing came. Let whatever there is be seen.
            if (now - t0 > 10000 || (now - t0 > 4000 && !nfPlaybackActive())) drop(true);
        }, 50);
        var woken = false, watch = 0, seenShown = false, hiddenFor = 0, pressArmed = false;
        function eat(e) { e.preventDefault(); e.stopPropagation(); document.removeEventListener('click', eat, true); }
        function wake(e) {
            if (woken) return;
            woken = true;
            clearInterval(watch);
            try {
                if (e && e.type === 'pointerdown') {
                    var osd = document.getElementById('videoOsdPage');
                    if (osd && e.target !== osd && osd.contains(e.target)) {
                        // A press that landed on a control nobody could see is not
                        // a press on that control: it brings the controls up, and
                        // that is all.
                        e.preventDefault();
                        e.stopPropagation();
                        document.addEventListener('click', eat, true);
                        setTimeout(function () { document.removeEventListener('click', eat, true); }, 700);
                    } else if (e.pointerType === 'touch') {
                        // A tap on the picture TOGGLES the controls in jellyfin-web,
                        // and they count as shown while nobody can see them — so
                        // the tap would hide them. It reveals them instead.
                        e.stopPropagation();
                    }
                }
            } catch (x) {}
            root.classList.remove('nf-ident-hold');
            ['mousemove', 'keydown', 'pointerdown'].forEach(function (ev) { document.removeEventListener(ev, wake, true); });
            window.removeEventListener('command', wake, true);
        }
        // A press counts from the moment the film can be seen: it must do what it
        // does in stock (pause, full screen), and for that the hold has to end with
        // it. Called by drop().
        function armPress() {
            if (pressArmed || woken) return;
            pressArmed = true;
            document.addEventListener('pointerdown', wake, true);
        }
        // One press of anything starts a film the engine would not start by itself —
        // and the listening goes on until a press has really started it.
        function nudge(fv) {
            var kinds = ['pointerdown', 'touchend', 'click', 'keydown'];
            var off = function () { kinds.forEach(function (k) { document.removeEventListener(k, go, true); }); };
            var go = function () {
                try {
                    if (!fv.paused) { off(); return; }
                    var pr = fv.play();
                    if (pr && pr.then) pr.then(off, function () {}); else off();
                } catch (e) {}
            };
            kinds.forEach(function (k) { document.addEventListener(k, go, true); });
            setTimeout(off, 120000);
        }
        // A pointer that moves, a key, a remote: not at once — the pointer is still
        // settling from the click that started it all, and a remote repeats a button
        // that is held (the OK that skipped the ident must not open the controls).
        setTimeout(function () {
            if (woken) return;
            ['mousemove', 'keydown'].forEach(function (ev) { document.addEventListener(ev, wake, true); });
            // A remote does not press keys (see onCommand in nfIdentPlay). On window,
            // capturing: before the player's own listener, which is about to try to
            // put the focus on a button that cannot take it while it is unseen.
            window.addEventListener('command', wake, true);
        }, 700);
        // By now the stock controls would have hidden themselves anyway.
        setTimeout(wake, 9000);
        // And the hold is the player's own first showing of its controls: it ends
        // when they have gone again by themselves — GONE, not going: the class that
        // starts their fade must have stood for a moment, or their last third would
        // flash — or with the player, if the film is left sooner.
        watch = setInterval(function () {
            if (!gone) return;
            if (!nfPlaybackActive()) { wake(); return; }
            var bar = document.querySelector('.videoOsdBottom');
            if (bar && bar.classList.contains('hide')) { if (seenShown) wake(); return; }
            var shown = !!bar && !bar.classList.contains('videoOsdBottom-hidden');
            if (shown) { seenShown = true; hiddenFor = 0; }
            else if (seenShown && ++hiddenFor >= 2) wake();
        }, 400);
    }

    // The server offers the same intro to apps that do NOT show the theme (Android
    // TV and the like: ThemeIntroProvider.cs) — as an entry in its answer to this
    // very question, which those apps then play with their own player. Here the
    // theme is running, and the theme alone decides about its intro: wherever the
    // question is handed on to the server, that one entry is taken out of the
    // answer again. So Jellyfin's player never shows it after the theme has, nor
    // in its place where the theme has decided against it (a device it is switched
    // off for, a start that did not come).
    function nfIdentOwnOut(answer) {
        var own = String(nfBoot('IdentItem') || '').replace(/-/g, '').toLowerCase();
        if (!own || !answer || typeof answer.then !== 'function') return answer;
        return answer.then(function (r) {
            try {
                var items = r && r.Items;
                if (items && items.length) {
                    var kept = items.filter(function (it) {
                        return !it || String(it.Id || '').replace(/-/g, '').toLowerCase() !== own;
                    });
                    if (kept.length !== items.length) {
                        r.Items = kept;
                        if (typeof r.TotalRecordCount === 'number') r.TotalRecordCount = kept.length;
                    }
                }
            } catch (e) {}
            return r;
        });
    }

    // The wrap lives on the ApiClient INSTANCE (jellyfin-web makes a new one on
    // sign-in, so this is re-run from applyDynamic). Whenever the ident is not going
    // to play it returns the original call's own answer — less the server's copy of
    // the intro, see above.
    function nfIdentWrap() {
        try {
            var c = window.ApiClient;
            if (!c || c.__nfIdent || typeof c.getIntros !== 'function') return;
            var orig = c.getIntros;
            c.__nfIdent = true;
            c.getIntros = function (itemId) {
                var self = this, args = arguments;
                var stock = function () { return nfIdentOwnOut(orig.apply(self, args)); };
                try {
                    if (!nfIdentHere() || !nfIdentUrl()) return stock();
                    // One ident for one Play pressed twice — and, once it is on
                    // screen, for whatever else is asked meanwhile: a second film
                    // must not start under it. Before that (the type is still being
                    // looked up) a question about ANOTHER item is the server's.
                    if (nfIdentRun) return (nfIdentRunFor === itemId || nfIdentBusy()) ? nfIdentRun : stock();
                    // A load has just failed: not again until it has had its rest.
                    if (nfIdentFails > 0 && !nfIdentBlob && Date.now() - nfIdentTried < nfIdentWait()) return stock();
                    var clear = function () { if (nfIdentRun === run) { nfIdentRun = null; nfIdentRunFor = ''; } };
                    // The run is over the moment the question is handed on to the
                    // server: that answer has no time limit, and nothing here may
                    // wait on it.
                    var run = nfIdentScope(itemId).then(function (due) {
                        if (!due) { clear(); return stock(); }
                        return nfIdentPlay().then(function (ctx) {
                            if (ctx.left) {
                                // The viewer went Back: nothing is to play. The player
                                // is waiting on this answer and on nothing else — it
                                // has set nothing up yet but its spinner — so it is
                                // simply never given one.
                                clear();
                                try { if (window.Loading && Loading.hide) Loading.hide(); } catch (e) {}
                                return new Promise(function () {});
                            }
                            // The film is owed whatever happens in here: nothing of
                            // the ident may outlive a mistake in its own tidying up.
                            try { nfIdentHold(ctx); } catch (e) {
                                try { ctx.layer.parentNode.removeChild(ctx.layer); } catch (e2) {}
                                try { document.documentElement.classList.remove('nf-ident-hold'); nfIdentUnmute(ctx.muted); } catch (e3) {}
                            }
                            return { Items: [], TotalRecordCount: 0 };
                        }, function () { clear(); return stock(); });
                    });
                    nfIdentRun = run;
                    nfIdentRunFor = itemId;
                    run.then(clear, clear);
                    return run;
                } catch (e) { return stock(); }
            };
        } catch (e) {}
    }

    // ============ Requests: the settings line, on every page ============
    // The drawer's line under "Requests in the app" (renderPanel). Requests come through a
    // second plugin, and the part of them that can be wrong is set up there, so the drawer
    // says where the bridge stands: installed and loaded, given a Seerr to talk to, taking
    // requests from this administrator. The line has the most to say exactly where the
    // server leaves the Requests block below out of the page - no bridge loaded: not
    // installed, waiting for a restart, disabled - so it stands outside that block, and so
    // do the probe it shares with the block's gate and the two helpers that read a refusal.
    // The dashboard page asks the same (configPage.html checkSeerr) and cannot reach this
    // script, so it carries its own copy of these steps and words: keep the two alike. Asked
    // afresh each time - an administrator who has just mended the bridge's settings wants to
    // see that - and nothing the pages go by is written. Resolves [text, tone], tone 'ok' |
    // 'bad' | ''; never rejects.
    var NF_RQ_BRIDGE_ID = 'd2fcf9c8c3c747e89dd68de9867e36bb';
    // An update or a disable lists the bridge once per version until the next restart; the
    // entry that counts is the best of them. Deleted (uninstalled) and Superseded (an older
    // version) are on their way out and do not count.
    var NF_RQ_PLUGIN_RANK = { Active: 5, Restart: 4, Disabled: 3 };
    function nfRqSetupLine() {
        var failed = ['The server did not answer this check. Reload this page and look again.', ''];
        try {
            return ApiClient.getInstalledPlugins().then(function (list) {
                var best = null;
                (list || []).forEach(function (p) {
                    if (!p || String(p.Id || '').replace(/-/g, '').toLowerCase() !== NF_RQ_BRIDGE_ID) return;
                    if (p.Status === 'Deleted' || p.Status === 'Superseded' || p.Status === 'Superceded') return;
                    if (!best || (NF_RQ_PLUGIN_RANK[p.Status] || 0) > (NF_RQ_PLUGIN_RANK[best.Status] || 0)) best = p;
                });
                if (!best) return ['✗ The Jellyseerr Bridge plugin is not installed. Add its repository (https://raw.githubusercontent.com/monjaka/jellyfin-plugin-jellyseerr-bridge/main/manifest.json) in Dashboard → Plugins, install it, restart Jellyfin. Its web-loader script is not needed.', 'bad'];
                if (best.Status === 'Restart') return ['Restart Jellyfin to load the Jellyseerr Bridge.', ''];
                if (best.Status === 'Disabled') return ['The Jellyseerr Bridge is disabled in Dashboard → Plugins.', ''];
                if (best.Status !== 'Active') return ['The Jellyseerr Bridge could not be loaded (see the server log).', ''];
                return ApiClient.getJSON(ApiClient.getUrl('JellyseerrBridge/Status')).then(function (s) {
                    if (!s || s.isConfigured !== true) return ['✗ Enter the Seerr address and API key in the Jellyseerr Bridge settings.', 'bad'];
                    var host = typeof s.jellyseerrHost === 'string' && s.jellyseerrHost ? s.jellyseerrHost : 'Seerr';
                    return nfRqProbe().then(function (v) {
                        if (v === 'no') return ['✗ Your own account is not on the bridge\'s allowed list. If you listed users there, use the IDs without dashes.', 'bad'];
                        if (v === 'off') return ['Connected to ' + host + '. Requests are switched off in the bridge; searching still works.', ''];
                        return ['✓ Connected to ' + host + '. Requests go to Seerr as its administrator and are approved at once. Titles and summaries come in Seerr\'s display language.', 'ok'];
                    });
                });
            }).then(null, function () { return failed; });
        } catch (e) { return Promise.resolve(failed); }
    }

    // May this user send requests? The bridge (0.1.0.5) checks a request in a fixed
    // order, and this one is refused by the third check at the latest, so it never
    // reaches Seerr. All three answers measured on the rig against the real bridge:
    //  1. submissions switched off: 403 {"message":"Request submission is disabled
    //     by the Jellyfin administrator."}                                  -> 'off'
    //  2. not on the bridge's allow-list: 403 with no body at all (Forbid()) -> 'no'
    //  3. allowed: 400 {"message":"mediaType must be movie or tv."}         -> 'ok'
    // A 403 is 'off' only when its message says "disabled": the same test a real
    // request's refusal gets (nfRqPost). Any other 403, with a body or without, is a
    // refusal of the user. An answer that is no 403 at all (a future bridge that
    // validates first, a server error, the network) is a yes: nobody is turned away
    // on a guess, and a real request's own refusal says so plainly and is then
    // remembered (nfRqPermKeep).
    function nfRqProbe() {
        try {
            return ApiClient.ajax({
                type: 'POST', url: ApiClient.getUrl('JellyseerrBridge/Request'),
                data: JSON.stringify({ mediaType: 'probe', mediaId: 0 }),
                contentType: 'application/json', dataType: 'json'
            }).then(function () { return 'ok'; }, function (r) {
                if (!r || r.status !== 403) return 'ok';
                return nfRqText(r).then(function (t) {
                    return /disabled/i.test(nfRqMessage(t)) ? 'off' : 'no';
                });
            });
        } catch (e) { return Promise.resolve('ok'); }
    }

    // A refusal's body as text, or null when it cannot be read. jellyfin-apiclient
    // rejects any status from 400 up with the raw Response, its body still unread.
    function nfRqText(r) {
        try {
            if (r && typeof r.text === 'function') {
                return r.text().then(function (t) { return t == null ? '' : String(t); }, function () { return null; });
            }
        } catch (e) {}
        return Promise.resolve(null);
    }
    // The words of a refusal: the bridge's and Seerr's {message}, Seerr's {error},
    // ASP.NET's ProblemDetails {title}, or else the text itself.
    function nfRqMessage(t) {
        try {
            var j = JSON.parse(t);
            if (j && typeof j === 'object') return String(j.message || j.error || j.title || '');
        } catch (e) {}
        return String(t || '');
    }

    // Marker: where requests are off, the server cuts from here through the end marker (ThemeTransformation.CutRequests).
    // @nf-requests-begin
    // ============ Requests (Seerr, through the Jellyseerr Bridge) ============
    // Films and series that are not in the library can be asked for from inside the
    // app, through the third-party Jellyseerr Bridge plugin: it hands what it is sent
    // on to a Seerr server and passes Seerr's answers back unchanged. The server says
    // in the page it serves whether the bridge was loaded when it started
    // (nfBoot('SeerrBridge'), and only with the option on: a plugin's routes only
    // change with a restart). Everything else is asked here, once each:
    //  - the bridge's Status (anonymous, the same for everyone on this server): has
    //    it a Seerr to talk to, and may requests be sent at all;
    //  - whether THIS user may send them. The bridge tells nobody its allow-list, so
    //    it is found out with a request it is certain to refuse (nfRqProbe).
    // Each answer is filed under the server or the user it was asked for, so one that
    // lands after a sign-out or a switch of server is never taken for the current
    // one — ApiClient has no timeout, and an answer can come at any time. Until the
    // answers are in, and whenever there is a doubt about who is asking, Requests
    // are simply not there: the page is stock.
    var NF_RQ_STATUS_TTL = 10 * 60 * 1000;
    // A failed Status other than a 404 (the network not up yet, a server still
    // starting) is asked again after a minute, not after ten: a hiccup at the first
    // load must not hide Requests for that long. A 404 means the bridge is gone, and
    // keeps the full TTL. The retry rides on the next pass — no timer of its own, so
    // a page that sits idle asks nothing.
    var NF_RQ_RETRY_TTL = 60 * 1000;
    // In memory as well as in sessionStorage: nfRqLive runs on every pass, and a
    // storage read plus a JSON.parse per mutation frame is exactly the kind of cost
    // this file keeps off the home page. Storage is read once per server, once per user.
    var nfRqStatusHeld = { sid: null, rec: null };   // rec: {ts, v: {...} or null, e: status of a failure}
    var nfRqPermHeld = { uid: null, v: null };       // 'ok' | 'no' | 'off', null = not asked yet
    var nfRqStatusAsking = '';                       // the server whose Status is in flight
    var nfRqPermAsking = '';                         // the user whose probe is in flight

    // The signed-in user Requests may be offered to, or '' — every condition that
    // needs no answer from the bridge, checked before anything is asked of it.
    function nfRqUser() {
        try {
            if (!nfBoot('SeerrBridge') || cfg('SeerrRequests', true) === false) return '';
            if (typeof ApiClient === 'undefined' || !ApiClient.getCurrentUserId || !ApiClient.serverId) return '';
            var uid = ApiClient.getCurrentUserId();
            if (!uid || !ApiClient.serverId() || nfIsDashboard()
                || document.documentElement.classList.contains('nf-session')) return '';
            // A parental-rating limit (updateAdmin) turns the user away before the
            // bridge is asked anything. Not known yet is a "not yet", and the bridge
            // is not asked meanwhile either: a Kids profile costs it nothing.
            if (nfAdminState.uid !== uid || nfAdminState.limited !== false) return '';
            return uid;
        } catch (e) { return ''; }
    }
    function nfRqStatusRec() {
        var sid;
        try { sid = ApiClient.serverId() || ''; } catch (e) { return null; }
        if (nfRqStatusHeld.sid !== sid) {
            nfRqStatusHeld.sid = sid;
            nfRqStatusHeld.rec = null;
            try {
                var rec = JSON.parse(sessionStorage.getItem('nfrq1:status:' + sid) || 'null');
                if (rec && typeof rec.ts === 'number') nfRqStatusHeld.rec = rec;
            } catch (e) {}
        }
        return nfRqStatusHeld.rec;
    }
    function nfRqStatusKeep(sid, rec) {
        try { sessionStorage.setItem('nfrq1:status:' + sid, JSON.stringify(rec)); } catch (e) {}
        if (nfRqStatusHeld.sid === sid) nfRqStatusHeld.rec = rec;
    }
    function nfRqFresh(rec) {
        var age = rec ? Date.now() - rec.ts : -1;
        return age >= 0 && age <= (rec.e && rec.e !== 404 ? NF_RQ_RETRY_TTL : NF_RQ_STATUS_TTL);
    }
    function nfRqPermOf(uid) {
        if (nfRqPermHeld.uid !== uid) {
            nfRqPermHeld.uid = uid;
            nfRqPermHeld.v = null;
            try {
                var v = sessionStorage.getItem('nfrq1:perm:' + uid);
                if (v === 'ok' || v === 'no' || v === 'off') nfRqPermHeld.v = v;
            } catch (e) {}
        }
        return nfRqPermHeld.v;
    }
    // Also how a real request's own bare 403 makes the refusal stick for the session.
    // null forgets the answer, so the user is asked again.
    function nfRqPermKeep(uid, v) {
        try {
            if (v) sessionStorage.setItem('nfrq1:perm:' + uid, v);
            else sessionStorage.removeItem('nfrq1:perm:' + uid);
        } catch (e) {}
        if (nfRqPermHeld.uid === uid) nfRqPermHeld.v = v || null;
    }

    // Whether Requests are there for this user, now. Synchronous and cheap: it runs
    // on every pass, reads what is known and writes nothing to the page — whatever is
    // still unknown is asked for (nfRqPrime), and the answer brings its own pass.
    // Live needs the Status's yes AND this user's permission: offering the entry
    // before the probe is back would flash it at everyone the bridge refuses.
    function nfRqLive() {
        try {
            var uid = nfRqUser();
            if (!uid) return false;
            var rec = nfRqStatusRec();
            var on = !!(rec && rec.v && rec.v.isConfigured);
            var perm = on ? nfRqPermOf(uid) : null;
            // A Status that has grown old keeps its yes while it is asked again: the
            // entry must not blink off every ten minutes.
            if (!nfRqFresh(rec) || (on && !perm)) nfRqPrime();
            return on && !!perm && perm !== 'no';
        } catch (e) { return false; }
    }

    // Asks for what is missing, one thing at a time and each at most once: the
    // Status first (no point probing a bridge with no Seerr behind it), then the
    // probe. Each answer is followed by a pass, which asks for the next.
    function nfRqPrime() {
        try {
            var uid = nfRqUser();
            if (!uid) return;
            var sid = ApiClient.serverId();
            var rec = nfRqStatusRec();
            if (!nfRqFresh(rec)) {
                if (nfRqStatusAsking === sid) return;
                var was = (rec && rec.v) || null;
                var asked = ApiClient.getJSON(ApiClient.getUrl('JellyseerrBridge/Status'));
                nfRqStatusAsking = sid;
                var put = function (v, e) {
                    if (nfRqStatusAsking === sid) nfRqStatusAsking = '';
                    var r = { ts: Date.now(), v: v };
                    if (e) r.e = e;
                    nfRqStatusKeep(sid, r);
                    try { applyDynamic(); } catch (e2) {}
                };
                asked.then(function (d) {
                    var ok = !!d && typeof d === 'object';
                    var v = ok ? {
                        isConfigured: d.isConfigured === true,
                        requestSubmissionEnabled: d.requestSubmissionEnabled === true,
                        jellyseerrHost: typeof d.jellyseerrHost === 'string' ? d.jellyseerrHost : null
                    } : null;
                    // 'off' is the bridge's switch, not the user: the probe could not get
                    // past it to the allow-list. Once a Status fetched just now says
                    // requests are on again, the user is asked again: once per Status, so
                    // never in a loop. A failed refresh (below) says nothing new about the
                    // switch, and leaves 'off' alone.
                    if (v && v.requestSubmissionEnabled && nfRqPermOf(uid) === 'off') nfRqPermKeep(uid, null);
                    put(v, ok ? 0 : -1);
                }, function (r) {
                    // 404: the bridge is gone (its routes left with a restart this page
                    // was served before). Anything else (the network, a server still
                    // starting) keeps what was known, and is asked again after a minute
                    // (NF_RQ_RETRY_TTL).
                    var code = (r && typeof r.status === 'number') ? r.status : -1;
                    put(code === 404 ? null : was, code);
                }).then(null, function () { if (nfRqStatusAsking === sid) nfRqStatusAsking = ''; });
                return;
            }
            if (!rec.v || !rec.v.isConfigured || nfRqPermOf(uid) || nfRqPermAsking === uid) return;
            nfRqPermAsking = uid;
            nfRqProbe().then(function (v) {
                if (nfRqPermAsking === uid) nfRqPermAsking = '';
                nfRqPermKeep(uid, v);
                try { applyDynamic(); } catch (e) {}
            }, function () { if (nfRqPermAsking === uid) nfRqPermAsking = ''; });
        } catch (e) {}
    }

    // Requests may be SENT: the bridge takes them, and takes them from this user.
    // Browsing works without (a disabled button and one discreet note).
    function nfRqSubmitOk() {
        try {
            var uid = nfRqUser();
            if (!uid) return false;
            var rec = nfRqStatusRec();
            return !!(rec && rec.v && rec.v.requestSubmissionEnabled) && nfRqPermOf(uid) === 'ok';
        } catch (e) { return false; }
    }

    // ---- Data: every call goes through ApiClient (base path and token) ----
    // A GET under the bridge's routes: Search, Discover/<row>, Movie/<id>, Tv/<id>.
    // A refusal arrives as the raw Response (502 {message} when Seerr cannot be
    // reached); the caller decides what that means where it is.
    function nfRqGet(path, params) {
        try {
            return ApiClient.getJSON(ApiClient.getUrl('JellyseerrBridge/' + path, params));
        } catch (e) { return Promise.reject(e); }
    }

    // Sends one request and says how it went, as a code. It never rejects, so the
    // control it came from can always be put right again.
    function nfRqPost(body) {
        var out = function (code, id) { return { code: code, id: id > 0 ? id : null }; };
        try {
            return ApiClient.ajax({
                type: 'POST', url: ApiClient.getUrl('JellyseerrBridge/Request'),
                data: JSON.stringify(body), contentType: 'application/json', dataType: 'json'
            }).then(function (d) {
                // ApiClient resolves every status below 400 alike, with the parsed body.
                // A 201 carries the new request and its id; Seerr's 202 {"message":"No
                // seasons available to request"} is a success code that asked for NOTHING.
                // Any other success is an answer nobody here knows.
                var o = (d && typeof d === 'object') ? d : {};
                var id = Number(o.id);
                if (id > 0) return out('requested', id);
                return out(typeof o.message === 'string' ? 'none' : 'error');
            }, function (r) {
                var st = (r && typeof r.status === 'number') ? r.status : 0;
                // No status: the network failed, or a 2xx body was no JSON at all.
                if (!st) return out(r && r.name === 'SyntaxError' ? 'error' : 'down');
                if (st === 409) return out('already');
                // 500 is the bridge's own when Seerr cannot be reached during a POST (it
                // looks up Seerr's Radarr/Sonarr defaults outside its error handling);
                // 502 and 504: not reachable, or too slow.
                if (st === 500 || st === 502 || st === 504) return out('down');
                if (st !== 403) return out('error');
                return nfRqText(r).then(function (t) {
                    if (t === null) return out('error');
                    if (!/\S/.test(t)) return out('forbidden');
                    var m = nfRqMessage(t);
                    if (/disabled/i.test(m)) return out('disabled');
                    if (/blocklisted/i.test(m)) return out('blocklisted');
                    // Any other refusal is said in its own words - Seerr's CSRF protection, say: "invalid csrf
                    // token" (design 6.5: "403 with a message -> that message"), trimmed and held to 200
                    // characters. Markup (a proxy's error page) is no message.
                    var o = out('error');
                    var say = String(m).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
                    if (say && !/</.test(say)) o.msg = say.length > 200 ? say.slice(0, 200) : say;
                    return o;
                });
            }).then(null, function () { return out('error'); });
        } catch (e) { return Promise.resolve(out('error')); }
    }

    // ---- The model of one title ----
    // Trimmed to what the tiles, the card and the window show, and safe to keep in
    // sessionStorage. Seerr's own statuses: 1 unknown, 2 pending, 3 processing (its
    // UI and ours say "Requested"), 4 partly available, 5 available, 6 blocklisted,
    // 7 deleted. A title Seerr has never seen has no mediaInfo, and is requestable.
    var NF_RQ_PATH = /^\/[A-Za-z0-9._-]+$/;
    function nfRqPath(p) { return (typeof p === 'string' && NF_RQ_PATH.test(p)) ? p : ''; }
    // null for a person or a collection (search and trending mix them in), for a
    // blocklisted title (hidden, as Seerr hides it) and for an id that is no TMDB id.
    function nfRqModel(r) {
        try {
            if (!r || typeof r !== 'object') return null;
            // The details (Movie/<id>, Tv/<id>) carry no mediaType: their shape says it.
            var mt = r.mediaType || (r.firstAirDate !== undefined || r.numberOfSeasons !== undefined ? 'tv'
                : (r.releaseDate !== undefined || r.runtime !== undefined ? 'movie' : ''));
            if (mt !== 'movie' && mt !== 'tv') return null;
            var id = Number(r.id);
            if (!(id > 0) || Math.floor(id) !== id) return null;
            var mi = r.mediaInfo;
            // Seerr's trending list pairs its records with titles by TMDB id alone, and
            // a film and a series can share one: a record of the other kind is not this
            // title's, and would offer someone else's film to play.
            if (!mi || typeof mi !== 'object' || (mi.mediaType && mi.mediaType !== mt)) mi = null;
            var st = mi ? Number(mi.status) : 1;
            if (st === 6) return null;
            if (!(st >= 1 && st <= 7) || Math.floor(st) !== st) st = 1;
            var date = String((mt === 'movie' ? r.releaseDate : r.firstAirDate) || '');
            var y = /^(\d{4})/.exec(date);
            var g = Array.isArray(r.genreIds) ? r.genreIds
                : (Array.isArray(r.genres) ? r.genres.map(function (x) { return x && x.id; }) : []);
            // The Jellyfin item id, as Jellyfin writes it (32 hex digits): it goes into
            // the details route and data-id, so nothing else gets through.
            var jf = (mi && typeof mi.jellyfinMediaId === 'string') ? mi.jellyfinMediaId.replace(/-/g, '').toLowerCase() : '';
            var vote = Number(r.voteAverage);
            return {
                key: mt + ':' + id, id: id, mt: mt,
                title: String((mt === 'movie' ? (r.title || r.originalTitle) : (r.name || r.originalName)) || ''),
                year: y ? parseInt(y[1], 10) : null,
                date: date,
                overview: typeof r.overview === 'string' ? r.overview : '',
                vote: (vote >= 0 && vote <= 10) ? vote : 0,
                votes: Math.max(0, parseInt(r.voteCount, 10) || 0),
                poster: nfRqPath(r.posterPath),
                backdrop: nfRqPath(r.backdropPath),
                genres: g.filter(function (x) { return typeof x === 'number' && x > 0; }),
                status: st,
                jf: /^[0-9a-f]{32}$/.test(jf) ? jf : null,
                dl: !!(mi && mi.downloadStatus && mi.downloadStatus.length > 0)
            };
        } catch (e) { return null; }
    }

    // TMDB artwork at the device's pixel density (nfW's rule: capped at 2x), on
    // TMDB's own size ladder; above its top rung only 'original' is bigger. The bridge
    // cannot proxy images, so the device loads them from TMDB itself.
    var NF_RQ_POSTER_W = [185, 342, 500, 780];
    var NF_RQ_BACKDROP_W = [300, 780, 1280];
    function nfRqImg(path, kind, cssPx) {
        try {
            if (typeof path !== 'string' || !NF_RQ_PATH.test(path)) return '';
            var rungs = kind === 'poster' ? NF_RQ_POSTER_W : NF_RQ_BACKDROP_W;
            var want = (Number(cssPx) || 0) * Math.min(window.devicePixelRatio || 1, 2);
            var size = 'original';
            for (var i = 0; i < rungs.length; i++) { if (rungs[i] >= want) { size = 'w' + rungs[i]; break; } }
            return 'https://image.tmdb.org/t/p/' + size + path;
        } catch (e) { return ''; }
    }

    // A title's state as the tiles and the window show it. 7 (deleted) can be asked
    // for again; 6 (blocklisted) never gets this far (nfRqModel).
    function nfRqState(m) {
        try {
            var s = m ? m.status : 0;
            return s === 2 ? 'pending' : s === 3 ? 'requested' : s === 4 ? 'partial' : s === 5 ? 'available' : 'request';
        } catch (e) { return 'request'; }
    }

    // TMDB's genre ids, as Seerr names them (its Discover constants): the lists carry
    // ids only, the names come with the details alone.
    var NF_RQ_GENRES = {
        28: ['Action', 'Action'], 12: ['Adventure', 'Abenteuer'], 16: ['Animation', 'Animation'],
        35: ['Comedy', 'Komödie'], 80: ['Crime', 'Krimi'], 99: ['Documentary', 'Dokumentarfilm'],
        18: ['Drama', 'Drama'], 10751: ['Family', 'Familie'], 14: ['Fantasy', 'Fantasy'],
        36: ['History', 'Historie'], 27: ['Horror', 'Horror'], 10402: ['Music', 'Musik'],
        9648: ['Mystery', 'Mystery'], 10749: ['Romance', 'Liebesfilm'], 878: ['Science Fiction', 'Science-Fiction'],
        10770: ['TV Movie', 'TV-Film'], 53: ['Thriller', 'Thriller'], 10752: ['War', 'Kriegsfilm'],
        37: ['Western', 'Western'], 10759: ['Action & Adventure', 'Action & Abenteuer'], 10762: ['Kids', 'Kinder'],
        10763: ['News', 'Nachrichten'], 10764: ['Reality', 'Reality'], 10765: ['Sci-Fi & Fantasy', 'Sci-Fi & Fantasy'],
        10766: ['Soap', 'Soap'], 10767: ['Talk', 'Talk'], 10768: ['War & Politics', 'Krieg & Politik']
    };
    function nfRqGenre(id) {
        try {
            var g = Object.prototype.hasOwnProperty.call(NF_RQ_GENRES, id) ? NF_RQ_GENRES[id] : null;
            return g ? g[nfL() === LOCALES.de ? 1 : 0] : '';
        } catch (e) { return ''; }
    }

    // ---- The way in: "Anfragen" wherever the theme draws navigation ----
    // The page's address, NF_RQ_PAGE and NF_RQ_HREF, stands with the nav strip's state:
    // the strip compares every tab with it on pages without this block too.
    // Material's "playlist_add". The drawer's rows draw MUI icons, one SVG path each.
    var NF_RQ_ICON = 'M14 10H3v2h11v-2zm0-4H3v2h11V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM3 16h7v-2H3v2z';

    // 'page' on the Requests page; 'search' on jellyfin's own search with something
    // typed in it; else null. From the hash alone, which the router writes before
    // anything renders.
    function nfRqRoute() {
        try {
            var h = location.hash || '';
            var q = h.indexOf('?');
            if ((q < 0 ? h : h.slice(0, q)).toLowerCase() !== '#/search') return null;
            var s = q < 0 ? '' : h.slice(q);
            if (/[?&]nfview=/i.test(s)) return /[?&]nfview=requests(&|$)/i.test(s) ? 'page' : null;
            return /[?&]query=[^&]/.test(s) ? 'search' : null;
        } catch (e) { return null; }
    }

    // To the Requests page, through jellyfin's router: it pushes with the router's own
    // history state. The hash is the fallback. appRouter.show skips a push only when
    // the PATHNAME equals what it is given, and '/search?nfview=requests' never equals
    // '/search': a second click on the page itself pushed the same URL again (measured),
    // and Back then went nowhere. So on the page a click does nothing.
    function nfRqGo() {
        try {
            if (nfRqRoute() === 'page') return;
            // The page's view class goes on at the click, before jellyfin renders its search
            // page: its search field takes the focus as it mounts (React's autoFocus), and on
            // a phone a focus inside a tap's activation opens the keyboard - for a field this
            // page hides. Already hidden, it takes no focus (measured on the drawer and the bar
            // entry). The next pass corrects the class if the navigation does not happen - and
            // one is asked for a second from now: a show() that never pushes leaves a page
            // that changes nothing, where no pass would come, and the class would hide
            // jellyfin's search page for good. Where the page is right, that pass writes nothing.
            if (nfRqLive()) {
                document.documentElement.classList.add('nf-rq-view');
                setTimeout(function () { try { applyDynamic(); } catch (e) {} }, 1000);
            }
            var pg = window.Emby && window.Emby.Page;
            if (pg && typeof pg.show === 'function') {
                var p = pg.show(NF_RQ_PAGE);
                if (p && typeof p.then === 'function') p.then(null, nfRqGoHash);
                return;
            }
        } catch (e) {}
        nfRqGoHash();
    }
    function nfRqGoHash() {
        try { if (nfRqRoute() !== 'page') location.hash = NF_RQ_HREF; } catch (e) {}
    }

    // One listener for every entry, wherever it sits. In the bubble phase, after React's
    // own (on its root and on the drawer's portal): the Modern drawer closes through its
    // onClick on the content box and the legacy drawer through libraryMenu's handler on
    // any <a>, so the event must go on. Only the browser's own navigation is taken. A
    // click with a modifier stays the browser's (a new tab or window, as on any link),
    // and so does one somebody else has already taken: React Router's Link does the same.
    var nfRqWired = false;
    function nfRqWire() {
        if (nfRqWired) return;
        nfRqWired = true;
        document.addEventListener('click', function (e) {
            try {
                var t = e.target;
                var a = t && t.closest ? t.closest('.nf-nav-req') : null;
                if (!a || e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                nfRqGo();
            } catch (err) {}
        });
    }

    // aria-current, written only when it changes.
    function nfRqCurrent(el, on) {
        if (on) { if (el.getAttribute('aria-current') !== 'page') el.setAttribute('aria-current', 'page'); }
        else if (el.hasAttribute('aria-current')) el.removeAttribute('aria-current');
    }

    // The entries, once per pass (applyDynamic, after setupNavTabs). It writes NOTHING
    // when all is in place: no node is moved that already sits right, and no class is
    // written that is already there. Each such write would wake the body observer for
    // another pass, or at least restyle. Only the theme's own nodes are ever inserted or
    // moved; React's are only read. The legacy strip's tab is renderNavTabs' own.
    var nfRqNavUp = false;   // an entry may be on the page, so it is looked for to come out
    function setupSeerrNav() {
        try {
            var live = nfRqLive();
            var root = document.documentElement;
            if (root.classList.contains('nf-rq-on') !== live) root.classList.toggle('nf-rq-on', live);
            // Most servers have no bridge: one call to nfRqLive and out.
            if (!live && !nfRqNavUp) return;
            var active = live && nfRqRoute() === 'page';
            if (live) nfRqWire();
            nfRqBarEntry(live, active);
            nfRqDrawerEntry(live, active);
            nfRqMenuEntry(live, active);
            // A builder whose container is missing on this pass (no toolbar on the
            // dashboard: nfModernToolbar) cannot take its entry out, so the clean-up goes
            // on until nothing of the entries is left.
            nfRqNavUp = live || !!document.querySelector('.nf-nav-req') || root.classList.contains('nf-nav-snug');
        } catch (e) {}
    }

    // Modern bar (900 px and up): a foreign <a> in UserViewNav's Stack, in the classes of
    // React's Favorites button with the "current" pair (MuiButton-*Primary) turned to
    // Inherit, so the nav-voice rules style it as one of theirs (setupModernHome's
    // technique). Its "current" state is seerr.css's. It goes at the END of the group,
    // where Netflix keeps "New & Popular": after the libraries, and before React's
    // "More" button when there is one (below 1200 px UserViewNav shows 3 views, and
    // moves the rest into "More" once there are more than 4). React places what it adds
    // against its own nodes only: a view that appears later is appended after this entry
    // when there is no "More", and put before "More" when there is. So the place is
    // checked on every pass, and the node moved only when it is wrong.
    // Mui-focusVisible is Favorites' own keyboard state, not to be copied.
    // How much of the entry shows depends on the bar's room (the section below). Its glyph
    // is in it from the start: seerr.css takes it out (display: none) outside the glyph
    // step and shows it in that step, so a change of step never adds or removes a node,
    // it only changes classes, which the body observer does not see. Its zero width and
    // height attributes keep it at 0x0 wherever no rule of that sheet reaches it, and the
    // entry is then its word alone. (The hidden attribute would not do: the user agent's
    // [hidden] rule reaches HTML elements only, not an inline svg.)
    function nfRqBarEntry(live, active) {
        try {
            var tb = nfModernToolbar();
            var own = tb ? tb.querySelector('a.nf-nav-req') : null;
            var fav = live && tb ? tb.querySelector('a.MuiButton-sizeMedium[href*="home?tab=1"]') : null;
            if (!fav) {
                if (own && own.parentNode) own.parentNode.removeChild(own);
                nfRqBarOff();
                return;
            }
            var stack = fav.parentNode;
            var more = stack.querySelector('[aria-controls="user-view-overflow-menu"]');
            if (more && more.parentNode !== stack) more = null;
            if (!own) {
                own = document.createElement('a');
                own.setAttribute('href', NF_RQ_HREF);
                own.innerHTML = '<svg class="nf-nav-req-icon" viewBox="0 0 24 24" width="0" height="0" aria-hidden="true" focusable="false"><path d="'
                    + NF_RQ_ICON + '"></path></svg><span class="nf-nav-req-word"></span>';
            }
            var word = own.lastChild;
            var label = nfL().requests;
            if (word && word.textContent !== label) word.textContent = label;
            if (own.parentNode !== stack || own.nextElementSibling !== more) stack.insertBefore(own, more);
            nfRqBarApply(own, fav, active, nfRqBarStep);
            var key = nfRqBarKeyOf(tb, stack);
            if (key !== nfRqBarKey) {
                nfRqBarStep = nfRqBarDecide(tb, stack, own, fav, active);
                nfRqBarKey = key;
            }
            nfRqBarName(own, nfRqBarStep === 2 ? label : null);
            nfRqCurrent(own, active);
        } catch (e) {}
    }

    // ---- The bar entry's room ----
    // Below 1200 px MUI lets the app toolbar wrap, and from 1200 px the nav voice's
    // min-width: 0 (netflix.css) lets its words squeeze instead. The rig's five views
    // leave 51 px or more beside the entry at every width, but three ordinary German
    // library names (Dokumentationen, Kinderfilme, Konzertfilme) wrap the bar at 900 and
    // 950 px with the entry and not without it (measured in review). So the entry takes
    // only the room there is, and steps down only as far as it must:
    //   0  its word at the stock gaps: wherever it fits - the rig's names at every width,
    //      today's look, nothing written;
    //   1  html.nf-nav-snug: every word in the bar 10 px apart instead of 18 (seerr.css);
    //   2  that, and only the entry's glyph: the drawer's playlist_add at the bar's 22 px
    //      icon size, with the word kept in the DOM, hidden, and its name on aria-label
    //      and title.
    // When even step 2 does not fit, the bar was full without the entry, and jellyfin's
    // own layout stands (a second row below 1200 px, squeezed words from there up): the
    // entry stays at its smallest and nothing else is done about it.
    // The step is found by trying them in order, with synchronous layout reads, and only
    // when what it depends on has changed (nfRqBarKeyOf). Every other pass builds that
    // key from the DOM without a layout read, finds it unchanged, and writes nothing. A
    // try writes classes only, never a node; the user never sees one, because no frame
    // is painted while the task runs.
    var nfRqBarStep = 0;
    var nfRqBarKey = null;
    // The width a root scrollbar takes on this device: 0 for overlay scrollbars, -1 until
    // one has been seen. The theme draws a 10 px one (::-webkit-scrollbar), and where
    // scrollbars are classic it takes that width from the bar when the page grows long
    // enough to scroll, with no resize to say so. So a step chosen while the page cannot
    // scroll keeps that much room free, and the bar does not wrap when the page grows.
    var nfRqSbW = -1;

    function nfRqBarOff() {
        nfRqBarStep = 0;
        nfRqBarKey = null;
        var root = document.documentElement;
        if (root.classList.contains('nf-nav-snug')) root.classList.remove('nf-nav-snug');
    }

    // The classes of a step, written only where they differ.
    function nfRqBarApply(own, fav, active, step) {
        var cls = fav.className.replace(/MuiButton-(color|text)Primary/g, 'MuiButton-$1Inherit').replace(/\s*\bMui-focusVisible\b/g, '')
            + ' nf-nav-req' + (step === 2 ? ' nf-nav-req-glyph' : '') + (active ? ' nf-nav-active' : '');
        if (own.className !== cls) own.className = cls;
        var root = document.documentElement;
        if (root.classList.contains('nf-nav-snug') !== (step > 0)) root.classList.toggle('nf-nav-snug', step > 0);
    }

    // What the step depends on. The width; the layout epoch, which nfRelayout moves when
    // a resize settles or a webfont arrives; the toolbar's node count (a cast or SyncPlay
    // button coming or going); and the bar's words and which of them is current, since
    // the current one is set at the medium weight, which is wider. No layout read.
    function nfRqBarKeyOf(tb, stack) {
        var k = window.innerWidth + '|' + nfLayoutEpoch + '|' + tb.getElementsByTagName('*').length;
        for (var c = stack.firstElementChild; c; c = c.nextElementSibling) {
            k += '|' + (/Primary|nf-nav-active/.test(c.className) ? '*' : '') + c.textContent;
        }
        return k;
    }

    // The room to keep free for a root scrollbar that is not there yet.
    function nfRqBarReserve() {
        try {
            var de = document.documentElement;
            var sb = window.innerWidth - de.clientWidth;
            if (sb > 0) { nfRqSbW = sb; return 0; }
            // The page scrolls, and no scrollbar takes room: they are overlay ones here.
            if (de.scrollHeight > window.innerHeight + 1 && getComputedStyle(de).overflowY !== 'hidden'
                && getComputedStyle(document.body).overflowY !== 'hidden') { nfRqSbW = 0; return 0; }
            return nfRqSbW < 0 ? 10 : nfRqSbW;
        } catch (e) { return 0; }
    }

    // Does the bar hold all of it? One row at the toolbar's own height (a second row, or
    // a name broken onto two lines, makes it taller), no nav word squeezed below its width
    // (the words only: the mark is a logo the brand restyles, and its height is checked
    // above), and the free room the step must keep: the toolbar's flex-grow box after the
    // nav holds the slack, its buttons packed at its far end.
    function nfRqBarFits(tb, stack, minH, reserve) {
        if (tb.offsetHeight > minH + 1) return false;
        for (var c = stack.firstElementChild; c; c = c.nextElementSibling) {
            if (c.tagName === 'A' && c.classList.contains('MuiButton-sizeMedium') && c.scrollWidth > c.clientWidth + 1) return false;
        }
        var box = stack.nextElementSibling;
        if (!reserve || !box) return true;
        var lo = Infinity, hi = -Infinity;
        for (var k = box.firstElementChild; k; k = k.nextElementSibling) {
            var r = k.getBoundingClientRect();
            if (!r.width) continue;
            if (r.left < lo) lo = r.left;
            if (r.right > hi) hi = r.right;
        }
        return box.getBoundingClientRect().width - (hi > lo ? hi - lo : 0) >= reserve;
    }

    function nfRqBarDecide(tb, stack, own, fav, active) {
        var minH = parseFloat(getComputedStyle(tb).minHeight) || 48;
        var reserve = nfRqBarReserve();
        for (var s = 0; s < 2; s++) {
            nfRqBarApply(own, fav, active, s);
            if (nfRqBarFits(tb, stack, minH, reserve)) return s;
        }
        nfRqBarApply(own, fav, active, 2);
        return 2;
    }

    // The glyph's name, for those who do not see its word: aria-label, and title for a
    // pointer. The other steps show the word and carry neither.
    function nfRqBarName(own, name) {
        if (name) {
            if (own.getAttribute('aria-label') !== name) own.setAttribute('aria-label', name);
            if (own.getAttribute('title') !== name) own.setAttribute('title', name);
        } else {
            if (own.hasAttribute('aria-label')) own.removeAttribute('aria-label');
            if (own.hasAttribute('title')) own.removeAttribute('title');
        }
    }

    // Modern drawer (below 900 px): a copy of the Favorites row, right after it in the
    // first list, which React fills once and never adds to: the same MUI classes, and
    // Favorites' own SVG with this icon's path drawn in it. The copy has no React fiber,
    // so React takes a click on it for a click on the list, and the drawer's onClick
    // closes the drawer. Mui-selected, which React sets on its own rows, is set here.
    // React unmounts the drawer and mounts a new one when the window crosses 900 px (and
    // on /video), so the row is looked for in the drawer of the moment, every pass. A
    // copied ripple layer goes: the copy has no ripple of its own.
    function nfRqDrawerEntry(live, active) {
        try {
            var paper = document.querySelector('.MuiDrawer-paper');
            if (!paper) return;
            var own = paper.querySelector('a.nf-nav-req');
            var row = own ? own.parentNode : null;
            var favA = live ? paper.querySelector('a[href="#/home?tab=1"]') : null;
            var favRow = favA ? favA.parentNode : null;
            if (!favRow || favRow.tagName !== 'LI' || !favRow.parentNode) {
                if (row && row.parentNode) row.parentNode.removeChild(row);
                return;
            }
            if (!own) {
                row = favRow.cloneNode(true);
                own = row.querySelector('a');
                if (!own) return;
                own.className = own.className.replace(/\s*\bMui-(selected|focusVisible)\b/g, '') + ' nf-nav-req';
                own.setAttribute('href', NF_RQ_HREF);
                var path = own.querySelector('svg path');
                if (path) path.setAttribute('d', NF_RQ_ICON);
                var svg = own.querySelector('svg');
                if (svg) svg.setAttribute('data-testid', 'PlaylistAddIcon');
                var ripple = own.querySelector('.MuiTouchRipple-root');
                if (ripple) ripple.parentNode.removeChild(ripple);
            }
            var txt = own.querySelector('.MuiListItemText-primary');
            var label = nfL().requests;
            if (txt && txt.textContent !== label) txt.textContent = label;
            if (row.parentNode !== favRow.parentNode || row.previousElementSibling !== favRow) favRow.parentNode.insertBefore(row, favRow.nextSibling);
            if (own.classList.contains('Mui-selected') !== active) own.classList.toggle('Mui-selected', active);
            nfRqCurrent(own, active);
        } catch (e) {}
    }

    // Legacy drawer: right after the Home link, OUTSIDE the boxes libraryMenu fills (it
    // replaces .libraryMenuOptions' innerHTML and appends into .customMenuOptions), and
    // without lnkMediaFolder: on every page show libraryMenu takes navMenuOption-selected
    // off each .lnkMediaFolder. It rewrites the whole container after each sign-in, and
    // the next pass puts the link back. A plain <a>, not an emby-linkbutton: that
    // element's own click handler would navigate a second time. It carries the
    // emby-button class, which is only a stylesheet hook (jellyfin's React links use it
    // the same way): without it the row measured 51 px against the Home row's 47, with
    // a bigger glyph. With it the two rows compute alike.
    function nfRqMenuEntry(live, active) {
        try {
            var box = document.querySelector('.mainDrawer-scrollContainer');
            if (!box) return;
            var own = box.querySelector('a.nf-nav-req');
            var home = null;
            if (live) {
                for (var c = box.firstElementChild; c; c = c.nextElementSibling) {
                    if (c.tagName === 'A' && c.classList.contains('lnkMediaFolder') && c.getAttribute('href') === '#/home') { home = c; break; }
                }
            }
            if (!home) { if (own && own.parentNode) own.parentNode.removeChild(own); return; }
            if (!own) {
                own = document.createElement('a');
                own.className = 'navMenuOption emby-button nf-nav-req';
                own.setAttribute('href', NF_RQ_HREF);
                own.innerHTML = '<span class="material-icons navMenuOptionIcon playlist_add" aria-hidden="true"></span><span class="navMenuOptionText"></span>';
            }
            var txt = own.lastChild;
            var label = nfL().requests;
            if (txt && txt.textContent !== label) txt.textContent = label;
            if (own.parentNode !== box || own.previousElementSibling !== home) box.insertBefore(own, home.nextSibling);
            if (own.classList.contains('navMenuOption-selected') !== active) own.classList.toggle('navMenuOption-selected', active);
            nfRqCurrent(own, active);
        } catch (e) {}
    }

    // ---- The Requests page: #/search?nfview=requests ----
    // jellyfin's search page stays mounted underneath it: React renders its search field
    // and one conditional child (the suggestions, or results) as ever. While
    // html.nf-rq-view is set the sheet hides them, and the page is one theme node, div.nf-rq,
    // kept as the LAST child of #searchPage. React appends what it mounts at the end and
    // never looks at a node it did not make, so the box is put back behind a child React
    // has just added after it, and is not touched otherwise:
    //   div.nf-rq
    //     div.nf-rq-head    the page's name and its own search field, over the billboard
    //     div.nf-rq-hero    today's first trending title with a backdrop
    //     div.nf-rq-rows    five rows, in the home rows' own shell, ladder and tiles
    var NF_RQ_ROWS = [['trending', 'rowTrending'], ['movies', 'rowMovies'], ['tv', 'rowTv'],
        ['upcoming-movies', 'rowUpMovies'], ['upcoming-tv', 'rowUpTv']];
    // Each row is drawn from a copy of its own, held for ten minutes: Seerr's trending list is
    // a daily one, its popular lists change slowly, and a title's own window shows its state
    // fresh. An older copy, up to an hour, is still drawn at once, and a new one is fetched for
    // the next visit (stale-while-revalidate).
    var NF_RQ_ROWS_TTL = 10 * 60 * 1000;
    var NF_RQ_ROWS_MAX = 60 * 60 * 1000;
    var NF_RQ_ROWS_PART = 'rq:rows:';
    // A Discover call with no answer after 15 s counts as failed: ApiClient has no timeout of its
    // own and the bridge waits up to 30 s for Seerr, and neither the page nor a later visit may
    // hang on it. A row that has answered waits up to 2 s for a slower one before it, so the
    // rows keep their order and their dedupe; after that it is drawn, and the slow one goes into
    // its own place when it comes.
    var NF_RQ_ROW_WAIT = 15000;
    var NF_RQ_ROW_GRACE = 2000;
    // TMDB's vote average means nothing on a handful of votes - a title out next month has 0
    // of 0, which would read "0 % match" - so the match is shown from 50 votes up.
    var NF_RQ_MIN_VOTES = 50;

    // Every title the page has drawn, as ONE model per key, for the user it was fetched for.
    // The page is rebuilt from these objects, so a state changed on one (a request) is what
    // the next build shows, in every row that holds the title. A newer copy of a title is
    // written into the object already held, not put beside it.
    var nfRqKnown = { uid: null, by: {} };
    function nfRqKeep(m, uid) {
        if (nfRqKnown.uid !== uid) { nfRqKnown.uid = uid; nfRqKnown.by = {}; }
        var had = Object.prototype.hasOwnProperty.call(nfRqKnown.by, m.key) ? nfRqKnown.by[m.key] : null;
        if (!had) { nfRqKnown.by[m.key] = m; return m; }
        if (had !== m) {
            for (var k in m) { if (Object.prototype.hasOwnProperty.call(m, k)) had[k] = m[k]; }
        }
        return had;
    }
    function nfRqFind(key) {
        try {
            var uid = ApiClient.getCurrentUserId();
            return (uid && nfRqKnown.uid === uid && Object.prototype.hasOwnProperty.call(nfRqKnown.by, key)) ? nfRqKnown.by[key] : null;
        } catch (e) { return null; }
    }
    // A model as this build's nfRqModel writes it, in the fields the page puts into markup and
    // links. A model read back from sessionStorage may have been written by another build (or
    // by anything else on this origin), so each one is checked before it is drawn.
    function nfRqShapeOk(m) {
        // The id is what a request sends (mediaId): it must be the key's, or the window would ask for another title.
        return !!m && typeof m === 'object' && typeof m.key === 'string' && /^(movie|tv):[1-9][0-9]*$/.test(m.key)
            && m.key.indexOf(m.mt + ':') === 0 && typeof m.id === 'number' && m.id === parseInt(m.key.slice(m.key.indexOf(':') + 1), 10)
            && typeof m.title === 'string'
            && (m.year === null || (typeof m.year === 'number' && Math.floor(m.year) === m.year))
            && typeof m.status === 'number' && m.status >= 1 && m.status <= 7 && m.status !== 6 && Math.floor(m.status) === m.status
            && (m.jf === null || (typeof m.jf === 'string' && /^[0-9a-f]{32}$/.test(m.jf)))
            && typeof m.poster === 'string' && (m.poster === '' || NF_RQ_PATH.test(m.poster))
            && typeof m.backdrop === 'string' && (m.backdrop === '' || NF_RQ_PATH.test(m.backdrop));
    }
    // One list with every title in it replaced by the one held model.
    function nfRqCanonList(uid, list) {
        return (Array.isArray(list) ? list : []).filter(nfRqShapeOk).map(function (m) { return nfRqKeep(m, uid); });
    }

    // One row's models for this user as Discover gave them, or null: the copy in memory, else
    // the one this tab kept in sessionStorage (a reload). fresh: young enough not to be fetched
    // again.
    var nfRqRowsHeld = { uid: null, rows: {} };   // rows: key -> {ts, list}
    function nfRqRowHeld(uid, key) {
        var h = nfRqRowsHeld;
        if (h.uid !== uid) { h.uid = uid; h.rows = {}; }
        var rec = Object.prototype.hasOwnProperty.call(h.rows, key) ? h.rows[key] : null;
        if (!rec) {
            try {
                var raw = JSON.parse(sessionStorage.getItem(nfCacheKey(NF_RQ_ROWS_PART + key, uid)) || 'null');
                if (raw && typeof raw.ts === 'number' && Array.isArray(raw.v)) { rec = { ts: raw.ts, list: nfRqCanonList(uid, raw.v) }; h.rows[key] = rec; }
            } catch (e) {}
        }
        var age = rec ? Date.now() - rec.ts : -1;
        if (age < 0 || age > NF_RQ_ROWS_MAX) return null;
        return { list: rec.list, fresh: age <= NF_RQ_ROWS_TTL };
    }
    function nfRqRowKeep(uid, key, results) {
        var list = nfRqCanonList(uid, results.map(nfRqModel));
        if (nfRqRowsHeld.uid !== uid) { nfRqRowsHeld.uid = uid; nfRqRowsHeld.rows = {}; }
        nfRqRowsHeld.rows[key] = { ts: Date.now(), list: list };
        nfCacheSet(NF_RQ_ROWS_PART + key, list, uid);
        return list;
    }

    // One Discover row, page 1: its list, or null when it failed or took longer than 15 s. It
    // never rejects, and one call per user and row is in flight at a time - but never longer
    // than that: after the 15 s it is forgotten, so the next visit asks again. An answer that
    // comes in after them is still kept for that visit; one for a user who has gone is dropped.
    var nfRqRowAsking = {};   // uid + ':' + key -> the Promise in flight
    function nfRqRowLoad(uid, key) {
        var k = uid + ':' + key;
        if (Object.prototype.hasOwnProperty.call(nfRqRowAsking, k)) return nfRqRowAsking[k];
        var p = new Promise(function (resolve) {
            var over = false;
            var timer = null;
            var end = function (v) {
                if (over) return;
                over = true;
                clearTimeout(timer);
                if (nfRqRowAsking[k] === p) delete nfRqRowAsking[k];
                resolve(v);
            };
            timer = setTimeout(function () { end(null); }, NF_RQ_ROW_WAIT);
            nfRqGet('Discover/' + key, { page: 1 }).then(function (d) {
                var list = null;
                try {
                    if ((ApiClient.getCurrentUserId() || '') === uid) list = nfRqRowKeep(uid, key, (d && Array.isArray(d.results)) ? d.results : []);
                } catch (e) {}
                end(list);
            }, function () { end(null); });
        });
        nfRqRowAsking[k] = p;
        return p;
    }

    // What the page shows of the lists, decided one list at a time, so the rows can be drawn as
    // they arrive. The billboard is the first trending title with a backdrop, and it counts as
    // row 1's: no row repeats it. Then the rows in their order, each title in the first row that
    // has it, a tile only with the art its shape shows (the poster for portrait cards, the
    // backdrop otherwise), and a row only with three tiles or more - like the home rails, a row
    // that falls short gives its titles back to the rows after it.
    function nfRqPlan() {
        return { seen: {}, portrait: cfg('CardStyle', 'mixed') === 'portrait' };
    }
    function nfRqPlanHero(plan, trend) {
        for (var i = 0; trend && i < trend.length; i++) {
            var m = trend[i];
            if (m && m.backdrop && !plan.seen[m.key]) { plan.seen[m.key] = true; return m; }
        }
        return null;
    }
    function nfRqPlanRow(plan, i, list) {
        var local = {};
        var items = (list || []).filter(function (m) {
            if (!m || plan.seen[m.key] || local[m.key] || !(plan.portrait ? m.poster : m.backdrop)) return false;
            local[m.key] = true;
            return true;
        });
        if (items.length < RAIL_MIN_ITEMS) return null;
        Object.keys(local).forEach(function (k) { plan.seen[k] = true; });
        return { key: NF_RQ_ROWS[i][0], title: nfL()[NF_RQ_ROWS[i][1]], items: items };
    }
    // The whole rule at once: {hero, rows: [{key, title, items}]} for the five lists.
    function nfRqRows(data) {
        var out = { hero: null, rows: [] };
        try {
            var plan = nfRqPlan();
            out.hero = nfRqPlanHero(plan, data && data.trending);
            NF_RQ_ROWS.forEach(function (r, i) {
                var row = nfRqPlanRow(plan, i, data && data[r[0]]);
                if (row) out.rows.push(row);
            });
        } catch (e) {}
        return out;
    }

    // One tile: buildCardHtml's skeleton, so the row CSS sizes, zooms and captions it as a
    // library tile. No data-id and no link: the library popup, the tablet first-tap card and
    // the image rescue all key on what a Seerr title does not have. The picture is a focusable
    // role=button; a click or Enter/Space on it is nfRqActivate's. A textless TMDB backdrop
    // takes its title in type (.nf-card-name); a poster carries its own. The state tab sits
    // where "Recently Added" does, for every state but "can be requested" - none when quiet -
    // and comes before the name, which the sheet then lifts clear of it.
    // The rows list only titles with the art their shape shows; a search finds many without
    // (TMDB has no backdrop for about half of them). Such a tile takes the other picture, cropped,
    // as home's tiles take a poster, and with none at all the theme's no-image state (.nf-noimg:
    // an initial on a quiet surface). The name is set in type on every tile but one showing its
    // own poster.
    function nfRqCardHtml(m, sid, quiet) {
        var portrait = cfg('CardStyle', 'mixed') === 'portrait';
        var own = nfRqTileArt(m, portrait);
        var img = own || nfRqTileArt(m, !portrait);
        var st = nfRqState(m);
        var l = nfL();
        var tab = (quiet || st === 'request') ? ''
            : '<span class="nf-rq-state" data-state="' + st + '">' + (st === 'partial' ? l.partialTab : l[st]) + '</span>';
        var title = esc(m.title);
        return '<div class="card overflowBackdropCard card-hoverable nf-card nf-rq-card" data-nf-rq="' + esc(m.key) + '" data-type="' + (m.mt === 'tv' ? 'Series' : 'Movie') + '">' +
            '<div class="cardBox cardBox-bottompadded">' +
              '<div class="cardScalable">' +
                '<div class="cardPadder cardPadder-overflowBackdrop"></div>' +
                '<div class="cardImageContainer cardContent nf-rq-open focusable' + (img ? '' : ' nf-noimg') + '" role="button" tabindex="0" aria-label="' + title + '"'
                    + (img ? ' data-nf-bg="' + esc(img) + '"' : ' data-nf-initial="' + esc((m.title.charAt(0) || '?').toUpperCase()) + '"') + '></div>' +
                tab + (portrait && own ? '' : '<div class="nf-card-name">' + title + '</div>') +
              '</div>' +
              '<div class="cardText cardTextCentered cardText-first"><bdi>' + title + '</bdi></div>' +
            '</div>' +
          '</div>';
    }

    // A tile's TMDB art in the spec's sizes (§6.4): a poster at w342, w500 or w780 by the tile's
    // width at the device's density, never smaller (a 160 px tile would otherwise take w185, and
    // the hover zoom shows it), and a backdrop at w780.
    function nfRqTileArt(m, portrait) {
        var path = portrait ? m.poster : m.backdrop;
        if (typeof path !== 'string' || !NF_RQ_PATH.test(path)) return '';
        var size = 'w780';
        if (portrait) {
            var want = nfTileCssWidth() * Math.min(window.devicePixelRatio || 1, 2);
            size = want <= 342 ? 'w342' : (want <= 500 ? 'w500' : 'w780');
        }
        return 'https://image.tmdb.org/t/p/' + size + path;
    }

    // The billboard: home's slide, scrims, copy and buttons on a box of its own (setupHero
    // takes every .nf-hero off the page that is not home). One title, no rotation and no clip.
    // TMDB's w1280 backdrop: 'original' can be a 4K file of several MB. It is loaded the tiles'
    // way (data-nf-bg, nfLazyImages: decoded by an Image first, then painted from the cache),
    // so the request carries no Referer - jellyfin-web's no-referrer policy keeps the server's
    // address from TMDB. The action follows the title's state: "Anfragen" (the accent) for a
    // title that can be requested, and for a series with seasons left to request (a film in
    // one click, a series through its window: wired where the window is built, as is "Mehr
    // Infos"); ▶ for a title this profile can open in the library (nfRqCanPlay); a state that
    // cannot be acted on is an inert chip.
    function nfRqHeroHtml(m) {
        var l = nfL();
        var bg = (typeof m.backdrop === 'string' && NF_RQ_PATH.test(m.backdrop)) ? 'https://image.tmdb.org/t/p/w1280' + m.backdrop : '';
        var act = nfRqHeroAct(m, false);
        var meta = (m.votes >= NF_RQ_MIN_VOTES ? matchHtml(m.vote, 'nf-hero-match') : '') +
            (m.year ? '<span>' + esc(m.year) + '</span>' : '') +
            '<span>' + (m.mt === 'tv' ? l.series : l.movie) + '</span>';
        return '<div class="nf-rq-hero" data-nf-rq="' + esc(m.key) + '">' +
            '<div class="nf-hero-slide active">' +
              '<div class="nf-hero-bg"' + (bg ? ' data-nf-bg="' + esc(bg) + '"' : '') + '></div>' +
              '<div class="nf-hero-content">' +
                '<div class="nf-hero-title">' + esc(m.title) + '</div>' +
                '<div class="nf-hero-meta">' + meta + '</div>' +
                (m.overview ? '<div class="nf-hero-overview">' + esc(m.overview) + '</div>' : '') +
                '<div class="nf-hero-actions">' + act +
                  '<button type="button" class="nf-hero-btn nf-hero-info nf-rq-more"><span class="material-icons" aria-hidden="true">info</span> ' + l.moreInfo + '</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
    }
    // The billboard's action for the title's state; drawn again in place when the state changes (nfRqRefreshTiles). While
    // a request for it is out (busy) the request button says so and takes no second press; while requests cannot be
    // sent (design 6.2: switched off at the bridge) it is drawn off, as the window draws its own.
    function nfRqHeroAct(m, busy) {
        var l = nfL();
        var st = nfRqState(m);
        if (st === 'request' || st === 'partial') {
            return '<button type="button" class="nf-hero-btn nf-rq-req' + (busy ? ' nf-rq-busy' : '') + '"' + (busy || !nfRqSubmitOk() ? ' aria-disabled="true"' : '') + '>'
                + '<span class="material-icons" aria-hidden="true">file_download</span> ' + (busy ? l.requesting : l.request) + '</button>';
        }
        // The answer is for the id the model has now: the one that goes into the link.
        if (st === 'available' && nfRqPlayKnown(m) === true) return nfRqHeroPlayHtml(m.jf);
        return '<span class="nf-hero-btn nf-rq-done" data-state="' + st + '" aria-disabled="true"><span class="material-icons" aria-hidden="true">check</span> ' + l[st] + '</span>';
    }
    // ▶ into the library: the nf-autoplay flow (the init click capture flags it, the details
    // page's own Play is pressed), as on home's billboard. jf is the id nfRqCanPlay verified.
    function nfRqHeroPlayHtml(jf) {
        var sid = (ApiClient.serverId && ApiClient.serverId()) || '';
        return '<a class="nf-hero-btn nf-hero-play nf-autoplay" data-id="' + esc(jf) + '" href="#/details?id=' + esc(jf) + (sid ? '&serverId=' + esc(sid) : '') + '">' +
            '<span class="material-icons" aria-hidden="true">play_arrow</span> ' + nfL().play + '</a>';
    }
    // A title the library has gets ▶ in place of its chip once Jellyfin says this profile may
    // open it - an upgrade, never a play button that comes and goes. Only for the id that was
    // checked: a newer copy of the title can land meanwhile and change it, or its state.
    // (No ambient glow from the billboard: sampling TMDB's art takes a CORS read, which sends
    // TMDB the server's address as Origin; applyDynamic clears the glow on this page instead.)
    function nfRqHeroLater(hero, m) {
        if (nfRqState(m) !== 'available' || !m.jf || nfRqPlayKnown(m) !== undefined) return;
        var jf = m.jf;
        nfRqCanPlay(m).then(function (ok) {
            if (!ok || m.jf !== jf || nfRqState(m) !== 'available' || !hero.isConnected) return;
            var chip = hero.querySelector('.nf-rq-done');
            if (!chip) return;
            var t = document.createElement('div');
            t.innerHTML = nfRqHeroPlayHtml(jf);
            chip.parentNode.replaceChild(t.firstChild, chip);
        }, function () {});
    }

    // May this profile open the title Seerr says the library holds? jellyfinMediaId can be
    // stale (a rescan) or an item this profile is not shown (library access, parental tags):
    // ▶ only for an item Jellyfin hands this user. Asked once per user and item when first
    // needed - a tile's on its first click - and the answer, yes or no, kept for the page's life.
    var nfRqPlayHeld = {};   // uid + ':' + jf -> true | false | the Promise in flight
    function nfRqCanPlay(m) {
        try {
            var uid = ApiClient.getCurrentUserId();
            // The id goes into a link and data-id: the model checked it, and a model can come
            // back from sessionStorage, so it is checked again here, where ▶ is decided.
            if (!m || typeof m.jf !== 'string' || !/^[0-9a-f]{32}$/.test(m.jf) || !uid) return Promise.resolve(false);
            var k = uid + ':' + m.jf;
            var held = Object.prototype.hasOwnProperty.call(nfRqPlayHeld, k) ? nfRqPlayHeld[k] : null;
            if (held === true || held === false) return Promise.resolve(held);
            if (held) return held;
            var jf = m.jf;
            var p = ApiClient.getItem(uid, jf).then(function (it) {
                return !!(it && typeof it.Id === 'string' && it.Id.replace(/-/g, '').toLowerCase() === jf);
            }, function () { return false; }).then(function (ok) {
                nfRqPlayHeld[k] = ok;
                return ok;
            });
            nfRqPlayHeld[k] = p;
            return p;
        } catch (e) { return Promise.resolve(false); }
    }
    // The answer once it is in: true or false; undefined while it is not.
    function nfRqPlayKnown(m) {
        try {
            var v = nfRqPlayHeld[ApiClient.getCurrentUserId() + ':' + m.jf];
            return (v === true || v === false) ? v : undefined;
        } catch (e) { return undefined; }
    }

    // A tile's picture, clicked or pressed: a title this profile can open in the library
    // goes to its page there; any other opens its window (nfRqOpen). One activation at a time,
    // so a double click cannot push the details page twice.
    function nfRqActivate(el) {
        var card = el.closest('[data-nf-rq]');
        var m = card ? nfRqFind(card.getAttribute('data-nf-rq')) : null;
        if (!m || el._nfRqBusy) return;
        if (nfRqState(m) !== 'available' || !m.jf) { nfRqOpen(m); return; }
        el._nfRqBusy = true;
        // The id that is checked is the one navigated to: a newer copy of the title can land
        // while the check is out and change it, or the title's state.
        var jf = m.jf;
        nfRqCanPlay(m).then(function (ok) {
            if (!ok || m.jf !== jf || nfRqState(m) !== 'available') {
                el._nfRqBusy = false;
                if (el.isConnected) nfRqOpen(m);
                return;
            }
            // The page is on its way out; busy a moment longer in case it is not.
            setTimeout(function () { el._nfRqBusy = false; }, 1500);
            if (el.isConnected) nfRqShow('/details?id=' + jf + '&serverId=' + ApiClient.serverId());
        }, function () { el._nfRqBusy = false; });
    }
    // Through jellyfin's router (a push with its own history state); the hash is the fallback.
    function nfRqShow(path) {
        var hash = function () { try { if (location.hash !== '#' + path) location.hash = '#' + path; } catch (e) {} };
        try {
            var pg = window.Emby && window.Emby.Page;
            if (pg && typeof pg.show === 'function') {
                var p = pg.show(path);
                if (p && typeof p.then === 'function') p.then(null, hash);
                return;
            }
        } catch (e) {}
        hash();
    }
    // The billboard's two buttons (design Q2, Ruling R2): "Anfragen" asks for a film in one
    // click and opens a series' window, where its seasons are chosen (and a title that is
    // partly there, which only a series is); "Mehr Infos" opens the window.
    function nfRqHeroPress(b) {
        var hero = b.closest('.nf-rq-hero');
        var m = hero ? nfRqFind(hero.getAttribute('data-nf-rq')) : null;
        if (!m || b.getAttribute('aria-disabled') === 'true') return;
        if (b.classList.contains('nf-rq-req') && m.mt === 'movie' && nfRqState(m) === 'request') nfRqRequest(m, null);
        else nfRqOpen(m);
    }
    // One click and one keydown listener for every tile, wherever one sits (bubble phase:
    // nothing of jellyfin's is in the way of a tile without data-id), and for the billboard's
    // buttons. The picture is a div, so Enter and Space are the button's keys here: on a TV
    // remote OK is Enter, and Space would scroll the page.
    var nfRqTilesWired = false;
    function nfRqTilesWire() {
        if (nfRqTilesWired) return;
        nfRqTilesWired = true;
        document.addEventListener('click', function (e) {
            try {
                var t = e.target;
                if (!t || !t.closest || e.defaultPrevented || e.button) return;
                var el = t.closest('.nf-rq-open');
                if (el) { nfRqActivate(el); return; }
                var b = t.closest('.nf-rq-hero .nf-rq-req, .nf-rq-hero .nf-rq-more');
                if (b) nfRqHeroPress(b);
            } catch (err) {}
        });
        document.addEventListener('keydown', function (e) {
            try {
                var el = e.target;
                if (!el || !el.classList) return;
                var k = e.key;
                if (!(k === 'Enter' || k === ' ' || k === 'Spacebar' || e.keyCode === 13 || e.keyCode === 32)) return;
                // A held OK repeats. On the billboard the button a request has just replaced moves the
                // focus to "Mehr Infos": a repeat must not press that one.
                if (e.repeat && el.closest && el.closest('.nf-rq-hero')) { e.preventDefault(); return; }
                if (!el.classList.contains('nf-rq-open')) return;
                if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
                e.preventDefault();
                nfRqActivate(el);
            } catch (err) {}
        });
    }

    // ---- The page, once per pass (applyDynamic, after setupSeerrNav) ----
    // It writes NOTHING when all is in place: the root class only when it changes, the box
    // moved only when React has put a child after it, the page built only once per mount
    // of jellyfin's search page (a Back from a title remounts it, and the build is then
    // drawn from the held rows, in the same pass).
    var nfRqBox = null;      // the page's div.nf-rq while it is up
    var nfRqMountSeq = 0;    // a row that answers after a newer mount, or a leave, draws nothing
    function setupSeerrPage() {
        try {
            var on = nfRqRoute() === 'page' && nfRqLive();
            var root = document.documentElement;
            if (root.classList.contains('nf-rq-view') !== on) root.classList.toggle('nf-rq-view', on);
            if (!on) { nfRqLeave(); return; }
            var page = document.querySelector('#searchPage:not(.hide)');
            if (!page) return;
            if (!nfRqBox || nfRqBox.parentNode !== page) nfRqMount(page);
            else if (page.lastElementChild !== nfRqBox) nfRqToEnd(page, nfRqBox);
            nfRqBarH(nfRqBox);
            nfRqSearchFollow();
            nfRqFocusOut(page);
        } catch (e) {}
    }
    // The Modern bar's real height, for the heading row over the billboard (seerr.css,
    // --nf-rq-bar-h, 48 px unless set here). Below 1200 px MUI lets the toolbar wrap, and with
    // long library names it is two rows, 86 px (measured), over a heading row placed at 48.
    // Read off OffsetAppBar's spacer, whose inline height React keeps equal to the bar's (a
    // ResizeObserver of its own): an attribute, not a layout read. Written only when it changes.
    function nfRqBarH(box) {
        var hdr = document.querySelector('header.MuiAppBar-root');
        var sp = hdr && hdr.nextElementSibling;
        var h = sp && sp.getAttribute('aria-hidden') === 'true' ? parseFloat(sp.style.height) : 0;
        var v = h > 0 && Math.ceil(h) !== 48 ? Math.ceil(h) + 'px' : '';
        if (box.style.getPropertyValue('--nf-rq-bar-h') === v) return;
        if (v) box.style.setProperty('--nf-rq-bar-h', v);
        else box.style.removeProperty('--nf-rq-bar-h');
    }
    // Behind the child React has just appended (its suggestions land a moment after the
    // page mounts). A move takes the focus off whatever had it inside the box - measured: the
    // TV remote's button went to <body> - so it is given back, without a scroll.
    function nfRqToEnd(page, box) {
        var ae = document.activeElement;
        var keep = ae && ae !== document.body && box.contains(ae) ? ae : null;
        page.appendChild(box);
        if (keep && document.activeElement !== keep) {
            try { keep.focus({ preventScroll: true }); } catch (e) {}
        }
    }
    // Off the page (or the gate closed): the box goes when it is still in a search page - a
    // Back to jellyfin's own search re-renders the same page, without remounting it.
    function nfRqLeave() {
        if (!nfRqBox) return;
        nfRqMountSeq++;
        nfRqSearchOff();
        if (nfRqBox.isConnected && nfRqBox.parentNode) nfRqBox.parentNode.removeChild(nfRqBox);
        nfRqBox = null;
    }
    // A new box for a new mount: each held row is drawn in this pass, the others as they arrive
    // (nfRqFill). A held row that has grown old is drawn all the same and fetched again for the
    // next visit.
    function nfRqMount(page) {
        var seq = ++nfRqMountSeq;
        nfRqSearchOff();
        if (nfRqBox && nfRqBox.isConnected && nfRqBox.parentNode) nfRqBox.parentNode.removeChild(nfRqBox);
        var uid = ApiClient.getCurrentUserId();
        var box = document.createElement('div');
        box.className = 'nf-rq';
        box.innerHTML = nfRqHeadHtml() + '<div class="nf-rq-rows"></div>';
        // lists[i]: the row's models, null when it failed, undefined while it is out.
        var st = { lists: [], done: [], plan: nfRqPlan(), shown: 0, failed: false, free: false, timer: null };
        var out = [];
        NF_RQ_ROWS.forEach(function (r, i) {
            var got = nfRqRowHeld(uid, r[0]);
            if (!got) { out.push(i); return; }
            st.lists[i] = got.list;
            if (!got.fresh) nfRqRowLoad(uid, r[0]).then(null, function () {});
        });
        // No trending held: the billboard's place is kept (home's loading shell) while it loads.
        if (!st.lists[0]) {
            var skel = document.createElement('div');
            skel.className = 'nf-rq-hero nf-hero-skel';
            box.insertBefore(skel, box.lastChild);
        }
        nfRqBox = box;
        nfRqTilesWire();
        nfRqSearchWire(box);
        page.appendChild(box);
        var live = function () { return seq === nfRqMountSeq && box.isConnected; };
        out.forEach(function (i) {
            nfRqRowLoad(uid, NF_RQ_ROWS[i][0]).then(function (list) {
                if (!live()) return;
                st.lists[i] = list || null;
                nfRqFill(box, st);
            }, function () {});
        });
        if (out.length) {
            st.timer = setTimeout(function () {
                st.free = true;
                if (live()) nfRqFill(box, st);
            }, NF_RQ_ROW_GRACE);
        }
        nfRqFill(box, st);
    }
    // The page's name and its own search field, in the .searchfields-txtSearch voice (its
    // search is wired on its own).
    function nfRqHeadHtml() {
        var l = nfL();
        return '<div class="nf-rq-head">' +
            '<h1 class="nf-rq-title">' + esc(l.requests) + '</h1>' +
            '<div class="nf-rq-search">' +
              '<span class="material-icons nf-rq-search-icon" aria-hidden="true">search</span>' +
              '<input type="search" class="nf-rq-input" placeholder="' + esc(l.searchPh) + '" aria-label="' + esc(l.searchPh) + '" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">' +
            '</div>' +
          '</div>';
    }
    // Draws whatever rows have come in, each in its own place. In their order: a row that has
    // arrived waits for a slower one before it, so each title is in the first row that has it,
    // as the rule says - until NF_RQ_ROW_GRACE has passed, after which it no longer waits, and
    // the slower row goes into its place when it comes (without what the rows drawn by then
    // hold). The billboard goes in with trending, the first row. The rows go in as home's do:
    // on the page first, then nfRowNav (chevrons, page dots) and nfLazyImages (art near the
    // viewport, decoded, then faded in). A page with nothing to show says why: Seerr not
    // reachable, or nothing there.
    function nfRqFill(box, st) {
        try {
            var rows = box.querySelector('.nf-rq-rows');
            var sid = (ApiClient.serverId && ApiClient.serverId()) || '';
            var drew = false;
            for (var i = 0; i < NF_RQ_ROWS.length; i++) {
                if (st.done[i]) continue;
                if (st.lists[i] === undefined) {
                    if (st.free) continue;
                    break;
                }
                st.done[i] = true;
                var list = st.lists[i];
                if (!list) st.failed = true;
                if (i === 0) {
                    var m = nfRqPlanHero(st.plan, list);
                    var old = box.querySelector('.nf-rq-hero');
                    if (m) {
                        var t = document.createElement('div');
                        t.innerHTML = nfRqHeroHtml(m);
                        var hero = t.firstChild;
                        if (old) box.replaceChild(hero, old);
                        else box.insertBefore(hero, rows);
                        nfLazyImages(hero);
                        nfRqHeroLater(hero, m);
                        st.shown++;
                        drew = true;
                    } else if (old) {
                        box.removeChild(old);
                    }
                }
                var row = list ? nfRqPlanRow(st.plan, i, list) : null;
                if (row) {
                    var sec = nfRowSection(row.title, row.items, sid, 'nf-rq-row', nfRqCardHtml);
                    sec.setAttribute('data-nf-rq-row', row.key);
                    nfInsertOrdered(rows, sec, i);
                    nfRowNav(sec);
                    nfLazyImages(sec);
                    st.shown++;
                    drew = true;
                }
            }
            var all = true;
            for (var j = 0; j < NF_RQ_ROWS.length; j++) { if (!st.done[j]) all = false; }
            if (all) {
                if (st.timer) { clearTimeout(st.timer); st.timer = null; }
                if (!st.shown && !rows.querySelector('.nf-rq-note')) {
                    rows.innerHTML = '<div class="nf-rq-note" role="status">' + esc(st.failed ? nfL().errDown : nfL().noResults) + '</div>';
                }
            }
            if (drew && document.documentElement.classList.contains('layout-tv') && (!document.activeElement || document.activeElement === document.body)) nfRqFocusFirst(box);
        } catch (e) {}
    }
    // jellyfin's search field takes the focus when its page mounts (React's autoFocus), and
    // on this page it is hidden: whatever was typed next went into a field nobody could see.
    // Through an entry it never gets it (nfRqGo hides it first); after a Back, a reload or a
    // link straight to the page it does, and is let go here. On a TV the remote's focus goes
    // to the billboard's first button instead, where Netflix puts it (a TV has no pointer).
    function nfRqFocusOut(page) {
        var ae = document.activeElement;
        if (!ae || ae.id !== 'searchTextInput' || !page.contains(ae)) return;
        ae.blur();
        if (document.documentElement.classList.contains('layout-tv') && nfRqBox) nfRqFocusFirst(nfRqBox);
    }
    function nfRqFocusFirst(box) {
        var el = box.querySelector('.nf-rq-hero .nf-hero-actions > a, .nf-rq-hero .nf-hero-actions > button, .nf-rq-open');
        if (el) { try { el.focus(); } catch (e) {} }
    }
    // The billboard is up and in view: applyDynamic's hero test, so html.nf-hero-top gives
    // this page home's transparent bar and zero page padding. Not while the page is showing
    // its search results (.nf-rq-searching), where there is no billboard.
    function nfRqHeroVisible() {
        try {
            var box = nfRqBox;
            if (!box || !box.isConnected || box.classList.contains('nf-rq-searching') || nfRqRoute() !== 'page') return false;
            var hero = box.querySelector('.nf-rq-hero');
            return !!hero && hero.offsetParent !== null;
        } catch (e) { return false; }
    }

    // ---- The page's own search: #/search?nfview=requests&nfq=<query> ----
    // The heading row's field asks Seerr 400 ms after the last key (design 6.4), and the newest
    // search wins: an answer to an older one draws nothing. While a query is up, the billboard and
    // the rows step aside (.nf-rq-searching) for a wrapping grid of the same tiles, which takes the
    // next page as its end comes near, five pages at most; clearing the field brings them back. The
    // query is kept in the hash (nfq, written with a replace), so a reload or a Back to the page
    // shows it again - from the answers held for two minutes, without asking again.
    var NF_RQ_SEARCH_WAIT = 400;
    var NF_RQ_SEARCH_PAGES = 5;
    var NF_RQ_SEARCH_TTL = 2 * 60 * 1000;
    var NF_RQ_SEARCH_HELD = 40;
    var nfRqFound = {};        // uid|page|query -> {ts, list, pages}
    var nfRqFinding = {};      // the same key -> the Promise in flight
    var nfRqSearchAt = null;   // the grid on the page: {q, page, pages, busy, failed}; null while none
    var nfRqSearchSeq = 0;     // the newest search
    var nfRqSearchTimer = 0;   // the field's debounce
    var nfRqSearchQ = '';      // the query the URL holds for the page, as the page last wrote or followed it
    var nfRqMoreIO = null;     // watches the grid's end while more pages can come

    // One page of Seerr's search for this user: {list, pages} - its titles (each the one held model
    // of its title; movie and tv only, blocklisted ones out: nfRqModel) and Seerr's page count - or
    // null when it failed or took longer than a row may (NF_RQ_ROW_WAIT). It never rejects. One call
    // per user, query and page is out at a time, and its answer is held two minutes, a late one
    // too. jellyfin's own search page asks the same (setupSeerrSearch).
    function nfRqSearchHeld(uid, q, page) {
        var k = uid + '|' + page + '|' + q;
        var rec = Object.prototype.hasOwnProperty.call(nfRqFound, k) ? nfRqFound[k] : null;
        var age = rec ? Date.now() - rec.ts : -1;
        return age >= 0 && age <= NF_RQ_SEARCH_TTL ? rec : null;
    }
    function nfRqSearchLoad(uid, q, page) {
        var held = nfRqSearchHeld(uid, q, page);
        if (held) return Promise.resolve(held);
        var k = uid + '|' + page + '|' + q;
        if (Object.prototype.hasOwnProperty.call(nfRqFinding, k)) return nfRqFinding[k];
        var p = new Promise(function (resolve) {
            var over = false;
            var timer = null;
            var end = function (v) {
                if (over) return;
                over = true;
                clearTimeout(timer);
                if (nfRqFinding[k] === p) delete nfRqFinding[k];
                resolve(v);
            };
            timer = setTimeout(function () { end(null); }, NF_RQ_ROW_WAIT);
            nfRqGet('Search', { query: q, page: page }).then(function (d) {
                var rec = null;
                try {
                    if ((ApiClient.getCurrentUserId() || '') === uid && d && Array.isArray(d.results)) {
                        rec = { ts: Date.now(), list: nfRqCanonList(uid, d.results.map(nfRqModel)), pages: Math.max(1, parseInt(d.totalPages, 10) || 1) };
                        nfRqFoundKeep(k, rec);
                    }
                } catch (e) {}
                end(rec);
            }, function () { end(null); });
        });
        nfRqFinding[k] = p;
        return p;
    }
    // Each pause in the typing leaves an answer: those past their two minutes go, and no more than
    // NF_RQ_SEARCH_HELD are kept.
    function nfRqFoundKeep(k, rec) {
        var now = Date.now();
        var keys = Object.keys(nfRqFound).filter(function (x) {
            var age = now - nfRqFound[x].ts;
            if (age >= 0 && age <= NF_RQ_SEARCH_TTL) return true;
            delete nfRqFound[x];
            return false;
        });
        if (keys.length >= NF_RQ_SEARCH_HELD) {
            keys.sort(function (a, b) { return nfRqFound[a].ts - nfRqFound[b].ts; });
            for (var i = 0; i <= keys.length - NF_RQ_SEARCH_HELD; i++) delete nfRqFound[keys[i]];
        }
        nfRqFound[k] = rec;
    }

    // A parameter of the hash, decoded ('+' is a space: URLSearchParams writes jellyfin's query so),
    // or '' when it is not there.
    var nfRqParamRe = {};
    function nfRqHashParam(name) {
        try {
            var re = nfRqParamRe[name] || (nfRqParamRe[name] = new RegExp('[?&]' + name + '=([^&#]*)'));
            var m = re.exec(location.hash || '');
            return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
        } catch (e) { return ''; }
    }
    // The query into the hash (nfq), or out of it, with a replace that keeps the router's own state
    // ({usr, key, idx}): no history entry, and Back still lands where it did. jellyfin's router does
    // not see a replace it did not make, so its search page is left as it is. Only when the URL
    // changes: the theme's patched replaceState asks for a pass.
    function nfRqUrlQ(q) {
        try {
            var h = location.hash || '';
            var i = h.indexOf('?');
            if (i >= 0) {
                var parts = h.slice(i + 1).split('&');
                var out = [];
                var put = false;
                for (var j = 0; j < parts.length; j++) {
                    if (/^nfq=/.test(parts[j])) {
                        if (q && !put) { out.push('nfq=' + encodeURIComponent(q)); put = true; }
                    } else if (parts[j]) out.push(parts[j]);
                }
                if (q && !put) out.push('nfq=' + encodeURIComponent(q));
                var nh = h.slice(0, i) + (out.length ? '?' + out.join('&') : '');
                if (nh !== h) history.replaceState(history.state, '', nh);
            }
        } catch (e) {}
        nfRqSearchQ = nfRqHashParam('nfq');
    }
    // A query in the URL that is not the one the page last wrote there - a reload, a Back to the
    // page, a link to it: the field and the results follow it. Every other pass finds the two equal.
    function nfRqSearchFollow() {
        var q = nfRqHashParam('nfq');
        if (q === nfRqSearchQ) return;
        nfRqSearchQ = q;
        var input = nfRqBox && nfRqBox.querySelector('input.nf-rq-input');
        if (input && input.value !== q) input.value = q;
        clearTimeout(nfRqSearchTimer);
        nfRqSearchTimer = 0;
        nfRqSearch(q, 1);
    }
    // The field, once per box: each key restarts the wait.
    function nfRqSearchWire(box) {
        var input = box.querySelector('input.nf-rq-input');
        if (!input) return;
        input.addEventListener('input', function () {
            clearTimeout(nfRqSearchTimer);
            nfRqSearchTimer = setTimeout(function () {
                nfRqSearchTimer = 0;
                if (box === nfRqBox && box.isConnected) nfRqSearch(input.value, 1);
            }, NF_RQ_SEARCH_WAIT);
        });
    }
    // Off the page, or a new box: no wait left to run out, no answer to draw, no end to watch.
    function nfRqSearchOff() {
        clearTimeout(nfRqSearchTimer);
        nfRqSearchTimer = 0;
        nfRqSearchSeq++;
        nfRqMoreOff();
        nfRqSearchAt = null;
        nfRqSearchQ = '';
    }

    // Page 1 of a query: a new grid, or the page back to its rows for an empty one. Page 2 to 5:
    // more of the grid that is up (the end in reach: nfRqMoreSeen).
    function nfRqSearch(q, page) {
        try {
            var box = nfRqBox;
            if (!box || !box.isConnected) return;
            q = String(q == null ? '' : q).replace(/^\s+|\s+$/g, '');
            var at = nfRqSearchAt;
            if (page > 1) {
                if (!at || at.q !== q || at.busy || page !== at.page + 1 || page > Math.min(at.pages, NF_RQ_SEARCH_PAGES)) return;
            } else {
                // The same query again (a space typed, a key typed and taken back) asks nothing,
                // unless it failed.
                if (at ? (at.q === q && !at.failed) : !q) return;
                nfRqSearchSeq++;
                nfRqMoreOff();
                nfRqUrlQ(q);
                if (!q) {
                    nfRqSearchAt = null;
                    var res = box.querySelector('.nf-rq-results');
                    if (res) box.removeChild(res);
                    if (box.classList.contains('nf-rq-searching')) box.classList.remove('nf-rq-searching');
                    return;
                }
                at = nfRqSearchAt = { q: q, page: 0, pages: 1, busy: false, failed: false };
                // The first query: a row of tiles that are still coming. A later one keeps the grid it
                // had until its own answer replaces it, in one piece.
                if (!box.querySelector('.nf-rq-results')) box.appendChild(nfRqResults(nfRqSkels(nfRqCols())));
                if (!box.classList.contains('nf-rq-searching')) box.classList.add('nf-rq-searching');
            }
            var seq = nfRqSearchSeq;
            at.busy = true;
            nfRqSearchLoad(ApiClient.getCurrentUserId() || '', q, page).then(function (got) {
                if (seq !== nfRqSearchSeq || nfRqSearchAt !== at || box !== nfRqBox || !box.isConnected) return;
                at.busy = false;
                nfRqSearchDraw(box, at, page, got);
            }, function () {});
        } catch (e) {}
    }
    // An answer into the grid. Page 1 replaces what is there, later pages add their tiles - never a
    // title twice. A failed page 1 says Seerr could not be reached; a failed later one ends the grid.
    function nfRqSearchDraw(box, at, page, got) {
        try {
            if (!got) {
                if (page === 1) { at.failed = true; nfRqResultsPut(box, nfRqResults('')); }
                at.pages = at.page;
                nfRqSearchEnd(box, at);
                return;
            }
            var res = box.querySelector('.nf-rq-results');
            var grid = page > 1 && res ? res.querySelector('.nf-rq-grid') : null;
            if (page > 1 && !grid) return;
            var sid = (ApiClient.serverId && ApiClient.serverId()) || '';
            var seen = {};
            for (var c = grid ? grid.firstElementChild : null; c; c = c.nextElementSibling) seen[c.getAttribute('data-nf-rq')] = true;
            var t = document.createElement('div');
            t.innerHTML = got.list.filter(function (m) {
                if (seen[m.key]) return false;
                seen[m.key] = true;
                return true;
            }).map(function (m) { return nfRqCardHtml(m, sid, false); }).join('');
            // The new tiles only: observed here, filled once they come near the screen.
            nfLazyImages(t);
            var frag = document.createDocumentFragment();
            while (t.firstChild) frag.appendChild(t.firstChild);
            at.page = page;
            at.pages = got.pages;
            if (page === 1) {
                var fresh = nfRqResults('');
                fresh.firstChild.appendChild(frag);
                nfRqResultsPut(box, fresh);
            } else {
                grid.appendChild(frag);
            }
            nfRqSearchEnd(box, at);
        } catch (e) {}
    }
    // The grid's end. While there are pages to come, a sentinel there asks for the next one as it
    // comes in reach - observed afresh after each page, so an end still in reach (a short grid on a
    // tall screen) reports again. With nothing to show and nothing more to ask, a note says why.
    function nfRqSearchEnd(box, at) {
        var res = box.querySelector('.nf-rq-results');
        if (!res) return;
        var grid = res.querySelector('.nf-rq-grid');
        var more = at.page < Math.min(at.pages, NF_RQ_SEARCH_PAGES);
        var note = res.querySelector('.nf-rq-note');
        var say = !more && grid && !grid.firstElementChild ? (at.failed ? nfL().errDown : nfL().noResults) : '';
        if (note && note.textContent !== say) { res.removeChild(note); note = null; }
        if (say && !note) res.insertAdjacentHTML('beforeend', '<div class="nf-rq-note" role="status">' + esc(say) + '</div>');
        if (!more || typeof IntersectionObserver === 'undefined') { nfRqMoreOff(); return; }
        var end = res.querySelector('.nf-rq-end');
        if (!end) {
            end = document.createElement('div');
            end.className = 'nf-rq-end';
            res.appendChild(end);
        }
        if (!nfRqMoreIO) nfRqMoreIO = new IntersectionObserver(nfRqMoreSeen, { rootMargin: '0px 0px 50% 0px' });
        nfRqMoreIO.unobserve(end);
        nfRqMoreIO.observe(end);
    }
    function nfRqMoreSeen(entries) {
        try {
            for (var i = 0; i < entries.length; i++) {
                if (!entries[i].isIntersecting) continue;
                var at = nfRqSearchAt;
                if (at && !at.busy) nfRqSearch(at.q, at.page + 1);
                return;
            }
        } catch (e) {}
    }
    function nfRqMoreOff() {
        if (nfRqMoreIO) { nfRqMoreIO.disconnect(); nfRqMoreIO = null; }
        var end = nfRqBox && nfRqBox.querySelector('.nf-rq-end');
        if (end && end.parentNode) end.parentNode.removeChild(end);
    }
    // The results box: the rows' section classes, so its tiles have the row tiles' look and the
    // phones' captions (netflix.css), around the grid (seerr.css).
    function nfRqResults(html) {
        var res = document.createElement('div');
        res.className = 'nf-rq-results verticalSection nf-genre-section';
        res.innerHTML = '<div class="nf-rq-grid">' + html + '</div>';
        return res;
    }
    function nfRqResultsPut(box, res) {
        var old = box.querySelector('.nf-rq-results');
        if (old) box.replaceChild(res, old);
        else box.appendChild(res);
    }
    // One row of the grid: the ladder's whole-column count for the static grids (3 on a phone).
    function nfRqCols() {
        var n = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nf-cols'), 10);
        return n > 0 && n <= 12 ? n : 6;
    }
    function nfRqSkels(n) {
        var s = '';
        for (var i = 0; i < n; i++) s += nfRqSkelHtml();
        return s;
    }
    // A tile that is still coming: the tile's own box with nothing in it, which is not a control
    // (no data-nf-rq, no focus, no pointer).
    function nfRqSkelHtml() {
        return '<div class="card overflowBackdropCard nf-card nf-rq-card nf-rq-skel" aria-hidden="true">' +
            '<div class="cardBox cardBox-bottompadded"><div class="cardScalable">' +
              '<div class="cardPadder cardPadder-overflowBackdrop"></div>' +
              '<div class="cardImageContainer cardContent"></div>' +
            '</div></div>' +
          '</div>';
    }

    // ---- The row on jellyfin's own search page: #/search?query=<query> ----
    // Under jellyfin's results, Seerr's for the same query: the titles the library does not have
    // (design 6.6). The query is jellyfin's own - React writes it into the hash on every key, with a
    // replace that the patched replaceState turns into a pass - and Seerr is asked once it has stood
    // for 500 ms, as jellyfin asks itself; the newest query wins. Four tiles that are still coming
    // stand in for the row at once, unless the answer is held (nfRqSearchLoad: two minutes). The row
    // is one theme node, div.nf-rq.nf-rq-insearch, kept as the LAST child of #searchPage, as the
    // Requests page keeps its box on the same React page: each comes and goes with its own route
    // (nfRqRoute), so the two are never there together, and neither touches the other's node.
    var NF_RQ_ROW_SEARCH_WAIT = 500;
    var nfRqRowEl = null;     // the row while it is up: its tiles, or the four still coming
    var nfRqRowFor = null;    // {key, q, mt}: the query the row is for
    var nfRqRowSeq = 0;       // the newest query; an answer to an older one draws nothing
    var nfRqRowTimer = 0;     // the 500 ms wait

    // Once per pass (applyDynamic, after setupSeerrPage). It writes NOTHING when all is in place:
    // the row moved only when React has put a child after it, the attribute and the title written
    // only when they change. Off the route, with nothing up, it is two checks.
    function setupSeerrSearch() {
        try {
            var want = nfRqRoute() === 'search' && nfRqLive() ? nfRqRowWant() : null;
            var page = want ? document.querySelector('#searchPage:not(.hide)') : null;
            if (!page) { nfRqRowOff(); return; }
            if (!nfRqRowFor || nfRqRowFor.key !== want.key) nfRqRowStart(page, want);
            var row = nfRqRowEl;
            // A Back from a title remounts jellyfin's page: the row goes into the new one, at once.
            if (row && row.parentNode !== page) page.appendChild(row);
            else if (row && page.lastElementChild !== row) nfRqToEnd(page, row);
            nfRqRowHit(page);
        } catch (e) {}
    }
    // What the row is for: jellyfin's query, two characters at least, and the kind of title a
    // search inside a library wants - films in a films library, series in a shows library. Any
    // other library holds nothing Seerr has: no row.
    function nfRqRowWant() {
        var q = nfRqHashParam('query').replace(/^\s+|\s+$/g, '');
        if (q.length < 2) return null;
        var mt = '';
        if (nfRqHashParam('parentId')) {
            var ct = nfRqHashParam('collectionType').toLowerCase();
            if (ct === 'movies') mt = 'movie';
            else if (ct === 'tvshows') mt = 'tv';
            else return null;
        }
        return { key: mt + '|' + q, q: q, mt: mt };
    }
    // A new query: the held answer at once, else the four tiles at once and Seerr after the wait.
    // Four that are already up for an earlier query stay: the typing does not redraw them per key.
    function nfRqRowStart(page, want) {
        var seq = ++nfRqRowSeq;
        clearTimeout(nfRqRowTimer);
        nfRqRowTimer = 0;
        nfRqRowFor = want;
        var uid = ApiClient.getCurrentUserId() || '';
        var held = nfRqSearchHeld(uid, want.q, 1);
        if (held) { nfRqRowDraw(page, want, held); return; }
        if (!nfRqRowEl || !nfRqRowEl.classList.contains('nf-rq-skel-row')) nfRqRowPut(page, nfRqRowSkel());
        nfRqRowTimer = setTimeout(function () {
            nfRqRowTimer = 0;
            if (seq !== nfRqRowSeq || nfRqRoute() !== 'search' || !nfRqLive()) return;
            nfRqSearchLoad(uid, want.q, 1).then(function (got) {
                if (seq !== nfRqRowSeq) return;
                var pg = document.querySelector('#searchPage:not(.hide)');
                if (pg) nfRqRowDraw(pg, want, got);
            }, function () {});
        }, NF_RQ_ROW_SEARCH_WAIT);
    }
    // The answer: movie and tv titles the library does not have - an AVAILABLE one is in jellyfin's
    // own results above it, a blocklisted one never got this far (nfRqModel) - of the kind the search
    // wants. With none, or no answer at all, there is no row.
    function nfRqRowDraw(page, want, got) {
        var items = got ? got.list.filter(function (m) { return m.status !== 5 && (!want.mt || m.mt === want.mt); }) : [];
        if (!items.length) {
            nfRqRowPut(page, null);
        } else {
            var sec = nfRowSection(nfL().notInLib, items, (ApiClient.serverId && ApiClient.serverId()) || '', 'nf-rq nf-rq-row nf-rq-insearch', nfRqCardHtml);
            nfRqRowPut(page, sec);
            nfRowNav(sec);
            nfLazyImages(sec);
            nfRqTilesWire();
        }
        nfRqRowHit(page);
    }
    function nfRqRowSkel() {
        return nfRowSection(nfL().notInLib, [0, 0, 0, 0], '', 'nf-rq nf-rq-row nf-rq-insearch nf-rq-skel-row', nfRqSkelHtml);
    }
    // The row in, out, or in place of the one that is up (the same place, one record).
    function nfRqRowPut(page, el) {
        var old = nfRqRowEl;
        nfRqRowEl = el;
        if (old && el && old.parentNode === page) { page.replaceChild(el, old); return; }
        if (old && old.parentNode) old.parentNode.removeChild(old);
        if (el) page.appendChild(el);
    }
    // jellyfin found nothing and Seerr has titles: jellyfin's "no results" message gives way
    // (#searchPage[data-nf-rq-hit], seerr.css: an attribute on its page, never an edit of React's
    // own node) and the row says that what it shows can be requested.
    function nfRqRowHit(page) {
        var row = nfRqRowEl;
        var has = !!row && row.parentNode === page && !row.classList.contains('nf-rq-skel-row');
        var none = false;
        for (var c = has ? page.firstElementChild : null; c; c = c.nextElementSibling) {
            if (c.classList.contains('noItemsMessage')) { none = true; break; }
        }
        var hit = has && none;
        if (page.hasAttribute('data-nf-rq-hit') !== hit) {
            if (hit) page.setAttribute('data-nf-rq-hit', '');
            else page.removeAttribute('data-nf-rq-hit');
        }
        var h = has ? row.querySelector('.sectionTitle') : null;
        var t = h && h.firstChild;
        var say = hit ? nfL().notInLibAny : nfL().notInLib;
        if (t && t.nodeType === 3 && t.nodeValue !== say) t.nodeValue = say;
    }
    // Off the route, below two characters, or the gate closed: no wait left to run out, no answer
    // to draw, no row, no mark on jellyfin's page.
    function nfRqRowOff() {
        if (nfRqRowTimer) { clearTimeout(nfRqRowTimer); nfRqRowTimer = 0; }
        if (!nfRqRowFor && !nfRqRowEl) return;
        nfRqRowSeq++;
        nfRqRowFor = null;
        var row = nfRqRowEl;
        nfRqRowEl = null;
        var pg = row && row.parentNode;
        if (!pg) return;
        pg.removeChild(row);
        if (pg.hasAttribute && pg.hasAttribute('data-nf-rq-hit')) pg.removeAttribute('data-nf-rq-hit');
    }

    // ---- A title's details: Movie/<id>, Tv/<id> ----
    // Only the details carry what the window shows beyond the lists (runtime, age rating, cast, crew, providers) and
    // what a series' seasons are: mediaInfo.seasons and mediaInfo.requests, which the lists lack.
    var NF_RQ_DETAILS_TTL = 2 * 60 * 1000;
    var NF_RQ_DETAILS_HELD = 40;
    var nfRqDetailsHeld = {};     // uid|key -> {ts, d}
    var nfRqDetailsAsking = {};   // uid|key -> the Promise in flight
    var nfRqDetailsGen = {};      // uid|key -> moved on when the held answer is let go: one asked for before is not kept
    // The details for this user, or null when they could not be had (Seerr not reachable, no answer within
    // NF_RQ_ROW_WAIT, an answer for another title). It never rejects. Held two minutes per title, one call per title
    // in flight; `fresh` asks again whatever is held.
    function nfRqDetails(m, fresh) {
        try {
            var has = Object.prototype.hasOwnProperty;
            var uid = ApiClient.getCurrentUserId() || '';
            var k = uid + '|' + m.key;
            var rec = has.call(nfRqDetailsHeld, k) ? nfRqDetailsHeld[k] : null;
            var age = rec ? Date.now() - rec.ts : -1;
            if (!fresh && age >= 0 && age <= NF_RQ_DETAILS_TTL) return Promise.resolve(rec.d);
            if (has.call(nfRqDetailsAsking, k)) return nfRqDetailsAsking[k];
            var gen = nfRqDetailsGen[k] || 0;
            var p = new Promise(function (resolve) {
                var over = false;
                var timer = null;
                var end = function (d) {
                    if (over) return;
                    over = true;
                    clearTimeout(timer);
                    if (nfRqDetailsAsking[k] === p) delete nfRqDetailsAsking[k];
                    resolve(d);
                };
                timer = setTimeout(function () { end(null); }, NF_RQ_ROW_WAIT);
                nfRqGet((m.mt === 'tv' ? 'Tv/' : 'Movie/') + m.id).then(function (d) {
                    var ok = !!d && typeof d === 'object' && Number(d.id) === m.id;
                    try {
                        if (ok && (nfRqDetailsGen[k] || 0) === gen && (ApiClient.getCurrentUserId() || '') === uid) nfRqDetailsKeep(k, { ts: Date.now(), d: d });
                    } catch (e) {}
                    end(ok ? d : null);
                }, function () { end(null); });
            });
            nfRqDetailsAsking[k] = p;
            return p;
        } catch (e) { return Promise.resolve(null); }
    }
    function nfRqDetailsKeep(k, rec) {
        var keys = Object.keys(nfRqDetailsHeld);
        if (keys.length >= NF_RQ_DETAILS_HELD) {
            keys.sort(function (a, b) { return nfRqDetailsHeld[a].ts - nfRqDetailsHeld[b].ts; });
            for (var i = 0; i <= keys.length - NF_RQ_DETAILS_HELD; i++) delete nfRqDetailsHeld[keys[i]];
        }
        nfRqDetailsHeld[k] = rec;
    }
    // A request changes what Seerr says of the title: the held answer goes, and one still out will not be kept.
    function nfRqDetailsForget(uid, key) {
        var k = uid + '|' + key;
        delete nfRqDetailsHeld[k];
        delete nfRqDetailsAsking[k];
        nfRqDetailsGen[k] = (nfRqDetailsGen[k] || 0) + 1;
    }

    // A series' seasons as Seerr's own pages show them (TvDetails' season badges, TvRequestModal's choice): every season
    // with a number above 0 and an episode in it (specials are not requested: Seerr drops season 0 unless an option the
    // bridge cannot read is on). Its state: Seerr's record of the season (mediaInfo.seasons, any status but unknown) or,
    // without one, the newest request that names it - a non-4K request still standing (not declined, not completed).
    // `pick`: Seerr would take it - its server drops a season that a standing request names or that it knows in any
    // state but unknown or deleted (MediaRequest.ts, the season filter), and answers 202 when none is left.
    function nfRqSeasons(d) {
        var out = [];
        try {
            var mi = d && d.mediaInfo && typeof d.mediaInfo === 'object' ? d.mediaInfo : {};
            var known = Array.isArray(mi.seasons) ? mi.seasons : [];
            var reqs = (Array.isArray(mi.requests) ? mi.requests : []).filter(function (r) {
                return !!r && !r.is4k && r.status !== 3 && r.status !== 5 && Array.isArray(r.seasons);
            });
            (Array.isArray(d && d.seasons) ? d.seasons : []).forEach(function (s) {
                var n = s ? Number(s.seasonNumber) : 0;
                var eps = s ? Number(s.episodeCount) : 0;
                if (!(n > 0) || Math.floor(n) !== n || !(eps > 0)) return;
                var ms = null;
                for (var i = 0; i < known.length; i++) {
                    if (known[i] && known[i].seasonNumber === n && known[i].status !== 1) { ms = known[i]; break; }
                }
                var req = null;
                var at = 0;
                reqs.forEach(function (r) {
                    for (var j = 0; j < r.seasons.length; j++) {
                        if (r.seasons[j] && r.seasons[j].seasonNumber === n) {
                            var t = Date.parse(r.createdAt) || 0;
                            if (!req || t > at) { req = r; at = t; }
                            return;
                        }
                    }
                });
                var ss = ms ? ms.status : 0;
                var st = ss === 5 ? 'available' : ss === 4 ? 'partial' : ss === 3 ? 'requested' : ss === 2 ? 'pending' : 'request';
                // No record, or a deleted one: a standing request says what it is (approved - or failed in Sonarr, which
                // Seerr still counts as asked for - is "requested").
                if ((!ms || ss === 7) && req) st = req.status === 1 ? 'pending' : 'requested';
                var y = /^(\d{4})/.exec(String((s && s.airDate) || ''));
                out.push({ n: n, eps: eps, year: y ? parseInt(y[1], 10) : null, state: st, pick: st === 'request' && !(ms && ss !== 7) });
            });
            out.sort(function (a, b) { return a.n - b.n; });
        } catch (e) {}
        return out;
    }

    // The age rating, picked as Seerr's own pages pick it: the first release with one in the region - Germany first (where
    // the owner is, and Seerr's discover region), else the US. A German one is the FSK's number, and says so.
    function nfRqCert(d, mt) {
        var regions = ['DE', 'US'];
        for (var i = 0; i < regions.length; i++) {
            var c = '';
            var list = mt === 'movie' ? (d.releases && d.releases.results) : (d.contentRatings && d.contentRatings.results);
            for (var j = 0; Array.isArray(list) && j < list.length && !c; j++) {
                var r = list[j];
                if (!r || r.iso_3166_1 !== regions[i]) continue;
                if (mt !== 'movie') { c = typeof r.rating === 'string' ? r.rating : ''; continue; }
                for (var x = 0; Array.isArray(r.release_dates) && x < r.release_dates.length && !c; x++) {
                    var v = r.release_dates[x] && r.release_dates[x].certification;
                    if (typeof v === 'string') c = v;
                }
            }
            c = c.replace(/^\s+|\s+$/g, '');
            if (c) return regions[i] === 'DE' && /^\d+$/.test(c) ? 'FSK ' + c : c;
        }
        return '';
    }
    // The first n distinct names of a TMDB list (cast, crew, creators, genres, providers).
    function nfRqNames(list, n) {
        var out = [];
        for (var i = 0; Array.isArray(list) && i < list.length && out.length < n; i++) {
            var nm = list[i] && list[i].name;
            if (typeof nm === 'string' && /\S/.test(nm) && out.indexOf(nm) < 0) out.push(nm);
        }
        return out;
    }

    // ---- Asking for a title ----
    // What a refusal says, by nfRqPost's code.
    var NF_RQ_ERR = { already: 'errAlready', none: 'errNone', forbidden: 'errForbidden', disabled: 'errDisabled', blocklisted: 'errBlocked', down: 'errDown', error: 'errOther' };
    var nfRqSending = {};   // a title's key -> its request while it is out
    // One request: a film, or a series' seasons, by their numbers. One per title at a time - a second press while it is
    // out gets the same answer. It never rejects; it resolves nfRqPost's code. The answer is said where the request was
    // asked: in the title's window when it is open, else in a toast (the billboard asks without one).
    function nfRqRequest(m, seasons) {
        try {
            if (!m || !nfRqShapeOk(m)) return Promise.resolve('error');
            // A series is asked for by the seasons it names, and nothing else: the bridge takes a body without seasons as
            // ALL of them, and that is the irreversible request design 4 warns of. A caller that names none sends nothing.
            var ns = null;
            if (m.mt === 'tv') {
                ns = (Array.isArray(seasons) ? seasons : []).filter(function (n) { return typeof n === 'number' && n > 0 && Math.floor(n) === n; });
                if (!ns.length) return Promise.resolve('error');
            }
            if (Object.prototype.hasOwnProperty.call(nfRqSending, m.key)) return nfRqSending[m.key];
            var uid = ApiClient.getCurrentUserId() || '';
            if (!uid) return Promise.resolve('error');
            // Requests switched off at the bridge, or the probe could not get past that switch: nothing is sent, and
            // nothing is remembered - what is known about this user stays as it is (a stored 'no' among it).
            if (!nfRqSubmitOk()) { nfRqTell(m, nfL().errDisabled); return Promise.resolve('disabled'); }
            var body = { mediaType: m.mt, mediaId: m.id, is4k: false };
            if (ns) body.seasons = ns;
            var p = nfRqPost(body).then(function (r) {
                delete nfRqSending[m.key];
                var code = (r && r.code) || 'error';
                // An answer for a user who has gone (a sign-out, a switch) changes nothing for the next one.
                try { if ((ApiClient.getCurrentUserId() || '') === uid) nfRqAnswered(m, uid, code, body, r && r.msg); } catch (e) {}
                return code;
            });
            nfRqSending[m.key] = p;
            var w = nfRqDlgOf(m);
            if (w) { w.msg = ''; nfRqDlgDraw(w); }
            nfRqRefreshTiles(m);
            return p;
        } catch (e) { return Promise.resolve('error'); }
    }
    // What a request answered, said where it was asked: in the title's window when that is open, else in a toast.
    function nfRqTell(m, say) {
        var w = nfRqDlgOf(m);
        if (!w) { nfRqToast(say); return; }
        w.msg = say;
        nfRqDlgDraw(w);
    }
    // The billboard's request button for whatever title it shows: the bridge's switch is everybody's.
    function nfRqHeroAgain() {
        var hero = nfRqBox ? nfRqBox.querySelector('.nf-rq-hero[data-nf-rq]') : null;
        var hm = hero ? nfRqFind(hero.getAttribute('data-nf-rq')) : null;
        if (hm) nfRqHeroActPut(hero, hm);
    }
    function nfRqAnswered(m, uid, code, body, msg) {
        try {
            var l = nfL();
            var w = nfRqDlgOf(m);
            if (code === 'requested') {
                // Seerr sets a requested title to PROCESSING ("Angefragt") once the request is approved, which the
                // bridge's admin key does at once - but leaves a title that is partly or fully there as it is
                // (MediaRequestSubscriber.updateParentStatus). The 201's own copy of the title is stale (PENDING), and is
                // not read.
                if (m.status !== 4 && m.status !== 5) m.status = 3;
                nfRqDetailsForget(uid, m.key);
                if (w) {
                    w.gen++;   // details asked for before this answer are out of date
                    w.msg = '';
                    if (w.seasons && body && Array.isArray(body.seasons)) {
                        w.seasons.forEach(function (s) { if (body.seasons.indexOf(s.n) >= 0) { s.state = 'requested'; s.pick = false; } });
                    }
                }
                nfRqTouch(m, uid);
                nfRqToast(l.done.replace('{0}', m.title));
                // What Seerr made of it, a moment later: the details again, into the model, the tiles and the window.
                setTimeout(function () {
                    nfRqDetails(m, true).then(function (d) { if (d && (ApiClient.getCurrentUserId() || '') === uid) nfRqTake(m, d, uid); }, function () {});
                }, 1500);
                if (w) nfRqDlgDraw(w);
                return;
            }
            // A bare 403: the bridge takes no requests from this user. Remembered for the session, so Requests go
            // (nfRqLive), while the window stays to say why. 'disabled': the bridge's switch is off - remembered as the
            // probe remembers it ('off'), so every request control is off until a fresh Status says it is on again. A
            // refusal in words of its own (nfRqPost's msg) is shown in them.
            if (code === 'forbidden') nfRqPermKeep(uid, 'no');
            else if (code === 'disabled') { nfRqPermKeep(uid, 'off'); nfRqHeroAgain(); }
            nfRqRefreshTiles(m);
            nfRqTell(m, code === 'error' && msg ? msg : l[NF_RQ_ERR[code] || 'errOther']);
            if (code === 'forbidden') applyDynamic();
        } catch (e) {}
    }
    // The title's details into its one held model, which every tile, row and search of the page draws from: when what
    // they say has changed, every tile of the title follows (nfRqTouch), and the window when it is open. A blocklisted
    // title (status 6: nfRqModel gives none) leaves the model alone, and its window says so.
    function nfRqTake(m, d, uid) {
        try {
            var w = nfRqDlgOf(m);
            var m2 = nfRqModel(d);
            if (!m2 || m2.key !== m.key) {
                if (w && d && d.mediaInfo && Number(d.mediaInfo.status) === 6) { w.blocked = true; nfRqDlgDraw(w); }
                return;
            }
            var was = nfRqState(m) + '|' + m.jf;
            var held = nfRqKeep(m2, uid);
            if (nfRqState(held) + '|' + held.jf !== was) nfRqTouch(held, uid);
            if (w) {
                w.m = held;
                w.d = d;
                if (held.mt === 'tv') nfRqDlgSeasonsTake(w, nfRqSeasons(d));
                nfRqDlgPlay(w);
                nfRqDlgDraw(w);
            }
        } catch (e) {}
    }
    // A title's state changed: its tiles, and the copies of it the rows keep in sessionStorage (nfRqRowsPatch).
    function nfRqTouch(m, uid) {
        nfRqRefreshTiles(m);
        nfRqRowsPatch(uid, m);
    }
    // The rows this tab keeps in sessionStorage hold their own copy of each title. The copy of this one is brought up to
    // date, its row's age kept. Otherwise a reload - or the first visit to the page after one - would read the old copy
    // back, and nfRqKeep would write it over the model: the title would be requestable again. (The rows in memory and the
    // searches' answers hold the model itself.)
    function nfRqRowsPatch(uid, m) {
        NF_RQ_ROWS.forEach(function (r) {
            try {
                var k = nfCacheKey(NF_RQ_ROWS_PART + r[0], uid);
                var raw = JSON.parse(sessionStorage.getItem(k) || 'null');
                if (!raw || !Array.isArray(raw.v)) return;
                var hit = false;
                for (var i = 0; i < raw.v.length; i++) {
                    if (raw.v[i] && raw.v[i].key === m.key) { raw.v[i] = m; hit = true; }
                }
                if (hit) sessionStorage.setItem(k, JSON.stringify(raw));
            } catch (e) {}
        });
    }

    // Everything on the page that shows the title's state follows it: every tile's tab (the rows, the page's search, the
    // row on jellyfin's search), the billboard's action, and a hover card that carries the title's key
    // (.nf-pop[data-nf-rq]). Only what differs is written.
    function nfRqRefreshTiles(m) {
        try {
            if (!m || typeof m.key !== 'string' || !/^(movie|tv):[1-9][0-9]*$/.test(m.key)) return;
            var st = nfRqState(m);
            var l = nfL();
            var els = document.querySelectorAll('[data-nf-rq="' + m.key + '"]');
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (el.classList.contains('nf-rq-card')) nfRqTabPut(el, st, l);
                else if (el.classList.contains('nf-rq-hero')) nfRqHeroActPut(el, m);
                else if (el.classList.contains('nf-pop')) nfRqPopPut(el, st, l);
            }
        } catch (e) {}
    }
    // A tile's tab, where nfRqCardHtml puts it: after the picture, before the name.
    function nfRqTabPut(card, st, l) {
        var tab = card.querySelector('.nf-rq-state');
        var say = st === 'request' ? '' : (st === 'partial' ? l.partialTab : l[st]);
        if (!say) {
            if (tab && tab.parentNode) tab.parentNode.removeChild(tab);
            return;
        }
        if (!tab) {
            var img = card.querySelector('.cardImageContainer');
            if (!img || !img.parentNode) return;
            tab = document.createElement('span');
            tab.className = 'nf-rq-state';
            img.parentNode.insertBefore(tab, img.nextSibling);
        }
        if (tab.getAttribute('data-state') !== st) tab.setAttribute('data-state', st);
        if (tab.textContent !== say) tab.textContent = say;
    }
    // The billboard's action. A remote's focus on the button it replaces goes to the new one, or to "Mehr Infos" when that
    // is a state (an inert chip).
    function nfRqHeroActPut(hero, m) {
        var acts = hero.querySelector('.nf-hero-actions');
        var first = acts && acts.firstElementChild;
        if (!first || first.classList.contains('nf-rq-more')) return;
        var html = nfRqHeroAct(m, Object.prototype.hasOwnProperty.call(nfRqSending, m.key));
        if (first.outerHTML === html) return;
        var t = document.createElement('div');
        t.innerHTML = html;
        var next = t.firstChild;
        var had = document.activeElement === first;
        acts.replaceChild(next, first);
        if (had) {
            var to = next.tagName === 'SPAN' ? acts.querySelector('.nf-rq-more') : next;
            if (to) { try { to.focus({ preventScroll: true }); } catch (e) {} }
        }
        nfRqHeroLater(hero, m);
    }
    // A hover card: the state chip in its meta line (span.nf-rq-chip, the card's own vocabulary), and no request button
    // once nothing is left to request.
    function nfRqPopPut(pop, st, l) {
        var meta = pop.querySelector('.nf-pop-meta');
        var chip = pop.querySelector('.nf-rq-chip');
        var say = (st === 'pending' || st === 'requested' || st === 'partial') ? l[st] : '';
        if (!say) {
            if (chip && chip.parentNode) chip.parentNode.removeChild(chip);
        } else if (meta) {
            if (!chip) {
                chip = document.createElement('span');
                chip.className = 'nf-rq-chip';
                meta.appendChild(chip);
            }
            if (chip.getAttribute('data-state') !== st) chip.setAttribute('data-state', st);
            if (chip.textContent !== say) chip.textContent = say;
        }
        if (st !== 'request' && st !== 'partial') {
            var add = pop.querySelectorAll('.nf-rq-add');
            for (var i = 0; i < add.length; i++) { if (add[i].parentNode) add[i].parentNode.removeChild(add[i]); }
        }
    }

    // ---- The toast: one line, bottom left, 3.3 s ----
    // The theme's own (jellyfin's toast is not on window), above every dialog, a polite live region. A newer one takes
    // the place of the one that is up.
    var nfRqToastEl = null;
    var nfRqToastTimer = 0;
    function nfRqToast(text) {
        try {
            if (nfRqToastEl && nfRqToastEl.parentNode) nfRqToastEl.parentNode.removeChild(nfRqToastEl);
            clearTimeout(nfRqToastTimer);
            var t = document.createElement('div');
            t.className = 'nf-rq-toast';
            t.setAttribute('role', 'status');
            t.textContent = String(text == null ? '' : text);
            document.body.appendChild(t);
            nfRqToastEl = t;
            nfRqToastTimer = setTimeout(function () {
                if (t.parentNode) t.parentNode.removeChild(t);
                if (nfRqToastEl === t) nfRqToastEl = null;
            }, 3300);
        } catch (e) {}
    }

    // ---- The title's window ----
    // jellyfin's own dialog (Dashboard.dialogHelper): it pushes one same-URL history entry, so Back closes it; it holds
    // the TV remote's focus inside it; it sits above the app bar (.dialogContainer, z-index 999999); and it wears the
    // theme's .dialog skin, glass included. In it, Netflix's title window (design 6.5), drawn from the held model at once
    // and filled in from the details when they come:
    //   div.dialog.nf-rq-dlg               (dialogHelper's element, with the theme's class)
    //     div.nf-rq-dlg-in
    //       div.nf-rq-dlg-art              the 16:9 picture, and over its fade the title and the actions
    //       div.nf-rq-dlg-bar              the close ring, kept in view while the window scrolls
    //       div.nf-rq-dlg-msg              what a request answered, or why nothing can be requested
    //       div.nf-rq-dlg-body             meta, tagline, synopsis | the facts, in the "Label: value" voice
    //       div.nf-rq-dlg-seasons          a series' seasons, the ones Seerr would take ticked, and the button that asks
    // One window at a time. Each part is drawn as a string and written only when it changed; a control drawn anew keeps
    // the focus (data-nf-k names it). None of it runs on a pass: it is drawn when something happens.
    var nfRqDlgAt = null;   // the open window's state (nfRqOpen)
    function nfRqDlgOf(m) {
        var w = nfRqDlgAt;
        return w && !w.shut && m && w.m.key === m.key ? w : null;
    }
    function nfRqOpen(m) {
        try {
            var dh = window.Dashboard && window.Dashboard.dialogHelper;
            if (!m || !nfRqShapeOk(m) || !dh || typeof dh.createDialog !== 'function' || typeof dh.open !== 'function' || typeof dh.close !== 'function') return;
            // One at a time - unless the one held is no longer on the page and was never closed (taken away by something
            // else). One that is closing is still held: its step back in history has to come first.
            if (nfRqDlgAt && !nfRqDlgAt.shut && (nfRqDlgAt.closing || nfRqDlgAt.dlg.isConnected)) return;
            var dlg = dh.createDialog({ removeOnClose: true, scrollY: true, entryAnimation: 'fadein', exitAnimation: 'fadeout',
                size: nfMM('(max-width: 768px)') ? 'fullscreen' : undefined });
            dlg.classList.add('nf-rq-dlg');
            dlg.setAttribute('role', 'dialog');
            dlg.setAttribute('aria-modal', 'true');
            dlg.setAttribute('aria-label', m.title);
            // Focusable itself: a click on its text leaves the focus in it, not on <body>, so its keys (Escape) still
            // reach it - and its controls keep it when they are drawn anew.
            dlg.setAttribute('tabindex', '-1');
            dlg.setAttribute('data-nf-rq-dlg', m.key);
            var w = { dh: dh, dlg: dlg, m: m, d: null, seasons: null, picked: {}, blocked: false, failed: false, msg: '', msgAt: 'top',
                play: null, jump: false, gen: 0, leaving: false, closing: false, shut: false, opener: document.activeElement, drawn: {}, closed: null,
                at: Date.now(), guard: null };
            dlg.innerHTML = nfRqDlgShell(m);
            nfRqDlgWire(w);
            // dialogHelper's own event as any close begins (the close ring, Escape, Back, the backdrop, the playback edge),
            // sent before its fade-out: from here on the window takes no second close (nfRqDlgClose) and no press.
            dlg.addEventListener('closing', function () { w.closing = true; });
            nfRqDlgDraw(w);
            // Resolves once the window has closed, its history entry stepped back over.
            w.closed = dh.open(dlg);
            nfRqDlgAt = w;
            w.guard = nfRqDlgGuard(w);
            document.addEventListener('click', w.guard, true);
            document.addEventListener('contextmenu', w.guard, true);
            var gone = function () {
                w.shut = true;
                if (nfRqDlgAt === w) nfRqDlgAt = null;
                document.removeEventListener('click', w.guard, true);
                document.removeEventListener('contextmenu', w.guard, true);
            };
            w.closed.then(function () {
                gone();
                // The focus goes back where the window was opened from (dialogHelper does that on TV only) - unless the
                // window led away from the page.
                var o = w.opener;
                var ae = document.activeElement;
                if (!w.leaving && o && o.isConnected && typeof o.focus === 'function' && (!ae || ae === document.body) && !nfRqTv()) {
                    try { o.focus({ preventScroll: true }); } catch (e) {}
                }
            }, gone);
            // The keys go to the window from the first moment. dialogHelper moves the focus to its first control once its
            // entry animation has run - or within open() itself where it runs no animations (a TV browser: webOS, Tizen),
            // and that focus must stay where it is: from the window itself no remote key reaches a control.
            if (!dlg.contains(document.activeElement)) {
                try { dlg.focus({ preventScroll: true }); } catch (e) {}
            }
            nfLazyImages(dlg);
            nfRqDlgLoad(w);
            nfRqDlgPlay(w);
        } catch (e) {}
    }
    function nfRqTv() {
        return document.documentElement.classList.contains('layout-tv') || (!!document.body && document.body.classList.contains('layout-tv'));
    }
    // Closing goes through dialogHelper, which steps back over the window's history entry - as its own closes do (Back, a
    // click on the backdrop). Once: dialogHelper's close() only checks .hide, which comes at the end of the fade-out, and
    // each close that starts during it steps back in history again (two clicks on the ring, or two Escapes, left the page).
    function nfRqDlgClose(w) {
        if (w.shut || w.closing) return;
        try { w.dh.close(w.dlg); } catch (e) {}
    }
    // The backdrop's own close is dialogHelper's click (and contextmenu) listener on the window's container, which has the
    // same flaw; and the second click of a double-click on a tile lands on the container of the window the first one has
    // just opened, and would close it again at once. So while a window is up, one listener ahead of everything takes such
    // a press away while the window is closing, and in its first 300 ms. On the document in the capture phase: Chromium 87
    // (JMP) calls a target's own listeners in the order they were added, so one on the container would run after
    // dialogHelper's.
    var NF_RQ_DLG_SETTLE = 300;
    function nfRqDlgGuard(w) {
        return function (e) {
            try {
                if (!e.target || e.target !== w.dlg.dialogContainer) return;
                if (!w.closing && Date.now() - w.at >= NF_RQ_DLG_SETTLE) return;
                e.preventDefault();
                e.stopPropagation();
            } catch (err) {}
        };
    }
    // The playback edge (applyDynamic): a window still open goes.
    function nfRqDlgShut() {
        var w = nfRqDlgAt;
        if (w && !w.shut) nfRqDlgClose(w);
    }
    // The picture: TMDB's backdrop at w1280 (spec 6.5), else the poster, cropped; with neither, the surface.
    function nfRqDlgArt(m) {
        if (typeof m.backdrop === 'string' && NF_RQ_PATH.test(m.backdrop)) return 'https://image.tmdb.org/t/p/w1280' + m.backdrop;
        if (typeof m.poster === 'string' && NF_RQ_PATH.test(m.poster)) return 'https://image.tmdb.org/t/p/w780' + m.poster;
        return '';
    }
    // The frame. The close ring comes after the actions in the markup, so it is not where the focus starts (the sheet
    // shows it first); the picture is loaded the tiles' way (data-nf-bg, nfLazyImages: no Referer to TMDB).
    function nfRqDlgShell(m) {
        var l = nfL();
        var art = nfRqDlgArt(m);
        return '<div class="nf-rq-dlg-in">' +
            '<div class="nf-rq-dlg-art">' +
              '<div class="nf-rq-dlg-pic' + (art ? '' : ' nf-rq-dlg-noart') + '"' + (art ? ' data-nf-bg="' + esc(art) + '"' : '') + '><div class="nf-rq-dlg-fade"></div></div>' +
              '<div class="nf-rq-dlg-hero"><h2 class="nf-rq-dlg-title">' + esc(m.title) + '</h2><div class="nf-rq-dlg-actions"></div></div>' +
            '</div>' +
            '<div class="nf-rq-dlg-bar"><button type="button" class="nf-rq-ring nf-rq-dlg-close" data-nf-act="close" data-nf-k="close" title="' + esc(l.close) + '" aria-label="' + esc(l.close) + '">' +
              '<span class="material-icons" aria-hidden="true">close</span></button></div>' +
            '<div class="nf-rq-dlg-msg" role="status" hidden></div>' +
            '<div class="nf-rq-dlg-body"></div>' +
            '<div class="nf-rq-dlg-seasons"></div>' +
          '</div>';
    }
    // One click listener and one key listener on the window. Escape closes it on every layout. jellyfin maps Escape to
    // Back only on TV, from its own listener on window - which skips a handled key, so on TV it is not a second close
    // (a second step back would leave the page). A held Enter or Space repeats: a repeat must not press the control the
    // window has just put the focus on (its request button).
    function nfRqDlgWire(w) {
        var dlg = w.dlg;
        dlg.addEventListener('click', function (e) {
            try {
                // A window on its way out takes no press (a second click of the ring, a request into the fade-out).
                if (w.closing) return;
                var t = e.target && e.target.closest ? e.target.closest('[data-nf-act]') : null;
                if (!t || !dlg.contains(t) || t.getAttribute('aria-disabled') === 'true') return;
                var act = t.getAttribute('data-nf-act');
                if (act === 'close') nfRqDlgClose(w);
                else if (act === 'req') { w.msgAt = 'top'; nfRqRequest(w.m, null); }
                else if (act === 'jump') nfRqDlgJump(w);
                else if (act === 'play' || act === 'title') nfRqDlgGo(w, act);
                else if (act === 'season') nfRqDlgPick(w, parseInt(t.getAttribute('data-n'), 10));
                else if (act === 'foot') {
                    var picked = nfRqDlgPicked(w);
                    if (picked.length) { w.msgAt = 'foot'; nfRqRequest(w.m, picked); }
                }
            } catch (err) {}
        });
        dlg.addEventListener('keydown', function (e) {
            try {
                var k = e.key;
                if (k === 'Escape' || k === 'Esc' || e.keyCode === 27) {
                    if (e.defaultPrevented) return;
                    e.preventDefault();
                    nfRqDlgClose(w);
                    return;
                }
                if (e.repeat && (k === 'Enter' || k === ' ' || k === 'Spacebar' || e.keyCode === 13 || e.keyCode === 32)) e.preventDefault();
            } catch (err) {}
        });
    }
    function nfRqDlgDraw(w) {
        try {
            var dlg = w.dlg;
            var ae = document.activeElement;
            var key = ae && ae !== dlg && dlg.contains(ae) ? ae.getAttribute('data-nf-k') : null;
            nfRqDlgPart(w, '.nf-rq-dlg-actions', 'acts', nfRqDlgActs(w));
            nfRqDlgPart(w, '.nf-rq-dlg-body', 'body', nfRqDlgBody(w));
            nfRqDlgPart(w, '.nf-rq-dlg-seasons', 'seasons', nfRqDlgSeasonsHtml(w));
            var msg = dlg.querySelector('.nf-rq-dlg-msg');
            if (msg) {
                var say = nfRqDlgSay(w);
                if (msg.textContent !== say) msg.textContent = say;
                if (msg.hidden !== !say) msg.hidden = !say;
                // Said next to the control that asked: a series' seasons button is far below the actions.
                var foot = w.msgAt === 'foot' && !!dlg.querySelector('.nf-rq-seasons-foot');
                if (msg.classList.contains('nf-rq-dlg-msg-foot') !== foot) msg.classList.toggle('nf-rq-dlg-msg-foot', foot);
            }
            var now = document.activeElement;
            if (key && (!now || now === document.body || !dlg.contains(now))) {
                var to = dlg.querySelector('[data-nf-k="' + key + '"]') || dlg.querySelector('[data-nf-k="close"]');
                if (to) { try { to.focus({ preventScroll: true }); } catch (e) {} }
            }
            if (w.jump && w.seasons) {
                w.jump = false;
                nfRqDlgJump(w);
            }
        } catch (e) {}
    }
    function nfRqDlgPart(w, sel, k, html) {
        if (w.drawn[k] === html) return;
        var el = w.dlg.querySelector(sel);
        if (!el) return;
        el.innerHTML = html;
        w.drawn[k] = html;
    }
    function nfRqDlgBtn(k, act, cls, icon, label, off) {
        return '<button type="button" class="nf-hero-btn ' + cls + '" data-nf-k="' + k + '" data-nf-act="' + act + '"' + (off ? ' aria-disabled="true"' : '') + '>' +
            '<span class="material-icons" aria-hidden="true">' + icon + '</span> ' + esc(label) + '</button>';
    }
    // A state, not an action: a button that takes no press, so the focus can rest on it (TV).
    function nfRqDlgChip(st, label, icon) {
        return '<button type="button" class="nf-hero-btn nf-rq-done" data-nf-k="primary" data-state="' + st + '" aria-disabled="true">' +
            '<span class="material-icons" aria-hidden="true">' + (icon || 'check') + '</span> ' + esc(label) + '</button>';
    }
    function nfRqDlgAnyPick(w) {
        for (var i = 0; w.seasons && i < w.seasons.length; i++) { if (w.seasons[i].pick) return true; }
        return false;
    }
    // The action row - design 6.5's state machine:
    //   can be requested: "Anfragen" (the accent; a film is asked for here, a series leads to its seasons);
    //   a request out:    "Wird angefragt…" (takes no press);
    //   status 2 or 3:    "✓ Angefragt" (a state);
    //   available:        ▶ (white) and the ring "Zur Titelseite", once Jellyfin hands this profile the item; else
    //                     "✓ Verfügbar";
    //   partly there:     ▶, and "Weitere Staffeln anfragen" while a season is left - else as available;
    //   blocklisted:      nothing (the note says why).
    // A request control is drawn off (aria-disabled) while requests cannot be sent (nfRqSubmitOk). A series none of whose
    // seasons can be asked for gets no request control at all, but a state: "Noch keine Folgen" when no season has an
    // episode yet (a series still to come), else "✓ Angefragt" (Seerr has every season).
    function nfRqDlgActs(w) {
        if (w.blocked) return '';
        var m = w.m;
        var l = nfL();
        var st = nfRqState(m);
        var tv = m.mt === 'tv';
        var busy = Object.prototype.hasOwnProperty.call(nfRqSending, m.key);
        var off = !nfRqSubmitOk();
        var left = tv && (w.seasons === null || nfRqDlgAnyPick(w));
        var play = !!w.play && w.play === m.jf && (st === 'available' || st === 'partial');
        var playBtn = play ? nfRqDlgBtn('primary', 'play', 'nf-hero-play', 'play_arrow', l.play, false) : '';
        var ring = '<button type="button" class="nf-rq-ring" data-nf-k="second" data-nf-act="title" title="' + esc(l.toTitle) + '" aria-label="' + esc(l.toTitle) + '">' +
            '<span class="material-icons" aria-hidden="true">info</span></button>';
        if (st === 'request') {
            if (busy) return nfRqDlgBtn('primary', 'req', 'nf-rq-req nf-rq-busy', 'file_download', l.requesting, true);
            if (tv && !left) return w.seasons.length ? nfRqDlgChip('requested', l.requested) : nfRqDlgChip('soon', l.noEpisodes, 'schedule');
            return nfRqDlgBtn('primary', tv ? 'jump' : 'req', 'nf-rq-req', 'file_download', l.request, off);
        }
        if (st === 'pending' || st === 'requested') return nfRqDlgChip(st, l.requested);
        if (st === 'partial' && tv && left) {
            var ask = busy ? nfRqDlgBtn(play ? 'second' : 'primary', 'jump', 'nf-rq-req nf-rq-busy', 'file_download', l.requesting, true)
                : nfRqDlgBtn(play ? 'second' : 'primary', 'jump', 'nf-rq-req', 'file_download', l.requestMore, off);
            return playBtn + ask;
        }
        // available, or partly there with nothing left to ask for
        return play ? playBtn + ring : nfRqDlgChip(st, l[st]);
    }
    // Meta (match, year, age rating, runtime or seasons - the type until the details are in), tagline and synopsis; the
    // facts beside them: cast, genres, director or creator, where to stream it (in Germany).
    function nfRqDlgBody(w) {
        var m = w.m;
        var d = w.d;
        var l = nfL();
        var meta = (m.votes >= NF_RQ_MIN_VOTES ? matchHtml(m.vote, 'nf-rq-dlg-match') : '') + (m.year ? '<span>' + esc(m.year) + '</span>' : '');
        var cert = d ? nfRqCert(d, m.mt) : '';
        if (cert) meta += '<span class="nf-rq-dlg-cert">' + esc(cert) + '</span>';
        var len = '';
        if (d && m.mt === 'movie') len = nfRuntimeText((parseInt(d.runtime, 10) || 0) * 600000000);
        else if (d) {
            var n = parseInt(d.numberOfSeasons, 10) || 0;
            if (!(n > 0)) n = nfRqSeasons(d).length;
            if (n > 0) len = n + ' ' + (n === 1 ? l.season : l.seasons);
        }
        meta += '<span>' + esc(len || (m.mt === 'tv' ? l.series : l.movie)) + '</span>';
        var tag = d && typeof d.tagline === 'string' ? d.tagline.replace(/^\s+|\s+$/g, '') : '';
        var ov = d && typeof d.overview === 'string' && /\S/.test(d.overview) ? d.overview : m.overview;
        var facts = '';
        var fact = function (label, names) {
            if (names.length) facts += '<div class="nf-rq-dlg-fact"><span class="nf-rq-dlg-label">' + esc(label) + '</span>' + esc(names.join(', ')) + '</div>';
        };
        if (d) fact(l['with'], nfRqNames(d.credits && d.credits.cast, 3));
        fact(l.genres, d && Array.isArray(d.genres) ? nfRqNames(d.genres, 4)
            : (m.genres || []).map(function (g) { return nfRqGenre(g); }).filter(function (g) { return !!g; }).slice(0, 4));
        if (d && m.mt === 'movie') {
            fact(l.director, nfRqNames((d.credits && Array.isArray(d.credits.crew) ? d.credits.crew : []).filter(function (c) { return !!c && c.job === 'Director'; }), 2));
        }
        if (d && m.mt === 'tv') fact(l.creator, nfRqNames(d.createdBy, 2));
        if (d) {
            var wp = Array.isArray(d.watchProviders) ? d.watchProviders : [];
            for (var i = 0; i < wp.length; i++) { if (wp[i] && wp[i].iso_3166_1 === 'DE') { fact(l.streaming, nfRqNames(wp[i].flatrate, 4)); break; } }
        }
        return '<div class="nf-rq-dlg-main"><div class="nf-rq-dlg-meta">' + meta + '</div>' +
            (tag ? '<div class="nf-rq-dlg-tagline">' + esc(tag) + '</div>' : '') +
            (ov ? '<div class="nf-rq-dlg-overview">' + esc(ov) + '</div>' : '') + '</div>' +
            (facts ? '<div class="nf-rq-dlg-facts">' + facts + '</div>' : '');
    }
    // A series' seasons, in the action sheet's selection voice: a season Seerr would take is a checkbox (ticked to begin
    // with); any other shows its state. The button below asks for the ticked ones, and says how many.
    function nfRqDlgSeasonsHtml(w) {
        var list = w.seasons;
        if (w.m.mt !== 'tv' || w.blocked || !list || !list.length) return '';
        var l = nfL();
        var off = !nfRqSubmitOk() || Object.prototype.hasOwnProperty.call(nfRqSending, w.m.key);
        var rows = '';
        var can = 0;
        var on = 0;
        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            var sub = (s.eps === 1 ? l.episode1 : l.episodes.replace('{0}', s.eps)) + (s.year ? ' · ' + s.year : '');
            var name = '<span class="nf-rq-season-name">' + esc(l.season + ' ' + s.n) + '</span><span class="nf-rq-season-sub">' + esc(sub) + '</span>';
            if (s.pick) {
                var ticked = !!w.picked[s.n];
                can++;
                if (ticked) on++;
                rows += '<button type="button" class="nf-rq-season nf-rq-season-pick' + (ticked ? ' nf-rq-on' : '') + '" role="checkbox" aria-checked="' + ticked + '" data-n="' + s.n + '"' +
                    ' data-nf-act="season" data-nf-k="season-' + s.n + '"' + (off ? ' aria-disabled="true"' : '') + '>' +
                    '<span class="material-icons nf-rq-season-box" aria-hidden="true">' + (ticked ? 'check_box' : 'check_box_outline_blank') + '</span>' + name + '</button>';
            } else {
                rows += '<div class="nf-rq-season" data-n="' + s.n + '"><span class="nf-rq-season-box" aria-hidden="true"></span>' + name +
                    (s.state === 'request' ? '' : '<span class="nf-rq-chip" data-state="' + s.state + '">' + esc(l[s.state]) + '</span>') + '</div>';
            }
        }
        var foot = '';
        if (can) {
            var busy = Object.prototype.hasOwnProperty.call(nfRqSending, w.m.key);
            // Nothing ticked: the plain word, drawn off - never "0 Staffeln anfragen".
            var label = busy ? l.requesting : (!on ? l.request : (on === list.length && on > 1 ? l.requestAll : (on === 1 ? l.request1 : l.requestN.replace('{0}', on))));
            foot = '<div class="nf-rq-seasons-foot">' + nfRqDlgBtn('foot', 'foot', 'nf-rq-req' + (busy ? ' nf-rq-busy' : ''), 'file_download', label, off || !on) + '</div>';
        }
        return '<h3 class="nf-rq-dlg-seasons-title">' + esc(l.seasons) + '</h3><div class="nf-rq-season-list">' + rows + '</div>' + foot;
    }
    // The note: a request's answer; else why nothing can be asked for - a blocklisted title, a series whose seasons could
    // not be had, requests switched off.
    function nfRqDlgSay(w) {
        var l = nfL();
        if (w.blocked) return l.errBlocked;
        if (w.msg) return w.msg;
        if (w.failed && w.m.mt === 'tv' && !w.seasons) return l.errDown;
        var st = nfRqState(w.m);
        var could = w.m.mt === 'tv' ? (w.seasons === null ? st === 'request' || st === 'partial' : nfRqDlgAnyPick(w)) : st === 'request';
        return could && !nfRqSubmitOk() ? l.errDisabled : '';
    }
    // New seasons from the details. A choice the user made on a season that can still be asked for is kept; any other
    // season that can be is ticked.
    function nfRqDlgSeasonsTake(w, list) {
        var had = w.seasons;
        var picked = {};
        for (var i = 0; i < list.length; i++) {
            if (!list[i].pick) continue;
            var was = false;
            for (var j = 0; had && j < had.length; j++) { if (had[j].n === list[i].n && had[j].pick) { was = true; break; } }
            picked[list[i].n] = was ? !!w.picked[list[i].n] : true;
        }
        w.seasons = list;
        w.picked = picked;
    }
    function nfRqDlgPick(w, n) {
        var list = w.seasons || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i].n === n && list[i].pick) {
                w.picked[n] = !w.picked[n];
                nfRqDlgDraw(w);
                return;
            }
        }
    }
    function nfRqDlgPicked(w) {
        var out = [];
        (w.seasons || []).forEach(function (s) { if (s.pick && w.picked[s.n]) out.push(s.n); });
        return out.sort(function (a, b) { return a - b; });
    }
    // A series' "Anfragen": to its seasons, the focus on the button that says what will be asked for. Before the seasons
    // are in, it happens once they are.
    function nfRqDlgJump(w) {
        var dlg = w.dlg;
        if (!w.seasons) {
            w.jump = true;
            if (w.failed) { w.failed = false; nfRqDlgLoad(w); }
            return;
        }
        var sec = dlg.querySelector('.nf-rq-dlg-seasons');
        if (!sec || !sec.firstChild) return;
        try { dlg.scrollTop += sec.getBoundingClientRect().top - dlg.getBoundingClientRect().top - 12; } catch (e) {}
        var to = dlg.querySelector('.nf-rq-seasons-foot button') || sec.querySelector('.nf-rq-season-pick');
        if (to) { try { to.focus({ preventScroll: true }); } catch (e) {} }
    }
    function nfRqDlgLoad(w) {
        var g = ++w.gen;
        var uid = ApiClient.getCurrentUserId() || '';
        nfRqDetails(w.m).then(function (d) {
            if (g !== w.gen || w.shut) return;
            if (!d) {
                w.failed = true;
                nfRqDlgDraw(w);
                return;
            }
            w.failed = false;
            nfRqTake(w.m, d, uid);
        }, function () {});
    }
    // ▶ only for an item Jellyfin hands this profile (nfRqCanPlay, asked once per item), and only for the id that was
    // checked: the details can bring another.
    function nfRqDlgPlay(w) {
        var m = w.m;
        var st = nfRqState(m);
        if ((st !== 'available' && st !== 'partial') || !m.jf || w.play === m.jf) return;
        var jf = m.jf;
        nfRqCanPlay(m).then(function (ok) {
            if (w.shut) return;
            var now = nfRqState(w.m);
            var yes = ok && w.m.jf === jf && (now === 'available' || now === 'partial');
            if (yes === (w.play === jf)) return;
            w.play = yes ? jf : null;
            nfRqDlgDraw(w);
        }, function () {});
    }
    // Away from the window into the library. The window closes first - dialogHelper steps back over its history entry and
    // resolves open() once it has - and only then is the navigation made: one made while it is open would leave that entry
    // behind, and Back from the title would land on nothing. ▶ is the nf-autoplay flow (the init click capture flags it,
    // the details page's own Play is pressed): a link of that kind, clicked once the window has gone.
    function nfRqDlgGo(w, act) {
        var jf = w.play;
        if (!jf || jf !== w.m.jf || w.leaving || w.closing) return;
        var sid = (ApiClient.serverId && ApiClient.serverId()) || '';
        var path = '/details?id=' + jf + (sid ? '&serverId=' + sid : '');
        w.leaving = true;
        w.closed.then(function () {
            if (act === 'title') { nfRqShow(path); return; }
            var a = document.createElement('a');
            a.className = 'nf-autoplay';
            a.setAttribute('data-id', jf);
            a.setAttribute('href', '#' + path);
            a.style.display = 'none';
            document.body.appendChild(a);
            try { a.click(); } finally { if (a.parentNode) a.parentNode.removeChild(a); }
        }, function () {});
        nfRqDlgClose(w);
    }

    // Marker: the end of the Requests block that the server cuts where requests are off.
    // @nf-requests-end

    function init() {
        nfBrandChrome();
        nfIdentWrap();
        setupCardPreviews();
        setupCwLongPress();
        setupHeaderScroll();
        applyDynamic();
        window.addEventListener('hashchange', function () {
            clearPreview(); cleanupDetailClip(); setupHero(); renderNavTabs();
            // An abandoned ▶ press must not autoplay a LATER manual visit to the
            // same title: drop the flag as soon as the route leaves its detail page.
            try {
                var pend = nfPendingAutoplay();
                if (pend && location.hash.indexOf(pend) === -1) {
                    sessionStorage.removeItem('nf-autoplay');
                    nfAutoplayAvoid = null;
                }
            } catch (e) {}
        });

        // ---- Playback-intent teardown (capture phase, never prevents anything).
        // The nf-playing EDGE kill only fires once the player's DOM appears — and
        // in the mobile apps' NATIVE players (ExoPlayer/AVPlayer) it never appears
        // at all, so an in-flight clip kept its server stream running under the
        // movie and could starve the transcoder ("preview plays, movie won't").
        // Killing synchronously on the tap that MEANS "play" closes that window on
        // every client, and stamps the autoplay flag for the theme's own ▶ links.
        document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            var ap = t.closest('.nf-autoplay');
            if (ap) {
                var apId = ap.getAttribute('data-id');
                if (apId) {
                    try { sessionStorage.setItem('nf-autoplay', apId + ':' + Date.now()); } catch (err) {}
                    // Remember which detail page (if any) was visible when ▶ was
                    // pressed — setupAutoPlay must never click THAT page's button.
                    nfAutoplayAvoid = document.querySelector('#itemDetailPage:not(.hide)');
                }
            }
            if (ap || t.closest('.btnPlay, .btnResume, .btnReplay, .cardOverlayButton, [data-action="resume"], [data-action="play"], [data-action="playallfromhere"]')) {
                nfStopAllPreviewMedia();
            }
        }, true);
        // Native playback covers the WebView -> document.hidden. Also fires on
        // tab switches, where killing the clip streams is equally right (the hero
        // re-arms them on its next rotation after return).
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) nfStopAllPreviewMedia();
        });
        window.addEventListener('pagehide', function () { nfStopAllPreviewMedia(); });

        // Coalesce the SPA's mutation bursts into one applyDynamic per frame so
        // EVERY feature (nav tabs, hero, genre rows, ...) gets retried as the
        // home page renders asynchronously — not just on the single init() pass.
        var dynScheduled = false;
        // A trailing "settle" pass ~300ms after the LAST mutation of a burst, with
        // the scanners' own throttles lifted (nfSettlePass). Several of them limit
        // themselves — the match score to one scan per 250ms, the detail row
        // chevrons to one per second — which is right while the DOM is churning and
        // wrong at the end of it: a page that renders in one burst and then goes
        // quiet (a phone: no hover, no preview clips) never got the pass that would
        // have seen its new elements. The rating stayed hidden for the generated
        // sheet's 2.5s fail-open and then showed a raw "8.1" instead of "81% Match".
        // Only childList mutations re-arm it and a settle pass adds no nodes of its
        // own once the page is built, so it cannot keep itself alive.
        var dynTrail = 0;
        function scheduleDynamic() {
            clearTimeout(dynTrail);
            dynTrail = setTimeout(function () {
                nfSettlePass = true;
                try { applyDynamic(); } finally { nfSettlePass = false; }
            }, 320);
            if (dynScheduled) return;
            dynScheduled = true;
            requestAnimationFrame(function () { dynScheduled = false; applyDynamic(); });
        }
        nfObserver = new MutationObserver(scheduleDynamic);
        nfObserveBody();

        // Anything measured against the layout (the tag list's two-line cut) is
        // stale after a resize or once a webfont has replaced the fallback face.
        // Neither is a DOM mutation, so neither reaches the observer above.
        var relayoutTimer = 0;
        function nfRelayout() {
            clearTimeout(relayoutTimer);
            relayoutTimer = setTimeout(function () { nfLayoutEpoch++; scheduleDynamic(); }, 180);
        }
        window.addEventListener('resize', nfRelayout);
        try {
            if (document.fonts) {
                if (document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(nfRelayout);
                if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', nfRelayout);
            }
        } catch (e) {}

        // SPA-survival (learned from jellyfin-plugin-custom-tabs): Jellyfin recreates the
        // header/home on client-side navigation, which can drop our button/tabs/takeover.
        // Patch history + listen to nav events and re-apply (with a short settle delay).
        // 50ms settle (was 250) — the MutationObserver catches later DOM anyway;
        // a long delay just made our rows visibly late after navigation.
        function reapply() { setTimeout(scheduleDynamic, 50); }
        ['pushState', 'replaceState'].forEach(function (m) {
            var orig = history[m];
            if (typeof orig === 'function' && !orig.__ctPatched) {
                var patched = function () { var r = orig.apply(this, arguments); reapply(); return r; };
                patched.__ctPatched = true;
                try { history[m] = patched; } catch (e) {}
            }
        });
        ['popstate', 'pageshow', 'focus', 'visibilitychange'].forEach(function (ev) {
            window.addEventListener(ev, reapply);
        });

        // Feature flags: the server bakes the effective configuration into the page as
        // window.__ctConfig (see ThemeTransformation) — that is the ONLY source normal
        // users can read, because /Plugins/{id}/Configuration requires an administrator
        // (non-admins used to silently fall back to defaults, ignoring admin settings).
        if (window.__ctConfig && typeof window.__ctConfig === 'object') {
            CT_CONFIG = window.__ctConfig;
            applyDynamic();
        }
        // Admins refresh from the live endpoint so a just-saved change applies without
        // waiting for the page to be re-served.
        if (typeof ApiClient !== 'undefined' && ApiClient.getPluginConfiguration) {
            ApiClient.getPluginConfiguration(PLUGIN_ID).then(function (c) {
                CT_CONFIG = c;
                if (cfg('HeroBillboard', true) !== true) removeHero();
                else setupHero();
                applyDynamic();
            }).catch(function () {
                // Not an admin or config unreachable: keep the injected snapshot, or
                // fall back to defaults so the home page still builds.
                if (CT_CONFIG === null) { CT_CONFIG = {}; }
                applyDynamic();
            });
        } else if (CT_CONFIG === null) {
            CT_CONFIG = {};
            applyDynamic();
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
