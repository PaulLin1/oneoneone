import { Pool, neonConfig, type PoolClient } from "@neondatabase/serverless";
import ws from "ws";

// Node has no global WebSocket (unlike edge runtimes, where @neondatabase/
// serverless's Pool can use one natively) — without this, Pool's WebSocket
// handshake silently falls through to a fetch-based upgrade attempt that
// only works on edge/Workers runtimes, and fails here with "fetch failed".
neonConfig.webSocketConstructor = ws;

// Separate connection from lib/db.ts's neon() HTTP client and lib/auth-db.ts's
// pool, for the same reason lib/auth-db.ts's is separate from lib/db.ts's:
// each client shape serves a different need over the same DATABASE_URL.
let pool: Pool | null = null;

function realPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable.");
  }
  pool = new Pool({ connectionString: url });
  return pool;
}

/**
 * Runs `fn` inside a real BEGIN/COMMIT transaction on one dedicated
 * connection — for the rare write that's genuinely multi-statement and
 * dependent (one insert's generated id feeding the next insert), where
 * lib/db.ts's stateless HTTP client can't help: its own .transaction() mode
 * submits a batch of independent queries, it can't use one query's result
 * to build the next. Rolls back and rethrows on any failure, so a crash
 * mid-sequence can't leave a half-written row behind.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  // Overridable only for tests (test/dbTransaction.test.ts), which exercise
  // the begin/commit/rollback/release sequence itself against a fake client
  // rather than a real database connection.
  connect: () => Promise<PoolClient> = () => realPool().connect()
): Promise<T> {
  const client = await connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
