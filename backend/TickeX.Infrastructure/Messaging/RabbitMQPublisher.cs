using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using RabbitMQ.Client;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Messaging;

public class RabbitMQPublisher : IMessagePublisher
{
    private readonly string _hostname;
    private readonly string _queueName;
    private readonly string _username;
    private readonly string _password;
    private readonly int _port;
    private readonly bool _useTls;

    public RabbitMQPublisher(IConfiguration configuration)
    {
        _hostname = configuration["RabbitMQ:HostName"] ?? "localhost";
        _queueName = configuration["RabbitMQ:QueueName"] ?? "ticket_events";
        _username = configuration["RabbitMQ:UserName"] ?? string.Empty;
        _password = configuration["RabbitMQ:Password"] ?? string.Empty;
        _port = configuration.GetValue("RabbitMQ:Port", 5672);
        _useTls = configuration.GetValue("RabbitMQ:UseTls", false);
    }

    public async Task PublishAsync<T>(T message, CancellationToken cancellationToken = default)
    {
        var factory = new ConnectionFactory
        {
            HostName = _hostname, UserName = _username, Password = _password, Port = _port,
            Ssl = new SslOption { Enabled = _useTls }
        };
        using var connection = await factory.CreateConnectionAsync(cancellationToken);
        using var channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken);

        await channel.QueueDeclareAsync(queue: _queueName,
                             durable: true,
                             exclusive: false,
                             autoDelete: false,
                             arguments: null,
                             cancellationToken: cancellationToken);

        var json = JsonSerializer.Serialize(message);
        var body = Encoding.UTF8.GetBytes(json);

        await channel.BasicPublishAsync(exchange: string.Empty,
                             routingKey: _queueName,
                             body: body,
                             cancellationToken: cancellationToken);
    }
}
