using TickeX.Application.Tickets.Commands;

namespace TickeX.Application.Interfaces;

public interface ICheckInOperations
{
    Task<CheckInResult> CheckInAsync(CheckInTicketCommand command, CancellationToken cancellationToken);
}
