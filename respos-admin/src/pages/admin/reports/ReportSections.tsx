import { useTranslation } from 'react-i18next';
import {
  useCashShiftsReport,
  useLowStockReport,
  useMovementTotalsReport,
  usePaymentMethodsReport,
  useSalesByCategoryReport,
  useStockReport,
  useTopItemsReport,
} from '@/entities/report/report.queries';
import type {
  CashShiftReportRowDto,
  MovementTotalDto,
  PaymentMethodTotalDto,
  ReportPeriod,
  SalesByCategoryDto,
  StockBalanceRowDto,
  TopItemDto,
} from '@/entities/report/report.types';
import styles from '@/features/reports/ui/reports.module.css';
import { useFormatters } from '@/shared/hooks/use-formatters';
import { StatusBadge, type DataTableColumn } from '@/shared/ui';
import { TableReport } from './TableReport';

type Props = { period: ReportPeriod };
const num = (value: string) => <span className={styles.num}>{value}</span>;

export function TopItemsReport({ period }: Props) {
  const { t } = useTranslation('reports');
  const format = useFormatters();
  const query = useTopItemsReport(period);
  const columns: DataTableColumn<TopItemDto>[] = [
    { key: 'rank', header: '#', width: '48px', cell: (row) => (query.data?.indexOf(row) ?? 0) + 1 },
    { key: 'name', header: t('columns.item'), cell: (row) => row.name },
    { key: 'qty', header: t('columns.quantity'), align: 'right', cell: (row) => num(format.number(row.quantity)) },
    { key: 'revenue', header: t('sales.revenue'), align: 'right', cell: (row) => num(format.money(row.revenue)) },
  ];
  return <TableReport title={t('tabs.items')} exportName="top-items" period={period} query={query} columns={columns} getRowId={(row) => row.menuItemId} />;
}

export function CategoriesReport({ period }: Props) {
  const { t } = useTranslation('reports');
  const format = useFormatters();
  const query = useSalesByCategoryReport(period);
  const columns: DataTableColumn<SalesByCategoryDto>[] = [
    { key: 'name', header: t('columns.category'), cell: (row) => row.name },
    { key: 'qty', header: t('columns.quantity'), align: 'right', cell: (row) => num(format.number(row.quantity)) },
    { key: 'revenue', header: t('sales.revenue'), align: 'right', cell: (row) => num(format.money(row.revenue)) },
  ];
  return (
    <TableReport title={t('tabs.categories')} exportName="sales-by-category" period={period} query={query} columns={columns} getRowId={(row) => row.categoryId} />
  );
}

export function PaymentMethodsReport({ period }: Props) {
  const { t } = useTranslation('reports');
  const format = useFormatters();
  const query = usePaymentMethodsReport(period);
  const columns: DataTableColumn<PaymentMethodTotalDto>[] = [
    { key: 'method', header: t('columns.method'), cell: (row) => t(`method.${row.method}`, { defaultValue: row.method }) },
    { key: 'count', header: t('columns.count'), align: 'right', cell: (row) => num(format.number(row.count, 0)) },
    { key: 'amount', header: t('columns.amount'), align: 'right', cell: (row) => num(format.money(row.amount)) },
    { key: 'refunded', header: t('columns.refunded'), align: 'right', hideOnMobile: true, cell: (row) => num(format.money(row.refundedAmount)) },
  ];
  return <TableReport title={t('tabs.payments')} exportName="payment-methods" period={period} query={query} columns={columns} getRowId={(row) => row.method} />;
}

