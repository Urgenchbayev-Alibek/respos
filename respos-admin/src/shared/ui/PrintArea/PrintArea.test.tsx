import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrintArea } from './PrintArea';
import { PRINT_BODY_ATTRIBUTE, printArea } from './print-controller';

function mockPrint() {
  return vi.spyOn(window, 'print').mockImplementation(() => {
    window.dispatchEvent(new Event('beforeprint'));
  });
}

function finishPrint() {
  act(() => {
    window.dispatchEvent(new Event('afterprint'));
  });
}

describe('PrintArea', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    finishPrint();
  });

  it('renders nothing on screen until its print job starts', () => {
    render(<PrintArea id="slip">Чек 80 мм</PrintArea>);
    expect(screen.queryByText('Чек 80 мм')).not.toBeInTheDocument();
  });

  it('renders only the requested area into <body> and marks the body for thermal printing', () => {
    mockPrint();
    render(
      <>
        <PrintArea id="ticket-1">Тикет 1</PrintArea>
        <PrintArea id="ticket-2">Тикет 2</PrintArea>
      </>,
    );
    act(() => printArea('ticket-2'));

    const area = screen.getByText('Тикет 2');
    expect(area.closest('[data-print-area]')?.parentElement).toBe(document.body);
    expect(screen.queryByText('Тикет 1')).not.toBeInTheDocument();
    expect(document.body.getAttribute(PRINT_BODY_ATTRIBUTE)).toBe('ticket-2');

    finishPrint();
    expect(screen.queryByText('Тикет 2')).not.toBeInTheDocument();
    expect(document.body.hasAttribute(PRINT_BODY_ATTRIBUTE)).toBe(false);
  });

  it('prints the default area on a plain browser print (Ctrl+P)', () => {
    render(
      <PrintArea id="precheck" defaultForPrint>
        Пречек
      </PrintArea>,
    );
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(screen.getByText('Пречек')).toBeInTheDocument();
  });
});
