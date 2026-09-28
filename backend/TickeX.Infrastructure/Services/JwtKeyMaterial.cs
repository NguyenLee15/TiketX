using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;

namespace TickeX.Infrastructure.Services;

public static class JwtKeyMaterial
{
    public static RsaSecurityKey LoadPrivateKey(string base64, string keyId)
    {
        var rsa = RSA.Create();
        try
        {
            rsa.ImportPkcs8PrivateKey(Convert.FromBase64String(base64), out _);
            return new RsaSecurityKey(rsa) { KeyId = keyId };
        }
        catch
        {
            rsa.Dispose();
            throw new InvalidOperationException($"Jwt:SigningKeys:{keyId} must contain a valid PKCS#8 RSA private key encoded as base64.");
        }
    }

    public static RsaSecurityKey LoadPublicKey(string base64, string keyId)
    {
        var rsa = RSA.Create();
        try
        {
            rsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(base64), out _);
            return new RsaSecurityKey(rsa) { KeyId = keyId };
        }
        catch
        {
            rsa.Dispose();
            throw new InvalidOperationException($"Jwt:ValidationKeys:{keyId} must contain a valid RSA public key encoded as base64.");
        }
    }
}
