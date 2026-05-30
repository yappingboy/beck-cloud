namespace Jellyfin.Plugin.OAuthProxy;

/// <summary>
/// Represents a verified SSO identity that is waiting for the client JS to claim it
/// by posting the nonce back to /OAuthProxy/auth.
/// Entries expire after 2 minutes.
/// </summary>
public sealed class PendingAuth
{
    public required string Username { get; init; }
    public required string Email { get; init; }
    public bool IsAdmin { get; init; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
    public bool IsExpired => (DateTime.UtcNow - CreatedAt).TotalMinutes > 2;
}
