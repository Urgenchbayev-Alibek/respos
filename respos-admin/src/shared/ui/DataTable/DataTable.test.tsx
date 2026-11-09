import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/api-error';
import { renderWithProviders } from '@/test/test-utils';
import { DataTable, type DataTableColumn } from './DataTable';

interface Row {
  id: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [{ key: 'name', header: 'Name', sortField: 'name', cell: (row) => row.name }];

describe('DataTable', () => {
  it('shows skeleton rows while loading the first page', () => {
    renderWithProviders(<DataTable columns={columns} rows={undefined} getRowId={(r) => r.id} isLoading />);
    expect(screen.getAllByTestId('datatable-skeleton-row')).toHaveLength(5);
  });

  it('shows the empty state', () => {
    renderWithProviders(<DataTable columns={columns} rows={[]} getRowId={(r) => r.id} emptyTitle="No rows" />);
    expect(screen.getByText('No rows')).toBeInTheDocument();
  });

  it('shows a localized error with retry', async () => {
    const onRetry = vi.fn();
    const error = new ApiError({ status: 0, code: 'network.error', correlationId: 'abc' });
    renderWithProviders(<DataTable columns={columns} rows={undefined} getRowId={(r) => r.id} error={error} onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Нет связи с сервером');
    expect(screen.getByText(/abc/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Повторить/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders rows, cycles sort and paginates', async () => {
    const onSortChange = vi.fn();
    const onPageChange = vi.fn();
    renderWithProviders(
      <DataTable
        columns={columns}
        rows={[{ id: '1', name: 'Plov' }]}
        getRowId={(r) => r.id}
        sort={null}
        onSortChange={onSortChange}
        pagination={{ page: 1, pageSize: 20, totalCount: 45, onPageChange }}
      />,
    );
    expect(screen.getByText('Plov')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'name', direction: 'asc' });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
