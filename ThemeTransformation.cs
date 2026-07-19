using System;
using System.IO;
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
        private static string? _cachedScript;

        /// <summary>File Transformation callback: receives the current file, returns the modified file.</summary>
        public static string IndexHtml(FileTransformationPayload payload)
        {
            return InjectInto(payload?.Contents ?? string.Empty);
        }

        /// <summary>Inserts the inline script before &lt;/body&gt; if not already present.</summary>
        public static string InjectInto(string html)
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
            try
            {
                var cfg = Plugin.Instance?.Configuration;
                if (cfg != null)
                {
                    configJson = System.Text.Json.JsonSerializer.Serialize(cfg);
                }
            }
            catch
            {
                // fall back to defaults client-side
            }

            // The version attribute changes index.html's bytes on every plugin update, so its
            // ETag changes and browsers refetch instead of serving a stale cached page.
            return html.Replace("</body>", $"<script id=\"{Marker}\" data-ct-version=\"{Version}\">\nwindow.__ctConfig = {configJson};\n{script}\n</script>\n</body>", StringComparison.OrdinalIgnoreCase);
        }

        private static string Version =>
            typeof(ThemeTransformation).Assembly.GetName().Version?.ToString() ?? "0";

        /// <summary>Removes any previously injected script (ours or from older versions) so injection stays single.</summary>
        public static string StripInjected(string html)
        {
            if (string.IsNullOrEmpty(html))
            {
                return html;
            }

            html = Regex.Replace(html, "<script id=\"" + Marker + "\"[^>]*>.*?</script>\\s*", string.Empty, RegexOptions.Singleline);
            html = html.Replace("<!-- Custom Theme -->", string.Empty, StringComparison.Ordinal);
            html = Regex.Replace(html, "<script[^>]*custom-theme-headerjs[^>]*>\\s*</script>\\s*", string.Empty, RegexOptions.Singleline | RegexOptions.IgnoreCase);
            return html;
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
            _cachedScript = reader.ReadToEnd();
            return _cachedScript;
        }
    }
}
