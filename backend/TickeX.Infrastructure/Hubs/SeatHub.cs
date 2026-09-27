using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;
using TickeX.Domain.Enums;

namespace TickeX.Infrastructure.Hubs;

[AllowAnonymous]
public class SeatHub : Hub
{
    private readonly IApplicationDbContext _context;
    private readonly ITimePolicy _time;

    public SeatHub(IApplicationDbContext context, ITimePolicy? time = null)
    {
        _context = context;
        _time = time ?? new UtcTimePolicy();
    }

    public async Task JoinEventGroup(Guid eventId)
    {
        if (eventId == Guid.Empty) return;

        var exists = await _context.Events.AnyAsync(e =>
            e.Id == eventId
            && !e.IsDeleted
            && e.Status == EventStatus.Published
            && e.Date > _time.UtcNow);
        if (!exists) return;

        await Groups.AddToGroupAsync(Context.ConnectionId, eventId.ToString());
    }

    public async Task LeaveEventGroup(Guid eventId)
    {
        if (eventId == Guid.Empty) return;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, eventId.ToString());
    }
}
