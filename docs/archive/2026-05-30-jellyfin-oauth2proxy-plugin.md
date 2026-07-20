# Jellyfin oauth2-proxy SSO Plugin — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a Jellyfin plugin that authenticates users via the existing oauth2-proxy/Keycloak stack by redirecting through oauth2-proxy and then calling its `/oauth2/userinfo` endpoint to verify identity — no OIDC client secrets in the plugin, no client-side token exchange with Keycloak directly.

**Architecture:**
```
Jellyfin Web UI
  → click "Login with SSO"
  → GET /sso/OAuthProxy/start
  → redirect to https://oauth2.becklab.cloud/oauth2/start?rd=<callback_url>
  → oauth2-proxy does OIDC with Keycloak (existing flow)
  → cookie set for .becklab.cloud
  → redirect back to https://jellyfin.becklab.cloud/sso/OAuthProxy/callback?state=<nonce>
  → plugin reads _oauth2_proxy cookie, POSTs to internal oauth2-proxy userinfo endpoint
  → userinfo returns { user, email, groups }
  → plugin stores verified identity in server-side state map keyed by nonce
  → returns HTML page with embedded JS
  → JS POSTs { nonce, deviceId, deviceName, appName, appVersion } to /sso/OAuthProxy/auth
  → plugin exchanges nonce for Jellyfin session (AuthenticateDirect)
  → JS receives Jellyfin token, redirects to /web/index.html
```

**Tech Stack:**
- C# / .NET 8
- ASP.NET Core MVC (ApiController)
- Jellyfin Plugin SDK (same NuGet packages as 9p4/jellyfin-plugin-sso)
- No extra NuGet beyond Jellyfin SDK + Microsoft.AspNetCore

**Target Jellyfin version:** 10.10.x (package refs match existing plugin)

**Repo location:** `/root/beck-cloud/k8s/apps/media/jellyfin/plugin/` (new directory, not in Helm chart — will be mounted via init container or manual install)

**Plugin GUID:** `a2b4c6d8-e0f2-4a6c-8e0a-123456789abc` (new, distinct from 9p4 plugin)

---

## Task 1: Scaffold the project directory and .csproj

**Objective:** Create the C# project that compiles to a Jellyfin plugin DLL.

**Files:**
- Create: `plugin/OAuthProxy/OAuthProxy.csproj`

**Step 1: Create directory**
```bash
mkdir -p /root/beck-cloud/k8s/apps/media/jellyfin/plugin/OAuthProxy
```

**Step 2: Write the .csproj**
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <AssemblyName>Jellyfin.Plugin.OAuthProxy</AssemblyName>
    <RootNamespace>Jellyfin.Plugin.OAuthProxy</RootNamespace>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <Version>1.0.0</Version>
  </PropertyGroup>

  <ItemGroup>
    <!-- Jellyfin SDK — same versions as 9p4/jellyfin-plugin-sso -->
    <PackageReference Include="Jellyfin.Controller" Version="10.10.6" />
    <PackageReference Include="Jellyfin.Data" Version="10.10.6" />
    <PackageReference Include="Jellyfin.Model" Version="10.10.6" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc" Version="2.2.0" />
  </ItemGroup>

  <!-- Embed HTML/JS/CSS config pages as resources -->
  <ItemGroup>
    <EmbeddedResource Include="Config\**\*" />
  </ItemGroup>
</Project>
```

**Step 3: Verify project restores**
```bash
cd /root/beck-cloud/k8s/apps/media/jellyfin/plugin/OAuthProxy
dotnet restore
```
Expected: no errors, packages downloaded.

---

## Task 2: Plugin entry point (OAuthProxyPlugin.cs)

**Objective:** Register the plugin with Jellyfin, expose config page.

**Files:**
- Create: `plugin/OAuthProxy/OAuthProxyPlugin.cs`

**Step 1: Write the file**
```csharp
using System;
using System.Collections.Generic;
using Jellyfin.Plugin.OAuthProxy.Config;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.OAuthProxy;

