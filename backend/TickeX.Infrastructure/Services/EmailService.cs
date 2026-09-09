using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using TickeX.Application.Interfaces;

namespace TickeX.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;

    public EmailService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task SendEmailAsync(string to, string subject, string body)
    {
        var smtpServer = _configuration["Smtp:Server"];
        var smtpPort = int.Parse(_configuration["Smtp:Port"] ?? "587");
        var smtpUser = _configuration["Smtp:Username"];
        var smtpPass = _configuration["Smtp:Password"];
        var fromEmail = _configuration["Smtp:FromEmail"] ?? "noreply@tickex.com";

        if (string.IsNullOrEmpty(smtpServer) || string.IsNullOrEmpty(smtpUser))
        {
            // For development purposes, if SMTP is not configured, just log to console
            Console.WriteLine($"[EMAIL STUB] To: {to}, Subject: {subject}");
            return;
        }

        using var client = new SmtpClient(smtpServer, smtpPort)
        {
            Credentials = new NetworkCredential(smtpUser, smtpPass),
            EnableSsl = true
        };

        var mailMessage = new MailMessage
        {
            From = new MailAddress(fromEmail),
            Subject = subject,
            Body = body,
            IsBodyHtml = true
        };

        mailMessage.To.Add(to);

        await client.SendMailAsync(mailMessage);
    }
}
