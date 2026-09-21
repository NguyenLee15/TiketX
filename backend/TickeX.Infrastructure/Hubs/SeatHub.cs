using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Hubs;

[AllowAnonymous]
public class SeatHub : Hub
{
    private readonly IApplicationDbContext _context;

    public SeatHub(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task JoinEventGroup(Guid eventId)
    {
        if (eventId == Guid.Empty) return;

        var exists = await _context.Events.AnyAsync(e => e.Id == eventId && !e.IsDeleted);
        if (!exists) return;

        await Groups.AddToGroupAsync(Context.ConnectionId, eventId.ToString());
    }

    public async Task LeaveEventGroup(Guid eventId)
    {
        if (eventId == Guid.Empty) return;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, eventId.ToString());
    }
}
