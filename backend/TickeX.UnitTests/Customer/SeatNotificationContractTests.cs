using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Moq;
using TickeX.Infrastructure.Hubs;
using TickeX.Infrastructure.Services;
using Xunit;

namespace TickeX.UnitTests.Customer;

public sealed class SeatNotificationContractTests
{
    [Fact]
    public async Task PublicEventPayload_ContainsVersionButNeverReservationOwner()
    {
        object? payload = null;
        var proxy = new Mock<IClientProxy>();
        proxy.Setup(x => x.SendCoreAsync("SeatStatusChanged", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Callback<string, object?[], CancellationToken>((_, args, _) => payload = args[0])
            .Returns(Task.CompletedTask);
        var clients = new Mock<IHubClients>();
        clients.Setup(x => x.Group(It.IsAny<string>())).Returns(proxy.Object);
        var hub = new Mock<IHubContext<SeatHub>>();
        hub.SetupGet(x => x.Clients).Returns(clients.Object);
        var service = new SeatNotificationService(hub.Object);

        await service.NotifySeatStatusChanged(Guid.NewGuid(), Guid.NewGuid(), "Locked", "version-token", DateTime.UtcNow.AddMinutes(5));

        var json = JsonSerializer.Serialize(payload);
        json.Should().Contain("version-token");
        json.ToLowerInvariant().Should().NotContain("reservationowner");
        json.ToLowerInvariant().Should().NotContain("islockedbycurrentuser");
    }
}
