using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TickeX.Application.Interfaces;
using TickeX.WebApi.Filters;

namespace TickeX.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("BookingPolicy")]
public class PaymentsController : ControllerBase
{
    private readonly ICustomerCheckoutOperations _checkout;
    public PaymentsController(ICustomerCheckoutOperations checkout) => _checkout = checkout;

    public record CreatePaymentLinkRequest(Guid TicketId, string? ReturnUrl = null, string? CancelUrl = null);

    [Authorize]
    [HttpGet("status/{orderCode:long}")]
    public async Task<IActionResult> GetStatus(long orderCode, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return UnauthorizedEnvelope();
        return Respond(await _checkout.GetStatusAsync(orderCode, userId, cancellationToken), notFound: true);
    }

    [Authorize]
    [Idempotent]
    [HttpPost("create-link")]
    public async Task<IActionResult> CreatePaymentLink([FromBody] CreatePaymentLinkRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return UnauthorizedEnvelope();
        return Respond(await _checkout.CreatePaymentLinkAsync(request.TicketId, userId, cancellationToken));
    }

    [AllowAnonymous]
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook(CancellationToken cancellationToken)
    {
        if (Request.ContentLength is > 65_536)
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new
            {
                success = false,
                code = "PAYMENT_WEBHOOK_TOO_LARGE",
                message = "Dữ liệu thanh toán vượt quá kích thước cho phép.",
                error = new { code = "PAYMENT_WEBHOOK_TOO_LARGE", message = "Dữ liệu thanh toán vượt quá kích thước cho phép.", details = (object?)null }
            });
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(cancellationToken);
        var signature = Request.Headers["x-payos-signature"].FirstOrDefault()
            ?? Request.Headers["X-PayOS-Signature"].FirstOrDefault() ?? string.Empty;
        return Respond(await _checkout.ProcessWebhookAsync(body, signature, cancellationToken));
    }

    [Authorize]
    [HttpPost("simulate-success/{orderCode:long}")]
    public async Task<IActionResult> SimulateSuccess(long orderCode, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return UnauthorizedEnvelope();
        var result = await _checkout.SimulateSuccessAsync(orderCode, userId, cancellationToken);
        return result.Code == "PAYMENT_SIMULATION_DISABLED" 
            ? NotFound(new { success = false, code = "PAYMENT_SIMULATION_DISABLED", message = "Môi trường mô phỏng thanh toán đã bị vô hiệu hóa.", error = new { code = "PAYMENT_SIMULATION_DISABLED", message = "Môi trường mô phỏng thanh toán đã bị vô hiệu hóa." } }) 
            : Respond(result, notFound: true);
    }

    private bool TryGetUserId(out Guid userId) => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    private IActionResult UnauthorizedEnvelope() => Unauthorized(new
    {
        success = false,
        code = "UNAUTHORIZED",
        message = "User is not authenticated.",
        error = new { code = "UNAUTHORIZED", message = "User is not authenticated." }
    });

    private IActionResult Respond(CustomerCheckoutResult result, bool notFound = false)
    {
        if (result.Success)
            return Ok(new { success = true, code = result.Code, message = result.Message, data = new
            {
                orderCode = result.OrderCode, amount = result.Amount, checkoutUrl = result.CheckoutUrl,
                status = result.Status, ticketId = result.TicketId, refundStatus = result.RefundStatus
            }});
        if (notFound && result.Code == "PAYMENT_NOT_FOUND")
            return NotFound(new { success = false, code = result.Code, message = result.Message, error = new { code = result.Code, message = result.Message } });
        if (result.Code == "PAYMENT_FORBIDDEN")
            return StatusCode(StatusCodes.Status403Forbidden, new { success = false, code = result.Code, message = result.Message, error = new { code = result.Code, message = result.Message } });
        if (result.Code == "PAYMENT_PROVIDER_UNAVAILABLE")
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { success = false, code = result.Code, message = result.Message, error = new { code = result.Code, message = result.Message } });
        return BadRequest(new { success = false, code = result.Code, message = result.Message, error = new { code = result.Code, message = result.Message } });
    }
}
