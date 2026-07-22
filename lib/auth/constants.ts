export const AUTH_IMAGE =
  "https://assets.watermelon.sh/auth-7.avif";

export const AUTH_ROUTES = {
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
} as const;

export const authFieldClassName =
  "w-full h-12 rounded-xl border border-black/[0.08] bg-[#fafafa] px-4 text-[15px] tracking-[-0.011em] text-neutral-900 placeholder:text-neutral-400 outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:bg-white hover:border-black/[0.12] focus:bg-white focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/[0.08]";

export const authPrimaryButtonClassName =
  "inline-flex h-12 w-full items-center justify-center rounded-xl bg-neutral-950 px-6 text-[15px] font-medium tracking-[-0.011em] text-white transition-[background-color,transform,opacity] duration-150 hover:bg-neutral-800 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50";

export const authSecondaryButtonClassName =
  "inline-flex h-12 w-full items-center justify-center rounded-xl border border-black/[0.08] bg-white px-6 text-[15px] font-medium tracking-[-0.011em] text-neutral-800 transition-[background-color,border-color,transform,opacity] duration-150 hover:bg-neutral-50 hover:border-black/[0.12] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50";

/** Optional surface — most auth pages use open layout; keep for denser forms */
export const authCardClassName =
  "rounded-2xl border border-black/[0.06] bg-white p-7 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]";
