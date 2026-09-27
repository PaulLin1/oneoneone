import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * JWT sessions — there's no database, so the session lives entirely in a
 * signed cookie and nothing about the user is stored server-side.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
});
