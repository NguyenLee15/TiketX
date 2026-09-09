using TickeX.Application.Admin.Commands;
using TickeX.Application.Common.Models;

namespace TickeX.Application.Interfaces;

public interface IAdminUserOperations
{
    Task<AdminOperationResult> ChangeRoleAsync(ChangeUserRoleCommand command, CancellationToken cancellationToken);
    Task<AdminOperationResult> SetBlockedAsync(BlockUserCommand command, CancellationToken cancellationToken);
}
