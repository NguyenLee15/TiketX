using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using TickeX.Application.Interfaces;
using TickeX.Application.Payments.Events;
using Microsoft.Extensions.DependencyInjection;

namespace TickeX.Infrastructure.Messaging;

public class TicketPaidEventConsumer : BackgroundService
{
    private readonly ILogger<TicketPaidEventConsumer> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly string _hostname;
    private readonly string _queueName;
    private readonly string _username;
    private readonly string _password;
    private readonly int _port;
    private readonly bool _useTls;
    private readonly string? _virtualHost;
    private readonly string? _uri;
    private IConnection? _connection;
    private IChannel? _channel;

    public TicketPaidEventConsumer(IConfiguration configuration, ILogger<TicketPaidEventConsumer> logger, IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _uri = configuration["RabbitMQ:Uri"] ?? configuration["RABBITMQ_URI"];
        _hostname = configuration["RabbitMQ:HostName"] ?? "localhost";
        _queueName = configuration["RabbitMQ:QueueName"] ?? "ticket_events";
        _username = configuration["RabbitMQ:UserName"] ?? string.Empty;
        _password = configuration["RabbitMQ:Password"] ?? string.Empty;
        _port = configuration.GetValue("RabbitMQ:Port", 5672);
        _useTls = configuration.GetValue("RabbitMQ:UseTls", false);
        _virtualHost = configuration["RabbitMQ:VirtualHost"];
    }

