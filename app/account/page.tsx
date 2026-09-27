import { auth, signIn } from "@/lib/auth";
import { SignOutForm } from "@/components/SignOutForm";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10 sm:py-20">
        <div className="flex w-full max-w-md flex-col items-center gap-4 py-10 text-center">
          <div>
            <h1 className="text-4xl tracking-tight sm:text-5xl">Account</h1>
            <div className="mx-auto mt-3 h-1.5 w-16 bg-link" aria-hidden="true" />
          </div>
          <p className="font-serif text-base leading-relaxed text-ink-soft">
            Entirely optional — the daily three and Archive work exactly the same without one.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button
              type="submit"
              className="px-1 text-xs font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:underline"
            >
              Sign in with Google
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden px-6 py-6 sm:px-10 sm:py-8">
      <div className="mb-6 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl tracking-tight sm:text-5xl">Account</h1>
          <div className="mt-3 h-1.5 w-16 bg-link" aria-hidden="true" />
          {session.user.name && <p className="mt-3 text-sm">{session.user.name}</p>}
          <p className="mt-1 text-sm text-ink-soft">{session.user.email}</p>
        </div>
        <SignOutForm />
      </div>
    </main>
  );
}
