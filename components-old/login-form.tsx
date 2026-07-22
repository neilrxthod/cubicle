"use client"

import { useActionState } from "react"
import { signInAction } from "@/lib/actions"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, null as { error?: string } | null)

  return (
    <section
      aria-label="Sign in"
      className="flex h-full min-h-0 items-center justify-center border-l border-black/10 bg-zinc-50 px-5 py-6 sm:px-8 sm:py-8 lg:px-10"
    >
      <div className="w-full max-w-md">
        <div className="mb-7 lg:hidden">
          <span className="font-serif text-[1.15rem] font-medium tracking-[-0.03em] text-foreground">Air Kart</span>
        </div>

        <h1 className="font-sans text-[clamp(2.2rem,6vw,3.2rem)] font-semibold leading-[1.1] tracking-[-0.01em] text-foreground">
          Sign in
        </h1>

        <form action={formAction} className="mt-8 space-y-5">
          <div className="space-y-2.5">
            <label htmlFor="email" className="block text-[0.95rem] font-semibold tracking-[0.005em] text-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="your@email.com"
              className="w-full border-b border-black/20 bg-transparent px-0 py-3 text-[1.02rem] font-normal tracking-[-0.01em] text-foreground placeholder:text-foreground/30 outline-none transition hover:border-black/40 focus:border-black/60"
            />
          </div>

          <div className="space-y-2.5">
            <label htmlFor="password" className="block text-[0.95rem] font-semibold tracking-[0.005em] text-foreground">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full border-b border-black/20 bg-transparent px-0 py-3 text-[1.02rem] font-normal tracking-[-0.01em] text-foreground placeholder:text-foreground/30 outline-none transition hover:border-black/40 focus:border-black/60"
            />
          </div>

          {state?.error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[0.84rem] text-destructive">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-8 w-full rounded-lg bg-foreground py-3.5 text-[0.9rem] font-bold tracking-[0.02em] text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-8 text-center text-[0.85rem] leading-relaxed tracking-[0.005em] text-foreground/60">
          Use the credentials your school admin generated for you.
        </p>
      </div>
    </section>
  )
}
