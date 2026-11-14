import { describe, expect, it } from 'vitest';
import { allocationGate, clinicalPolicySchema, DEMO_CLINICAL_POLICY } from '../shared/clinical-policy';
import { COUNTRY_PROFILES, isCountryCode } from '../shared/countries';
import { previewAggregateImport, scanPersonalData } from '../shared/imports';
import { smallDataset } from './fixtures';

const pack = () => ({
  provenance: {
    countryCode: 'NG', sourceName: 'Authorized district aggregate stock extract', sourceSystemId: 'lmis-ng',
    authorizationReference: 'DSA-2026-001', dataUsePurpose: 'District essential-medicines supply planning under signed data-sharing agreement.',
    extractedAt: '2026-11-14T08:00:00Z', observationStart: '2026-10-18', observationEnd: '2026-11-14',
    transformationVersion: 'aggregate-v1', patientLevelData: false, aggregateOnly: true,
  },
  dataset: { ...smallDataset(), countryCode: 'NG', country: 'Nigeria' },
});

describe('country and clinical governance', () => {
  it('exposes country profiles without claiming live patient data', () => {
    expect(isCountryCode('NG')).toBe(true); expect(isCountryCode('XX')).toBe(false);
    for (const profile of COUNTRY_PROFILES) {
      expect(profile.patientLevelAllowed).toBe(false);
      if (profile.code !== 'DEMO') expect(profile.aggregateImportRequiresAuthorization).toBe(true);
    }
  });
  it('gates real-country allocation until data and policy are approved', () => {
    expect(allocationGate('DEMO', DEMO_CLINICAL_POLICY, false).allowed).toBe(true);
    expect(allocationGate('NG', DEMO_CLINICAL_POLICY, false).allowed).toBe(false);
    const approved = clinicalPolicySchema.parse({
      ...DEMO_CLINICAL_POLICY, jurisdiction: 'NG', syntheticDemo: false, approvalStatus: 'approved',
      approvedBy: 'Local clinical governance board', approvedAt: '2026-11-14',
      prioritization: { source: 'approved_local_policy', productWeights: { p1: 1 }, guidance: 'Approved local supply prioritization policy.' },
    });
    expect(allocationGate('NG', approved, false).allowed).toBe(false);
    expect(allocationGate('NG', approved, true).allowed).toBe(true);
  });
});

describe('authorized aggregate import preview', () => {
  it('accepts a structurally valid aggregate pack and returns quality/provenance', () => {
    const result = previewAggregateImport(pack());
    expect(result.acceptedRows).toBe(2); expect(result.rejectedRows).toBe(0); expect(result.issues).toHaveLength(0);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/); expect(result.activationBlocked).toBe(true);
  });
  it('rejects patient-level flags and direct identifier fields', () => {
    const patientFlag = pack() as ReturnType<typeof pack> & { provenance: { patientLevelData: boolean } };
    patientFlag.provenance.patientLevelData = true;
    expect(previewAggregateImport(patientFlag).acceptedRows).toBe(0);
    const pii = pack();
    (pii.dataset.stocks[0] as unknown as Record<string, unknown>).patient_id = 'P123';
    const result = previewAggregateImport(pii);
    expect(result.acceptedRows).toBe(0);
    expect(result.issues.some((i) => /Patient-level|identifier/i.test(i.message))).toBe(true);
    expect(scanPersonalData({ email: 'person@example.com' }).length).toBeGreaterThan(0);
  });
  it('rejects country mismatch and unreconciled batches', () => {
    const mismatch = pack(); mismatch.dataset.countryCode = 'KE';
    expect(previewAggregateImport(mismatch).acceptedRows).toBe(0);
    const bad = pack(); bad.dataset.stocks[0].usableUnits = 999;
    expect(previewAggregateImport(bad).acceptedRows).toBe(0);
  });
});
