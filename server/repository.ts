import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AuditEvent, ItemStatus, ScenarioInput, ScenarioResult, StoredPlan, StoredPlanItem } from '../shared/types';

export class NotFoundError extends Error { constructor(message = 'Resource not found') { super(message); this.name = 'NotFoundError'; } }
export class ConflictError extends Error { constructor(message: string) { super(message); this.name = 'ConflictError'; } }
interface PlanRow { id: string; name: string; status: 'draft' | 'approved'; scenario_json: string; result_json: string; created_at: string; updated_at: string }
interface ItemRow { id: string; status: ItemStatus; payload_json: string }
interface AuditRow { id: string; plan_id: string; item_id: string | null; action: string; from_status: string; to_status: string; actor: string; note: string; created_at: string }
const NEXT_STATUS: Record<string, ItemStatus> = { approved: 'procurement_requested', procurement_requested: 'funds_released', funds_released: 'received' };

export class PlanRepository {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','approved')),
        scenario_json TEXT NOT NULL, result_json TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS plan_items (
        plan_id TEXT NOT NULL REFERENCES plans(id), id TEXT NOT NULL, position INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('proposed','approved','procurement_requested','funds_released','received')),
        payload_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(plan_id,id)
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id), item_id TEXT,
        action TEXT NOT NULL, from_status TEXT NOT NULL, to_status TEXT NOT NULL,
        actor TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS audit_plan_idx ON audit_events(plan_id, created_at);
      INSERT INTO schema_meta(version) SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM schema_meta);
    `);
  }
  close() { this.db.close(); }
  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private audit(planId: string, itemId: string | null, action: string, fromStatus: string, toStatus: string, note: string, createdAt: string) {
    this.db.prepare('INSERT INTO audit_events(id,plan_id,item_id,action,from_status,to_status,actor,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(randomUUID(), planId, itemId, action, fromStatus, toStatus, 'Demo analyst', note, createdAt);
  }
  getPlan(id: string): StoredPlan | null {
    const row = this.db.prepare('SELECT * FROM plans WHERE id=?').get(id) as PlanRow | undefined;
    if (!row) return null;
    const items = (this.db.prepare('SELECT * FROM plan_items WHERE plan_id=? ORDER BY position').all(id) as unknown as ItemRow[])
      .map((item) => ({ ...JSON.parse(item.payload_json), status: item.status }) as StoredPlanItem);
    const audit = (this.db.prepare('SELECT * FROM audit_events WHERE plan_id=? ORDER BY rowid').all(id) as unknown as AuditRow[])
      .map((event): AuditEvent => ({ id: event.id, planId: event.plan_id, itemId: event.item_id, action: event.action, fromStatus: event.from_status, toStatus: event.to_status, actor: event.actor, note: event.note, createdAt: event.created_at }));
    return { id: row.id, name: row.name, status: row.status, scenario: JSON.parse(row.scenario_json) as ScenarioInput, result: JSON.parse(row.result_json) as ScenarioResult, items, audit, createdAt: row.created_at, updatedAt: row.updated_at };
  }
  listPlans(): StoredPlan[] {
    const rows = this.db.prepare('SELECT id FROM plans ORDER BY created_at DESC, rowid DESC LIMIT 100').all() as { id: string }[];
    return rows.map((row) => this.getPlan(row.id)!).filter(Boolean);
  }
  createPlan(name: string, scenario: ScenarioInput, result: ScenarioResult, idempotencyKey: string): StoredPlan {
    const existing = this.db.prepare('SELECT id FROM plans WHERE idempotency_key=?').get(idempotencyKey) as { id: string } | undefined;
    if (existing) return this.getPlan(existing.id)!;
    return this.transaction(() => {
      const id = randomUUID(); const now = new Date().toISOString();
      this.db.prepare('INSERT INTO plans(id,name,status,scenario_json,result_json,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(id, name, 'draft', JSON.stringify(scenario), JSON.stringify(result), idempotencyKey, now, now);
      const insert = this.db.prepare('INSERT INTO plan_items(plan_id,id,position,status,payload_json,updated_at) VALUES(?,?,?,?,?,?)');
      result.selected.forEach((item, position) => insert.run(id, item.id, position, 'proposed', JSON.stringify(item), now));
      this.audit(id, null, 'plan_created', '', 'draft', 'Saved from a server-recomputed synthetic scenario.', now);
      return this.getPlan(id)!;
    });
  }
  approvePlan(id: string, note: string): StoredPlan {
    return this.transaction(() => {
      const plan = this.getPlan(id); if (!plan) throw new NotFoundError('Plan not found');
      if (plan.status !== 'draft') throw new ConflictError('Only a draft plan can be approved');
      const now = new Date().toISOString();
      this.db.prepare('UPDATE plans SET status=?,updated_at=? WHERE id=?').run('approved', now, id);
      this.db.prepare("UPDATE plan_items SET status='approved',updated_at=? WHERE plan_id=? AND status='proposed'").run(now, id);
      this.audit(id, null, 'plan_approved', 'draft', 'approved', note || 'Explicit demonstration-only approval.', now);
      for (const item of plan.items) this.audit(id, item.id, 'item_approved', 'proposed', 'approved', note || 'Included in approved demo plan.', now);
      return this.getPlan(id)!;
    });
  }
  advanceItem(planId: string, itemId: string, expectedStatus: string, note: string): StoredPlan {
    return this.transaction(() => {
      const plan = this.getPlan(planId); if (!plan) throw new NotFoundError('Plan not found');
      if (plan.status !== 'approved') throw new ConflictError('Approve the plan before advancing items');
      const item = plan.items.find((x) => x.id === itemId); if (!item) throw new NotFoundError('Plan item not found');
      if (item.status !== expectedStatus) throw new ConflictError('Item status changed; refresh before advancing');
      const next = NEXT_STATUS[item.status]; if (!next) throw new ConflictError('Item is already received or not advanceable');
      const now = new Date().toISOString();
      this.db.prepare('UPDATE plan_items SET status=?,updated_at=? WHERE plan_id=? AND id=?').run(next, now, planId, itemId);
      this.db.prepare('UPDATE plans SET updated_at=? WHERE id=?').run(now, planId);
      this.audit(planId, itemId, `item_${next}`, item.status, next, note || `Simulated transition to ${next.replaceAll('_', ' ')}. No external action was taken.`, now);
      return this.getPlan(planId)!;
    });
  }
}
