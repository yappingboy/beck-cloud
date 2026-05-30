using System.Collections.Concurrent;
using System.Net.Mime;
using System.Security.Cryptography;
using System.Text.Json;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Plugin.OAuthProxy.Config;
using MediaBrowser.Controller.Authentication;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Session;
using MediaBrowser.Model.Cryptography;
using MediaBrowser.Model.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.OAuthProxy.Api;

/// <summary>
/// Handles the oauth2-proxy SSO authentication flow for Jellyfin.
///
/// Flow:
///   GET  /OAuthProxy/start    → redirect browser to oauth2-proxy /oauth2/start
///   GET  /OAuthProxy/callback → validate session cookie via userinfo, store nonce→identity
///   POST /OAuthProxy/auth     → client JS exchanges nonce for Jellyfin session token
/// </summary>
[ApiController]
[Route("[controller]")]
public class OAuthProxyController : ControllerBase
{
    private readonly IUserManager _userManager;
    private readonly ISessionManager _sessionManager;
    private readonly ICryptoProvider _cryptoProvider;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<OAuthProxyController> _logger;

    // Server-side state: nonce → verified identity. Concurrent because multiple requests can arrive simultaneously.
    private static readonly ConcurrentDictionary<string, PendingAuth> Pending = new();

    public OAuthProxyController(
        IUserManager userManager,
        ISessionManager sessionManager,
        ICryptoProvider cryptoProvider,
        IHttpClientFactory httpClientFactory,
        ILogger<OAuthProxyController> logger)
    {
        _userManager = userManager;
        _sessionManager = sessionManager;
        _cryptoProvider = cryptoProvider;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// <summary>
    /// Step 1: Redirect the browser to oauth2-proxy to begin authentication.
    /// The nonce is embedded in the callback URL so we can correlate the result.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("start")]
    public IActionResult Start()
    {
        var config = OAuthProxyPlugin.Instance!.Configuration;

        var nonce = GenerateNonce();

        // After auth, oauth2-proxy redirects back here with the session cookie set.
        var callbackUrl = $"{config.JellyfinPublicUrl.TrimEnd('/')}/OAuthProxy/callback?nonce={Uri.EscapeDataString(nonce)}";
        var startUrl = $"{config.OAuth2ProxyStartUrl.TrimEnd('/')}?rd={Uri.EscapeDataString(callbackUrl)}";

        _logger.LogInformation("OAuthProxy SSO start: nonce={Nonce}", nonce);
        return Redirect(startUrl);
    }

    /// <summary>
    /// Step 2: Browser returns here after oauth2-proxy completes the OAuth2 flow.
    /// We call oauth2-proxy's userinfo endpoint server-side (forwarding the session cookie)
    /// to verify identity, then return an HTML page whose JS completes the login.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string nonce)
    {
        if (string.IsNullOrWhiteSpace(nonce))
            return BadRequest("Missing nonce.");

        var config = OAuthProxyPlugin.Instance!.Configuration;

        // The oauth2-proxy session cookie must be present — it was set by oauth2-proxy
        // on .becklab.cloud after the user authenticated with Keycloak.
        if (!Request.Cookies.TryGetValue(config.CookieName, out var cookieValue)
            || string.IsNullOrEmpty(cookieValue))
        {
            _logger.LogWarning("OAuthProxy callback: cookie '{Name}' not found", config.CookieName);
            return Content(ErrorHtml("No SSO session cookie found. Please sign in again."), MediaTypeNames.Text.Html);
        }

        // Server-to-server: ask oauth2-proxy to validate the cookie and return user info.
        UserInfoResponse? userInfo;
        try
        {
            userInfo = await FetchUserInfo(config, cookieValue).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OAuthProxy: userinfo request failed");
            return Content(ErrorHtml("Failed to verify SSO identity. Check plugin configuration."), MediaTypeNames.Text.Html);
        }

        if (string.IsNullOrEmpty(userInfo?.User))
        {
            _logger.LogWarning("OAuthProxy: userinfo returned empty username");
            return Content(ErrorHtml("SSO identity could not be confirmed."), MediaTypeNames.Text.Html);
        }

        var userGroups = userInfo.Groups ?? [];

        // Optional: restrict to allowed groups
        var allowedGroups = ParseGroups(config.AllowedGroups);
        if (allowedGroups.Count > 0 && !userGroups.Any(g => allowedGroups.Contains(g)))
        {
            _logger.LogWarning(
                "OAuthProxy: user {User} denied — not in allowed groups. Has: [{Groups}]",
                userInfo.User, string.Join(", ", userGroups));
            return Content(ErrorHtml("You are not authorised to access Jellyfin."), MediaTypeNames.Text.Html);
        }

        var adminGroups = ParseGroups(config.AdminGroups);
        var isAdmin = userGroups.Any(g => adminGroups.Contains(g));

        PurgeExpired();

        Pending[nonce] = new PendingAuth
        {
            Username = userInfo.User,
            Email = userInfo.Email ?? string.Empty,
            IsAdmin = isAdmin,
        };

        _logger.LogInformation(
            "OAuthProxy: identity verified for {User} (admin={IsAdmin}), nonce stored",
            userInfo.User, isAdmin);

        return Content(CallbackHtml(nonce, config.JellyfinPublicUrl), MediaTypeNames.Text.Html);
    }

    /// <summary>
    /// Step 3: The callback page's JS posts the nonce + device info here.
    /// We exchange the nonce for a Jellyfin session token via AuthenticateDirect.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("auth")]
    [Consumes(MediaTypeNames.Application.Json)]
    [Produces(MediaTypeNames.Application.Json)]
    public async Task<IActionResult> Auth([FromBody] AuthRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Nonce))
            return BadRequest("Missing nonce.");

