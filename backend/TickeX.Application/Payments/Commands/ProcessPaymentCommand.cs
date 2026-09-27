using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Payments.Commands;

public record ProcessPaymentCommand(PayOSWebhookData PaymentData) : IRequest<bool>;
