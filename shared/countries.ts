export type CountryCode = 'DEMO' | 'NG' | 'ET' | 'ZA' | 'KE';
export interface PublicSource {
  id: string; name: string; url: string; kind: 'government_portal' | 'regulator' | 'health_authority';
  patientLevel: false; status: 'verify_endpoint' | 'public_reference'; notes: string;
}
export interface CountryProfile {
  code: CountryCode; name: string; currency: string; healthAuthority: string;
  dataProtection: string; clinicalGovernance: 'synthetic_demo' | 'requires_local_approval';
  patientLevelAllowed: false; aggregateImportRequiresAuthorization: boolean;
  sources: PublicSource[];
}

export const COUNTRY_PROFILES: CountryProfile[] = [
  {
    code: 'DEMO', name: 'Demo Republic', currency: 'USD', healthAuthority: 'StockSense synthetic demonstration',
    dataProtection: 'Synthetic data only; no personal data', clinicalGovernance: 'synthetic_demo',
    patientLevelAllowed: false, aggregateImportRequiresAuthorization: false, sources: [],
  },
  {
    code: 'NG', name: 'Nigeria', currency: 'NGN', healthAuthority: 'Federal Ministry of Health (verify current data custodian)',
    dataProtection: 'Nigeria Data Protection Act 2023 (NDPA)', clinicalGovernance: 'requires_local_approval',
    patientLevelAllowed: false, aggregateImportRequiresAuthorization: true,
    sources: [
      { id: 'ng-health', name: 'Federal Ministry of Health portal', url: 'https://health.gov.ng/', kind: 'health_authority', patientLevel: false, status: 'verify_endpoint', notes: 'Verify authorized aggregate LMIS/stock extracts and data-sharing terms before use.' },
      { id: 'ng-ndpc', name: 'Nigeria Data Protection Commission', url: 'https://ndpc.gov.ng/', kind: 'regulator', patientLevel: false, status: 'public_reference', notes: 'Confirm lawful basis, sensitive-data safeguards, and retention requirements.' },
    ],
  },
  {
    code: 'ET', name: 'Ethiopia', currency: 'ETB', healthAuthority: 'Ministry of Health (verify current data custodian)',
    dataProtection: 'Personal Data Protection Proclamation No. 1321/2024', clinicalGovernance: 'requires_local_approval',
    patientLevelAllowed: false, aggregateImportRequiresAuthorization: true,
    sources: [
      { id: 'et-moh', name: 'Ministry of Health portal', url: 'https://moh.gov.et/', kind: 'health_authority', patientLevel: false, status: 'verify_endpoint', notes: 'Verify authorized aggregate extracts and local governance requirements.' },
    ],
  },
  {
    code: 'ZA', name: 'South Africa', currency: 'ZAR', healthAuthority: 'National Department of Health (verify current data custodian)',
    dataProtection: 'Protection of Personal Information Act (POPIA)', clinicalGovernance: 'requires_local_approval',
    patientLevelAllowed: false, aggregateImportRequiresAuthorization: true,
    sources: [
      { id: 'za-health', name: 'National Department of Health portal', url: 'https://www.health.gov.za/', kind: 'health_authority', patientLevel: false, status: 'verify_endpoint', notes: 'Verify authorized aggregate extracts, PAIA/POPIA controls, and provincial custodians.' },
    ],
  },
  {
    code: 'KE', name: 'Kenya', currency: 'KES', healthAuthority: 'Ministry of Health (verify current data custodian)',
    dataProtection: 'Data Protection Act 2019; health-data governance requirements', clinicalGovernance: 'requires_local_approval',
    patientLevelAllowed: false, aggregateImportRequiresAuthorization: true,
    sources: [
      { id: 'ke-health', name: 'Ministry of Health portal', url: 'https://www.health.go.ke/', kind: 'health_authority', patientLevel: false, status: 'verify_endpoint', notes: 'Verify authorized aggregate extracts, county custodians, and Digital Health Act requirements.' },
    ],
  },
];

export const getCountryProfile = (code: string): CountryProfile | undefined => COUNTRY_PROFILES.find((c) => c.code === code);
export const isCountryCode = (code: string): code is CountryCode => getCountryProfile(code) !== undefined;
