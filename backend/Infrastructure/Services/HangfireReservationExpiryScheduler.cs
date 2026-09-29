using Hangfire;
using MediatR;
using TickeX.Application.Interfaces;
using TickeX.Application.Seats.Commands;

namespace TickeX.Infrastructure.Services;

public sealed class HangfireReservationExpiryScheduler : IReservationExpiryScheduler
{
    private readonly IBackgroundJobClient _jobs;

    public HangfireReservationExpiryScheduler(IBackgroundJobClient jobs) => _jobs = jobs;

    public void Schedule(Guid ticketId, TimeSpan delay) =>
        _jobs.Schedule<IMediator>(
            mediator => mediator.Send(new ReleaseSeatCommand(ticketId), CancellationToken.None),
            delay);
}
