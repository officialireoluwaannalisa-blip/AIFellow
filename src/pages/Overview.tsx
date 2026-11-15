import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Building2, CalendarClock, CircleAlert, Clock3, PackageCheck, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { money, number, post, shortDate, useApi } from '../api';
import { Card, ErrorState, Loading, PageHeader, Pill, RiskBadge, StatCard } from '../components/ui';
import type { Overview as OverviewData, PlanAction, ScenarioResult } from '../../shared/types';
import type { Meta } from '../types';

export function Overview() {
  const navigate = useNavigate();
  const { data: overview, error, loading, reload } = useApi<OverviewData>('/overview');
  const { data: meta } = useApi<Meta>('/meta');
  const [nextMove, setNextMove] = useState<PlanAction | null>(null);
  useEffect(() => {
    if (!meta) return;
    let active = true;
    post<ScenarioResult>('/scenarios/preview', meta.defaultScenario).then((r) => { if (active) setNextMove(r.selected[0] ?? null); }).catch(() => { if (active) setNextMove(null); });
    return () => { active = false; };
  }, [meta]);
  if (loading && !overview) return <Loading />;
  if (error) return <ErrorState message={error} retry={reload} />;
  if (!overview) return null;
  const facilityName = (id?: string) => meta?.facilities.find((f) => f.id === id)?.name ?? id ?? '';
  const productName = (id: string) => meta?.products.find((p) => p.id === id)?.name ?? id;
  return <>
    <PageHeader eyebrow="SUPPLY INTELLIGENCE" title="Keep essential medicines within reach." description="See risk clearly, compare feasible actions, and support better decisions for every facility." action={<button className="button primary" onClick={() => navigate('/planner')}>Build a scenario <ArrowRight size={17} /></button>} />
    <div className="notice-strip"><ShieldCheck size={17} /><span><strong>{meta?.manifest.synthetic === false ? 'Authorized aggregate workspace.' : 'Demonstration workspace.'}</strong> {meta?.manifest.synthetic === false ? 'No patient-level records are accepted. Recommendations require human review.' : 'All facilities and figures are synthetic. Recommendations require human review.'}</span><button onClick={() => navigate('/methodology')}>How it works <ArrowUpRight size={14} /></button></div>
    <div className="stats-grid">
      <StatCard label="Facilities monitored" value={number(overview.facilityCount)} detail={`${overview.recordCount} facility-product records`} icon={<Building2 size={20} />} tone="green" />
      <StatCard label="Critical stock risks" value={number(overview.criticalCount)} detail="Effective cover below 7 days" icon={<CircleAlert size={20} />} tone="red" />
      <StatCard label="Projected stockout days" value={number(overview.projectedStockoutDays)} detail="Item-days over the next 30 days" icon={<CalendarClock size={20} />} tone="amber" />
      <StatCard label="Units nearing expiry" value={number(overview.expiringSoonUnits)} detail="Released batches within 60 days" icon={<Clock3 size={20} />} />
    </div>
    <div className="overview-grid"><Card title="Priority review queue" subtitle="Highest-urgency records in the current snapshot" action={<button className="text-link" onClick={() => navigate('/risks')}>View all risks <ArrowRight size={15} /></button>}>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Facility / district</th><th>Medicine</th><th>Cover</th><th>Risk</th><th><span className="sr-only">Review</span></th></tr></thead><tbody>{overview.topRisks.map((a) => <tr key={`${a.facilityId}:${a.productId}`}><td><strong>{a.facilityName}</strong><span className="cell-sub">{a.districtName}</span></td><td>{a.productName}<span className="cell-sub">{number(a.usableUnits)} {a.unit} usable</span></td><td><strong>{a.daysCover ?? '—'} days</strong></td><td><RiskBadge risk={a.risk} /></td><td><button className="icon-button" aria-label={`Review ${a.facilityName} ${a.productName}`} onClick={() => navigate(`/risks?q=${encodeURIComponent(a.facilityName)}`)}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table></div>
      {overview.topRisks.length === 0 && <div className="inline-empty">No Critical or Watch records in this snapshot.</div>}
    </Card>
    <div className="overview-side"><section className="next-move-card"><div className="next-move-eyebrow"><Sparkles size={16} />A PRACTICAL NEXT MOVE</div>{nextMove ? <><h2>{nextMove.kind === 'transfer' ? 'Rebalance stock before it runs out.' : 'Close the most urgent supply gap.'}</h2><p>{productName(nextMove.productId)} for <strong>{facilityName(nextMove.facilityId)}</strong>.</p><div className="next-move-metrics"><div><span>{number(nextMove.quantity)}</span><small>units proposed</small></div><div><span>{money(nextMove.costCents)}</span><small>estimated cost</small></div></div><div className="next-move-detail"><Truck size={17} /><span>{nextMove.kind === 'transfer' ? `From ${facilityName(nextMove.donorFacilityId)}` : 'Replenishment option'} · {nextMove.arrivalDays}-day arrival assumption</span></div><button className="button lime" onClick={() => navigate('/planner')}>Review the scenario <ArrowRight size={17} /></button></> : <><h2>Start with a budget-aware scenario.</h2><p>Compare feasible transfers and replenishment under a ceiling you choose.</p><button className="button lime" onClick={() => navigate('/planner')}>Open planner <ArrowRight size={17} /></button></>}<small className="next-move-footnote">Exact MILP suggestion · modeled optimum · not approved</small></section>
    <Card title="Data readiness" action={<Pill tone={overview.reportingCompleteness >= 90 ? 'green' : 'amber'}>{overview.reportingCompleteness}% fresh</Pill>}><div className="readiness-row"><div className="readiness-ring" style={{ background: `conic-gradient(#2f8f6b ${overview.reportingCompleteness}%, #e8ede9 0)` }}><span>{overview.reportingCompleteness}%</span></div><div><strong>{overview.knownCount} of {overview.recordCount} records assessable</strong><p>{overview.unknownCount} Unknown records need data review before allocation.</p></div></div><button className="text-link" onClick={() => navigate('/data')}>Inspect data quality <ArrowRight size={15} /></button></Card></div></div>
    <div className="overview-bottom"><Card title="Risk by district" subtitle="Counts of facility-product records, not interchangeable medicine units"><div className="district-bars">{overview.districtSummary.map((d) => <div className="district-bar-row" key={d.id}><div><strong>{d.name}</strong><span>{d.facilities} facilities · {d.records} records</span></div><div className="stacked-bar" role="img" aria-label={`${d.name}: ${d.critical} critical, ${d.watch} watch, ${d.unknown} unknown`}><span className="bar-critical" style={{ flex: d.critical || 0.001 }} /><span className="bar-watch" style={{ flex: d.watch || 0.001 }} /><span className="bar-stable" style={{ flex: Math.max(0, d.records - d.critical - d.watch - d.unknown) || 0.001 }} /><span className="bar-unknown" style={{ flex: d.unknown || 0.001 }} /></div><strong>{d.critical} critical</strong></div>)}</div><div className="chart-legend"><span><i className="legend-dot bar-critical" />Critical</span><span><i className="legend-dot bar-watch" />Watch</span><span><i className="legend-dot bar-stable" />Stable</span><span><i className="legend-dot bar-unknown" />Unknown</span></div></Card>
    <Card title="A traceable decision path" subtitle="The prototype keeps people in control"><div className="decision-path">{[{ icon: PackageCheck, title: 'Verify the snapshot', text: 'Check freshness, batches, and confirmed arrivals.' }, { icon: Sparkles, title: 'Compare feasible actions', text: 'Respect budget, donor cover, and shelf life.' }, { icon: ShieldCheck, title: 'Approve and trace', text: 'Record a human decision and simulated funding steps.' }].map(({ icon: Icon, title, text }, i) => <div key={title}><span className="path-icon"><Icon size={18} /></span><div><strong>{i + 1}. {title}</strong><p>{text}</p></div></div>)}</div><div className="snapshot-note">Fixed snapshot: {shortDate(overview.asOf)} · Dataset {overview.version}</div></Card></div>
  </>;
}
