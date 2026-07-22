function BookingsTable({ bookings, carts }: { bookings: Booking[]; carts: Cart[] }) {
  const cartMap = useMemo(() => new Map(carts.map((c) => [c.id, c])), [carts])
  const [view, setView] = useState<"list" | "board">("list")
  const [query, setQuery] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [rangeFilter, setRangeFilter] = useState<DateRange | undefined>()
  const [teacherFilter, setTeacherFilter] = useState("")
  const [cartFilter, setCartFilter] = useState("")
  const [periodFilter, setPeriodFilter] = useState("")
  const [showConflicts, setShowConflicts] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reassigningBooking, setReassigningBooking] = useState<Booking | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReassigning, setIsReassigning] = useState(false)

  const filterSignature = [
    query,
    dateFilter,
    rangeFilter?.from?.toISOString() ?? "",
    rangeFilter?.to?.toISOString() ?? "",
    teacherFilter,
    cartFilter,
    periodFilter,
    String(showConflicts),
  ].join("|")
  const [selectionFilter, setSelectionFilter] = useState(filterSignature)
  if (selectionFilter !== filterSignature) {
    setSelectionFilter(filterSignature)
    setSelectedIds(new Set())
  }

  const sorted = useMemo(() => {
    const s = [...bookings]
    if (sortConfig !== null) {
      const { key, direction } = sortConfig
      s.sort((a, b) => {
        let valA: string | number = ""
        let valB: string | number = ""
        if (key === "date") {
          valA = a.date
          valB = b.date
        } else if (key === "period") {
          valA = a.period
          valB = b.period
        } else if (key === "cart") {
          valA = cartMap.get(a.cartId)?.name ?? ""
          valB = cartMap.get(b.cartId)?.name ?? ""
        } else if (key === "class") {
          valA = a.className ?? ""
          valB = b.className ?? ""
        } else if (key === "subject") {
          valA = a.subject ?? ""
          valB = b.subject ?? ""
        } else if (key === "teacher") {
          valA = a.teacherName
          valB = b.teacherName
        }
        if (valA < valB) return direction === "asc" ? -1 : 1
        if (valA > valB) return direction === "asc" ? 1 : -1
        return 0
      })
      return s
    }
    return s.sort((a, b) =>
      a.date === b.date ? a.period.localeCompare(b.period) : b.date.localeCompare(a.date),
    )
  }, [bookings, sortConfig, cartMap])

  const teachers = useMemo(
    () => [...new Set(bookings.map((b) => b.teacherName))].sort(),
    [bookings],
  )
  const cartNames = useMemo(() => [...new Set(carts.map((c) => c.name))].sort(), [carts])
  const periods = useMemo(() => ["P1", "P2", "P3", "P4", "P5"] as Period[], [])

  const q = query.toLowerCase().trim()
  const filtered = useMemo(
    () =>
      sorted.filter((b) => {
        if (showConflicts) {
          const cart = cartMap.get(b.cartId)
          if (!(cart && cart.status === "maintenance")) return false
        }
        const bDate = parseISO(b.date)
        if (rangeFilter?.from) {
          if (
            !isWithinInterval(bDate, {
              start: startOfDay(rangeFilter.from),
              end: endOfDay(rangeFilter.to || rangeFilter.from),
            })
          ) {
            return false
          }
        } else if (dateFilter && b.date !== dateFilter) {
          return false
        }
        if (teacherFilter && b.teacherName !== teacherFilter) return false
        if (cartFilter && (cartMap.get(b.cartId)?.name ?? "") !== cartFilter) return false
        if (periodFilter && b.period !== periodFilter) return false
        if (q) {
          const searchable = [
            format(bDate, "MMM d"),
            format(bDate, "EEE"),
            b.period,
            cartMap.get(b.cartId)?.name ?? "",
            b.teacherName,
            b.className ?? "",
            b.subject ?? "",
          ]
            .join(" ")
            .toLowerCase()
          if (!searchable.includes(q)) return false
        }
        return true
      }),
    [sorted, showConflicts, cartMap, rangeFilter, dateFilter, teacherFilter, cartFilter, periodFilter, q],
  )

  const hasFilters = Boolean(
    q || dateFilter || rangeFilter || teacherFilter || cartFilter || periodFilter || showConflicts,
  )
  const todayKey = format(new Date(), "yyyy-MM-dd")
  const tomorrowKey = format(addDays(new Date(), 1), "yyyy-MM-dd")
  const weekEndKey = format(addDays(new Date(), 6), "yyyy-MM-dd")

  function clearFilters() {
    setQuery("")
    setDateFilter("")
    setRangeFilter(undefined)
    setTeacherFilter("")
    setCartFilter("")
    setPeriodFilter("")
    setSortConfig(null)
    setShowConflicts(false)
    setSelectedIds(new Set())
  }

  function handleSort(key: string) {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  function handleExportCSV() {
    const headers = ["Date", "Day", "Period", "Cart", "Class", "Subject", "Teacher"]
    const rows = filtered.map((b) => {
      const date = parseISO(b.date)
      return [
        format(date, "MMM d, yyyy"),
        format(date, "EEEE"),
        b.period,
        cartMap.get(b.cartId)?.name ?? "—",
        b.className ?? "",
        b.subject ?? "",
        b.teacherName,
      ]
        .map((val) => `"${String(val).replaceAll('"', '""')}"`)
        .join(",")
    })
    const csvContent = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `bookings-export-${format(new Date(), "yyyy-MM-dd")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Export complete", description: "CSV file has been downloaded." })
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return
    setIsDeleting(true)
    try {
      const res = await deleteBookings(Array.from(selectedIds))
      if (!res.ok) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
      } else {
        toast({
          title: "Bookings deleted",
          description: `Removed ${selectedIds.size} reservation${selectedIds.size === 1 ? "" : "s"}.`,
        })
        setSelectedIds(new Set())
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const conflictsCount = bookings.filter((b) => cartMap.get(b.cartId)?.status === "maintenance").length
  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const filterTrigger =
    "h-9 gap-2 rounded-lg border border-border bg-white px-3 text-[13px] font-medium text-foreground shadow-none hover:bg-neutral-50 focus:ring-0 data-[state=open]:border-neutral-400 data-[placeholder]:text-muted-foreground"

  const dateLabel = rangeFilter?.from
    ? rangeFilter.to
      ? `${format(rangeFilter.from, "MMM d")} – ${format(rangeFilter.to, "MMM d")}`
      : format(rangeFilter.from, "MMM d, yyyy")
    : dateFilter
      ? format(parseISO(dateFilter), "MMM d, yyyy")
      : "Date"

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teacher, cart, class…"
                className="h-9 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(filterTrigger, "inline-flex min-w-[132px] items-center justify-between")}
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className={cn(!(dateFilter || rangeFilter) && "text-muted-foreground")}>
                      {dateLabel}
                    </span>
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-xl border-border p-0 shadow-lg" align="start">
                <Calendar
                  mode="range"
                  selected={rangeFilter}
                  onSelect={(r) => {
                    setRangeFilter(r)
                    setDateFilter("")
                  }}
                />
              </PopoverContent>
            </Popover>

            <Select
              value={teacherFilter || "all"}
              onValueChange={(v) => setTeacherFilter(v === "all" ? "" : (v ?? ""))}
            >
              <SelectTrigger className={cn(filterTrigger, "w-auto min-w-[130px]")}>
                <SelectValue placeholder="Teacher" />
              </SelectTrigger>
              <SelectContent className="rounded-xl" align="start">
                <SelectItem value="all">All teachers</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={cartFilter || "all"}
              onValueChange={(v) => setCartFilter(v === "all" ? "" : (v ?? ""))}
            >
              <SelectTrigger className={cn(filterTrigger, "w-auto min-w-[120px]")}>
                <SelectValue placeholder="Cart" />
              </SelectTrigger>
              <SelectContent className="rounded-xl" align="start">
                <SelectItem value="all">All carts</SelectItem>
                {cartNames.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={periodFilter || "all"}
              onValueChange={(v) => setPeriodFilter(v === "all" ? "" : (v ?? ""))}
            >
              <SelectTrigger className={cn(filterTrigger, "w-auto min-w-[110px]")}>
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent className="rounded-xl" align="start">
                <SelectItem value="all">All periods</SelectItem>
                {periods.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground"
              >
                <X className="size-3.5" />
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {selectedIds.size > 0 ? (
              <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-900 bg-neutral-950 pl-3 pr-1 text-white">
                <span className="text-[12px] font-medium tabular-nums">{selectedIds.size} selected</span>
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  disabled={isDeleting}
                  className="ml-1 inline-flex h-7 items-center gap-1 rounded-md bg-white/10 px-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:bg-red-500 disabled:opacity-50"
                >
                  <Trash2 className="size-3" />
                  {isDeleting ? "…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="flex size-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Clear selection"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-neutral-50"
              >
                <Download className="size-3.5" />
                Export
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                clearFilters()
                setDateFilter(todayKey)
              }}
              className={cn(
                "h-8 rounded-full px-3 text-[12px] font-medium transition-colors",
                dateFilter === todayKey && !showConflicts && !rangeFilter
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900",
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                clearFilters()
                setDateFilter(tomorrowKey)
              }}
              className={cn(
                "h-8 rounded-full px-3 text-[12px] font-medium transition-colors",
                dateFilter === tomorrowKey && !showConflicts && !rangeFilter
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900",
              )}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => {
                clearFilters()
                setRangeFilter({ from: startOfDay(new Date()), to: endOfDay(addDays(new Date(), 6)) })
              }}
              className={cn(
                "h-8 rounded-full px-3 text-[12px] font-medium transition-colors",
                rangeFilter?.from &&
                  rangeFilter?.to &&
                  format(rangeFilter.from, "yyyy-MM-dd") === todayKey &&
                  format(rangeFilter.to, "yyyy-MM-dd") === weekEndKey
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900",
              )}
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => {
                clearFilters()
                setShowConflicts(true)
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors",
                showConflicts ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100",
              )}
            >
              Conflicts
              {conflictsCount > 0 ? (
                <span
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                    showConflicts ? "bg-white/20 text-white" : "bg-red-600 text-white",
                  )}
                >
                  {conflictsCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {filtered.length}
              <span className="text-neutral-300"> / </span>
              {sorted.length}
            </span>
            <div className="inline-flex h-8 rounded-lg border border-border bg-neutral-50 p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "rounded-md px-3 text-[12px] font-medium transition-colors",
                  view === "list"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                className={cn(
                  "rounded-md px-3 text-[12px] font-medium transition-colors",
                  view === "board"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Grid
              </button>
            </div>
          </div>
        </div>
      </div>

      {view === "list" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/70 bg-neutral-50/80">
                <th className="w-11 px-4 py-3">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedIds(new Set(filtered.map((b) => b.id)))
                      else setSelectedIds(new Set())
                    }}
                    aria-label="Select all"
                  />
                </th>
                <SortableHeader label="Date" sortKey="date" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Period" sortKey="period" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Cart" sortKey="cart" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Class" sortKey="class" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Teacher" sortKey="teacher" sortConfig={sortConfig} onSort={handleSort} />
                <th className="w-12 px-3 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16">
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                        <CalendarIcon className="size-5" />
                      </div>
                      <p className="text-[14px] font-semibold tracking-tight text-foreground">
                        {hasFilters ? "No matching reservations" : "No reservations yet"}
                      </p>
                      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                        {hasFilters
                          ? "Try clearing filters or adjusting the date range."
                          : "When teachers book carts, they will show up here."}
                      </p>
                      {hasFilters ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="mt-4 h-9 rounded-lg bg-neutral-950 px-4 text-[13px] font-medium text-white hover:bg-neutral-800"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const cart = cartMap.get(b.cartId)
                  const date = parseISO(b.date)
                  const isConflict = cart?.status === "maintenance"
                  const selected = selectedIds.has(b.id)

                  return (
                    <tr
                      key={b.id}
                      className={cn(
                        "group border-b border-border/60 transition-colors last:border-b-0",
                        selected
                          ? "bg-neutral-50"
                          : isConflict
                            ? "bg-red-50/40 hover:bg-red-50/70"
                            : "hover:bg-neutral-50/80",
                      )}
                    >
                      <td className="px-4 py-3.5">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedIds)
                            if (checked) next.add(b.id)
                            else next.delete(b.id)
                            setSelectedIds(next)
                          }}
                          aria-label={`Select booking for ${b.teacherName}`}
                        />
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold tracking-tight text-foreground">
                            {format(date, "MMM d, yyyy")}
                          </span>
                          <span className="text-[12px] text-muted-foreground">{format(date, "EEEE")}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex h-6 items-center rounded-md bg-neutral-100 px-2 text-[11px] font-semibold tracking-wide text-neutral-800">
                          {b.period}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-[13px] font-semibold tracking-tight",
                              isConflict ? "text-red-700" : "text-foreground",
                            )}
                          >
                            {cart?.name ?? "—"}
                          </span>
                          {isConflict ? <AlertTriangle className="size-3.5 text-red-600" /> : null}
                        </div>
                        {cart?.location ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{cart.location}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {b.className?.trim() || "—"}
                          </p>
                          {b.subject?.trim() ? (
                            <p className="truncate text-[11px] text-muted-foreground">{b.subject}</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-medium text-foreground">{b.teacherName}</span>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-70 transition-all hover:bg-neutral-100 hover:text-foreground group-hover:opacity-100 data-[state=open]:bg-neutral-100 data-[state=open]:opacity-100"
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Open options</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 shadow-lg">
                            <DropdownMenuItem
                              className="cursor-pointer gap-2 rounded-lg text-[13px]"
                              onClick={() => setReassigningBooking(b)}
                            >
                              <ArrowRightLeft className="size-4 text-muted-foreground" />
                              Reassign cart
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg text-[13px]" asChild>
                              <a
                                href={`mailto:${b.teacherName.toLowerCase().replace(/\s/g, ".")}@school.edu?subject=Regarding your cart booking for ${format(date, "MMM d")}`}
                              >
                                <Mail className="size-4 text-muted-foreground" />
                                Contact teacher
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="mt-0.5 cursor-pointer gap-2 rounded-lg text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `Cancel ${b.teacherName}'s reservation on ${format(date, "MMM d")}?`,
                                  )
                                ) {
                                  return
                                }
                                const res = await cancelBooking(b.id)
                                if (!res.ok) {
                                  toast({ title: "Error", description: res.error, variant: "destructive" })
                                } else {
                                  toast({
                                    title: "Booking canceled",
                                    description: `Reservation for ${b.teacherName} removed.`,
                                  })
                                }
                              }}
                            >
                              <Trash2 className="size-4" />
                              Cancel booking
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-neutral-50/50 p-4 sm:p-5">
          <DailyBoardLite bookings={filtered} carts={carts} />
        </div>
      )}

      <Dialog open={!!reassigningBooking} onOpenChange={(open) => !open && setReassigningBooking(null)}>
        <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl border-border/60 p-0 shadow-2xl sm:max-w-xl">
          <div className="border-b border-border/70 px-6 py-5">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[17px] font-semibold tracking-tight">Reassign cart</DialogTitle>
            </DialogHeader>
            {reassigningBooking ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                {reassigningBooking.teacherName}
                {" · "}
                {format(parseISO(reassigningBooking.date), "MMM d, yyyy")}
                {" · "}
                {reassigningBooking.period}
                {" · currently "}
                <span className="font-medium text-foreground">
                  {cartMap.get(reassigningBooking.cartId)?.name}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Available carts
              {isReassigning ? (
                <span className="ml-2 normal-case tracking-normal text-muted-foreground">Moving…</span>
              ) : null}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {carts
                .filter((c) => c.status === "active" && c.id !== reassigningBooking?.cartId)
                .map((c) => {
                  const hasConflict = bookings.some(
                    (bk) =>
                      bk.cartId === c.id &&
                      bk.date === reassigningBooking?.date &&
                      bk.period === reassigningBooking?.period,
                  )
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={hasConflict || isReassigning}
                      onClick={async () => {
                        if (!reassigningBooking) return
                        setIsReassigning(true)
                        try {
                          const res = await reassignBooking(reassigningBooking.id, c.id)
                          if (!res.ok) {
                            toast({ title: "Could not reassign", description: res.error, variant: "destructive" })
                          } else {
                            toast({ title: "Cart reassigned", description: `Moved to ${c.name}` })
                            setReassigningBooking(null)
                          }
                        } finally {
                          setIsReassigning(false)
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                        hasConflict
                          ? "cursor-not-allowed border-transparent bg-neutral-50 opacity-50"
                          : "border-border bg-white hover:border-neutral-400 hover:shadow-sm",
                      )}
                    >
                      <span>
                        <span className="block text-[13px] font-semibold text-foreground">{c.name}</span>
                        {c.location ? (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">{c.location}</span>
                        ) : null}
                        {hasConflict ? (
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">Busy that period</span>
                        ) : null}
                      </span>
                      {!hasConflict ? <ArrowRight className="size-4 text-muted-foreground" /> : null}
                    </button>
                  )
                })}
            </div>
          </div>

          <div className="border-t border-border/70 px-6 py-4">
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setReassigningBooking(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
