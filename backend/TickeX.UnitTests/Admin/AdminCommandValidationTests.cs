using FluentAssertions;
using TickeX.Application.Admin.Commands;
using TickeX.Application.Events.Commands;
using Xunit;

namespace TickeX.UnitTests.Admin;

public class AdminCommandValidationTests
{
    private readonly CreateEventCommandValidator _createEventValidator = new();
    private readonly CancelEventCommandValidator _cancelEventValidator = new();
    private readonly ChangeUserRoleCommandValidator _changeRoleValidator = new();

    [Fact]
    public void CreateEventCommandValidator_ValidCommand_PassesValidation()
    {
        var command = new CreateEventCommand(
            Title: "Hà Anh Tuấn Live Concert",
            Description: "Đêm nhạc đặc biệt",
            Date: DateTime.UtcNow.AddDays(7),
            EndDate: DateTime.UtcNow.AddDays(7).AddHours(3),
            Location: "Trung tâm Hội nghị Quốc gia",
            VenueName: "Khán phòng chính",
            TotalSeats: 60,
            Category: "Concert",
            ImageUrl: "https://example.com/banner.jpg",
            RowCount: 5,
            SeatsPerRow: 12
        );

        var result = _createEventValidator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void CreateEventCommandValidator_EmptyTitle_FailsValidation()
    {
        var command = new CreateEventCommand(
            Title: "",
            Description: "Đêm nhạc đặc biệt",
            Date: DateTime.UtcNow.AddDays(7),
            EndDate: DateTime.UtcNow.AddDays(7).AddHours(3),
            Location: "Hà Nội",
            VenueName: "Khán phòng",
            TotalSeats: 60,
            Category: "Concert",
            ImageUrl: "https://example.com/banner.jpg"
        );

        var result = _createEventValidator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreateEventCommand.Title));
    }

    [Fact]
    public void CreateEventCommandValidator_EndDateBeforeStartDate_FailsValidation()
    {
        var startDate = DateTime.UtcNow.AddDays(5);
        var command = new CreateEventCommand(
            Title: "Đêm nhạc Jazz",
            Description: "Nhạc Jazz đỉnh cao",
            Date: startDate,
            EndDate: startDate.AddHours(-1), // End before start
            Location: "Hà Nội",
            VenueName: "Nhà hát lớn",
            TotalSeats: 50,
            Category: "Music",
            ImageUrl: "https://example.com/banner.jpg"
        );

        var result = _createEventValidator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreateEventCommand.EndDate));
    }

    [Fact]
    public void CreateEventCommandValidator_InvalidSeatMatrix_FailsValidation()
    {
        var command = new CreateEventCommand(
            Title: "Workshop AI 2026",
            Description: "Hội thảo AI",
            Date: DateTime.UtcNow.AddDays(10),
            EndDate: DateTime.UtcNow.AddDays(10).AddHours(4),
            Location: "Hà Nội",
            VenueName: "Hội trường 1",
            TotalSeats: 0,
            Category: "Tech",
            ImageUrl: "https://example.com/banner.jpg",
            RowCount: 0, // Invalid
            SeatsPerRow: 150 // Invalid (> 100)
        );

        var result = _createEventValidator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreateEventCommand.RowCount));
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreateEventCommand.SeatsPerRow));
    }

    [Fact]
    public void CancelEventCommandValidator_ValidCommand_PassesValidation()
    {
        var command = new CancelEventCommand(
            Id: Guid.NewGuid(),
            Reason: "Điều kiện thời tiết bất khả kháng do bão"
        );

        var result = _cancelEventValidator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void CancelEventCommandValidator_EmptyReason_FailsValidation(string? emptyReason)
    {
        var command = new CancelEventCommand(
            Id: Guid.NewGuid(),
            Reason: emptyReason!
        );

        var result = _cancelEventValidator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CancelEventCommand.Reason));
    }

    [Theory]
    [InlineData("Admin", true)]
    [InlineData("Staff", true)]
    [InlineData("Customer", true)]
    [InlineData("SuperAdmin", false)] // Invalid role
    [InlineData("Hacker", false)]
    [InlineData("", false)]
    public void ChangeUserRoleCommandValidator_RoleWhitelisting(string role, bool expectedValid)
    {
        var command = new ChangeUserRoleCommand(Guid.NewGuid(), role);

        var result = _changeRoleValidator.Validate(command);

        result.IsValid.Should().Be(expectedValid);
    }
}

