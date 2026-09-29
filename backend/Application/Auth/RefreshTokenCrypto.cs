using System.Security.Cryptography;
using System.Text;

namespace TickeX.Application.Auth;

public static class RefreshTokenCrypto
{
    public static string Hash(string rawToken) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
    public static string Generate() => Convert.ToHexString(RandomNumberGenerator.GetBytes(64));
}
