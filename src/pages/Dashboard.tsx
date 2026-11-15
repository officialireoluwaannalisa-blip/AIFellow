import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, CircleHelp, ClipboardList, Download, FileText, Landmark, MapPin, PackageCheck, Search, Send, ShieldCheck, Truck, Users } from 'lucide-react';
import { dateTime, money, number, post, shortDate, useApi } from '../api';
import { Card, ErrorState, Loading, Pill, RiskBadge, useToast } from '../components/ui';
import { DASHBOARD_ROLES, type DashboardRole } from '../../shared/dashboard-meta';
import type { DashboardData, DashboardFilters, DashboardIntervention } from '../../shared/dashboard';
import type { DashboardSupportRequest, Facility } from '../../shared/types';
import type { CountriesResponse, Meta } from '../types';

const roleIcons: Record<DashboardRole, typeof Landmark> = { leadership: Landmark, supply_chain: Truck, district: MapPin, facility: Building2, partner: Users };
const emptyFilters: DashboardFilters = { role: 'leadership', horizonDays: 30, q: '', budgetCents: 2_500_000, regionId: null, districtId: null, facilityId: null, productId: null };

function queryString(filters: DashboardFilters) {
  const params = new URLSearchParams({ role: filters.role, horizonDays: String(filters.horizonDays), budgetCents: String(filters.budgetCents) });
  if (filters.q) params.set('q', filters.q);
  for (const key of ['countryCode', 'regionId', 'districtId', 'facilityId', 'productId'] as const) if (filters[key]) params.set(key, String(filters[key]));
  return params.toString();
}
function filtersFromParams(params: URLSearchParams, meta: Meta | null): DashboardFilters {
  const role = params.get('role');
  return {
    ...emptyFilters,
    role: DASHBOARD_ROLES.some((r) => r.id === role) ? role as DashboardRole : 'leadership',
    countryCode: params.get('countryCode') ?? meta?.countryCode,
    regionId: params.get('regionId'), districtId: params.get('districtId'), facilityId: params.get('facilityId'), productId: params.get('productId'),
    horizonDays: ([30, 60, 90] as const).includes(Number(params.get('horizonDays')) as 30 | 60 | 90) ? Number(params.get('horizonDays')) as 30 | 60 | 90 : 30,
    q: params.get('q') ?? '', budgetCents: Number(params.get('budgetCents')) || meta?.defaultScenario.budgetCents || 2_500_000,
  };
}

function NativeDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="dashboard-dialog" aria-labelledby="dashboard-dialog-title" onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
    <div className="dashboard-dialog-head"><h2 id="dashboard-dialog-title">{title}</h2><button className="button secondary small" onClick={onClose}>Close</button></div>
    <div className="dashboard-dialog-body">{children}</div>
  </dialog>;
}

function SummaryStrip({ data }: { data: DashboardData }) {
  const s = data.summary;
  return <div className="dashboard-summary" role="region" aria-label="Scope summary">
    <div><span>Medicine availability</span><strong>{s.knownCount ? `${s.availabilityPct}%` : '—'}</strong><small>{s.knownCount} known records with usable stock</small></div>
    <div><span>Budget planned</span><strong>{s.budgetUtilizationPct}%</strong><small>{money(s.plannedCostCents)} of {money(s.budgetCeilingCents)} ceiling</small></div>
    <div className="urgent"><span>Critical stockouts</span><strong>{number(s.criticalCount)}</strong><small>{number(s.watchCount)} watch · {number(s.unknownCount)} unknown</small></div>
    <div><span>Facilities in scope</span><strong>{number(s.facilityCount)}</strong><small>{number(s.recordCount)} facility-product records</small></div>
  </div>;
}

