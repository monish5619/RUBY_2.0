/* ============================================================
   RUBY — shared UI shell & utilities.
   Injects the global navigation + footer on every page,
   provides toast/modal/confirm components and helpers.
   ============================================================ */
const RubyUI = (() => {
  /* --------------------- Escape / sanitize --------------------- */
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* --------------------- Brand logo ---------------------
     Single source of truth: the four pink diamonds +
     pink center-circle RUBY mark lives in
     /assets/logo/ruby-logo-icon.svg. Every page renders
     the same asset — nothing is duplicated here. */
  function logoMark(sizeClass) {
    return `<span class="${sizeClass} block shrink-0"><img src="/assets/logo/ruby-logo-icon.svg" alt="" class="w-full h-full select-none" draggable="false"/></span>`;
  }

  function setHtml(sel, html) {
    const el = document.querySelector(sel);
    if (el) el.innerHTML = html;
  }

  /* ------------------------- Toasts ------------------------- */
  let toastRoot;
  function ensureToastRoot() {
    if (!document.getElementById("toast-root")) {
      const div = document.createElement("div");
      div.id = "toast-root";
      div.setAttribute("aria-live", "polite");
      document.body.appendChild(div);
    }
    toastRoot = document.getElementById("toast-root");
  }
  function toast(type, message, ms = 4200) {
    ensureToastRoot();
    const icons = { success: "check", error: "close", info: "info", warn: "warning" };
    const title = { success: "Success", error: "Something went wrong", info: "Heads up", warn: "Attention needed" };
    const t = icons[type] ? type : "info";
    const el = document.createElement("div");
    el.className = `toast ${t}`;
    el.style.setProperty("--toast-ms", `${ms}ms`);
    el.setAttribute("role", "status");
    el.innerHTML = `
      <div class="toast-icon"><span class="material-symbols-outlined">${icons[t] || "info"}</span></div>
      <div class="toast-body">
        <p class="toast-title">${esc(title[t])}</p>
        <p class="toast-msg">${esc(message)}</p>
      </div>
      <button class="toast-close" aria-label="Dismiss notification"><span class="material-symbols-outlined text-[18px]">close</span></button>
      <span class="toast-bar"></span>`;
    toastRoot.appendChild(el);
    const remove = () => {
      if (!el.parentNode) return;
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 320);
    };
    el.querySelector(".toast-close").addEventListener("click", remove);
    setTimeout(() => { el.classList.add("shrink"); }, 60);
    setTimeout(remove, ms);
  }

  /* ------------------------- Modals ------------------------- */
  function openModal(html, opts = {}) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.innerHTML = `<div class="modal-card" style="max-width:${opts.maxWidth || "30rem"}">
      <button class="modal-close" aria-label="Close dialog"><span class="material-symbols-outlined">close</span></button>
      ${html}
    </div>`;
    document.body.appendChild(backdrop);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = () => {
      backdrop.remove();
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", escHandler);
    };
    const escHandler = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", escHandler);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop && opts.closeOnBackdrop !== false) close();
    });
    backdrop.querySelector(".modal-close").addEventListener("click", close);
    const focusable = backdrop.querySelector("button,input,select,textarea,[tabindex]");
    if (focusable) setTimeout(() => focusable.focus(), 50);
    return close;
  }

  async function confirm(options) {
    const { title = "Are you sure?", message = "", confirmLabel = "Confirm", danger = false, cancelLabel = "Cancel" } = options;
    return new Promise((resolve) => {
      const close = openModal(`
        <div class="text-center">
          <div class="w-16 h-16 mx-auto rounded-2xl ${danger ? "bg-error-container text-error" : "bg-secondary/10 text-secondary"} flex items-center justify-center mb-4 shadow-soft">
            <span class="material-symbols-outlined text-[30px]">${danger ? "warning" : "help"}</span>
          </div>
          <h3 class="font-headline-md text-[22px] text-on-surface mb-2">${esc(title)}</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant mb-7 leading-relaxed">${message}</p>
          <div class="grid grid-cols-2 gap-3">
            <button class="btn btn-ghost border border-outline-variant" data-cancel>${esc(cancelLabel)}</button>
            <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${esc(confirmLabel)}</button>
          </div>
        </div>`, { maxWidth: "26rem" });
      document.querySelectorAll(".modal-backdrop button[data-ok]").forEach((b) => b.addEventListener("click", () => { close(); resolve(true); }));
      document.querySelectorAll(".modal-backdrop button[data-cancel]").forEach((b) => b.addEventListener("click", () => { close(); resolve(false); }));
    });
  }

  /* --------------------- Loading button --------------------- */
  function setLoading(btn, loading, label) {
    if (!btn) return;
    if (loading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add("opacity-80", "cursor-wait");
      btn.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin align-middle mr-2 shrink-0"></span><span>${label || "Processing…"}</span>`;
    } else {
      btn.disabled = false;
      btn.classList.remove("opacity-80", "cursor-wait");
      if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
    }
  }

  /* --------------------- Status helpers --------------------- */
  function statusBadge(status) {
    const map = {
      PENDING_VERIFICATION: ["pending", "hourglass_top", "Pending Verification"],
      VERIFICATION_PENDING: ["pending", "hourglass_top", "Verification Pending"],
      SUBMITTED: ["review", "rule", "Submitted"],
      AI_VERIFIED: ["review", "psychology_alt", "AI Verified"],
      HOSPITAL_VERIFIED: ["verified", "local_hospital", "Hospital Verified"],
      APPROVED: ["verified", "verified", "Approved"],
      FUNDRAISING: ["fundraising", "favorite", "Fundraising"],
      FUNDED: ["funded", "check_circle", "Funded"],
      DISBURSED: ["disbursed", "account_balance_wallet", "Disbursed"],
      REJECTED: ["rejected", "block", "Rejected"],
      MORE_INFO_REQUESTED: ["pending", "rate_review", "More Info Requested"],
      ESCROW: ["escrow", "lock", "Escrow"],
      SETTLED: ["disbursed", "verified_user", "Settled"],
      PENDING: ["pending", "schedule", "Pending"],
      UNDER_REVIEW: ["review", "manage_search", "Under Review"],
      PARTNER_APPROVED: ["verified", "health_and_safety", "Partner Approved"],
      VERIFIED: ["verified", "verified", "Verified"],
      LOW_RISK: ["verified", "verified", "Low Risk"],
      MEDIUM_RISK: ["pending", "warning", "Medium Risk"],
      HIGH_RISK: ["risk", "error", "High Risk"],
      CRITICAL: ["urgent", "emergency", "Critical"],
      HIGH: ["urgent", "warning", "High"],
      MEDIUM: ["pending", "schedule", "Medium"],
      ACTIVE: ["fundraising", "favorite", "Active"]
    };
    const [cls, icon, label] = map[status] || ["pending", "help", status || "—"];
    return `<span class="status-badge ${cls}"><span class="material-symbols-outlined text-[13px]">${icon}</span>${label}</span>`;
  }

  function progressPct(raised, target) {
    const p = target > 0 ? (raised / target) * 100 : 0;
    return Math.min(100, Math.max(0, p));
  }

  /* Visible label for the assistance-layer AI analysis. */
  function aiLabel() {
    return `<span class="ai-verify-label" title="Assistance layer — not a medical diagnosis or a final fraud decision"><span class="material-symbols-outlined">auto_awesome</span>AI-Assisted Prototype Verification</span>`;
  }

  function progressBar(raised, target) {
    const p = progressPct(raised, target);
    return `
      <div class="progress-track" role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-fill ${p >= 100 ? "green" : ""}" style="width:${p}%"></div>
      </div>`;
  }

  function skeleton(lines = 3) {
    return `<div class="space-y-3" role="status" aria-label="Loading"><span class="sr-only">Loading…</span>${Array.from({ length: lines }).map(() => '<div class="skeleton h-16"></div>').join("")}</div>`;
  }

  function skeletonCard(lines = 4) {
    return `<div class="rounded-2xl border border-line-soft bg-white p-5 space-y-3" role="status" aria-label="Loading">
      <div class="flex items-center gap-3">
        <div class="skeleton w-12 h-12 rounded-full"></div>
        <div class="flex-1 space-y-2"><div class="skeleton h-4 w-2/3"></div><div class="skeleton h-3 w-1/3"></div></div>
      </div>
      ${Array.from({ length: Math.max(1, lines - 1) }).map(() => '<div class="skeleton h-4 w-full"></div>').join("")}
    </div>`;
  }

  function emptyState(opts = {}) {
    const { icon = "inbox", title = "Nothing here yet", text = "Items you add will appear here.", action = "" } = opts;
    return `<div class="empty-state">
      <div class="es-icon"><span class="material-symbols-outlined">${icon}</span></div>
      <p class="es-title">${esc(title)}</p>
      <p class="es-text">${esc(text)}</p>
      ${action}
    </div>`;
  }

  function errorState(opts = {}) {
    const { icon = "error", title = "Something went wrong", text = "Please try again.", retry } = opts;
    return `<div class="error-state">
      <div class="es-icon"><span class="material-symbols-outlined">${icon}</span></div>
      <p class="es-title">${esc(title)}</p>
      <p class="es-text">${esc(text)}</p>
      ${retry ? `<button class="btn btn-outline mt-2" onclick="(this.closest('.error-state').parentElement.getAttribute('data-reload')?.length || location.reload())">Try again</button>` : ""}
    </div>`;
  }

  /* ------------------------- Nav ------------------------- */
  function navLinks(authed) {
    const s = Auth.session();
    const base = [
      ["/index.html", "Home", "home"],
      ["/pages/cases.html", "Find Cases", "search"],
      ["/pages/how.html", "How RUBY Works", "account_tree"],
      ["/pages/verification.html", "Verification", "verified_user"],
      ["/pages/hospital-register.html", "Hospital Partners", "local_hospital"],
      ["/pages/about.html", "About", "info"]
    ];
    let right = [];
    if (!authed) {
      right = [
        { label: "Emergency", icon: "emergency", style: "emergency", action: "emergency" }
      ];
    } else {
      const dash = Auth.dashboardUrl();
      const role = Auth.role();
      const profileUrl = role === "patient" ? "/pages/patient-dashboard.html#profile" : dash;
      const notifUrl = role === "patient" ? "/pages/patient-dashboard.html#notifications" : role === "hospital" ? "/pages/hospital-dashboard.html#notifications" : role === "admin" ? "/pages/admin.html#overview" : "/pages/ledger.html";
      right = [
        { href: dash, label: "Dashboard", icon: "dashboard", style: "ghost", active: true },
        ...(role === "patient" ? [{ href: "/pages/patient-dashboard.html#cases", label: "My Cases", icon: "folder_shared", style: "ghost" }] : []),
        { href: "/pages/ledger.html", label: "Donations", icon: "account_balance_wallet", style: "ghost" },
        { href: notifUrl, label: "Notifications", icon: "notifications", style: "ghost", badge: "2" },
        { href: profileUrl, label: "Profile", icon: "account_circle", style: "ghost" },
        { label: "Sign Out", icon: "logout", style: "signout", action: "signout" }
      ];
    }
    return { base, right };
  }

  function renderNav() {
    const mount = document.getElementById("nav-root");
    if (!mount) return;
    const authed = Auth.isAuthenticated();
    const { base, right } = navLinks(authed);
    const current = document.body.dataset.page || "";

    const linkCls = (href) => {
      const isActive = (href === "/index.html" && current === "home") || (href.includes(current) && current);
      return `nav-link ${isActive ? "active" : ""}`;
    };

    const desktopBase = base.map((l) => `<a class="${linkCls(l[0])}" href="${l[0]}">${l[1]}</a>`).join("");
    const rightBtns = right.map((l) => {
      if (l.action === "emergency") {
        return `<button class="btn btn-emergency hidden md:inline-flex px-5 py-2.5" data-action="emergency"><span class="material-symbols-outlined text-[18px]">emergency</span>Emergency</button>`;
      }
      if (l.action === "signout") {
        return `<button class="hidden md:inline-flex nav-link text-on-surface-variant hover:text-error" data-action="signout"><span class="material-symbols-outlined text-[18px]">logout</span>Sign Out</button>`;
      }
      if (l.style === "ghost") {
        const activeCls = l.active ? "active" : "";
        const hidden = authed ? "hidden lg:inline-flex" : "hidden md:inline-flex";
        return `<a class="${hidden} nav-link ${activeCls}" href="${l.href}">${l.icon ? `<span class="material-symbols-outlined text-[18px]">${l.icon}</span>` : ""}${l.label}${l.badge ? `<span class="w-4 h-4 rounded-full bg-error text-on-error text-[9px] flex items-center justify-center font-bold ml-0.5">${l.badge}</span>` : ""}</a>`;
      }
      return "";
    }).join("");

    mount.innerHTML = `
      <header class="sticky top-0 z-50 w-full border-b border-white/40" id="main-nav">        <div class="flex items-center justify-between w-full max-w-7xl mx-auto h-16 md:h-[4.5rem] px-container-padding-mobile md:px-container-desktop">
          <div class="flex items-center gap-6 min-w-0">
            <a class="nav-brand flex items-center gap-2.5 group shrink-0" href="/index.html" aria-label="RUBY home">
              <span class="transition-transform duration-200 group-hover:scale-110">${logoMark("w-9 h-9")}</span>
              <span class="font-headline-md text-[19px] font-extrabold tracking-tighter ruby-wordmark">RUBY</span>
            </a>
            <nav class="hidden md:flex items-center gap-0.5" aria-label="Primary">
              ${desktopBase}
            </nav>
          </div>
          <div class="flex items-center gap-2">
            <span id="demo-mode-pill" class="hidden items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold font-label-caps text-label-caps" title="Backend offline — showing local demo data">
              <span class="material-symbols-outlined text-[13px]">wifi_off</span>Demo mode
            </span>
            <span class="inline-flex items-center self-center" title="Prototype online"><span class="live-dot"></span></span>
            ${rightBtns}
            ${!authed ? `<a class="hidden sm:inline-flex btn btn-primary px-5 py-2.5" href="/pages/login.html"><span class="material-symbols-outlined text-[18px]">login</span>Sign In</a>` : ""}
            <button class="md:hidden p-2 rounded-lg hover:bg-surface-container text-on-surface" data-action="menu" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
              <span class="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
        <div id="mobile-menu" class="hidden md:hidden border-t border-outline-variant/30 bg-surface/95 backdrop-blur-xl">
          <div class="px-container-padding-mobile py-4 flex flex-col gap-1">
            ${base.map((l) => `<a class="${current === l[0].split("/").pop().replace(".html", "") ? "text-primary bg-primary/5" : "text-on-surface-variant hover:bg-surface-container"} px-3 py-3 rounded-xl font-label-caps text-label-caps flex items-center gap-3" href="${l[0]}"><span class="material-symbols-outlined text-[18px]">${l[2]}</span>${l[1]}</a>`).join("")}
            <div class="h-px my-2 bg-outline-variant/50"></div>
            ${right.map((l) => {
              if (l.action === "emergency") return `<button class="flex items-center gap-3 px-3 py-3 rounded-xl bg-primary text-on-primary font-label-caps text-label-caps" data-action="emergency"><span class="material-symbols-outlined text-[18px]">emergency</span>Emergency</button>`;
              if (l.action === "signout") return `<button class="flex items-center gap-3 px-3 py-3 rounded-xl text-error font-label-caps text-label-caps" data-action="signout"><span class="material-symbols-outlined text-[18px]">logout</span>Sign Out</button>`;
              if (l.href) return `<a class="flex items-center gap-3 px-3 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container font-label-caps text-label-caps" href="${l.href}"><span class="material-symbols-outlined text-[18px]">${l.icon}</span>${l.label}</a>`;
              return "";
            }).join("")}
            ${!authed ? `<a class="flex items-center gap-3 px-3 py-3 rounded-xl bg-primary text-on-primary font-label-caps text-label-caps" href="/pages/login.html"><span class="material-symbols-outlined text-[18px]">login</span>Sign In</a>` : ""}
          </div>
        </div>
      </header>`;

    bindNavActions();
    showDemoMode();
  }

  /* Show a pill when the backend is unreachable and the app
     is running on local demo data. */
  function showDemoMode() {
    const pill = document.getElementById("demo-mode-pill");
    if (!pill) return;
    API.detectMode().then((mode) => {
      pill.classList.toggle("hidden", mode !== "demo");
      pill.classList.toggle("flex", mode === "demo");
    }).catch(() => {});
  }

  function bindNavActions() {
    document.querySelectorAll('[data-action="menu"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const menu = document.getElementById("mobile-menu");
        const open = menu.classList.toggle("hidden");
        btn.setAttribute("aria-expanded", String(!open));
      });
    });
    document.querySelectorAll('[data-action="emergency"]').forEach((btn) => {
      btn.addEventListener("click", showEmergency);
    });
    document.querySelectorAll('[data-action="signout"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await confirm({ title: "Sign out of RUBY?", message: "You will need to sign in again to access your dashboard.", confirmLabel: "Sign out", danger: true });
        if (ok) Auth.logout();
      });
    });
  }

  function showEmergency() {
    openModal(`
      <div>
        <div class="w-16 h-16 rounded-2xl bg-error-container text-error flex items-center justify-center mb-5 shadow-soft">
          <span class="material-symbols-outlined text-[32px]">emergency</span>
        </div>
        <h3 class="font-headline-md text-headline-md text-on-surface mb-1">Medical Emergency?</h3>
        <p class="font-body-sm text-body-sm text-on-surface-variant mb-5 leading-relaxed">RUBY is a crowdfunding platform, not a health service. If this is a medical emergency, please contact local emergency services immediately.</p>
        <div class="space-y-2 rounded-2xl bg-surface-container p-4 font-data-mono text-data-mono text-sm border border-outline-variant/40">
          <div class="flex justify-between"><span>National Emergency</span><span class="font-bold">112</span></div>
          <div class="flex justify-between"><span>Ambulance</span><span class="font-bold">108</span></div>
          <div class="flex justify-between"><span>Ambulance (AIIMS)</span><span class="font-bold">102</span></div>
        </div>
        <p class="mt-4 text-[11px] text-on-surface-variant">Prototype environment — helpline numbers shown for demonstration only.</p>
      </div>`, { maxWidth: "26rem" });
  }

  /* ------------------------- Footer ------------------------- */
  function renderFooter() {
    const mount = document.getElementById("footer-root");
    if (!mount) return;
    mount.innerHTML = `
      <footer class="bg-surface-container-highest border-t border-outline-variant/60 mt-auto">
        <div class="w-full py-10 md:py-12 px-container-padding-mobile md:px-container-desktop max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div class="flex flex-col items-center md:items-start gap-2.5">
            <a class="nav-brand flex items-center gap-2.5 font-headline-md text-[19px] font-extrabold tracking-tighter ruby-wordmark" href="/index.html">
              ${logoMark("w-8 h-8")}RUBY
            </a>
            <p class="font-body-sm text-body-sm text-on-surface-variant max-w-xs text-center md:text-left">© 2026 RUBY — AI-assisted medical crowdfunding. Verified cases, transparent funding, hopeful outcomes.</p>
          </div>
          <div class="flex flex-wrap justify-center gap-x-6 gap-y-3 md:col-span-2 lg:justify-end">
            <a class="link-underline font-label-caps text-label-caps" href="/pages/about.html">Trust &amp; Safety</a>
            <a class="link-underline font-label-caps text-label-caps" href="/pages/about.html">Privacy</a>
            <a class="link-underline font-label-caps text-label-caps" href="/pages/ledger.html">Transparency Ledger</a>
            <a class="link-underline font-label-caps text-label-caps" href="/pages/about.html">About</a>
            <a class="link-underline font-label-caps text-label-caps" href="/pages/cases.html">Support a Case</a>
          </div>
        </div>
      </footer>`;
  }

  /* ------------------------- Init ------------------------- */
  function init() {
    renderNav();
    renderFooter();
    const em = document.getElementById("find-emergency-modal");
    if (em) em.innerHTML = "";
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Global live badge timers / helpers
    const nav = document.getElementById("main-nav");
    if (nav) {
      const onScroll = () => nav.classList.toggle("nav-scrolled", window.scrollY > 8);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    document.body.addEventListener("click", (e) => {
      const el = e.target.closest('[data-demo-link]');
      if (el) {
        const href = el.getAttribute("href");
        if (href === "#" || !href) {
          e.preventDefault();
          toast("info", "This link is a placeholder in the prototype — use the main navigation instead.");
        }
      }
    });
  }

  return {
    esc, setHtml, toast, openModal, confirm, setLoading, statusBadge,
    progressBar, progressPct, aiLabel, skeleton, skeletonCard, emptyState, errorState,
    init, showEmergency
  };
})();

document.addEventListener("DOMContentLoaded", RubyUI.init);