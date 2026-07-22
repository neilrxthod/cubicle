import Image from "next/image"

export function LoginHero() {
  return (
    <section
      aria-label="Air Kart"
      className="relative hidden h-full min-h-0 overflow-hidden border-r border-black/10 bg-[#0f0f0f] lg:flex lg:flex-col"
    >
      <Image
        src="/images/school-hallway.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 1536px) 54vw, (min-width: 1024px) 50vw, 100vw"
        className="object-cover saturate-[0.8]"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(120deg,rgba(10,10,10,0.82)_12%,rgba(10,10,10,0.38)_52%,rgba(10,10,10,0.84)_100%)]"
      />

      <div className="relative z-10 flex h-full min-h-0 flex-col p-8 xl:p-10 2xl:p-12">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium tracking-tight text-white">Air Kart</span>
          <a
            href="https://www.instagram.com/neil.rxthod/"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/30 px-3 py-1 text-[0.62rem] font-semibold tracking-[0.06em] text-white/85 transition hover:bg-white/10"
          >
            Made by Neil Rathod
          </a>
        </div>

        <div className="mt-auto max-w-lg">
          <h2 className="mt-4 font-serif text-[clamp(2.7rem,4.6vw,5.1rem)] leading-[0.94] tracking-tight text-white">
            Book a cart.
            <br />
            Report a problem.
          </h2>
        </div>
      </div>
    </section>
  )
}
