namespace TickeX.Application.Interfaces;

public sealed record CustomerCheckoutResult(
    bool Success,
    string Code,
    string Message,
    long? OrderCode = null,
    decimal? Amount = null,
    string? CheckoutUrl = null,
    string? Status = null,
    Guid? TicketId = null);

/// <summary>Customer checkout boundary. HTTP controllers only map request and response data.</summary>
public interface ICustomerCheckoutOperations
{
    Task<CustomerCheckoutResult> CreatePaymentLinkAsync(Guid ticketId, Guid userId, CancellationToken cancellationToken);
    Task<CustomerCheckoutResult> GetStatusAsync(long orderCode, Guid userId, CancellationToken cancellationToken);
    Task<CustomerCheckoutResult> ProcessWebhookAsync(string payload, string signature, CancellationToken cancellationToken);
    Task<CustomerCheckoutResult> SimulateSuccessAsync(long orderCode, Guid userId, CancellationToken cancellationToken);
}
