using Restaurant.Domain.Common;
using Restaurant.Domain.Constants;

namespace Restaurant.Domain.Entities.Identity;

public class Role : AuditableEntity, ITenantScoped
{
    public Guid OrganizationId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsSystem { get; set; }

    public ICollection<RolePermission> Permissions { get; set; } = [];
    public ICollection<UserRole> UserRoles { get; set; } = [];

    public bool GrantsAllBranches => SystemRoles.IsAllBranchRole(Code);

    public static Role CreateSystem(Guid organizationId, SystemRoleDefinition definition)
    {
        var role = new Role
        {
            OrganizationId = organizationId,
            Code = definition.Code,
            Name = definition.Name,
            IsSystem = true,
        };
        role.SetPermissions(definition.Permissions);
        return role;
    }

    /// <summary>Replaces the permission set; codes must be assignable org permissions (validated by callers).</summary>
    public void SetPermissions(IEnumerable<string> codes)
    {
        var wanted = codes.ToHashSet(StringComparer.Ordinal);
        foreach (var existing in Permissions.Where(p => !wanted.Contains(p.PermissionCode)).ToList())
        {
            Permissions.Remove(existing);
        }

        foreach (var code in wanted.Where(c => Permissions.All(p => p.PermissionCode != c)))
        {
            Permissions.Add(new RolePermission { RoleId = Id, PermissionCode = code });
        }
    }
}

/// <summary>Global permission dictionary, synced from PermissionCatalog. Key = Code.</summary>
public class Permission
{
    public string Code { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

/// <summary>Role-permission link (composite key RoleId + PermissionCode).</summary>
public class RolePermission
{
    public Guid RoleId { get; set; }
    public string PermissionCode { get; set; } = string.Empty;

    public Role? Role { get; set; }
    public Permission? Permission { get; set; }
}

/// <summary>User-role link in an organization (composite key UserId + RoleId).</summary>
public class UserRole : ITenantScoped
{
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
    public Guid OrganizationId { get; set; }

    public User? User { get; set; }
    public Role? Role { get; set; }
}

/// <summary>Explicit branch access (owner/admin roles see all branches implicitly). Key UserId + BranchId.</summary>
public class UserBranchAccess : ITenantScoped
{
    public Guid UserId { get; set; }
    public Guid BranchId { get; set; }
    public Guid OrganizationId { get; set; }

    public User? User { get; set; }
    public RestaurantBranch? Branch { get; set; }
}
