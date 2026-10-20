using System;
using MediaBrowser.Common.Plugins;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.CustomTheme
{
    /// <summary>
    /// The Jellyseerr Bridge plugin, as far as the theme needs to know about it: is it
    /// loaded, and in which version. The theme's requests go through the bridge's own
    /// routes, so they can only be offered while those answer — and a plugin's routes
    /// exist only if it was loaded when the server started. Installing, disabling or
    /// removing it changes nothing until the next restart, and a restart looks again.
    /// So one look at start-up is the exact answer for the whole run; a look per page
    /// would be a worse one (a bridge disabled a minute ago still answers until then).
    /// </summary>
    internal static class SeerrBridge
    {
        /// <summary>The bridge's plugin id, the guid in its manifest.</summary>
        internal static readonly Guid Id = new("d2fcf9c8-c3c7-47e8-9dd6-8de9867e36bb");

        /// <summary>
        /// The version of the bridge that was loaded when the server started, or null
        /// when none was: not installed, disabled, waiting for a restart, or failed to
        /// load. Set by <see cref="Detect"/> before index.html is written, and read for
        /// every page that is served.
        /// </summary>
        internal static volatile string? Version;

        /// <summary>
        /// Looks for the bridge among the server's plugins. It counts only when it is
        /// loaded — an instance made and its manifest enabled and supported. An entry
        /// that is merely installed has no routes. Never throws: the server is
        /// starting, and without an answer the theme simply offers no requests.
        /// </summary>
        internal static void Detect(IPluginManager plugins, ILogger logger)
        {
            try
            {
                var p = plugins.GetPlugin(Id);
                Version = p is { Instance: not null, IsEnabledAndSupported: true } ? p.Version.ToString() : null;
                if (Version is { } v)
                {
                    logger.LogInformation("[Custom Theme] Jellyseerr Bridge {Version} found", v);
                }
                else
                {
                    logger.LogInformation("[Custom Theme] Jellyseerr Bridge not loaded");
                }
            }
            catch (Exception ex)
            {
                Version = null;
                logger.LogWarning(ex, "[Custom Theme] Could not look for the Jellyseerr Bridge plugin; no requests are offered");
            }
        }
    }
}