function RiskMap({ data, onSelectDistrict }: { data: DashboardData; onSelectDistrict: (id: string) => void }) {
  const districts = data.map.districts;
  return <Card title="Geographic risk view" subtitle={data.map.schematic ? 'Schematic demo map — not verified geographic boundaries' : 'No map coordinates in this dataset'} action={<Pill tone="neutral">{districts.length} districts</Pill>}>
    {data.map.schematic && <svg className="dashboard-map" viewBox="0 0 100 100" role="img" aria-label={`Schematic risk map: ${districts.map((d) => `${d.name} ${d.risk}`).join(', ')}`}>
      {districts.map((d) => <g key={d.id}>
        {d.polygon && <polygon points={d.polygon.map((p) => `${p.x},${p.y}`).join(' ')} className={`map-district map-${d.risk}`} onClick={() => onSelectDistrict(d.id)} />}
        {d.facilities.map((f) => f.x !== undefined && f.y !== undefined ? <circle key={f.id} cx={f.x} cy={f.y} r="1.6" className={`map-facility map-${f.risk}`}><title>{f.name}: {f.risk}</title></circle> : null)}
        {d.polygon && <text x={d.polygon.reduce((s, p) => s + p.x, 0) / d.polygon.length} y={Math.max(6, Math.min(...d.polygon.map((p) => p.y)) - 4)} className="map-label">{d.name}</text>}
      </g>)}
    </svg>}
    <div className="table-wrap dashboard-table-region compact-table-region" tabIndex={0} role="region" aria-label="District risk table">
      <table className="data-table compact-table"><caption className="sr-only">District risk counts</caption><thead><tr><th scope="col">District</th><th scope="col">Risk</th><th scope="col">Critical</th><th scope="col">Watch</th><th scope="col">Unknown</th></tr></thead>
        <tbody>{districts.map((d) => <tr key={d.id}><th scope="row"><button className="text-link" onClick={() => onSelectDistrict(d.id)}>{d.name}</button></th><td data-label="Risk"><RiskBadge risk={d.risk} /></td><td data-label="Critical">{d.critical}</td><td data-label="Watch">{d.watch}</td><td data-label="Unknown">{d.unknown}</td></tr>)}</tbody></table>
    </div>
    <div className="chart-legend"><span><i className="legend-dot bar-stable" />On track</span><span><i className="legend-dot bar-watch" />Watch</span><span><i className="legend-dot bar-critical" />Urgent</span><span><i className="legend-dot bar-unknown" />Unknown</span></div>
  </Card>;
}

function InterventionList({ data, onWhy, onReview }: { data: DashboardData; onWhy: (a: DashboardIntervention) => void; onReview: (a: DashboardIntervention) => void }) {
  return <Card title={data.summary.role === 'leadership' ? 'Top 5 priority interventions' : 'Recommended actions'} subtitle={data.interventionNote} action={<Link className="text-link" to="/planner">Open planner <ArrowRight size={15} /></Link>}>
    {data.gateReason && <div className="notice-strip warning"><ShieldCheck size={17} /><span>{data.gateReason}</span></div>}
    {data.interventions.length === 0 ? <div className="inline-empty">No feasible intervention in this scope and budget. Review unfunded needs in the planner.</div> :
      <ol className="intervention-list">{data.interventions.map((a, i) => <li key={a.id}>
        <span className="rank-number">{i + 1}</span>
        <div className="intervention-main"><strong>{a.kind === 'transfer' ? `Move ${number(a.quantity)} ${a.unit}` : `Order ${number(a.quantity)} ${a.unit}`} · {a.productName}</strong>
          <span>{a.facilityName}{a.donorFacilityName ? ` ← ${a.donorFacilityName}` : ''} · arrives in {a.arrivalDays} days · {money(a.costCents)}</span>
          <button className="text-link" onClick={() => onWhy(a)}><CircleHelp size={14} />Why this?</button></div>
        <button className="button secondary small" onClick={() => onReview(a)}>Recommended action</button>
      </li>)}</ol>}
    {data.optimization && <div className="card-footnote">Optimizer: {data.optimization.solver} {data.optimization.solverVersion} · {data.optimization.status} · gap {data.optimization.relativeGap} · {data.optimization.solveTimeMs} ms. Optimality is scoped to the modeled integer-flow problem.</div>}
  </Card>;
}

function Bottlenecks({ data }: { data: DashboardData }) {
  return <Card title="Bottleneck summary" subtitle="Where the modeled pipeline is stuck">
    <ul className="bottleneck-list">{data.bottlenecks.map((b) => <li key={b.id} className={`bottleneck-${b.severity}`}><span className="status-dot" /><div><strong>{b.title}</strong><p>{b.detail}</p></div><Link to={b.href} className="text-link">Review</Link></li>)}</ul>
  </Card>;
}

