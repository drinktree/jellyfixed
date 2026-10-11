using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

namespace Jellyfin.Plugin.CustomTheme
{
    /// <summary>
    /// The two things the theme serves over HTTP itself. Everything else it ships
    /// travels inside the stylesheet or inside index.html; these cannot:
    ///
    ///   Brand files — the icons a browser or a phone asks for by URL (tab icon,
    ///   home-screen icon, web-app manifest) and the splash image. They are linked from
    ///   index.html by <see cref="ThemeTransformation"/> and must answer before anyone
    ///   has signed in, so they are anonymous. Only names in <see cref="BrandFiles"/>
    ///   exist; each is an embedded resource.
    ///
    ///   The ident — the one video file an administrator points the theme at
    ///   (<see cref="PluginConfiguration.IdentPath"/>), which headerButton.js plays
    ///   itself before a film. Signed-in users only (the script appends its token as
    ///   <c>ApiKey</c>, the query form 12.x accepts), with range requests, because a
    ///   &lt;video&gt; asks for ranges and Safari will not play without them.
    ///
    /// Jellyfin registers controllers it finds in plugin assemblies, and routes them
    /// inside its base-URL map, so <c>CustomTheme/…</c> is correct under a sub-path
    /// too. index.html links the brand files as <c>../CustomTheme/Brand/…</c>: the
    /// document always sits one level below the base, at <c>/web/</c>.
    /// </summary>
    [ApiController]
    [Route("CustomTheme")]
    // Not an API for anyone: three addresses the theme's own pages use. Kept out of the
    // server's OpenAPI document (a GET and a HEAD on one action would also put the
    // same operation id into it twice).
    [ApiExplorerSettings(IgnoreApi = true)]
    public class ThemeAssetsController : ControllerBase
    {
        private const string AssetPrefix = "Jellyfin.Plugin.CustomTheme.Assets.";

        /// <summary>Every file the brand route will ever return, and its type.</summary>
        private static readonly Dictionary<string, string> BrandFiles = new(StringComparer.Ordinal)
        {
            ["villa-favicon-64.png"] = "image/png",
            ["villa-icon-180.png"] = "image/png",
            ["villa-icon-192.png"] = "image/png",
            ["villa-icon-512.png"] = "image/png",
            ["villa-lockup.webp"] = "image/webp"
        };

        /// <summary>
        /// The web-app manifest. Every URL in it is relative to the manifest's own
        /// address (…/CustomTheme/Brand/), so it holds under any base URL: the icons
        /// are siblings, and the app starts two levels up, in /web/. The icons carry
        /// the plugin version like every other address of a brand file, so a later
        /// build with new art is a new address.
        /// </summary>
        private static readonly string BrandManifest = BuildManifest();

        private static string BuildManifest()
        {
            var v = "?v=" + (typeof(ThemeAssetsController).Assembly.GetName().Version?.ToString() ?? "0");
            return "{\"name\":\"Villa Cocquette\",\"short_name\":\"Villa Cocquette\",\"lang\":\"en\","
                + "\"start_url\":\"../../web/index.html#/home\",\"scope\":\"../../web/\",\"display\":\"standalone\","
                + "\"theme_color\":\"#000000\",\"background_color\":\"#000000\",\"icons\":["
                + "{\"src\":\"villa-icon-192.png" + v + "\",\"sizes\":\"192x192\",\"type\":\"image/png\"},"
                + "{\"src\":\"villa-icon-512.png" + v + "\",\"sizes\":\"512x512\",\"type\":\"image/png\"},"
                + "{\"src\":\"villa-icon-512.png" + v + "\",\"sizes\":\"512x512\",\"type\":\"image/png\",\"purpose\":\"maskable\"}]}";
        }

        /// <summary>One of the brand's files, or its web-app manifest.</summary>
        [HttpGet("Brand/{name}")]
        [HttpHead("Brand/{name}")]
        [AllowAnonymous]
        public IActionResult GetBrandFile([FromRoute] string name)
        {
            if (string.Equals(name, "manifest.webmanifest", StringComparison.Ordinal))
            {
                Response.Headers[HeaderNames.CacheControl] = "public, max-age=3600";
                return Content(BrandManifest, "application/manifest+json", Encoding.UTF8);
            }

            if (name is null || !BrandFiles.TryGetValue(name, out var contentType))
            {
                return NotFound();
            }

            var stream = typeof(ThemeAssetsController).Assembly.GetManifestResourceStream(AssetPrefix + name);
            if (stream is null)
            {
                return NotFound();
            }

            // A year only for an address that carries a version (every address the
            // theme itself writes does): that one changes when the picture can.
            Response.Headers[HeaderNames.CacheControl] = Request.Query.ContainsKey("v")
                ? "public, max-age=31536000"
                : "public, max-age=3600";
            return File(stream, contentType);
        }

