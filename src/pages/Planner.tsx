import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, CircleAlert, FlaskConical, Info, LoaderCircle, PackagePlus, Save, ShieldCheck, Truck } from 'lucide-react';
import { money, number, post, useApi } from '../api';
import { Card, Loading, Modal, PageHeader, Pill, useToast } from '../components/ui';
import { DEFAULT_SCENARIO } from '../../shared/domain';
import type { ScenarioInput, ScenarioResult } from '../../shared/types';
import type { Meta, PlanResponse } from '../types';

export function Planner() {
  const navigate = useNavigate(); const toast = useToast();
  const { data: meta } = useApi<Meta>('/meta');
  const [scenario, setScenario] = useState<ScenarioInput>({ ...DEFAULT_SCENARIO });
  const [budgetText, setBudgetText] = useState('25000');
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [running, setRunning] = useState(false); const [error, setError] = useState('');
  const [saveOpen, setSaveOpen] = useState(false); const [planName, setPlanName] = useState('District replenishment review');
  const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState(''); const [showAllActions, setShowAllActions] = useState(false);
  const key = useRef(crypto.randomUUID()); const initialized = useRef(false);
  const closeSave = useCallback(() => setSaveOpen(false), []);
  const run = useCallback(async (input: ScenarioInput) => {
    setRunning(true); setError('');
    try { const next = await post<ScenarioResult>('/scenarios/preview', input); setResult(next); setShowAllActions(false); key.current = crypto.randomUUID(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to run scenario'); }
    finally { setRunning(false); }
  }, []);
  useEffect(() => { if (!initialized.current) { initialized.current = true; void run(DEFAULT_SCENARIO); } }, [run]);
  const updateBudget = (value: string) => { setBudgetText(value); const dollars = Number(value); if (value !== '' && Number.isFinite(dollars) && dollars >= 0 && dollars <= 1000000) setScenario((s) => ({ ...s, budgetCents: Math.round(dollars * 100) })); };
  const submitRun = () => {
    const dollars = Number(budgetText);
    if (budgetText === '' || !Number.isFinite(dollars) || dollars < 0 || dollars > 1000000) { setError('Enter a budget between $0 and $1,000,000.'); return; }
    void run({ ...scenario, budgetCents: Math.round(dollars * 100) });
  };
  const stale = result !== null && JSON.stringify(result.scenario) !== JSON.stringify(scenario);
  const facilityName = (id?: string) => meta?.facilities.find((f) => f.id === id)?.name ?? id ?? '';
  const productName = (id: string) => meta?.products.find((p) => p.id === id)?.name ?? id;
  const productUnit = (id: string) => meta?.products.find((p) => p.id === id)?.unit ?? 'units';
  const save = async () => {
    if (!result || stale || planName.trim().length < 3) return;
    setSaving(true); setSaveError('');
    try { const response = await post<PlanResponse>('/plans', { name: planName.trim(), scenario: result.scenario, idempotencyKey: key.current }); toast('Demo plan saved. Human approval is still required.'); navigate(`/funding?plan=${response.plan.id}`); }
    catch (err) { setSaveError(err instanceof Error ? err.message : 'Unable to save plan'); }
    finally { setSaving(false); }
  };
  const utilization = result && scenario.budgetCents > 0 ? Math.min(100, result.totalCostCents / scenario.budgetCents * 100) : 0;
  return <>
    <PageHeader eyebrow="DECISION SUPPORT" title="Scenario planner" description="Compare feasible transfers and replenishment under a hard budget ceiling. Keep the trade-offs visible." action={<Pill tone="blue"><FlaskConical size={14} />Synthetic scenario</Pill>} />
    <div className="planner-layout"><Card title="Scenario inputs" subtitle="Change assumptions, then run a new preview" className="scenario-controls"><div className="form-stack">
      <label className="field-label">District scope<select value={scenario.districtId ?? ''} onChange={(e) => setScenario((s) => ({ ...s, districtId: e.target.value || null }))}><option value="">All districts · Demo Republic</option>{meta?.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <div className="field-label">Planning horizon<div className="segmented" role="group" aria-label="Planning horizon">{([14, 30, 60] as const).map((days) => <button key={days} aria-pressed={scenario.horizonDays === days} className={scenario.horizonDays === days ? 'selected' : ''} onClick={() => setScenario((s) => ({ ...s, horizonDays: days }))}>{days} days</button>)}</div></div>
      <label className="field-label">Budget ceiling (USD)<div className="money-input"><span>$</span><input type="number" min="0" max="1000000" step="100" value={budgetText} onChange={(e) => updateBudget(e.target.value)} aria-label="Budget ceiling in US dollars" /></div><small>Integer-cent accounting. No real funds are committed.</small></label>
      <label className="field-label">Safety buffer <output>{scenario.bufferDays} days</output><input type="range" min="0" max="14" step="1" value={scenario.bufferDays} onChange={(e) => setScenario((s) => ({ ...s, bufferDays: Number(e.target.value) }))} aria-label="Safety buffer days" /><div className="range-labels"><span>0 days</span><span>14 days</span></div></label>
      <button className="button primary full-width" onClick={submitRun} disabled={running}>{running ? <LoaderCircle className="spin" size={17} /> : <FlaskConical size={17} />}{running ? 'Evaluating options…' : 'Run scenario'}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="control-note"><ShieldCheck size={18} /><p>Transfers preserve donor buffer and check exact product, route, shelf life, and cold chain. Unknown records are excluded.</p></div>
    </div></Card>
    <div className="planner-results">{running && !result ? <Loading label="Evaluating feasible actions…" /> : !result ? <Card><div className="state-panel"><FlaskConical size={30} /><h2>Ready to compare options</h2><p>Set your scope and budget, then run a scenario.</p></div></Card> : <>
      {stale && <div className="notice-strip warning"><Info size={17} /><span>Inputs changed. Run the scenario again before saving this plan.</span></div>}
      <div className="scenario-summary"><div><span>Selected actions</span><strong>{result.selected.length}</strong><small>feasible under constraints</small></div><div><span>Estimated cost</span><strong>{money(result.totalCostCents)}</strong><small>of {money(scenario.budgetCents)} ceiling</small></div><div><span>Remaining budget</span><strong>{money(result.remainingBudgetCents)}</strong><small>{result.unfunded.length} needs still unfunded</small></div><div><span>Stockout days avoided</span><strong>{Math.max(0, result.before.stockoutDays - result.after.stockoutDays)}</strong><small>modeled estimate, not impact</small></div></div>
      <div className="budget-meter"><div><span>Budget utilization</span><strong>{utilization.toFixed(1)}%</strong></div><div className="progress-track"><span style={{ width: `${utilization}%` }} /></div></div>
      <Card title="Recommended actions" subtitle="Adaptive greedy ranking · marginal priority units per dollar" action={<button className="button primary small" disabled={stale || running || result.selected.length === 0} onClick={() => setSaveOpen(true)}><Save size={16} />Save plan</button>}>
        {result.selected.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>#</th><th>Action / destination</th><th>Medicine</th><th>Quantity</th><th>Arrival</th><th>Cost</th><th>Priority / $1k</th></tr></thead><tbody>{result.selected.slice(0, showAllActions ? result.selected.length : 12).map((item, index) => <tr key={item.id}><td><span className="rank-number">{index + 1}</span></td><td><div className="action-kind">{item.kind === 'transfer' ? <Truck size={15} /> : <PackagePlus size={15} />}<strong>{item.kind === 'transfer' ? 'Redistribute' : 'Replenish'}</strong></div><span className="cell-sub">{facilityName(item.facilityId)}</span>{item.donorFacilityId && <span className="cell-sub">From {facilityName(item.donorFacilityId)}</span>}</td><td>{productName(item.productId)}<details className="rationale-details"><summary>Why this action <ChevronDown size={12} /></summary><p>{item.rationale}</p></details></td><td>{number(item.quantity)} <span className="muted">{productUnit(item.productId)}</span></td><td>{item.arrivalDays} days</td><td><strong>{money(item.costCents)}</strong></td><td>{item.priorityScore.toFixed(1)}</td></tr>)}</tbody></table></div> : <div className="inline-empty"><CircleAlert size={18} />No feasible action fits this budget and scope. Increase the ceiling or review constraints.</div>}
        {result.selected.length > 12 && <div className="table-more"><button className="text-link" onClick={() => setShowAllActions((v) => !v)}>{showAllActions ? 'Show top 12 actions' : `Show all ${result.selected.length} actions`} <ChevronDown size={14} /></button><span>Saved plans and exports include every selected action.</span></div>}
      </Card>
      <div className="planner-lower"><Card title="Before / after the scenario" subtitle="Same projection engine, with selected arrivals and donor debits"><div className="comparison-row"><div><span>Projected stockout item-days</span><strong>{result.before.stockoutDays} <ArrowRight size={16} /> {result.after.stockoutDays}</strong></div><div><span>Unmet demand units</span><strong>{number(result.before.unmetUnits)} <ArrowRight size={16} /> {number(result.after.unmetUnits)}</strong></div><div><span>Critical / Watch records</span><strong>{result.before.atRisk} <ArrowRight size={16} /> {result.after.atRisk}</strong></div></div><p className="card-footnote">Units are product-specific counts, not clinically interchangeable quantities. Estimates assume immediate authorization.</p></Card>
      <Card title="Unfunded needs" subtitle="Visible trade-offs for human review">{result.unfunded.length ? <ul className="unfunded-list">{result.unfunded.slice(0, 8).map((need) => <li key={`${need.facilityId}:${need.productId}`}><div><strong>{facilityName(need.facilityId)}</strong><span>{productName(need.productId)} · {number(need.quantity)} {productUnit(need.productId)}</span></div><span>{money(need.estimatedCostCents)}</span></li>)}</ul> : <div className="inline-empty"><Check size={18} />No remaining modeled gaps among assessable records.</div>}{result.unfunded.length > 8 && <p className="card-footnote">Showing 8 of {result.unfunded.length}. Export the saved plan and review all needs before decisions.</p>}</Card></div>
      <details className="assumptions"><summary><Info size={16} />Assumptions and limitations <ChevronDown size={16} /></summary><ul>{result.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details>
    </>}</div></div>
    {saveOpen && result && <Modal title="Save this demo plan" onClose={closeSave}><p className="muted">The server will recompute the scenario and preserve a snapshot. Saving does not approve expenditure or create a purchase order.</p><label className="field-label mt-5">Plan name<input value={planName} onChange={(e) => setPlanName(e.target.value)} maxLength={100} autoFocus /></label><div className="save-summary"><span>{result.selected.length} actions</span><strong>{money(result.totalCostCents)}</strong><span>{result.scenario.horizonDays}-day horizon</span></div>{saveError && <p className="form-error" role="alert">{saveError}</p>}<div className="modal-actions"><button className="button secondary" onClick={closeSave}>Cancel</button><button className="button primary" disabled={saving || planName.trim().length < 3} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}Save demo plan</button></div></Modal>}
  </>;
}