public class OAuthProxyPlugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public OAuthProxyPlugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public static OAuthProxyPlugin? Instance { get; private set; }

    public override string Name => "OAuthProxy-SSO";

    // New GUID — do NOT reuse 9p4's
    public override Guid Id => Guid.Parse("a2b4c6d8-e0f2-4a6c-8e0a-123456789abc");

    public IEnumerable<PluginPageInfo> GetPages() => new[]
    {
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
    };
}
```

**Step 2: Build**
```bash
dotnet build
```
Expected: Build succeeded, 0 errors.

---

## Task 3: Plugin configuration model (PluginConfiguration.cs)

**Objective:** Define the settings admins configure: oauth2-proxy internal URL, cookie name, admin groups, allowed groups, auto-create users toggle.

**Files:**
- Create: `plugin/OAuthProxy/Config/PluginConfiguration.cs`

**Step 1: Write the file**
```csharp
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.OAuthProxy.Config;

public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Internal K8s URL to reach oauth2-proxy's /oauth2/userinfo endpoint.
    /// Use the media instance for Jellyfin: http://oauth2-proxy-media.identity.svc.cluster.local/oauth2/userinfo
    /// </summary>
    public string UserInfoUrl { get; set; } = "http://oauth2-proxy-media.identity.svc.cluster.local/oauth2/userinfo";

    /// <summary>
    /// Name of the oauth2-proxy session cookie.
    /// Media instance uses: _oauth2_media
    /// Admin instance uses: _oauth2_admin
    /// </summary>
    public string CookieName { get; set; } = "_oauth2_media";

    /// <summary>
    /// Comma-separated list of groups that receive Jellyfin admin rights.
    /// Example: /admins
    /// Leave empty to grant admin to no SSO users.
    /// </summary>
    public string AdminGroups { get; set; } = "/admins";

    /// <summary>
    /// Comma-separated list of groups allowed to sign in.
    /// Leave empty to allow all authenticated users.
    /// </summary>
    public string AllowedGroups { get; set; } = "";

    /// <summary>
    /// Automatically create Jellyfin users on first SSO login.
    /// </summary>
    public bool AutoCreateUsers { get; set; } = true;

    /// <summary>
    /// oauth2-proxy sign-in URL (public-facing, browser redirect).
    /// Use the media instance: https://oauth2-media.becklab.cloud/oauth2/start
    /// </summary>
    public string OAuth2ProxyStartUrl { get; set; } = "https://oauth2-media.becklab.cloud/oauth2/start";

    /// <summary>
    /// Public-facing base URL of this Jellyfin instance.
    /// Example: https://jellyfin.becklab.cloud
    /// Used to build the redirect URI sent to oauth2-proxy.
    /// </summary>
    public string JellyfinPublicUrl { get; set; } = "https://jellyfin.becklab.cloud";
}
```

**Step 2: Build**
```bash
dotnet build
```
Expected: 0 errors.

---

## Task 4: State management model

**Objective:** Thread-safe in-memory state map for nonce → verified identity, expiring after 2 minutes (same pattern as 9p4 plugin).

**Files:**
- Create: `plugin/OAuthProxy/PendingAuth.cs`

**Step 1: Write the file**
```csharp
namespace Jellyfin.Plugin.OAuthProxy;

