using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.CustomTheme
{
    /// <summary>
    /// Registers plugin services with Jellyfin's DI container.
    /// </summary>
    public class ServiceRegistrator : IPluginServiceRegistrator
    {
        public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
        {
            serviceCollection.AddHostedService<EntryPoint>();

            // Index.html injection middleware: serves/injects our script and applies
            // transformations other plugins registered with the bundled File Transformation
            // provider. Gated by the OwnInjection / ProvideFileTransformation settings;
            // EntryPoint prefers the real File Transformation plugin when installed.
            serviceCollection.AddSingleton<IStartupFilter, IndexInjectionStartupFilter>();
        }
    }
}
