using MediatR;
using TickeX.Application.Admin.Commands;
using TickeX.Application.Common.Models;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Admin;

public sealed class AdminUserOperations : IAdminUserOperations
{
    private readonly IMediator _mediator;

    public AdminUserOperations(IMediator mediator) => _mediator = mediator;

    public Task<AdminOperationResult> ChangeRoleAsync(ChangeUserRoleCommand command, CancellationToken cancellationToken) =>
        _mediator.Send(command, cancellationToken);

    public Task<AdminOperationResult> SetBlockedAsync(BlockUserCommand command, CancellationToken cancellationToken) =>
        _mediator.Send(command, cancellationToken);
}