/// <summary>
/// Represents a verified SSO identity waiting for the client JS to claim it.
/// </summary>
public class PendingAuth
{
    public required string Username { get; init; }
    public required string Email { get; init; }
    public bool IsAdmin { get; init; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    public bool IsExpired => (DateTime.UtcNow - CreatedAt).TotalMinutes > 2;
}
```

---

## Task 5: UserInfo response model

**Objective:** Deserialize the JSON that oauth2-proxy returns from `/oauth2/userinfo`.

**Files:**
- Create: `plugin/OAuthProxy/UserInfoResponse.cs`

**Step 1: Write the file**
```csharp
using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.OAuthProxy;

/// <summary>
/// Deserializes the JSON response from oauth2-proxy's /oauth2/userinfo endpoint.
/// Shape: {"user":"stephen","email":"stephen@example.com","groups":["/admins"]}
/// </summary>
public class UserInfoResponse
{
    [JsonPropertyName("user")]
    public string? User { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("groups")]
    public List<string>? Groups { get; set; }
}
```

---

## Task 6: The API controller — start and callback endpoints

**Objective:** Handle the redirect flow. `/start` sends the browser to oauth2-proxy. `/callback` receives the browser back, calls userinfo internally, stores the pending auth state, returns HTML.

**Files:**
- Create: `plugin/OAuthProxy/Api/OAuthProxyController.cs` (Part 1 — start + callback)

**Step 1: Write the controller skeleton + start endpoint**
```csharp
using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text.Json;
using Jellyfin.Database.Implementations.Entities;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Plugin.OAuthProxy.Config;
using MediaBrowser.Controller.Authentication;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Session;
using MediaBrowser.Model.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.OAuthProxy.Api;

[ApiController]
[Route("[controller]")]
public class OAuthProxyController : ControllerBase
{
    private readonly IUserManager _userManager;
    private readonly ISessionManager _sessionManager;
    private readonly ICryptoProvider _cryptoProvider;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<OAuthProxyController> _logger;

    // Nonce → PendingAuth. Concurrent because requests can be simultaneous.
    private static readonly ConcurrentDictionary<string, PendingAuth> _pending = new();

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
    /// Initiates SSO: redirects the browser to oauth2-proxy's sign-in page.
    /// The 'rd' parameter tells oauth2-proxy where to redirect after authentication.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("start")]
    public IActionResult Start()
    {
        var config = OAuthProxyPlugin.Instance!.Configuration;

        // Generate a nonce to correlate the callback with the client session
        var nonce = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-").Replace("/", "_").TrimEnd('=');

        // The callback URL oauth2-proxy will redirect back to after successful auth
        var callbackUrl = $"{config.JellyfinPublicUrl}/OAuthProxy/callback?nonce={Uri.EscapeDataString(nonce)}";

        // Build the oauth2-proxy start URL
        var redirectUrl = $"{config.OAuth2ProxyStartUrl}?rd={Uri.EscapeDataString(callbackUrl)}";

        _logger.LogInformation("OAuthProxy SSO start → redirecting to {Url}", redirectUrl);
        return Redirect(redirectUrl);
    }
```

**Step 2: Add the callback endpoint** (continuation of the same file)
```csharp
    /// <summary>
    /// Callback from oauth2-proxy. The browser arrives here with the oauth2-proxy
    /// session cookie set. We call userinfo internally to verify identity, then
    /// store the result keyed by nonce and return an HTML page.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string nonce)
    {
        if (string.IsNullOrWhiteSpace(nonce))
            return BadRequest("Missing nonce");

        var config = OAuthProxyPlugin.Instance!.Configuration;

        // Extract the oauth2-proxy session cookie from the incoming browser request
        if (!Request.Cookies.TryGetValue(config.CookieName, out var cookieValue) || string.IsNullOrEmpty(cookieValue))
        {
            _logger.LogWarning("OAuthProxy callback: no session cookie '{CookieName}' found", config.CookieName);
            return Unauthorized("No SSO session cookie found. Please sign in via oauth2-proxy first.");
        }

        // Call oauth2-proxy userinfo endpoint internally (server-to-server)
        UserInfoResponse? userInfo;
        try
        {
            userInfo = await GetUserInfo(config, cookieValue);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OAuthProxy: failed to call userinfo endpoint");
            return StatusCode(502, "Failed to verify SSO identity. Check plugin configuration.");
        }

        if (userInfo?.User is null)
        {
            _logger.LogWarning("OAuthProxy: userinfo returned no user");
            return Unauthorized("SSO identity could not be confirmed.");
        }

        // Check allowed groups (if configured)
        var allowedGroups = config.AllowedGroups
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var userGroups = userInfo.Groups ?? new List<string>();

        if (allowedGroups.Count > 0 && !userGroups.Any(g => allowedGroups.Contains(g)))
        {
            _logger.LogWarning("OAuthProxy: user {User} not in any allowed group. Groups: {Groups}", userInfo.User, string.Join(", ", userGroups));
            return Unauthorized("You are not authorised to access Jellyfin.");
        }

        // Check admin groups
        var adminGroups = config.AdminGroups
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        bool isAdmin = userGroups.Any(g => adminGroups.Contains(g));

        // Purge expired entries
        PurgeExpired();

        // Store verified state keyed by nonce
        _pending[nonce] = new PendingAuth
        {
            Username = userInfo.User,
            Email = userInfo.Email ?? string.Empty,
            IsAdmin = isAdmin,
        };

        _logger.LogInformation("OAuthProxy: user {User} verified, isAdmin={IsAdmin}, nonce stored", userInfo.User, isAdmin);

        // Return the HTML page that the client JS will use to finalize auth
        return Content(BuildCallbackHtml(nonce, config.JellyfinPublicUrl), "text/html");
    }