function Forecast({ data }: { data: DashboardData }) {
  return <Card title="Stockout-risk forecast" subtitle="Deterministic projection on the active snapshot">
    <div className="table-wrap dashboard-table-region compact-table-region" tabIndex={0} role="region" aria-label="Forecast table"><table className="data-table compact-table"><caption className="sr-only">30, 60, and 90 day forecast</caption>
      <thead><tr><th scope="col">Horizon</th><th scope="col">Critical</th><th scope="col">Watch</th><th scope="col">Unknown</th><th scope="col">Stockout item-days</th></tr></thead>
      <tbody>{data.forecast.map((f) => <tr key={f.horizonDays}><th scope="row">{f.horizonDays} days</th><td data-label="Critical">{f.critical}</td><td data-label="Watch">{f.watch}</td><td data-label="Unknown">{f.unknown}</td><td data-label="Stockout item-days">{number(f.stockoutDays)}</td></tr>)}</tbody></table></div>
  </Card>;
}

function BudgetPanel({ data }: { data: DashboardData }) {
  const s = data.summary; const planned = Math.min(100, s.budgetUtilizationPct); const released = s.budgetCeilingCents ? Math.min(100, Math.round(100 * s.releasedCostCents / s.budgetCeilingCents)) : 0;
  return <Card title="Budget vs planned interventions" subtitle="Demo ceiling and saved-plan releases">
    <div className="budget-bars"><div><span>Planned</span><div className="progress-track"><span style={{ width: `${planned}%` }} /></div><strong>{money(s.plannedCostCents)}</strong></div>
      <div><span>Released in saved demo plans</span><div className="progress-track"><span style={{ width: `${released}%` }} /></div><strong>{money(s.releasedCostCents)}</strong></div></div>
    <div className="card-footnote">Remaining ceiling: {money(Math.max(0, s.budgetCeilingCents - s.plannedCostCents))}. No live treasury or procurement system is connected.</div>
  </Card>;
}

function Pipeline({ data }: { data: DashboardData }) {
  return <Card title="Financing flow tracker" subtitle="Source: saved demo plans, not live system integrations">
    <ol className="pipeline-stages">{data.pipeline.stages.map((s) => <li key={s.id}><strong>{s.label}</strong><span>{s.itemCount} items · {money(s.valueCents)}</span></li>)}</ol>
    {data.pipeline.pending.length > 0 && <div className="table-wrap dashboard-table-region" tabIndex={0} role="region" aria-label="Pending pipeline items"><table className="data-table dashboard-table"><caption className="sr-only">Pending demo pipeline items</caption>
      <thead><tr><th scope="col">Facility</th><th scope="col">Medicine</th><th scope="col">Stage</th><th scope="col">Age</th><th scope="col">Value</th></tr></thead>
      <tbody>{data.pipeline.pending.map((p) => <tr key={`${p.planId}:${p.itemId}`}><th scope="row">{p.facilityName}</th><td data-label="Medicine">{p.productName}</td><td data-label="Stage">{p.status.replaceAll('_', ' ')}</td><td data-label="Age">{p.ageDays} days</td><td data-label="Value">{money(p.valueCents)}</td></tr>)}</tbody></table></div>}
  </Card>;
}

