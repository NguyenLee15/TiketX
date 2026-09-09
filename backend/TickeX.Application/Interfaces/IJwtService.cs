using TickeX.Domain.Entities;

namespace TickeX.Application.Interfaces;

public interface IJwtService
{
    string GenerateToken(User user);
}
