import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.RCNK_CONFIG;
const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 5 } },
});

const PEOPLE = {
  rukmini: { id: "rukmini", name: "Rukmini", short: "R", cls: "rukmini" },
  nikhil:  { id: "nikhil",  name: "Nikhil",  short: "N", cls: "nikhil"  },
};
const other = (id) => (id === "nikhil" ? "rukmini" : "nikhil");

const state = {
  me: localStorage.getItem("rcnk_me") || null,
  tasks: [],
  segment: "mine",
  loginWho: null,
  showCompleted: false,
};

const $ = (s) => document.querySelector(s);
const el = (s) => document.querySelector(s);

// ─── Boot ────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
if (state.me && PEOPLE[state.me]) enterApp();
else showLogin();

// ─── Login ───────────────────────────────────────────────
function showLogin() {
  $("#login").classList.remove("hidden");
  $("#app").classList.add("hidden");
}
document.querySelectorAll(".who-btn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".who-btn").forEach((x) => x.classList.remove("sel"));
    b.classList.add("sel");
    state.loginWho = b.dataset.who;
    refreshLoginBtn();
  });
});
$("#login-pass").addEventListener("input", refreshLoginBtn);
$("#login-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#login-go").click(); });
function refreshLoginBtn() {
  $("#login-go").disabled = !(state.loginWho && $("#login-pass").value.length > 0);
  $("#login-err").textContent = "";
}
$("#login-go").addEventListener("click", () => {
  if ($("#login-pass").value !== cfg.SHARED_PASSWORD) {
    $("#login-err").textContent = "Wrong password. Try again.";
    return;
  }
  state.me = state.loginWho;
  localStorage.setItem("rcnk_me", state.me);
  $("#login-pass").value = "";
  enterApp();
});
$("#logout-btn").addEventListener("click", () => {
  localStorage.removeItem("rcnk_me");
  state.me = null; state.loginWho = null;
  document.querySelectorAll(".who-btn").forEach((x) => x.classList.remove("sel"));
  $("#login-go").disabled = true;
  showLogin();
});

// ─── Enter app ───────────────────────────────────────────
async function enterApp() {
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  // the middle filter shows the OTHER person's name, not "Theirs"
  $('#segment button[data-seg="theirs"]').textContent = `${PEOPLE[other(state.me)].name}'s`;
  // default assign-to = the other person (most common case)
  pickAssignee(other(state.me));
  refreshNotifState();
  await loadTasks();
  subscribeRealtime();
}

// ─── Data ────────────────────────────────────────────────
async function loadTasks() {
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) { toast("Couldn't load tasks. Check your connection."); return; }
  state.tasks = data || [];
  render();
}

