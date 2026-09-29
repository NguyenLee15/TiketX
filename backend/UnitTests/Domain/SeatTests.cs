using System;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using Xunit;
using FluentAssertions;

namespace TickeX.UnitTests.Domain;

public class SeatTests
{
    [Fact]
    public void Lock_WhenSeatIsAvailable_ShouldTransitionToLocked()
    {
        // Arrange
        var seat = new Seat(Guid.NewGuid(), "A", 1, 100000, SeatTier.Standard);
        var userId = Guid.NewGuid();

        // Act
        seat.Lock(userId);

        // Assert
        seat.Status.Should().Be(SeatStatus.Locked);
        seat.LockedByUserId.Should().Be(userId);
    }

    [Fact]
    public void Lock_WhenSeatIsAlreadySold_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var seat = new Seat(Guid.NewGuid(), "A", 1, 100000, SeatTier.Standard);
        seat.MarkAsSold();
        var userId = Guid.NewGuid();

        // Act
        Action act = () => seat.Lock(userId);

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("Seat is not available for reservation.");
    }

    [Fact]
    public void Release_WhenSeatIsLocked_ShouldTransitionBackToAvailable()
    {
        // Arrange
        var seat = new Seat(Guid.NewGuid(), "A", 1, 100000, SeatTier.Standard);
        var userId = Guid.NewGuid();
        seat.Lock(userId);

        // Act
        seat.Release();

        // Assert
        seat.Status.Should().Be(SeatStatus.Available);
        seat.LockedByUserId.Should().BeNull();
    }

    [Fact]
    public void MarkAsSold_ShouldTransitionToSold()
    {
        // Arrange
        var seat = new Seat(Guid.NewGuid(), "A", 1, 100000, SeatTier.Standard);
        var userId = Guid.NewGuid();
        seat.Lock(userId);

        // Act
        seat.MarkAsSold();

        // Assert
        seat.Status.Should().Be(SeatStatus.Sold);
    }
}
