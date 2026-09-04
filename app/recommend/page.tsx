import { auth, signIn } from "@/lib/auth";
import { RecommendForm } from "@/components/RecommendForm";

export default async function RecommendPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10 sm:py-20">
        <div className="w-full max-w-md border-2 border-ink">
          <div className="h-2.5 bg-link" aria-hidden="true" />
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:px-10">
            <h1 className="text-3xl tracking-tight sm:text-4xl">Recommend a work</h1>
            <p className="font-serif text-base leading-relaxed text-ink-soft">
              Sign in first — recommendations need an account so a reviewer can follow up with you
              if they have a question.
            </p>
            <form
              action={async () => {
                "use server";
                await signIn("google");
              }}
            >
              <button
                type="submit"
                className="rounded-full border border-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                Sign in with Google
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6 py-16 sm:px-10 sm:py-20">
      <RecommendForm />
    </main>
  );
}
