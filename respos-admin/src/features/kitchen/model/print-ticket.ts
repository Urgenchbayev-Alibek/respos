import { printArea } from '@/shared/ui';

export function kitchenTicketPrintId(ticketId: string): string {
  return `kitchen-ticket-${ticketId}`;
}

/** Prints one ticket on an 80 mm thermal printer (print dialog, or the desktop shell's printer; `KitchenTicketPrint` must be mounted). */
export function printKitchenTicket(ticketId: string): void {
  printArea(kitchenTicketPrintId(ticketId));
}
