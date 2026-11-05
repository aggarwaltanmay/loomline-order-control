"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated floor photos and local previews should bypass image optimization. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Check,
  CircleAlert,
  Clock3,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";

type Role = "merchandiser" | "supervisor" | "buyer";
type Actor = {
  email: string;
  role: Role;
  buyerId: string | null;
  unitId: string | null;
};
type Milestone = {
  id: string;
  name: string;
  due_date: string;
  sequence: number;
};
type Update = {
  id: string;
  stage: string;
  daily_qty: number;
  update_date: string;
  note?: string;
  english_summary?: string;
  category?: string;
  confidence?: string;
  photo_key?: string;
};
type Projection = {
  remaining: number;
  days: number;
  neededPerDay: number | null;
  madePerDay: number;
  projectedDate: string | null;
  status: "green" | "amber" | "red";
  usingBaseline: boolean;
  earlyWarning: boolean;
};
type Order = {
  id: string;
  po: string;
  buyer_id: string;
  buyer_name: string;
  style: string;
  color: string;
  sizes: Record<string, number>;
  qty: number;
  ex_factory: string;
  unit_id: string;
  stage: string;
  stage_done: number;
  buyer_warning_confirmed: number;
  milestones: Milestone[];
  updates: Update[];
  history: Array<{
    id: string;
    field: string;
    old_date: string;
    new_date: string;
    reason: string;
    actor_email: string;
    changed_at: string;
  }>;
  projection: Projection | null;
};
type State = { actor: Actor; today: string; orders: Order[] };
type Screen = "board" | "detail" | "update" | "new" | "buyer";
type Pending = {
  id: string;
  orderId: string;
  dailyQty: number;
  updateDate: string;
  note: string;
  photoData: string | null;
  action: "dailyUpdate";
};
type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechEngine = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechEngine;
  webkitSpeechRecognition?: new () => SpeechEngine;
};

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const dateLabel = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(x.getTime())
    ? d
    : x.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      });
};
const week = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  const first = new Date(x);
  first.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return first.toISOString().slice(0, 10);
};
const stageNames = [
  "Cutting",
  "Printing",
  "Stitching",
  "Washing",
  "Finishing",
  "Packing",
];
const reasons = [
  "Material delay",
  "Machine breakdown",
  "Quality issue",
  "Printing delay",
  "Washing delay",
  "Staffing",
  "Other",
  "Needs review",
];
const T = {
  en: {
    board: "Order board",
    update: "Floor update",
    new: "New order",
    buyer: "Buyer view",
    signOut: "Sign out",
    send: "Send update",
    pieces: "Pieces completed today",
    issue: "Issue note (optional)",
    photo: "Add floor photo",
    queued: "Queued offline",
    uploading: "Sending update…",
    order: "Order",
    floorHelp:
      "One short update from the floor. It will send when the connection returns.",
    ready: "Ready to send",
    offlineHelp:
      "Offline entries stay on this phone until successfully sent. Do not clear browser storage before syncing.",
  },
  ta: {
    board: "ஆர்டர் பலகை",
    update: "தள நிலவரம்",
    new: "புதிய ஆர்டர்",
    buyer: "வாங்குபவர் பார்வை",
    signOut: "வெளியேறு",
    send: "பதிவை அனுப்பு",
    pieces: "இன்று முடித்த துணிகள்",
    issue: "சிக்கல் குறிப்பு (விருப்பம்)",
    photo: "தள புகைப்படம் சேர்",
    queued: "இணையமின்றி சேமிக்கப்பட்டது",
    uploading: "பதிவு அனுப்பப்படுகிறது…",
    order: "ஆர்டர்",
    floorHelp:
      "தளத்தில் இருந்து தினசரி நிலவரத்தை பதிவு செய்யவும். இணையம் வந்ததும் அனுப்பப்படும்.",
    ready: "அனுப்ப தயார்",
    offlineHelp:
      "இணையமின்றி உள்ள பதிவுகள் இந்த போனில் சேமிக்கப்படும். அனுப்பும் முன் உலாவி தரவை அழிக்க வேண்டாம்.",
  },
};

async function api<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(path, { credentials: "include", ...options });
  const data = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}
function dbQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("loomline-offline", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("pending", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function queuePut(v: Pending) {
  const db = await dbQueue();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pending", "readwrite");
    tx.objectStore("pending").put(v);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function queueAll(): Promise<Pending[]> {
  const db = await dbQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending", "readonly");
    const r = tx.objectStore("pending").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function queueDelete(id: string) {
  const db = await dbQueue();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("pending", "readwrite");
    tx.objectStore("pending").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function photoToData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas
        .getContext("2d")
        ?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Photo could not be read"));
    };
    img.src = url;
  });
}

function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      <span className="badge-dot" />
      {status === "red" ? "At risk" : status === "amber" ? "Watch" : "On track"}
    </span>
  );
}
function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className={`metric ${tone || ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<Screen>("board");
  const [selected, setSelected] = useState("");
  const [lang, setLang] = useState<"en" | "ta">("en");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [online, setOnline] = useState(true);
  const firstLoad = useRef(true);
  const [buyerFilter, setBuyerFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [weekFilter, setWeekFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [previewBuyer, setPreviewBuyer] = useState("B");
  const [loginEmail, setLoginEmail] = useState("merch@loomline.demo");
  const [loginPassword, setLoginPassword] = useState("Demo@2026!");
  const [updateOrder, setUpdateOrder] = useState("");
  const [dailyQty, setDailyQty] = useState("");
  const [note, setNote] = useState("");
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechEngine | null>(null);
  const [dateField, setDateField] = useState("Ex-factory");
  const [newDate, setNewDate] = useState("");
  const [dateReason, setDateReason] = useState("");
  const [showDateForm, setShowDateForm] = useState(false);
  const [newForm, setNewForm] = useState({
    po: "",
    buyerId: "B",
    buyerName: "Company B · UK",
    style: "",
    color: "",
    unitId: "Unit 1",
    exFactory: "",
    sizes: { S: "", M: "", L: "", XL: "" },
  });
  const tr = T[lang];
  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 5000);
  };
  const load = useCallback(async () => {
    try {
      const data = await api<State>("/api/state");
      setState(data);
      setError("");
      setSelected((s) => s || data.orders[0]?.id || "");
      setUpdateOrder((s) => s || data.orders[0]?.id || "");
      if (firstLoad.current) {
        if (data.actor.role === "supervisor") {
          setScreen("update");
          setLang("ta");
        }
        if (
          data.actor.role === "buyer" ||
          new URLSearchParams(window.location.search).get("view") === "buyer"
        )
          setScreen("buyer");
        firstLoad.current = false;
      }
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes("Sign in")) setState(null);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => { void load(); });
    queueMicrotask(() => setOnline(navigator.onLine));
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    queueAll()
      .then((x) => setPendingCount(x.length))
      .catch(() => {});
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [load]);
  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    const items = await queueAll().catch(() => []);
    for (const item of items) {
      try {
        await api("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        await queueDelete(item.id);
      } catch {
        break;
      }
    }
    setPendingCount((await queueAll().catch(() => [])).length);
    if (items.length) load();
  }, [load]);
  useEffect(() => {
    window.addEventListener("online", flush);
    queueMicrotask(() => { void flush(); });
    return () => window.removeEventListener("online", flush);
  }, [flush]);
  const orders = useMemo(() => state?.orders ?? [], [state?.orders]);
  const user = state?.actor;
  const order = orders.find((o) => o.id === selected);
  const buyers = [
    ...new Map(
      orders.map((o) => [o.buyer_id, { id: o.buyer_id, name: o.buyer_name }]),
    ).values(),
  ];
  const units = [...new Set(orders.map((o) => o.unit_id))];
  const weeks = [...new Set(orders.map((o) => week(o.ex_factory)))];
  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (buyerFilter === "all" || o.buyer_id === buyerFilter) &&
          (unitFilter === "all" || o.unit_id === unitFilter) &&
          (weekFilter === "all" || week(o.ex_factory) === weekFilter) &&
          (riskFilter === "all" || o.projection?.status === riskFilter) &&
          (!query ||
            `${o.po} ${o.style} ${o.buyer_name}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [orders, buyerFilter, unitFilter, weekFilter, riskFilter, query],
  );
  const stats = {
    red: orders.filter((o) => o.projection?.status === "red").length,
    amber: orders.filter((o) => o.projection?.status === "amber").length,
    green: orders.filter((o) => o.projection?.status === "green").length,
  };
  const submit = async (action: Record<string, unknown>, success: string) => {
    setBusy(true);
    try {
      await api("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      await load();
      flash(success);
      return true;
    } catch (e) {
      flash((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      firstLoad.current = true;
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    await api("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {});
    setState(null);
    setScreen("board");
    setMobileNav(false);
    firstLoad.current = true;
  };
  const sendUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(dailyQty);
    if (
      !updateOrder ||
      !Number.isInteger(qty) ||
      qty < 0 ||
      (!qty && !note.trim() && !photoData)
    ) {
      flash("Enter pieces, an issue or a photo.");
      return;
    }
    const payload: Pending = {
      action: "dailyUpdate",
      id: crypto.randomUUID(),
      orderId: updateOrder,
      dailyQty: qty,
      updateDate: state?.today || new Date().toISOString().slice(0, 10),
      note,
      photoData,
    };
    setBusy(true);
    try {
      if (!navigator.onLine) throw new Error("offline");
      await api("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setDailyQty("");
      setNote("");
      setPhotoData(null);
      setPhotoName("");
      await load();
      flash("Floor update saved.");
    } catch (e) {
      const msg = (e as Error).message;
      if (!navigator.onLine || msg === "Failed to fetch" || msg === "offline") {
        await queuePut(payload);
        setPendingCount((await queueAll()).length);
        setDailyQty("");
        setNote("");
        setPhotoData(null);
        setPhotoName("");
        flash("Saved on this phone. It will send when online.");
      } else flash(msg);
    } finally {
      setBusy(false);
    }
  };
  const startVoice = () => {
    const speechWindow = window as SpeechWindow;
    const Ctor =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;
    if (!Ctor) {
      flash(
        "Voice input is unavailable in this browser. Type the note instead.",
      );
      return;
    }
    const r = new Ctor();
    r.lang = "ta-IN";
    r.interimResults = false;
    r.onresult = (event: SpeechResult) => {
      setNote((v) => `${v} ${event.results[0][0].transcript}`.trim());
      setRecording(false);
    };
    r.onerror = () => {
      setRecording(false);
      flash("Voice capture stopped. You can type the note.");
    };
    r.onend = () => setRecording(false);
    recognitionRef.current = r;
    r.start();
    setRecording(true);
  };
  const nav = (to: Screen) => {
    setScreen(to);
    setMobileNav(false);
    window.scrollTo(0, 0);
  };

  if (loading)
    return (
      <div className="center-state">
        <div className="logo-mark">L</div>
        <div className="spinner" />
        <p>Loading order control…</p>
      </div>
    );
  if (!state)
    return (
      <main className="login-shell">
        <div className="login-brand">
          <div className="brand">
            <div className="logo-mark">L</div>
            <span>Loomline</span>
          </div>
          <div className="login-copy">
            <p className="eyebrow">ORDER CONTROL · TIRUPPUR</p>
            <h1>
              Know early.
              <br />
              <em>Ship on time.</em>
            </h1>
            <p>
              Daily floor numbers, clear risk signals and a calm view for every
              buyer.
            </p>
            <div className="login-thread" />
          </div>
          <p className="login-foot">A working sample for Company A</p>
        </div>
        <div className="login-panel">
          <div className="login-card">
            <span className="small-icon">
              <ShieldCheck size={20} />
            </span>
            <h2>Sign in to the sample</h2>
            <p>
              Choose a role to explore the same orders from each perspective.
            </p>
            <div className="demo-roles">
              {[
                ["Merchandiser", "merch@loomline.demo"],
                ["Supervisor", "floor@loomline.demo"],
                ["Buyer · Company B", "buyer-b@loomline.demo"],
                ["Buyer · Company C", "buyer-c@loomline.demo"],
              ].map(([label, email]) => (
                <button
                  key={email}
                  className={loginEmail === email ? "chosen" : ""}
                  onClick={() => {
                    setLoginEmail(email);
                    setLoginPassword("Demo@2026!");
                  }}
                >
                  {label}
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
            <form onSubmit={doLogin}>
              <label>
                Email
                <input
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  type="email"
                  required
                />
              </label>
              <label>
                Password
                <input
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  type="password"
                  required
                />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary full" disabled={busy}>
                {busy ? "Signing in…" : "Enter workspace"}
                <ArrowRight size={17} />
              </button>
            </form>
            <div className="login-hint">
              Sample data only · Demo password: Demo@2026!
            </div>
          </div>
        </div>
      </main>
    );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="logo-mark">L</div>
          <span>Loomline</span>
          <button className="mobile-close" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          <button
            className={
              screen === "board" || screen === "detail" ? "active" : ""
            }
            onClick={() => nav("board")}
          >
            <LayoutDashboard size={18} />
            {tr.board}
          </button>
          {user?.role !== "buyer" && (
            <button
              className={screen === "update" ? "active" : ""}
              onClick={() => nav("update")}
            >
              <Send size={17} />
              {tr.update}
              {pendingCount > 0 && (
                <span className="nav-count">{pendingCount}</span>
              )}
            </button>
          )}
          {user?.role === "merchandiser" && (
            <button
              className={screen === "new" ? "active" : ""}
              onClick={() => nav("new")}
            >
              <FilePlus2 size={18} />
              {tr.new}
            </button>
          )}
          <button
            className={screen === "buyer" ? "active" : ""}
            onClick={() => nav("buyer")}
          >
            <ShieldCheck size={18} />
            {tr.buyer}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="language">
            <span>Language</span>
            <div>
              <button
                className={lang === "en" ? "on" : ""}
                onClick={() => setLang("en")}
              >
                EN
              </button>
              <button
                className={lang === "ta" ? "on" : ""}
                onClick={() => setLang("ta")}
              >
                தமிழ்
              </button>
            </div>
          </div>
          <div className="profile">
            <div className="avatar">
              {user?.role === "buyer"
                ? "B"
                : user?.role === "supervisor"
                  ? "S"
                  : "M"}
            </div>
            <div>
              <strong>
                {user?.role === "buyer"
                  ? "Buyer access"
                  : user?.role === "supervisor"
                    ? "Floor supervisor"
                    : "Merchandiser"}
              </strong>
              <small>{user?.email}</small>
            </div>
          </div>
          <button className="signout" onClick={logout}>
            <LogOut size={16} />
            {tr.signOut}
          </button>
        </div>
      </aside>
      <div
        className="mobile-backdrop"
        hidden={!mobileNav}
        onClick={() => setMobileNav(false)}
      />
      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)}>
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Company A <span>/</span>{" "}
            {screen === "detail"
              ? order?.po
              : screen === "board"
                ? tr.board
                : screen === "update"
                  ? tr.update
                  : screen === "new"
                    ? tr.new
                    : tr.buyer}
          </div>
          <div className="top-actions">
            <span className={`connection ${online ? "" : "offline"}`}>
              {online ? (
                <>
                  <span className="live-dot" /> Live
                </>
              ) : (
                <>
                  <WifiOff size={15} /> Offline
                </>
              )}
            </span>
            <button
              className="icon-button"
              title="Refresh"
              onClick={() => load()}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="error-banner">
              <CircleAlert size={18} />
              {error}
              <button onClick={() => load()}>Retry</button>
            </div>
          )}

          {screen === "board" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    OPERATIONS / {dateLabel(state.today).toUpperCase()}
                  </p>
                  <h1>Order board</h1>
                  <p className="subtitle">
                    The orders that need attention, before they become late.
                  </p>
                </div>
                <div className="heading-actions">
                  {user?.role === "merchandiser" && (
                    <button className="secondary" onClick={() => nav("new")}>
                      <FilePlus2 size={17} /> New order
                    </button>
                  )}
                  <a
                    className="primary"
                    href={
                      buyerFilter === "all"
                        ? "/api/export"
                        : `/api/export?buyer=${encodeURIComponent(buyerFilter)}`
                    }
                  >
                    <ArrowDownToLine size={17} /> Export status
                  </a>
                </div>
              </div>
              <div className="metrics">
                <Metric
                  label="At risk"
                  value={String(stats.red)}
                  sub="Below the required run rate"
                  tone="danger"
                />
                <Metric
                  label="Needs watching"
                  value={String(stats.amber)}
                  sub="Close to plan"
                  tone="warning"
                />
                <Metric
                  label="On track"
                  value={String(stats.green)}
                  sub="Output meets plan"
                  tone="good"
                />
                <Metric
                  label="Active orders"
                  value={String(orders.length)}
                  sub="Across all visible units"
                />
              </div>
              <div className="section-head">
                <div>
                  <h2>Active orders</h2>
                  <p>Updated from daily floor entries</p>
                </div>
                <span className="result-count">{filtered.length} shown</span>
              </div>
              <div className="filters">
                <div className="search">
                  <Search size={17} />
                  <input
                    placeholder="Search PO or style"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  value={buyerFilter}
                  onChange={(e) => setBuyerFilter(e.target.value)}
                >
                  <option value="all">All buyers</option>
                  {buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                >
                  <option value="all">All units</option>
                  {units.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
                <select
                  value={weekFilter}
                  onChange={(e) => setWeekFilter(e.target.value)}
                >
                  <option value="all">All ship weeks</option>
                  {weeks.map((w) => (
                    <option key={w} value={w}>
                      Week of {dateLabel(w)}
                    </option>
                  ))}
                </select>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                >
                  <option value="all">All signals</option>
                  <option value="red">At risk</option>
                  <option value="amber">Watch</option>
                  <option value="green">On track</option>
                </select>
              </div>
              <div className="order-list">
                {filtered.length === 0 ? (
                  <div className="empty">
                    <Search size={24} />
                    <h3>No orders found</h3>
                    <p>Clear a filter or try another PO.</p>
                    <button
                      className="text-link"
                      onClick={() => {
                        setBuyerFilter("all");
                        setUnitFilter("all");
                        setWeekFilter("all");
                        setRiskFilter("all");
                        setQuery("");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  filtered.map((o) => (
                    <button
                      className="order-row"
                      key={o.id}
                      onClick={() => {
                        setSelected(o.id);
                        nav("detail");
                      }}
                    >
                      <div
                        className={`risk-stripe ${o.projection?.status || "green"}`}
                      />
                      <div className="order-ident">
                        <strong>{o.po}</strong>
                        <span>{o.buyer_name}</span>
                      </div>
                      <div className="order-style">
                        <strong>{o.style}</strong>
                        <span>
                          {o.color} · {o.unit_id}
                        </span>
                      </div>
                      <div className="order-stage">
                        <span>{o.stage}</span>
                        <div className="progress">
                          <i
                            style={{
                              width: `${Math.min(100, (o.stage_done / o.qty) * 100)}%`,
                            }}
                          />
                        </div>
                        <small>
                          {fmt(o.stage_done)} / {fmt(o.qty)} pcs
                        </small>
                      </div>
                      <div className="order-ship">
                        <span>EX-FACTORY</span>
                        <strong>{dateLabel(o.ex_factory)}</strong>
                      </div>
                      <div className="order-risk">
                        {o.projection && <Badge status={o.projection.status} />}
                        <ArrowRight size={17} />
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="board-note">
                <Sparkles size={16} /> Signals compare pieces needed per day
                with actual recent output. Sample orders use labelled baseline
                rates until the first floor update.
              </div>
            </>
          )}

          {screen === "detail" && order && (
            <>
              <button className="back" onClick={() => nav("board")}>
                <ArrowLeft size={17} /> Back to board
              </button>
              <div className="detail-heading">
                <div>
                  <p className="eyebrow">
                    {order.buyer_name} / {order.unit_id}
                  </p>
                  <h1>{order.po}</h1>
                  <p className="subtitle">
                    {order.style} · {order.color} · {fmt(order.qty)} pieces
                  </p>
                </div>
                {order.projection && <Badge status={order.projection.status} />}
              </div>
              <div className="detail-grid">
                <div className="detail-main">
                  <section className="card projection-card">
                    <div className="card-top">
                      <div>
                        <p className="eyebrow">EARLY WARNING</p>
                        <h2>
                          {order.projection?.status === "green"
                            ? "Output is meeting plan"
                            : order.projection?.status === "amber"
                              ? "Close to the required pace"
                              : "Current pace misses the milestone"}
                        </h2>
                      </div>
                      <Clock3 size={20} />
                    </div>
                    {order.projection && (
                      <>
                        <div className="math-grid">
                          <div>
                            <span>Still to make</span>
                            <strong>{fmt(order.projection.remaining)}</strong>
                            <small>pieces in {order.stage}</small>
                          </div>
                          <div>
                            <span>Days left</span>
                            <strong>{order.projection.days}</strong>
                            <small>
                              to{" "}
                              {dateLabel(
                                order.milestones.find(
                                  (m) => m.name === order.stage,
                                )?.due_date || order.ex_factory,
                              )}
                            </small>
                          </div>
                          <div>
                            <span>Needed / day</span>
                            <strong>
                              {order.projection.neededPerDay === null
                                ? "—"
                                : fmt(order.projection.neededPerDay)}
                            </strong>
                            <small>remaining ÷ days</small>
                          </div>
                          <div className="made">
                            <span>Made / day</span>
                            <strong>{fmt(order.projection.madePerDay)}</strong>
                            <small>
                              {order.projection.usingBaseline
                                ? "Sample baseline · replace with floor data"
                                : "Recent actual output"}
                            </small>
                          </div>
                        </div>
                        <div className="projection-footer">
                          <span>
                            Projected milestone:{" "}
                            <strong>
                              {order.projection.projectedDate
                                ? dateLabel(order.projection.projectedDate)
                                : "No output yet"}
                            </strong>
                          </span>
                          {order.projection.earlyWarning && (
                            <span className="early">
                              <Bell size={15} /> Within 14-day warning window
                            </span>
                          )}
                        </div>
                        {user?.role === "merchandiser" &&
                          order.projection.status !== "green" && (
                            <button
                              className="text-link"
                              disabled={busy || !!order.buyer_warning_confirmed}
                              onClick={() =>
                                submit(
                                  {
                                    action: "confirmWarning",
                                    orderId: order.id,
                                  },
                                  "Warning shared with buyer view.",
                                )
                              }
                            >
                              {order.buyer_warning_confirmed
                                ? "Buyer warning confirmed ✓"
                                : "Confirm warning for buyer"}
                            </button>
                          )}
                      </>
                    )}
                  </section>
                  <section className="card">
                    <div className="card-top">
                      <div>
                        <p className="eyebrow">TIME & ACTION</p>
                        <h2>Milestone plan</h2>
                      </div>
                      {user?.role === "merchandiser" && (
                        <button
                          className="subtle-button"
                          onClick={() => setShowDateForm(!showDateForm)}
                        >
                          {showDateForm ? "Close" : "Change a date"}
                        </button>
                      )}
                    </div>
                    <div className="milestones">
                      {order.milestones.map((m, i) => (
                        <div
                          className={`milestone ${m.name === order.stage ? "current" : ""}`}
                          key={m.id}
                        >
                          <div className="milestone-line">
                            <span />
                          </div>
                          <div>
                            <strong>{m.name}</strong>
                            <small>
                              {m.name === order.stage
                                ? "Current stage"
                                : i <
                                    order.milestones.findIndex(
                                      (x) => x.name === order.stage,
                                    )
                                  ? "Earlier stage"
                                  : "Upcoming"}
                            </small>
                          </div>
                          <time>{dateLabel(m.due_date)}</time>
                        </div>
                      ))}
                    </div>
                    {showDateForm && (
                      <form
                        className="date-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (
                            await submit(
                              {
                                action: "changeDate",
                                orderId: order.id,
                                field: dateField,
                                newDate,
                                reason: dateReason,
                              },
                              "Date changed and added to history.",
                            )
                          ) {
                            setShowDateForm(false);
                            setDateReason("");
                            setNewDate("");
                          }
                        }}
                      >
                        <div className="form-grid">
                          <label>
                            Milestone
                            <select
                              value={dateField}
                              onChange={(e) => setDateField(e.target.value)}
                            >
                              {order.milestones.map((m) => (
                                <option key={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            New date
                            <input
                              type="date"
                              required
                              value={newDate}
                              onChange={(e) => setNewDate(e.target.value)}
                            />
                          </label>
                        </div>
                        <label>
                          Reason for change
                          <input
                            required
                            maxLength={300}
                            placeholder="Why did this date change?"
                            value={dateReason}
                            onChange={(e) => setDateReason(e.target.value)}
                          />
                        </label>
                        <button className="primary" disabled={busy}>
                          Save change
                        </button>
                      </form>
                    )}
                  </section>
                  <section className="card">
                    <div className="card-top">
                      <div>
                        <p className="eyebrow">FLOOR LOG</p>
                        <h2>Daily updates</h2>
                      </div>
                      <span className="muted">
                        {order.updates.length} entries
                      </span>
                    </div>
                    {order.updates.length === 0 ? (
                      <div className="inline-empty">
                        No floor updates yet. The run rate uses an explicit
                        sample baseline.
                      </div>
                    ) : (
                      <div className="update-list">
                        {order.updates.map((u) => (
                          <div className="update-item" key={u.id}>
                            <div className="update-item-top">
                              <strong>{fmt(u.daily_qty)} pieces</strong>
                              <time>{dateLabel(u.update_date)}</time>
                            </div>
                            {u.note && (
                              <div className="note-original">{u.note}</div>
                            )}
                            {u.english_summary && (
                              <p className="translation">{u.english_summary}</p>
                            )}
                            {u.category && (
                              <div className="category-row">
                                <span className="ai-tag">
                                  <Sparkles size={13} />{" "}
                                  {u.confidence === "rule"
                                    ? "Rule suggestion · "
                                    : u.confidence === "reviewed"
                                      ? "Reviewed · "
                                      : u.confidence === "unavailable"
                                        ? "Review needed · "
                                        : "AI suggestion · "}
                                  {u.category}{" "}
                                  {u.confidence === "low"
                                    ? "· low confidence"
                                    : ""}
                                </span>
                                {user?.role === "merchandiser" && (
                                  <select
                                    aria-label="Correct reason category"
                                    value={u.category}
                                    onChange={(e) =>
                                      submit(
                                        {
                                          action: "setCategory",
                                          updateId: u.id,
                                          category: e.target.value,
                                        },
                                        "Category corrected.",
                                      )
                                    }
                                  >
                                    {reasons.map((r) => (
                                      <option key={r}>{r}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                            {u.photo_key && (
                              <img
                                className="floor-photo"
                                src={`/api/photo/${u.id}`}
                                alt={`Floor progress for ${order.po}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className="card">
                    <div className="card-top">
                      <div>
                        <p className="eyebrow">AUDIT TRAIL</p>
                        <h2>Date history</h2>
                      </div>
                    </div>
                    {order.history.length === 0 ? (
                      <div className="inline-empty">No dates have changed.</div>
                    ) : (
                      order.history.map((h) => (
                        <div className="history-item" key={h.id}>
                          <div>
                            <strong>{h.field}</strong>
                            <span>
                              {dateLabel(h.old_date)} → {dateLabel(h.new_date)}
                            </span>
                          </div>
                          <p>{h.reason}</p>
                          <small>
                            {h.actor_email} ·{" "}
                            {new Date(h.changed_at).toLocaleString("en-GB")}
                          </small>
                        </div>
                      ))
                    )}
                  </section>
                </div>
                <aside className="detail-side">
                  <div className="card">
                    <p className="eyebrow">ORDER SNAPSHOT</p>
                    <div className="snapshot-row">
                      <span>Buyer</span>
                      <strong>{order.buyer_name}</strong>
                    </div>
                    <div className="snapshot-row">
                      <span>Unit</span>
                      <strong>{order.unit_id}</strong>
                    </div>
                    <div className="snapshot-row">
                      <span>Ex-factory</span>
                      <strong>{dateLabel(order.ex_factory)}</strong>
                    </div>
                    <div className="snapshot-row">
                      <span>Current stage</span>
                      <strong>{order.stage}</strong>
                    </div>
                    <div className="snapshot-row">
                      <span>Colour</span>
                      <strong>{order.color}</strong>
                    </div>
                    <div className="size-breakdown">
                      <span>Size breakdown</span>
                      {Object.entries(order.sizes).map(([s, q]) => (
                        <div key={s}>
                          <b>{s}</b>
                          <strong>{fmt(q)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  {user?.role === "merchandiser" && (
                    <div className="card">
                      <p className="eyebrow">NEXT ACTION</p>
                      <h3>Move the work forward</h3>
                      <p className="card-copy">
                        When this stage is complete, select the next stage to
                        start a fresh run-rate projection.
                      </p>
                      <select
                        value={order.stage}
                        onChange={(e) =>
                          submit(
                            {
                              action: "advanceStage",
                              orderId: order.id,
                              stage: e.target.value,
                            },
                            "Stage updated.",
                          )
                        }
                      >
                        {stageNames.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}

          {screen === "update" && user?.role !== "buyer" && (
            <div className="update-screen">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">FLOOR / DAILY ENTRY</p>
                  <h1>{tr.update}</h1>
                  <p className="subtitle">{tr.floorHelp}</p>
                </div>
                <div className="offline-pill">
                  {pendingCount ? `${pendingCount} ${tr.queued}` : tr.ready}
                </div>
              </div>
              <form className="floor-form" onSubmit={sendUpdate}>
                <label className="field-label">
                  {tr.order}
                  <select
                    value={updateOrder}
                    onChange={(e) => setUpdateOrder(e.target.value)}
                  >
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.po} · {o.style}
                      </option>
                    ))}
                  </select>
                </label>
                {orders.find((o) => o.id === updateOrder) && (
                  <div className="floor-context">
                    <span>
                      {orders.find((o) => o.id === updateOrder)?.stage}
                    </span>
                    <strong>
                      {fmt(
                        orders.find((o) => o.id === updateOrder)!.stage_done,
                      )}{" "}
                      / {fmt(orders.find((o) => o.id === updateOrder)!.qty)} pcs
                    </strong>
                  </div>
                )}
                <label className="field-label big-number">
                  {tr.pieces}
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="50000"
                    placeholder="0"
                    value={dailyQty}
                    onChange={(e) => setDailyQty(e.target.value)}
                  />
                </label>
                <label className="field-label">
                  {tr.issue}
                  <div className="note-input">
                    <textarea
                      rows={3}
                      placeholder={
                        lang === "ta"
                          ? "தமிழில் எழுதலாம்…"
                          : "Tamil or English is fine…"
                      }
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={1000}
                    />
                    <button
                      type="button"
                      title="Speak Tamil note"
                      onClick={startVoice}
                      className={recording ? "recording" : ""}
                    >
                      <Mic size={20} />
                    </button>
                  </div>
                </label>
                <label className="photo-upload">
                  <Camera size={20} />
                  <span>{photoName || tr.photo}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        try {
                          setPhotoData(await photoToData(f));
                          setPhotoName(f.name);
                        } catch (e) {
                          flash((e as Error).message);
                        }
                      }
                    }}
                  />
                </label>
                {photoData && (
                  <img
                    className="photo-preview"
                    src={photoData}
                    alt="Selected floor photo"
                  />
                )}
                <button className="primary send-button" disabled={busy}>
                  {busy ? tr.uploading : tr.send}
                  <Send size={18} />
                </button>
                <p className="form-footnote">
                  <WifiOff size={15} /> {tr.offlineHelp}
                </p>
              </form>
            </div>
          )}

          {screen === "new" && user?.role === "merchandiser" && (
            <div className="form-page">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">MERCHANDISING / SETUP</p>
                  <h1>New order</h1>
                  <p className="subtitle">
                    Create the PO and a milestone plan from the standard TNA
                    template.
                  </p>
                </div>
              </div>
              <form
                className="card order-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const sizes = Object.fromEntries(
                    Object.entries(newForm.sizes)
                      .filter(([, v]) => v !== "")
                      .map(([k, v]) => [k, Number(v)]),
                  );
                  const ok = await submit(
                    { action: "createOrder", ...newForm, sizes },
                    "Order created with TNA milestones.",
                  );
                  if (ok) {
                    setNewForm({
                      po: "",
                      buyerId: "B",
                      buyerName: "Company B · UK",
                      style: "",
                      color: "",
                      unitId: "Unit 1",
                      exFactory: "",
                      sizes: { S: "", M: "", L: "", XL: "" },
                    });
                    nav("board");
                  }
                }}
              >
                <div className="form-section">
                  <h2>Order details</h2>
                  <div className="form-grid">
                    <label>
                      PO number
                      <input
                        required
                        value={newForm.po}
                        onChange={(e) =>
                          setNewForm({ ...newForm, po: e.target.value })
                        }
                        placeholder="B-PO-88300"
                      />
                    </label>
                    <label>
                      Buyer
                      <select
                        value={newForm.buyerId}
                        onChange={(e) =>
                          setNewForm({
                            ...newForm,
                            buyerId: e.target.value,
                            buyerName:
                              e.target.value === "B"
                                ? "Company B · UK"
                                : "Company C · Germany",
                          })
                        }
                      >
                        <option value="B">Company B · UK</option>
                        <option value="C">Company C · Germany</option>
                      </select>
                    </label>
                    <label>
                      Style
                      <input
                        required
                        value={newForm.style}
                        onChange={(e) =>
                          setNewForm({ ...newForm, style: e.target.value })
                        }
                        placeholder="Men's crew neck tee"
                      />
                    </label>
                    <label>
                      Colour
                      <input
                        required
                        value={newForm.color}
                        onChange={(e) =>
                          setNewForm({ ...newForm, color: e.target.value })
                        }
                        placeholder="Navy"
                      />
                    </label>
                    <label>
                      Unit
                      <select
                        value={newForm.unitId}
                        onChange={(e) =>
                          setNewForm({ ...newForm, unitId: e.target.value })
                        }
                      >
                        {["Unit 1", "Unit 2", "Unit 3"].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Ex-factory
                      <input
                        required
                        type="date"
                        value={newForm.exFactory}
                        onChange={(e) =>
                          setNewForm({ ...newForm, exFactory: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="form-section">
                  <h2>Size quantities</h2>
                  <p>Enter pieces per size. The total is calculated for you.</p>
                  <div className="sizes-grid">
                    {Object.entries(newForm.sizes).map(([size, value]) => (
                      <label key={size}>
                        {size}
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={value}
                          onChange={(e) =>
                            setNewForm({
                              ...newForm,
                              sizes: {
                                ...newForm.sizes,
                                [size]: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <div className="total-line">
                    Total pieces{" "}
                    <strong>
                      {fmt(
                        Object.values(newForm.sizes).reduce(
                          (a, v) => a + (Number(v) || 0),
                          0,
                        ),
                      )}
                    </strong>
                  </div>
                </div>
                <div className="template-note">
                  <Clock3 size={18} />
                  <div>
                    <strong>Standard TNA template</strong>
                    <p>
                      Cutting, printing, stitching, washing, finishing, packing
                      and ex-factory dates are set from the ship date. Every
                      date can be adjusted with an audit reason.
                    </p>
                  </div>
                </div>
                <button className="primary" disabled={busy}>
                  Create order <ArrowRight size={17} />
                </button>
              </form>
            </div>
          )}

          {screen === "buyer" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">READ-ONLY / BUYER ACCESS</p>
                  <h1>Production progress</h1>
                  <p className="subtitle">
                    Milestones and floor photos for the orders you can view.
                  </p>
                </div>
                <div className="buyer-actions">
                  {user?.role === "merchandiser" && (
                    <select
                      className="buyer-switch"
                      value={previewBuyer}
                      onChange={(e) => setPreviewBuyer(e.target.value)}
                    >
                      <option value="B">Preview Company B</option>
                      <option value="C">Preview Company C</option>
                    </select>
                  )}
                  {user?.role === "merchandiser" && (
                    <button
                      className="secondary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${location.origin}/?view=buyer`,
                          );
                          flash(
                            "Buyer link copied. Buyer sign-in controls access.",
                          );
                        } catch {
                          flash("Copy is unavailable in this browser.");
                        }
                      }}
                    >
                      Copy buyer link
                    </button>
                  )}
                  <a
                    className="secondary"
                    href={
                      user?.role === "buyer"
                        ? "/api/export"
                        : `/api/export?buyer=${previewBuyer}`
                    }
                  >
                    <ArrowDownToLine size={15} /> Export
                  </a>
                </div>
              </div>
              <div className="buyer-notice">
                <ShieldCheck size={18} />
                {user?.role === "buyer"
                  ? "Your account is restricted to your buyer's orders."
                  : "Preview only. Buyer accounts are restricted on the server to their own orders."}
              </div>
              <div className="buyer-grid">
                {orders.filter(
                  (o) => user?.role === "buyer" || o.buyer_id === previewBuyer,
                ).length === 0 ? (
                  <div className="empty">
                    <h3>No orders yet</h3>
                    <p>
                      Progress will appear when an order is assigned to this
                      buyer.
                    </p>
                  </div>
                ) : (
                  orders
                    .filter(
                      (o) =>
                        user?.role === "buyer" || o.buyer_id === previewBuyer,
                    )
                    .map((o) => (
                      <div className="buyer-card" key={o.id}>
                        <div className="buyer-card-top">
                          <div>
                            <small>{o.po}</small>
                            <h2>{o.style}</h2>
                            <p>
                              {o.color} · {fmt(o.qty)} pieces
                            </p>
                          </div>
                          <span className="buyer-date">
                            Ex-factory
                            <br />
                            <strong>{dateLabel(o.ex_factory)}</strong>
                          </span>
                        </div>
                        <div className="buyer-progress">
                          <div className="progress">
                            <i
                              style={{
                                width: `${Math.min(100, (o.stage_done / o.qty) * 100)}%`,
                              }}
                            />
                          </div>
                          <span>
                            {o.stage} · {fmt(o.stage_done)} complete
                          </span>
                        </div>
                        {o.projection && (
                          <div className="buyer-warning">
                            <CircleAlert size={16} /> Production pace warning
                            confirmed by merchandising
                          </div>
                        )}
                        <div className="buyer-milestones">
                          {o.milestones.map((m) => (
                            <div key={m.id}>
                              <span
                                className={m.name === o.stage ? "now" : ""}
                              />
                              <span>{m.name}</span>
                              <strong>{dateLabel(m.due_date)}</strong>
                            </div>
                          ))}
                        </div>
                        {o.history?.length > 0 && (
                          <div className="buyer-history">
                            <h3>Schedule changes</h3>
                            {o.history.map((h) => (
                              <div key={h.id}>
                                <strong>{h.field}</strong>
                                <span>
                                  {dateLabel(h.old_date)} →{" "}
                                  {dateLabel(h.new_date)}
                                </span>
                                <small>{h.reason}</small>
                              </div>
                            ))}
                          </div>
                        )}
                        {o.updates.filter((u) => u.photo_key).length > 0 && (
                          <div className="buyer-photos">
                            <h3>Latest floor photos</h3>
                            <div>
                              {o.updates
                                .filter((u) => u.photo_key)
                                .slice(0, 3)
                                .map((u) => (
                                  <img
                                    key={u.id}
                                    src={`/api/photo/${u.id}`}
                                    alt={`Production progress on ${u.update_date}`}
                                  />
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </div>
      </main>
      {notice && (
        <div className="toast">
          <Check size={17} />
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
