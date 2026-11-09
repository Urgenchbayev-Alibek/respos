# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Directory.Build.props Directory.Packages.props Restaurant.sln ./
COPY src/Restaurant.Domain/Restaurant.Domain.csproj src/Restaurant.Domain/
COPY src/Restaurant.Application/Restaurant.Application.csproj src/Restaurant.Application/
COPY src/Restaurant.Infrastructure/Restaurant.Infrastructure.csproj src/Restaurant.Infrastructure/
COPY src/Restaurant.Api/Restaurant.Api.csproj src/Restaurant.Api/
RUN dotnet restore src/Restaurant.Api/Restaurant.Api.csproj
COPY src/ src/
RUN dotnet publish src/Restaurant.Api/Restaurant.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true
RUN mkdir -p /app/storage && chown -R app:app /app/storage
COPY --from=build /app/publish .
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Restaurant.Api.dll"]