    public override async Task StartAsync(CancellationToken cancellationToken)
    {
            var factory = CreateFactory();
        try
        {
            _connection = await factory.CreateConnectionAsync(cancellationToken);
            _channel = await _connection.CreateChannelAsync(cancellationToken: cancellationToken);

            await _channel.QueueDeclareAsync(queue: _queueName,
                                 durable: true,
                                 exclusive: false,
                                 autoDelete: false,
                                 arguments: null,
                                 cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not connect to RabbitMQ broker.");
        }

        await base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Add a retry loop for connecting to RabbitMQ in case it starts slower than the API
        while (_channel == null && !stoppingToken.IsCancellationRequested)
        {
            try
            {
                var factory = CreateFactory();
                _connection = await factory.CreateConnectionAsync(stoppingToken);
                _channel = await _connection.CreateChannelAsync(cancellationToken: stoppingToken);

                await _channel.QueueDeclareAsync(queue: _queueName,
                                     durable: true,
                                     exclusive: false,
                                     autoDelete: false,
                                     arguments: null,
                                     cancellationToken: stoppingToken);
                _logger.LogInformation("Successfully connected to RabbitMQ in ExecuteAsync.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("RabbitMQ not ready yet, retrying in 5 seconds... ({ErrorType})", ex.GetType().Name);
                await Task.Delay(5000, stoppingToken);
            }
        }

        if (_channel == null) return;

        var dlqName = $"{_queueName}.dlq";
        await _channel.QueueDeclareAsync(queue: dlqName,
                             durable: true,
                             exclusive: false,
                             autoDelete: false,
                             arguments: null,
                             cancellationToken: stoppingToken);

        const int maxRetries = 3;
        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += async (model, ea) =>
        {
            var body = ea.Body.ToArray();
            var message = Encoding.UTF8.GetString(body);
            var retryCount = GetRetryCount(ea.BasicProperties);

            try
            {
                var ticketEvent = JsonSerializer.Deserialize<TicketPaidEvent>(message);
                if (ticketEvent == null)
                {
                    throw new JsonException("Deserialized TicketPaidEvent payload was null.");
                }

                _logger.LogInformation("Received TicketPaidEvent for Ticket {TicketId}, User {UserId}. Generating QR Code and Email...", ticketEvent.TicketId, ticketEvent.UserId);

                using var scope = _scopeFactory.CreateScope();
                await ProcessEventWithIdempotencyAsync(ticketEvent, scope.ServiceProvider, _logger, stoppingToken);

                await _channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false, cancellationToken: stoppingToken);
            }
            catch (JsonException jsonEx)
            {
                _logger.LogError(jsonEx, "Poison message detected (invalid JSON). Routing immediately to DLQ {DlqName}.", dlqName);
                await ForwardToDlqAsync(_channel, dlqName, ea, "Permanent:InvalidJson", jsonEx.Message, stoppingToken);
                await _channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false, cancellationToken: stoppingToken);
            }
            catch (Exception ex)
            {
                if (retryCount >= maxRetries)
                {
                    _logger.LogError(ex, "Message {DeliveryTag} exceeded max retries ({MaxRetries}). Routing to DLQ {DlqName}.", ea.DeliveryTag, maxRetries, dlqName);
                    await ForwardToDlqAsync(_channel, dlqName, ea, $"MaxRetriesExceeded:{retryCount}", ex.Message, stoppingToken);
                    await _channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false, cancellationToken: stoppingToken);
                }
                else
                {
                    retryCount++;
                    _logger.LogWarning(ex, "Transient error processing message {DeliveryTag}. Scheduling bounded retry {Attempt}/{MaxRetries}...", ea.DeliveryTag, retryCount, maxRetries);
                    await Task.Delay(TimeSpan.FromSeconds(Math.Min(8, Math.Pow(2, retryCount))), stoppingToken);
                    await RepublishWithRetryAsync(_channel, _queueName, ea, retryCount, stoppingToken);
                    await _channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false, cancellationToken: stoppingToken);
                }
            }
        };

        await _channel.BasicConsumeAsync(queue: _queueName,
                             autoAck: false,
                             consumer: consumer,
                             cancellationToken: stoppingToken);
    }

    private static int GetRetryCount(IReadOnlyBasicProperties? properties)
    {
        if (properties?.Headers == null) return 0;
        if (!properties.Headers.TryGetValue("x-retry-count", out var value) || value == null) return 0;

        if (value is int intVal) return intVal;
        if (value is long longVal) return (int)longVal;
        if (value is byte[] bytes && int.TryParse(Encoding.UTF8.GetString(bytes), out var parsed)) return parsed;
        if (int.TryParse(value.ToString(), out var strParsed)) return strParsed;

        return 0;
    }

    private static async Task RepublishWithRetryAsync(
        IChannel channel,
        string queueName,
        BasicDeliverEventArgs ea,
        int retryCount,
        CancellationToken cancellationToken)
    {
        var props = new BasicProperties
        {
            DeliveryMode = DeliveryModes.Persistent
        };

        var headers = ea.BasicProperties?.Headers != null
            ? new Dictionary<string, object?>(ea.BasicProperties.Headers)
            : new Dictionary<string, object?>();

        headers["x-retry-count"] = retryCount;
        props.Headers = headers;

        await channel.BasicPublishAsync(
            exchange: string.Empty,
            routingKey: queueName,
            mandatory: false,
            basicProperties: props,
            body: ea.Body,
            cancellationToken: cancellationToken);
    }

    private static async Task ForwardToDlqAsync(
        IChannel channel,
        string dlqName,
        BasicDeliverEventArgs ea,
        string reason,
        string exceptionMessage,
        CancellationToken cancellationToken)
    {
        var props = new BasicProperties
        {
            DeliveryMode = DeliveryModes.Persistent
        };

        var headers = ea.BasicProperties?.Headers != null
            ? new Dictionary<string, object?>(ea.BasicProperties.Headers)
            : new Dictionary<string, object?>();

        headers["x-death-reason"] = reason;
        headers["x-exception-message"] = exceptionMessage;
        headers["x-dead-letter-timestamp"] = DateTime.UtcNow.ToString("O");
        props.Headers = headers;

        await channel.BasicPublishAsync(
            exchange: string.Empty,
            routingKey: dlqName,
            mandatory: false,
            basicProperties: props,
            body: ea.Body,
            cancellationToken: cancellationToken);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_channel != null)
        {
            await _channel.CloseAsync(cancellationToken);
            await _channel.DisposeAsync();
        }
        if (_connection != null)
        {
            await _connection.CloseAsync(cancellationToken);
            await _connection.DisposeAsync();
        }

        await base.StopAsync(cancellationToken);
    }

    private ConnectionFactory CreateFactory()
    {
        if (!string.IsNullOrWhiteSpace(_uri))
        {
            return new ConnectionFactory { Uri = new Uri(_uri) };
        }

        return new ConnectionFactory
        {
            HostName = _hostname,
            UserName = _username,
            Password = _password,
            Port = _port,
            VirtualHost = !string.IsNullOrWhiteSpace(_virtualHost) ? _virtualHost : "/",
            Ssl = new SslOption { Enabled = _useTls }
        };
    }

    public static async Task ProcessEventWithIdempotencyAsync(
        TicketPaidEvent ticketEvent,
        IServiceProvider serviceProvider,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var idempotencyStore = serviceProvider.GetService<IIdempotencyStore>();
        IdempotencyClaim? claim = null;
        string? idempotencyKey = null;

        if (idempotencyStore is not null)
        {
            idempotencyKey = $"idempotency:consumer:ticket_paid:{ticketEvent.TicketId:N}";
            claim = await idempotencyStore.TryClaimAsync(idempotencyKey, "PROCESSING", TimeSpan.FromHours(24), cancellationToken);
            if (!claim.Acquired)
            {
                logger.LogInformation("Duplicate ticket paid event ignored for ticket {TicketId}.", ticketEvent.TicketId);
                return;
            }
        }

        try
        {
            var dbContext = serviceProvider.GetRequiredService<IApplicationDbContext>();
            var emailService = serviceProvider.GetRequiredService<IEmailService>();

            var user = await dbContext.Users.FindAsync(new object[] { ticketEvent.UserId }, cancellationToken);
            if (user != null)
            {
                var ticket = await dbContext.Tickets
                    .AsNoTracking()
                    .Include(t => t.Event)
                    .Include(t => t.Seat)
                    .FirstOrDefaultAsync(t => t.Id == ticketEvent.TicketId, cancellationToken);

                var subject = $"Xác nhận vé điện tử TickeX: #{ticket?.OrderCode.ToString() ?? ticketEvent.TicketId.ToString()}";
                var safeName = System.Net.WebUtility.HtmlEncode(user.Name);
                var safeEventTitle = System.Net.WebUtility.HtmlEncode(ticket?.Event?.Title ?? "Sự kiện TickeX");
                var safeVenue = System.Net.WebUtility.HtmlEncode(ticket?.Event?.VenueName ?? ticket?.Event?.Location ?? "N/A");
                var seatLabel = ticket?.Seat is not null
                    ? System.Net.WebUtility.HtmlEncode($"{ticket.Seat.Row}{ticket.Seat.Number} ({ticket.Seat.Tier})")
                    : "N/A";
                var safeQrToken = System.Net.WebUtility.HtmlEncode(
                    !string.IsNullOrWhiteSpace(ticket?.QrCodeSignature)
                        ? ticket.QrCodeSignature
                        : ticketEvent.TicketId.ToString());

                var emailBody = $@"
                        <div style=""font-family: Arial, sans-serif; line-height: 1.6; color: #111827;"">
                            <h1>Cảm ơn bạn đã đặt vé, {safeName}!</h1>
                            <p>Vé điện tử của bạn (Mã vé: <strong>{ticketEvent.TicketId}</strong>) đã được xác nhận thanh toán thành công.</p>
                            <ul>
                                <li><strong>Sự kiện:</strong> {safeEventTitle}</li>
                                <li><strong>Địa điểm:</strong> {safeVenue}</li>
                                <li><strong>Vị trí ghế:</strong> {seatLabel}</li>
                            </ul>
                            <p><strong>Mã định danh QR (dùng để đối chiếu tại cổng soát vé hoặc xem trực tiếp trong mục Vé của tôi):</strong></p>
                            <pre style=""background:#f3f4f6;padding:12px;border-radius:6px;word-break:break-all;"">{safeQrToken}</pre>
                        </div>
                    ";

                await emailService.SendEmailAsync(user.Email, subject, emailBody);
                logger.LogInformation("Ticket notification sent for User {UserId} and Ticket {TicketId}.", ticketEvent.UserId, ticketEvent.TicketId);
            }

            if (idempotencyStore is not null && claim is not null && idempotencyKey is not null)
            {
                await idempotencyStore.CompleteAsync(idempotencyKey, claim.OwnerToken, "COMPLETED", TimeSpan.FromHours(24), cancellationToken);
            }
        }
        catch
        {
            if (idempotencyStore is not null && claim is not null && idempotencyKey is not null)
            {
                try
                {
                    await idempotencyStore.ReleaseAsync(idempotencyKey, claim.OwnerToken, cancellationToken);
                }
                catch
                {
                    // Non-fatal cleanup suppression
                }
            }
            throw;
        }
    }
}
