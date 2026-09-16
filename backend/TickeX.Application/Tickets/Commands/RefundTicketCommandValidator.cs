using FluentValidation;

namespace TickeX.Application.Tickets.Commands;

public class RefundTicketCommandValidator : AbstractValidator<RefundTicketCommand>
{
    public RefundTicketCommandValidator()
    {
        RuleFor(x => x.TicketId).NotEmpty().WithMessage("TicketId is required.");
        RuleFor(x => x.UserId).NotEmpty().WithMessage("UserId is required.");
        RuleFor(x => x.Reason).MaximumLength(500).WithMessage("Lý do hoàn vé không được vượt quá 500 ký tự.");
    }
}
