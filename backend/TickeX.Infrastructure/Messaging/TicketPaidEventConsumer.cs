using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
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
    private IConnection? _connection;
    private IChannel? _channel;

    public TicketPaidEventConsumer(IConfiguration configuration, ILogger<TicketPaidEventConsumer> logger, IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _hostname = configuration["RabbitMQ:HostName"] ?? "localhost";
        _queueName = configuration["RabbitMQ:QueueName"] ?? "ticket_events";
        _username = configuration["RabbitMQ:UserName"] ?? string.Empty;
        _password = configuration["RabbitMQ:Password"] ?? string.Empty;
        _port = configuration.GetValue("RabbitMQ:Port", 5672);
        _useTls = configuration.GetValue("RabbitMQ:UseTls", false);
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
                _logger.LogWarning("RabbitMQ not ready yet, retrying in 5 seconds... ({Message})", ex.Message);
                await Task.Delay(5000, stoppingToken);
            }
        }

        if (_channel == null) return;

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += async (model, ea) =>
        {
            var body = ea.Body.ToArray();
            var message = Encoding.UTF8.GetString(body);
            
            try
            {
                var ticketEvent = JsonSerializer.Deserialize<TicketPaidEvent>(message);
                if (ticketEvent != null)
                {
                    _logger.LogInformation("Received TicketPaidEvent for Ticket {TicketId}, User {UserId}. Generating QR Code and Email...", ticketEvent.TicketId, ticketEvent.UserId);
                    
                    using var scope = _scopeFactory.CreateScope();
                    var dbContext = scope.ServiceProvider.GetRequiredService<TickeX.Application.Interfaces.IApplicationDbContext>();
                    var emailService = scope.ServiceProvider.GetRequiredService<TickeX.Application.Interfaces.IEmailService>();

                    var user = await dbContext.Users.FindAsync(new object[] { ticketEvent.UserId }, stoppingToken);
                    if (user != null)
                    {
                        var subject = $"Your TickeX Ticket: {ticketEvent.TicketId}";
                        var emailBody = $@"
                            <h1>Thank you for your purchase, {user.Name}!</h1>
                            <p>Your ticket (ID: {ticketEvent.TicketId}) is confirmed.</p>
                            <p>Here is your QR Code: [QR_CODE_IMG]</p>
                        ";
                        
                        await emailService.SendEmailAsync(user.Email, subject, emailBody);
                        _logger.LogInformation("Ticket notification sent for User {UserId} and Ticket {TicketId}.", ticketEvent.UserId, ticketEvent.TicketId);
                    }
                }

                await _channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false, cancellationToken: stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing message. Requeueing...");
                // Requeue = true so we don't lose the message if there's a transient failure (e.g. SMTP down)
                await _channel.BasicNackAsync(deliveryTag: ea.DeliveryTag, multiple: false, requeue: true, cancellationToken: stoppingToken);
            }
        };

        await _channel.BasicConsumeAsync(queue: _queueName,
                             autoAck: false,
                             consumer: consumer,
                             cancellationToken: stoppingToken);
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

    private ConnectionFactory CreateFactory() => new()
    {
        HostName = _hostname, UserName = _username, Password = _password, Port = _port,
        Ssl = new SslOption { Enabled = _useTls }
    };
}
