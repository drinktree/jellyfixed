using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
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
            // The intro as a library entry, for apps that do not show the theme: one
            // instance, shared by the start-up/settings hook and the intro provider.
            serviceCollection.AddSingleton<IdentItem>();

            // …and the film after it starting with the user's own audio and subtitle
            // choice, not with the one an app carried over from the intro.
            serviceCollection.Configure<MvcOptions>(options => options.Filters.Add(new IdentHandOver()));

            serviceCollection.AddHostedService<EntryPoint>();

            // Index.html injection middleware: serves/injects our script and applies
            // transformations other plugins registered with the bundled File Transformation
            // provider. Gated by the OwnInjection / ProvideFileTransformation settings;
            // EntryPoint prefers the real File Transformation plugin when installed.
            serviceCollection.AddSingleton<IStartupFilter, IndexInjectionStartupFilter>();
        }
    }
}
