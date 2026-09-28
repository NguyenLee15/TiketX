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
    private readonly ISeatHubAdmissionPolicy _admission;

    public SeatHub(IApplicationDbContext context, ISeatHubAdmissionPolicy admission, ITimePolicy? time = null)
    {
        _context = context;
        _admission = admission;
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

        var clientIp = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString();
        if (!await _admission.TryJoinAsync(Context.ConnectionId, clientIp, eventId)) return;

        await Groups.AddToGroupAsync(Context.ConnectionId, eventId.ToString());
    }

    public async Task LeaveEventGroup(Guid eventId)
    {
        if (eventId == Guid.Empty) return;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, eventId.ToString());
        await _admission.LeaveGroupAsync(Context.ConnectionId, eventId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await _admission.ReleaseAsync(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
