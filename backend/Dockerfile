# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
USER app
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["TickeX.WebApi/TickeX.WebApi.csproj", "TickeX.WebApi/"]
COPY ["TickeX.Application/TickeX.Application.csproj", "TickeX.Application/"]
COPY ["TickeX.Domain/TickeX.Domain.csproj", "TickeX.Domain/"]
COPY ["TickeX.Infrastructure/TickeX.Infrastructure.csproj", "TickeX.Infrastructure/"]
RUN dotnet restore "./TickeX.WebApi/TickeX.WebApi.csproj"
COPY . .
WORKDIR "/src/TickeX.WebApi"
RUN dotnet build "./TickeX.WebApi.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./TickeX.WebApi.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=publish /app/publish .
USER app
ENTRYPOINT ["dotnet", "TickeX.WebApi.dll"]
