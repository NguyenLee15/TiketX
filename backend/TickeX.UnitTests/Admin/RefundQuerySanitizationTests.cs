using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Admin.Queries;
using TickeX.Domain.Entities;
using TickeX.Infrastructure.Persistence;
using Xunit;

namespace TickeX.UnitTests.Admin;

public sealed class RefundQuerySanitizationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ApplicationDbContext _context;

    public RefundQuerySanitizationTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new ApplicationDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData("\r\n\t", null)]
    public void SanitizeError_WithNullOrWhitespace_ReturnsNull(string? input, string? expected)
    {
        var result = GetRefundRequestsQueryHandler.SanitizeError(input);
        result.Should().Be(expected);
    }

    [Fact]
    public void SanitizeError_WithSingleLineMessage_ReturnsTrimmedMessage()
    {
        var raw = "  PayOS webhook connection timeout  ";
        var result = GetRefundRequestsQueryHandler.SanitizeError(raw);
        result.Should().Be("PayOS webhook connection timeout");
    }

    [Fact]
    public void SanitizeError_WithMultiLineStackTrace_ReturnsOnlyFirstLine()
    {
        var raw = "System.Net.Http.HttpRequestException: Connection refused\r\n   at System.Net.Http.HttpConnection.SendAsync()\r\n   at PayOSClient.Transfer()";
        var result = GetRefundRequestsQueryHandler.SanitizeError(raw);
        result.Should().Be("System.Net.Http.HttpRequestException: Connection refused");
    }

    [Fact]
    public void SanitizeError_WithOver200Chars_TruncatesWithEllipsis()
    {
        var longMessage = new string('A', 250);
        var result = GetRefundRequestsQueryHandler.SanitizeError(longMessage);
        result.Should().HaveLength(203);
        result.Should().EndWith("...");
        result!.Substring(0, 200).Should().Be(new string('A', 200));
    }

    [Fact]
    public async Task Handle_WithOutOfRangePageAndPageSize_ClampsSafelyWithoutException()
    {
        // Arrange
        var refund = new RefundRequest(Guid.NewGuid(), Guid.NewGuid(), 100_000m, "idemp-key-1");
        refund.MarkFailed("Network timeout error\r\n   at InternalCall()", TimeSpan.FromMinutes(5));
        _context.RefundRequests.Add(refund);
        await _context.SaveChangesAsync();

        var handler = new GetRefundRequestsQueryHandler(_context);

        // Act: Page = -5 (should clamp to 1), PageSize = 500 (should clamp to 100)
        var result = await handler.Handle(new GetRefundRequestsQuery(-5, 500), CancellationToken.None);

        // Assert
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(100);
        result.Items.Should().HaveCount(1);
        result.Items[0].LastError.Should().Be("Network timeout error");
    }
}
