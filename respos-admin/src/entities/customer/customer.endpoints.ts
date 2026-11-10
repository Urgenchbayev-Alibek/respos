/** F1 REST paths (kept next to the entity so the shared endpoints file stays untouched by v2 modules). */
const id = (value: string) => encodeURIComponent(value);

export const CUSTOMER_ENDPOINTS = {
  list: '/customers',
  one: (customerId: string) => `/customers/${id(customerId)}`,
  orders: (customerId: string) => `/customers/${id(customerId)}/orders`,
  ledger: (customerId: string) => `/customers/${id(customerId)}/loyalty/transactions`,
  loyaltySettings: '/loyalty/settings',
  orderCustomer: (orderId: string) => `/orders/${id(orderId)}/customer`,
  orderLoyalty: (orderId: string) => `/orders/${id(orderId)}/loyalty`,
  orderRedeem: (orderId: string) => `/orders/${id(orderId)}/loyalty/redeem`,
} as const;
