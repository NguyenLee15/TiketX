using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;
using Xunit;
using FluentAssertions;

namespace TickeX.UnitTests.Concurrency;

public class ConcurrencySeatReservationTests
{
    [Fact]
    public async Task ConcurrentSeatLockSimulation_OnlyOneThreadCanLock()
    {
        // Arrange
        var seat = new Seat(Guid.NewGuid(), "A", 10, 200000, SeatTier.VIP);
        var successCount = 0;
        var failCount = 0;
        var locker = new object();

        // Act: Simulate 20 concurrent threads trying to lock the exact same seat
        var tasks = new Task[20];
        for (int i = 0; i < 20; i++)
        {
            var requestingUserId = Guid.NewGuid();
            tasks[i] = Task.Run(() =>
            {
                lock (locker)
                {
                    if (seat.Status == SeatStatus.Available)
                    {
                        seat.Lock(requestingUserId);
                        successCount++;
                    }
                    else
                    {
                        failCount++;
                    }
                }
            });
        }

        await Task.WhenAll(tasks);

        // Assert: Exactly 1 successfully acquired the seat, 19 failed with race condition handled
        successCount.Should().Be(1);
        failCount.Should().Be(19);
        seat.Status.Should().Be(SeatStatus.Locked);
    }
}