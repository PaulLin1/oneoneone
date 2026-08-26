import { signOut } from "@/lib/auth";

export function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
    >
      <button
        type="submit"
        className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-soft underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink"
      >
        Sign out
      </button>
    </form>
  );
}
