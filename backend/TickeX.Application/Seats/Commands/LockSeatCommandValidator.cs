using FluentValidation;

namespace TickeX.Application.Seats.Commands;

public class LockSeatCommandValidator : AbstractValidator<LockSeatCommand>
{
    public LockSeatCommandValidator()
    {
        RuleFor(x => x.EventId).NotEmpty();
        RuleFor(x => x.SeatId).NotEmpty();
        RuleFor(x => x.UserId).NotEmpty();
    }
}
