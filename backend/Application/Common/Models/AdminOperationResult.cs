namespace TickeX.Application.Common.Models;

public record AdminOperationResult(
    bool Success, 
    string Message, 
    string? ErrorCode = null, 
    int StatusCode = 200
)
{
    public static AdminOperationResult Ok(string message = "Thao tác thành công.") => 
        new(true, message, null, 200);

    public static AdminOperationResult BadRequest(string message, string? errorCode = "BAD_REQUEST") => 
        new(false, message, errorCode, 400);

    public static AdminOperationResult NotFound(string message = "Không tìm thấy dữ liệu yêu cầu.", string? errorCode = "NOT_FOUND") => 
        new(false, message, errorCode, 404);

    public static AdminOperationResult Conflict(string message, string? errorCode = "CONFLICT") => 
        new(false, message, errorCode, 409);

    public static AdminOperationResult Forbidden(string message, string? errorCode = "FORBIDDEN") => 
        new(false, message, errorCode, 403);
}

