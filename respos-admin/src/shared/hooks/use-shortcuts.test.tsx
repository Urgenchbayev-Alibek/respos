import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { matchesKeys, useShortcuts, type Shortcut } from './use-shortcuts';

function Harness({ shortcuts }: { shortcuts: Shortcut[] }) {
  useShortcuts(shortcuts);
  return (
    <div>
      <input aria-label="search" />
      <button type="button">action</button>
    </div>
  );
}

describe('useShortcuts', () => {
  it('fires plain keys outside inputs', () => {
    const onPay = vi.fn();
    render(<Harness shortcuts={[{ keys: '1', label: 'cash', handler: onPay }]} />);
    fireEvent.keyDown(document.body, { key: '1' });
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it('does not fire plain keys while typing in an input', () => {
    const onSlash = vi.fn();
    const onDigit = vi.fn();
    render(
      <Harness
        shortcuts={[
          { keys: '/', label: 'search', handler: onSlash },
          { keys: '1', label: 'cash', handler: onDigit },
        ]}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'search' });
    fireEvent.keyDown(input, { key: '/' });
    fireEvent.keyDown(input, { key: '1' });
    expect(onSlash).not.toHaveBeenCalled();
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('fires Ctrl+Enter and F-keys inside inputs', () => {
    const onSend = vi.fn();
    const onSearch = vi.fn();
    render(
      <Harness
        shortcuts={[
          { keys: 'Ctrl+Enter', label: 'send', handler: onSend },
          { keys: 'F2', label: 'search', handler: onSearch },
        ]}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'search' });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'F2' });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('does not hijack Enter on a focused button or while a dialog is open', () => {
    const onPay = vi.fn();
    render(<Harness shortcuts={[{ keys: 'Enter', label: 'pay', handler: onPay }]} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'action' }), { key: 'Enter' });
    expect(onPay).not.toHaveBeenCalled();

    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    dialog.remove();
    expect(onPay).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it('respects enabled=false and modifiers', () => {
    const handler = vi.fn();
    render(<Harness shortcuts={[{ keys: 'Enter', label: 'pay', handler, enabled: false }]} />);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(handler).not.toHaveBeenCalled();
    expect(matchesKeys(new KeyboardEvent('keydown', { key: 'Enter' }), 'Ctrl+Enter')).toBe(false);
    expect(matchesKeys(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }), 'Ctrl+Enter')).toBe(true);
    expect(matchesKeys(new KeyboardEvent('keydown', { key: '?', shiftKey: true }), '?')).toBe(true);
  });
});
