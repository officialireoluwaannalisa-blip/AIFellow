import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clinicalPolicySchema } from '../shared/clinical-policy';
import { previewAggregateImport } from '../shared/imports';

const [packPath, policyPath] = process.argv.slice(2);
if (!packPath) {
  console.error('Usage: npm run data:validate-import -- <aggregate-pack.json> [clinical-policy.json]');
  process.exit(2);
}
const report = previewAggregateImport(JSON.parse(readFileSync(resolve(packPath), 'utf8')));
const output: Record<string, unknown> = { ...report, notice: 'Validation preview only. This command does not activate data or authorize allocation.' };
let failed = report.acceptedRows === 0 || report.issues.length > 0;
if (policyPath) {
  try {
    const policy = clinicalPolicySchema.parse(JSON.parse(readFileSync(resolve(policyPath), 'utf8')));
    const policyOk = !policy.syntheticDemo && policy.approvalStatus === 'approved' && policy.jurisdiction === report.country?.code;
    output.clinicalPolicy = { version: policy.version, jurisdiction: policy.jurisdiction, approvalStatus: policy.approvalStatus, matchesPack: policyOk };
    if (!policyOk) failed = true;
  } catch (error) {
    output.clinicalPolicy = { error: error instanceof Error ? error.message : 'Invalid policy' };
    failed = true;
  }
}
console.log(JSON.stringify(output, null, 2));
process.exit(failed ? 1 : 0);
