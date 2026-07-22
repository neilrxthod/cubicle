import Image from "next/image";
import { cn } from "@/lib/utils";
import { AUTH_IMAGE } from "@/lib/auth/constants";
import { CubicleWordmark } from "./wordmark";

type AuthLayoutProps = {
  children: React.ReactNode;
  className?: string;
};

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Form column */}
      <div className="relative flex w-full flex-col lg:w-[46%] xl:w-[44%]">
        <div className="flex flex-1 flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-12 xl:px-16">
          <header className="shrink-0">
            <CubicleWordmark size="md" />
          </header>

          <div
            className={cn(
              "mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-14 sm:py-16",
              className,
            )}
          >
            {children}
          </div>

          <footer className="shrink-0 text-[12px] text-neutral-400">
            © {new Date().getFullYear()} Cubicle
          </footer>
        </div>
      </div>

      {/* Brand panel — inset media frame */}
      <div className="hidden p-3 pl-0 lg:block lg:w-[54%] xl:w-[56%]">
        <aside className="relative h-full min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[1.75rem] bg-neutral-200">
          <Image
            src={AUTH_IMAGE}
            alt=""
            fill
            priority
            className="object-cover object-center"
            sizes="(min-width: 1024px) 56vw, 0px"
          />

          {/* Soft grade so the wordmark stays legible */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,transparent_35%,rgba(0,0,0,0.45)_100%)]"
          />

          {/* Subtle top highlight */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/15 to-transparent"
          />

          {/* Wordmark badge */}
          <div className="absolute bottom-7 left-7 right-7 flex items-end justify-between gap-4">
          </div>
        </aside>
      </div>
    </div>
  );
}
