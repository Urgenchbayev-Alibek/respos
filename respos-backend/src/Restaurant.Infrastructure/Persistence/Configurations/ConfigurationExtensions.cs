using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Restaurant.Domain.Common;
using Restaurant.Domain.Entities.Identity;

namespace Restaurant.Infrastructure.Persistence.Configurations;

/// <summary>Shared mapping helpers: tenant/branch FKs + indexes, quantity precision, common lengths.</summary>
internal static class ConfigurationExtensions
{
    public const int NameLength = 200;
    public const int CodeLength = 64;
    public const int EmailLength = 256;
    public const int PhoneLength = 32;
    public const int CommentLength = 1000;
    public const int ReasonLength = 500;
    public const int UrlLength = 500;

    /// <summary>Index + restrictive FK on OrganizationId (string-based so it works for interface members).</summary>
    public static EntityTypeBuilder<T> HasTenant<T>(this EntityTypeBuilder<T> builder, bool withForeignKey = true)
        where T : class, ITenantScoped
    {
        builder.HasIndex(nameof(ITenantScoped.OrganizationId));
        if (withForeignKey)
        {
            builder.HasOne<Organization>().WithMany()
                .HasForeignKey(nameof(ITenantScoped.OrganizationId))
                .OnDelete(DeleteBehavior.Restrict);
        }

        return builder;
    }

    /// <summary>Tenant mapping + (OrganizationId, BranchId) index + restrictive FK to the branch.</summary>
    public static EntityTypeBuilder<T> HasBranch<T>(this EntityTypeBuilder<T> builder, bool withForeignKey = true)
        where T : class, IBranchScoped
    {
        builder.HasTenant();
        builder.HasIndex(nameof(ITenantScoped.OrganizationId), nameof(IBranchScoped.BranchId));
        if (withForeignKey)
        {
            builder.HasOne<RestaurantBranch>().WithMany()
                .HasForeignKey(nameof(IBranchScoped.BranchId))
                .OnDelete(DeleteBehavior.Restrict);
        }

        return builder;
    }

    public static PropertyBuilder<decimal> IsQuantity(this PropertyBuilder<decimal> property) => property.HasPrecision(18, 3);

    public static PropertyBuilder<decimal?> IsQuantity(this PropertyBuilder<decimal?> property) => property.HasPrecision(18, 3);
}