        /// <summary>The configured ident video, with range support.</summary>
        [HttpGet("Ident")]
        [HttpHead("Ident")]
        [Authorize]
        public IActionResult GetIdent()
        {
            var file = IdentFile.Resolve(Plugin.Instance?.Configuration);
            if (file is null)
            {
                return NotFound();
            }

            // The address carries the file's own version (and the caller's token), so
            // a replaced file is a new address and this one never has to be re-asked.
            Response.Headers[HeaderNames.CacheControl] = "private, max-age=31536000";
            return PhysicalFile(
                file.Path,
                file.ContentType,
                file.LastModified,
                new EntityTagHeaderValue("\"" + file.Version + "\""),
                enableRangeProcessing: true);
        }

        /// <summary>
        /// For the settings pages: whether the server can use the file at a path, and
        /// if not, why. Administrators only — it answers about any path on the server.
        /// </summary>
        [HttpGet("Ident/Check")]
        [Authorize(Policy = "RequiresElevation")]
        public IActionResult CheckIdent([FromQuery] string? path)
        {
            var look = IdentFile.Check(path, fresh: true);
            Response.Headers[HeaderNames.CacheControl] = "no-store";
            return new JsonResult(new Dictionary<string, object>
            {
                ["Ok"] = look.File != null,
                ["Reason"] = look.Reason,
                ["Bytes"] = look.Bytes
            });
        }
    }

    /// <summary>
    /// The ident file as the server will actually serve it — or nothing. The path is
    /// an administrator's free text, so it is only accepted when it names an existing,
    /// non-empty regular file of a type a browser plays, under a size no pre-roll has
    /// any business exceeding. It never leaves the server: clients get an address and
    /// a version (see <see cref="ThemeTransformation"/>), not the path.
    ///
    /// It is asked for on EVERY index.html (the page carries the address), so the
    /// look at the disk is remembered for a few seconds and never waited on for long:
    /// a path on a network share that has stopped answering would otherwise hold up
    /// the page that has the switch to turn this off. A look that is merely SLOW (a
    /// disk that was asleep) still reports when it comes back, and until then the
    /// page keeps the address of the file as it was last seen — see
    /// <see cref="ResolveForPage"/>.
    /// </summary>
    internal sealed class IdentFile
    {
        private const long MaxBytes = 300L * 1024 * 1024;
        private const int LookLimitMs = 1500;
        private static readonly TimeSpan Remembered = TimeSpan.FromSeconds(10);
        private static readonly TimeSpan RememberedSlow = TimeSpan.FromSeconds(60);

        private static readonly Dictionary<string, string> Types = new(StringComparer.OrdinalIgnoreCase)
        {
            [".mp4"] = "video/mp4",
            [".m4v"] = "video/mp4",
            [".webm"] = "video/webm"
        };

        private static readonly object Gate = new();
        private static string? _seenPath;
        private static Look _seen = new(null, "none", 0);
        private static DateTime _seenUntil = DateTime.MinValue;
        private static string? _lookingAt;
        private static Task<Look>? _looking;

        // The file as it was the last time a look at this path came back with one.
        private static string? _goodPath;
        private static IdentFile? _good;

        private IdentFile(string path, string contentType, DateTimeOffset lastModified, string version, long length)
        {
            Path = path;
            ContentType = contentType;
            LastModified = lastModified;
            Version = version;
            Length = length;
        }

        /// <summary>The file itself: where the configured path is a link, its target.</summary>
        public string Path { get; }

        public long Length { get; }

        public string ContentType { get; }

        public DateTimeOffset LastModified { get; }

        /// <summary>Changes whenever the file's size or write time does.</summary>
        public string Version { get; }

        /// <summary>
        /// The configured file, if the feature is on and the file is usable NOW. Strict:
        /// this is what the video route serves from, and a file on a disk that is not
        /// answering must not be handed to it (it would wait on that disk itself).
        /// </summary>
        public static IdentFile? Resolve(PluginConfiguration? config)
        {
            if (config is null || !config.IdentEnabled)
            {
                return null;
            }

            return Check(config.IdentPath, fresh: false).File;
        }

        /// <summary>
        /// The file whose address goes into the page. As <see cref="Resolve"/>, except
        /// that while the disk is only slow to answer the file as it was last seen is
        /// kept: the page that woke a sleeping disk is very often the television that
        /// was just switched on, and it lives with what it was served for days. If the
        /// file really is gone the video route says so, and the script falls back.
        /// </summary>
        public static IdentFile? ResolveForPage(PluginConfiguration? config)
        {
            if (config is null || !config.IdentEnabled)
            {
                return null;
            }

            var look = Check(config.IdentPath, fresh: false);
            if (look.File != null || !string.Equals(look.Reason, "slow", StringComparison.Ordinal))
            {
                return look.File;
            }

            var path = config.IdentPath?.Trim();
            lock (Gate)
            {
                return string.Equals(_goodPath, path, StringComparison.Ordinal) ? _good : null;
            }
        }

