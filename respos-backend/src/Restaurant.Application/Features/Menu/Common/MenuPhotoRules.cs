namespace Restaurant.Application.Features.Menu.Common;

/// <summary>Menu photo upload rules: ≤ 2 MB; JPG / PNG / WEBP checked by declared type, extension AND file signature.</summary>
public static class MenuPhotoRules
{
    public const long MaxBytes = 2 * 1024 * 1024;

    public readonly record struct PhotoFormat(string ContentType, string Extension);

    private static readonly PhotoFormat Jpeg = new("image/jpeg", ".jpg");
    private static readonly PhotoFormat Png = new("image/png", ".png");
    private static readonly PhotoFormat Webp = new("image/webp", ".webp");

    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    /// <summary>Returns the detected format when content, declared content type and extension agree; otherwise null.</summary>
    public static PhotoFormat? Detect(ReadOnlySpan<byte> content, string? contentType, string? fileName)
    {
        var sniffed = Sniff(content);
        if (sniffed is not { } format)
        {
            return null;
        }

        var declared = (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();
        var declaredOk = declared == format.ContentType || (format == Jpeg && declared == "image/jpg");
        var extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        var extensionOk = extension == format.Extension || (format == Jpeg && extension == ".jpeg");
        return declaredOk && extensionOk ? format : null;
    }

    private static PhotoFormat? Sniff(ReadOnlySpan<byte> content)
    {
        if (content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF)
        {
            return Jpeg;
        }

        if (content.StartsWith(PngSignature))
        {
            return Png;
        }

        if (content.Length >= 12 && content[..4].SequenceEqual("RIFF"u8) && content.Slice(8, 4).SequenceEqual("WEBP"u8))
        {
            return Webp;
        }

        return null;
    }
}
