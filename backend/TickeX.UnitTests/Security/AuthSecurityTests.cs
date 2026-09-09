using System.IdentityModel.Tokens.Jwt;
using System.Text;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using TickeX.Application.Auth.Commands;
using TickeX.Application.Auth.Validators;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Security;

public class AuthSecurityTests
{
    private readonly BcryptPasswordHasher _hasher;
    private readonly JwtService _jwtService;

    public AuthSecurityTests()
    {
        _hasher = new BcryptPasswordHasher();

        var inMemorySettings = new Dictionary<string, string?>
        {
            { "Jwt:Key", "TickeX_Super_Secret_Jwt_Signing_Key_For_UnitTests_2026_LongEnough!" },
            { "Jwt:Issuer", "TickeX" },
            { "Jwt:Audience", "TickeXClient" }
        };

        IConfiguration configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        _jwtService = new JwtService(configuration);
    }

    [Fact]
    public void User_RecordFailedLogin_WhenUnderThreshold_ShouldNotLockout()
    {
        // Arrange
        var user = new User("Test User", "test@tickex.com", _hasher.Hash("Password@123"));

        // Act
        user.RecordFailedLogin(maxFailedAccessAttempts: 5, lockoutMinutes: 15);
        user.RecordFailedLogin(maxFailedAccessAttempts: 5, lockoutMinutes: 15);

        // Assert
        user.AccessFailedCount.Should().Be(2);
        user.IsLockedOut().Should().BeFalse();
        user.LockoutEnd.Should().BeNull();
    }

    [Fact]
    public void User_RecordFailedLogin_WhenReachingThreshold_ShouldLockout()
    {
        // Arrange
        var user = new User("Test User", "test@tickex.com", _hasher.Hash("Password@123"));

        // Act: simulate 5 consecutive failed attempts
        for (int i = 0; i < 5; i++)
        {
            user.RecordFailedLogin(maxFailedAccessAttempts: 5, lockoutMinutes: 15);
        }

        // Assert
        user.AccessFailedCount.Should().Be(5);
        user.IsLockedOut().Should().BeTrue();
        user.LockoutEnd.Should().NotBeNull();
        user.LockoutEnd!.Value.Should().BeAfter(DateTime.UtcNow.AddMinutes(14));
    }

    [Fact]
    public void User_ResetFailedLogin_ShouldClearLockoutAndCount()
    {
        // Arrange
        var user = new User("Test User", "test@tickex.com", _hasher.Hash("Password@123"));
        for (int i = 0; i < 5; i++)
        {
            user.RecordFailedLogin(maxFailedAccessAttempts: 5, lockoutMinutes: 15);
        }
        user.IsLockedOut().Should().BeTrue();

        // Act
        user.ResetFailedLogin();

        // Assert
        user.AccessFailedCount.Should().Be(0);
        user.LockoutEnd.Should().BeNull();
        user.IsLockedOut().Should().BeFalse();
    }

    [Fact]
    public void User_SecurityStamp_ShouldRegenerateOnSecurityEvents()
    {
        // Arrange
        var user = new User("Test User", "test@tickex.com", _hasher.Hash("Password@123"));
        var initialStamp = user.SecurityStamp;
        initialStamp.Should().NotBeNullOrWhiteSpace();

        // Act 1: Change password
        user.ChangePassword(_hasher.Hash("NewPassword@123"));
        var stampAfterPass = user.SecurityStamp;
        stampAfterPass.Should().NotBe(initialStamp);

        // Act 2: Block user
        user.Block();
        var stampAfterBlock = user.SecurityStamp;
        stampAfterBlock.Should().NotBe(stampAfterPass);

        // Act 3: Change role
        user.ChangeRole("Staff");
        var stampAfterRole = user.SecurityStamp;
        stampAfterRole.Should().NotBe(stampAfterBlock);
    }

    [Fact]
    public void BcryptPasswordHasher_VerifyDummy_ShouldAlwaysReturnFalse()
    {
        // Act
        bool result1 = _hasher.VerifyDummy("IncorrectPassword123!");
        bool result2 = _hasher.VerifyDummy("");
        bool result3 = _hasher.VerifyDummy(null!);

        // Assert
        result1.Should().BeFalse();
        result2.Should().BeFalse();
        result3.Should().BeFalse();
    }

    [Fact]
    public void JwtService_GenerateToken_ShouldContainSecurityStampClaim()
    {
        // Arrange
        var user = new User("Test Admin", "admin@tickex.com", _hasher.Hash("Admin@123"), "Admin");

        // Act
        string tokenString = _jwtService.GenerateToken(user);

        // Assert
        tokenString.Should().NotBeNullOrWhiteSpace();
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(tokenString);

        var stampClaim = jwt.Claims.FirstOrDefault(c => c.Type == "SecurityStamp");
        stampClaim.Should().NotBeNull();
        stampClaim!.Value.Should().Be(user.SecurityStamp);
    }

    [Fact]
    public void LoginCommandValidator_WhenPasswordExceeds72Bytes_ShouldFailValidation()
    {
        // Arrange
        var validator = new LoginCommandValidator();
        string longPassword = new string('a', 73); // 73 ASCII characters = 73 UTF-8 bytes
        var command = new LoginCommand("user@tickex.com", longPassword);

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("72 bytes"));
    }

    [Fact]
    public void RegisterCommandValidator_WhenInvalidInput_ShouldFailValidation()
    {
        // Arrange
        var validator = new RegisterCommandValidator();
        var command = new RegisterCommand("", "invalid-email", "123");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Name");
        result.Errors.Should().Contain(e => e.PropertyName == "Email");
        result.Errors.Should().Contain(e => e.PropertyName == "Password");
    }

    [Fact]
    public void RegisterCommandValidator_WhenValidInput_ShouldPassValidation()
    {
        // Arrange
        var validator = new RegisterCommandValidator();
        var command = new RegisterCommand("Nguyen Van A", "nguyenvana@example.com", "Password@123");

        // Act
        var result = validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void CookieAuthenticationSupport_UsesHttpOnlySecureAccessCookie_AndValidatesDoubleSubmitCsrf()
    {
        var settings = new CookieAuthenticationSettings
        {
            AccessCookieName = "tickex_access",
            CsrfCookieName = "XSRF-TOKEN",
            Secure = true,
            SameSite = Microsoft.AspNetCore.Http.SameSiteMode.Lax
        };

        var cookie = CookieAuthenticationSupport.CreateAccessCookie(settings);

        cookie.HttpOnly.Should().BeTrue();
        cookie.Secure.Should().BeTrue();
        cookie.SameSite.Should().Be(Microsoft.AspNetCore.Http.SameSiteMode.Lax);
        CookieAuthenticationSupport.HasValidCsrfToken("known", "known").Should().BeTrue();
        CookieAuthenticationSupport.HasValidCsrfToken("known", "other").Should().BeFalse();
    }
}
