import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './ToastProvider';
import { useToast, type ToastApi } from './toast-context';

let api: ToastApi;

function Capture() {
  api = useToast();
  return null;
}

function renderToasts() {
  render(
    <ToastProvider>
      <Capture />
    </ToastProvider>,
  );
}

describe('ToastProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the remaining toasts paused when one is closed under the pointer', () => {
    renderToasts();
    act(() => {
      api.info('First');
      api.info('Second');
    });
    const region = screen.getByText('First').closest('[aria-live]') as HTMLElement;
    fireEvent.pointerEnter(region);
    fireEvent.click(screen.getAllByRole('button')[0] as HTMLElement);
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText('Second')).toBeInTheDocument();

    fireEvent.pointerLeave(region);
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
  });

  it('shows at most four toasts and a later toast still expires on time', () => {
    renderToasts();
    act(() => {
      ['One', 'Two', 'Three', 'Four', 'Five'].forEach((title) => api.info(title));
    });
    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(4);
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });
});