function RiskTable({ data, facilities }: { data: DashboardData; facilities: Facility[] }) {
  return <Card title="Predictive stockout-risk table" subtitle={`${data.riskRows.length} records in scope (first 100 shown)`} action={<Link className="text-link" to="/risks">Full register <ArrowRight size={15} /></Link>}>
    <div className="table-wrap dashboard-table-region" tabIndex={0} role="region" aria-label="Stockout risk table"><table className="data-table dashboard-table"><caption className="sr-only">Stockout risk by facility and medicine</caption>
      <thead><tr><th scope="col">Facility</th><th scope="col">Medicine</th><th scope="col">Cover</th><th scope="col">Risk</th><th scope="col">Gap</th></tr></thead>
      <tbody>{data.riskRows.map((r) => { const ref = facilities.find((f) => f.id === r.facilityId)?.nameReference; return <tr key={`${r.facilityId}:${r.productId}`}><th scope="row">{r.facilityName}<span className="cell-sub">{r.districtName}{ref ? ' · real name, synthetic figures' : ''}</span></th><td data-label="Medicine">{r.productName}</td><td data-label="Cover">{r.daysCover ?? '—'} days</td><td data-label="Risk"><RiskBadge risk={r.risk} /></td><td data-label="Gap">{number(r.needUnits)} {r.unit}</td></tr>; })}</tbody></table></div>
  </Card>;
}

function Alerts({ data }: { data: DashboardData }) {
  return <Card title="Expiry & redistribution alerts"><ul className="alert-list">{data.alerts.length === 0 && <li className="inline-empty">No alerts in this scope.</li>}{data.alerts.map((a) => <li key={a.id} className={`bottleneck-${a.severity}`}><span className="status-dot" /><div><strong>{a.title}</strong><p>{a.detail}</p></div><Link className="text-link" to={a.href}>Open</Link></li>)}</ul></Card>;
}

function FacilityPanel({ data, facilities, onAction }: { data: DashboardData; facilities: Facility[]; onAction: (kind: DashboardSupportRequest['kind'], productId?: string, referenceId?: string) => void }) {
  const facility = facilities.find((f) => f.id === data.filters.facilityId);
  return <>
    <Card title={`My facility${facility ? `: ${facility.name}` : ''}`} subtitle={`${data.summary.knownCount ? data.summary.availabilityPct : '—'}% availability · ${data.summary.criticalCount} critical · risk-sorted stock`} action={<button className="button primary small" onClick={() => onAction('support')}><Send size={15} />Request support</button>}>
      {facility?.nameReference && <div className="notice-strip name-reference"><ShieldCheck size={16} /><span><strong>Real facility name, synthetic stock figures.</strong> Not a verified Foundation grantee. <a href={facility.nameReference.source} target="_blank" rel="noreferrer">Name source</a> · <Link to="/methodology">About names</Link></span></div>}
      <div className="table-wrap dashboard-table-region" tabIndex={0} role="region" aria-label="My facility stock"><table className="data-table dashboard-table facility-table"><caption className="sr-only">Facility stock</caption>
        <thead><tr><th scope="col">Medicine</th><th scope="col">Usable</th><th scope="col">Days cover</th><th scope="col">Risk</th><th scope="col">Action</th></tr></thead>
        <tbody>{data.facilityStock.map((r) => <tr key={r.productId}><th scope="row">{r.productName}</th><td data-label="Usable">{number(r.usableUnits)} {r.unit}</td><td data-label="Days cover">{r.daysCover ?? '—'}</td><td data-label="Risk"><RiskBadge risk={r.risk} /></td><td data-label="Action"><button className="button secondary small" onClick={() => onAction(r.risk === 'unknown' ? 'discrepancy' : 'support', r.productId)}>{r.risk === 'unknown' ? 'Report issue' : 'Request support'}</button></td></tr>)}</tbody></table></div>
      <div className="card-actions facility-quick-actions"><button className="button secondary" onClick={() => onAction('discrepancy')}>Report discrepancy</button><button className="button secondary" onClick={() => onAction('usage_adjustment')}>Adjust usage note</button></div>
    </Card>
    <Card title="Upcoming deliveries" action={<Pill tone="blue">{data.upcomingDeliveries.length}</Pill>}>
      <ul className="delivery-list">{data.upcomingDeliveries.length === 0 && <li className="inline-empty">No confirmed or planned deliveries in this scope.</li>}{data.upcomingDeliveries.map((d) => <li key={d.id}><div><strong>{d.productName}</strong><span>{number(d.quantity)} {d.unit} · {shortDate(d.expectedDate)} · {d.status}</span></div>{d.status === 'confirmed' && <button className="button secondary small" onClick={() => onAction('receipt_confirmation', d.productId, d.id)}><PackageCheck size={15} />Confirm receipt</button>}</li>)}</ul>
    </Card>
    <Card title="Recent receipts & requests"><ul className="audit-timeline">{data.recentReceipts.map((r) => <li key={r.id}><span className="audit-dot" /><div><div className="audit-title"><strong>Receipt recorded</strong><time>{dateTime(r.date)}</time></div><p>{r.productName} · {number(r.quantity)} {r.unit} · {r.facilityName}</p></div></li>)}{data.supportRequests.map((r) => <li key={r.id}><span className="audit-dot" /><div><div className="audit-title"><strong>{r.kind.replaceAll('_', ' ')}</strong><time>{dateTime(r.createdAt)}</time></div><p>{r.note}</p></div></li>)}</ul></Card>
  </>;
}

