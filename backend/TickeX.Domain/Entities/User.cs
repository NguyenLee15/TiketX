namespace TickeX.Domain.Entities;

public class User : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public string Role { get; private set; } = string.Empty;

    public bool IsBlocked { get; private set; }
    public string AvatarUrl { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;

    public string SecurityStamp { get; private set; } = Guid.NewGuid().ToString();
    // Optimistic concurrency token for admin role/block mutations.
    public byte[] Version { get; private set; } = Guid.NewGuid().ToByteArray();
    public int AccessFailedCount { get; private set; } = 0;
    public DateTime? LockoutEnd { get; private set; } = null;

    private User() { } // For EF Core

    public User(string name, string email, string passwordHash, string role = "Customer")
    {
        Name = name;
        Email = email;
        PasswordHash = passwordHash;
        Role = role;
        IsBlocked = false;
        AvatarUrl = "";
        Phone = "";
        SecurityStamp = Guid.NewGuid().ToString();
        Version = Guid.NewGuid().ToByteArray();
        AccessFailedCount = 0;
        LockoutEnd = null;
    }

    public void UpdateSecurityStamp()
    {
        SecurityStamp = Guid.NewGuid().ToString();
    }

    public void ChangeRole(string role)
    {
        Role = role;
        UpdateSecurityStamp();
        Version = Guid.NewGuid().ToByteArray();
    }

    public void Block()
    {
        IsBlocked = true;
        UpdateSecurityStamp();
        Version = Guid.NewGuid().ToByteArray();
    }

    public void Unblock()
    {
        IsBlocked = false;
        UpdateSecurityStamp();
        Version = Guid.NewGuid().ToByteArray();
    }

    public void UpdateProfile(string name, string phone, string avatarUrl)
    {
        Name = name;
        Phone = phone;
        AvatarUrl = avatarUrl;
    }

    public void ChangePassword(string newHash)
    {
        PasswordHash = newHash;
        UpdateSecurityStamp();
    }

    public bool IsLockedOut()
    {
        return LockoutEnd.HasValue && LockoutEnd.Value > DateTime.UtcNow;
    }

    public void RecordFailedLogin(int maxFailedAccessAttempts = 5, int lockoutMinutes = 15)
    {
        AccessFailedCount++;
        if (AccessFailedCount >= maxFailedAccessAttempts)
        {
            LockoutEnd = DateTime.UtcNow.AddMinutes(lockoutMinutes);
        }
        Version = Guid.NewGuid().ToByteArray();
    }

    public void ResetFailedLogin()
    {
        if (AccessFailedCount == 0 && LockoutEnd is null) return;
        AccessFailedCount = 0;
        LockoutEnd = null;
        Version = Guid.NewGuid().ToByteArray();
    }
}
