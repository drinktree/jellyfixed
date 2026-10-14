using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Database.Implementations.Entities;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.MediaEncoding;
using MediaBrowser.Controller.Providers;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.IO;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.CustomTheme
{
    /// <summary>
    /// The ident for every app that does not show the theme.
    ///
    /// headerButton.js plays the ident itself, inside the web client. An app with an
    /// interface of its own — Android TV, Roku, Kodi … — never loads that script.
    /// Before a film it asks the SERVER whether there is something to play first
    /// ("Cinema mode": GET Items/{id}/Intros), and Jellyfin passes the question on to
    /// every <see cref="IIntroProvider"/> it finds in a plugin. This is ours: the same
    /// file under the same rules (films, and episodes when asked for), handed over as
    /// an ordinary video which such an app plays with its own player and controls.
    ///
    /// A web client that runs the theme's script asks the same question wherever the
    /// script has not played the ident itself — and takes this entry out of the
    /// answer again (nfIdentOwnOut in headerButton.js): where the theme runs, the
    /// theme alone decides about its intro, and Jellyfin's player never shows it a
    /// second time or in its place. A web client WITHOUT the script (one that
    /// carries its own copy of the interface) is an app like any other here.
    ///
    /// Jellyfin finds this class by its interface and builds it with its services.
    /// </summary>
    public class ThemeIntroProvider : IIntroProvider
    {
        private static readonly IEnumerable<IntroInfo> None = Array.Empty<IntroInfo>();

        private readonly IdentItem _ident;
        private readonly ILogger<ThemeIntroProvider> _logger;
        private readonly IHttpContextAccessor? _http;

        public ThemeIntroProvider(IdentItem ident, ILogger<ThemeIntroProvider> logger, IHttpContextAccessor? http = null)
        {
            _ident = ident;
            _logger = logger;
            _http = http;
        }

        /// <inheritdoc />
        public string Name => "Custom Theme";

        /// <inheritdoc />
        public async Task<IEnumerable<IntroInfo>> GetIntros(BaseItem item, User user)
        {
            try
            {
                var config = Plugin.Instance?.Configuration;
                if (!IdentItem.Wanted(config))
                {
                    return None;
                }

                // The rule the script applies in the web client, type for type.
                if (item is not Movie && !(item is Episode && config!.IdentEpisodes))
                {
                    return None;
                }

                // Jellyfin's own web player only goes on from one entry of its queue to
                // the next for a user who has "play next episode automatically" on: for
                // one who has switched that off it would play the intro and then stop,
                // the film never starting. So such a user is not given one in a web
                // player (any browser engine; a television's built-in copy of the web
                // interface is the one that gets here — where the theme's script runs
                // it takes the entry out anyway). Apps with a player of their own go on
                // regardless of that setting and are not concerned.
                if (user is not null && !user.EnableNextEpisodeAutoPlay && AskedByWebPlayer())
                {
                    return None;
                }

                var id = await _ident.Current(user, item.Path).ConfigureAwait(false);
                return id.HasValue ? new[] { new IntroInfo { ItemId = id.Value } } : None;
            }
            catch (Exception ex)
            {
                // Whoever asked is waiting to start a film: it starts without.
                _logger.LogWarning(ex, "[Custom Theme] Could not offer the intro to this app");
                return None;
            }
        }

        // Every browser engine says "Mozilla/…" first, and no app with its own player does.
        private bool AskedByWebPlayer()
        {
            var agent = _http?.HttpContext?.Request.Headers.UserAgent.ToString();
            return !string.IsNullOrEmpty(agent) && agent.StartsWith("Mozilla/", StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>
    /// The ident as an item Jellyfin can hand to an app. An app is given an item, not
    /// a file: it asks the server how to play that item and then streams it like any
    /// other, direct or transcoded. So the configured file is entered into Jellyfin's
    /// database as one video that belongs to no library — it is in no list, no search
    /// and no row; only its id opens it.
    ///
    /// ONE item, under an id of its own (never one derived from the path: a file that
    /// also sits inside a library keeps that library's own entry, untouched). It is
    /// made when the feature is on and the file is there, made anew when the file is
    /// another or has changed (nothing read from the old file is kept), and taken out
    /// again when the feature is switched off or the plugin is uninstalled. Removing
    /// it removes the ENTRY, never the file.
    ///
    /// What it points at is the copy prepared for apps (<see cref="IdentCopy"/>) as
    /// soon as that is there — and the configured file itself until then, or for good
    /// if no copy can be made. Switching from one to the other is a "made anew" like
    /// any other. While it points at the file and a copy is still to come it is not
    /// handed out (<see cref="Current"/>).
    /// </summary>
    public sealed class IdentItem
    {
        /// <summary>The item's id, on every server.</summary>
        internal static readonly Guid Id = new("c7a1e2f4-5b3d-4c8e-9a60-1d2f3e4b5c6d");

        // Where the item remembers which state of the file it was made from.
        private const string VersionKey = "CustomThemeIntro";
        private const string ItemName = "Intro";

        // How long a Play may wait for the item to be made. Longer than a look at a
        // local file and its probe take; a film is not held up for more than this.
        private const int WaitMs = 2500;
        private const int ProbeLimitSeconds = 60;

        private readonly ILibraryManager _library;
        private readonly IFileSystem _fileSystem;
        private readonly IServerApplicationHost _appHost;
        private readonly ILogger<IdentItem> _logger;
        private readonly IdentCopy _copy;
        private readonly SemaphoreSlim _oneAtATime = new(1, 1);

        // Set when the plugin is being uninstalled. Its code goes on running until the
        // server restarts, and must not put the entry back at the next Play — there
        // would be nothing left afterwards to take it out again.
        private static volatile bool _retired;

        public IdentItem(
            ILibraryManager library,
            IFileSystem fileSystem,
            IServerApplicationHost appHost,
            IMediaEncoder encoder,
            IApplicationPaths paths,
            ILogger<IdentItem> logger)
        {
            _library = library;
            _fileSystem = fileSystem;
            _appHost = appHost;
            _logger = logger;

            // The server's data folder: kept like its database (the cache folder is
            // emptied of anything a month old).
            _copy = new IdentCopy(encoder, Path.Combine(paths.DataPath, "custom-theme"), logger, () => appHost.CoreStartupHasCompleted);
            Instance = this;
        }

        /// <summary>For the one caller that has no services to ask: the uninstall.</summary>
        internal static IdentItem? Instance { get; private set; }

        /// <summary>Whether the settings ask for the ident to be offered to apps at all.</summary>
        internal static bool Wanted(PluginConfiguration? config)
            => !_retired && config is { IdentEnabled: true, IdentApps: true } && !string.IsNullOrWhiteSpace(config.IdentPath);

        /// <summary>
        /// The id to hand to this user NOW, or nothing. Asked on every Play of every
        /// app, so the usual answer costs one remembered look at the file and one
        /// cached item. If the item has yet to be made or brought up to date (the file
        /// has only just appeared, or changed), that is started and waited for
        /// briefly; a Play that comes too early for it simply goes without.
        /// <paramref name="playing"/> is the file about to be played: the intro is not
        /// shown before itself (the file may also be a film in a library).
        /// </summary>
        public async Task<Guid?> Current(User? user, string? playing = null)
        {
            var config = Plugin.Instance?.Configuration;
            if (!Wanted(config))
            {
                return null;
            }

            var file = IdentFile.Resolve(config);
            if (file is null || string.Equals(playing, file.Path, StringComparison.Ordinal))
            {
                return null;
            }

            // Not there, not this file — or being made at this very moment (its fields
            // are set before its media information has been read): wait for that, on
            // another thread, so that all of it is under the limit. Not in a server's
            // first moments, before it can read a media file at all.
            if (_oneAtATime.CurrentCount == 0 || !Matches(_library.GetItemById(Id), file, Target(file)))
            {
                if (!_appHost.CoreStartupHasCompleted)
                {
                    return null;
                }

                var sync = Task.Run(Sync);
                var first = await Task.WhenAny(sync, Task.Delay(WaitMs)).ConfigureAwait(false);
                if (first != sync || await sync.ConfigureAwait(false) is null)
                {
                    return null;
                }
            }

            // Apps are given the copy made for them. While it is still to come they go
            // without: the file itself is what kept a television waiting, and once the
            // copy is there the entry is made anew under this same id — an app still
            // fetching the file by that id would then be handed bytes of the other one.
            // Only where no copy can be made (the log says why) is the file itself given.
            if (string.Equals(Target(file), file.Path, StringComparison.Ordinal) && !_copy.Failed(file))
            {
                // Nothing is started twice, and a copy that could not be made is not
                // tried again — this only picks up one that was never asked for.
                _copy.Request(file, async () => await Sync().ConfigureAwait(false));
                return null;
            }

            // Jellyfin hands an intro to whoever asks, but refuses to say how to play
            // an item its parental settings hide from that user (one who may only see
            // certain tags, for one). An app given such an item has a queue whose
            // first entry cannot be opened — so it is this test, Jellyfin's own, that
            // decides here, before the app is told about anything.
            if (user is not null && _library.GetItemById<Video>(Id, user) is null)
            {
                return null;
            }

            return Id;
        }

        /// <summary>
        /// Brings the item into line with the settings and the file: at start-up, after
        /// every save of the settings, and from <see cref="Current"/>. Never throws.
        /// </summary>
        public async Task<Guid?> Sync()
        {
            await _oneAtATime.WaitAsync().ConfigureAwait(false);
            try
            {
                return await SyncCore().ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Custom Theme] Could not prepare the intro for apps without the theme");
                return null;
            }
            finally
            {
                _oneAtATime.Release();
            }
        }

        /// <summary>
        /// At start-up: once the server is ready to look at a media file (it validates
        /// its ffmpeg after the plugins' own start).
        /// </summary>
        public async Task SyncWhenStarted(CancellationToken stopping)
        {
            try
            {
                for (var i = 0; i < 240 && !_appHost.CoreStartupHasCompleted; i++)
                {
                    await Task.Delay(500, stopping).ConfigureAwait(false);
                }

                await Sync().ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                // the server is stopping
            }
        }

        /// <summary>
        /// Whether the intro's own file has an audio stream with this number — the one
        /// an app "chose" while it played the intro (see <see cref="IdentHandOver"/>).
        /// </summary>
        internal bool HasAudioStream(int index)
        {
            try
            {
                if (_library.GetItemById(Id) is not Video video)
                {
                    return false;
                }

                foreach (var stream in video.GetMediaStreams())
                {
                    if (stream.Type == MediaStreamType.Audio && stream.Index == index)
                    {
                        return true;
                    }
                }

                return false;
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>How long the intro runs, as far as Jellyfin knows.</summary>
        internal TimeSpan Length()
        {
            try
            {
                var ticks = (_library.GetItemById(Id) as Video)?.RunTimeTicks;
                return ticks is > 0 ? TimeSpan.FromTicks(ticks.Value) : TimeSpan.Zero;
            }
            catch (Exception)
            {
                return TimeSpan.Zero;
            }
        }

        /// <summary>Whether an item is one the intro is shown before: a film or an episode.</summary>
        internal bool IsFilm(Guid itemId)
        {
            try
            {
                return _library.GetItemById(itemId) is Movie or Episode;
            }
            catch (Exception)
            {
                return true;
            }
        }

        /// <summary>
        /// Takes the item out for good: the plugin is being uninstalled. From here on
        /// nothing is offered and nothing is made again (see <see cref="Wanted"/>).
        /// </summary>
        public void Remove()
        {
            _retired = true;
            _copy.Close();

            // An uninstall does not wait for long on a file that is slow to read; the
            // pass that is reading it takes the entry out itself when it is done. The
            // copies go either way.
            if (!_oneAtATime.Wait(TimeSpan.FromSeconds(15)))
            {
                _copy.Clear(null);
                return;
            }

            try
            {
                var existing = _library.GetItemById(Id);
                if (existing is not null)
                {
                    Remove(existing);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Custom Theme] Could not remove the intro's library entry");
            }
            finally
            {
                _oneAtATime.Release();
            }

            // The copies are the plugin's own; nothing of it is left behind.
            _copy.Clear(null);
        }

        /// <summary>The server is stopping: a copy that is being made is abandoned.</summary>
        public void Stop() => _copy.Close();

        /// <summary>Where the copy for apps stands, for the settings pages.</summary>
        internal (string State, long Bytes) CopyState(IdentFile file) => _copy.Describe(file);

        private async Task<Guid?> SyncCore()
        {
            var config = Plugin.Instance?.Configuration;
            var existing = _library.GetItemById(Id);

            if (!Wanted(config))
            {
                if (existing is not null)
                {
                    Remove(existing);
                }

                _copy.Clear(null);
                return null;
            }

            // On, but no usable file at this moment (missing, or a disk that is slow to
            // wake): nothing to hand out. An item that exists is left alone — it is
            // only handed out again once the file is back and still the same.
            var file = IdentFile.Resolve(config);
            if (file is null)
            {
                return null;
            }

            var target = Target(file);
            if (Matches(existing, file, target))
            {
                Settle(file, target);
                return Id;
            }

            // Another file, or the same one changed: made anew, not pointed elsewhere.
            // What Jellyfin has read from the old file (container, streams, length)
            // would otherwise stand for the new one whenever the reading below fails,
            // and Jellyfin only reads again by itself where it has nothing at all.
            if (existing is not null)
            {
                Remove(existing);
            }

            // Entered WITHOUT its path, which follows in the save below. Jellyfin
            // announces every new item that has a path to all open clients, and the
            // web client turns that into a "New Video" notification. This is not news
            // to anybody; a change to an existing item is passed on quietly.
            // And dated long ago: should the same file also be an item of a library,
            // Jellyfin's own look-ups by path take the NEWER entry — the library's,
            // as if this one were not there.
            var video = new Video { Id = Id, Name = ItemName, DateCreated = DateTime.UnixEpoch };
            _library.CreateItem(video, null);

            video.Path = target;

            // "This file shares its folder with files that are not its own." Without it
            // Jellyfin takes the folder for the video's own — and an administrator who
            // deleted the entry from an item page would delete that FOLDER.
            video.IsInMixedFolder = true;

            // Nothing a file may carry inside (a title, a rating, genres) is read onto
            // it: it stays "Intro", and no embedded rating can hide it from a user with
            // parental controls.
            video.IsLocked = true;

            // The write time of the file it points at, to the second: should it differ,
            // Jellyfin's reading below takes the file for a changed one and re-dates
            // the entry to the file's own creation (the copy's: today), undoing the
            // "long ago" above.
            video.DateModified = string.Equals(target, file.Path, StringComparison.Ordinal)
                ? file.LastModified.UtcDateTime
                : File.GetLastWriteTimeUtc(target);
            video.SetProviderId(VersionKey, file.Version);

            // "Import", the weakest reason there is: no metadata file is ever written
            // next to the video for it.
            await video.UpdateToRepositoryAsync(ItemUpdateType.MetadataImport, CancellationToken.None).ConfigureAwait(false);
            _logger.LogInformation("[Custom Theme] The intro is offered to apps without the theme as item {Id} ({Path})", Id, target);

            await Probe(video).ConfigureAwait(false);

            // Uninstalled while this was under way.
            if (_retired)
            {
                Remove(video);
                return null;
            }

            Settle(file, target);
            return Id;
        }

        // What apps are given: the copy made for them once it is there, else the file.
        private string Target(IdentFile file) => _copy.Ready(file) ?? file.Path;

        // While apps are given the file itself, the copy is asked for (once per state
        // of the file; when it is done, Sync points the item at it). Once they are
        // given the copy, older copies go.
        private void Settle(IdentFile file, string target)
        {
            if (string.Equals(target, file.Path, StringComparison.Ordinal))
            {
                _copy.Request(file, async () => await Sync().ConfigureAwait(false));
            }
            else
            {
                _copy.Clear(target);
            }
        }

        private static bool Matches(BaseItem? item, IdentFile file, string target)
            => item is Video video
                && video.IsInMixedFolder
                && string.Equals(video.Path, target, StringComparison.Ordinal)
                && string.Equals(video.GetProviderId(VersionKey), file.Version, StringComparison.Ordinal);

        // The entry only. DeleteFileLocation is what would make Jellyfin delete from
        // the disk as well, and it is off. The entry also forgets its path first:
        // with a path, Jellyfin clears away the data it may have put NEXT to the file
        // (a "<name>.trickplay" folder) — and if the file is also in a library, that
        // folder is the library's, not this entry's.
        private void Remove(BaseItem item)
        {
            item.Path = null;
            _library.DeleteItem(item, new DeleteOptions { DeleteFileLocation = false });
            _logger.LogInformation("[Custom Theme] The intro's library entry {Id} was removed (the file is untouched)", Id);
        }

        // Length, container and streams, read once so that an app is told from its
        // first question how to play the file. Should this fail, Jellyfin reads them
        // itself the first time the item is played.
        private async Task Probe(Video video)
        {
            try
            {
                using var limit = new CancellationTokenSource(TimeSpan.FromSeconds(ProbeLimitSeconds));
                // Everything about the file, nothing else: no picture is cut from it
                // (a frame from the first second of an intro is usually black).
                var options = new MetadataRefreshOptions(new DirectoryService(_fileSystem))
                {
                    MetadataRefreshMode = MetadataRefreshMode.FullRefresh,
                    ImageRefreshMode = MetadataRefreshMode.ValidationOnly,
                    ForceSave = true
                };
                await video.RefreshMetadata(options, limit.Token).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Custom Theme] Could not read the intro's media information ahead of time");
            }
        }
    }

    /// <summary>
    /// The film after the intro starts with the viewer's own tracks, not the intro's.
    ///
    /// An app plays the intro and the film as ONE queue, and two players keep the
    /// choice of audio and subtitle track from one entry of a queue to the next: the
    /// Android TV app and Jellyfin's own web player. That suits two episodes in a
    /// row. After an intro it means: the player asks the server how to play the FILM
    /// and names what it "chose" for the intro — its audio stream, subtitles none —
    /// where a film started on its own names nothing and is given the user's
    /// preferred language and subtitles. Measured in the Android TV app (0.19.10):
    /// German sound and German subtitles without the intro, English and none with
    /// it — and Jellyfin then remembers that as the user's choice for the film.
    ///
    /// So a device that has just asked how to play OUR intro item has, in its next
    /// question about a film or an episode, exactly those leftovers taken out again
    /// and is answered with the user's own defaults for them — for the two players
    /// that are known to leave them, and for nobody else:
    ///   the Android TV app (and its fork): "no subtitles" (-1) and the intro's own
    ///   audio stream number. It has no track picker before Play, so neither can be
    ///   the viewer's doing;
    ///   Jellyfin's web player, whatever hosts it (a browser engine under one of
    ///   Jellyfin's own client names): "no subtitles" only. The audio stream it
    ///   names is the one picked on the film's page, and it does not carry the
    ///   intro's audio over.
    /// Every other app names the tracks it means for the film (several keep the
    /// viewer's choice per film themselves) and is answered as it asked.
    /// One question per intro, that device only; nothing is done for an intro that
    /// is not ours.
    ///
    /// Added to the server's request pipeline by <see cref="ServiceRegistrator"/>.
    /// The names it goes by (Jellyfin's "MediaInfo" controller, its stream-index
    /// arguments, the two claims) are the same in 12.0, 12.1 and 12.2; should a
    /// later version or app rename them, this simply stops acting and playback is as
    /// the app makes it.
    /// </summary>
    public sealed class IdentHandOver : IActionFilter
    {
        // From "how do I play the intro?" to "how do I play the film?": the intro's
        // length and this much more, for a slow start or a short pause. After that
        // the note is dropped — an intro the viewer walked out of must not reach
        // into whatever that device plays next.
        private static readonly TimeSpan Slack = TimeSpan.FromMinutes(2);

        // Per device: until when its next question counts as "the film after the intro".
        private static readonly ConcurrentDictionary<string, DateTime> Waiting = new(StringComparer.Ordinal);

        // "Jellyfin Android TV" up to 0.19, "Jellyfin for Android TV" from 0.20; a
        // debug build adds a suffix. Not "… Android TV" in general: other apps for
        // that platform do not carry anything over.
        private static readonly string[] AndroidTv = { "Jellyfin Android TV", "Jellyfin for Android TV", "Dune Android TV" };

        /// <inheritdoc />
        public void OnActionExecuting(ActionExecutingContext context)
        {
            try
            {
                if (context.ActionDescriptor is not ControllerActionDescriptor action
                    || !string.Equals(action.ControllerName, "MediaInfo", StringComparison.Ordinal)
                    || !action.ActionName.Contains("PlaybackInfo", StringComparison.Ordinal)
                    || !context.ActionArguments.TryGetValue("itemId", out var asked)
                    || asked is not Guid itemId)
                {
                    return;
                }

                var user = context.HttpContext.User;
                var device = user.FindFirst("Jellyfin-DeviceId")?.Value;
                if (string.IsNullOrEmpty(device))
                {
                    return;
                }

                var now = DateTime.UtcNow;
                if (itemId.Equals(IdentItem.Id))
                {
                    Forget(now);
                    Waiting[device] = now + (IdentItem.Instance?.Length() ?? TimeSpan.Zero) + Slack;
                    return;
                }

                // Not yet the film: another plugin's intro may come between ours and it.
                if (!Waiting.ContainsKey(device) || IdentItem.Instance?.IsFilm(itemId) == false)
                {
                    return;
                }

                if (!Waiting.TryRemove(device, out var until) || now > until)
                {
                    return;
                }

                // Every browser engine says "Mozilla/…" first, and no app with its own
                // player does.
                var client = user.FindFirst("Jellyfin-Client")?.Value ?? string.Empty;
                var browser = context.HttpContext.Request.Headers.UserAgent.ToString().StartsWith("Mozilla/", StringComparison.OrdinalIgnoreCase);
                var webPlayer = browser && client.StartsWith("Jellyfin", StringComparison.OrdinalIgnoreCase);
                var androidTv = !browser && Array.Exists(AndroidTv, name => client.StartsWith(name, StringComparison.OrdinalIgnoreCase));
                if (!webPlayer && !androidTv)
                {
                    return;
                }

                // The two may be named in the address (the older way) or in the body.
                var arguments = context.ActionArguments;
                if (arguments.TryGetValue("subtitleStreamIndex", out var subtitles) && subtitles is -1)
                {
                    arguments["subtitleStreamIndex"] = null;
                }

                if (androidTv && arguments.TryGetValue("audioStreamIndex", out var sound) && sound is int stream && IsIntroAudio(stream))
                {
                    arguments["audioStreamIndex"] = null;
                }

                if (arguments.TryGetValue("playbackInfoDto", out var body) && body is not null)
                {
                    var subtitle = body.GetType().GetProperty("SubtitleStreamIndex");
                    if (subtitle is { CanRead: true, CanWrite: true } && subtitle.PropertyType == typeof(int?) && subtitle.GetValue(body) is -1)
                    {
                        subtitle.SetValue(body, null);
                    }

                    var audio = body.GetType().GetProperty("AudioStreamIndex");
                    if (androidTv && audio is { CanRead: true, CanWrite: true } && audio.PropertyType == typeof(int?)
                        && audio.GetValue(body) is int index && IsIntroAudio(index))
                    {
                        audio.SetValue(body, null);
                    }
                }
            }
            catch (Exception)
            {
                // The request goes on exactly as it came.
            }
        }

        /// <inheritdoc />
        public void OnActionExecuted(ActionExecutedContext context)
        {
        }

        private static bool IsIntroAudio(int index) => IdentItem.Instance?.HasAudioStream(index) == true;

        // Devices that asked about the intro and then never played anything.
        private static void Forget(DateTime now)
        {
            if (Waiting.Count < 64)
            {
                return;
            }

            foreach (var pair in Waiting)
            {
                if (now > pair.Value)
                {
                    Waiting.TryRemove(pair.Key, out _);
                }
            }
        }
    }
}
