import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { withTransaction } from "@/lib/dbTransaction";
import type { PoolClient } from "@neondatabase/serverless";

/**
 * A fake PoolClient — just structured enough for withTransaction's own
 * control flow (it only ever calls .query() and .release()) — so these
 * tests exercise the begin/commit/rollback/release sequence itself without
 * a real database connection.
 */
function fakeClient() {
  const calls: string[] = [];
  const query = mock.fn(async (text: string) => {
    calls.push(text);
    return { rows: [] };
  });
  const release = mock.fn(() => {});
  const client = { query, release } as unknown as PoolClient;
  return { calls, query, release, client };
}

test("withTransaction: begins, runs fn, commits, and releases on success", async () => {
  const { calls, release, client } = fakeClient();

  const result = await withTransaction(
    async (c) => {
      await c.query("select 1", []);
      return "ok";
    },
    async () => client
  );

  assert.equal(result, "ok");
  assert.deepEqual(calls, ["begin", "select 1", "commit"]);
  assert.equal(release.mock.callCount(), 1);
});

test("withTransaction: rolls back, releases, and rethrows on failure", async () => {
  const { calls, release, client } = fakeClient();

  await assert.rejects(
    () =>
      withTransaction(
        async () => {
          throw new Error("boom");
        },
        async () => client
      ),
    /boom/
  );

  assert.deepEqual(calls, ["begin", "rollback"]);
  assert.equal(release.mock.callCount(), 1);
});
