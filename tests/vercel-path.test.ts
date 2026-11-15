import { describe, expect, it } from 'vitest';
import { restoreVercelApiPath } from '../server/vercel-path';

describe('Vercel API path restoration', () => {
  it('restores rewritten nested API paths and preserves query parameters', () => {
    expect(restoreVercelApiPath('/api/index?__path=health')).toBe('/api/health');
    expect(restoreVercelApiPath('/api/index?__path=dashboard&role=leadership&horizonDays=30')).toBe('/api/dashboard?role=leadership&horizonDays=30');
    expect(restoreVercelApiPath('/api/index?__path=plans/abc/items/def%3Aghi/advance')).toBe('/api/plans/abc/items/def:ghi/advance');
  });

  it('leaves original URLs untouched and normalizes leading slashes', () => {
    expect(restoreVercelApiPath('/api/health')).toBe('/api/health');
    expect(restoreVercelApiPath('/api/index?__path=/health')).toBe('/api/health');
    expect(restoreVercelApiPath('/api/index?__path=')).toBe('/api/');
  });
});
