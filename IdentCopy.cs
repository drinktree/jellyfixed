using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Data.Enums;
using MediaBrowser.Controller.MediaEncoding;
using MediaBrowser.Model.Dlna;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.MediaInfo;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.CustomTheme
{
    /// <summary>
    /// The intro as the apps without the theme are given it: a copy of the configured
    /// file, made once for each state of that file and kept in the server's data
    /// folder.
    ///
    /// Those apps keep nothing. The Android TV app's player has no cache at all: it
    /// fetches the intro from the server on every Play, as it fetches a film, and
    /// starts once it holds a few seconds of it. An intro exported the way editing
    /// programs export (4K, or 25–30 Mbit/s, the file's index at its end) makes a
    /// television on Wi-Fi wait for the first picture and then again in the middle.
    /// Measured with the real app (0.19.10) at 20 Mbit/s: 11–21 s before a 10-second
    /// intro of 30 MB appeared and 25–35 s until it was over; the same intro as a
    /// 7 Mbit/s 1080p file appeared after 1.8 s and played straight through. A device
    /// that cannot decode the file at all has the server convert it on every Play,
    /// while the viewer waits.
    ///
    /// So the apps get a copy that every one of them plays as it is and that is light
    /// to fetch: H.264 (8-bit, 4:2:0, at most 1080p and 60 frames a second, at most
    /// 8 Mbit/s), AAC stereo, in an MP4 whose index comes first. Where the file is all
    /// that already, its streams are only copied over: the picture is the original's,
    /// bit for bit. Until the copy is there (a few seconds to a few minutes after the
    /// file was chosen or changed, once) the apps are given no intro at all, and only
    /// where no copy can be made the file itself (see IdentItem.Current). The theme —
    /// web client, Jellyfin Media Player — goes on playing the original, which it keeps
    /// on the device.
    ///
    /// Made with the server's own ffmpeg, in the background, at low priority; never
    /// next to the original (that folder may be a library's).
    /// </summary>
    internal sealed class IdentCopy
    {
        // What every app can play as it is (see the Android TV app's device profile:
        // H.264 up to the device's level and size, 8-bit unless it reports High 10).
        private const int MaxWidth = 1920;
        private const int MaxHeight = 1080;
        private const double MaxLevel = 42;
        private const int MaxRefFrames = 4;
        private const double MaxFrameRate = 60.5;

        // Light enough to start within a second or two on an ordinary Wi-Fi, and
        // still more than a 1080p intro needs: the quality setting (18) decides, the
        // ceiling only catches grain and noise. A buffer of one second's worth keeps
        // even a short, grainy intro from averaging above the ceiling.
        private const int MaxBitrate = 8_000_000;
        private const string Quality = "18";
        private const string Ceiling = "8M";
        private const string Buffer = "8M";

        // Part of every copy's name. Change it whenever what Plan makes changes:
        // copies made the old way are then made anew instead of being kept.
        private const string Recipe = "1";

        private static readonly TimeSpan TimeLimit = TimeSpan.FromMinutes(30);

        private readonly IMediaEncoder _encoder;
        private readonly string _folder;
        private readonly ILogger _logger;
        private readonly Func<bool> _started;

        // Copies are known by their key (see Key): the file, its state and the recipe.
        private readonly object _gate = new();
        private readonly HashSet<string> _failed = new(StringComparer.Ordinal);
        private Task? _making;
        private string? _makingKey;
        private CancellationTokenSource? _cancel;
        private bool _closed;

        /// <param name="started">Whether the server is past its start-up, by which time it has
        /// looked for its ffmpeg: before that, "no ffmpeg" only means "not yet".</param>
        public IdentCopy(IMediaEncoder encoder, string folder, ILogger logger, Func<bool> started)
        {
            _encoder = encoder;
            _folder = folder;
            _logger = logger;
            _started = started;
        }

        /// <summary>Whether no copy can be made of this state of the file (the log says why).</summary>
        public bool Failed(IdentFile file)
        {
            var key = Key(file);
            lock (_gate)
            {
                return _failed.Contains(key);
            }
        }

        /// <summary>
        /// The copy for this state of the file, if it has been made; otherwise
        /// nothing, and the apps are given the file itself.
        /// </summary>
        public string? Ready(IdentFile file)
        {
            try
            {
                // A copy cut short (a power cut between ffmpeg and the disk) is no copy.
                var path = PathFor(Key(file));
                var info = new FileInfo(path);
                return info.Exists && info.Length >= 1024 ? path : null;
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>
        /// For the settings pages: <c>ready</c> (with its size), <c>making</c>,
        /// <c>failed</c> (since the server started; the log says why), or <c>waiting</c>.
        /// </summary>
        public (string State, long Bytes) Describe(IdentFile file)
        {
            var ready = Ready(file);
            if (ready is not null)
            {
                try
                {
                    return ("ready", new FileInfo(ready).Length);
                }
                catch (Exception)
                {
                    return ("ready", 0);
                }
            }

            var key = Key(file);
            lock (_gate)
            {
                if (_making is { IsCompleted: false } && string.Equals(_makingKey, key, StringComparison.Ordinal))
                {
                    return ("making", 0);
                }

                return _failed.Contains(key) ? ("failed", 0) : ("waiting", 0);
            }
        }

        /// <summary>
        /// Starts making the copy for this state of the file, in the background, unless
        /// it is being made already or could not be made since the server started.
        /// <paramref name="done"/> is called once it is there.
        /// </summary>
        public void Request(IdentFile file, Func<Task> done)
        {
            var key = Key(file);
            lock (_gate)
            {
                if (_closed || _failed.Contains(key))
                {
                    return;
                }

                if (_making is { IsCompleted: false })
                {
                    if (string.Equals(_makingKey, key, StringComparison.Ordinal))
                    {
                        return;
                    }

                    // The file was replaced while its old state was being copied.
                    _cancel?.Cancel();
                }

                var cancel = new CancellationTokenSource();
                var previous = _making ?? Task.CompletedTask;
                _cancel = cancel;
                _makingKey = key;
                _making = Task.Run(async () =>
                {
                    // One ffmpeg at a time: the one that was told to stop is gone first.
                    try
                    {
                        await previous.ConfigureAwait(false);
                    }
                    catch (Exception)
                    {
                        // it reported for itself
                    }

                    if (await Make(file, key, cancel.Token).ConfigureAwait(false))
                    {
                        await done().ConfigureAwait(false);
                    }
                });
            }
        }

        /// <summary>
        /// Removes every copy but <paramref name="keep"/>; with nothing to keep, also
        /// stops one that is being made. Never throws.
        /// </summary>
        public void Clear(string? keep)
        {
            lock (_gate)
            {
                if (keep is null)
                {
                    _cancel?.Cancel();
                }
            }

            try
            {
                if (!Directory.Exists(_folder))
                {
                    return;
                }

                foreach (var path in Directory.EnumerateFiles(_folder, "intro-*"))
                {
                    if (keep is not null && string.Equals(path, keep, StringComparison.Ordinal))
                    {
                        continue;
                    }

                    // A copy being made is a ".part" of the version being made.
                    if (keep is not null && IsBeingMade(path))
                    {
                        continue;
                    }

                    TryDelete(path);
                }

                if (keep is null && !Directory.EnumerateFileSystemEntries(_folder).Any())
                {
                    Directory.Delete(_folder);
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "[Custom Theme] Could not tidy the intro copies in {Folder}", _folder);
            }
        }

        /// <summary>The server is stopping, or the plugin is being uninstalled: no more ffmpeg.</summary>
        public void Close()
        {
            lock (_gate)
            {
                _closed = true;
                _cancel?.Cancel();
            }
        }

        private bool IsBeingMade(string path)
        {
            lock (_gate)
            {
                return _making is { IsCompleted: false } && _makingKey is not null
                    && string.Equals(path, PartFor(_makingKey), StringComparison.Ordinal);
            }
        }

        private string PathFor(string key) => Path.Combine(_folder, "intro-" + key + ".mp4");

        private string PartFor(string key) => Path.Combine(_folder, "intro-" + key + ".part");

        // The file's own version is its size and write time only: two files can share
        // it. A copy belongs to one file, one state of it, and one recipe.
        private static string Key(IdentFile file)
        {
            var text = string.Join(
                "\n",
                Recipe,
                file.Path,
                file.Length.ToString(CultureInfo.InvariantCulture),
                file.LastModified.UtcTicks.ToString(CultureInfo.InvariantCulture));
            return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)), 0, 8).ToLowerInvariant();
        }

        private async Task<bool> Make(IdentFile file, string key, CancellationToken cancel)
        {
            var part = PartFor(key);
            var started = Stopwatch.StartNew();
            try
            {
                var plan = await Plan(file, cancel).ConfigureAwait(false);
                if (plan.Arguments is null)
                {
                    // Not yet (the server has not found its ffmpeg so far): asked again
                    // at a later Play. Anything else stands until the file changes.
                    if (plan.Later)
                    {
                        _logger.LogDebug("[Custom Theme] The copy of the intro for apps waits: {Why}", plan.Description);
                    }
                    else
                    {
                        Fail(key, plan.Description);
                    }

                    return false;
                }

                Directory.CreateDirectory(_folder);
                _logger.LogInformation("[Custom Theme] Preparing the intro for apps without the theme: {What}", plan.Description);

                var arguments = new List<string>(plan.Arguments) { part };
                var (exit, said) = await Run(arguments, cancel).ConfigureAwait(false);
                if (exit != 0 || !File.Exists(part) || new FileInfo(part).Length < 1024)
                {
                    TryDelete(part);
                    Fail(key, "ffmpeg ended with " + exit.ToString(CultureInfo.InvariantCulture) + (said.Length > 0 ? ": " + said : string.Empty));
                    return false;
                }

                // Read back before it is handed out: a picture, and the original's length.
                var made = await Read(part, cancel).ConfigureAwait(false);
                var madeSeconds = made.RunTimeTicks is > 0 ? TimeSpan.FromTicks(made.RunTimeTicks.Value).TotalSeconds : 0;
                if (!(made.MediaStreams ?? Array.Empty<MediaStream>()).Any(s => s.Type == MediaStreamType.Video)
                    || (plan.Seconds > 0 && Math.Abs(madeSeconds - plan.Seconds) > Math.Max(1.0, plan.Seconds * 0.05)))
                {
                    TryDelete(part);
                    Fail(key, string.Format(CultureInfo.InvariantCulture, "the copy came out wrong: {0:0.#} s instead of {1:0.#} s", madeSeconds, plan.Seconds));
                    return false;
                }

                // On the disk before it gets its final name: a power cut then leaves no
                // copy or a whole one, never a short one under the name that is handed out.
                using (var written = new FileStream(part, FileMode.Open, FileAccess.ReadWrite, FileShare.Read))
                {
                    written.Flush(flushToDisk: true);
                }

                var path = PathFor(key);
                File.Move(part, path, true);
                _logger.LogInformation(
                    "[Custom Theme] The intro for apps without the theme is ready: {Size:0.0} MB, made in {Seconds:0} s ({Path})",
                    new FileInfo(path).Length / 1048576.0,
                    started.Elapsed.TotalSeconds,
                    path);
                return true;
            }
            catch (OperationCanceledException)
            {
                TryDelete(part);
                return false;
            }
            catch (Exception ex)
            {
                TryDelete(part);
                Fail(key, ex.Message);
                return false;
            }
        }

        private void Fail(string key, string why)
        {
            lock (_gate)
            {
                _failed.Add(key);
            }

            _logger.LogWarning("[Custom Theme] Could not prepare a copy of the intro for apps without the theme, so they get the file as it is ({Why})", why);
        }

        // Jellyfin's own reading of a file, as its player decisions use it.
        private Task<MediaInfo> Read(string path, CancellationToken cancel)
            => _encoder.GetMediaInfo(
                new MediaInfoRequest
                {
                    MediaType = DlnaProfileType.Video,
                    ExtractChapters = false,
                    MediaSource = new MediaSourceInfo { Path = path, Protocol = MediaProtocol.File, VideoType = VideoType.VideoFile }
                },
                cancel);

        // The ffmpeg arguments (without the output), what the log says about them, the
        // original's length in seconds, and — when there are none — whether to try again
        // later rather than give up on this state of the file.
        private sealed record Decision(IReadOnlyList<string>? Arguments, string Description, double Seconds = 0, bool Later = false);

        // What is in the file, and from that: which streams are only copied over and
        // which are made anew.
        private async Task<Decision> Plan(IdentFile file, CancellationToken cancel)
        {
            var encoder = _encoder.EncoderPath;
            if (string.IsNullOrEmpty(encoder))
            {
                return _started()
                    ? new Decision(null, "the server has no ffmpeg")
                    : new Decision(null, "the server has not looked for its ffmpeg yet", Later: true);
            }

            var info = await Read(file.Path, cancel).ConfigureAwait(false);

            var streams = info.MediaStreams ?? Array.Empty<MediaStream>();
            var video = streams.FirstOrDefault(s => s.Type == MediaStreamType.Video);
            if (video is null)
            {
                return new Decision(null, "the file has no picture");
            }

            var audio = streams.FirstOrDefault(s => s.Type == MediaStreamType.Audio);
            var seconds = info.RunTimeTicks is > 0 ? TimeSpan.FromTicks(info.RunTimeTicks.Value).TotalSeconds : 0;
            long bitrate = video.BitRate
                ?? info.Bitrate
                ?? (seconds > 0 ? (long)(file.Length * 8 / seconds) : long.MaxValue);
            var fps = video.ReferenceFrameRate ?? video.AverageFrameRate ?? 0;
            var hdr = video.VideoRange == VideoRange.HDR;

            var keepPicture = string.Equals(video.Codec, "h264", StringComparison.OrdinalIgnoreCase)
                && video.Profile is { } profile
                && (profile.Equals("High", StringComparison.OrdinalIgnoreCase)
                    || profile.Equals("Main", StringComparison.OrdinalIgnoreCase)
                    || profile.Equals("Baseline", StringComparison.OrdinalIgnoreCase)
                    || profile.Equals("Constrained Baseline", StringComparison.OrdinalIgnoreCase))
                && (video.BitDepth ?? 8) <= 8
                && (string.IsNullOrEmpty(video.PixelFormat) || video.PixelFormat is "yuv420p" or "yuvj420p")
                && (video.Level ?? 0) <= MaxLevel
                && video.Width is > 0 and <= MaxWidth
                && video.Height is > 0 and <= MaxHeight
                && (video.RefFrames ?? 0) <= MaxRefFrames
                && !video.IsInterlaced
                && video.IsAnamorphic != true
                && !hdr
                && (video.Rotation ?? 0) == 0
                && fps <= MaxFrameRate
                && bitrate <= MaxBitrate;

            var keepSound = audio is not null
                && string.Equals(audio.Codec, "aac", StringComparison.OrdinalIgnoreCase)
                && (string.IsNullOrEmpty(audio.Profile) || audio.Profile.Contains("LC", StringComparison.OrdinalIgnoreCase))
                && (audio.Channels ?? 2) <= 2;

            var arguments = new List<string>
            {
                "-hide_banner", "-nostdin", "-nostats", "-loglevel", "error", "-y",
                "-i", file.Path,
                "-map", "0:V:0"
            };
            if (audio is not null)
            {
                arguments.AddRange(new[] { "-map", "0:a:0?" });
            }

            arguments.AddRange(new[] { "-map_metadata", "-1", "-map_chapters", "-1", "-sn", "-dn", "-max_muxing_queue_size", "2048" });

            var source = string.Format(
                CultureInfo.InvariantCulture,
                "{0}x{1} {2}{3}{4} at {5:0.#} Mbit/s",
                video.Width,
                video.Height,
                video.Codec,
                string.IsNullOrEmpty(video.Profile) ? string.Empty : " " + video.Profile,
                hdr ? " HDR" : string.Empty,
                bitrate == long.MaxValue ? 0 : bitrate / 1_000_000.0);

            if (keepPicture)
            {
                arguments.AddRange(new[] { "-c:v", "copy" });
            }
            else
            {
                var filters = new List<string>();
                if (video.IsInterlaced)
                {
                    filters.Add("yadif=0:-1:0");
                }

                // Square pixels: not every app honours a stored pixel shape (Roku's
                // converts such a file on every Play).
                if (video.IsAnamorphic == true)
                {
                    filters.Add("scale=w='trunc(iw*sar/2)*2':h=ih:flags=lanczos,setsar=1");
                }

                filters.Add("scale=w='min(" + MaxWidth.ToString(CultureInfo.InvariantCulture) + ",iw)':h='min("
                    + MaxHeight.ToString(CultureInfo.InvariantCulture) + ",ih)':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos");

                if (hdr)
                {
                    // To ordinary picture, the way Jellyfin itself does it in software.
                    if (_encoder.SupportsFilter("tonemapx"))
                    {
                        filters.Add("tonemapx=tonemap=bt2390:desat=0:peak=100:t=bt709:m=bt709:p=bt709:format=yuv420p");
                    }
                    else if (_encoder.SupportsFilter("zscale"))
                    {
                        filters.Add("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p");
                    }
                    else
                    {
                        // Without either the colours would come out washed out: the apps
                        // are better served by the file itself and Jellyfin's own conversion.
                        return new Decision(null, "the file is HDR (" + source + ") and this ffmpeg cannot turn it into ordinary picture");
                    }
                }
                else
                {
                    filters.Add("format=yuv420p");
                }

                // aq-mode 3 gives dark areas their share of the bits: an intro is often a
                // logo on a dark ground, where 8-bit H.264 shows bands in a gradient first.
                // -fpsmax always: a phone's variable frame rate can declare 90 or 120 a
                // second while its average looks harmless, and the level would follow.
                arguments.AddRange(new[]
                {
                    "-vf", string.Join(",", filters),
                    "-c:v", "libx264", "-preset", "medium", "-crf", Quality, "-maxrate", Ceiling, "-bufsize", Buffer,
                    "-profile:v", "high", "-pix_fmt", "yuv420p", "-x264-params", "aq-mode=3", "-fpsmax", "60"
                });

                if (hdr)
                {
                    arguments.AddRange(new[] { "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709" });
                }
            }

            if (audio is not null)
            {
                arguments.AddRange(keepSound
                    ? new[] { "-c:a", "copy" }
                    : new[] { "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000" });
            }

            arguments.AddRange(new[] { "-movflags", "+faststart", "-f", "mp4" });

            var what = (keepPicture
                    ? "picture copied as it is (" + source + ")"
                    : "picture made anew as H.264, at most 1080p and 8 Mbit/s (it is " + source + ")")
                + (audio is null ? ", no sound" : keepSound ? ", sound copied" : ", sound made anew as AAC stereo");
            return new Decision(arguments, what, seconds);
        }

        private async Task<(int Exit, string Said)> Run(IReadOnlyList<string> arguments, CancellationToken cancel)
        {
            var start = new ProcessStartInfo(_encoder.EncoderPath)
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardError = true,
                RedirectStandardOutput = true
            };
            foreach (var argument in arguments)
            {
                start.ArgumentList.Add(argument);
            }

            using var limit = CancellationTokenSource.CreateLinkedTokenSource(cancel);
            limit.CancelAfter(TimeLimit);

            using var process = new Process { StartInfo = start };
            var said = new StringBuilder();
            process.ErrorDataReceived += (_, e) =>
            {
                if (e.Data is null)
                {
                    return;
                }

                lock (said)
                {
                    if (said.Length < 2000)
                    {
                        said.Append(e.Data).Append(' ');
                    }
                }
            };
            process.OutputDataReceived += (_, _) => { };

            process.Start();
            try
            {
                // Playback comes first: a film that is being converted for somebody
                // must not stutter because the intro is being prepared.
                process.PriorityClass = ProcessPriorityClass.BelowNormal;
            }
            catch (Exception)
            {
                // not allowed here; it runs at the server's own priority
            }

            process.BeginErrorReadLine();
            process.BeginOutputReadLine();
            try
            {
                await process.WaitForExitAsync(limit.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                try
                {
                    process.Kill(true);
                }
                catch (Exception)
                {
                    // already gone
                }

                if (cancel.IsCancellationRequested)
                {
                    throw;
                }

                return (-1, "took longer than " + TimeLimit.TotalMinutes.ToString(CultureInfo.InvariantCulture) + " minutes");
            }

            lock (said)
            {
                return (process.ExitCode, said.ToString().Trim());
            }
        }

        private static void TryDelete(string path)
        {
            try
            {
                File.Delete(path);
            }
            catch (Exception)
            {
                // in use (an app is fetching it right now) or already gone: next time
            }
        }
    }
}
