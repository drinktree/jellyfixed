using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace Jellyfin.Plugin.CustomTheme
{
    /// <summary>
    /// Shape the File Transformation plugin deserializes its <c>{ "contents": "..." }</c>
    /// payload into. Matched by property name (case-insensitive).
    /// </summary>
    public class FileTransformationPayload
    {
        public string Contents { get; set; } = string.Empty;
    }

    /// <summary>
    /// Builds and injects the inline header/hero script into index.html.
    /// Used two ways: as the callback for the File Transformation plugin
    /// (<see cref="IndexHtml"/>), and for the self-contained on-disk fallback in
    /// <see cref="EntryPoint"/>. Both paths are idempotent via the marker id.
    /// </summary>
    public static class ThemeTransformation
    {
        public const string Marker = "custom-theme-script";

        // The brand's additions to <head> sit between these two comments, so
        // StripInjected can take the whole block out again with one expression.
        private const string BrandStart = "<!--ct-brand-->";
        private const string BrandEnd = "<!--/ct-brand-->";
        private const string StockTitle = "<title>Jellyfin</title>";
        private const string VillaTitle = "<title>Villa Cocquette</title>";

        // Jellyfin's own links for the tab icon, the home-screen icon and the web-app
        // manifest, and its application name — as jellyfin-web writes them.
        private static readonly Regex StockHeadLinks = new(
            "<link\\b[^>]*\\brel\\s*=\\s*\"(?:shortcut icon|icon|apple-touch-icon|apple-touch-icon-precomposed|manifest)\"[^>]*>",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        private static readonly Regex StockAppName = new(
            "(?<open><meta\\b[^>]*\\bname\\s*=\\s*\"application-name\"[^>]*\\bcontent\\s*=\\s*\")[^\"]*(?<close>\")",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        // The Jellyseerr Bridge's web loader: the marked block its install-web-loader.sh
        // writes into index.html, and the bare tag its WEB_LOADER.md has you add by hand
        // (under any base path; letter case is ignored, as it is in tag names and routes).
        private const string BridgeStart = "<!-- Jellyseerr Bridge web loader: start -->";
        private const string BridgeEnd = "<!-- Jellyseerr Bridge web loader: end -->";

        // The block exactly as install-web-loader.sh writes it.
        private const string InstalledLoader = BridgeStart + "\n<script defer src=\"/JellyseerrBridge/Assets/request-entry.js\"></script>\n" + BridgeEnd;

        private static readonly Regex BridgeLoaderBlock = new(
            Regex.Escape(BridgeStart) + ".*?" + Regex.Escape(BridgeEnd) + "\\s*",
            RegexOptions.Singleline | RegexOptions.Compiled);

        private static readonly Regex BridgeLoaderTag = new(
            "<script\\b[^>]*JellyseerrBridge/Assets/request-entry\\.js[^>]*>\\s*</script>\\s*",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

        // The start tag of our own script element, as InjectInto writes it.
        private static readonly Regex OwnScriptStart = new("<script id=\"" + Marker + "\"[^>]*>", RegexOptions.Compiled);

        private static string? _cachedScript;

        /// <summary>File Transformation callback: receives the current file, returns the modified file.</summary>
        public static string IndexHtml(FileTransformationPayload payload)
        {
            return InjectInto(payload?.Contents ?? string.Empty);
        }

        /// <summary>
        /// Inserts the inline script before &lt;/body&gt; if not already present, and
        /// the brand's additions to &lt;head&gt; (see <see cref="InjectBrandHead"/>).
        /// <paramref name="brand"/> and <paramref name="replaceStock"/> are for the
        /// copy that is WRITTEN TO DISK: whatever is put into that file stays in it
        /// when the plugin is disabled, and then points at addresses nobody answers —
        /// so the brand's head goes into it only where the file is the one carrier
        /// (injection at serve time switched off), and Jellyfin's own tags are never
        /// taken out of it — nor another plugin's (<see cref="StripBridgeLoader"/>
        /// works on served pages only).
        /// </summary>
        public static string InjectInto(string html, bool brand = true, bool replaceStock = true)
        {
            if (string.IsNullOrEmpty(html)
                || html.Contains(Marker, StringComparison.Ordinal)
                || !html.Contains("</body>", StringComparison.OrdinalIgnoreCase))
            {
                return html;
            }

            var script = LoadScript();
            if (string.IsNullOrEmpty(script))
            {
                return html;
            }

            // Bake the effective configuration into the page: the plugin-configuration
            // API requires an administrator, so this snapshot is the only flag source
            // non-admin users have (without it, admin settings were silently ignored
            // for every normal user). System.Text.Json escapes <, > and & by default,
            // so the JSON can never break out of the script element.
            var configJson = "{}";
            var cfg = Plugin.Instance?.Configuration;
            try
            {
                if (cfg != null)
                {
                    configJson = ClientConfig(cfg);
                }
            }
            catch
            {
                // fall back to defaults client-side
            }

            if (brand)
            {
                html = InjectBrandHead(html, cfg, replaceStock);
            }

            // A page that is served while the theme offers requests itself carries the
            // theme's entry for them, not the bridge's loader as well.
            if (replaceStock && (cfg?.SeerrRequests ?? false) && SeerrBridge.Version != null)
            {
                html = StripBridgeLoader(html);
            }

            // Before the LAST </body>, the document's own. An earlier mention of the tag — in a
            // comment or a string of another inline script, as in the 3.3.x script itself — must
            // not get a copy: a copy inside another script cuts that one open.
            var bodyEnd = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (bodyEnd < 0)
            {
                return html;
            }

            // The version attribute changes index.html's bytes on every plugin update, so its
            // ETag changes and browsers refetch instead of serving a stale cached page.
            return html.Insert(bodyEnd, $"<script id=\"{Marker}\" data-ct-version=\"{Version}\">\nwindow.__ctConfig = {configJson};\n{script}\n</script>\n");
        }

        private static string Version =>
            typeof(ThemeTransformation).Assembly.GetName().Version?.ToString() ?? "0";

        /// <summary>
        /// The configuration as the page may see it. index.html is served to anyone who
        /// can reach the sign-in screen, so this is public: a server path has no place
        /// in it. The ident's file path is replaced by the address the script can fetch
        /// it from — present only when the feature is on and the file is really there,
        /// and carrying the file's version so a replaced file is a new address — and
        /// by its size, which decides whether the script holds it in memory.
        /// </summary>
        private static string ClientConfig(PluginConfiguration cfg)
        {
            var node = System.Text.Json.JsonSerializer.SerializeToNode(cfg)?.AsObject();
            if (node is null)
            {
                return "{}";
            }

            node.Remove(nameof(PluginConfiguration.IdentPath));
            var ident = IdentFile.ResolveForPage(cfg);
            if (ident != null)
            {
                node["IdentUrl"] = "CustomTheme/Ident?v=" + ident.Version;
                node["IdentBytes"] = ident.Length;
            }

            // The id under which the server offers the intro to apps that do not show
            // the theme. The script takes that entry out of the server's own answer.
            if (IdentItem.Wanted(cfg))
            {
                node["IdentItem"] = IdentItem.Id.ToString("N");
            }

            // Whether the page may offer requests: the version of the Jellyseerr Bridge
            // that was loaded at start-up, present only while the option is on (the
            // script reads it with nfBoot). That it is there is all the page learns —
            // nothing of the bridge's settings. Its own try: a fault here must not
            // cost the page the rest of its configuration.
            try
            {
                if (cfg.SeerrRequests && SeerrBridge.Version is { } v)
                {
                    node["SeerrBridge"] = v;
                }
            }
            catch
            {
                // the page offers no requests
            }

            return node.ToJsonString();
        }

        /// <summary>
        /// The Villa Cocquette brand outside the page: the tab's icon and title, the
        /// icon and name a phone or a dock gives the site when it is added as a web
        /// app, and the image on the screen that shows before the app has started.
        /// None of it can come from the stylesheet — a browser reads these from the
        /// document before any script or style of the app exists.
        ///
        /// Added as one marked block before &lt;/head&gt;, plus one in-place swap, the
        /// title, which has an exact inverse — so <see cref="StripInjected"/> can take
        /// all of it out of a copy that was written to disk.
        ///
        /// With <paramref name="replaceStock"/> (every page that is served; never the
        /// copy on disk, which could not be put back) Jellyfin's own icon, touch-icon
        /// and manifest links are taken out as well, so the document names one icon
        /// and one manifest. That matters where a browser chooses once, while it
        /// reads the head: Firefox prefers an .ico it has seen to a PNG of another
        /// size and never looks again, and "the first manifest in the document" is
        /// the rule everywhere. Without it they stay, and headerButton.js
        /// (nfBrandChrome) removes them at run time, which is enough for Chromium.
        ///
        /// The files are served by <see cref="ThemeAssetsController"/>. Relative
        /// addresses: the document is always at …/web/, one level below the base URL.
        /// </summary>
        private static string InjectBrandHead(string html, PluginConfiguration? cfg, bool replaceStock)
        {
            if (cfg is null
                || !string.Equals(cfg.Brand, "villa", StringComparison.Ordinal)
                || html.Contains(BrandStart, StringComparison.Ordinal))
            {
                return html;
            }

            if (replaceStock)
            {
                html = StockHeadLinks.Replace(html, string.Empty);
                html = StockAppName.Replace(html, "${open}Villa Cocquette${close}");
            }

            var head = html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
            if (head < 0)
            {
                return html;
            }

            const string Base = "../CustomTheme/Brand/";
            var v = "?v=" + Version;
            var block = BrandStart
                + "<link rel=\"icon\" type=\"image/png\" sizes=\"64x64\" href=\"" + Base + "villa-favicon-64.png" + v + "\" data-ct-brand>"
                + "<link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"" + Base + "villa-icon-180.png" + v + "\" data-ct-brand>"
                + "<link rel=\"manifest\" href=\"" + Base + "manifest.webmanifest" + v + "\" data-ct-brand>"
                + "<meta name=\"apple-mobile-web-app-title\" content=\"Villa Cocquette\" data-ct-brand>"
                // The splash keeps Jellyfin's own box (30% of the window, contained,
                // centred); only the picture in it changes — and on a phone the box
                // is widened, because 30% of a phone is 117px and the lockup has a
                // line of small capitals in it.
                + "<style id=\"custom-theme-brand\">.splashLogo{background-image:url(" + Base + "villa-lockup.webp" + v + ") !important;}"
                + "@media screen and (max-width:991px){.splashLogo{width:46% !important;}}</style>"
                + BrandEnd;

            return html.Insert(head, block).Replace(StockTitle, VillaTitle, StringComparison.Ordinal);
        }

        /// <summary>
        /// Removes any previously injected script (ours or from older versions) so injection
        /// stays single. A Jellyseerr Bridge loader that sits inside our script is moved out of
        /// it, never removed (<see cref="LiftBridgeLoaders"/>), and what 3.3.x left of such a
        /// script is cleared away (<see cref="DropCutOpenScript"/>).
        /// </summary>
        public static string StripInjected(string html)
        {
            if (string.IsNullOrEmpty(html))
            {
                return html;
            }

            var loaders = new List<string>();
            html = LiftBridgeLoaders(html, loaders);

            html = Regex.Replace(html, "<script id=\"" + Marker + "\"[^>]*>.*?</script>\\s*", string.Empty, RegexOptions.Singleline);
            html = DropCutOpenScript(html, loaders);
            if (html.Contains(BrandStart, StringComparison.Ordinal))
            {
                html = Regex.Replace(html, Regex.Escape(BrandStart) + ".*?" + Regex.Escape(BrandEnd), string.Empty, RegexOptions.Singleline);
                html = html.Replace(VillaTitle, StockTitle, StringComparison.Ordinal);
            }

            html = html.Replace("<!-- Custom Theme -->", string.Empty, StringComparison.Ordinal);
            html = Regex.Replace(html, "<script[^>]*custom-theme-headerjs[^>]*>\\s*</script>\\s*", string.Empty, RegexOptions.Singleline | RegexOptions.IgnoreCase);
            return PutBackBridgeLoaders(html, loaders);
        }

        /// <summary>
        /// Takes a Jellyseerr Bridge loader out of our own script element. That is where the
        /// bridge's install-web-loader.sh puts it in a copy that 3.3.x wrote to disk: it inserts
        /// its block before the first LINE that holds "&lt;/body&gt;", and two comment lines of
        /// that script mention the tag. A browser then ends our script at the loader's
        /// &lt;/script&gt; and shows the rest of it as text — and the expression that takes our
        /// script out (it ends at the first &lt;/script&gt;, too) could not take it out whole.
        /// So every loader between the start of one of our scripts and that script's first
        /// &lt;/script&gt; is cut out first and handed to <see cref="PutBackBridgeLoaders"/>.
        /// Returns the page unchanged if anything fails.
        /// </summary>
        private static string LiftBridgeLoaders(string html, List<string> loaders)
        {
            if (html.IndexOf("Jellyseerr", StringComparison.OrdinalIgnoreCase) < 0)
            {
                return html;
            }

            var original = html;
            try
            {
                var found = new List<string>();
                var at = 0;
                for (var guard = 0; guard < 64; guard++)
                {
                    var own = OwnScriptStart.Match(html, at);
                    if (!own.Success)
                    {
                        break;
                    }

                    var from = own.Index + own.Length;
                    var close = html.IndexOf("</script", from, StringComparison.OrdinalIgnoreCase);
                    var loader = FirstBridgeLoader(html, from);
                    if (close < 0 || loader is null || loader.Index >= close)
                    {
                        // This one is whole: on to the next.
                        at = close < 0 ? html.Length : close;
                        continue;
                    }

                    found.Add(loader.Value.Trim());
                    html = html.Remove(loader.Index, loader.Length);
                }

                loaders.AddRange(found);
                return html;
            }
            catch
            {
                return original;
            }
        }

        /// <summary>The bridge loader, block or bare tag, that starts first at or after <paramref name="from"/>.</summary>
        private static Match? FirstBridgeLoader(string html, int from)
        {
            var block = BridgeLoaderBlock.Match(html, from);
            var tag = BridgeLoaderTag.Match(html, from);
            if (!block.Success)
            {
                return tag.Success ? tag : null;
            }

            return tag.Success && tag.Index < block.Index ? tag : block;
        }

        /// <summary>
        /// What 3.3.x made of its script at its next start when the installer had put the loader
        /// inside it (see <see cref="LiftBridgeLoaders"/>): it took the script out only up to the
        /// loader's &lt;/script&gt;, the loader's start marker and tag going with it, and left the
        /// rest — from the loader's end marker to the script's own &lt;/script&gt; — as text in
        /// the page. The end marker even landed on the line our script had started on, which
        /// in jellyfin-web's one-line index.html is the line with the whole &lt;head&gt;: the
        /// bridge's uninstall script deletes that line. (It also put a copy of its script before
        /// every "&lt;/body&gt;" in that rest; those are gone by now, being ours.) That rest is
        /// known by an end marker with no start before it, followed by a &lt;/script&gt; that
        /// closes no script: it is taken out, and the loader the installer wrote is handed to
        /// <see cref="PutBackBridgeLoaders"/>. Returns the page unchanged if anything fails.
        /// </summary>
        private static string DropCutOpenScript(string html, List<string> loaders)
        {
            var end = html.IndexOf(BridgeEnd, StringComparison.Ordinal);
            if (end < 0)
            {
                return html;
            }

            try
            {
                var start = html.IndexOf(BridgeStart, StringComparison.Ordinal);
                if (start >= 0 && start < end)
                {
                    return html;
                }

                var close = html.IndexOf("</script>", end, StringComparison.OrdinalIgnoreCase);
                if (close < 0 || html.IndexOf("<script", end, close - end, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return html;
                }

                var stop = close + "</script>".Length;
                while (stop < html.Length && char.IsWhiteSpace(html[stop]))
                {
                    stop++;
                }

                loaders.Add(InstalledLoader);
                return html.Remove(end, stop - end);
            }
            catch
            {
                return html;
            }
        }

        /// <summary>
        /// Puts the loaders taken out of our script back where their installer meant them: on
        /// lines of their own, right before the last "&lt;/body&gt;". The bridge's uninstall
        /// script deletes whole lines, so a loader must never share one with anything else. A
        /// loader the page already holds as it is is not added a second time. Moved, never
        /// removed: a served page loses it only to <see cref="StripBridgeLoader"/>.
        /// </summary>
        private static string PutBackBridgeLoaders(string html, List<string> loaders)
        {
            if (loaders.Count == 0)
            {
                return html;
            }

            var text = new StringBuilder();
            foreach (var loader in loaders.Distinct(StringComparer.Ordinal))
            {
                if (!html.Contains(loader, StringComparison.Ordinal))
                {
                    text.Append(loader).Append('\n');
                }
            }

            if (text.Length == 0)
            {
                return html;
            }

            var bodyEnd = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
            if (bodyEnd < 0)
            {
                return html + (html.EndsWith('\n') ? string.Empty : "\n") + text;
            }

            return html.Insert(bodyEnd, (bodyEnd > 0 && html[bodyEnd - 1] != '\n' ? "\n" : string.Empty) + text);
        }

        /// <summary>
        /// Takes the Jellyseerr Bridge's web loader out of a page that is about to be
        /// served — while the theme offers requests itself, the loader would only add a
        /// second entry: in English (it looks for English labels, and on any other
        /// interface finds none), leaving the app for a page of its own, and watching
        /// the whole document every second for as long as the page is open. Served
        /// pages only: the copy on disk is the bridge's install script's to clean up
        /// (it looks for its own lines), and with the option off or the bridge gone the
        /// loader is simply served again. Returns the page unchanged if anything fails,
        /// because a throw here would cost the page the theme.
        /// </summary>
        internal static string StripBridgeLoader(string html)
        {
            if (string.IsNullOrEmpty(html) || html.IndexOf("Jellyseerr", StringComparison.OrdinalIgnoreCase) < 0)
            {
                return html;
            }

            try
            {
                return BridgeLoaderTag.Replace(BridgeLoaderBlock.Replace(html, string.Empty), string.Empty);
            }
            catch
            {
                return html;
            }
        }

        private static string LoadScript()
        {
            if (_cachedScript != null)
            {
                return _cachedScript;
            }

            var assembly = typeof(ThemeTransformation).Assembly;
            using var stream = assembly.GetManifestResourceStream("Jellyfin.Plugin.CustomTheme.headerButton.js");
            if (stream == null)
            {
                _cachedScript = string.Empty;
                return _cachedScript;
            }

            using var reader = new StreamReader(stream);
            _cachedScript = StripLineComments(reader.ReadToEnd());
            return _cachedScript;
        }

        /// <summary>
        /// The script as pages get it: without the lines that hold nothing but a //
        /// comment, and without blank lines. It goes into index.html whole and
        /// uncompressed on every load that is not a 304, and over a third of it is
        /// notes for whoever edits it. Only a line comment is safe to drop line by line,
        /// and only where the line is a line to JavaScript as well. So the text is used
        /// exactly as it is when it holds a "/*" anywhere, even inside a string (in a
        /// block comment a line that starts with // is just text, and code may follow
        /// the comment's end on it), a backslash right before a line break (a string
        /// that goes on over the next line, which may start with //), or a U+2028 or
        /// U+2029 (line breaks to JavaScript but not to this split, so code could
        /// follow one on a comment line). A comment after code on the same line stays.
        /// </summary>
        internal static string StripLineComments(string js)
        {
            if (string.IsNullOrEmpty(js)
                || js.Contains("/*", StringComparison.Ordinal)
                || js.Contains("\\\n", StringComparison.Ordinal)
                || js.Contains("\\\r", StringComparison.Ordinal)
                || js.IndexOf('\u2028') >= 0
                || js.IndexOf('\u2029') >= 0)
            {
                return js;
            }

            var kept = new StringBuilder(js.Length);
            foreach (var line in js.Split('\n'))
            {
                var start = line.TrimStart();
                if (start.Length == 0 || start.StartsWith("//", StringComparison.Ordinal))
                {
                    continue;
                }

                if (kept.Length > 0)
                {
                    kept.Append('\n');
                }

                kept.Append(line);
            }

            return kept.ToString();
        }
    }
}
