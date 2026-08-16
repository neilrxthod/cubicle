/**
 * Live Supabase health check. Prints table/column/RPC errors only — no secrets.
 * Usage: node --env-file=.env.local scripts/diagnose-supabase.mjs
 */
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key.");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
};

async function rest(path, init = {}) {
  const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status, body };
}

const tables = [
  "profiles",
  "carts",
  "bookings",
  "issues",
  "slot_restrictions",
  "swap_requests",
  "booking_policy",
  "allowed_emails",
];

const expected = {
  carts: [
    "id",
    "name",
    "status",
    "laptop_count",
    "location",
    "laptop_brand",
    "laptop_codes",
    "sort_order",
  ],
  bookings: [
    "id",
    "cart_id",
    "date",
    "period",
    "teacher_id",
    "teacher_name",
    "class_name",
    "subject",
    "shared_with_id",
    "shared_with_name",
    "share_pending_id",
    "share_pending_name",
    "share_declined_by_id",
    "share_declined_by_name",
    "last_edited_by_id",
  ],
  issues: ["id", "cart_id", "description", "severity", "status", "reported_by_id", "reporter_name"],
  profiles: ["id", "email", "name", "role", "employment_type", "avatar_url"],
  booking_policy: ["id", "max_advance_days", "max_slots_per_teacher_per_day"],
  allowed_emails: ["email", "role", "name", "employment_type"],
  swap_requests: ["id", "booking_id", "offered_booking_id", "requester_id", "status"],
};

const rpcs = [
  ["accept_swap_request", { p_request_id: "00000000-0000-0000-0000-000000000000" }],
  ["decline_swap_request", { p_request_id: "00000000-0000-0000-0000-000000000000" }],
  ["resolve_share_invite", { p_booking_id: "00000000-0000-0000-0000-000000000000", p_action: "dismiss" }],
];

const problems = [];

console.log("Project:", url.replace(/^https:\/\//, "").split(".")[0] + ".supabase.co");
console.log("");

for (const table of tables) {
  const { status, body } = await rest(`/rest/v1/${table}?select=*&limit=1`);
  if (status >= 400) {
    const msg = Array.isArray(body) ? JSON.stringify(body) : body?.message || body?.error || JSON.stringify(body);
    problems.push(`${table}: ${status} ${msg}`);
    console.log(`FAIL  ${table}  ${status}  ${msg}`);
    continue;
  }
  const row = Array.isArray(body) ? body[0] : null;
  const missing = (expected[table] || []).filter((col) => row && !(col in row));
  if (row && missing.length) {
    problems.push(`${table}: missing columns ${missing.join(", ")}`);
    console.log(`WARN  ${table}  missing ${missing.join(", ")}`);
  } else {
    console.log(`OK    ${table}  ${status}${row ? `  cols=${Object.keys(row).length}` : "  empty"}`);
  }
}

console.log("");
for (const [fn, payload] of rpcs) {
  const { status, body } = await rest(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const msg = body?.message || body?.hint || body?.code || "";
  if (status === 404 || /could not find the function|PGRST202/i.test(String(msg))) {
    problems.push(`rpc ${fn}: missing`);
    console.log(`FAIL  rpc ${fn}  missing`);
  } else {
    console.log(`OK    rpc ${fn}  ${status}  ${msg || "(callable)"}`.trim());
  }
}

console.log("");
if (problems.length === 0) {
  console.log("No schema/API errors found.");
} else {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(" -", p);
  process.exitCode = 2;
}