let channel = null;
function subscribeRealtime() {
  if (channel) return;
  channel = sb
    .channel("tasks-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadTasks())
    .subscribe();
}

// ─── Render ──────────────────────────────────────────────
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function render() { renderPulse(); renderList(); }

function pressingForToday(personId) {
  // "today's load" = tasks due today or overdue (dated). Drives the gauge.
  const tom = startOfDay(Date.now()); tom.setDate(tom.getDate() + 1);
  const list = state.tasks.filter(
    (t) => t.assignee === personId && t.due_at && new Date(t.due_at) < tom
  );
  const done = list.filter((t) => t.done).length;
  return { done, total: list.length };
}

function renderPulse() {
  const order = [state.me, other(state.me)]; // you, then them
  $("#pulse").innerHTML = order.map((pid) => {
    const p = PEOPLE[pid];
    const { done, total } = pressingForToday(pid);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const meTag = pid === state.me ? `<span class="you">YOU</span>` : "";
    const body = total === 0
      ? `<div class="pulse-count"><span class="big">—</span></div>
         <div class="pulse-clear">Nothing due today</div>`
      : `<div class="pulse-count"><span class="big">${done}</span><span class="small">/${total}</span></div>
         <div class="pulse-label">done today</div>
         <div class="pulse-bar"><span style="width:${pct}%"></span></div>`;
    return `
      <div class="pulse-card ${p.cls}-bar ${pid === state.me ? "me" : ""}">
        <div class="pulse-head">
          <span class="avatar ${p.cls}">${p.short}</span>
          <span class="pn">${p.name}</span>${meTag}
        </div>
        ${body}
      </div>`;
  }).join("");
}

function whoFilter(t) {
  if (state.segment === "mine") return t.assignee === state.me;
  if (state.segment === "theirs") return t.assignee === other(state.me);
  return true;
}

function renderList() {
  const tom = startOfDay(Date.now()); tom.setDate(tom.getDate() + 1);
  const today0 = startOfDay(Date.now());
  const visible = state.tasks.filter(whoFilter);

  const open = visible.filter((t) => !t.done);
  const buckets = { overdue: [], today: [], upcoming: [], anytime: [] };
  for (const t of open) {
    if (!t.due_at) { buckets.anytime.push(t); continue; }
    const d = new Date(t.due_at);
    if (d < today0) buckets.overdue.push(t);
    else if (d < tom) buckets.today.push(t);
    else buckets.upcoming.push(t);
  }
  // completed = full history for this filter, newest first
  const completed = visible
    .filter((t) => t.done)
    .sort((a, b) => new Date(b.done_at || 0) - new Date(a.done_at || 0));

  const groups = [
    ["overdue", "Overdue", buckets.overdue, true],
    ["today", "Due today", buckets.today, false],
    ["anytime", "Anytime", buckets.anytime, false],
    ["upcoming", "Upcoming", buckets.upcoming, false],
  ].filter((g) => g[2].length);

  if (!groups.length && !completed.length) {
    $("#task-list").innerHTML = `
      <div class="empty">
        <div class="em-mark">All clear</div>
        <div class="em-line">No open tasks here.<br/>Head to <b>Assign</b> to add one.</div>
      </div>`;
    return;
  }

  let html = groups.map(([key, label, items, over]) => `
    <div class="group">
      <div class="group-head ${over ? "overdue" : ""}">
        <span class="gt">${label}</span><span class="gc">${items.length}</span>
      </div>
      <div class="group-items">${items.map(taskRow).join("")}</div>
    </div>`).join("");

  if (!groups.length) {
    html = `<div class="empty mini"><div class="em-line">Nothing open here — all done.</div></div>` + html;
  }

  if (completed.length) {
    html += `
      <div class="group completed-group">
        <button class="completed-toggle ${state.showCompleted ? "open" : ""}" id="completed-toggle" type="button">
          <span class="gt">Completed</span>
          <span class="gc">${completed.length}</span>
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        ${state.showCompleted ? `<div class="group-items">${completed.map(taskRow).join("")}</div>` : ""}
      </div>`;
  }

  $("#task-list").innerHTML = html;

  const ct = $("#completed-toggle");
  if (ct) ct.addEventListener("click", () => { state.showCompleted = !state.showCompleted; renderList(); });

  // wire up rows
  $("#task-list").querySelectorAll(".check").forEach((c) =>
    c.addEventListener("click", () => onCheck(c.dataset.id)));
  $("#task-list").querySelectorAll(".task-del").forEach((d) =>
    d.addEventListener("click", () => removeTask(d.dataset.id)));
}

function taskRow(t) {
  const a = PEOPLE[t.assignee];
  const by = PEOPLE[t.created_by];
  const dueChip = t.done ? doneChipHtml(t) : dueChipHtml(t);
  // show "from X" only when someone assigned it to someone else
  const byChip = t.created_by !== t.assignee
    ? `<span class="chip">from ${by.name}</span>` : "";
  return `
    <div class="task assignee-${t.assignee} ${t.done ? "done" : ""}">
      <button class="check ${t.done ? "on" : ""}" data-id="${t.id}" aria-label="${t.done ? "Reopen task" : "Complete task"}">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : ""}
        ${t.done && t.remark ? `<div class="task-remark">${esc(t.remark)}</div>` : ""}
        <div class="task-meta">
          <span class="chip"><span class="dot ${a.cls}">${a.short}</span>${a.name}</span>
          ${dueChip}${byChip}
        </div>
      </div>
      <button class="task-del" data-id="${t.id}" aria-label="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>`;
}

function doneChipHtml(t) {
  if (!t.done_at) return `<span class="chip done-chip">Done</span>`;
  const d = new Date(t.done_at);
  const label = d.toLocaleDateString([], { day: "numeric", month: "short" });
  return `<span class="chip done-chip">Done ${label}</span>`;
}

function dueChipHtml(t) {
  if (!t.due_at) return "";
  const d = new Date(t.due_at);
  const now = new Date();
  const today0 = startOfDay(now);
  const tom = startOfDay(now); tom.setDate(tom.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  let label, over = false;
  if (!t.done && d < now) { over = true;
    label = d < today0 ? `Overdue · ${d.toLocaleDateString([], { day: "numeric", month: "short" })}` : `Overdue · ${time}`;
  } else if (d < tom) { label = `Today ${time}`; }
  else { label = `${d.toLocaleDateString([], { day: "numeric", month: "short" })} · ${time}`; }
  return `<span class="chip ${over ? "due-over" : ""}">${label}</span>`;
}

// ─── Mutations ───────────────────────────────────────────
function onCheck(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  if (t.done) reopenTask(t);     // tapping a done task reopens it (no remark needed)
  else openRemarkSheet(t);       // completing requires a remark
}

async function reopenTask(t) {
  t.done = false; t.done_at = null; t.remark = null; // optimistic
  render();
  const { error } = await sb.from("tasks")
    .update({ done: false, done_at: null, remark: null }).eq("id", t.id);
  if (error) { toast("Update failed."); loadTasks(); }
}

let pendingId = null;
function openRemarkSheet(t) {
  pendingId = t.id;
  $("#remark-task").textContent = t.title;
  $("#remark-input").value = "";
  $("#remark-confirm").disabled = true;
  $("#remark-sheet").classList.remove("hidden");
  requestAnimationFrame(() => $("#remark-sheet").classList.add("show"));
  setTimeout(() => $("#remark-input").focus(), 120);
}
function closeRemarkSheet() {
  $("#remark-sheet").classList.remove("show");
  setTimeout(() => $("#remark-sheet").classList.add("hidden"), 220);
  pendingId = null;
}
$("#remark-input").addEventListener("input", () => {
  $("#remark-confirm").disabled = $("#remark-input").value.trim().length === 0;
});
$("#remark-cancel").addEventListener("click", closeRemarkSheet);
$("#remark-sheet").addEventListener("click", (e) => {
  if (e.target === $("#remark-sheet")) closeRemarkSheet();
});
$("#remark-confirm").addEventListener("click", async () => {
  const remark = $("#remark-input").value.trim();
  if (!remark || !pendingId) return;
  const id = pendingId;
  const t = state.tasks.find((x) => x.id === id);
  closeRemarkSheet();
  if (!t) return;
  const done_at = new Date().toISOString();
  t.done = true; t.done_at = done_at; t.remark = remark; // optimistic
  render();
  const { error } = await sb.from("tasks")
    .update({ done: true, done_at, remark }).eq("id", id);
  if (error) { toast("Couldn't save. Try again."); loadTasks(); return; }
  toast("Done — nicely closed out");
});

async function removeTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  state.tasks = state.tasks.filter((x) => x.id !== id); render(); // optimistic
  const { error } = await sb.from("tasks").delete().eq("id", id);
  if (error) { toast("Couldn't delete."); loadTasks(); }
  else toast("Task deleted");
}

// ─── Assign tab ──────────────────────────────────────────
let assignee = null;
function pickAssignee(id) {
  assignee = id;
  document.querySelectorAll(".who-pick button").forEach((b) =>
    b.classList.toggle("on", b.dataset.pick === id));
}
document.querySelectorAll(".who-pick button").forEach((b) =>
  b.addEventListener("click", () => pickAssignee(b.dataset.pick)));

document.querySelectorAll("#f-quick button").forEach((b) =>
  b.addEventListener("click", () => {
    const q = b.dataset.q;
    if (q === "clear") { $("#f-date").value = ""; $("#f-time").value = ""; return; }
    const d = new Date();
    if (q === "tomorrow") { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    else { d.setHours(18, 0, 0, 0); }
    $("#f-date").value = toDateInput(d);
    $("#f-time").value = toTimeInput(d);
  }));

$("#f-send").addEventListener("click", createTask);
async function createTask() {
  const title = $("#f-title").value.trim();
  if (!title) { toast("Add a task title first."); $("#f-title").focus(); return; }
  if (!assignee) { toast("Pick who it's for."); return; }

  let due_at = null;
  if ($("#f-date").value) {
    const time = $("#f-time").value || "18:00";
    due_at = new Date(`${$("#f-date").value}T${time}`).toISOString();
  }
  const row = {
    title, notes: $("#f-notes").value.trim() || null,
    assignee, created_by: state.me, due_at,
    done: false,
  };
  $("#f-send").disabled = true;
  const { error } = await sb.from("tasks").insert(row);
  $("#f-send").disabled = false;
  if (error) { toast("Couldn't create task."); return; }

  // notify the assignee (skip if you assigned yourself)
  if (assignee !== state.me) {
    fetch("/api/send-push", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personId: assignee,
        title: `New task from ${PEOPLE[state.me].name}`,
        body: title, url: "/",
      }),
    }).catch(() => {});
  }
  // reset + jump to Today
  $("#f-title").value = ""; $("#f-notes").value = "";
  $("#f-date").value = ""; $("#f-time").value = "";
  pickAssignee(other(state.me));
  switchTab("today");
  toast(assignee === state.me ? "Added to your list" : `Assigned to ${PEOPLE[assignee].name}`);
}

