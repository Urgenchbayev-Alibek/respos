namespace Restaurant.Application.Common.Handlers;

/// <summary>
/// Marks a concrete helper class (e.g. a shared feature service used by several handlers) for automatic
/// scoped DI registration as itself. Avoids editing a central registration list.
/// </summary>
[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class ScopedServiceAttribute : Attribute;
