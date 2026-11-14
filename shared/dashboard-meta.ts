export type DashboardRole = 'leadership' | 'supply_chain' | 'district' | 'facility' | 'partner';
export const DASHBOARD_ROLES: { id: DashboardRole; label: string; short: string; description: string }[] = [
  { id: 'leadership', label: 'National / MoH leadership', short: 'Leadership', description: 'Country summary, national risk map, top five budget-aware interventions, and briefing export.' },
  { id: 'supply_chain', label: 'Supply-chain & financing officers', short: 'Supply & financing', description: 'Pipeline bottlenecks, ranked interventions, expiry and redistribution alerts, and drill-down risk table.' },
  { id: 'district', label: 'District health management team', short: 'District', description: 'District stock status, facilities at risk, urgent feasible actions, and a fast mobile/tablet layout.' },
  { id: 'facility', label: 'Facility pharmacist / store manager', short: 'My facility', description: 'My stock, days of cover, deliveries, and one-tap support, receipt confirmation, or issue reporting.' },
  { id: 'partner', label: 'Foundation Africa team / partners', short: 'Partners', description: 'Country comparison, project goals, local adoption metrics, bottleneck patterns, and annotations.' },
];
export interface DashboardCapabilities {
  canExportBriefing: boolean; canReviewInterventions: boolean; canRecordFacilityAction: boolean; canAnnotate: boolean;
  scopeLock: 'country' | 'district' | 'facility' | null;
}
export const dashboardCapabilities = (role: DashboardRole): DashboardCapabilities => ({
  canExportBriefing: role === 'leadership' || role === 'supply_chain' || role === 'partner',
  canReviewInterventions: role !== 'facility',
  canRecordFacilityAction: role === 'district' || role === 'facility',
  canAnnotate: role === 'partner',
  scopeLock: role === 'district' ? 'district' : role === 'facility' ? 'facility' : null,
});