// ─── Tabs ────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  $("#tab-today").classList.toggle("hidden", tab !== "today");
  $("#tab-assign").classList.toggle("hidden", tab !== "assign");
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => switchTab(b.dataset.tab)));

document.querySelectorAll("#segment button").forEach((b) =>
  b.addEventListener("click", () => {
    state.segment = b.dataset.seg;
    document.querySelectorAll("#segment button").forEach((x) => x.classList.toggle("on", x === b));
    renderList();
  }));

// ─── Notifications ───────────────────────────────────────
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

function refreshNotifState() {
  const granted = "Notification" in window && Notification.permission === "granted";
  $("#bell-btn").classList.toggle("alert", !granted);
  const dismissed = sessionStorage.getItem("rcnk_notif_dismissed");
  $("#notif-banner").classList.toggle("hidden", granted || !!dismissed);
}
$("#bell-btn").addEventListener("click", enableNotifications);
$("#notif-enable").addEventListener("click", enableNotifications);
$("#notif-dismiss").addEventListener("click", () => {
  sessionStorage.setItem("rcnk_notif_dismissed", "1");
  $("#notif-banner").classList.add("hidden");
});

async function enableNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    toast("This browser can't do push notifications."); return;
  }
  if (!isStandalone()) {
    toast("On iPhone: tap Share → Add to Home Screen, then open RCNK from there to turn on alerts.");
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("Alerts are off. Turn them on in iPhone Settings → RCNK."); refreshNotifState(); return; }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8(cfg.VAPID_PUBLIC_KEY),
    });
    const { error } = await sb.from("push_subscriptions").upsert({
      person_id: state.me, subscription: sub.toJSON(), updated_at: new Date().toISOString(),
    });
    if (error) { toast("Couldn't save alert settings."); return; }
    toast("Alerts on. You'll get pinged.");
    refreshNotifState();
  } catch (e) {
    toast("Couldn't turn on alerts. Try again.");
  }
}

// ─── Helpers ─────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toDateInput(d) { return d.toISOString().slice(0, 10); }
function toTimeInput(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
// note: toDateInput uses UTC date; good enough for quick-fill. Manual picks use local <input>.
function urlB64ToUint8(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

// keep "today" fresh if the app is left open across midnight / refocus
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.me) loadTasks();
});
