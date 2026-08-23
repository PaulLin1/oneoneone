import { Pool } from "@neondatabase/serverless";

// Separate from lib/db.ts's neon() HTTP client on purpose: @auth/neon-adapter
// is written against node-postgres's Pool.query() interface, not the
// tagged-template HTTP client the rest of the app uses for one-off
// queries. Both point at the same DATABASE_URL; they're just two different
// client shapes over the same connection string.
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
 * NeonAdapter(pool) is called once, synchronously, at module load —
 * `lib/auth.ts` is imported by the Masthead, which is in the root layout,
 * so this runs for every route in the app, including at `next build` time
 * for route analysis. A real `new Pool()` there would need DATABASE_URL
 * just to *build*, breaking the guarantee documented in README's "Deploy
 * to Vercel" section. This Proxy defers actually touching the env var (and
 * constructing the real Pool) until the adapter first calls `.query(...)`
 * on it — which only happens inside a request, never at build time.
 */
export function getAuthPool(): Pool {
  return new Proxy({} as Pool, {
    get(_target, prop) {
      const target = realPool();
      const value = Reflect.get(target, prop, target);
      // Bind methods to the real Pool, not the Proxy — Pool.query() relies
      // on internal state reachable only through `this` being the actual
      // instance, which a bare Proxy receiver isn't.
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
