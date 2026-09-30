import { validate, meter, record, undo, countdown, demo } from "./core.js";
const $ = (id) => document.getElementById(id),
  KEY = "quota-arcade-v1";
let saved = { version: 1, buckets: [] },
  example = demo(),
  isDemo = true,
  editing = null;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    saved = validate(JSON.parse(raw));
    isDemo = false;
  }
} catch {
  $("status").textContent =
    "Saved data could not be read. Export or recover it before overwriting; demo opened.";
}
const state = () => (isDemo ? example : saved);
const element = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
function commit(next) {
  if (isDemo) example = next;
  else {
    localStorage.setItem(KEY, JSON.stringify(next));
    saved = next;
  }
  render();
}
function run(fn) {
  try {
    fn();
  } catch (e) {
    $("status").textContent = e.message;
  }
}
function action(text, fn, disabled = false) {
  const b = element("button", text);
  b.disabled = disabled;
  b.onclick = () => run(fn);
  return b;
}
function render() {
  $("banner").textContent = isDemo
    ? "✦ DEMO PLAYGROUND — fictional numbers. Try the buttons, or switch to My meters to track your own observations."
    : "✦ PERSONAL LOG — estimates from your manual observations. No live connection to ChatGPT. Your account remains the source of truth.";
  $("mode").textContent = isDemo ? "My meters" : "Try demo";
  $("count").textContent = state().buckets.length;
  $("export").disabled = isDemo;
  $("meters").replaceChildren();
  if (!state().buckets.length)
    $("meters").append(
      element(
        "div",
        "Your shelf is waiting. Add a meter using the allowance and reset time shown in your account.",
        "empty",
      ),
    );
  for (const b of state().buckets) {
    const m = meter(b),
      card = element("article", undefined, "meter"),
      head = element("div", undefined, "meter-head");
    head.append(
      element("h3", b.name),
      element(
        "span",
        m.expired ? "CHECK RESET" : isDemo ? "DEMO" : "ESTIMATE",
        "badge",
      ),
    );
    card.append(head);
    const amount = element(
      "div",
      m.expired ? "?" : Number(m.remaining.toFixed(2)).toLocaleString(),
      "amount",
    );
    amount.append(
      element(
        "small",
        b.unit === "percent" ? " % remaining" : ` ${b.unit} left`,
      ),
    );
    card.append(amount);
    const bar = element("div", undefined, "bar"),
      fill = element("div");
    fill.style.width = (m.expired ? 0 : (1 - m.ratio) * 100) + "%";
    bar.append(fill);
    bar.setAttribute("role", "img");
    bar.setAttribute(
      "aria-label",
      m.expired
        ? "Allowance unknown"
        : `${Math.round((1 - m.ratio) * 100)} percent remaining`,
    );
    card.append(bar);
    card.append(
      element(
        "div",
        `${Number(m.used.toFixed(2))} logged / ${b.limit} ${b.unit === "percent" ? "percentage points" : b.unit}${m.over ? " · logged beyond allowance" : ""}`,
        "detail",
      ),
    );
    const timer = element(
      "div",
      m.expired
        ? "◷ Reset time passed — verify your account"
        : "◷ Reset in " + countdown(m.ms),
      "timer",
    );
    timer.dataset.reset = b.resetAt;
    card.append(timer);
    const actions = element("div", undefined, "actions");
    actions.append(
      action(
        b.unit === "percent" ? "+1 point" : "+1 used",
        () => commit(record(state(), b.id, 1)),
        m.expired,
      ),
      action("Undo", () => commit(undo(state(), b.id)), !b.events.length),
      action("Update", () => openEditor(b)),
      action("Remove", () => {
        if (confirm(`Remove “${b.name}” and its logs?`))
          commit({
            ...state(),
            buckets: state().buckets.filter((x) => x.id !== b.id),
          });
      }),
    );
    card.append(actions);
    card.append(
      element(
        "p",
        "Observed " + new Date(b.observedAt).toLocaleString(),
        "source",
      ),
    );
    const history = element("div", undefined, "history");
    history.append(
      element(
        "div",
        b.events.length
          ? `Recent usage · ${b.events
              .slice(-5)
              .map((e) => "+" + e.amount)
              .join("  →  ")}`
          : "No usage logged since this observation.",
      ),
    );
    card.append(history);
    $("meters").append(card);
  }
}
function openEditor(b) {
  editing = b?.id || null;
  $("form-title").textContent = b ? "Fresh observation" : "New energy meter";
  $("name").value = b?.name || "";
  $("unit").value = b?.unit || "messages";
  $("limit").value = b?.limit || 100;
  $("used").value = 0;
  const date = new Date(Date.now() + 5 * 3600000);
  $("reset").value = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  $("form-error").textContent = "";
  $("limit").disabled = $("unit").value === "percent";
  $("editor").showModal();
}
$("add").onclick = () => openEditor();
$("import-trigger").onclick = () => $("import").click();
$("close").onclick = () => $("editor").close();
$("unit").onchange = () => {
  const percent = $("unit").value === "percent";
  $("limit").disabled = percent;
  if (percent) $("limit").value = 100;
};
$("form").onsubmit = (e) => {
  e.preventDefault();
  try {
    const now = new Date().toISOString(),
      b = {
        id: editing || crypto.randomUUID(),
        name: $("name").value.trim(),
        unit: $("unit").value,
        limit: Number($("limit").value),
        used: Number($("used").value),
        observedAt: now,
        resetAt: new Date($("reset").value).toISOString(),
        events: [],
      };
    const next = {
      version: 1,
      buckets: editing
        ? state().buckets.map((x) => (x.id === editing ? b : x))
        : [...state().buckets, b],
    };
    commit(validate(next));
    $("editor").close();
    $("status").textContent =
      "Observation saved. Future logs are estimates against this snapshot.";
  } catch (e) {
    $("form-error").textContent = e.message;
  }
};
$("mode").onclick = () => {
  isDemo = !isDemo;
  render();
};
$("export").onclick = () => {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" }),
    ),
    a = element("a");
  a.href = url;
  a.download = "quota-arcade-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("import").onchange = async (e) => {
  try {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2000000) throw Error("Backup must be smaller than 2 MB.");
    const next = validate(JSON.parse(await f.text()));
    if (!confirm("Replace your personal meters with this backup?")) return;
    localStorage.setItem(KEY, JSON.stringify(next));
    saved = next;
    isDemo = false;
    render();
    $("status").textContent = "Backup restored.";
  } catch (err) {
    $("status").textContent = err.message;
  } finally {
    e.target.value = "";
  }
};
window.addEventListener("storage", (e) => {
  if (e.key === KEY)
    try {
      saved = e.newValue
        ? validate(JSON.parse(e.newValue))
        : { version: 1, buckets: [] };
      render();
    } catch {
      $("status").textContent = "Another tab saved unreadable data.";
    }
});
setInterval(() => {
  const crossed = [...document.querySelectorAll("[data-reset]")].some(
    (n) =>
      Date.parse(n.dataset.reset) <= Date.now() &&
      !n.textContent.includes("passed"),
  );
  if (crossed) render();
  else
    document.querySelectorAll("[data-reset]").forEach((n) => {
      const ms = Date.parse(n.dataset.reset) - Date.now();
      if (ms > 0) n.textContent = "◷ Reset in " + countdown(ms);
    });
}, 1000);
render();
