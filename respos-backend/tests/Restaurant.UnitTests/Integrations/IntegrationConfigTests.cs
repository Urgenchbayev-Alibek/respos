using Restaurant.Application.Abstractions.Integrations;
using Restaurant.Application.Features.Integrations.Common;
using Restaurant.Application.Features.Integrations.Outbound;
using Restaurant.Application.Features.Integrations.Settings;
using Restaurant.Domain.Entities.Integrations;
using Restaurant.Domain.Enums;

namespace Restaurant.UnitTests.Integrations;

public sealed class IntegrationConfigTests
{
    private const string Token = "123456789:AAFakeTokenForUnitTests_abcdefWXYZ";

    [Fact]
    public void Mask_shows_only_last_four_characters_of_long_secrets()
    {
        SecretMask.Mask(Token).Should().Be("****WXYZ");
        SecretMask.Mask("short").Should().Be("****");
        SecretMask.Mask(null).Should().BeNull();
        SecretMask.Mask(string.Empty).Should().BeNull();
    }

    [Fact]
    public void Masked_config_never_contains_the_secret()
    {
        var config = new TelegramConfig { BotToken = Token, ChatIds = ["-1001"] };
        var json = IntegrationConfigCodec.Serialize(config.Masked());
        json.Should().NotContain(Token).And.Contain("****WXYZ").And.Contain("-1001");

        var smtp = new SmtpConfig { Host = "smtp.mail.uz", FromEmail = "a@b.uz", Password = "SuperSecretPassword" };
        IntegrationConfigCodec.Serialize(smtp.Masked()).Should().NotContain("SuperSecretPassword");
        var eskiz = new EskizConfig { Email = "e@b.uz", Password = "EskizSecret123" };
        IntegrationConfigCodec.Serialize(eskiz.Masked()).Should().NotContain("EskizSecret123");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("****WXYZ")]
    public void Empty_or_masked_secret_on_update_keeps_the_stored_one(string? incoming)
    {
        var existing = new TelegramConfig { BotToken = Token, ChatIds = ["1"] };
        var merged = (TelegramConfig)new TelegramConfig { BotToken = incoming, ChatIds = [" 1 ", "2", "2"] }.WithSecretsFrom(existing);
        merged.BotToken.Should().Be(Token);
        merged.ChatIds.Should().Equal("1", "2");
    }

    [Fact]
    public void New_secret_on_update_replaces_the_stored_one()
    {
        var existing = new SmtpConfig { Host = "h", FromEmail = "a@b.uz", Password = "old-password" };
        var merged = (SmtpConfig)new SmtpConfig { Host = "h", FromEmail = "a@b.uz", Password = "new-password" }.WithSecretsFrom(existing);
        merged.Password.Should().Be("new-password");
    }

    [Fact]
    public void Enabled_integration_must_be_complete()
    {
        new TelegramConfig().Validate(isEnabled: true).Keys.Should().Contain(["config.botToken", "config.chatIds"]);
        new TelegramConfig().Validate(isEnabled: false).Should().BeEmpty();
        new TelegramConfig { DailySummaryTime = "25:99" }.Validate(false).Keys.Should().Contain("config.dailySummaryTime");
        new EskizConfig().Validate(true).Keys.Should().Contain(["config.email", "config.password"]);
        new SmtpConfig { Port = 0 }.Validate(true).Keys.Should().Contain(["config.host", "config.port", "config.fromEmail"]);
    }

    [Fact]
    public void Changed_fields_lists_names_only()
    {
        var before = new TelegramConfig { BotToken = Token, ChatIds = ["1"] };
        var after = before with { BotToken = Token + "x", BigRefundThreshold = 1m };
        var changed = UpdateIntegrationHandler.ChangedFields(before, after);
        changed.Should().BeEquivalentTo("botToken", "bigRefundThreshold");
        string.Join(",", changed).Should().NotContain(Token);
    }

    [Fact]
    public void Smtp_route_prefers_organization_then_platform_then_log()
    {
        var org = new SmtpConfig { Host = "smtp.org.uz", FromEmail = "a@org.uz" };
        var platform = new SmtpServer("smtp.platform", 587, false, null, null, "noreply@respos.uz", null);
        EmailRouting.Choose(org, platform).Should().Be(EmailRoute.Organization);
        EmailRouting.Choose(org, null).Should().Be(EmailRoute.Organization);
        EmailRouting.Choose(null, platform).Should().Be(EmailRoute.Platform);
        EmailRouting.Choose(new SmtpConfig { Host = "" }, platform).Should().Be(EmailRoute.Platform);
        EmailRouting.Choose(null, null).Should().Be(EmailRoute.Log);
    }

    [Theory]
    [InlineData("90 123 45 67", "+998901234567")]
    [InlineData("998901234567", "+998901234567")]
    [InlineData("+998 (90) 123-45-67", "+998901234567")]
    [InlineData("+7 916 123 45 67", "+79161234567")]
    [InlineData("12345", null)]
    [InlineData("call me", null)]
    public void Phone_numbers_are_normalized_to_e164(string raw, string? expected) =>
        PhoneNumbers.Normalize(raw).Should().Be(expected);

    [Fact]
    public void Recipient_masking_hides_the_middle()
    {
        SecretMask.Recipient("+998901234567").Should().Be("+99***67");
        SecretMask.Recipient("owner@mail.uz").Should().Be("o***@mail.uz");
        SecretMask.Recipient("123").Should().Be("***");
    }

    [Fact]
    public void Failed_attempts_back_off_then_give_up()
    {
        var now = new DateTime(2026, 11, 10, 8, 0, 0, DateTimeKind.Utc);
        var message = new OutboundMessage { MaxAttempts = 3, NextAttemptAt = now };
        message.MarkFailedAttempt("429", retryable: true, now);
        message.Status.Should().Be(OutboundStatus.Pending);
        message.NextAttemptAt.Should().Be(now.AddSeconds(30));
        message.MarkFailedAttempt("429", retryable: true, now, TimeSpan.FromMinutes(5));
        message.NextAttemptAt.Should().Be(now.AddMinutes(5));
        message.MarkFailedAttempt("429", retryable: true, now);
        message.Status.Should().Be(OutboundStatus.Failed);

        var fatal = new OutboundMessage();
        fatal.MarkFailedAttempt("401", retryable: false, now);
        fatal.Status.Should().Be(OutboundStatus.Failed);
    }

    [Fact]
    public void Status_is_error_when_the_last_error_is_newer_than_the_last_success()
    {
        var now = DateTime.UtcNow;
        var setting = new IntegrationSetting { IsEnabled = true };
        setting.Status(isConfigured: true).Should().Be(IntegrationStatus.Connected);
        setting.MarkError("boom", now);
        setting.Status(true).Should().Be(IntegrationStatus.Error);
        setting.MarkSuccess(now.AddSeconds(1));
        setting.Status(true).Should().Be(IntegrationStatus.Connected);
        setting.Status(false).Should().Be(IntegrationStatus.NotConfigured);
    }
}
