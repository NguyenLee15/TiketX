using System.Reflection;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.WebApi.Controllers;

namespace TickeX.UnitTests.Security;

public sealed class PublicEventRateLimitTests
{
    [Theory]
    [InlineData(nameof(EventsController.GetEvents))]
    [InlineData(nameof(EventsController.GetEvent))]
    public void PublicCatalogActions_UsePublicCatalogRateLimit(string actionName)
    {
        var action = typeof(EventsController).GetMethod(actionName);
        var rateLimit = action?.GetCustomAttribute<EnableRateLimitingAttribute>();

        rateLimit.Should().NotBeNull();
        rateLimit!.PolicyName.Should().Be("PublicCatalogPolicy");
    }
}
