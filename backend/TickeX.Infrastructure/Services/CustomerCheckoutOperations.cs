using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TickeX.Application.Interfaces;
using TickeX.Application.Payments.Commands;
using TickeX.Application.Seats;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Infrastructure.Services;

public sealed class CustomerCheckoutOperations : ICustomerCheckoutOperations
{
    private readonly IApplicationDbContext _context;
    private readonly IPayOSService _payOS;
    private readonly IMediator _mediator;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<CustomerCheckoutOperations> _logger;
    private readonly ITimePolicy _time;
    private readonly IDistributedLockService _locks;

    public CustomerCheckoutOperations(IApplicationDbContext context, IPayOSService payOS, IMediator mediator,
        IConfiguration configuration, IHostEnvironment environment, ILogger<CustomerCheckoutOperations> logger, IDistributedLockService locks)
        : this(context, payOS, mediator, configuration, environment, logger, locks, null)
    {
    }

    public CustomerCheckoutOperations(IApplicationDbContext context, IPayOSService payOS, IMediator mediator,
        IConfiguration configuration, IHostEnvironment environment, ILogger<CustomerCheckoutOperations> logger, IDistributedLockService locks, ITimePolicy? time)
    {
        _context = context;
        _payOS = payOS;
        _mediator = mediator;
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
        _time = time ?? new UtcTimePolicy();
        _locks = locks;
    }

