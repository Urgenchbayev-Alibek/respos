using Restaurant.Domain.Entities.Inventory;
using Restaurant.Domain.Entities.Procurement;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Events;
using Restaurant.Domain.Exceptions;

namespace Restaurant.UnitTests.Procurement;

public sealed class PurchaseOrderAndCountTests
{
    private static PurchaseOrder NewOrder(out PurchaseOrderItem item)
    {
        var po = new PurchaseOrder { BranchId = Guid.NewGuid() };
        item = new PurchaseOrderItem { IngredientId = Guid.NewGuid(), Quantity = 10m, UnitPrice = 1500.55m };
        po.ReplaceItems([item]);
        return po;
    }

    [Fact]
    public void Only_draft_is_editable_and_transitions_are_enforced()
    {
        var po = NewOrder(out _);
        po.Total.Should().Be(15005.5m);
        po.Submit();
        po.Status.Should().Be(PurchaseOrderStatus.Submitted);

        var edit = () => po.ReplaceItems([]);
        edit.Should().Throw<DomainException>().Which.Error.Code.Should().Be("purchase.not_editable");
        var submitAgain = po.Submit;
        submitAgain.Should().Throw<DomainException>().Which.Error.Code.Should().Be("purchase.invalid_status_transition");

        po.Cancel();
        po.Status.Should().Be(PurchaseOrderStatus.Cancelled);
        po.Invoking(p => p.EnsureReceivable()).Should().Throw<DomainException>();
    }

    [Fact]
    public void Receiving_moves_to_partially_received_then_received_and_never_exceeds_remaining()
    {
        var po = NewOrder(out var item);
        po.Submit();

        po.ReceiveLine(item.Id, 4m);
        po.CompleteReceipt();
        po.Status.Should().Be(PurchaseOrderStatus.PartiallyReceived);
        po.DomainEvents.Should().ContainSingle(e => e is PurchaseReceivedDomainEvent);

        po.Invoking(p => p.ReceiveLine(item.Id, 7m)).Should().Throw<DomainException>()
            .Which.Error.Code.Should().Be("purchase.receive_exceeds_remaining");
        po.ReceiveLine(item.Id, 6m);
        po.CompleteReceipt();
        po.Status.Should().Be(PurchaseOrderStatus.Received);
        po.Invoking(p => p.ReceiveLine(item.Id, 1m)).Should().Throw<DomainException>();
    }

    [Fact]
    public void Completed_inventory_count_is_immutable_and_reports_differences()
    {
        var count = new InventoryCount();
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        count.AddLine(a, 10m);
        count.AddLine(b, 3m);
        count.SetCounted(a, 7.5m);
        count.SetCounted(b, 3m);

        count.Differences().Should().Equal((a, -2.5m));
        count.Complete(DateTime.UtcNow);
        count.Invoking(c => c.SetCounted(a, 1m)).Should().Throw<DomainException>().Which.Error.Code.Should().Be("inventory_count.completed");
    }
}
