using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TickeX.Application.Interfaces;
using TickeX.Application.Payments.Events;

namespace TickeX.Infrastructure.Messaging;

public sealed class NotificationOutboxDispatcher : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificationOutboxDispatcher> _logger;
    public NotificationOutboxDispatcher(IServiceScopeFactory scopeFactory, ILogger<NotificationOutboxDispatcher> logger) => (_scopeFactory, _logger) = (scopeFactory, logger);
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { await DispatchBatchAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception ex) { _logger.LogError(ex, "Notification outbox dispatch failed"); }
        }
    }
    private async Task DispatchBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var publisher = scope.ServiceProvider.GetRequiredService<IMessagePublisher>();
        var pending = await context.NotificationOutbox.Where(x => x.Status == "Pending" && (x.NextAttemptAt == null || x.NextAttemptAt <= DateTime.UtcNow)).OrderBy(x => x.CreatedAt).Take(20).ToListAsync(cancellationToken);
        foreach (var item in pending)
        {
            try { await publisher.PublishAsync(new TicketPaidEvent(item.TicketId, item.UserId, item.EventId), cancellationToken); item.MarkCompleted(); }
            catch (Exception ex) { item.MarkFailed(ex.Message, TimeSpan.FromMinutes(1)); _logger.LogWarning(ex, "Retrying notification outbox item {OutboxId}", item.Id); }
        }
        if (pending.Count > 0) await context.SaveChangesAsync(cancellationToken);
    }
}
