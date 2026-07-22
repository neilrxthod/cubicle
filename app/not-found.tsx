import Link from "next/link";
import { CubicleWordmark } from "@/components/auth/wordmark";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[#f6f6f7] px-6">
      <CubicleWordmark size="md" href="/login" />
      <h1 className="mt-10 text-[1.5rem] font-semibold tracking-[-0.03em] text-neutral-950">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-center text-[14px] text-neutral-500">
        That link doesn&apos;t exist or you don&apos;t have access.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-full bg-neutral-950 px-4 text-[13px] font-medium text-white"
        >
          Home
        </Link>
        <Link
          href="/login"
          className="inline-flex h-10 items-center rounded-full border border-neutral-200 bg-white px-4 text-[13px] font-medium text-neutral-800"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
