using Microsoft.AspNetCore.Http;

namespace TickeX.Infrastructure.Services;

public sealed class CookieAuthenticationSettings
{
    public const string SectionName = "Authentication:Cookie";
    public string AccessCookieName { get; set; } = "tickex_access";
    public string CsrfCookieName { get; set; } = "XSRF-TOKEN";
    public string RefreshCookieName { get; set; } = "tickex_refresh";
    public bool Secure { get; set; } = true;
    public SameSiteMode SameSite { get; set; } = SameSiteMode.Lax;
    public int LifetimeMinutes { get; set; } = 60;
    public int RefreshLifetimeDays { get; set; } = 30;
}

public static class CookieAuthenticationSupport
{
    public static CookieOptions CreateAccessCookie(CookieAuthenticationSettings settings) => new()
    {
        HttpOnly = true,
        Secure = settings.Secure,
        SameSite = settings.SameSite,
        Path = "/",
        MaxAge = TimeSpan.FromMinutes(settings.LifetimeMinutes),
        IsEssential = true
    };

    public static CookieOptions CreateCsrfCookie(CookieAuthenticationSettings settings) => new()
    {
        HttpOnly = false,
        Secure = settings.Secure,
        SameSite = settings.SameSite,
        Path = "/",
        MaxAge = TimeSpan.FromMinutes(settings.LifetimeMinutes),
        IsEssential = true
    };

    public static CookieOptions CreateRefreshCookie(CookieAuthenticationSettings settings) => new()
    {
        HttpOnly = true,
        Secure = settings.Secure,
        SameSite = settings.SameSite,
        Path = "/api/auth",
        MaxAge = TimeSpan.FromDays(settings.RefreshLifetimeDays),
        IsEssential = true
    };

    public static bool HasValidCsrfToken(string? cookieToken, string? headerToken) =>
        !string.IsNullOrWhiteSpace(cookieToken) &&
        !string.IsNullOrWhiteSpace(headerToken) &&
        System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(cookieToken), System.Text.Encoding.UTF8.GetBytes(headerToken));
}
