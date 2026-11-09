import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('requires a reason when asked and passes it to onConfirm', async () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDialog open title="Cancel order?" withReason reasonRequired onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    const confirm = screen.getByRole('button', { name: 'Подтвердить' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Причина/), 'Guest left');
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('Guest left');
  });

  it('closes on Escape and is a labelled modal dialog', async () => {
    const onCancel = vi.fn();
    renderWithProviders(<ConfirmDialog open title="Block user?" onConfirm={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: 'Block user?' })).toHaveAttribute('aria-modal', 'true');
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});
