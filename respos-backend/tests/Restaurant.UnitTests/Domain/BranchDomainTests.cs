using Restaurant.Application.Features.Procurement.Suggestions;
using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Menu;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.UnitTests.Domain;

public sealed class BranchDomainTests
{
    [Fact]
    public void Branch_override_applies_price_variant_station_and_availability()
    {
        var item = new MenuItem { Name = "Плов", Price = 45000m, KitchenStationId = Guid.NewGuid(), IsAvailable = false };
        var half = new MenuItemVariant { MenuItemId = item.Id, Price = 25000m };
        var full = new MenuItemVariant { MenuItemId = item.Id, Price = 45000m };
        item.Variants.Add(half);
        item.Variants.Add(full);
        var station = Guid.NewGuid();
        var row = new BranchMenuItem { MenuItemId = item.Id, PriceOverride = 50000m, IsAvailable = true, KitchenStationId = station };
        row.VariantPrices.Add(new BranchMenuItemVariantPrice { VariantId = half.Id, Price = 27000m });

        row.ApplyTo(item);

        item.Price.Should().Be(50000m);
        item.IsAvailable.Should().BeTrue();
        item.KitchenStationId.Should().Be(station);
        half.Price.Should().Be(27000m);
        full.Price.Should().Be(45000m);
        new BranchMenuItem { MenuItemId = item.Id }.IsEmpty.Should().BeTrue();
    }

    [Fact]
    public void Archived_item_stays_unavailable_with_branch_override()
    {
        var item = new MenuItem { Price = 1m };
        item.Archive(DateTime.UtcNow);
        new BranchMenuItem { MenuItemId = item.Id, IsAvailable = true }.ApplyTo(item);
        item.IsAvailable.Should().BeFalse();
    }

    [Fact]
    public void Transfer_status_flow_and_invalid_transitions()
    {
        var transfer = new StockTransfer();
        var send = () => transfer.MarkSent(Guid.NewGuid(), DateTime.UtcNow);
        send.Should().Throw<DomainException>().Which.Error.Code.Should().Be("stock_transfer.empty");

        transfer = new StockTransfer();
        transfer.ReplaceLines([new StockTransferLine { Quantity = 1m }]);
        var receiveDraft = () => transfer.MarkReceived(Guid.NewGuid(), DateTime.UtcNow);
        receiveDraft.Should().Throw<DomainException>().Which.Error.Code.Should().Be("stock_transfer.invalid_status_transition");

        transfer.MarkSent(Guid.NewGuid(), DateTime.UtcNow);
        var edit = () => transfer.ReplaceLines([]);
        edit.Should().Throw<DomainException>().Which.Error.Code.Should().Be("stock_transfer.not_editable");
        transfer.Cancel(Guid.NewGuid(), DateTime.UtcNow).Should().Be(StockTransferStatus.Sent);
        var cancelAgain = () => transfer.Cancel(Guid.NewGuid(), DateTime.UtcNow);
        cancelAgain.Should().Throw<DomainException>();
    }

    [Theory]
    [InlineData("1.0001", "1.001")]
    [InlineData("2", "2")]
    [InlineData("0.0005", "0.001")]
    public void Suggested_quantity_is_rounded_up_to_three_decimals(string input, string expected) =>
        GetPurchaseSuggestionsHandler.CeilQuantity(decimal.Parse(input, System.Globalization.CultureInfo.InvariantCulture))
            .Should().Be(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture));
}
