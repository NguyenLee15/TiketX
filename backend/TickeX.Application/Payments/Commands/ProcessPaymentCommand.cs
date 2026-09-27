using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Payments.Commands;

public record ProcessPaymentResult(
    bool Success, 
    bool IsTransient = false, 
    string Code = "PAYMENT_PROCESSED", 
    string Message = "Payment processed.")
{
    public static ProcessPaymentResult Ok(string code = "PAYMENT_PROCESSED", string message = "Payment processed.") =>
        new(true, false, code, message);

    public static ProcessPaymentResult Transient(string code, string message) =>
        new(false, true, code, message);

    public static ProcessPaymentResult Permanent(string code, string message) =>
        new(false, false, code, message);
}

public record ProcessPaymentCommand(PayOSWebhookData PaymentData) : IRequest<ProcessPaymentResult>;