        if (!Pending.TryRemove(request.Nonce, out var pending))
            return Unauthorized("Nonce not found or already consumed.");

        if (pending.IsExpired)
            return Unauthorized("Nonce expired — please sign in again.");

        var config = OAuthProxyPlugin.Instance!.Configuration;

        // Find or create Jellyfin user
        var user = _userManager.GetUserByName(pending.Username);
        if (user is null)
        {
            if (!config.AutoCreateUsers)
            {
                _logger.LogWarning("OAuthProxy: user {User} not found and AutoCreateUsers=false", pending.Username);
                return Unauthorized("User does not exist in Jellyfin. Contact your administrator.");
            }

            _logger.LogInformation("OAuthProxy: creating Jellyfin user {User}", pending.Username);
            user = await _userManager.CreateUserAsync(pending.Username).ConfigureAwait(false);

            // Assign a random unusable password — login must go through SSO
            var randomPassword = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            user.Password = _cryptoProvider.CreatePasswordHash(randomPassword).ToString() ?? string.Empty;
            user.AuthenticationProviderId = typeof(OAuthProxyController).FullName;
            await _userManager.UpdateUserAsync(user).ConfigureAwait(false);
        }

        // Sync admin status from SSO groups on every login
        await SyncAdminStatus(user, pending.IsAdmin).ConfigureAwait(false);

        var authRequest = new AuthenticationRequest
        {
            UserId = user.Id,
            Username = user.Username,
            App = request.AppName ?? "Jellyfin Web",
            AppVersion = request.AppVersion ?? "1.0.0",
            DeviceId = request.DeviceId ?? $"oauthproxy-{user.Id}",
            DeviceName = request.DeviceName ?? "SSO Browser",
            RemoteEndPoint = HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
        };

