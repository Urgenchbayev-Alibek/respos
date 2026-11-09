# Realtime (SignalR)

Hub: `/hubs/restaurant` (access token via `?access_token=` query for WebSockets, standard SignalR JWT pattern).

SignalR only **notifies**. Payloads are small; clients refetch from REST after an event and ALWAYS
after (re)connect. The DB is the source of truth.

## Client → server

| Method | Args | Effect |
|---|---|---|
| `JoinBranch` | `branchId` | Server validates branch access, adds connection to group `branch:{branchId}` |
| `JoinKitchenStation` | `branchId, stationId \| null` | Group `branch:{branchId}:kitchen` (null = all stations) or `branch:{branchId}:station:{stationId}`; requires `kitchen.read` |
| `LeaveKitchenStation` | `branchId, stationId \| null` | |

## Server → client events (all include `branchId` and `occurredAt`)

| Event | Group | Payload |
|---|---|---|
| `KitchenTicketCreated` | kitchen + station | `{ ticketId, orderId, stationId, tableLabel, createdAt }` |
| `KitchenTicketUpdated` | kitchen + station | `{ ticketId, orderId, stationId, status }` |
| `OrderUpdated` | branch | `{ orderId, status, tableId }` |
| `OrderItemReady` | branch | `{ orderId, orderItemId, tableId, itemName }` (waiter toast) |
| `TableUpdated` | branch | `{ tableId, status }` |
| `PaymentRegistered` | branch | `{ orderId, paymentId, amount }` |
| `NotificationCreated` | branch (+ `user:{userId}`) | `{ notificationId, type, title }` |
| `StockLow` | branch | `{ ingredientId, name, quantity, minQuantity }` |

Backend: `IRealtimeNotifier` interface in Application (`Abstractions/Realtime`), implemented in
Infrastructure `Realtime/SignalRRealtimeNotifier.cs`. Events are published **after** the DB transaction commits.

Frontend: one `HubConnection` in `src/shared/realtime/` with automatic reconnect; on `onreconnected`
invalidate all TanStack Query keys of the current workspace.
