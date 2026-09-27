using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TickeX.Application.Interfaces;
using TickeX.Application.Payments;
using TickeX.Application.Seats;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Application.Payments.Commands;

public partial class ProcessPaymentCommandHandler : IRequestHandler<ProcessPaymentCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationOutboxPort _notificationOutbox;
    private readonly ISeatNotificationService _notificationService;
    private readonly IDistributedLockService _lockService;
    private readonly ITicketSecurityService _ticketSecurityService;
    private readonly ILogger<ProcessPaymentCommandHandler> _logger;
    private readonly ITimePolicy _time;
    private readonly TimeSpan _holdDuration;

    public ProcessPaymentCommandHandler(
        IApplicationDbContext context, 
        INotificationOutboxPort notificationOutbox, 
        ISeatNotificationService notificationService, 
        IDistributedLockService lockService,
        ITicketSecurityService ticketSecurityService,
        ILogger<ProcessPaymentCommandHandler> logger,
        ITimePolicy? time = null,
        IOptions<ReservationOptions>? reservationOptions = null)
    {
        _context = context;
        _notificationOutbox = notificationOutbox;
        _notificationService = notificationService;
        _lockService = lockService;
        _ticketSecurityService = ticketSecurityService;
        _logger = logger;
        _time = time ?? new UtcTimePolicy();
        _holdDuration = TimeSpan.FromMinutes(reservationOptions?.Value.HoldMinutes ?? new ReservationOptions().HoldMinutes);
    }

}