function PartnerPanel({ data, countries, onNote }: { data: DashboardData; countries: CountriesResponse | null; onNote: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  return <>
    <Card title="Cross-country risk & financing overview" subtitle="Only the active dataset has metrics; other countries are not connected">
      <div className="table-wrap dashboard-table-region" tabIndex={0} role="region" aria-label="Country comparison"><table className="data-table dashboard-table"><caption className="sr-only">Country comparison</caption>
        <thead><tr><th scope="col">Country</th><th scope="col">Connection</th><th scope="col">Availability</th><th scope="col">Critical</th><th scope="col">Deep dive</th></tr></thead>
        <tbody>{(data.partner?.countries ?? []).map((c) => <tr key={c.code}><th scope="row">{c.name}</th><td data-label="Connection">{c.connectionState.replaceAll('_', ' ')}</td><td data-label="Availability">{c.availabilityPct !== undefined ? `${c.availabilityPct}%` : '—'}</td><td data-label="Critical">{c.critical ?? '—'}</td><td data-label="Deep dive">{c.connectionState === 'active_dataset' ? <Link className="text-link" to={`/?role=leadership&countryCode=${c.code}`}>Open</Link> : <span className="muted">Not connected</span>}</td></tr>)}</tbody></table></div>
      {countries && <div className="card-footnote">{countries.countries.filter((c) => c.connectionState === 'not_connected').length} country profiles await authorized aggregate data and local clinical approval.</div>}
    </Card>
    <Card title="Progress vs project goals"><ul className="goal-list">{data.partner?.goals.map((g) => <li key={g.label}><strong>{g.label}</strong><Pill tone={g.status === 'measured_locally' ? 'green' : 'amber'}>{g.status.replaceAll('_', ' ')}</Pill><p>{g.detail}</p></li>)}</ul></Card>
    <Card title="Prototype / pilot performance" subtitle="Local workspace counts, not real adoption telemetry">
      <div className="dashboard-summary partner-metrics"><div><span>Saved plans</span><strong>{data.partner?.savedPlans ?? 0}</strong></div><div><span>Approved plans</span><strong>{data.partner?.approvedPlans ?? 0}</strong></div><div><span>Audit events</span><strong>{data.partner?.auditEvents ?? 0}</strong></div><div><span>Facility requests</span><strong>{data.partner?.supportRequests ?? 0}</strong></div></div>
    </Card>
    <Card title="Notes & annotations"><form className="note-form" onSubmit={async (e) => { e.preventDefault(); if (note.trim().length < 3) return; await onNote(note.trim()); setNote(''); }}>
      <label htmlFor="partner-note">Add a partner note</label><textarea id="partner-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} required minLength={3} />
      <button className="button primary" type="submit">Save note</button></form>
      <ul className="audit-timeline">{data.notes.map((n) => <li key={n.id}><span className="audit-dot" /><div><div className="audit-title"><strong>{n.actor}</strong><time>{dateTime(n.createdAt)}</time></div><p>{n.note}</p></div></li>)}</ul>
    </Card>
  </>;
}

function AuditTrail({ data }: { data: DashboardData }) {
  return <Card title="Decision audit trail" subtitle="Local demo records; not an authenticated production audit log">
    <ul className="audit-timeline">{data.audit.length === 0 && <li className="inline-empty">No dashboard decisions recorded yet.</li>}{data.audit.map((e) => <li key={e.id}><span className="audit-dot" /><div><div className="audit-title"><strong>{e.action.replaceAll('_', ' ')} · {e.role}</strong><time>{dateTime(e.createdAt)}</time></div><p>{e.note}{e.scope ? ` (${e.scope})` : ''}</p></div></li>)}</ul>
  </Card>;
}

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const { data: meta } = useApi<Meta>('/meta');
  const { data: countries } = useApi<CountriesResponse>('/countries');
  const filters = useMemo(() => filtersFromParams(params, meta), [params, meta]);
  const path = `/dashboard?${queryString(filters)}`;
  const { data, error, loading, reload } = useApi<DashboardData>(meta ? path : null);
  const [cached, setCached] = useState<DashboardData | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [why, setWhy] = useState<DashboardIntervention | null>(null);
  const [action, setAction] = useState<{ kind: DashboardSupportRequest['kind']; productId?: string; referenceId?: string } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const roleSwitcherRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  useEffect(() => {
    const switcher = roleSwitcherRef.current;
    const selected = switcher?.querySelector<HTMLButtonElement>('button.selected');
    if (!switcher || !selected) return;
    const left = selected.getBoundingClientRect().left - switcher.getBoundingClientRect().left + switcher.scrollLeft - (switcher.clientWidth - selected.clientWidth) / 2;
    switcher.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
  }, [filters.role]);
  useEffect(() => { const on = () => setOffline(false); const off = () => setOffline(true); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  useEffect(() => { if (!data) return; setCached(data); try { localStorage.setItem(`stocksense-dashboard:${filters.role}`, JSON.stringify(data)); } catch { /* storage unavailable */ } }, [data, filters.role]);
  useEffect(() => { if (data || !error) return; try { const raw = localStorage.getItem(`stocksense-dashboard:${filters.role}`); if (raw) setCached(JSON.parse(raw) as DashboardData); } catch { /* ignore */ } }, [error, data, filters.role]);
  const view = data ?? cached;
  const update = (patch: Partial<DashboardFilters>) => {
    const next = { ...filters, ...patch };
    if (patch.regionId !== undefined) { next.districtId = null; next.facilityId = null; }
    if (patch.districtId !== undefined) next.facilityId = null;
    if (patch.role === 'facility' && !next.facilityId) next.facilityId = meta?.facilities[0]?.id ?? null;
    if (patch.role === 'district' && !next.districtId) next.districtId = meta?.districts[0]?.id ?? null;
    const qp = new URLSearchParams(queryString(next)); setParams(qp, { replace: true });
  };
  const exportBriefing = async () => {
    setBusy(true);
    try { const response = await fetch(`/api/dashboard/briefing?${queryString(filters)}`); if (!response.ok) throw new Error('Export failed'); const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `stocksense-dashboard-${filters.role}.md`; a.click(); URL.revokeObjectURL(url); toast('Briefing exported'); reload(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Export failed'); } finally { setBusy(false); }
  };
  const submitAction = async (e: FormEvent) => {
    e.preventDefault(); if (!action || !view) return; setBusy(true);
    const payload = { role: filters.role === 'district' ? 'district' : 'facility', facilityId: view.filters.facilityId ?? meta?.facilities[0]?.id, productId: action.productId ?? null, referenceId: action.referenceId ?? null, kind: action.kind, note: actionNote };
    try {
      if (offline) { const queue = JSON.parse(localStorage.getItem('stocksense-outbox') ?? '[]') as unknown[]; queue.push(payload); localStorage.setItem('stocksense-outbox', JSON.stringify(queue)); toast('Saved locally. Will sync when online.'); }
      else { await post('/dashboard/support', payload); toast('Request recorded'); reload(); }
      setAction(null); setActionNote('');
    } catch (err) { toast(err instanceof Error ? err.message : 'Could not record request'); } finally { setBusy(false); }
  };
  useEffect(() => {
    if (offline) return;
    const sync = async () => { const raw = localStorage.getItem('stocksense-outbox'); if (!raw) return; const queue = JSON.parse(raw) as Record<string, unknown>[]; if (!queue.length) return; const remaining: Record<string, unknown>[] = []; for (const item of queue) { try { await post('/dashboard/support', item); } catch { remaining.push(item); } } localStorage.setItem('stocksense-outbox', JSON.stringify(remaining)); if (remaining.length === 0) { toast('Offline requests synced'); reload(); } };
    void sync();
  }, [offline]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!meta) return <Loading />;
  if (loading && !view) return <Loading label="Building role view…" />;
  if (error && !view) return <ErrorState message={error} retry={reload} />;
  if (!view) return null;
  const role = DASHBOARD_ROLES.find((r) => r.id === filters.role)!;
  const RoleIcon = roleIcons[filters.role];
  const districts = meta.districts.filter((d) => !filters.regionId || (d.regionId ?? d.id) === filters.regionId);
  const facilities = meta.facilities.filter((f) => !filters.districtId || f.districtId === filters.districtId);
  return <div className={`dashboard dashboard-role-${filters.role}`}>
    <header className="dashboard-header"><div><h1>Dashboard overview</h1><p>{filters.role === 'facility' ? 'Stock, deliveries, and one-tap support.' : role.description}</p></div>
      {filters.role !== 'facility' && <div className="dashboard-header-actions">{view.capabilities.canExportBriefing && <button className="button primary" onClick={exportBriefing} disabled={busy || offline}><Download size={16} />Export briefing</button>}<Link className="button secondary" to="/methodology"><FileText size={16} />Methodology</Link></div>}</header>
    {offline && <div className="notice-strip warning" role="status"><AlertTriangle size={17} /><span>Offline mode: showing the last cached snapshot. Facility requests are queued locally; recommendations are not refreshed.</span></div>}
    {!offline && cached && !data && error && <div className="notice-strip warning"><AlertTriangle size={17} /><span>Showing cached snapshot: {error}</span></div>}
    <div className="notice-strip"><ShieldCheck size={17} />{filters.role === 'facility' ? <span><strong>Demo role.</strong> Synthetic figures; the facility name is a public reference, not verified Foundation coverage. <Link to="/methodology">Boundaries</Link></span> : <span><strong>Demo role simulation.</strong> {meta.manifest.synthetic ? 'All figures are synthetic.' : 'Authorized aggregate data.'} Facility names are real public references, not a verified Foundation roster. Role switching is not access control; human review is required. <Link to="/methodology">Demo boundaries</Link></span>}</div>
    <section className="dashboard-controls" aria-label="Role and scope filters">
      <div ref={roleSwitcherRef} className="role-switcher" role="group" aria-label="Choose role view">{DASHBOARD_ROLES.map((r) => { const Icon = roleIcons[r.id]; return <button key={r.id} className={filters.role === r.id ? 'selected' : ''} aria-pressed={filters.role === r.id} onClick={() => update({ role: r.id })}><Icon size={16} /><span>{r.short}</span></button>; })}</div>
      <div className="scope-filters">
        {filters.role !== 'facility' && <>
          <label>Country<select value={filters.countryCode ?? meta.countryCode} onChange={(e) => update({ countryCode: e.target.value })} disabled={filters.role === 'district'}>{(countries?.countries ?? [{ code: meta.countryCode, name: meta.country, connectionState: 'synthetic_demo_active' }]).map((c) => <option key={c.code} value={c.code} disabled={c.connectionState === 'not_connected'}>{c.name}{c.connectionState === 'not_connected' ? ' (not connected)' : ''}</option>)}</select></label>
          <label>Region<select value={filters.regionId ?? ''} onChange={(e) => update({ regionId: e.target.value || null })}><option value="">All regions</option>{view.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label>District<select value={filters.districtId ?? ''} onChange={(e) => update({ districtId: e.target.value || null })}><option value="">All districts</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        </>}
        <label className={filters.role === 'facility' ? 'facility-select' : undefined}>Facility<select value={filters.facilityId ?? ''} onChange={(e) => update({ facilityId: e.target.value || null })}><option value="">{filters.role === 'facility' ? 'Choose my facility' : 'All facilities'}</option>{facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label>Commodity<select value={filters.productId ?? ''} onChange={(e) => update({ productId: e.target.value || null })}><option value="">All medicines</option>{meta.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Period<select value={filters.horizonDays} onChange={(e) => update({ horizonDays: Number(e.target.value) as 30 | 60 | 90 })}><option value={30}>Next 30 days</option><option value={60}>Next 60 days</option><option value={90}>Next 90 days</option></select></label>
        {filters.role !== 'facility' && <label className="dashboard-search">Search<span className="search-field"><Search size={15} /><input value={filters.q} onChange={(e) => update({ q: e.target.value })} placeholder="Facility, medicine, district" aria-label="Search dashboard" /></span></label>}
      </div>
    </section>
    <div className="dashboard-scope-line"><RoleIcon size={16} /><strong>{view.summary.scopeLabel}</strong><span>As of {shortDate(view.summary.asOf)} · {view.summary.countryCode}</span>{loading && <span className="muted">Refreshing…</span>}</div>
    {filters.role !== 'facility' && <SummaryStrip data={view} />}
    {filters.role === 'facility' ? <FacilityPanel data={view} facilities={meta.facilities} onAction={(kind, productId, referenceId) => { setAction({ kind, productId, referenceId }); setActionNote(''); }} /> : <>
      <div className="dashboard-grid"><div>{filters.role !== 'partner' && <InterventionList data={view} onWhy={setWhy} onReview={(a) => { void post('/dashboard/audit', { role: filters.role, action: 'recommendation_reviewed', scope: a.facilityId, note: `${a.productName} for ${a.facilityName}` }).then(reload); }} />}{filters.role === 'leadership' && <Bottlenecks data={view} />}{filters.role === 'partner' && <PartnerPanel data={view} countries={countries} onNote={async (note) => { await post('/dashboard/notes', { role: 'partner', countryCode: view.summary.countryCode, note }); toast('Note saved'); reload(); }} />}{(filters.role === 'supply_chain' || filters.role === 'district') && <RiskTable data={view} facilities={meta.facilities} />}</div>
        <div><RiskMap data={view} onSelectDistrict={(id) => update({ districtId: id })} />{filters.role !== 'leadership' && <Bottlenecks data={view} />}{filters.role === 'leadership' && <BudgetPanel data={view} />}{filters.role !== 'partner' && <Forecast data={view} />}</div></div>
      {filters.role === 'supply_chain' && <><Pipeline data={view} /><Alerts data={view} /></>}
      {filters.role === 'district' && <><Alerts data={view} /><BudgetPanel data={view} /></>}
    </>}
    <AuditTrail data={view} />
    {why && <NativeDialog title="Why this recommendation?" onClose={() => setWhy(null)}><p><strong>{why.productName}</strong> for {why.facilityName}: {number(why.quantity)} {why.unit}, {money(why.costCents)}, arrival in {why.arrivalDays} days.</p><p className="why-short">{why.why}</p><p>{why.rationale}</p><p className="muted">This is a modeled suggestion under budget, donor-buffer, shelf-life, cold-chain, and route constraints. A human must verify local stock and authorize any action.</p><Link className="button primary" to="/planner" onClick={() => setWhy(null)}>Review in planner</Link></NativeDialog>}
    {action && <NativeDialog title={action.kind === 'receipt_confirmation' ? 'Confirm receipt' : action.kind === 'discrepancy' ? 'Report discrepancy' : action.kind === 'usage_adjustment' ? 'Adjust usage note' : 'Request support'} onClose={() => setAction(null)}>
      <form onSubmit={submitAction} className="form-stack"><p className="muted">Minimal demo entry. No patient information. {offline ? 'This will be queued locally until you reconnect.' : 'This records a local demo request; it does not place a real order.'}</p>
        <label className="field-label" htmlFor="action-note">Note<textarea id="action-note" value={actionNote} onChange={(e) => setActionNote(e.target.value)} required minLength={3} maxLength={500} rows={4} /></label>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setAction(null)}>Cancel</button><button className="button primary" disabled={busy} type="submit">{action.kind === 'receipt_confirmation' ? <CheckCircle2 size={16} /> : <ClipboardList size={16} />}{offline ? 'Save offline' : 'Record request'}</button></div></form>
    </NativeDialog>}
  </div>;
}