    private async Task<UserInfoResponse?> GetUserInfo(PluginConfiguration config, string cookieValue)
    {
        var client = _httpClientFactory.CreateClient("OAuthProxy");
        var req = new HttpRequestMessage(HttpMethod.Get, config.UserInfoUrl);
        // Forward the oauth2-proxy session cookie
        req.Headers.Add("Cookie", $"{config.CookieName}={cookieValue}");
        var resp = await client.SendAsync(req);
        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<UserInfoResponse>(json);
    }
```

---

## Task 7: The API controller — auth endpoint (nonce exchange)

**Objective:** Client JS calls this with the nonce + device info. Plugin validates, creates/finds user, calls AuthenticateDirect, returns Jellyfin session JSON.

**Files:**
- Modify: `plugin/OAuthProxy/Api/OAuthProxyController.cs` (add auth endpoint + helpers)

**Step 1: Add the auth endpoint**
```csharp
    /// <summary>
    /// Client JS calls this to exchange a validated nonce for a Jellyfin session token.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("auth")]
    [Consumes("application/json")]
    [Produces("application/json")]
    public async Task<IActionResult> Auth([FromBody] AuthRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Nonce))
            return BadRequest("Missing nonce");

        if (!_pending.TryRemove(request.Nonce, out var pending))
            return Unauthorized("Nonce not found or already used");

        if (pending.IsExpired)
            return Unauthorized("Nonce expired — please sign in again");

        var config = OAuthProxyPlugin.Instance!.Configuration;

        // Find or create the Jellyfin user
        User? user = _userManager.GetUserByName(pending.Username);
        if (user == null)
        {
            if (!config.AutoCreateUsers)
            {
                _logger.LogWarning("OAuthProxy: user {User} not found and AutoCreateUsers is false", pending.Username);
                return Unauthorized("User does not exist in Jellyfin. Contact your administrator.");
            }

            _logger.LogInformation("OAuthProxy: creating new Jellyfin user {User}", pending.Username);
            user = await _userManager.CreateUserAsync(pending.Username);
            // Set a random unusable password so normal login won't work
            user.Password = _cryptoProvider.CreatePasswordHash(
                Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64))
            ).ToString();
            user.AuthenticationProviderId = typeof(OAuthProxyController).FullName;
        }

        // Update admin status from SSO groups
        user.SetPermission(PermissionKind.IsAdministrator, pending.IsAdmin);
        await _userManager.UpdateUserAsync(user);

        var authReq = new AuthenticationRequest
        {
            UserId = user.Id,
            Username = user.Username,
            App = request.AppName ?? "OAuthProxy",
            AppVersion = request.AppVersion ?? "1.0.0",
            DeviceId = request.DeviceId ?? "unknown",
            DeviceName = request.DeviceName ?? "SSO Device",
        };

        _logger.LogInformation("OAuthProxy: authenticating user {User}", user.Username);
        var result = await _sessionManager.AuthenticateDirect(authReq);
        return Ok(result);
    }
