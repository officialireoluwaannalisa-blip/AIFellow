// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState, Modal, RiskBadge, StockChart } from '../../src/components/ui';

describe('accessible UI primitives', () => {
  it('labels Unknown distinctly from Stable', () => {
    render(<><RiskBadge risk="unknown" /><RiskBadge risk="stable" /></>);
    expect(screen.getByText('Unknown')).toBeInTheDocument(); expect(screen.getByText('Stable')).toBeInTheDocument();
  });
  it('gives the stock chart a text alternative', () => {
    render(<StockChart points={[{ day: 0, date: '2026-11-14', stock: 100, unmet: 0 }, { day: 1, date: '2026-11-15', stock: 80, unmet: 0 }]} />);
    expect(screen.getByRole('img', { name: /Projected usable stock over 1 days/ })).toBeInTheDocument();
  });
  it('closes a dialog with Escape and restores focus', async () => {
    const user = userEvent.setup();
    function Harness() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>Open dialog</button>{open && <Modal title="Review plan" onClose={() => setOpen(false)}><button>Confirm</button></Modal>}</>; }
    render(<Harness />); const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger); expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
  });
  it('renders an actionable empty state', async () => {
    const user = userEvent.setup(); const action = vi.fn();
    render(<EmptyState title="No matching records" description="Clear filters to continue." action={<button onClick={action}>Clear filters</button>} />);
    await user.click(screen.getByRole('button', { name: 'Clear filters' })); expect(action).toHaveBeenCalledOnce();
  });
});
