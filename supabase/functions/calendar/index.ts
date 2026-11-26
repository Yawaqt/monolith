// Monolith 40k – personal iCal feed for members (Google Calendar, Apple, Outlook).
// Calendar apps cannot sign in, so the feed is protected by a secret token per account:
//   GET /functions/v1/calendar?t=<token>
// The database function calendar_feed() checks the token and that the account is a member.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get("t") || "").replace(/\.ics$/, "");
  if (!/^[a-f0-9]{20,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const r = await fetch(`${base}/rest/v1/rpc/calendar_feed`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
  });
  if (!r.ok) return new Response("Error", { status: 502 });
  const ics = await r.json();
  if (!ics) return new Response("Not found", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=monolith40k.ics",
      "Cache-Control": "private, max-age=900",
    },
  });
});
