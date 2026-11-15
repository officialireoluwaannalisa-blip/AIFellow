import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDataset, resolveDataRoot } from '../server/data.js';

describe('serverless dataset resolution', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.STOCKSENSE_DATA_ROOT; });

  it('finds the packaged synthetic dataset from the repository root', () => {
    const root = resolveDataRoot();
    expect(existsSync(join(root, 'data/synthetic/seed.json'))).toBe(true);
  });

  it('still resolves when the working directory is not the bundle root', () => {
    // Serverless runtimes do not guarantee cwd === bundle root.
    vi.spyOn(process, 'cwd').mockReturnValue(tmpdir());
    const root = resolveDataRoot();
    expect(existsSync(join(root, 'data/synthetic/seed.json'))).toBe(true);
    const loaded = loadDataset();
    expect(loaded.manifest.synthetic).toBe(true);
    expect(loaded.dataMode).toBe('synthetic');
    expect(loaded.dataset.facilities.length).toBeGreaterThan(0);
  });

  it('honours an explicit operator override', () => {
    process.env.STOCKSENSE_DATA_ROOT = resolveDataRoot();
    vi.spyOn(process, 'cwd').mockReturnValue(tmpdir());
    expect(existsSync(join(resolveDataRoot(), 'data/synthetic/seed.json'))).toBe(true);
  });
});
