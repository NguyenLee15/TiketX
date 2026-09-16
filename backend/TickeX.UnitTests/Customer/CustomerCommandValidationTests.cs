using FluentAssertions;
using TickeX.Application.Seats.Commands;
using TickeX.Application.Tickets.Commands;
using TickeX.Application.Users.Commands;
using Xunit;

namespace TickeX.UnitTests.Customer;

public class CustomerCommandValidationTests
{
    private readonly LockSeatCommandValidator _lockSeatValidator = new();
    private readonly UpdateProfileCommandValidator _updateProfileValidator = new();
    private readonly ChangePasswordCommandValidator _changePasswordValidator = new();
    private readonly RefundTicketCommandValidator _refundTicketValidator = new();

    [Fact]
    public void LockSeatCommandValidator_InvalidVersionLength_FailsValidation()
    {
        var invalidCommand = new LockSeatCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), new byte[8]);
        var result = _lockSeatValidator.Validate(invalidCommand);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Version");
    }

    [Fact]
    public void LockSeatCommandValidator_Valid16ByteVersion_PassesValidation()
    {
        var validCommand = new LockSeatCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid().ToByteArray());
        var result = _lockSeatValidator.Validate(validCommand);
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("", "Mật khẩu không được để trống")]
    [InlineData("12345", "ít nhất 6 ký tự")]
    public void ChangePasswordCommandValidator_ShortOrEmptyPassword_FailsValidation(string newPass, string _)
    {
        var command = new ChangePasswordCommand(Guid.NewGuid(), "oldPassword123", newPass);
        var result = _changePasswordValidator.Validate(command);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "NewPassword");
    }

    [Fact]
    public void UpdateProfileCommandValidator_EmptyName_FailsValidation()
    {
        var command = new UpdateProfileCommand(Guid.NewGuid(), "", "0901234567", "https://example.com/avatar.jpg");
        var result = _updateProfileValidator.Validate(command);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Name");
    }

    [Fact]
    public void RefundTicketCommandValidator_EmptyTicketId_FailsValidation()
    {
        var command = new RefundTicketCommand(Guid.Empty, Guid.NewGuid(), "Need refund");
        var result = _refundTicketValidator.Validate(command);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "TicketId");
    }
}

