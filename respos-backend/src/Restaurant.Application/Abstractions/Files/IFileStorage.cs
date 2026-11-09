namespace Restaurant.Application.Abstractions.Files;

public interface IFileStorage
{
    /// <summary>Stores the file and returns its public URL (relative for local storage).</summary>
    Task<string> SaveAsync(Stream content, string fileName, string contentType, string folder, CancellationToken cancellationToken = default);

    Task DeleteAsync(string url, CancellationToken cancellationToken = default);
}
