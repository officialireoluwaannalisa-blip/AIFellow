import { addDays } from '../shared/domain';
import type { Dataset } from '../shared/types';

export function smallDataset(): Dataset {
  const asOf = '2026-11-14';
  return {
    version: 'test', asOf, country: 'Demo Republic', countryCode: 'DEMO', currency: 'USD',
    districts: [{ id: 'd1', name: 'Demo District' }],
    facilities: [{ id: 'donor', name: 'Donor', districtId: 'd1', type: 'hospital' }, { id: 'recipient', name: 'Recipient', districtId: 'd1', type: 'clinic' }],
    products: [{ id: 'p1', name: 'Demo product', form: 'Tablet', unit: 'tablets', essential: true, coldChain: true, unitCostCents: 100, minRemainingShelfLifeDays: 60, shelfLifeDays: 365, priorityWeight: 1 }],
    stocks: [
      { facilityId: 'donor', productId: 'p1', reportedAt: asOf, usableUnits: 1000, quarantinedUnits: 0, history: Array(28).fill(10), leadTimeDays: 5, batches: [{ id: 'donor-batch', quantity: 1000, expiryDate: addDays(asOf, 200), status: 'released' }], inbound: [] },
      { facilityId: 'recipient', productId: 'p1', reportedAt: asOf, usableUnits: 0, quarantinedUnits: 0, history: Array(28).fill(10), leadTimeDays: 5, batches: [{ id: 'recipient-batch', quantity: 0, expiryDate: addDays(asOf, 200), status: 'released' }], inbound: [] },
    ],
    routes: [{ fromFacilityId: 'donor', toFacilityId: 'recipient', days: 1, costCents: 10000, coldChainCapable: true, sameDistrict: true }],
    evidence: [],
  };
}
