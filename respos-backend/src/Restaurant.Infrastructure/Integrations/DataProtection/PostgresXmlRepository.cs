using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.Extensions.Logging;
using Npgsql;
using Restaurant.Application.Abstractions.Integrations;

namespace Restaurant.Infrastructure.Integrations.DataProtection;

/// <summary>Row of the Data Protection key ring (XML of one key, encrypted at rest only if a key-encryption cert is configured).</summary>
public sealed class DataProtectionKeyRecord
{
    public int Id { get; set; }
    public string? FriendlyName { get; set; }
    public string Xml { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Persists the Data Protection key ring in PostgreSQL (table created by EF migrations) so every API instance and every
/// restart can decrypt integration secrets. A plain Npgsql repository is used instead of
/// <c>PersistKeysToDbContext</c> because <see cref="IXmlRepository"/> is synchronous by design and the application
/// DbContext forbids synchronous saves; the key ring is read rarely (cached ~24h by the framework).
/// </summary>
internal sealed class PostgresXmlRepository(string connectionString) : IXmlRepository
{
    public const string TableName = "data_protection_keys";

    public IReadOnlyCollection<XElement> GetAllElements()
    {
        using var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        using var command = new NpgsqlCommand($"SELECT xml FROM {TableName} ORDER BY id", connection);
        using var reader = command.ExecuteReader();
        var elements = new List<XElement>();
        while (reader.Read())
        {
            elements.Add(XElement.Parse(reader.GetString(0)));
        }

        return elements;
    }

    public void StoreElement(XElement element, string friendlyName)
    {
        using var connection = new NpgsqlConnection(connectionString);
        connection.Open();
        using var command = new NpgsqlCommand($"INSERT INTO {TableName} (friendly_name, xml) VALUES (@name, @xml)", connection);
        command.Parameters.AddWithValue("name", friendlyName);
        command.Parameters.AddWithValue("xml", element.ToString(SaveOptions.DisableFormatting));
        command.ExecuteNonQuery();
    }
}

/// <summary><see cref="ISecretProtector"/> over ASP.NET Core Data Protection (purpose <c>RestaurantOS.Integrations.v1</c>).</summary>
internal sealed class DataProtectionSecretProtector(IDataProtectionProvider provider, ILogger<DataProtectionSecretProtector> logger)
    : ISecretProtector
{
    public const string Purpose = "RestaurantOS.Integrations.v1";

    private readonly IDataProtector _protector = provider.CreateProtector(Purpose);

    public string Protect(string plaintext) => _protector.Protect(plaintext);

    public string? Unprotect(string protectedText)
    {
        try
        {
            return _protector.Unprotect(protectedText);
        }
        catch (System.Security.Cryptography.CryptographicException ex)
        {
            logger.LogWarning("Integration secret cannot be decrypted (key ring changed?): {Reason}", ex.Message);
            return null;
        }
    }
}
