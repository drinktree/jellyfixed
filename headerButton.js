(function () {
    'use strict';

    var PLUGIN_ID = '78b7b285-8d9e-4e4c-8e4d-7a71f76d4e2a';
    var CT_CONFIG = null;

    // ---- Locale: user-facing strings follow the client language (Jellyfin sets
    // <html lang>); everything else falls back to English. CSS-generated labels
    // (detail play button, tooltips) are driven via custom properties below.
    var LOCALES = {
        en: { home: 'Home', play: 'Play', moreInfo: 'More Info', myList: 'My List', like: 'Like', cw: 'Continue Watching', season: 'Season', seasons: 'Seasons', sound: 'Toggle sound', pause: 'Pause', slide: 'Slide', themeSettings: 'Theme settings', scrollBack: 'Scroll left', scrollFwd: 'Scroll right', labelPlay: 'Play', labelResume: 'Resume', labelReplay: 'Replay', tipWatched: 'Watched', tipFavorite: 'Favorite', tipMore: 'More' },
        de: { home: 'Startseite', play: 'Abspielen', moreInfo: 'Mehr Infos', myList: 'Meine Liste', like: 'Gefällt mir', cw: 'Weiterschauen', season: 'Staffel', seasons: 'Staffeln', sound: 'Ton an/aus', pause: 'Pause', slide: 'Folie', themeSettings: 'Theme-Einstellungen', scrollBack: 'Nach links', scrollFwd: 'Nach rechts', labelPlay: 'Abspielen', labelResume: 'Weiter', labelReplay: 'Erneut', tipWatched: 'Gesehen', tipFavorite: 'Favorit', tipMore: 'Mehr' }
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

    function nfReducedMotion() {
        try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
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
        var fp = [cfg('CardStyle', 'mixed'), String(cfg('GenreRowsExclude', ''))].join('|');
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
    function nfCacheSet(part, v, uid) {
        try { sessionStorage.setItem(nfCacheKey(part, uid), JSON.stringify({ ts: Date.now(), v: v })); } catch (e) {}
    }

    // ---- Lazy row artwork: a home build used to fire ~120 thumbnail requests at
    // once. Cards carry data-nf-bg; one shared observer fills them near-viewport.
    var nfImgIO = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            nfImgIO.unobserve(el);
            var u = el.getAttribute('data-nf-bg');
            if (u) { el.style.backgroundImage = "url('" + u + "')"; el.removeAttribute('data-nf-bg'); }
        });
    }, { rootMargin: '50%' }) : null;
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
        ['Netflix Features', [
            ['CleanHome', 'toggle', 'Clean Netflix home (hide native rows)'],
            ['OwnInjection', 'toggle', 'Self-contained inject (no File Transformation)'],
            ['ProvideFileTransformation', 'toggle', 'Provide File Transformation to other plugins'],
            ['HeroBillboard', 'toggle', 'Hero carousel (replaces Media Bar)'],
            ['GenreRows', 'toggle', 'Genre rows (replaces Home Sections)'],
            ['GenreRowsExclude', 'text', 'Hidden genre rows (comma-separated)'],
            ['NavTabs', 'toggle', 'Top nav tabs (replaces Custom Tabs)'],
            ['HoverPreviewCard', 'toggle', 'Hover expand card'],
            ['PreviewClips', 'toggle', 'Autoplay preview on hover'],
            ['TopTenRow', 'toggle', 'Top 10 numbers (first row)'],
            ['MatchScore', 'toggle', 'Green "x% Match" rating'],
            ['GlassEffect', 'toggle', 'Glass blur'],
            ['OledBlack', 'toggle', 'OLED pure black']
        ]],
        ['Colors', [
            ['SeasonalTheme', 'select', 'Theme preset', [['default','Default'],['monochrome','Monochrome'],['colorful','Colorful'],['christmas','Christmas'],['halloween','Halloween'],['summer','Summer'],['ocean','Ocean']]],
            ['AccentColor', 'color', 'Accent color'],
            ['BgColor', 'color', 'Background'],
            ['TextColor', 'color', 'Text color'],
            ['MutedColor', 'color', 'Muted text'],
            ['ProgressColor', 'select', 'Progress bar', [['accent','Accent'],['red','Red'],['green','Green'],['blue','Blue'],['purple','Purple']]]
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
        return '<span class="' + cls + '">' + Math.round(n * 10) + '% Match</span>';
    }

    // ============ Header settings button ============
    // The plugin-configuration endpoints require an administrator, so the palette
    // button is only shown to admins (non-admins used to get a button that could
    // only ever show an error panel).
    var nfAdminState = { uid: null, admin: false };
    function updateAdmin() {
        if (typeof ApiClient === 'undefined' || !ApiClient.getCurrentUserId || !ApiClient.getCurrentUser) return;
        var uid = ApiClient.getCurrentUserId();
        if (!uid || nfAdminState.uid === uid) return;
        nfAdminState.uid = uid;
        nfAdminState.admin = false;
        ApiClient.getCurrentUser().then(function (u) {
            nfAdminState.admin = !!(u && u.Policy && u.Policy.IsAdministrator);
            if (nfAdminState.admin) addButton();
            else document.querySelectorAll('.ct-settings-btn').forEach(function (b) { b.remove(); });
        }).catch(function () { nfAdminState.uid = null; });
    }

    function addButton() {
        if (!nfAdminState.admin) return;
        if (document.querySelector('.ct-settings-btn')) return;
        var hr = document.querySelector('.headerRight');
        if (!hr) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ct-settings-btn headerButton headerButtonRight';
        btn.title = nfL().themeSettings;
        btn.setAttribute('aria-label', nfL().themeSettings);
        btn.innerHTML = '<span class="material-icons" style="font-size:24px" aria-hidden="true">palette</span>';
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); togglePanel(); });
        var userBtn = hr.querySelector('.headerUserButton');
        if (userBtn) hr.insertBefore(btn, userBtn);
        else hr.appendChild(btn);
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
        panel.innerHTML = '<div class="ct-header"><h2>Theme Settings</h2><button type="button" class="ct-close" aria-label="Close">&times;</button></div>'
            + '<div class="ct-body"><p style="color:#888">Loading…</p></div>';

        document.body.appendChild(bg);
        document.body.appendChild(panel);
        document.addEventListener('keydown', ctPanelKeydown);
        panel.querySelector('.ct-close').addEventListener('click', closePanel);
        panel.querySelector('.ct-close').focus();
        requestAnimationFrame(function () { panel.classList.add('open'); bg.classList.add('open'); });

        loadConfig(panel);
    }

    function closePanel() {
        document.removeEventListener('keydown', ctPanelKeydown);
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
                    html += '<input type="text" data-key="' + key + '"' + aria + ' value="' + esc(config[key] || '') + '"' + (key === 'CustomLogoUrl' ? ' placeholder="https://..."' : '') + '>';
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
            setTimeout(function () { location.reload(); }, 1200);
        }).catch(function (err) {
            status.textContent = 'Error: ' + err;
            status.style.color = '#E50914';
        });
    }

    // ============ Top nav tabs (header) — replaces Custom Tabs ============
    var navViews = null;
    var navFetching = false;

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

        var existing = anchor.querySelector('.nf-nav-tabs');
        if (existing) {
            existing.querySelectorAll('.nf-nav-tab').forEach(function (a) {
                a.classList.toggle('active', navIsActive(a.getAttribute('href')));
            });
            return;
        }

        var tabs = [[nfL().home, '#/home']];
        navViews.forEach(function (v) { tabs.push([v.Name, navRouteFor(v)]); });
        var nav = document.createElement('div');
        nav.className = 'nf-nav-tabs';
        nav.innerHTML = tabs.map(function (t) {
            return '<a class="nf-nav-tab' + (navIsActive(t[1]) ? ' active' : '') + '" href="' + t[1] + '">' + esc(t[0]) + '</a>';
        }).join('');
        anchor.appendChild(nav);
    }

    function setupNavTabs() {
        try {
            if (cfg('NavTabs', true) !== true) {
                document.querySelectorAll('.nf-nav-tabs').forEach(function (n) { n.remove(); });
                return;
            }
            if (typeof ApiClient === 'undefined' || !ApiClient.getUserViews || !ApiClient.getCurrentUserId) return;
            if (!document.querySelector('.headerLeft')) return;
            if (navViews) { renderNavTabs(); return; }
            if (navFetching) return;
            var navUid = ApiClient.getCurrentUserId();
            if (!navUid) return; // not logged in yet — avoid GET /Users/null/Views -> 400
            navFetching = true;
            ApiClient.getUserViews({ UserId: navUid }).then(function (res) {
                navFetching = false;
                navViews = (res && res.Items) || [];
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

    function activeHomeContainer() {
        var pages = document.querySelectorAll('.homeSectionsContainer');
        for (var i = 0; i < pages.length; i++) {
            if (pages[i].offsetParent !== null) return pages[i];
        }
        return null;
    }

    function removeHero() {
        document.querySelectorAll('.nf-hero').forEach(function (h) {
            if (h._timer) { clearInterval(h._timer); h._timer = null; }
            h.remove();
        });
    }

    // We are the hero now: hide a detected external billboard (e.g. the Jellyfin
    // Media Bar) and undo the top margin it adds to the home container, so there is
    // never a double hero. Lets our hero fully replace Media Bar without uninstalling it.
    function suppressExternalHero(container) {
        var ext = document.querySelectorAll('#slides-container, [id*="slideshow" i], [class*="mediabar" i]');
        if (!ext.length) return;
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
            if (!container || container.querySelector('.nf-hero')) return;
            // A library with no eligible items must not refetch on every DOM mutation.
            if (container.getAttribute('data-nf-hero-empty') === '1') return;

            var userId = ApiClient.getCurrentUserId();
            if (!userId) return;

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
                if (!isHomePage()) return;
                var c = activeHomeContainer();
                if (!c) return;
                if (!items.length) { c.setAttribute('data-nf-hero-empty', '1'); return; }
                heroCache.uid = userId;
                heroCache.items = items;
                heroCache.ts = Date.now();
                nfCacheSet('hero', items, userId);
                if (!c.querySelector('.nf-hero')) renderHero(c, items);
            }).catch(function () { heroBusy = false; });
        } catch (e) { heroBusy = false; }
    }

    function heroSlideHtml(item, active) {
        var bg = ApiClient.getScaledImageUrl(item.Id, { type: 'Backdrop', maxWidth: 1920, tag: item.BackdropImageTags[0] });
        var serverId = item.ServerId || (ApiClient.serverId && ApiClient.serverId());
        var detailUrl = '#/details?id=' + item.Id + (serverId ? '&serverId=' + serverId : '');

        var titleHtml;
        if (item.ImageTags && item.ImageTags.Logo) {
            var logo = ApiClient.getScaledImageUrl(item.Id, { type: 'Logo', maxWidth: 480, tag: item.ImageTags.Logo });
            titleHtml = '<img class="nf-hero-logo" src="' + logo + '" alt="' + esc(item.Name) + '">';
        } else {
            titleHtml = '<div class="nf-hero-title">' + esc(item.Name || '') + '</div>';
        }

        var match = matchHtml(item.CommunityRating, 'nf-hero-match');
        var year = item.ProductionYear ? '<span>' + item.ProductionYear + '</span>' : '';
        var rating = item.OfficialRating ? '<span class="nf-hero-rating">' + esc(item.OfficialRating) + '</span>' : '';
        var genres = (item.Genres || []).slice(0, 3).map(esc).join(' • ');
        var meta = '<div class="nf-hero-meta">' + match + year + rating + (genres ? '<span>' + genres + '</span>' : '') + '</div>';
        var overview = item.Overview ? '<div class="nf-hero-overview">' + esc(item.Overview) + '</div>' : '';

        var fav = !!(item.UserData && item.UserData.IsFavorite);
        return '<div class="nf-hero-slide' + (active ? ' active' : '') + '">' +
            '<div class="nf-hero-bg" style="background-image:url(\'' + bg + '\')"></div>' +
            '<div class="nf-hero-content">' + titleHtml + meta + overview +
                '<div class="nf-hero-actions">' +
                    '<a class="nf-hero-btn nf-hero-play" href="' + detailUrl + '"><span class="material-icons" aria-hidden="true">play_arrow</span> ' + nfL().play + '</a>' +
                    '<a class="nf-hero-btn nf-hero-info" href="' + detailUrl + '"><span class="material-icons" aria-hidden="true">info</span> ' + nfL().moreInfo + '</a>' +
                    '<button type="button" class="nf-hero-btn nf-hero-list' + (fav ? ' active' : '') + '" data-id="' + item.Id + '" title="' + nfL().myList + '" aria-label="' + nfL().myList + '"><span class="material-icons" aria-hidden="true">' + (fav ? 'check' : 'add') + '</span></button>' +
                '</div>' +
            '</div></div>';
    }

    function renderHero(container, items) {
        var hero = document.createElement('div');
        hero.className = 'nf-hero';
        var slides = items.map(function (it, i) { return heroSlideHtml(it, i === 0); }).join('');
        var dots = items.map(function (_, i) { return '<button type="button" class="nf-hero-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" aria-label="' + nfL().slide + ' ' + (i + 1) + '"></button>'; }).join('');
        hero.innerHTML = slides +
            '<div class="nf-hero-controls">' +
                '<button type="button" class="nf-hero-ctrl nf-hero-mute" title="' + nfL().sound + '" aria-label="' + nfL().sound + '"><span class="material-icons" aria-hidden="true">volume_off</span></button>' +
                '<button type="button" class="nf-hero-ctrl nf-hero-pause" title="' + nfL().pause + '" aria-label="' + nfL().pause + '"><span class="material-icons" aria-hidden="true">pause</span></button>' +
                '<div class="nf-hero-dots">' + dots + '</div>' +
            '</div>';
        container.insertBefore(hero, container.firstChild);

        var cur = 0, paused = false;
        var slideEls = hero.querySelectorAll('.nf-hero-slide');
        var dotEls = hero.querySelectorAll('.nf-hero-dot');
        var clipTimer = null;

        // Self-contained hero clip: a muted, looping REMUX of the actual title (the file
        // itself, not a YouTube trailer) fades in over the backdrop of the active slide.
        function stopClip() {
            if (clipTimer) { clearTimeout(clipTimer); clipTimer = null; }
            hero.querySelectorAll('.nf-hero-video').forEach(nfKillVideo);
        }
        function attachClip(slideEl, playId, ms, ticks) {
            if (!slideEl || !slideEl.classList.contains('active') || !document.body.contains(slideEl)) return;
            var v = nfNewClipVideo('nf-hero-video');
            v.addEventListener('playing', function () { v.classList.add('show'); });
            nfClaim(v);
            nfClipSrc(v, playId, ms, ticks);
            var bg = slideEl.querySelector('.nf-hero-bg');
            slideEl.insertBefore(v, bg ? bg.nextSibling : slideEl.firstChild);
            nfPlay(v);
            // Preview window cap: without it a paused or single-slide hero streams
            // (and on the fallback path transcodes) the whole title in a loop.
            v._stopTimer = setTimeout(function () { nfKillVideo(v); }, PREVIEW_SECONDS * 1000);
            nfClipWatch(v);
            nfClipLoop(v);
        }
        function playClip(idx) {
            if (cfg('PreviewClips', true) === false) return;
            if (document.hidden || nfReducedMotion()) return;
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
        function go(n) {
            cur = (n + slideEls.length) % slideEls.length;
            for (var i = 0; i < slideEls.length; i++) { slideEls[i].classList.toggle('active', i === cur); }
            for (var j = 0; j < dotEls.length; j++) { dotEls[j].classList.toggle('active', j === cur); }
            // A fresh slide's clip always starts muted — resync the mute icon.
            var mi = hero.querySelector('.nf-hero-mute .material-icons');
            if (mi) mi.textContent = 'volume_off';
            scheduleClip();
        }

        if (slideEls.length > 1) {
            hero._timer = setInterval(function () { if (!paused && !popEl && !document.hidden) go(cur + 1); }, HERO_INTERVAL);
            dotEls.forEach(function (el) {
                el.addEventListener('click', function () { go(+el.getAttribute('data-idx')); });
            });
            var pauseBtn = hero.querySelector('.nf-hero-pause');
            pauseBtn.addEventListener('click', function () {
                paused = !paused;
                this.querySelector('.material-icons').textContent = paused ? 'play_arrow' : 'pause';
            });
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
    function nfRowNav(sec) {
        var scroller = sec.querySelector('.nf-row-scroll, .nf-cw-scroll');
        if (!scroller || (scroller.parentNode && scroller.parentNode.classList.contains('nf-row-wrap'))) return;
        var wrap = document.createElement('div');
        wrap.className = 'nf-row-wrap nf-at-start';
        scroller.parentNode.insertBefore(wrap, scroller);
        wrap.appendChild(scroller);
        function upd() {
            wrap.classList.toggle('nf-at-start', scroller.scrollLeft <= 4);
            wrap.classList.toggle('nf-at-end', scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4);
        }
        [['back', 'chevron_left', -1], ['fwd', 'chevron_right', 1]].forEach(function (a) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'nf-row-arrow nf-row-arrow-' + a[0];
            b.setAttribute('aria-label', a[2] < 0 ? nfL().scrollBack : nfL().scrollFwd);
            b.innerHTML = '<span class="material-icons" aria-hidden="true">' + a[1] + '</span>';
            b.addEventListener('click', function () {
                scroller.scrollBy({ left: a[2] * Math.round(scroller.clientWidth * 0.8), behavior: nfReducedMotion() ? 'auto' : 'smooth' });
            });
            wrap.appendChild(b);
        });
        scroller.addEventListener('scroll', function () { requestAnimationFrame(upd); }, { passive: true });
        upd();
    }

    // Row-card artwork must MATCH the configured card shape: portrait mode uses the
    // poster (Primary) art; landscape/mixed keep the titled Thumb boxart. Cropping
    // landscape art into a 2:3 frame (the old behavior) cut title art in half.
    function nfCardImage(item) {
        if (cfg('CardStyle', 'mixed') === 'portrait') {
            var t = item.ImageTags || {};
            if (t.Primary) return ApiClient.getScaledImageUrl(item.Id, { type: 'Primary', maxWidth: 400, tag: t.Primary });
        }
        return cwImage(item);
    }

    function buildCardHtml(item, sid) {
        // Netflix uses LANDSCAPE 16:9 boxart by default. Prefer the titled Thumb
        // (true boxart), then Backdrop/ParentBackdrop, then the portrait Primary —
        // unless the card shape is set to portrait (see nfCardImage).
        var img = nfCardImage(item) || '';
        var href = '#/details?id=' + item.Id + (sid ? '&serverId=' + sid : '');
        var year = item.ProductionYear || '';
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
                '</div>' +
              '</div>' +
              '<div class="cardText cardTextCentered cardText-first"><bdi>' + esc(item.Name) + '</bdi></div>' +
              (year ? '<div class="cardText cardTextCentered cardText-secondary"><bdi>' + esc(year) + '</bdi></div>' : '') +
            '</div>' +
          '</div>';
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

            function addGenreSection(g, its) {
                if (!its.length || !isHomePage()) { return; }
                var c = activeHomeContainer();
                if (!c || c.getAttribute('data-nf-rows') !== '1') { return; }
                var sec = document.createElement('div');
                sec.className = 'verticalSection nf-genre-section';
                sec.innerHTML = '<h2 class="sectionTitle sectionTitle-cards">' + esc(g) + '</h2>' +
                    '<div class="nf-row-scroll"><div class="nf-row-track">' +
                    its.map(function (it) { return buildCardHtml(it, sid); }).join('') +
                    '</div></div>';
                c.appendChild(sec);
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
                        SortBy: 'Random', Limit: 20, ImageTypeLimit: 1, EnableImageTypes: 'Backdrop,Thumb,Primary'
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

    function cwImage(item) {
        var t = item.ImageTags || {};
        // Prefer the Thumb image: it's the landscape asset WITH title art (Netflix boxart
        // style). Backdrops are textless by design (TMDB/fanart guidelines), so they only
        // serve as fallback. For episodes, the series' Thumb (ParentThumb) comes next.
        if (t.Thumb) return ApiClient.getScaledImageUrl(item.Id, { type: 'Thumb', maxWidth: 500, tag: t.Thumb });
        if (item.ParentThumbItemId && item.ParentThumbImageTag) return ApiClient.getScaledImageUrl(item.ParentThumbItemId, { type: 'Thumb', maxWidth: 500, tag: item.ParentThumbImageTag });
        if (item.BackdropImageTags && item.BackdropImageTags.length) return ApiClient.getScaledImageUrl(item.Id, { type: 'Backdrop', maxWidth: 500, tag: item.BackdropImageTags[0] });
        if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) return ApiClient.getScaledImageUrl(item.ParentBackdropItemId, { type: 'Backdrop', maxWidth: 500, tag: item.ParentBackdropImageTags[0] });
        if (t.Primary) return ApiClient.getScaledImageUrl(item.Id, { type: 'Primary', maxWidth: 500, tag: t.Primary });
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

            function cwCardsHtml(items) {
                return items.map(function (item) {
                    var pct = (item.UserData && item.UserData.PlayedPercentage) || 0;
                    var name = item.Type === 'Episode' ? (item.SeriesName || item.Name) : item.Name;
                    var href = '#/details?id=' + item.Id + (sid ? '&serverId=' + sid : '');
                    return '<a class="nf-cw-card" href="' + href + '">' +
                        '<div class="nf-cw-thumb" data-nf-bg="' + esc(cwImage(item)) + '">' +
                            '<div class="nf-cw-play"><span class="material-icons" aria-hidden="true">play_arrow</span></div>' +
                            '<div class="nf-cw-prog"><i style="width:' + Math.max(2, Math.min(100, pct)) + '%"></i></div>' +
                        '</div>' +
                        '<div class="nf-cw-title">' + esc(name || '') + '</div></a>';
                }).join('');
            }

            function insertCwSection(items) {
                var c = activeHomeContainer();
                if (!c || c.getAttribute('data-nf-cw') !== '1' || c.querySelector('.nf-cw-section')) { return null; }
                var sec = document.createElement('div');
                sec.className = 'verticalSection nf-cw-section';
                sec.setAttribute('data-nf-fp', cwFingerprint(items));
                sec.innerHTML = '<h2 class="sectionTitle sectionTitle-cards">' + nfL().cw + '</h2>' +
                    '<div class="nf-cw-scroll"><div class="nf-cw-track">' + cwCardsHtml(items) + '</div></div>';
                var hero = c.querySelector('.nf-hero');
                if (hero && hero.nextSibling) { c.insertBefore(sec, hero.nextSibling); }
                else { c.insertBefore(sec, c.firstChild); }
                nfRowNav(sec);
                nfLazyImages(sec);
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
                ImageTypeLimit: 1, EnableImageTypes: 'Thumb,Backdrop,Primary'
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
                if (track) { track.innerHTML = cwCardsHtml(items); nfLazyImages(sec); }
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
    var POP_DELAY = 500;
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
        return ApiClient.serverAddress() + '/Videos/' + playId + path + '?' + query
            + (msId ? '&mediaSourceId=' + msId : '')
            + '&api_key=' + ApiClient.accessToken();
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
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
        try { v.remove(); } catch (e) {}
    }
    // One muted, inline-autoplay clip element — shared by hero, hover popup and detail.
    function nfNewClipVideo(className) {
        var v = document.createElement('video');
        if (className) v.className = className;
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
        video.addEventListener('playing', function () { video.classList.add('show'); });
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
        if (nfReducedMotion()) return;
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
            var Wp = Math.max(cr.width * 1.6, 300);
            var left = Math.min(Math.max(cr.left + cr.width / 2 - Wp / 2, 8), vw - Wp - 8);
            var top = Math.max(cr.top - 36, 72);

            // Same preference as the row cards: titled Thumb first, textless Backdrop as fallback.
            var pt = item.ImageTags || {};
            var bd = item.BackdropImageTags && item.BackdropImageTags[0];
            var media = pt.Thumb
                ? ApiClient.getScaledImageUrl(item.Id, { type: 'Thumb', maxWidth: 640, tag: pt.Thumb })
                : (bd
                    ? ApiClient.getScaledImageUrl(item.Id, { type: 'Backdrop', maxWidth: 640, tag: bd })
                    : (pt.Primary ? ApiClient.getScaledImageUrl(item.Id, { type: 'Primary', maxWidth: 640, tag: pt.Primary }) : ''));
            var detailUrl = '#/details?id=' + item.Id + (sid ? '&serverId=' + sid : '');
            var match = matchHtml(item.CommunityRating, 'nf-pop-match');
            var rating = item.OfficialRating ? '<span class="nf-pop-rating">' + esc(item.OfficialRating) + '</span>' : '';
            var extra = item.ChildCount ? ('<span>' + item.ChildCount + ' ' + (item.ChildCount > 1 ? nfL().seasons : nfL().season) + '</span>')
                : (item.ProductionYear ? '<span>' + item.ProductionYear + '</span>' : '');
            var genres = (item.Genres || []).slice(0, 3).map(function (g) { return '<span>' + esc(g) + '</span>'; }).join('');

            var pop = document.createElement('div');
            pop.className = 'nf-pop';
            pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.width = Wp + 'px';
            pop.innerHTML =
                '<a class="nf-pop-media" href="' + detailUrl + '"' + (media ? ' style="background-image:url(\'' + media + '\')"' : '') + '><div class="nf-pop-fade"></div></a>' +
                '<div class="nf-pop-info">' +
                    '<div class="nf-pop-actions">' +
                        '<a class="nf-pop-btn play" href="' + detailUrl + '" title="' + nfL().play + '" aria-label="' + nfL().play + '"><span class="material-icons" aria-hidden="true">play_arrow</span></a>' +
                        '<button type="button" class="nf-pop-btn nf-pop-list" title="' + nfL().myList + '" aria-label="' + nfL().myList + '"><span class="material-icons" aria-hidden="true">add</span></button>' +
                        '<button type="button" class="nf-pop-btn nf-pop-like" title="' + nfL().like + '" aria-label="' + nfL().like + '"><span class="material-icons" aria-hidden="true">thumb_up_off_alt</span></button>' +
                        '<a class="nf-pop-btn more" href="' + detailUrl + '" title="' + nfL().moreInfo + '" aria-label="' + nfL().moreInfo + '"><span class="material-icons" aria-hidden="true">expand_more</span></a>' +
                    '</div>' +
                    '<div class="nf-pop-title">' + esc(item.Name || '') + '</div>' +
                    '<div class="nf-pop-meta">' + match + rating + extra + '</div>' +
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

            destroyPopEl();
            popEl = pop;
            document.body.appendChild(pop);

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
        try { return !!(window.matchMedia && window.matchMedia('(hover: none)').matches && window.matchMedia('(any-pointer: coarse)').matches); } catch (e) { return false; }
    }

    // Touch devices (iPad / phone) have no hover. Netflix-on-touch: the FIRST tap on a card
    // shows the preview popup (instead of opening the title); a second tap on the same card —
    // or its Play / More buttons — opens it. Reuses the same buildPop()/popup as desktop hover.
    function setupTouchPreviews() {
        document.body.addEventListener('click', function (e) {
            if (cfg('HoverPreviewCard', true) === false) return;
            // The popup is display:none below 769px — intercepting the tap there
            // would swallow every first tap with nothing to show. Let phones navigate.
            if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) return;
            if (popEl && popEl.contains(e.target)) return;            // inside popup -> let its links act
            var card = e.target.closest && e.target.closest('.card');
            if (!card || !eligibleCard(card)) { if (popEl) { clearPreview(); } return; }
            if (card === popCard && popEl) return;                    // second tap on same card -> navigate
            e.preventDefault();                                       // first tap -> preview only
            e.stopPropagation();
            clearPreview();
            popCard = card;
            buildPop(card);
        }, true);
        window.addEventListener('scroll', function () { clearPreview(); }, true);
    }

    function setupCardPreviews() {
        if (nfIsTouch()) { setupTouchPreviews(); return; }
        document.body.addEventListener('mouseover', function (e) {
            if (cfg('HoverPreviewCard', true) === false) return;
            if (popEl && popEl.contains(e.target)) return; // inside the popup
            var card = e.target.closest && e.target.closest('.card');
            if (!card || card === popCard) return;
            if (!eligibleCard(card)) return;
            if (popHideTimer) { clearTimeout(popHideTimer); popHideTimer = null; }
            if (popTimer) { clearTimeout(popTimer); popTimer = null; }
            destroyPopEl();
            popCard = card;
            popTimer = setTimeout(function () { if (popCard === card) buildPop(card); }, POP_DELAY);
        });
        document.body.addEventListener('mouseout', function (e) {
            var card = e.target.closest && e.target.closest('.card');
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
    function setupMatchScore() {
        try {
            if (cfg('MatchScore', true) !== true) return;
            // .starRatingValue is the classic markup; detail pages render the value
            // directly inside .starRatingContainer (verified live on 10.11).
            document.querySelectorAll('.starRatingValue, .starRatingContainer').forEach(function (el) {
                if (el.dataset.ctMatch) return;
                var n = parseFloat((el.textContent || '').replace(',', '.'));
                // Mark even invalid values: unmarked elements are visibility-hidden
                // by the generated CSS to stop the "7.8 -> 78% Match" text flicker.
                if (isNaN(n) || n < 0 || n > 10) { el.dataset.ctMatch = '0'; return; }
                el.dataset.ctMatch = '1';
                el.textContent = Math.round(n * 10) + '% Match';
                // The match score leads the metadata row via CSS (flex `order` on
                // .starRatingContainer in netflix.css) — no DOM reordering needed here.
            });
        } catch (e) {}
    }

    // ============ Logo -> Home ============
    // The Netflix "N" logo sits on the (non-clickable) page-title element. Make it
    // navigate home like Netflix by delegating to Jellyfin's own home button.
    function setupLogoHome() {
        try {
            var logo = document.querySelector('.skinHeader .pageTitleWithLogo, .skinHeader .pageTitle');
            if (!logo || logo.getAttribute('data-nf-home') === '1') return;
            logo.setAttribute('data-nf-home', '1');
            logo.style.cursor = 'pointer';
            logo.addEventListener('click', function (e) {
                e.preventDefault();
                var home = document.querySelector('.headerHomeButton');
                if (home) { home.click(); } else { window.location.hash = '#/home'; }
            });
        } catch (e) {}
    }

    // ============ Init ============
    // ============ Detail page ("Mehr Infos") — autoplay clip over the backdrop ============
    // When a detail page is open, play a muted, looping cut of the title (past the intro)
    // over the top backdrop — the same self-contained remux used by the hero / hover preview.
    // Runs on EVERY hashchange — including details -> details (cast member, similar
    // title). Killing unconditionally prevents a detached, still-streaming video from
    // the previous page surviving; setupDetailClip rebuilds for the new item.
    function cleanupDetailClip() {
        document.querySelectorAll('.nf-detail-video').forEach(nfKillVideo);
        document.querySelectorAll('[data-nf-clip]').forEach(function (el) { el.removeAttribute('data-nf-clip'); });
    }
    function setupDetailClip() {
        try {
            if (cfg('PreviewClips', true) === false) return;
            if (nfReducedMotion()) return;
            if (!/#\/details/i.test(location.hash)) return;
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
            function attach(playId, ms, ticks) {
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

    // Netflix header behaviour: transparent (top scrim) over a billboard at the
    // very top, solid #141414 once you scroll. Jellyfin's .skinHeader-withBackground
    // only marks "this view has a backdrop" — it is NOT scroll-driven — so we drive
    // the solid state ourselves with a .nf-scrolled class toggled on window scroll.
    function syncHeaderScrolled() {
        var h = document.querySelector('.skinHeader');
        if (!h) return;
        var y = window.pageYOffset || document.documentElement.scrollTop || 0;
        h.classList.toggle('nf-scrolled', y > 60);
    }
    function setupHeaderScroll() {
        if (window.__nfHeaderScroll) return;
        window.__nfHeaderScroll = true;
        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () { ticking = false; syncHeaderScrolled(); });
        }, { passive: true });
        syncHeaderScrolled();
    }

    function applyDynamic() {
        applyCssLabels();
        updateAdmin();
        addButton();
        setupLogoHome();
        syncHeaderScrolled();
        // Config-gated builders must wait for CT_CONFIG: before it loads, cfg()
        // returns defaults (mostly true), so a disabled row (e.g. a home row the
        // user turned off) would be built on first paint and never removed —
        // that was the "toggle off but row still shows" bug. init() re-runs
        // applyDynamic() as soon as the configuration arrives.
        if (CT_CONFIG === null) return;
        setupNavTabs();
        setupHero();
        setupContinueWatching();
        setupGenreRows();
        markHomeOwned();
        setupTopTen();
        setupMatchScore();
        setupDetailClip();
    }

    function init() {
        setupCardPreviews();
        setupHeaderScroll();
        applyDynamic();
        window.addEventListener('hashchange', function () { clearPreview(); cleanupDetailClip(); setupHero(); renderNavTabs(); });

        // Coalesce the SPA's mutation bursts into one applyDynamic per frame so
        // EVERY feature (nav tabs, hero, genre rows, ...) gets retried as the
        // home page renders asynchronously — not just on the single init() pass.
        var dynScheduled = false;
        function scheduleDynamic() {
            if (dynScheduled) return;
            dynScheduled = true;
            requestAnimationFrame(function () { dynScheduled = false; applyDynamic(); });
        }
        new MutationObserver(scheduleDynamic).observe(document.body, { childList: true, subtree: true });

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
