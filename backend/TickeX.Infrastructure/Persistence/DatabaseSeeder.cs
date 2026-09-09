using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TickeX.Domain.Entities;
using TickeX.Domain.Enums;

namespace TickeX.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider, ILogger logger)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        try
        {
            // 1. Seed Users if not exist
            if (!await context.Users.AnyAsync())
            {
                logger.LogInformation("Seeding default users...");

                var configuration = scope.ServiceProvider.GetService<Microsoft.Extensions.Configuration.IConfiguration>();
                var defaultPassword = configuration?["Seed:AdminPassword"] 
                    ?? Environment.GetEnvironmentVariable("SEED_ADMIN_PASSWORD") 
                    ?? "Admin@123";

                var hasher = scope.ServiceProvider.GetService<TickeX.Application.Interfaces.IPasswordHasher>();
                var adminPassword = hasher != null ? hasher.Hash(defaultPassword) : BCrypt.Net.BCrypt.HashPassword(defaultPassword);
                var staffPassword = hasher != null ? hasher.Hash(defaultPassword) : BCrypt.Net.BCrypt.HashPassword(defaultPassword);
                var userPassword = hasher != null ? hasher.Hash(defaultPassword) : BCrypt.Net.BCrypt.HashPassword(defaultPassword);

                var admin = new User("System Administrator", "admin@tickex.com", adminPassword, "Admin");
                admin.UpdateProfile("System Administrator", "0901234567", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop");

                var staff = new User("Event Staff Lead", "staff@tickex.com", staffPassword, "Staff");
                staff.UpdateProfile("Event Staff Lead", "0907654321", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop");

                var customer = new User("Nguyen Van An", "user@tickex.com", userPassword, "Customer");
                customer.UpdateProfile("Nguyen Van An", "0988888888", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop");

                context.Users.AddRange(admin, staff, customer);
                await context.SaveChangesAsync();
                logger.LogInformation("Default users seeded successfully (admin@tickex.com, staff@tickex.com, user@tickex.com).");
            }

            // 2. Seed Events & Tiered Seat Matrices if not exist
            if (!await context.Events.AnyAsync())
            {
                logger.LogInformation("Seeding realistic events and seat matrices...");

                var event1 = new Event(
                    title: "Tomorrowland 2026: The Realm of Beats",
                    description: "The world's premier electronic dance music festival featuring world-renowned DJs, laser spectacles, and immersive sound stages.",
                    date: DateTime.UtcNow.AddDays(30).Date.AddHours(18),
                    endDate: DateTime.UtcNow.AddDays(30).Date.AddHours(23).AddMinutes(30),
                    location: "My Dinh National Stadium, Hanoi",
                    venueName: "Center Arena A",
                    totalSeats: 60,
                    category: "Concert",
                    imageUrl: "https://images.unsplash.com/photo-1470229722913-7c092bbfdb14?q=80&w=1200&auto=format&fit=crop",
                    bannerUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1600&auto=format&fit=crop",
                    organizerName: "We Rave You Global & TickeX Live",
                    basePrice: 500000m,
                    refundCutoffHours: 48
                );
                event1.GenerateSeatsMatrix(rowCount: 5, seatsPerRow: 12);

                var event2 = new Event(
                    title: "Global Tech Summit 2026: Generative AI & Web3",
                    description: "Join 3,000+ engineers, founders, and tech visionaries to explore breakthrough LLM architectures, robotics, and next-generation cloud infrastructure.",
                    date: DateTime.UtcNow.AddDays(14).Date.AddHours(9),
                    endDate: DateTime.UtcNow.AddDays(14).Date.AddHours(17),
                    location: "SECC Saigon Exhibition Center, Ho Chi Minh City",
                    venueName: "Grand Ballroom Hall 1",
                    totalSeats: 60,
                    category: "Conference",
                    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop",
                    bannerUrl: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?q=80&w=1600&auto=format&fit=crop",
                    organizerName: "TechVentures Asia & Google Developer Group",
                    basePrice: 1200000m,
                    refundCutoffHours: 72
                );
                event2.GenerateSeatsMatrix(rowCount: 5, seatsPerRow: 12);

                var event3 = new Event(
                    title: "Coldplay: Music of the Spheres Live Tour",
                    description: "Experience the colorful, kinetic, eco-powered live concert experience with iconic anthems like 'Fix You', 'Yellow', and 'Viva La Vida'.",
                    date: DateTime.UtcNow.AddDays(45).Date.AddHours(19).AddMinutes(30),
                    endDate: DateTime.UtcNow.AddDays(45).Date.AddHours(22).AddMinutes(45),
                    location: "National Stadium, Singapore",
                    venueName: "Main Arena East Gate",
                    totalSeats: 60,
                    category: "Concert",
                    imageUrl: "https://images.unsplash.com/photo-1540039155732-68ee23e15b51?q=80&w=1200&auto=format&fit=crop",
                    bannerUrl: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1600&auto=format&fit=crop",
                    organizerName: "Live Nation International",
                    basePrice: 1500000m,
                    refundCutoffHours: 48
                );
                event3.GenerateSeatsMatrix(rowCount: 5, seatsPerRow: 12);

                var event4 = new Event(
                    title: "Saigon Comedy All-Stars: Laugh Out Loud",
                    description: "An evening of non-stop punchlines, witty satire, and stand-up performances featuring Vietnam's most beloved comedians.",
                    date: DateTime.UtcNow.AddDays(7).Date.AddHours(20),
                    endDate: DateTime.UtcNow.AddDays(7).Date.AddHours(22),
                    location: "Hoa Binh Theater, District 10, HCMC",
                    venueName: "Auditorium Main Stage",
                    totalSeats: 60,
                    category: "Entertainment",
                    imageUrl: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?q=80&w=1200&auto=format&fit=crop",
                    bannerUrl: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?q=80&w=1600&auto=format&fit=crop",
                    organizerName: "Saigon Standup Guild",
                    basePrice: 250000m,
                    refundCutoffHours: 24
                );
                event4.GenerateSeatsMatrix(rowCount: 5, seatsPerRow: 12);

                context.Events.AddRange(event1, event2, event3, event4);
                await context.SaveChangesAsync();
                logger.LogInformation("4 realistic events and 240 tiered seats seeded successfully.");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred while seeding the database.");
        }
    }
}
