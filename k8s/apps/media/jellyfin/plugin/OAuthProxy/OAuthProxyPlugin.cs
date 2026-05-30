using Jellyfin.Plugin.OAuthProxy.Config;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.OAuthProxy;

/// <summary>
/// Jellyfin plugin that delegates authentication to an existing oauth2-proxy instance.
/// No OIDC client secrets required — auth is fully handled by oauth2-proxy/Keycloak.
/// </summary>
public class OAuthProxyPlugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public OAuthProxyPlugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public static OAuthProxyPlugin? Instance { get; private set; }

    public override string Name => "OAuthProxy-SSO";

    // Unique GUID — distinct from 9p4/jellyfin-plugin-sso
    public override Guid Id => Guid.Parse("a2b4c6d8-e0f2-4a6c-8e0a-123456789abc");

    public IEnumerable<PluginPageInfo> GetPages() =>
    [
        new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = $"{GetType().Namespace}.Config.configPage.html"
        },
        new PluginPageInfo
        {
            Name = Name + ".js",
            EmbeddedResourcePath = $"{GetType().Namespace}.Config.config.js"
        }
    ];
}
