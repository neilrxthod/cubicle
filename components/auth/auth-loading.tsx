export function AuthLoadingSkeleton() {
  return (
    <div className="flex min-h-dvh w-full min-w-0 bg-white">
      <div className="relative flex w-full min-w-0 flex-col lg:w-[46%] xl:w-[42%]">
        <div className="flex flex-1 flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-12 xl:px-16">
          <div className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
          <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-14">
            <div className="mb-8 space-y-2">
              <div className="h-7 w-28 animate-pulse rounded-md bg-neutral-100" />
              <div className="h-4 w-52 animate-pulse rounded bg-neutral-50" />
            </div>
            <div className="space-y-3">
              <div className="h-12 animate-pulse rounded-xl bg-neutral-50" />
              <div className="h-12 animate-pulse rounded-xl bg-neutral-100" />
            </div>
            <div className="mx-auto mt-8 h-3.5 w-40 animate-pulse rounded bg-neutral-50" />
          </div>
          <div className="h-3 w-20 animate-pulse rounded bg-neutral-50" />
        </div>
      </div>
      <div className="hidden min-w-0 flex-1 p-3 pl-0 lg:block">
        <div className="h-full min-h-[calc(100dvh-1.5rem)] animate-pulse rounded-[1.75rem] bg-neutral-100" />
      </div>
    </div>
  );
}