    public async Task<CustomerCheckoutResult> GetStatusAsync(long orderCode, Guid userId, CancellationToken cancellationToken)
    {
        var ticket = await _context.Tickets.AsNoTracking()
            .Where(t => t.OrderCode == orderCode && t.UserId == userId)
            .Select(t => new { t.Id, t.OrderCode, t.Status, t.Price })
            .SingleOrDefaultAsync(cancellationToken);
        if (ticket is null) return Fail("PAYMENT_NOT_FOUND", "Không tìm thấy đơn hàng.");
        var refundStatus = await _context.RefundRequests.AsNoTracking()
            .Where(r => r.TicketId == ticket.Id)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => r.Status)
            .FirstOrDefaultAsync(cancellationToken);
        return new(true, "PAYMENT_STATUS", "Đã lấy trạng thái thanh toán.", ticket.OrderCode, ticket.Price,
            Status: ToPublicStatus(ticket.Status), TicketId: ticket.Id, RefundStatus: refundStatus);
    }

    public async Task<CustomerCheckoutResult> CreatePaymentLinkAsync(Guid ticketId, Guid userId, CancellationToken cancellationToken)
    {
        var ticket = await _context.Tickets.Include(t => t.Event).SingleOrDefaultAsync(t => t.Id == ticketId, cancellationToken);
        if (ticket is null) return Fail("PAYMENT_NOT_FOUND", "Không tìm thấy vé.");
        if (ticket.UserId != userId) return Fail("PAYMENT_FORBIDDEN", "Bạn không có quyền thanh toán vé này.");
        IDistributedLockLease? lease;
        try { lease = await _locks.AcquireLockAsync($"payment:lock:{ticket.OrderCode}", TimeSpan.FromSeconds(30), cancellationToken); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Payment lock unavailable for {OrderCode}", ticket.OrderCode);
            return Fail("PAYMENT_LOCK_UNAVAILABLE", "Giao dịch đang được xử lý. Vui lòng thử lại.");
        }
        if (lease is null) return Fail("PAYMENT_LOCK_UNAVAILABLE", "Giao dịch đang được xử lý. Vui lòng thử lại.");
        await using (lease)
        {
        var currentStatus = await _context.Tickets.AsNoTracking().Where(t => t.Id == ticketId)
            .Select(t => t.Status).SingleAsync(cancellationToken);
        if (currentStatus != TicketStatus.Pending)
            return Fail(currentStatus == TicketStatus.Paid ? "PAYMENT_ALREADY_PAID" : "PAYMENT_NOT_PENDING", "Vé không còn chờ thanh toán.");
        var holdMinutes = _configuration.GetValue<int>("Reservation:HoldMinutes", new ReservationOptions().HoldMinutes);
        var holdThreshold = _time.UtcNow.AddMinutes(-holdMinutes);
        if (ticket.CreatedAt <= holdThreshold)
            return Fail("RESERVATION_EXPIRED", "Thời gian giữ vé đã hết hạn. Vui lòng chọn lại ghế.");
        if (ticket.Event is null || ticket.Event.IsDeleted || ticket.Event.Status != EventStatus.Published || ticket.Event.Date <= _time.UtcNow)
            return Fail("EVENT_NOT_ON_SALE", "Sự kiện không còn mở bán.");

        var clientId = _configuration["PayOS:ClientId"];
        if ((string.IsNullOrWhiteSpace(clientId) || clientId == "YOUR_PAYOS_CLIENT_ID") && !_environment.IsDevelopment())
            return Fail("PAYMENT_PROVIDER_UNAVAILABLE", "Cổng thanh toán chưa được cấu hình.");

        var existing = await _context.PaymentTransactions
            .SingleOrDefaultAsync(x => x.OrderCode == ticket.OrderCode, cancellationToken);

        if (existing is not null)
        {
            if (existing.Status == "Pending" && !string.IsNullOrWhiteSpace(existing.CheckoutUrl))
                return Link(ticket, existing.CheckoutUrl);

            if (existing.Status == "Pending" && string.IsNullOrWhiteSpace(existing.CheckoutUrl))
                return Fail("PAYMENT_LINK_IN_PROGRESS", "Yêu cầu thanh toán cần được đối soát trước khi thử lại.");
        }

        PaymentTransaction transaction;
        if (existing is null)
        {
            // Pre-persist local intent to claim atomic ownership at the DB level before external provider I/O
            transaction = new PaymentTransaction(ticket.OrderCode, ticket.Id, ticket.Price, "VietQR_PayOS");
            _context.PaymentTransactions.Add(transaction);
            try
            {
                if (!lease.IsValid) return Fail("PAYMENT_LOCK_UNAVAILABLE", "Giao dịch đang được xử lý. Vui lòng thử lại.");
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex)
            {
                _logger.LogInformation(ex, "A competing payment-link request won the intent race for {OrderCode}", ticket.OrderCode);
                var concurrent = await _context.PaymentTransactions.AsNoTracking()
                    .SingleOrDefaultAsync(x => x.OrderCode == ticket.OrderCode, cancellationToken);
                if (concurrent is not null && concurrent.Status == "Pending" && !string.IsNullOrWhiteSpace(concurrent.CheckoutUrl))
                    return Link(ticket, concurrent.CheckoutUrl);
                return Fail("PAYMENT_LINK_CONFLICT", "Yêu cầu thanh toán đang được xử lý. Vui lòng thử lại.");
            }
        }
        else
        {
            transaction = existing;
        }

        var checkoutUrl = string.Empty;
        if (string.IsNullOrWhiteSpace(clientId) || clientId == "YOUR_PAYOS_CLIENT_ID")
        {
            if (!_environment.IsDevelopment())
            {
                return Fail("PAYMENT_PROVIDER_UNAVAILABLE", "Cổng thanh toán chưa được cấu hình.");
            }
            checkoutUrl = $"/mock-payos?orderCode={ticket.OrderCode}";
        }
        else
        {
            try
            {
                var result = await _payOS.CreatePaymentLink(ticket.OrderCode, decimal.ToInt32(ticket.Price),
                    $"TickeX {ticket.OrderCode}", ReturnUrl(ticket.OrderCode), CancelUrl(ticket.OrderCode), cancellationToken,
                    new DateTimeOffset(DateTime.SpecifyKind(ticket.CreatedAt, DateTimeKind.Utc).AddMinutes(holdMinutes)));
                if (result is null || string.IsNullOrWhiteSpace(result.CheckoutUrl))
                {
                    return Fail("PAYMENT_PROVIDER_UNAVAILABLE", "Không thể tạo liên kết thanh toán.");
                }
                checkoutUrl = result.CheckoutUrl;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PayOS CreatePaymentLink failed for {OrderCode}", ticket.OrderCode);
                return Fail("PAYMENT_PROVIDER_ERROR", "Lỗi kết nối cổng thanh toán. Vui lòng thử lại.");
            }
        }

        // Re-validate that the ticket hold has not expired during external PayOS I/O
        var latest = await _context.Tickets.AsNoTracking().Where(t => t.Id == ticketId)
            .Select(t => new { t.CreatedAt, t.Status }).SingleAsync(cancellationToken);
        if (latest.CreatedAt <= _time.UtcNow.AddMinutes(-holdMinutes) || latest.Status != TicketStatus.Pending)
        {
            return Fail("RESERVATION_EXPIRED", "Thời gian giữ vé đã hết hạn trong lúc khởi tạo thanh toán. Vui lòng chọn lại ghế.");
        }

        transaction.SetCheckoutUrl(checkoutUrl);
        if (!lease.IsValid) return Fail("PAYMENT_LOCK_UNAVAILABLE", "Giao dịch đang được xử lý. Vui lòng thử lại.");
        await _context.SaveChangesAsync(cancellationToken);
        return Link(ticket, checkoutUrl);
        }
    }

    public async Task<CustomerCheckoutResult> ProcessWebhookAsync(string payload, string signature, CancellationToken cancellationToken)
    {
        var data = _payOS.VerifyPaymentWebhookData(payload, signature);
        if (data is null) return Fail("INVALID_PAYMENT_WEBHOOK", "Dữ liệu thanh toán không hợp lệ.");
        var processed = await _mediator.Send(new ProcessPaymentCommand(data), cancellationToken);
        return processed
            ? new(true, "PAYMENT_PROCESSED", "Payment processed.", data.OrderCode)
            : Fail("PAYMENT_PROCESSING_FAILED", "Không thể xử lý thanh toán cho đơn hàng này.");
    }

    public async Task<CustomerCheckoutResult> SimulateSuccessAsync(long orderCode, Guid userId, CancellationToken cancellationToken)
    {
        if (!_environment.IsDevelopment()) return Fail("PAYMENT_SIMULATION_DISABLED", "Mô phỏng thanh toán chỉ có ở môi trường phát triển.");
        var ticket = await _context.Tickets.AsNoTracking().SingleOrDefaultAsync(t => t.OrderCode == orderCode && t.UserId == userId, cancellationToken);
        if (ticket is null) return Fail("PAYMENT_NOT_FOUND", "Không tìm thấy đơn hàng.");
        var data = new PayOSWebhookData { OrderCode = ticket.OrderCode, Amount = ticket.Price, Code = "00", Success = true, RawPayload = "development-simulation" };
        return await _mediator.Send(new ProcessPaymentCommand(data), cancellationToken)
            ? new(true, "PAYMENT_PROCESSED", "Đã xác nhận thanh toán.", ticket.OrderCode)
            : Fail("PAYMENT_PROCESSING_FAILED", "Không thể xác nhận thanh toán.");
    }

    private CustomerCheckoutResult Link(Ticket ticket, string checkoutUrl) =>
        new(true, "PAYMENT_LINK_CREATED", "Đã tạo liên kết thanh toán.", ticket.OrderCode, ticket.Price, checkoutUrl, "Pending", ticket.Id);
    private string ReturnUrl(long orderCode) => $"{_configuration["PayOS:ReturnUrl"] ?? "http://localhost:5173/payment-result"}?orderCode={orderCode}";
    private string CancelUrl(long orderCode) => $"{_configuration["PayOS:CancelUrl"] ?? "http://localhost:5173/my-tickets"}?orderCode={orderCode}";
    private static CustomerCheckoutResult Fail(string code, string message) => new(false, code, message);
    private static string ToPublicStatus(TicketStatus status) => status switch
    {
        TicketStatus.Pending => "Pending",
        TicketStatus.Paid => "Paid",
        TicketStatus.Cancelled => "Cancelled",
        TicketStatus.Used => "Used",
        TicketStatus.RefundPending => "RefundPending",
        _ => "Unknown"
    };
}
