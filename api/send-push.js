// POST /api/send-push  — notify a person that something happened.
// Body: { personId, title, body, url }
const webpush = require("web-push");

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:rcnk@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { personId, title, body, url } =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (!personId) return res.status(400).json({ error: "personId required" });

    const r = await sbFetch(
      `push_subscriptions?person_id=eq.${encodeURIComponent(personId)}&select=subscription`
    );
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, note: "no subscription on file" });
    }

    const payload = JSON.stringify({
      title: title || "RCNK Tracker",
      body: body || "",
      url: url || "/",
    });

    let sent = 0;
    for (const row of rows) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // expired/invalid subscription — remove it
          await sbFetch(`push_subscriptions?person_id=eq.${encodeURIComponent(personId)}`, {
            method: "DELETE",
          });
        }
      }
    }
    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
