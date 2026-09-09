using MediatR;
using Microsoft.EntityFrameworkCore;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Users.Commands;

public record UpdateProfileCommand(Guid UserId, string Name, string Phone, string AvatarUrl) : IRequest<bool>;

public class UpdateProfileCommandHandler : IRequestHandler<UpdateProfileCommand, bool>
{
    private readonly IApplicationDbContext _context;

    public UpdateProfileCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(UpdateProfileCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
        if (user == null) return false;

        user.UpdateProfile(request.Name, request.Phone, request.AvatarUrl);
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}
