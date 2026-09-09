namespace TickeX.Application.Interfaces;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
    bool VerifyDummy(string password);
}

