using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.OAuthProxy;

/// <summary>
/// Deserializes the JSON response from oauth2-proxy's /oauth2/userinfo endpoint.
/// Shape: {"user":"stephen","email":"stephen@example.com","groups":["/admins","/media"]}
/// </summary>
public sealed class UserInfoResponse
{
    [JsonPropertyName("user")]
    public string? User { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("groups")]
    public List<string>? Groups { get; set; }
}

/// <summary>
/// Request body posted by the callback page's JS to exchange a nonce for a Jellyfin session.
/// </summary>
public sealed class AuthRequest
{
    public string? Nonce { get; set; }
    public string? DeviceId { get; set; }
    public string? DeviceName { get; set; }
    public string? AppName { get; set; }
    public string? AppVersion { get; set; }
}