        _logger.LogInformation("OAuthProxy: issuing session for {User}", user.Username);
        var result = await _sessionManager.AuthenticateDirect(authRequest).ConfigureAwait(false);
        return Ok(result);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private async Task<UserInfoResponse?> FetchUserInfo(PluginConfiguration config, string cookieValue)
    {
        var client = _httpClientFactory.CreateClient("OAuthProxy");
        using var req = new HttpRequestMessage(HttpMethod.Get, config.UserInfoUrl);
        req.Headers.Add("Cookie", $"{config.CookieName}={cookieValue}");
        using var resp = await client.SendAsync(req).ConfigureAwait(false);
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
        return JsonSerializer.Deserialize<UserInfoResponse>(body);
    }

    private async Task SyncAdminStatus(User user, bool isAdmin)
    {
        // Build a minimal UserPolicy that only changes IsAdministrator, preserving defaults.
        // UpdatePolicyAsync is the correct API for 10.11.x (SetPermission was removed).
        var policy = new UserPolicy { IsAdministrator = isAdmin };
        await _userManager.UpdatePolicyAsync(user.Id, policy).ConfigureAwait(false);
    }

    private static HashSet<string> ParseGroups(string raw) =>
        raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
           .ToHashSet(StringComparer.OrdinalIgnoreCase);

    private static void PurgeExpired()
    {
        foreach (var key in Pending.Keys.ToList())
        {
            if (Pending.TryGetValue(key, out var v) && v.IsExpired)
                Pending.TryRemove(key, out _);
        }
    }

    private static string GenerateNonce() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
               .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    private static string CallbackHtml(string nonce, string jellyfinBaseUrl) => $$"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Signing in to Jellyfin...</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center;
                   justify-content: center; min-height: 100vh; margin: 0;
                   background: #101010; color: #ccc; }
            .msg { text-align: center; }
            .err { color: #f66; }
          </style>
        </head>
        <body>
        <div class="msg" id="msg"><p>Signing in, please wait&hellip;</p></div>
        <script>
        (async function() {
          const nonce    = {{JsonSerializer.Serialize(nonce)}};
          const baseUrl  = {{JsonSerializer.Serialize(jellyfinBaseUrl.TrimEnd('/'))}};
          const msgEl    = document.getElementById('msg');

          // Stable device ID — persist across page loads
          let deviceId = localStorage.getItem('_oap_deviceId');
          if (!deviceId) {
            deviceId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
            localStorage.setItem('_oap_deviceId', deviceId);
          }

          try {
            const resp = await fetch(baseUrl + '/OAuthProxy/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nonce,
                deviceId,
                deviceName: navigator.userAgent.substring(0, 60),
                appName: 'Jellyfin Web',
                appVersion: '10.11.0'
              })
            });

            if (!resp.ok) {
              const txt = await resp.text();
              msgEl.innerHTML = '<p class="err">Login failed: ' + txt + '</p>';
              return;
            }

            const auth = await resp.json();

            // Store credentials the same way Jellyfin Web does
            const raw = localStorage.getItem('jellyfin_credentials') || '{"Servers":[]}';
            let creds;
            try { creds = JSON.parse(raw); } catch { creds = { Servers: [] }; }
            if (!Array.isArray(creds.Servers)) creds.Servers = [];

            const existing = creds.Servers.find(s => s.Id === auth.ServerId);
            if (existing) {
              existing.UserId = auth.User?.Id;
              existing.AccessToken = auth.AccessToken;
            } else {
              creds.Servers.push({
                Id: auth.ServerId,
                UserId: auth.User?.Id,
                AccessToken: auth.AccessToken
              });
            }
            localStorage.setItem('jellyfin_credentials', JSON.stringify(creds));

            window.location.replace(baseUrl + '/web/index.html');
          } catch (e) {
            msgEl.innerHTML = '<p class="err">Login error: ' + e.message + '</p>';
          }
        })();
        </script>
        </body>
        </html>
        """;

    private static string ErrorHtml(string message)
    {
        var encoded = System.Web.HttpUtility.HtmlEncode(message);
        return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>SSO Error</title>" +
               "<style>body{font-family:sans-serif;background:#101010;color:#f66;" +
               "display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}</style>" +
               $"</head><body><p>{encoded}</p></body></html>";
    }
}
