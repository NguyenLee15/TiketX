using FluentValidation;

namespace TickeX.Application.Admin.Queries;

public sealed class GetUsersQueryValidator : AbstractValidator<GetUsersQuery>
{
    public GetUsersQueryValidator()
    {
        RuleFor(x => x.Page).InclusiveBetween(1, 10000);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
        RuleFor(x => x.Search).MaximumLength(100).When(x => x.Search is not null);
    }
}
