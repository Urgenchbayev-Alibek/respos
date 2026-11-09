using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Restaurant.Domain.Common;
using Restaurant.Infrastructure.Persistence.Conventions;

namespace Restaurant.Infrastructure.Persistence.Context;

public sealed partial class AppDbContext
{
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Money default: numeric(18,2). Quantities override to (18,3) in their configurations.
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
        configurationBuilder.Properties<decimal?>().HavePrecision(18, 2);

        // All domain enums stored as snake_case strings (same values as the JSON contract).
        foreach (var enumType in typeof(Entity).Assembly.GetTypes().Where(t => t.IsEnum))
        {
            var converter = typeof(SnakeCaseEnumConverter<>).MakeGenericType(enumType);
            configurationBuilder.Properties(enumType).HaveConversion(converter).HaveMaxLength(32);
            configurationBuilder.Properties(typeof(Nullable<>).MakeGenericType(enumType)).HaveConversion(converter).HaveMaxLength(32);
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        ApplyTenantFilters(modelBuilder);
        base.OnModelCreating(modelBuilder);
    }

    /// <summary>Every ITenantScoped entity: <c>e.OrganizationId == CurrentOrganizationId</c> (null tenant → no rows).</summary>
    private void ApplyTenantFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes()
                     .Where(t => t.BaseType is null && typeof(ITenantScoped).IsAssignableFrom(t.ClrType)))
        {
            var parameter = Expression.Parameter(entityType.ClrType, "e");
            var organizationId = Expression.Convert(
                Expression.Property(parameter, nameof(ITenantScoped.OrganizationId)), typeof(Guid?));
            var current = Expression.Property(Expression.Constant(this), nameof(CurrentOrganizationId));
            var filter = Expression.Lambda(Expression.Equal(organizationId, current), parameter);
            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(filter);
        }
    }
}
