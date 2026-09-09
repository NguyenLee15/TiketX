using TickeX.Application.Common.Models;
using TickeX.Application.Events.Commands;

namespace TickeX.Application.Interfaces;

public interface IAdminEventOperations
{
    Task<Guid> CreateAsync(CreateEventCommand command, CancellationToken cancellationToken);
    Task<AdminOperationResult> UpdateAsync(UpdateEventCommand command, CancellationToken cancellationToken);
    Task<AdminOperationResult> CancelAsync(CancelEventCommand command, CancellationToken cancellationToken);
    Task<AdminOperationResult> DeleteAsync(DeleteEventCommand command, CancellationToken cancellationToken);
}
