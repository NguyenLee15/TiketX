using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Users.Queries;

public record UserProfileDto(Guid Id, string Name, string Email, string Phone, string AvatarUrl, string Role);

public record GetUserProfileQuery(Guid UserId) : IRequest<UserProfileDto?>;

public class GetUserProfileQueryHandler : IRequestHandler<GetUserProfileQuery, UserProfileDto?>
{
    private readonly IApplicationDbContext _context;

    public GetUserProfileQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<UserProfileDto?> Handle(GetUserProfileQuery request, CancellationToken cancellationToken)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
        
        if (user == null) return null;

        return new UserProfileDto(user.Id, user.Name, user.Email, user.Phone, user.AvatarUrl, user.Role);
    }
}
