using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace Jellyfin.Plugin.CustomTheme
{
    /// <summary>
    /// Self-contained index.html injection. An ASP.NET middleware injects the
    /// header/hero script into <c>/web/index.html</c> at serve time, so the plugin no
    /// longer needs the File Transformation plugin (nor a writable web root). It is
    /// deliberately defensive:
    /// <list type="bullet">
    /// <item>only ever touches the SPA entry (<c>/web/index.html</c>, <c>/web/</c>, <c>/web</c>);
    /// every other request is passed straight through untouched,</item>
    /// <item>dedupes via <see cref="ThemeTransformation.Marker"/>, so it never doubles
    /// up with the File Transformation plugin or an on-disk copy,</item>
    /// <item>on ANY error it serves the original bytes unchanged,</item>
    /// <item>can be turned off at runtime via the <c>OwnInjection</c> setting (the
    /// File Transformation / on-disk paths remain as a fallback).</item>
    /// </list>
    /// </summary>
    public sealed class IndexInjectionStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
        {
            return app =>
            {
                app.UseMiddleware<IndexInjectionMiddleware>();
                next(app);
            };
        }
    }

    /// <summary>The injection middleware itself.</summary>
    public sealed class IndexInjectionMiddleware
    {
        private readonly RequestDelegate _next;

        /// <summary>
        /// Absolute path to the web client's index.html, resolved once at startup by
        /// <see cref="EntryPoint"/>. When set, the middleware reads and serves this file
        /// itself (transformed in memory) instead of capturing the downstream response —
        /// the only self-contained mechanism that injects on read-only Docker web roots,
        /// where SendFileAsync bypasses response-body capture and on-disk writes fail.
        /// </summary>
        public static volatile string? WebIndexHtmlPath;

        /// <summary>Set by <see cref="EntryPoint"/> when the REAL File Transformation
        /// plugin handles our injection. The middleware must then never direct-serve
        /// index.html (that would bypass the FT pipeline and drop other plugins'
        /// transformations) and never inject our script itself (FT already does).</summary>
        public static volatile bool RealFileTransformationActive;

        public IndexInjectionMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        // Suffix matching so installs behind a reverse-proxy Base URL
        // (e.g. /jellyfin/web/index.html) are covered too. The bare "/web" form is
        // matched only at the root: a suffix match there would capture by-name API
        // routes like /Artists/web or /Genres/web. (Jellyfin redirects a bare
        // <base>/web to <base>/web/index.html itself, so nothing is lost.)
        private static bool IsIndexRequest(PathString path)
        {
            var p = path.Value ?? string.Empty;
            return p.EndsWith("/web/index.html", StringComparison.OrdinalIgnoreCase)
                || p.EndsWith("/web/", StringComparison.OrdinalIgnoreCase)
                || p.Equals("/web", StringComparison.OrdinalIgnoreCase);
        }

        private static bool OwnInjectionEnabled()
        {
            try
            {
                return Plugin.Instance?.Configuration?.OwnInjection ?? false;
            }
            catch
            {
                return false;
            }
        }

        private static bool ProvideFtEnabled()
        {
            try
            {
                return Plugin.Instance?.Configuration?.ProvideFileTransformation ?? false;
            }
            catch
            {
                return false;
            }
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var ownInjection = OwnInjectionEnabled();
            var provideFt = ProvideFtEnabled();

            // When the real File Transformation plugin is active it injects our script
            // at the file-provider level; the middleware only still matters for
            // transformations registered against the bundled provider.
            if (RealFileTransformationActive)
            {
                ownInjection = false;
                if (provideFt && Jellyfin.Plugin.FileTransformation.PluginInterface.GetRegistrations().Count == 0)
                {
                    provideFt = false;
                }
            }

            if (!IsIndexRequest(context.Request.Path) || (!ownInjection && !provideFt))
            {
                await _next(context).ConfigureAwait(false);
                return;
            }

            // Browsers send Accept-Encoding: gzip/br, so the response-compression middleware
            // hands us COMPRESSED bytes — no "</body>" match, no injection. (curl without
            // compression got the injected page, which is why server-side tests passed while
            // every real browser was missing the script.) Force identity for the index
            // document so the capture path always sees plain HTML.
            context.Request.Headers.Remove("Accept-Encoding");

            // Preferred path: serve index.html ourselves — read straight from disk and
            // transform in memory. This is the ONLY self-contained mechanism that injects on
            // read-only Docker web roots, where the static-file middleware uses SendFileAsync
            // (bypassing response-body capture) and on-disk writes fail. Restricted to the
            // actual index document (/web/index.html and the /web/ default) so the SPA base
            // path stays correct; the bare /web redirect is left to Jellyfin. Any failure
            // falls through to the capture-based path below.
            var reqPath = context.Request.Path.Value ?? string.Empty;
            var indexPath = WebIndexHtmlPath;
            var isDirectServe = reqPath.EndsWith("/web/index.html", StringComparison.OrdinalIgnoreCase)
                || reqPath.EndsWith("/web/", StringComparison.OrdinalIgnoreCase);
            if (ownInjection && isDirectServe && indexPath != null
                && (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)))
            {
                try
                {
                    var raw = await File.ReadAllTextAsync(indexPath).ConfigureAwait(false);
                    if (raw.IndexOf("</body>", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        var working = ThemeTransformation.InjectInto(ThemeTransformation.StripInjected(raw));
                        if (provideFt)
                        {
                            working = ApplyRegisteredTransformations(working);
                        }

                        var directBytes = Encoding.UTF8.GetBytes(working);

                        // Content-derived ETag: browsers revalidate (no-cache) and get a
                        // body-less 304 while nothing changed, instead of re-downloading
                        // ~70 KB of identity-encoded HTML on every single page load.
                        var etag = "\"ct-" + Convert.ToHexString(System.Security.Cryptography.SHA1.HashData(directBytes)).Substring(0, 20) + "\"";
                        context.Response.Headers.Remove("Last-Modified");
                        context.Response.Headers["ETag"] = etag;
                        context.Response.Headers["Cache-Control"] = "no-cache";

                        if (context.Request.Headers.TryGetValue("If-None-Match", out var inm)
                            && inm.ToString().Contains(etag, StringComparison.Ordinal))
                        {
                            context.Response.StatusCode = 304;
                            return;
                        }

                        context.Response.StatusCode = 200;
                        context.Response.ContentType = "text/html; charset=utf-8";
                        context.Response.ContentLength = directBytes.Length;
                        if (HttpMethods.IsHead(context.Request.Method))
                        {
                            return;
                        }

                        await context.Response.Body.WriteAsync(directBytes).ConfigureAwait(false);
                        return;
                    }
                }
                catch
                {
                    // Fall through to the capture-based path / normal serving on any error.
                }
            }

            var originalBodyFeature = context.Features.Get<IHttpResponseBodyFeature>();
            using var buffer = new MemoryStream();
            context.Features.Set<IHttpResponseBodyFeature>(new StreamResponseBodyFeature(buffer));

            try
            {
                await _next(context).ConfigureAwait(false);
            }
            catch
            {
                // Restore and flush whatever was captured so the request still completes.
                context.Features.Set(originalBodyFeature);
                if (buffer.Length > 0)
                {
                    await context.Response.Body.WriteAsync(buffer.ToArray()).ConfigureAwait(false);
                }

                throw;
            }

            // Restore the real response body before writing the result.
            context.Features.Set(originalBodyFeature);

            string? html = null;
            try
            {
                html = Encoding.UTF8.GetString(buffer.ToArray());
            }
            catch
            {
                html = null;
            }

            // Only ever transform an actual HTML document — a JSON payload that happens
            // to contain "</body>" in a string field must pass through untouched.
            var isHtml = context.Response.ContentType?.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) ?? false;

            string? output = null;
            if (html != null
                && isHtml
                && context.Response.StatusCode == 200
                && html.IndexOf("</body>", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                try
                {
                    var working = html;

                    // 1) Our own header/hero script.
                    if (ownInjection)
                    {
                        working = ThemeTransformation.InjectInto(ThemeTransformation.StripInjected(working));
                    }

                    // 2) Transformations registered by other plugins (e.g. Media Bar) through
                    //    the bundled File Transformation provider.
                    if (provideFt)
                    {
                        working = ApplyRegisteredTransformations(working);
                    }

                    if (!string.Equals(working, html, StringComparison.Ordinal))
                    {
                        output = working;
                    }
                }
                catch
                {
                    output = null;
                }
            }

            byte[] bytes = output != null ? Encoding.UTF8.GetBytes(output) : buffer.ToArray();
            if (output != null)
            {
                // The modified document changes length; never let a cached/stale length
                // or ETag cause a ChunkLoadError.
                context.Response.Headers.Remove("ETag");
                context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            }

            // Body-less responses (304 Not Modified, 204, HEAD) must pass through with
            // the downstream headers intact — writing a body or forcing Content-Length: 0
            // onto them violates HTTP semantics and can confuse caches.
            if (bytes.Length > 0)
            {
                context.Response.ContentLength = bytes.Length;
                await context.Response.Body.WriteAsync(bytes).ConfigureAwait(false);
            }
        }

        /// <summary>Applies every transformation other plugins registered through the bundled provider.</summary>
        private static string ApplyRegisteredTransformations(string html)
        {
            foreach (var reg in Jellyfin.Plugin.FileTransformation.PluginInterface.GetRegistrations())
            {
                try
                {
                    if (!MatchesIndex(reg.FileNamePattern))
                    {
                        continue;
                    }

                    var transformed = InvokeCallback(reg, html);
                    if (!string.IsNullOrEmpty(transformed))
                    {
                        html = transformed;
                    }
                }
                catch
                {
                    // One bad transformation must never break the page.
                }
            }

            return html;
        }

        private static bool MatchesIndex(string? pattern)
        {
            if (string.IsNullOrEmpty(pattern))
            {
                return true;
            }

            try
            {
                return Regex.IsMatch("index.html", pattern, RegexOptions.IgnoreCase);
            }
            catch
            {
                return pattern.IndexOf("index", StringComparison.OrdinalIgnoreCase) >= 0;
            }
        }

        private static string? InvokeCallback(Jellyfin.Plugin.FileTransformation.TransformationRegistration reg, string html)
        {
            var want = reg.CallbackAssembly;
            var asm = AssemblyLoadContext.All.SelectMany(c => c.Assemblies).FirstOrDefault(a =>
                string.Equals(a.FullName, want, StringComparison.Ordinal)
                || string.Equals(a.GetName().Name, want, StringComparison.Ordinal)
                || (want != null && want.StartsWith(a.GetName().Name + ",", StringComparison.Ordinal)));

            var type = asm?.GetType(reg.CallbackClass);
            var method = type?.GetMethod(reg.CallbackMethod, BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance);
            if (method is null)
            {
                return null;
            }

            var parameters = method.GetParameters();
            if (parameters.Length != 1)
            {
                return null;
            }

            object? arg;
            var paramType = parameters[0].ParameterType;
            if (paramType == typeof(string))
            {
                arg = html;
            }
            else
            {
                // The real File Transformation plugin passes { "contents": "..." } and
                // deserializes it into the callback's own payload type. Mirror that.
                var payloadJson = JsonSerializer.Serialize(new { contents = html });
                arg = JsonSerializer.Deserialize(payloadJson, paramType, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }

            var target = method.IsStatic ? null : Activator.CreateInstance(type!);
            return method.Invoke(target, new[] { arg }) as string;
        }
    }
}
