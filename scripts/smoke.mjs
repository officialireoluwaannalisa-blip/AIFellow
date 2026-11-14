import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.E2E_PORT ?? 3100);
const base = `http://127.0.0.1:${port}`;
const dbPath = resolve(root, '.data', `e2e-${process.pid}.sqlite`);
let server; let session; let browserReady = false;

function cli(args, timeout = 60000) {
  return execFileSync('npx', ['agent-browser', '--session', session, ...args], { cwd: root, env: process.env, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { const response = await fetch(`${base}/api/health`); if (response.ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('E2E server did not become healthy');
}
async function browserPath() {
  if (process.env.AGENT_BROWSER_EXECUTABLE_PATH) return process.env.AGENT_BROWSER_EXECUTABLE_PATH;
  const chromium = (await import('@sparticuz/chromium')).default;
  const executable = await chromium.executablePath();
  // The bundled AL2023 runtime libraries also make the npm browser usable on Debian CI.
  const require = createRequire(import.meta.url);
  const packageDir = dirname(require.resolve('@sparticuz/chromium'));
  const helpers = await import(pathToFileURL(join(packageDir, 'index.js')));
  await helpers.inflate(join(packageDir, '../bin/al2023.tar.br'));
  helpers.setupLambdaEnvironment(join(tmpdir(), 'al2023', 'lib'));
  process.env.LD_LIBRARY_PATH = `${process.env.LD_LIBRARY_PATH ?? ''}:${tmpdir()}`;
  process.env.FONTCONFIG_PATH ??= join(tmpdir(), 'fonts');
  return executable;
}
function assert(condition, message) { if (!condition) throw new Error(message); }
async function main() {
  assert(existsSync(resolve(root, 'dist/server/index.js')), 'Run npm run build before npm run test:e2e');
  mkdirSync(resolve(root, '.data'), { recursive: true });
  server = spawn(process.execPath, ['dist/server/index.js'], { cwd: root, env: { ...process.env, NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1', DATABASE_PATH: dbPath }, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = ''; server.stdout.on('data', (d) => { serverLog += d; }); server.stderr.on('data', (d) => { serverLog += d; });
  await waitForServer();
  const executable = await browserPath();
  session = execFileSync('npx', ['agent-browser', 'session', 'id', '--scope', 'worktree', '--prefix', 'stocksense-e2e'], { cwd: root, encoding: 'utf8' }).trim();
  try { cli(['close']); } catch { /* no previous session */ }
  cli(['--executable-path', executable, '--args', '--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--single-process', 'open', base]); browserReady = true;
  cli(['wait', '--text', 'Dashboard overview']);
  assert(cli(['get', 'text', 'h1']).includes('Dashboard overview'), 'Dashboard heading missing');
  cli(['wait', '--text', 'Top 5 priority interventions']);
  cli(['find', 'role', 'button', 'click', '--name', 'My facility']);
  cli(['wait', '--text', 'My facility']);
  cli(['wait', '--text', 'Request support']);
  cli(['find', 'role', 'button', 'click', '--name', 'District']);
  cli(['wait', '--text', 'Predictive stockout-risk table']);
  cli(['find', 'role', 'button', 'click', '--name', 'Partners']);
  cli(['wait', '--text', 'Cross-country risk & financing overview']);
  cli(['find', 'role', 'button', 'click', '--name', 'Leadership']);
  cli(['wait', '--text', 'Top 5 priority interventions']);

  cli(['find', 'role', 'link', 'click', '--name', 'Stockout risk']);
  cli(['wait', '--text', 'Risk register']);
  cli(['find', 'label', 'Search facilities or medicines', 'fill', 'Northgate']);
  cli(['wait', '--fn', 'document.querySelectorAll(".risk-table tbody tr").length > 0']);
  assert(cli(['get', 'text', '.risk-table']).includes('Northgate'), 'Risk search did not filter');
  cli(['focus', 'input[aria-label="Search facilities or medicines"]']);
  cli(['press', 'Control+a']); cli(['press', 'Backspace']);
  cli(['select', 'select[aria-label="Filter by district"]', 'central']);
  cli(['wait', '--fn', 'document.querySelectorAll(".risk-table tbody tr").length > 0']);
  cli(['click', '.risk-table tbody tr:first-child button[aria-label^="Inspect"]']);
  cli(['wait', '--text', 'Why this label?']);
  cli(['press', 'Escape']);

  cli(['find', 'role', 'link', 'click', '--name', 'Scenario planner']);
  cli(['wait', '--text', 'Recommended actions']);
  cli(['find', 'label', 'Budget ceiling in US dollars', 'fill', '10000']);
  cli(['find', 'role', 'button', 'click', '--name', 'Run scenario']);
  cli(['wait', '--fn', '!document.body.innerText.includes("Evaluating options…")']);
  cli(['wait', '--text', 'Estimated cost']);
  cli(['find', 'role', 'button', 'click', '--name', 'Save plan']);
  cli(['wait', '--text', 'Save this demo plan']);
  cli(['find', 'label', 'Plan name', 'fill', `Browser smoke plan ${Date.now()}`]);
  cli(['find', 'role', 'button', 'click', '--name', 'Save demo plan']);
  cli(['wait', '--url', '**/funding?plan=*']);
  cli(['wait', '--text', 'Review & approve']);
  cli(['find', 'role', 'button', 'click', '--name', 'Review & approve']);
  cli(['wait', '--text', 'Approve this demonstration plan?']);
  cli(['find', 'role', 'button', 'click', '--name', 'Approve demo plan']);
  cli(['wait', '--text', 'Human approval recorded']);
  cli(['click', '.data-table tbody tr:first-child button']);
  cli(['wait', '--text', 'Simulate cash release']);
  cli(['click', '.data-table tbody tr:first-child button']);
  cli(['wait', '--text', 'Mark received']);
  cli(['click', '.data-table tbody tr:first-child button']);
  cli(['wait', '--text', 'Complete in demo']);
  cli(['scrollintoview', '.audit-timeline']);
  cli(['wait', '--fn', 'document.querySelector(".audit-timeline")?.textContent.includes("item received")']);

  cli(['find', 'role', 'link', 'click', '--name', 'Data & evidence']);
  cli(['wait', '--text', 'Evidence assistant']);
  cli(['find', 'role', 'button', 'click', '--name', 'Is an LLM connected?']);
  cli(['wait', '--text', 'No LLM is connected']);
  cli(['find', 'role', 'link', 'click', '--name', 'Methodology']);
  cli(['wait', '--text', 'Methodology & boundaries']);

  cli(['set', 'viewport', '390', '844']);
  cli(['open', base]);
  cli(['wait', '--text', 'Dashboard overview']);
  const noOverflow = cli(['eval', 'document.documentElement.scrollWidth <= window.innerWidth + 1']);
  assert(noOverflow.includes('true'), 'Mobile page has horizontal overflow');
  cli(['find', 'role', 'button', 'click', '--name', 'Open navigation']);
  cli(['wait', '--text', 'Built for responsible use']);
  const consoleOutput = cli(['console']);
  assert(!consoleOutput.includes('[error]'), `Browser console errors: ${consoleOutput}`);
  console.log('PASS browser smoke: dashboard role views, risk filters/detail, scenario, save/approve, funding trace, evidence assistant, methodology, mobile navigation, console.');
}
main().catch((error) => { console.error('FAIL browser smoke:', error.message); process.exitCode = 1; }).finally(async () => {
  if (browserReady) try { cli(['close']); } catch { /* cleanup */ }
  if (server) { server.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 500)); if (server.exitCode === null) server.kill('SIGKILL'); }
  for (const suffix of ['', '-wal', '-shm']) { try { rmSync(dbPath + suffix, { force: true }); } catch { /* cleanup */ } }
});
