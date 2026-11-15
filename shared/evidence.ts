import { assessDataset, buildOverview } from './domain';
import type { Dataset, EvidenceAnswer, EvidenceCitation } from './types';

const citation = (dataset: Dataset, id: string): EvidenceCitation | null => {
  const item = dataset.evidence.find((e) => e.id === id);
  return item ? { id: item.id, title: item.title, source: item.source } : null;
};
const citations = (dataset: Dataset, ids: string[]) => ids.map((id) => citation(dataset, id)).filter((x): x is EvidenceCitation => x !== null);

export function searchEvidence(dataset: Dataset, query: string) {
  const stop = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'why', 'are', 'is', 'a', 'an', 'to', 'of', 'in', 'on', 'should', 'does', 'do', 'can', 'this', 'that']);
  const tokens = (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((token) => token.length > 2 && !stop.has(token));
  return dataset.evidence.map((e) => {
    const title = e.title.toLowerCase(); const text = e.text.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (title.includes(token) ? 3 : 0) + (text.includes(token) ? 1 : 0), 0);
    return { ...e, score };
  }).filter((e) => tokens.length === 0 || e.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function answerQuestion(dataset: Dataset, question: string, districtId: string | null = null): EvidenceAnswer {
  const q = question.toLowerCase();
  if (/dose|dosage|prescrib|patient|diagnos|treatment|take.*medicine/.test(q)) return {
    mode: 'retrieval', answer: 'I cannot answer clinical questions, recommend doses, or provide patient-specific advice. This prototype supports supply planning only; consult qualified clinical authorities and local protocols.', facts: [], citations: [],
  };
  const overview = buildOverview(dataset, 30, districtId);
  const scope = districtId ? dataset.districts.find((d) => d.id === districtId)?.name ?? 'Selected district' : dataset.country;
  const modeLabel = dataset.countryCode && dataset.countryCode !== 'DEMO' ? 'authorized aggregate' : 'synthetic';
  const baseFacts = [`${scope}: ${overview.recordCount} facility-product records in ${modeLabel} snapshot ${dataset.version}.`, `${overview.criticalCount} Critical, ${overview.watchCount} Watch, and ${overview.unknownCount} Unknown records at a 30-day horizon.`];
  if (/llm|language model|generative|\bai\b|model connected/.test(q)) return {
    mode: 'retrieval', answer: 'No LLM is connected in this prototype. Answers are bounded retrieval over demo guidance and computed snapshot facts. The forecasting and allocation engines are deterministic and auditable.',
    facts: baseFacts, citations: citations(dataset, ['EV-006']),
  };
  if (/missing|stale|quality|unknown|fresh|provenance/.test(q)) return {
    mode: 'retrieval', answer: `${overview.quality.staleCount} reports are stale and ${overview.quality.shortHistoryCount} records have short consumption history. Unknown records are excluded from automatic allocation; refresh or verify them before deciding. Missing data is not treated as zero risk.`,
    facts: [...baseFacts, `${overview.reportingCompleteness}% of records were reported within 7 days.`], citations: citations(dataset, ['EV-005']),
  };
  if (/transfer|redistrib|expir|cold.chain|donor/.test(q)) return {
    mode: 'retrieval', answer: 'The planner considers exact-product transfers only on explicit same-district routes. It preserves donor buffer, excludes expired/quarantined stock, checks minimum remaining shelf life after arrival, and requires cold-chain capability where relevant. Every transfer still needs human review.',
    facts: [...baseFacts, `${overview.expiringSoonUnits.toLocaleString('en-US')} product units are in released batches expiring within 60 days; units are not interchangeable across products.`], citations: citations(dataset, ['EV-004', 'EV-002']),
  };
  if (/budget|cost|fund|priorit|optimi|allocat/.test(q)) return {
    mode: 'retrieval', answer: 'Open Scenario planner to set a budget ceiling. The engine solves an exact fixed-charge integer-flow MILP with HiGHS: maximize weighted units under safety constraints, then minimize cost without reducing that benefit. It returns an optimality certificate and leaves unfunded needs visible. This is global optimality for the modeled problem—not a clinical priority rule or real-world impact guarantee.',
    facts: baseFacts, citations: citations(dataset, ['EV-003']),
  };
  if (/risk|stockout|shortage|why|urgent|critical|forecast/.test(q)) {
    const top = assessDataset(dataset, 30, 7, districtId).filter((a) => a.risk === 'critical').slice(0, 3);
    return {
      mode: 'retrieval', answer: 'Risk combines consumption-based cover with a first-expiry-first-out stock projection. Critical means effective cover below 7 days; Watch means below the selected horizon. Stale or insufficient data is Unknown. Inspect each item for batches, confirmed arrivals, and the exact calculation.',
      facts: [...baseFacts, ...top.map((a) => `${a.facilityName} · ${a.productName}: ${a.daysCover ?? 'unknown'} days of cover; ${a.usableUnits.toLocaleString('en-US')} ${a.unit} usable.`)],
      citations: citations(dataset, ['EV-001', 'EV-002']),
    };
  }
  if (/brief|summary|overview|snapshot/.test(q)) return {
    mode: 'retrieval', answer: `${scope} has ${overview.facilityCount} facilities and ${overview.recordCount} tracked facility-product records. Prioritize the Critical queue, resolve Unknown records, then compare transfers and replenishment under a reviewed budget.`,
    facts: [...baseFacts, `${overview.projectedStockoutDays} projected stockout item-days over 30 days.`], citations: citations(dataset, ['EV-001', 'EV-003', 'EV-005']),
  };
  const matches = searchEvidence(dataset, question).slice(0, 2);
  if (matches.length) return {
    mode: 'retrieval', answer: `Related demo guidance: ${matches.map((m) => m.text).join(' ')} This bounded retrieval demo does not generate new clinical or financial claims.`,
    facts: baseFacts, citations: matches.map((m) => ({ id: m.id, title: m.title, source: m.source })),
  };
  return { mode: 'retrieval', answer: 'I can help with this snapshot’s stockout risk, data quality, transfers, budget planning, or model limits. I cannot answer clinical questions or infer facts outside the demo evidence.', facts: [], citations: [] };
}

export function buildBriefing(dataset: Dataset, districtId: string | null = null): string {
  const overview = buildOverview(dataset, 30, districtId);
  const scope = districtId ? dataset.districts.find((d) => d.id === districtId)?.name ?? 'Selected district' : dataset.country;
  const top = assessDataset(dataset, 30, 7, districtId).filter((a) => a.risk !== 'unknown').slice(0, 5);
  return [
    `# StockSense Africa — grounded demo briefing`, '',
    `**Scope:** ${scope} · **Snapshot:** ${dataset.asOf} · **Dataset:** ${dataset.version}`,
    `**Notice:** ${dataset.countryCode && dataset.countryCode !== 'DEMO' ? 'Authorized aggregate data; no patient-level records' : 'Synthetic data'}; deterministic retrieval and calculations; no connected LLM; human review required.`, '',
    '## Snapshot facts',
    `- ${overview.facilityCount} facilities; ${overview.recordCount} facility-product records.`,
    `- ${overview.criticalCount} Critical, ${overview.watchCount} Watch, ${overview.stableCount} Stable, ${overview.unknownCount} Unknown.`,
    `- ${overview.projectedStockoutDays} projected stockout item-days over 30 days.`,
    `- ${overview.quality.staleCount} stale reports; ${overview.quality.shortHistoryCount} short histories.`, '',
    '## Priority review queue',
    ...top.map((a, i) => `${i + 1}. **${a.facilityName} — ${a.productName}**: ${a.risk}; ${a.daysCover ?? 'unknown'} days of cover; ${a.needUnits.toLocaleString('en-US')} ${a.unit} modeled gap. Verify batches and confirmed arrivals before action.`), '',
    '## Recommended process',
    'Refresh Unknown records, review exact-product transfer feasibility, run a budget scenario, inspect unfunded needs, and obtain human approval. Do not treat this briefing as a purchase order or clinical instruction.', '',
    '## Evidence references',
    ...dataset.evidence.filter((e) => ['EV-001', 'EV-002', 'EV-003', 'EV-004', 'EV-005'].includes(e.id)).map((e) => `- [${e.id}] ${e.title}. ${e.source}. ${e.text}`), '',
  ].join('\n');
}
