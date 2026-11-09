using Restaurant.Domain.Entities.Kitchen;
using Restaurant.Domain.Enums;
using Restaurant.Domain.Exceptions;

namespace Restaurant.UnitTests.Kitchen;

public sealed class KitchenTicketTests
{
    private static readonly DateTime Now = new(2026, 11, 10, 8, 0, 0, DateTimeKind.Utc);

    private static KitchenTicket NewTicket(int items = 2) =>
        KitchenTicket.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 1,
            Enumerable.Range(0, items).Select(_ => Guid.NewGuid()).ToList());

    [Fact]
    public void Ticket_goes_new_in_progress_ready_served()
    {
        var ticket = NewTicket();

        ticket.Start(Now).Should().HaveCount(2);
        ticket.Status.Should().Be(KitchenTicketStatus.InProgress);
        ticket.StartedAt.Should().Be(Now);
        ticket.Items.Should().OnlyContain(i => i.Status == KitchenTicketItemStatus.Preparing);

        ticket.MarkReady(Now).Should().HaveCount(2);
        ticket.Status.Should().Be(KitchenTicketStatus.Ready);
        ticket.ReadyAt.Should().Be(Now);

        ticket.MarkServed();
        ticket.Status.Should().Be(KitchenTicketStatus.Served);
        ticket.IsOpen.Should().BeFalse();
    }

    [Fact]
    public void Per_item_progress_drives_the_ticket_status()
    {
        var ticket = NewTicket();
        var (a, b) = (ticket.Items.First().Id, ticket.Items.Last().Id);

        ticket.StartItem(a, Now);
        ticket.Status.Should().Be(KitchenTicketStatus.InProgress);
        ticket.MarkItemReady(a, Now);
        ticket.Status.Should().Be(KitchenTicketStatus.InProgress);
        ticket.MarkItemReady(b, Now);
        ticket.Status.Should().Be(KitchenTicketStatus.Ready);
    }

    [Fact]
    public void Recall_moves_ready_ticket_back_to_in_progress()
    {
        var ticket = NewTicket();
        ticket.MarkReady(Now);

        ticket.Recall().Should().HaveCount(2);

        ticket.Status.Should().Be(KitchenTicketStatus.InProgress);
        ticket.ReadyAt.Should().BeNull();
        ticket.Items.Should().OnlyContain(i => i.Status == KitchenTicketItemStatus.Preparing);
    }

    [Fact]
    public void Invalid_transitions_are_rejected()
    {
        var ticket = NewTicket();

        ticket.Invoking(t => t.MarkServed()).Should().Throw<DomainException>()
            .Which.Error.Code.Should().Be("kitchen_ticket.invalid_status_transition");
        ticket.Invoking(t => t.Recall()).Should().Throw<DomainException>();
        ticket.Start(Now);
        ticket.Invoking(t => t.Start(Now)).Should().Throw<DomainException>();
    }

    [Fact]
    public void Cancelling_all_order_items_cancels_the_ticket_and_partial_cancel_can_complete_it()
    {
        var ticket = NewTicket();
        var items = ticket.Items.ToList();
        ticket.MarkItemReady(items[0].Id, Now);

        ticket.CancelOrderItem(items[1].OrderItemId, Now).Should().BeTrue();
        ticket.Status.Should().Be(KitchenTicketStatus.Ready);

        var other = NewTicket(1);
        other.CancelOrderItem(other.Items.Single().OrderItemId, Now);
        other.Status.Should().Be(KitchenTicketStatus.Cancelled);
    }
}
