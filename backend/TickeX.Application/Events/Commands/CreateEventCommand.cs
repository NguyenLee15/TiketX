using MediatR;
using TickeX.Application.Interfaces;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Application.Events.Commands;

public record CreateEventCommand(
    string Title,
    string Description,
    DateTime Date,
    DateTime EndDate,
    string Location,
    string VenueName,
    int TotalSeats,
    string Category,
    string ImageUrl,
    string BannerUrl = "",
    string OrganizerName = "TickeX Live",
    decimal BasePrice = 200000m,
    int RefundCutoffHours = 24,
    int RowCount = 5,
    int SeatsPerRow = 12,
    EventStatus Status = EventStatus.Published,
    Guid? AdminUserId = null,
    string AdminEmail = "admin@tickex.com",
    string? IpAddress = null) : IRequest<Guid>;

public class CreateEventCommandHandler : IRequestHandler<CreateEventCommand, Guid>
{
    private readonly IApplicationDbContext _context;

    public CreateEventCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Guid> Handle(CreateEventCommand request, CancellationToken cancellationToken)
    {
        var newEvent = new Event(
            request.Title,
            request.Description,
            request.Date,
            request.EndDate,
            request.Location,
            request.VenueName,
            request.TotalSeats,
            request.Category,
            request.ImageUrl,
            request.BannerUrl,
            request.OrganizerName,
            request.BasePrice,
            request.RefundCutoffHours,
            request.Status);

        newEvent.GenerateSeatsMatrix(
            request.RowCount,
            request.SeatsPerRow);

        _context.Events.Add(newEvent);

        var audit = new AuditLog(
            userId: request.AdminUserId,
            userEmail: request.AdminEmail,
            action: "CREATE_EVENT",
            entityName: "Event",
            entityId: newEvent.Id.ToString(),
            beforeState: null,
            afterState: $"Title={newEvent.Title},Date={newEvent.Date:O},TotalSeats={newEvent.TotalSeats},BasePrice={newEvent.BasePrice}",
            ipAddress: request.IpAddress
        );
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync(cancellationToken);

        return newEvent.Id;
    }
}
