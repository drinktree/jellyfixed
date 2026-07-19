using System;
using System.Collections.Generic;
using System.IO;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Branding;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.CustomTheme
{
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
    {
        private readonly IApplicationPaths _appPaths;
        private readonly IConfigurationManager _configManager;

        public override string Name => "Custom Theme";

        public override Guid Id => Guid.Parse("78b7b285-8d9e-4e4c-8e4d-7a71f76d4e2a");

        public Plugin(
            IApplicationPaths applicationPaths,
            IXmlSerializer xmlSerializer,
            IConfigurationManager configManager)
            : base(applicationPaths, xmlSerializer)
        {
            _appPaths = applicationPaths;
            _configManager = configManager;
            Instance = this;
        }

        public static Plugin? Instance { get; private set; }

        public IEnumerable<PluginPageInfo> GetPages()
        {
            return new[]
            {
                new PluginPageInfo
                {
                    Name = "custom-theme-config",
                    EmbeddedResourcePath = GetType().Namespace + ".configPage.html",
                    DisplayName = "Custom Theme",
                    MenuIcon = "palette",
                    EnableInMainMenu = true
                }
            };
        }

        /// <summary>
        /// Uninstalling used to leave the theme fully active: the generated CSS stayed
        /// in branding CustomCss and the injected script stayed in index.html on disk.
        /// Remove both (keeping any CSS the admin added themselves).
        /// </summary>
        public override void OnUninstalling()
        {
            try
            {
                var branding = _configManager.GetConfiguration<BrandingOptions>("branding");
                branding.CustomCss = EntryPoint.StripGeneratedCss(branding.CustomCss ?? string.Empty).Trim();
                _configManager.SaveConfiguration("branding", branding);
            }
            catch
            {
                // Never block uninstall on cleanup.
            }

            try
            {
                var indexPath = EntryPoint.LocateIndexHtml(_appPaths);
                if (indexPath != null)
                {
                    var html = File.ReadAllText(indexPath);
                    var cleaned = ThemeTransformation.StripInjected(html);
                    if (!string.Equals(cleaned, html, StringComparison.Ordinal))
                    {
                        File.WriteAllText(indexPath, cleaned);
                    }
                }
            }
            catch
            {
                // Read-only web root — the serve-time injection dies with the plugin anyway.
            }

            base.OnUninstalling();
        }
    }
}
