using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.OAuthProxy.Config;

/// <summary>
/// Configuration for the OAuthProxy-SSO plugin.
/// Admins set these values in the Jellyfin dashboard under the plugin's config page.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Internal K8s service URL for oauth2-proxy's userinfo endpoint.
    /// Used server-side to verify the session cookie and retrieve user claims.
    /// becklab value: http://oauth2-proxy-media.identity.svc.cluster.local/oauth2/userinfo
    /// </summary>
    public string UserInfoUrl { get; set; } = "http://oauth2-proxy-media.identity.svc.cluster.local/oauth2/userinfo";

    /// <summary>
    /// Name of the session cookie set by oauth2-proxy.
    /// becklab media instance: _oauth2_media
    /// </summary>
    public string CookieName { get; set; } = "_oauth2_media";

    /// <summary>
    /// Public-facing URL of the oauth2-proxy /oauth2/start endpoint.
    /// The browser is redirected here to begin the OAuth2 flow.
    /// becklab media instance: https://oauth2-media.becklab.cloud/oauth2/start
    /// </summary>
    public string OAuth2ProxyStartUrl { get; set; } = "https://oauth2-media.becklab.cloud/oauth2/start";

    /// <summary>
    /// Public base URL of this Jellyfin instance — used to build the rd= callback URL.
    /// Example: https://jellyfin.becklab.cloud
    /// </summary>
    public string JellyfinPublicUrl { get; set; } = "https://jellyfin.becklab.cloud";

    /// <summary>
    /// Comma-separated list of SSO groups that receive Jellyfin admin rights.
    /// Example: /admins
    /// Leave empty to grant no SSO users admin rights.
    /// </summary>
    public string AdminGroups { get; set; } = "/admins";

    /// <summary>
    /// Comma-separated list of SSO groups permitted to sign in.
    /// Leave empty to allow all authenticated SSO users.
    /// </summary>
    public string AllowedGroups { get; set; } = string.Empty;

    /// <summary>
    /// Automatically create a Jellyfin user account on first SSO login.
    /// If false, the user must already exist in Jellyfin (by matching username).
    /// </summary>
    public bool AutoCreateUsers { get; set; } = true;
}
