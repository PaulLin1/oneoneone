import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import NeonAdapter from "@auth/neon-adapter";
import { getAuthPool } from "@/lib/auth-db";

/**
 * Database sessions (not JWT): the adapter already gives us a `sessions`
 * table, and database sessions can be revoked server-side (delete the row)
 * — a JWT can't be un-issued before it expires. Only reachable from
 * server-rendered routes/route handlers, never middleware/edge — the Neon
 * Pool here is websocket-based and needs the Node runtime, and this app
 * has no middleware today, so that split was never a real constraint.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: NeonAdapter(getAuthPool()),
  providers: [Google],
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      return session;
    },
  },
});