```

**Step 2: Add helpers + models at the bottom of the file**
```csharp
    private static void PurgeExpired()
    {
        foreach (var key in _pending.Keys)
        {
            if (_pending.TryGetValue(key, out var v) && v.IsExpired)
                _pending.TryRemove(key, out _);
        }
    }

    private static string BuildCallbackHtml(string nonce, string jellyfinBaseUrl)
    {
        // This is the HTML page the browser loads after oauth2-proxy redirects back.
        // The embedded JS reads the nonce, gathers device info, posts to /OAuthProxy/auth,
        // and redirects to Jellyfin's main page with the session token.
        return $$"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signing in...</title></head>
<body>
<p>Signing in, please wait...</p>
<script>
(async function() {
    const nonce = {{JsonSerializer.Serialize(nonce)}};
    const baseUrl = {{JsonSerializer.Serialize(jellyfinBaseUrl)}};

    // Gather device info from Jellyfin's existing session storage (if available)
    const deviceId = localStorage.getItem('_deviceId') || crypto.randomUUID();
    const deviceName = navigator.userAgent.substring(0, 60);
    localStorage.setItem('_deviceId', deviceId);

    try {
        const resp = await fetch(baseUrl + '/OAuthProxy/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nonce,
                deviceId,
                deviceName,
                appName: 'Jellyfin Web',
                appVersion: '10.10.0'
            })
        });

        if (!resp.ok) {
            const text = await resp.text();
            document.body.innerHTML = '<p style="color:red">Login failed: ' + text + '</p>';
            return;
        }

        const auth = await resp.json();

        // Store credentials the same way Jellyfin Web does
        const credentials = JSON.parse(localStorage.getItem('jellyfin_credentials') || '{"Servers":[]}');
        const existing = credentials.Servers.find(s => s.Id === auth.ServerId);
        if (existing) {
            existing.UserId = auth.User.Id;
            existing.AccessToken = auth.AccessToken;
        } else {
            credentials.Servers.push({
                Id: auth.ServerId,
                UserId: auth.User.Id,
                AccessToken: auth.AccessToken
            });
        }
        localStorage.setItem('jellyfin_credentials', JSON.stringify(credentials));

        window.location.href = baseUrl + '/web/index.html';
    } catch (e) {
        document.body.innerHTML = '<p style="color:red">Login error: ' + e.message + '</p>';
    }
})();
</script>
</body>
</html>
""";
    }
}

// ── Request models ──────────────────────────────────────────────────────────

public class AuthRequest
{
    public string? Nonce { get; set; }
    public string? DeviceId { get; set; }
    public string? DeviceName { get; set; }
    public string? AppName { get; set; }
    public string? AppVersion { get; set; }
}
```

**Step 3: Build and verify**
```bash
cd /root/beck-cloud/k8s/apps/media/jellyfin/plugin/OAuthProxy
dotnet build
```
Expected: 0 errors.

---

## Task 8: Admin config page HTML + JS

**Objective:** Jellyfin plugin admin page so admins can configure the plugin settings via the Jellyfin dashboard.

**Files:**
- Create: `plugin/OAuthProxy/Config/configPage.html`
- Create: `plugin/OAuthProxy/Config/config.js`

**Step 1: configPage.html**
```html
<!DOCTYPE html>
<html>
<head>
  <title>OAuthProxy SSO</title>
</head>
<body>
<div id="OAuthProxySSOConfigPage" data-role="page" class="page type-interior pluginConfigurationPage"
     data-require="emby-input,emby-button,emby-checkbox">
  <div data-role="content">
    <div class="content-primary">
      <form id="OAuthProxyConfigForm">
        <div class="inputContainer">
          <label class="inputLabel" for="userInfoUrl">oauth2-proxy userinfo URL (internal)</label>
          <input id="userInfoUrl" name="UserInfoUrl" type="text" is="emby-input"
                 placeholder="http://oauth2-proxy.identity.svc.cluster.local/oauth2/userinfo" />
          <div class="fieldDescription">Internal K8s URL for server-to-server userinfo calls.</div>
        </div>
        <div class="inputContainer">
          <label class="inputLabel" for="cookieName">Session Cookie Name</label>
          <input id="cookieName" name="CookieName" type="text" is="emby-input" placeholder="_oauth2_proxy" />
        </div>
        <div class="inputContainer">
          <label class="inputLabel" for="oauth2ProxyStartUrl">oauth2-proxy Start URL (public)</label>
          <input id="oauth2ProxyStartUrl" name="OAuth2ProxyStartUrl" type="text" is="emby-input"
                 placeholder="https://oauth2.becklab.cloud/oauth2/start" />
        </div>
        <div class="inputContainer">
          <label class="inputLabel" for="jellyfinPublicUrl">Jellyfin Public URL</label>
          <input id="jellyfinPublicUrl" name="JellyfinPublicUrl" type="text" is="emby-input"
                 placeholder="https://jellyfin.becklab.cloud" />
        </div>
        <div class="inputContainer">
          <label class="inputLabel" for="adminGroups">Admin Groups (comma-separated)</label>
          <input id="adminGroups" name="AdminGroups" type="text" is="emby-input" placeholder="/admins" />
          <div class="fieldDescription">SSO group names that get Jellyfin admin rights.</div>
        </div>
        <div class="inputContainer">
          <label class="inputLabel" for="allowedGroups">Allowed Groups (comma-separated, blank = all)</label>
          <input id="allowedGroups" name="AllowedGroups" type="text" is="emby-input" placeholder="" />
        </div>
        <div class="checkboxContainer">
          <label>
            <input id="autoCreateUsers" name="AutoCreateUsers" type="checkbox" is="emby-checkbox" />
            <span>Auto-create Jellyfin users on first SSO login</span>
          </label>
        </div>
        <div>
          <button is="emby-button" type="submit" class="raised button-submit block">Save</button>
        </div>
      </form>
    </div>
  </div>
</div>
</body>
</html>
```

**Step 2: config.js**
```javascript
define(['baseUrl', 'Dashboard'], function(baseUrl, Dashboard) {
    'use strict';

    return function(view) {
        var form = view.querySelector('#OAuthProxyConfigForm');

        view.addEventListener('viewshow', function() {
            Dashboard.showLoadingMsg();
            ApiClient.getPluginConfiguration('a2b4c6d8-e0f2-4a6c-8e0a-123456789abc').then(function(config) {
                form.querySelector('#userInfoUrl').value = config.UserInfoUrl || '';
                form.querySelector('#cookieName').value = config.CookieName || '_oauth2_proxy';
                form.querySelector('#oauth2ProxyStartUrl').value = config.OAuth2ProxyStartUrl || '';
                form.querySelector('#jellyfinPublicUrl').value = config.JellyfinPublicUrl || '';
                form.querySelector('#adminGroups').value = config.AdminGroups || '';
                form.querySelector('#allowedGroups').value = config.AllowedGroups || '';
                form.querySelector('#autoCreateUsers').checked = config.AutoCreateUsers !== false;
                Dashboard.hideLoadingMsg();
            });
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            Dashboard.showLoadingMsg();
            ApiClient.getPluginConfiguration('a2b4c6d8-e0f2-4a6c-8e0a-123456789abc').then(function(config) {
                config.UserInfoUrl = form.querySelector('#userInfoUrl').value;
                config.CookieName = form.querySelector('#cookieName').value;
                config.OAuth2ProxyStartUrl = form.querySelector('#oauth2ProxyStartUrl').value;
                config.JellyfinPublicUrl = form.querySelector('#jellyfinPublicUrl').value;
                config.AdminGroups = form.querySelector('#adminGroups').value;
                config.AllowedGroups = form.querySelector('#allowedGroups').value;
                config.AutoCreateUsers = form.querySelector('#autoCreateUsers').checked;
                ApiClient.updatePluginConfiguration('a2b4c6d8-e0f2-4a6c-8e0a-123456789abc', config).then(function() {
                    Dashboard.processServerConfigurationUpdateResult();
                });
            });
        });
    };
});
```

**Step 3: Build to verify embedded resources resolve**
```bash
dotnet build
```
Expected: 0 errors.

---

## Task 9: Jellyfin login button injection (client-side)

**Objective:** Jellyfin's web UI has a standard SSO plugin pattern: a "Login with SSO" button that appears on the login page. We need to expose a view page that Jellyfin's client loads.

**Context:** Jellyfin's web frontend checks for plugin-provided login views. The existing 9p4 plugin injects a button via a custom view. We'll do the same with a minimal approach: expose a simple HTML page with a redirect button.

**Files:**
- Create: `plugin/OAuthProxy/Config/loginButton.html` (exposed as a plugin view)
- Modify: `plugin/OAuthProxy/OAuthProxyPlugin.cs` (add loginButton to GetPages)

**Step 1: loginButton.html**
```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div>
  <button id="oauthProxySSOBtn" style="width:100%;margin-top:8px;" onclick="window.location.href='/OAuthProxy/start'">
    Sign in with SSO
  </button>
</div>
</body>
</html>
```

**Step 2: Update OAuthProxyPlugin.cs GetPages()**
```csharp
public IEnumerable<PluginPageInfo> GetPages() => new[]
{
    new PluginPageInfo
    {
        Name = Name,
        EmbeddedResourcePath = $"{GetType().Namespace}.Config.configPage.html"
    },
    new PluginPageInfo
    {
        Name = Name + ".js",
        EmbeddedResourcePath = $"{GetType().Namespace}.Config.config.js"
    },
    new PluginPageInfo
    {
        Name = Name + "-login",
        EmbeddedResourcePath = $"{GetType().Namespace}.Config.loginButton.html",
        EnableInMainIndex = true
    }
};
```

**Step 3: Add loginButton to EmbeddedResource in .csproj** (already covered by `Config\**\*` glob — no change needed)

**Step 4: Build**
```bash
dotnet build
```

---

## Task 10: Build pipeline — GitHub Actions workflow

**Objective:** CI that compiles and produces the plugin DLL + meta.json for each release.

**Files:**
- Create: `plugin/OAuthProxy/.github/workflows/build.yaml`

```yaml
name: Build Plugin
on:
  push:
    tags: ['v*']
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'
      - run: dotnet restore OAuthProxy.csproj
        working-directory: k8s/apps/media/jellyfin/plugin/OAuthProxy
      - run: dotnet publish OAuthProxy.csproj -c Release -o ./dist
        working-directory: k8s/apps/media/jellyfin/plugin/OAuthProxy
      - uses: actions/upload-artifact@v4
        with:
          name: plugin-dll
          path: k8s/apps/media/jellyfin/plugin/OAuthProxy/dist/
```

---

## Task 11: Build the plugin locally and verify the DLL

**Objective:** Confirm the plugin compiles to a single DLL with embedded resources.

**Step 1: Publish**
```bash
cd /root/beck-cloud/k8s/apps/media/jellyfin/plugin/OAuthProxy
dotnet publish -c Release -o ./dist
```

**Step 2: Verify DLL exists**
```bash
ls -lh dist/*.dll
```
Expected: `Jellyfin.Plugin.OAuthProxy.dll` present, non-zero size.

**Step 3: Verify embedded resources**
```bash
dotnet tool install -g dotnet-ildasm 2>/dev/null || true
# Quick check: strings in the DLL should contain our HTML
strings dist/Jellyfin.Plugin.OAuthProxy.dll | grep -c "oauth2-proxy"
```
Expected: at least 3 occurrences.

---

## Task 12: Deploy to Jellyfin pod

**Objective:** Copy the DLL into the Jellyfin plugins directory on the K3s pod.

**Notes:**
- Jellyfin plugins live in `/config/plugins/` inside the container
- We create a subdirectory named after the plugin + version: `/config/plugins/OAuthProxy-SSO_1.0.0.0/`
- After copying, restart the Jellyfin deployment

**Step 1: Find the Jellyfin pod**
```bash
kubectl get pods -n media -l app.kubernetes.io/name=jellyfin
```

**Step 2: Copy the DLL**
```bash
POD=$(kubectl get pods -n media -l app.kubernetes.io/name=jellyfin -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n media "$POD" -- mkdir -p /config/plugins/OAuthProxy-SSO_1.0.0.0
kubectl cp dist/Jellyfin.Plugin.OAuthProxy.dll "media/$POD:/config/plugins/OAuthProxy-SSO_1.0.0.0/"
```

**Step 3: Restart Jellyfin**
```bash
kubectl rollout restart deployment -n media jellyfin
kubectl rollout status deployment -n media jellyfin
```

**Step 4: Verify plugin loaded**
```bash
# Check logs for plugin registration
kubectl logs -n media -l app.kubernetes.io/name=jellyfin --tail=50 | grep -i "oauthproxy\|plugin"
```
Expected: log line mentioning "OAuthProxy-SSO" or "Plugin loaded".

---

## Task 13: Configure the plugin in Jellyfin dashboard

**Objective:** Set the correct values via the Jellyfin admin UI.

**Step 1: Navigate to** `https://jellyfin.becklab.cloud/web/index.html#!/configurationpage?name=OAuthProxy-SSO`

**Step 2: Set values:**
- **userinfo URL:** `http://oauth2-proxy-media.identity.svc.cluster.local/oauth2/userinfo`
- **Cookie Name:** `_oauth2_media`
- **oauth2-proxy Start URL:** `https://oauth2-media.becklab.cloud/oauth2/start`
- **Jellyfin Public URL:** `https://jellyfin.becklab.cloud`
- **Admin Groups:** `/admins`
- **Allowed Groups:** (blank — all authenticated users)
- **Auto-create users:** checked

**Step 3: Save**

---

## Task 14: End-to-end test

**Objective:** Verify the full login flow works.

**Step 1: Open a private browser window → navigate to** `https://jellyfin.becklab.cloud`

**Step 2: Click "Sign in with SSO"**
Expected: redirected to `oauth2.becklab.cloud` Keycloak login.

**Step 3: Log in with LLDAP credentials**
Expected: redirected back to `jellyfin.becklab.cloud/OAuthProxy/callback?nonce=...`

**Step 4: Wait for JS redirect**
Expected: browser redirects to `/web/index.html`, Jellyfin shows as logged in.

**Step 5: Verify user was created**
```bash
# Check Jellyfin admin → Users for the SSO user
```

**Step 6: Verify admin groups work**
Log in with an admin-group user → should see admin panel.

---

## Pitfalls & Notes

### oauth2-proxy cookie forwarding
The server-side userinfo call must include the exact cookie value from the browser request.
oauth2-proxy validates the cookie server-side and returns 401 if it's absent or invalid.

### Cookie domain
oauth2-proxy is configured with `cookie_domains = [".becklab.cloud"]`, so the cookie will
be present on requests to `jellyfin.becklab.cloud`. This is a prerequisite.

### oauth2-proxy `rd` parameter security
oauth2-proxy validates the `rd` redirect URL against its `whitelist_domains` or allows
only URLs within the same domain. Verify `https://jellyfin.becklab.cloud` is allowed.
If not, add `--whitelist-domain=jellyfin.becklab.cloud` to the oauth2-proxy deployment.

### Jellyfin plugin endpoint routing
Jellyfin routes plugin API controllers under `/PluginName` by default when using `[Route("[controller]")]`.
Our controller is `OAuthProxyController` so endpoints are at `/OAuthProxy/start`, `/OAuthProxy/callback`, `/OAuthProxy/auth`.

### Jellyfin web UI login button
The SSO button injection via `EnableInMainIndex = true` is undocumented but used by 9p4 plugin.
If it doesn't inject the button on the login page, the fallback is to provide a direct URL
`https://jellyfin.becklab.cloud/OAuthProxy/start` to users as their login link.

### No SAML/complex OIDC — keep it simple
This plugin has ONE job: delegate auth entirely to oauth2-proxy. No provider config,
no role mapping complexity. Admin status is derived from SSO groups only.
