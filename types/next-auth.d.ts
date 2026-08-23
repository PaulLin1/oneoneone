import type { DefaultSession } from "next-auth";

// `role` isn't part of Auth.js's built-in User/Session shape — it's our
// own column on `users` (see db/migrations/0005_accounts.sql), surfaced
// through the session() callback in lib/auth.ts.
declare module "next-auth" {
  interface User {
    role: "reader" | "reviewer" | "admin";
  }

  interface Session {
    user: {
      id: string;
      role: "reader" | "reviewer" | "admin";
    } & DefaultSession["user"];
  }
}
