using System.Reflection;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Restaurant.Application.Abstractions.Events;
using Restaurant.Application.Abstractions.Security;
using Restaurant.Application.Common.Handlers;
using Restaurant.Application.Common.Security;

namespace Restaurant.Application;

public static class DependencyInjection
{
    /// <summary>
    /// Registers application services. Handlers (IHandler&lt;,&gt;), validators and domain event handlers
    /// are discovered by assembly scanning — adding a feature never requires editing this file.
    /// </summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = typeof(DependencyInjection).Assembly;

        services.AddValidatorsFromAssembly(assembly, ServiceLifetime.Scoped, includeInternalTypes: true);
        services.AddHandlersFromAssembly(assembly);
        services.AddDomainEventHandlersFromAssembly(assembly);
        services.AddFeatureServicesFromAssembly(assembly);

        services.AddScoped<IPermissionService, PermissionService>();
        services.AddScoped<IBranchAccessService, BranchAccessService>();
        return services;
    }

    public static IServiceCollection AddHandlersFromAssembly(this IServiceCollection services, Assembly assembly)
    {
        foreach (var type in ConcreteTypes(assembly))
        {
            var handlerInterfaces = type.GetInterfaces()
                .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IHandler<,>))
                .ToList();
            if (handlerInterfaces.Count == 0)
            {
                continue;
            }

            services.AddScoped(type);
            foreach (var handlerInterface in handlerInterfaces)
            {
                services.AddScoped(handlerInterface, sp => sp.GetRequiredService(type));
            }
        }

        return services;
    }

    public static IServiceCollection AddDomainEventHandlersFromAssembly(this IServiceCollection services, Assembly assembly)
    {
        foreach (var type in ConcreteTypes(assembly))
        {
            foreach (var handlerInterface in type.GetInterfaces()
                         .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IDomainEventHandler<>)))
            {
                services.AddScoped(handlerInterface, type);
            }
        }

        return services;
    }

    /// <summary>Registers classes marked with <see cref="ScopedServiceAttribute"/> (shared feature helpers).</summary>
    public static IServiceCollection AddFeatureServicesFromAssembly(this IServiceCollection services, Assembly assembly)
    {
        foreach (var type in ConcreteTypes(assembly).Where(t => t.GetCustomAttribute<ScopedServiceAttribute>() is not null))
        {
            services.AddScoped(type);
        }

        return services;
    }

    private static IEnumerable<Type> ConcreteTypes(Assembly assembly) =>
        assembly.GetTypes().Where(t => t is { IsClass: true, IsAbstract: false, IsGenericTypeDefinition: false });
}
