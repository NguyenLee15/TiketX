namespace TickeX.Application.Admin;

public static class AdminMutationVersionPolicy
{
    public static bool TryDecodeRequiredVersion(string? encoded, out byte[] version)
    {
        version = Array.Empty<byte>();
        if (string.IsNullOrWhiteSpace(encoded)) return false;

        try
        {
            version = Convert.FromBase64String(encoded);
            return version.Length > 0;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
