import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for the production Vercel outage where every API route
 * returned `FUNCTION_INVOCATION_FAILED`.
 *
 * `@vercel/node` transpiles TypeScript to JavaScript *without bundling* and the
 * package is `"type": "module"`, so the emitted files are loaded by native Node
 * ESM. Native ESM does not do extension resolution: `import '../server/app'`
 * throws ERR_MODULE_NOT_FOUND even though `server/app.js` exists.
 *
 * tsx, esbuild and Vitest all resolve extensionless specifiers, so the local
 * gates stay green while the deployed function is broken. These assertions keep
 * the serverless import graph valid for the runtime that actually ships.
 */
const SERVERLESS_DIRS = ['api', 'server', 'shared'];
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*)'(\.[^']*)'/g;
const EXPLICIT_EXTENSION = /\.(?:js|mjs|cjs|json|wasm|node)$/;

function typeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return typeScriptFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.d.ts') ? [path] : [];
  });
}

const files = SERVERLESS_DIRS.flatMap((dir) => typeScriptFiles(resolve(process.cwd(), dir)));

describe('serverless ESM import graph', () => {
  it('covers the deployed function graph', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((file) => file.endsWith(join('api', 'index.ts')))).toBe(true);
  });

  it('uses explicit file extensions on every relative specifier', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const [, specifier] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
        if (!EXPLICIT_EXTENSION.test(specifier)) offenders.push(`${file}: '${specifier}'`);
      }
    }
    expect(offenders, `Extensionless relative imports break native Node ESM on Vercel:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('points every relative specifier at a file that exists', () => {
    const missing: string[] = [];
    for (const file of files) {
      for (const [, specifier] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
        // TypeScript sources import the emitted `.js` name; the source on disk is `.ts`.
        const sourceName = specifier.replace(/\.js$/, '.ts');
        const target = resolve(dirname(file), sourceName);
        if (!existsSync(target) && !existsSync(resolve(dirname(file), specifier))) {
          missing.push(`${file}: '${specifier}'`);
        }
      }
    }
    expect(missing, `Relative imports must resolve to real files:\n${missing.join('\n')}`).toEqual([]);
  });
});