        /// <summary>
        /// One look at a path: the file, or why there is none — <c>none</c> (no path),
        /// <c>missing</c>, <c>folder</c>, <c>type</c>, <c>empty</c>, <c>large</c>,
        /// <c>unreadable</c>, or <c>slow</c> when the disk did not answer in time.
        /// <paramref name="fresh"/> skips what is remembered (the settings page asks
        /// about a path that was typed a moment ago).
        /// </summary>
        public static Look Check(string? rawPath, bool fresh)
        {
            var path = rawPath?.Trim();
            if (string.IsNullOrEmpty(path))
            {
                return new Look(null, "none", 0);
            }

            Task<Look> look;
            lock (Gate)
            {
                if (!fresh && string.Equals(_seenPath, path, StringComparison.Ordinal) && DateTime.UtcNow < _seenUntil)
                {
                    return _seen;
                }

                // One look at a time per path: a look that never returns (a dead
                // share) is joined by later callers, not multiplied by them.
                if (_looking is { IsCompleted: false } && string.Equals(_lookingAt, path, StringComparison.Ordinal))
                {
                    look = _looking;
                }
                else
                {
                    look = _looking = Task.Run(() => LookAt(path));
                    _lookingAt = path;

                    // Whenever it comes back — in time or long after the caller gave
                    // up — its answer is what is known about this path.
                    look.ContinueWith(
                        done =>
                        {
                            var answer = done.Status == TaskStatus.RanToCompletion ? done.Result : new Look(null, "unreadable", 0);
                            lock (Gate)
                            {
                                if (ReferenceEquals(_looking, done))
                                {
                                    Remember(path, answer);
                                }
                            }
                        },
                        TaskScheduler.Default);
                }
            }

            var answered = false;
            try
            {
                answered = look.Wait(LookLimitMs);
            }
            catch (Exception)
            {
                answered = true;
            }

            lock (Gate)
            {
                if (answered || look.IsCompleted)
                {
                    var answer = look.Status == TaskStatus.RanToCompletion ? look.Result : new Look(null, "unreadable", 0);
                    if (ReferenceEquals(_looking, look))
                    {
                        Remember(path, answer);
                    }

                    return answer;
                }

                // Still looking. Nobody waits on this disk again for a minute — or
                // until it answers, whichever comes first — and what was known about
                // the file before is left as it is.
                var slow = new Look(null, "slow", 0);
                if (ReferenceEquals(_looking, look))
                {
                    _seenPath = path;
                    _seen = slow;
                    _seenUntil = DateTime.UtcNow + RememberedSlow;
                }

                return slow;
            }
        }

        // Caller holds Gate.
        private static void Remember(string path, Look answer)
        {
            _seenPath = path;
            _seen = answer;
            _seenUntil = DateTime.UtcNow + Remembered;
            if (answer.File != null)
            {
                _goodPath = path;
                _good = answer.File;
            }
            else if (string.Equals(_goodPath, path, StringComparison.Ordinal))
            {
                // A definite "no" for the path the kept file belongs to.
                _goodPath = null;
                _good = null;
            }
        }

        private static Look LookAt(string path)
        {
            try
            {
                if (Directory.Exists(path))
                {
                    return new Look(null, "folder", 0);
                }

                var info = new FileInfo(path);
                if (!info.Exists)
                {
                    return new Look(null, "missing", 0);
                }

                // By the name the administrator chose: a link called intro.mp4 is an
                // .mp4 whatever its target is called.
                if (!Types.TryGetValue(info.Extension, out var contentType))
                {
                    return new Look(null, "type", 0);
                }

                // A link is measured, and served, as the file it leads to. FileInfo
                // reports a link's OWN size and time, and the server's file sender
                // checks a byte range against whatever path it is handed — so the
                // link's would make a replaced video look unchanged for a year and
                // every range request fail.
                var real = info;
                if (info.LinkTarget != null)
                {
                    if (info.ResolveLinkTarget(returnFinalTarget: true) is not FileInfo target || !target.Exists)
                    {
                        return new Look(null, "missing", 0);
                    }

                    real = target;
                }

                long length;
                DateTime written;

                // Readable by the server's own account, not merely listed — and the
                // size and time are the open file's, which cannot be a link's.
                using (var stream = new FileStream(real.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 1))
                {
                    length = stream.Length;
                    written = File.GetLastWriteTimeUtc(stream.SafeFileHandle);
                    if (length <= 0)
                    {
                        return new Look(null, "empty", 0);
                    }

                    if (length > MaxBytes)
                    {
                        return new Look(null, "large", length);
                    }

                    stream.ReadByte();
                }

                var version = (length ^ written.Ticks).ToString("x", CultureInfo.InvariantCulture);
                return new Look(
                    new IdentFile(real.FullName, contentType, new DateTimeOffset(written, TimeSpan.Zero), version, length),
                    "ok",
                    length);
            }
            catch (Exception)
            {
                // No permission, a vanished share: no ident, and the page says so by
                // simply not having one.
                return new Look(null, "unreadable", 0);
            }
        }

        /// <summary>What a look at a path found.</summary>
        internal sealed record Look(IdentFile? File, string Reason, long Bytes);
    }
}
