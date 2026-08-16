/* ============================================================
   RUBY — admin console.
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const dash = document.getElementById("admin-dash");
  const loginReq = document.getElementById("admin-login-required");
  const session = Auth.session();
  if (!session || session.role !== "admin") {
    if (loginReq) loginReq.classList.remove("hidden");
    if (dash) dash.classList.add("hidden");
    return;
  }
  if (loginReq) loginReq.classList.add("hidden");
  if (dash) dash.classList.remove("hidden");

  /* ---------- tab switching ---------- */
  function activateTab(name) {
    const tab = document.querySelector(`.admin-tab[data-tab="${name}"]`);
    if (!tab) return;
    document.querySelectorAll(".admin-tab").forEach((t) => {
      t.className = "admin-tab px-5 py-2.5 rounded-xl font-label-caps text-label-caps text-on-surface-variant hover:bg-surface-container";
    });
    tab.className = "admin-tab px-5 py-2.5 rounded-xl font-label-caps text-label-caps bg-primary text-on-primary";
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.add("hidden"));
    document.getElementById(`tab-${name}`).classList.remove("hidden");
    renderTab(name);
  }
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
      history.replaceState(null, "", `#${tab.dataset.tab}`);
    });
  });
  window.addEventListener("hashchange", () => activateTab(location.hash.replace("#", "") || "overview"));
  activateTab(location.hash.replace("#", "") || "overview");

  async function load() {
    let appeals = [], hospitals = [], donations = [], transactions = [], patients = [];
    try { appeals = await API.getAppeals(); } catch {}
    try { hospitals = await API.getHospitals(); } catch {}
    try { donations = await API.getDonations(); } catch {}
    try { transactions = await API.getTransactions(); } catch {}
    try { patients = await API.getPatients(); } catch {}
    return { appeals, hospitals, donations, transactions, patients };
  }

  async function renderTab(tab) {
    const d = await load();
    const box = document.getElementById(`tab-${tab}`);

    const overview = () => {
      const active = d.appeals.filter((c) => ["FUNDRAISING", "FUNDED"].includes(c.status));
      const pendingApproval = d.appeals.filter((c) => ["HOSPITAL_VERIFIED", "AI_VERIFIED"].includes(c.verificationStatus));
      const pendingHospitals = d.hospitals.filter((h) => h.verificationStatus === "UNDER_REVIEW");
      const escrowTotal = d.donations.filter((x) => x.status === "ESCROW").reduce((s, x) => s + Number(x.amount), 0);
      const disbursedTotal = d.appeals.reduce((s, c) => s + (c.disbursements || []).filter((x) => x.status === "DISBURSED").reduce((y, z) => y + Number(z.amount || 0), 0), 0);
      const stats = [
        { icon: "verified_user", label: "Verified Patients", value: String(d.patients.filter((p) => p.verificationStatus === "VERIFIED").length) },
        { icon: "campaign", label: "Active Appeals", value: String(active.length) },
        { icon: "hourglass_top", label: "Pending Approval", value: String(pendingApproval.length) },
        { icon: "local_hospital", label: "Verified Hospitals", value: String(d.hospitals.filter((h) => h.partnerStatus === "active").length) },
        { icon: "local_hospital", label: "Hospitals Under Review", value: String(pendingHospitals.length) },
        { icon: "lock", label: "Escrow (Prototype)", value: inrCompact(escrowTotal) },
        { icon: "account_balance_wallet", label: "Disbursed", value: inrCompact(disbursedTotal) }
      ];
document.getElementById("ad-stats").innerHTML = stats.map((s) => `
        <div class="stat-tile">
          <span class="stat-icon"><span class="material-symbols-outlined">${s.icon}</span></span>
          <p class="font-data-mono text-[18px] font-bold mt-1">${s.value}</p>
          <p class="text-[11px] text-on-surface-variant mt-0.5">${s.label}</p>
        </div>`).join("");
      box.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="panel-dark">
            <h3 class="font-headline-md text-[16px] mb-4 flex items-center gap-2"><span class="material-symbols-outlined text-secondary-fixed-dim">monitoring</span>Platform pulse</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="rounded-2xl bg-white/5 p-4"><p class="font-data-mono text-[22px] font-bold text-secondary-fixed-dim">${d.appeals.length}</p><p class="text-[12px] text-surface/60">Total appeals</p></div>
              <div class="rounded-2xl bg-white/5 p-4"><p class="font-data-mono text-[22px] font-bold text-secondary-fixed-dim">${d.donations.length}</p><p class="text-[12px] text-surface/60">Donations</p></div>
              <div class="rounded-2xl bg-white/5 p-4"><p class="font-data-mono text-[22px] font-bold text-secondary-fixed-dim">${inrCompact(d.donations.reduce((s, x) => s + Number(x.amount), 0))}</p><p class="text-[12px] text-surface/60">Total donated</p></div>
              <div class="rounded-2xl bg-white/5 p-4"><p class="font-data-mono text-[22px] font-bold text-secondary-fixed-dim">${inrCompact(disbursedTotal)}</p><p class="text-[12px] text-surface/60">Total disbursed</p></div>
            </div>
          </div>
          <div class="panel p-6">
            <h3 class="font-headline-md text-[16px] mb-4">Recent ledger activity</h3>
            <div class="space-y-2 max-h-[260px] overflow-y-auto no-scrollbar">
              ${d.transactions.slice(0, 8).map((t) => `
                <div class="flex items-center justify-between text-[12px] py-1.5 border-b border-outline-variant/20">
                  <span class="font-data-mono text-secondary truncate">${RubyUI.esc(t.transactionId)}</span>
                  <span class="text-on-surface-variant truncate">${RubyUI.esc(t.caseId)}</span>
                  <span class="font-data-mono font-bold">${inr(t.amount)}</span>
                  <span>${RubyUI.statusBadge(t.status)}</span>
                </div>`).join("") || "No transactions yet."}
            </div>
          </div>
        </div>`;
    };

    const appeals = () => {
      const rows = d.appeals.map((c) => `
        <div class="card p-5 flex flex-col lg:flex-row lg:items-center gap-4">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">${initials(c.patientName)}</div>
            <div class="min-w-0">
              <p class="font-headline-md text-[15px] truncate">${RubyUI.esc(c.treatment)}</p>
              <p class="font-data-mono text-[12px] text-secondary">${RubyUI.esc(c.id)} · ${RubyUI.esc(c.patientName)} · ${inr(c.targetAmount)}</p>
              <div class="flex gap-1.5 mt-1 flex-wrap">${RubyUI.statusBadge(c.status)}${RubyUI.statusBadge(c.verificationStatus)}</div>
            </div>
          </div>
          <div class="flex gap-2 shrink-0">
            ${["HOSPITAL_VERIFIED", "AI_VERIFIED"].includes(c.verificationStatus) ? `<button class="btn bg-tertiary text-on-tertiary px-4 py-2.5" data-averify="${c.id}"><span class="material-symbols-outlined text-[16px]">check</span>Approve</button>` : ""}
            ${["REJECTED", "APPROVED", "FUNDRAISING", "FUNDED", "DISBURSED"].includes(c.status) ? "" : `<button class="btn btn-danger px-4 py-2.5" data-areject="${c.id}"><span class="material-symbols-outlined text-[16px]">close</span>Reject</button>`}
            <a href="/pages/case-details.html?id=${encodeURIComponent(c.id)}" class="btn btn-outline px-4 py-2.5"><span class="material-symbols-outlined text-[16px]">open_in_new</span>View</a>
          </div>
        </div>`).join("");
      box.innerHTML = `<div class="space-y-3">${rows || RubyUI.emptyState({ icon: "campaign", title: "No appeals", text: "Appeals will appear here." })}</div>`;
    };

    const hospitals = () => {
      const rows = d.hospitals.map((h) => `
        <div class="card p-5 flex flex-col lg:flex-row lg:items-center gap-4">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center font-bold">${initials(h.name)}</div>
            <div class="min-w-0">
              <p class="font-headline-md text-[15px] truncate">${RubyUI.esc(h.name)}</p>
              <p class="font-data-mono text-[12px] text-secondary">${RubyUI.esc(h.registrationNumber)} · ${RubyUI.esc(h.city)}</p>
              <div class="flex gap-1.5 mt-1 flex-wrap">${RubyUI.statusBadge(h.verificationStatus)}<span class="status-badge verified">Bank •••• ${h.bankLast4 || "____"}</span></div>
            </div>
          </div>
          <div class="flex gap-2 shrink-0">
            ${h.verificationStatus === "UNDER_REVIEW" ? `<button class="btn bg-tertiary text-on-tertiary px-4 py-2.5" data-happrove="${h.id}"><span class="material-symbols-outlined text-[16px]">check</span>Approve partner</button>` : ""}
            ${h.verificationStatus === "UNDER_REVIEW" ? `<button class="btn btn-danger px-4 py-2.5" data-hreject="${h.id}"><span class="material-symbols-outlined text-[16px]">close</span>Reject</button>` : ""}
          </div>
        </div>`).join("");
      box.innerHTML = `<div class="space-y-3">${rows || RubyUI.emptyState({ icon: "local_hospital", title: "No hospitals yet", text: "Registered partners will appear here." })}</div>`;
    };

    const disbursements = () => {
      const rows = d.appeals.filter((c) => (c.disbursements || []).length || (c.milestones || []).some((m) => m.status === "ESCROW" || m.status === "PENDING"))
        .map((c) => `
        <div class="card p-5">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <p class="font-headline-md text-[15px]">${RubyUI.esc(c.treatment)}</p>
              <p class="font-data-mono text-[12px] text-secondary">${RubyUI.esc(c.id)}</p>
            </div>
            <div class="flex gap-1.5">${RubyUI.statusBadge(c.status)}</div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${(c.milestones || []).map((m) => `
              <div class="rounded-xl bg-surface-container p-4 text-[13px] border border-outline-variant/30">
                <div class="flex items-center justify-between mb-1"><span class="font-semibold">${RubyUI.esc(m.label)}</span>${RubyUI.statusBadge(m.status)}</div>
                <div class="flex items-center justify-between mt-2">
                  <span class="font-data-mono">${inr(m.amount)}</span>
                  ${m.status === "ESCROW" || m.status === "PENDING" ? `<button class="link-underline text-[12px] font-label-caps font-bold" data-dapprove="${c.id}" data-amount="${m.amount}" data-milestone="${RubyUI.esc(m.label)}">Approve disbursement</button>` : ""}
                </div>
              </div>`).join("")}
            ${(c.disbursements || []).filter((x) => x.status === "DISBURSED").map((x) => `
              <div class="rounded-xl bg-tertiary-container/10 border border-tertiary-container/20 p-4 text-[13px]">
                <div class="flex items-center justify-between"><span class="font-semibold">${RubyUI.esc(x.milestone)}</span><span class="status-badge disbursed">Disbursed</span></div>
                <div class="font-data-mono mt-2">${inr(x.amount)} · ${fmtDateTime(x.disbursedAt)}</div>
              </div>`).join("")}
          </div>
        </div>`).join("");
      box.innerHTML = `<div class="space-y-3">${rows || RubyUI.emptyState({ icon: "account_balance_wallet", title: "No milestones awaiting disbursement", text: "Cashed-out escrow milestones will appear here." })}</div>`;
    };

    const patients = () => {
      const rows = d.patients.map((p) => `
        <div class="card p-4 flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">${initials(p.name)}</div>
          <div class="flex-1 min-w-0">
            <p class="font-headline-md text-[14px]">${RubyUI.esc(p.name)}</p>
            <p class="font-data-mono text-[12px] text-secondary">${RubyUI.esc(p.rupId)}</p>
          </div>
          <div class="flex gap-1.5 flex-wrap">${RubyUI.statusBadge(p.verificationStatus)}<span class="status-badge verified">Score ${p.verificationScore}</span></div>
        </div>`).join("");
      box.innerHTML = `<div class="space-y-3">${rows || RubyUI.emptyState({ icon: "group", title: "No patients", text: "Registered patients will appear here." })}</div>`;
    };

    const donations = () => {
      const rows = d.donations.map((x) => `
        <div class="card p-4 flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="font-data-mono text-[13px] text-secondary truncate">${RubyUI.esc(x.transactionId)}</p>
            <p class="font-data-mono text-[12px] truncate">${RubyUI.esc(x.caseId)} · ${RubyUI.esc(x.donorName || x.donorLabel)}</p>
          </div>
          <div class="flex items-center gap-2">${inr(x.amount)}${RubyUI.statusBadge(x.status)}</div>
        </div>`).join("");
      box.innerHTML = `<div class="space-y-3">${rows || RubyUI.emptyState({ icon: "savings", title: "No donations", text: "Donations will appear here." })}</div>`;
    };

    ({ overview, appeals, hospitals, disbursements, patients, donations }[tab] || overview)();
  }

  renderTab("overview");

  /* ---------- action handlers ---------- */
  document.body.addEventListener("click", async (e) => {
    if (document.body.dataset.page !== "admin") return;
    const aBtn = e.target.closest("[data-averify]");
    if (aBtn) {
      const ok = await RubyUI.confirm({ title: "Approve and publish this appeal?", message: "The case will go live for public fundraising.", confirmLabel: "Approve & publish" });
      if (!ok) return;
      RubyUI.setLoading(aBtn, true, "…");
      try {
        await API.setAppealStatus(aBtn.dataset.averify, "APPROVED");
        RubyUI.toast("success", "Appeal approved & published ✓");
        setTimeout(() => renderTab(document.querySelector(".admin-tab.bg-primary")?.dataset.tab || "overview"), 500);
      } catch { RubyUI.setLoading(aBtn, false); RubyUI.toast("error", "Action failed — try again."); }
      return;
    }
    const rBtn = e.target.closest("[data-areject]");
    if (rBtn) {
      const ok = await RubyUI.confirm({ title: "Reject this appeal?", message: "The appeal will be rejected and closed.", confirmLabel: "Reject", danger: true });
      if (!ok) return;
      RubyUI.setLoading(rBtn, true, "…");
      try {
        await API.setAppealStatus(rBtn.dataset.areject, "REJECTED");
        RubyUI.toast("success", "Appeal rejected");
        setTimeout(() => renderTab(document.querySelector(".admin-tab.bg-primary")?.dataset.tab || "overview"), 500);
      } catch { RubyUI.setLoading(rBtn, false); RubyUI.toast("error", "Action failed — try again."); }
      return;
    }
    const haBtn = e.target.closest("[data-happrove]");
    if (haBtn) {
      const ok = await RubyUI.confirm({ title: "Approve this hospital partner?", message: "The hospital will be verified and marked as an active partner.", confirmLabel: "Approve partner" });
      if (!ok) return;
      RubyUI.setLoading(haBtn, true, "…");
      try {
        await API.setHospitalStatus(haBtn.dataset.happrove, "PARTNER_APPROVED");
        RubyUI.toast("success", "Hospital partner approved ✓");
        setTimeout(() => renderTab("hospitals"), 500);
      } catch { RubyUI.setLoading(haBtn, false); RubyUI.toast("error", "Action failed — try again."); }
      return;
    }
    const hrBtn = e.target.closest("[data-hreject]");
    if (hrBtn) {
      const ok = await RubyUI.confirm({ title: "Reject this hospital partner?", message: "The partnership request will be rejected.", confirmLabel: "Reject", danger: true });
      if (!ok) return;
      RubyUI.setLoading(hrBtn, true, "…");
      try {
        await API.setHospitalStatus(hrBtn.dataset.hreject, "REJECTED");
        RubyUI.toast("success", "Partnership rejected");
        setTimeout(() => renderTab("hospitals"), 500);
      } catch { RubyUI.setLoading(hrBtn, false); RubyUI.toast("error", "Action failed — try again."); }
      return;
    }
    const dBtn = e.target.closest("[data-dapprove]");
    if (dBtn) {
      const ok = await RubyUI.confirm({ title: "Approve disbursement?", message: `${dBtn.dataset.milestone} — ${inr(Number(dBtn.dataset.amount))} will be marked DISBURSED on the prototype ledger.`, confirmLabel: "Approve disbursement" });
      if (!ok) return;
      RubyUI.setLoading(dBtn, true, "…");
      try {
        await API.disburse(dBtn.dataset.dapprove, { milestone: dBtn.dataset.milestone, amount: Number(dBtn.dataset.amount) });
        RubyUI.toast("success", "Disbursement approved ✓");
        setTimeout(() => renderTab("disbursements"), 500);
      } catch { RubyUI.setLoading(dBtn, false); RubyUI.toast("error", "Disbursement failed — try again."); }
    }
  });
});