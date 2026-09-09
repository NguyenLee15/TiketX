using BCrypt.Net;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public class BcryptPasswordHasher : IPasswordHasher
{
    // Pre-computed BCrypt hash with cost 11 for timing attack resistance
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("TickeX-Dummy-Constant-Password", 11);

    public string Hash(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, 11);
    }

    public bool Verify(string password, string hash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(hash))
            return false;

        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch
        {
            return false;
        }
    }

    public bool VerifyDummy(string password)
    {
        try
        {
            BCrypt.Net.BCrypt.Verify(password ?? string.Empty, DummyHash);
        }
        catch
        {
            // Ignore failure on dummy comparison
        }
        return false;
    }
}

