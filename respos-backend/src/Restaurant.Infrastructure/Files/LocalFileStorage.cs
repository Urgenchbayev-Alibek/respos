using Microsoft.Extensions.Options;
using Restaurant.Application.Abstractions.Files;

namespace Restaurant.Infrastructure.Files;

public sealed class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    public string Provider { get; set; } = "Local";

    /// <summary>Physical root folder (relative to the content root unless absolute).</summary>
    public string LocalRoot { get; set; } = "storage";

    /// <summary>Public URL prefix the API serves files from.</summary>
    public string PublicBasePath { get; set; } = "/files";
}

/// <summary>Stores files on local disk under random names; served as static files by the API.</summary>
internal sealed class LocalFileStorage(IOptions<FileStorageOptions> options) : IFileStorage
{
    public async Task<string> SaveAsync(Stream content, string fileName, string contentType, string folder, CancellationToken cancellationToken = default)
    {
        var safeFolder = Sanitize(folder);
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var storedName = $"{Guid.NewGuid():N}{extension}";
        var directory = Path.Combine(RootPath(), safeFolder);
        Directory.CreateDirectory(directory);

        await using (var target = File.Create(Path.Combine(directory, storedName)))
        {
            await content.CopyToAsync(target, cancellationToken);
        }

        return $"{options.Value.PublicBasePath.TrimEnd('/')}/{safeFolder}/{storedName}";
    }

    public Task DeleteAsync(string url, CancellationToken cancellationToken = default)
    {
        var prefix = options.Value.PublicBasePath.TrimEnd('/') + "/";
        if (!url.StartsWith(prefix, StringComparison.Ordinal))
        {
            return Task.CompletedTask;
        }

        var root = RootPath();
        var path = Path.GetFullPath(Path.Combine(root, url[prefix.Length..]));
        if (path.StartsWith(root, StringComparison.Ordinal) && File.Exists(path))
        {
            File.Delete(path);
        }

        return Task.CompletedTask;
    }

    public string RootPath() => Path.GetFullPath(options.Value.LocalRoot);

    private static string Sanitize(string folder) =>
        new(folder.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
}
