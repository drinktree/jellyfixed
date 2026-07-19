using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Jellyfin.Plugin.FileTransformation
{
    /// <summary>
    /// Drop-in compatible re-implementation of the File Transformation plugin's public
    /// registration interface, so other plugins (e.g. the Jellyfin Media Bar) can register
    /// their index.html transformations with <b>this</b> plugin and work without the
    /// separate File Transformation plugin installed.
    ///
    /// Consumers discover it by scanning for an assembly whose name contains
    /// ".FileTransformation" (this assembly is named <c>CustomTheme.FileTransformation</c>)
    /// and invoking the static <see cref="RegisterTransformation"/> method via reflection.
    /// Custom Theme's IndexInjectionMiddleware reads the registrations and applies them.
    /// </summary>
    public static class PluginInterface
    {
        private static readonly List<TransformationRegistration> RegistrationList = new List<TransformationRegistration>();
        private static readonly object Gate = new object();

        /// <summary>Called by consumer plugins. <paramref name="payload"/> is a JSON object
        /// (typically a Newtonsoft JObject); we read it via its JSON text so we need no
        /// Newtonsoft reference.</summary>
        public static void RegisterTransformation(object payload)
        {
            if (payload is null)
            {
                return;
            }

            var json = payload.ToString();
            if (string.IsNullOrWhiteSpace(json))
            {
                return;
            }

            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                var reg = new TransformationRegistration
                {
                    Id = Read(root, "id"),
                    FileNamePattern = Read(root, "fileNamePattern"),
                    CallbackAssembly = Read(root, "callbackAssembly"),
                    CallbackClass = Read(root, "callbackClass"),
                    CallbackMethod = Read(root, "callbackMethod")
                };

                if (string.IsNullOrEmpty(reg.CallbackMethod) || string.IsNullOrEmpty(reg.CallbackClass))
                {
                    return;
                }

                lock (Gate)
                {
                    if (!string.IsNullOrEmpty(reg.Id))
                    {
                        RegistrationList.RemoveAll(r => string.Equals(r.Id, reg.Id, StringComparison.Ordinal));
                    }

                    RegistrationList.Add(reg);
                }
            }
            catch
            {
                // Ignore malformed payloads — never throw back into the caller.
            }
        }

        /// <summary>Snapshot of current registrations (used by the middleware).</summary>
        public static IReadOnlyList<TransformationRegistration> GetRegistrations()
        {
            lock (Gate)
            {
                return RegistrationList.ToArray();
            }
        }

        private static string Read(JsonElement root, string name)
        {
            return root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
                ? v.GetString()
                : null;
        }
    }

    /// <summary>A single registered file transformation.</summary>
    public sealed class TransformationRegistration
    {
        public string Id { get; set; }

        public string FileNamePattern { get; set; }

        public string CallbackAssembly { get; set; }

        public string CallbackClass { get; set; }

        public string CallbackMethod { get; set; }
    }
}
