using Microsoft.Extensions.DependencyInjection;
using FluentValidation;
using MediatR;
using TickeX.Application.Interfaces;

namespace TickeX.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg => {
            cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(Common.Behaviors.LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(Common.Behaviors.PerformanceBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(Common.Behaviors.ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);
        services.AddScoped<IAdminUserOperations, Admin.AdminUserOperations>();
        services.AddScoped<IAdminEventOperations, Events.AdminEventOperations>();
        services.AddScoped<ICheckInOperations, Tickets.CheckInOperations>();

        return services;
    }
}
