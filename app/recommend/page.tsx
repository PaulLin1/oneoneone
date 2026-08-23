import { auth, signIn } from "@/lib/auth";
import { RecommendForm } from "@/components/RecommendForm";

export default async function RecommendPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center sm:px-10 sm:py-20">
        <h1 className="text-3xl tracking-tight sm:text-4xl">Recommend a work</h1>
        <p className="max-w-md font-serif text-base leading-relaxed text-ink-soft">
          Sign in first — recommendations need an account so a reviewer can follow up with you if
          they have a question.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button
            type="submit"
            className="bg-yellow px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-80"
          >
            Sign in with Google
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-6 py-16 sm:px-10 sm:py-20">
      <RecommendForm />
    </main>
  );
}
