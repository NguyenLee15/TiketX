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
    EventStatus Status = EventStatus.Published) : IRequest<Guid>;

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
        await _context.SaveChangesAsync(cancellationToken);

        return newEvent.Id;
    }
}
