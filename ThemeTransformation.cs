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
        private static readonly Regex BridgeLoaderBlock = new(
            Regex.Escape("<!-- Jellyseerr Bridge web loader: start -->") + ".*?" + Regex.Escape("<!-- Jellyseerr Bridge web loader: end -->") + "\\s*",
            RegexOptions.Singleline | RegexOptions.Compiled);

        private static readonly Regex BridgeLoaderTag = new(
            "<script\\b[^>]*JellyseerrBridge/Assets/request-entry\\.js[^>]*>\\s*</script>\\s*",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

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

            // The version attribute changes index.html's bytes on every plugin update, so its
            // ETag changes and browsers refetch instead of serving a stale cached page.
            return html.Replace("</body>", $"<script id=\"{Marker}\" data-ct-version=\"{Version}\">\nwindow.__ctConfig = {configJson};\n{script}\n</script>\n</body>", StringComparison.OrdinalIgnoreCase);
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

        /// <summary>Removes any previously injected script (ours or from older versions) so injection stays single.</summary>
        public static string StripInjected(string html)
        {
            if (string.IsNullOrEmpty(html))
            {
                return html;
            }

            html = Regex.Replace(html, "<script id=\"" + Marker + "\"[^>]*>.*?</script>\\s*", string.Empty, RegexOptions.Singleline);
            if (html.Contains(BrandStart, StringComparison.Ordinal))
            {
                html = Regex.Replace(html, Regex.Escape(BrandStart) + ".*?" + Regex.Escape(BrandEnd), string.Empty, RegexOptions.Singleline);
                html = html.Replace(VillaTitle, StockTitle, StringComparison.Ordinal);
            }

            html = html.Replace("<!-- Custom Theme -->", string.Empty, StringComparison.Ordinal);
            html = Regex.Replace(html, "<script[^>]*custom-theme-headerjs[^>]*>\\s*</script>\\s*", string.Empty, RegexOptions.Singleline | RegexOptions.IgnoreCase);
            return html;
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
        /// notes for whoever edits it. Only line comments are safe to drop line by
        /// line: inside a block comment a line that starts with // is just text, and
        /// code may follow the comment's end on it. So a "/*" anywhere, even inside a
        /// string, leaves the text exactly as it is. A comment after code on the same
        /// line stays.
        /// </summary>
        internal static string StripLineComments(string js)
        {
            if (string.IsNullOrEmpty(js) || js.Contains("/*", StringComparison.Ordinal))
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
