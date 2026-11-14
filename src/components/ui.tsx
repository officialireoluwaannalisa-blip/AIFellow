import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowRight, Check, Inbox, LoaderCircle, X } from 'lucide-react';
import type { ProjectionPoint, RiskLevel } from '../../shared/types';

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={`badge risk-${risk}`}><span className="status-dot" />{risk === 'unknown' ? 'Unknown' : risk[0].toUpperCase() + risk.slice(1)}</span>;
}
export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'blue' }) { return <span className={`pill pill-${tone}`}>{children}</span>; }
export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{action && <div className="page-header-action">{action}</div>}</header>;
}
export function Card({ title, subtitle, action, children, className = '' }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{(title || action) && <div className="card-header"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{action}</div>}{children}</section>;
}
export function StatCard({ label, value, detail, icon, tone = 'neutral' }: { label: string; value: ReactNode; detail: string; icon: ReactNode; tone?: 'neutral' | 'red' | 'amber' | 'green' }) {
  return <div className={`stat-card stat-${tone}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}
export function Loading({ label = 'Loading workspace…' }: { label?: string }) { return <div className="state-panel" role="status"><LoaderCircle className="spin" size={24} /><p>{label}</p></div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="state-panel error-state" role="alert"><AlertCircle size={26} /><h2>Something needs attention</h2><p>{message}</p>{retry && <button className="button secondary" onClick={retry}>Try again</button>}</div>; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="state-panel"><Inbox size={30} /><h2>{title}</h2><p>{description}</p>{action}</div>; }

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex="0"]') ?? []).filter((el) => !el.hasAttribute('disabled'));
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const items = focusable(); const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="modal-header"><h2 id={titleId}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div><div className="modal-body">{children}</div></div></div>;
}

export function StockChart({ points, buffer = 0 }: { points: ProjectionPoint[]; buffer?: number }) {
  const width = 620; const height = 190; const left = 44; const right = 16; const top = 16; const bottom = 30;
  const max = Math.max(10, ...points.map((p) => p.stock));
  const x = (i: number) => left + (i / Math.max(1, points.length - 1)) * (width - left - right);
  const y = (v: number) => top + (1 - v / max) * (height - top - bottom);
  const line = points.map((p, i) => `${x(i)},${y(p.stock)}`).join(' ');
  const area = `${left},${height - bottom} ${line} ${x(points.length - 1)},${height - bottom}`;
  const safety = max * 0.2;
  return <div className="stock-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Projected usable stock over ${points.length - 1} days, starting at ${points[0]?.stock ?? 0} and ending at ${points.at(-1)?.stock ?? 0} units`}>
    {[0, 0.5, 1].map((fraction) => <g key={fraction}><line x1={left} x2={width - right} y1={y(max * fraction)} y2={y(max * fraction)} stroke="var(--border)" strokeDasharray="3 4" /><text x={left - 8} y={y(max * fraction) + 4} textAnchor="end" className="chart-label">{Math.round(max * fraction)}</text></g>)}
    <polygon points={area} fill="url(#chart-fill)" /><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f8f6b" stopOpacity="0.22" /><stop offset="100%" stopColor="#2f8f6b" stopOpacity="0.01" /></linearGradient></defs>
    {buffer > 0 && <line x1={left} x2={width - right} y1={y(safety)} y2={y(safety)} stroke="#d9a441" strokeDasharray="5 4" />}
    <polyline points={line} fill="none" stroke="#247a59" strokeWidth="2.5" strokeLinejoin="round" />
    <text x={left} y={height - 8} className="chart-label">Today</text><text x={width - right} y={height - 8} textAnchor="end" className="chart-label">Day {points.length - 1}</text>
  </svg><div className="chart-legend"><span><i className="legend-line" />Projected usable stock</span>{buffer > 0 && <span><i className="legend-line amber" />Illustrative buffer band</span>}<span>Confirmed arrivals only</span></div></div>;
}

const ToastContext = createContext<(message: string) => void>(() => undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState(''); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string) => { setMessage(text); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setMessage(''), 4500); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <ToastContext.Provider value={show}>{children}<div className={`toast ${message ? 'toast-visible' : ''}`} role="status" aria-live="polite"><Check size={18} />{message}</div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="text-link" onClick={onClick}>{children}<ArrowRight size={15} /></button>; }
