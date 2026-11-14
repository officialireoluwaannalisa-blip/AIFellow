import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Download, FileText, GitBranch, LoaderCircle, ShieldCheck } from 'lucide-react';
import { dateTime, money, number, post, useApi } from '../api';
import { Card, EmptyState, ErrorState, Loading, Modal, PageHeader, Pill, useToast } from '../components/ui';
import type { ItemStatus, StoredPlan } from '../../shared/types';
import type { PlanResponse, PlansResponse } from '../types';

const statusLabels: Record<ItemStatus, string> = { proposed: 'Proposed', approved: 'Approved', procurement_requested: 'Fulfillment requested', funds_released: 'Funds released (demo)', received: 'Received (demo)' };
const nextLabels: Record<string, string> = { approved: 'Request fulfillment', procurement_requested: 'Simulate cash release', funds_released: 'Mark received' };
const steps: ItemStatus[] = ['approved', 'procurement_requested', 'funds_released', 'received'];
export function Funding() {
  const navigate = useNavigate(); const toast = useToast(); const [params, setParams] = useSearchParams();
  const { data, error, loading, reload } = useApi<PlansResponse>('/plans');
  const [approveOpen, setApproveOpen] = useState(false); const [note, setNote] = useState(''); const [busy, setBusy] = useState(''); const [mutationError, setMutationError] = useState('');
  const closeApprove = useCallback(() => setApproveOpen(false), []);
  const plans = data?.plans ?? []; const plan = plans.find((p) => p.id === params.get('plan')) ?? plans[0];
  const approve = async () => {
    if (!plan) return; setBusy('approve'); setMutationError('');
    try { await post<PlanResponse>(`/plans/${plan.id}/approve`, { note }); setApproveOpen(false); setNote(''); reload(); toast('Demo plan approved. No order or payment was created.'); }
    catch (err) { setMutationError(err instanceof Error ? err.message : 'Approval failed'); }
    finally { setBusy(''); }
  };
  const advance = async (item: StoredPlan['items'][number]) => {
    if (!plan) return; setBusy(item.id); setMutationError('');
    try { await post<PlanResponse>(`/plans/${plan.id}/items/${encodeURIComponent(item.id)}/advance`, { expectedStatus: item.status, note: '' }); reload(); toast('Simulated status updated and recorded in the audit trail.'); }
    catch (err) { setMutationError(err instanceof Error ? err.message : 'Update failed'); reload(); }
    finally { setBusy(''); }
  };
  if (loading && !data) return <Loading label="Loading saved plans…" />;
  if (error) return <ErrorState message={error} retry={reload} />;
  const released = plan?.items.filter((i) => i.status === 'funds_released' || i.status === 'received').reduce((sum, i) => sum + i.costCents, 0) ?? 0;
  return <>
    <PageHeader eyebrow="HUMAN-IN-THE-LOOP WORKFLOW" title="Funding trace" description="Follow a reviewed plan through simplified fulfillment and cash-release steps. Every transition is recorded." action={plan ? <a className="button secondary" href={`/api/export/plans/${plan.id}.csv`}><Download size={17} />Export plan</a> : undefined} />
    <div className="notice-strip"><ShieldCheck size={17} /><span><strong>Simulation only.</strong> These statuses do not create purchase orders, transfer stock, or release real funds.</span></div>
    {!plans.length ? <EmptyState title="No saved plans yet" description="Build a budget-aware scenario, review the trade-offs, and save a plan to start the trace." action={<button className="button primary" onClick={() => navigate('/planner')}>Open scenario planner <ArrowRight size={17} /></button>} /> : <>
      <Card className="plan-picker"><label className="field-label">Saved plan<select value={plan?.id ?? ''} onChange={(e) => setParams({ plan: e.target.value })}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.status} · {dateTime(p.createdAt)}</option>)}</select></label>{plan && <div className="plan-picker-meta"><Pill tone={plan.status === 'approved' ? 'green' : 'amber'}>{plan.status === 'approved' ? <CheckCircle2 size={14} /> : <FileText size={14} />}{plan.status === 'approved' ? 'Approved demo plan' : 'Draft · review required'}</Pill><span className="muted">Dataset {plan.result.datasetVersion}</span></div>}</Card>
      {mutationError && <ErrorState message={mutationError} retry={reload} />}
      {plan && <div className="notice-strip"><ShieldCheck size={17} /><span><strong>Decision trace.</strong> Optimizer: {plan.result.optimization?.status ?? 'legacy heuristic snapshot'}{plan.result.optimization ? ` · gap ${plan.result.optimization.relativeGap}` : ''} · clinical policy {plan.result.clinicalPolicy?.approvalStatus ?? 'not recorded'} · autonomous execution disabled.</span></div>}
      {plan && <><div className="stats-grid funding-stats"><div className="mini-stat"><span>Plan ceiling</span><strong>{money(plan.scenario.budgetCents)}</strong></div><div className="mini-stat"><span>Planned cost</span><strong>{money(plan.result.totalCostCents)}</strong></div><div className="mini-stat"><span>Simulated funds released</span><strong>{money(released)}</strong></div><div className="mini-stat"><span>Items received</span><strong>{plan.items.filter((i) => i.status === 'received').length} / {plan.items.length}</strong></div></div>
      <Card title={plan.name} subtitle={`${plan.scenario.horizonDays}-day horizon · ${plan.scenario.bufferDays}-day buffer · ${plan.items.length} actions`} action={plan.status === 'draft' ? <button className="button primary small" onClick={() => setApproveOpen(true)}><ShieldCheck size={16} />Review & approve</button> : <Pill tone="green"><Check size={14} />Human approval recorded</Pill>}>
        <div className="workflow-legend">{steps.map((status, i) => <div key={status}><span>{i + 1}</span><strong>{statusLabels[status]}</strong>{i < steps.length - 1 && <ArrowRight size={15} />}</div>)}</div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Action</th><th>Quantity</th><th>Cost</th><th>Status</th><th>Next step</th></tr></thead><tbody>{plan.items.map((item) => <tr key={item.id}><td><strong>{item.kind === 'transfer' ? 'Redistribute' : 'Replenish'} · {item.productId}</strong><span className="cell-sub">{item.facilityId}{item.donorFacilityId ? ` ← ${item.donorFacilityId}` : ''}</span></td><td>{number(item.quantity)}</td><td>{money(item.costCents)}</td><td><Pill tone={item.status === 'received' ? 'green' : item.status === 'proposed' ? 'amber' : 'blue'}>{statusLabels[item.status]}</Pill></td><td>{nextLabels[item.status] ? <button className="button secondary small" disabled={Boolean(busy)} onClick={() => void advance(item)}>{busy === item.id ? <LoaderCircle className="spin" size={14} /> : null}{nextLabels[item.status]}</button> : <span className="complete-label"><CheckCircle2 size={16} />Complete in demo</span>}</td></tr>)}</tbody></table></div>
        {plan.items.length === 0 && <div className="inline-empty">This plan contains no actions. It can be approved as a record of an infeasible scenario.</div>}
      </Card>
      <Card title="Audit trail" subtitle="Append-only demo events · actor is not an authenticated identity" action={<Pill><GitBranch size={14} />{plan.audit.length} events</Pill>}><ol className="audit-timeline">{[...plan.audit].reverse().map((event) => <li key={event.id}><span className="audit-dot" /><div><div className="audit-title"><strong>{event.action.replaceAll('_', ' ')}</strong><time>{dateTime(event.createdAt)}</time></div><p>{event.note}</p><span className="cell-sub">{event.actor} · {event.fromStatus || 'new'} → {event.toStatus}{event.itemId ? ` · ${event.itemId}` : ''}</span></div></li>)}</ol></Card></>}
    </>}
    {approveOpen && plan && <Modal title="Approve this demonstration plan?" onClose={closeApprove}><div className="approval-warning"><ShieldCheck size={24} /><div><strong>This is a simulated approval.</strong><p>No purchase order, stock movement, or payment will be created. In a real deployment, authorized roles and source-system checks would be required.</p></div></div><div className="save-summary"><span>{plan.items.length} actions</span><strong>{money(plan.result.totalCostCents)}</strong><span>Ceiling {money(plan.scenario.budgetCents)}</span></div><label className="field-label">Review note (optional)<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Do not enter real personal or sensitive information." /></label>{mutationError && <p className="form-error" role="alert">{mutationError}</p>}<div className="modal-actions"><button className="button secondary" onClick={closeApprove}>Cancel</button><button className="button primary" disabled={Boolean(busy)} onClick={() => void approve()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Approve demo plan</button></div></Modal>}
  </>;
}