function useStockColumns(): DataTableColumn<StockBalanceRowDto>[] {
  const { t } = useTranslation('reports');
  const format = useFormatters();
  return [
    { key: 'name', header: t('columns.ingredient'), cell: (row) => row.name },
    { key: 'qty', header: t('columns.balance'), align: 'right', cell: (row) => num(`${format.number(row.quantity)} ${row.unitCode}`) },
    { key: 'min', header: t('columns.minQuantity'), align: 'right', cell: (row) => num(`${format.number(row.minQuantity)} ${row.unitCode}`) },
    { key: 'value', header: t('columns.stockValue'), align: 'right', hideOnMobile: true, cell: (row) => num(format.money(row.stockValue)) },
    {
      key: 'status',
      header: t('columns.status'),
      cell: (row) =>
        row.quantity < 0 ? (
          <StatusBadge tone="danger">{t('stock.negative')}</StatusBadge>
        ) : row.isLow ? (
          <StatusBadge tone="warning">{t('stock.low')}</StatusBadge>
        ) : (
          <StatusBadge tone="success">{t('stock.ok')}</StatusBadge>
        ),
    },
  ];
}

export function StockReports() {
  const { t } = useTranslation('reports');
  const columns = useStockColumns();
  const lowStock = useLowStockReport();
  const stock = useStockReport();
  return (
    <div className={styles.stack}>
      <TableReport title={t('stock.lowTitle')} exportName="low-stock" query={lowStock} columns={columns} getRowId={(row) => row.ingredientId} />
      <TableReport title={t('stock.balancesTitle')} exportName="stock" query={stock} columns={columns} getRowId={(row) => row.ingredientId} />
    </div>
  );
}

export function MovementTotalsReport({ period }: Props) {
  const { t } = useTranslation('reports');
  const format = useFormatters();
  const query = useMovementTotalsReport(period);
  const columns: DataTableColumn<MovementTotalDto>[] = [
    { key: 'type', header: t('columns.type'), cell: (row) => t(`stock:movementType.${row.type}`, { defaultValue: row.type }) },
    { key: 'ingredient', header: t('columns.ingredient'), cell: (row) => row.ingredientName },
    { key: 'qty', header: t('columns.quantity'), align: 'right', cell: (row) => num(`${format.number(row.quantity)} ${row.unitCode}`) },
    { key: 'count', header: t('columns.count'), align: 'right', hideOnMobile: true, cell: (row) => num(format.number(row.count, 0)) },
  ];
  return (
    <TableReport
      title={t('tabs.movements')}
      exportName="stock-movements"
      period={period}
      query={query}
      columns={columns}
      getRowId={(row) => `${row.type}-${row.ingredientId}`}
    />
  );
}

export function CashShiftsReport({ period }: Props) {
  const { t } = useTranslation('reports');
  const format = useFormatters();
  const query = useCashShiftsReport(period);
  const columns: DataTableColumn<CashShiftReportRowDto>[] = [
    { key: 'opened', header: t('columns.openedAt'), cell: (row) => format.dateTime(row.openedAt) },
    { key: 'closed', header: t('columns.closedAt'), hideOnMobile: true, cell: (row) => format.dateTime(row.closedAt) },
    { key: 'by', header: t('columns.cashier'), hideOnMobile: true, cell: (row) => row.openedByName ?? '—' },
    { key: 'status', header: t('columns.status'), cell: (row) => <StatusBadge domain="cashShift" status={row.status} /> },
    { key: 'cash', header: t('columns.cashPayments'), align: 'right', hideOnMobile: true, cell: (row) => num(format.money(row.cashPayments)) },
    { key: 'card', header: t('columns.cardPayments'), align: 'right', hideOnMobile: true, cell: (row) => num(format.money(row.cardPayments)) },
    { key: 'refunds', header: t('columns.refunds'), align: 'right', hideOnMobile: true, cell: (row) => num(format.money(row.refunds)) },
    { key: 'expected', header: t('columns.expected'), align: 'right', cell: (row) => num(format.money(row.expectedCashAmount)) },
    { key: 'actual', header: t('columns.actual'), align: 'right', cell: (row) => num(format.money(row.actualCashAmount)) },
    {
      key: 'diff',
      header: t('columns.difference'),
      align: 'right',
      cell: (row) =>
        row.difference ? <StatusBadge tone={row.difference < 0 ? 'danger' : 'warning'}>{format.money(row.difference)}</StatusBadge> : num(format.money(row.difference)),
    },
  ];
  return <TableReport title={t('tabs.shifts')} exportName="cash-shifts" period={period} query={query} columns={columns} getRowId={(row) => row.id} />;
}
