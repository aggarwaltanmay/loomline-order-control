import { Pool } from "pg";
import { newDb } from "pg-mem";

declare global {
  // Reuse a small pool across warm Vercel functions and Next dev reloads.
  var loomlinePool: Pool | undefined;
  var loomlineSchema: Promise<void> | undefined;
}

function pool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!globalThis.loomlinePool) {
    if (process.env.DATABASE_URL === "memory:") {
      const memory = newDb();
      const adapter = memory.adapters.createPg();
      globalThis.loomlinePool = new adapter.Pool() as unknown as Pool;
    } else {
      globalThis.loomlinePool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 2,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 5000,
      });
    }
  }
  return globalThis.loomlinePool;
}

const schema = [
  `CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, role TEXT NOT NULL, buyer_id TEXT, unit_id TEXT, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_email TEXT NOT NULL, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, po TEXT NOT NULL UNIQUE, buyer_id TEXT NOT NULL, buyer_name TEXT NOT NULL, style TEXT NOT NULL, color TEXT NOT NULL, sizes_json TEXT NOT NULL, qty INTEGER NOT NULL, ex_factory TEXT NOT NULL, unit_id TEXT NOT NULL, stage TEXT NOT NULL, stage_done INTEGER NOT NULL DEFAULT 0, baseline_daily INTEGER NOT NULL DEFAULT 0, buyer_warning_confirmed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS milestones (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), name TEXT NOT NULL, due_date TEXT NOT NULL, sequence INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS updates (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), stage TEXT NOT NULL, daily_qty INTEGER NOT NULL, update_date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', english_summary TEXT, category TEXT, confidence TEXT, photo_key TEXT, photo_data TEXT, actor_email TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS date_changes (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), field TEXT NOT NULL, old_date TEXT NOT NULL, new_date TEXT NOT NULL, reason TEXT NOT NULL, actor_email TEXT NOT NULL, changed_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS updates_order_stage_date ON updates(order_id, stage, update_date)`,
  `CREATE INDEX IF NOT EXISTS orders_buyer ON orders(buyer_id)`,
  `CREATE INDEX IF NOT EXISTS orders_unit ON orders(unit_id)`,
];

async function ensureSchema() {
  if (!globalThis.loomlineSchema) {
    globalThis.loomlineSchema = (async () => {
      for (const statement of schema) await pool().query(statement);
    })().catch((error) => {
      globalThis.loomlineSchema = undefined;
      throw error;
    });
  }
  await globalThis.loomlineSchema;
}

function convertSql(source: string) {
  let index = 0;
  const numbered = source.replace(/\?/g, () => `$${++index}`);
  if (/^INSERT OR IGNORE INTO /i.test(numbered)) {
    return numbered.replace(/^INSERT OR IGNORE INTO /i, "INSERT INTO ") + " ON CONFLICT DO NOTHING";
  }
  return numbered;
}

export function db() {
  return {
    prepare(source: string) {
      const sql = convertSql(source);
      return {
        bind(...values: unknown[]) {
          const query = async () => {
            await ensureSchema();
            return pool().query(sql, values);
          };
          return {
            async run() {
              const result = await query();
              return { meta: { changes: result.rowCount ?? 0 } };
            },
            async first<T>() {
              const result = await query();
              return (result.rows[0] as T | undefined) ?? null;
            },
            async all<T>() {
              const result = await query();
              return { results: result.rows as T[] };
            },
          };
        },
        async first<T>() {
          await ensureSchema();
          const result = await pool().query(sql);
          return (result.rows[0] as T | undefined) ?? null;
        },
      };
    },
  };
}
