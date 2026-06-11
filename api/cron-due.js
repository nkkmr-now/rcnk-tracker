// GET /api/cron-due — runs once a day (~7:30pm IST via vercel.json).
// Sends each person ONE summary of their tasks still due today.
// Auth is optional: if CRON_SECRET is set, it's enforced; if not, it's skipped.
const webpush = require("web-push");

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:rcnk@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IST_OFFSET_MIN = 330; // India Standard Time = UTC+5:30

function sbFetch(path, opts = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

// The UTC window that corresponds to "today" in India.
function istTodayWindowUTC() {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MIN * 60000);
  const istMidnight = Date.UTC(
    istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 0, 0, 0
  );
  const startUTC = new Date(istMidnight - IST_OFFSET_MIN * 60000);
  const endUTC = new Date(startUTC.getTime() + 24 * 3600000);
  return { startUTC: startUTC.toISOString(), endUTC: endUTC.toISOString() };
}

async function pushTo(personId, title, body) {
  const rows = await (
    await sbFetch(`push_subscriptions?person_id=eq.${personId}&select=subscription`)
  ).json();
  if (!Array.isArray(rows) || !rows.length) return false;
  const payload = JSON.stringify({ title, body, url: "/" });
  try { await webpush.sendNotification(rows[0].subscription, payload); return true; }
  catch (_) { return false; }
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || "";
    const key = (req.query && req.query.key) || "";
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  try {
    const { startUTC, endUTC } = istTodayWindowUTC();
    const tasks = await (
      await sbFetch(
        `tasks?done=eq.false&due_at=gte.${startUTC}&due_at=lt.${endUTC}&select=title,assignee&order=due_at.asc`
      )
    ).json();
    if (!Array.isArray(tasks)) return res.status(500).json({ error: "bad query", tasks });

    const byPerson = { rukmini: [], nikhil: [] };
    for (const t of tasks) if (byPerson[t.assignee]) byPerson[t.assignee].push(t.title);

    const out = {};
    for (const pid of Object.keys(byPerson)) {
      const titles = byPerson[pid];
      if (!titles.length) { out[pid] = "nothing due"; continue; }
      const n = titles.length;
      const title = n === 1 ? "1 task still due today" : `${n} tasks still due today`;
      const body = titles.slice(0, 5).join("  ·  ") + (n > 5 ? `  · +${n - 5} more` : "");
      out[pid] = (await pushTo(pid, title, body)) ? "sent" : "no-subscription";
    }
    return res.status(200).json({ ok: true, window: { startUTC, endUTC }, result: out });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
