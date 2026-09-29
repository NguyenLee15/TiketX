using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application.Seats.Commands;

public record LockSeatCommand(Guid EventId, Guid SeatId, Guid UserId, byte[] Version) : IRequest<ReservationResult>;
