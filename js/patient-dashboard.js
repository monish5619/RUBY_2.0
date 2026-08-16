/* ============================================================
   RUBY — patient dashboard.
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const dash = document.getElementById("patient-dash");
  const loginReq = document.getElementById("patient-login-required");
  const session = Auth.session();

  if (!session || session.role !== "patient") {
    if (loginReq) loginReq.classList.remove("hidden");
    if (dash) dash.classList.add("hidden");
    return;
  }
  if (loginReq) loginReq.classList.add("hidden");
  if (dash) dash.classList.remove("hidden");

  let patient = null;
  try { patient = await API.getPatient(session.patientId); } catch { /* offline */ }
  if (!patient) {
    patient = Storage.collection("patients").find((p) => p.rupId === session.rupId) ||
      { id: session.patientId, rupId: session.rupId, name: session.name, email: session.email, verificationStatus: "VERIFIED", verificationScore: 96 };
  }

  let appeals = [];
  try {
    appeals = await API.getAppeals();
  } catch {
    appeals = Storage.collection("appeals");
  }
  const myAppeals = appeals.filter((a) => a.rupId === patient.rupId || a.patientId === patient.id || a.patientEmail === patient.email);
  const active = myAppeals.find((a) => ["FUNDRAISING", "FUNDED", "DISBURSED"].includes(a.status)) || myAppeals[0] || null;

  // Header
  document.getElementById("pd-avatar").textContent = initials(patient.name);
  document.getElementById("pd-name").textContent = patient.name;
  document.getElementById("pd-rupid").textContent = patient.rupId;
  document.getElementById("pd-score").textContent = patient.verificationScore + " / 100";
  document.getElementById("pd-verification-badge").innerHTML = RubyUI.statusBadge("VERIFIED");

  // Status cards
  const cards = [
    { icon: "badge", title: "Identity", status: "VERIFIED", desc: "RUPID active" },
    { icon: "psychology_alt", title: "Medical Verification", status: active ? active.verificationStatus : "PENDING", desc: active ? `Score ${active.verificationScore || 0}/100` : "No appeal yet" },
    { icon: "campaign", title: "Fund Appeal", status: active ? active.status : "PENDING", desc: active ? active.id : "Not created" },
    { icon: "local_hospital", title: "Hospital", status: active && active.hospitalVerifiedAt ? "HOSPITAL_VERIFIED" : "PENDING", desc: active ? active.hospitalName : "—" },
    { icon: "savings", title: "Funding", status: active ? (active.raisedAmount >= active.targetAmount ? "FUNDED" : "FUNDRAISING") : "PENDING", desc: active ? `${inrCompact(active.raisedAmount)} of ${inrCompact(active.targetAmount)}` : "—" }
  ];
  document.getElementById("pd-cards").innerHTML = cards.map((c) => `
    <div class="stat-tile flex flex-col gap-2">
      <span class="stat-icon bg-primary/10 text-primary"><span class="material-symbols-outlined">${c.icon}</span></span>
      <p class="font-label-caps text-label-caps text-on-surface-variant">${c.title}</p>
      <div>${RubyUI.statusBadge(c.status)}</div>
      <p class="font-body-sm text-[12px] text-on-surface-variant mt-auto">${RubyUI.esc(c.desc)}</p>
    </div>`).join("");

  // Timeline
  const stages = [
    ["Identity verified", "RUPID generated"],
    ["Appeal created", active ? active.id : "No appeal yet"],
    ["AI verification", active && active.verificationScore > 0 ? `Prototype analysis · score ${active.verificationScore}` : "Awaiting analysis"],
    ["Hospital verification", active && active.hospitalVerifiedAt ? "Confirmed by " + active.hospitalName : "Awaiting partner confirmation"],
    ["Admin approval", active && active.approvedAt ? "Approved" : "Awaiting human review"],
    ["Fundraising & disbursement", active ? `${inrCompact(active.raisedAmount)} raised` : "Not started"]
  ];
  const doneCount = [
    patient.verificationStatus === "VERIFIED",
    Boolean(active),
    active && active.verificationScore > 0,
    active && active.hospitalVerifiedAt,
    active && active.approvedAt,
    active && active.raisedAmount > 0
  ];
  document.getElementById("pd-timeline").innerHTML = stages.map((s, i) => {
    const cls = doneCount[i] ? "done" : i === doneCount.findIndex((d) => !d) && i === stages.length - 1 ? "done" : "";
    const isCurrent = !doneCount[i] && doneCount.slice(0, i).every(Boolean);
    return `<li class="tl-item"><span class="tl-dot ${doneCount[i] ? "done" : isCurrent ? "active" : ""}"></span><p class="font-body-md font-semibold">${s[0]}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${s[1]}</p></li>`;
  }).join("");

  // Funding panel
  const fundingEl = document.getElementById("pd-funding");
  if (active) {
    const pct = RubyUI.progressPct(active.raisedAmount, active.targetAmount);
    fundingEl.innerHTML = `
      <div class="flex justify-between text-[14px] mb-2"><span class="text-on-surface-variant">Total amount raised</span><span class="font-data-mono font-bold">${inr(active.raisedAmount)}</span></div>
      <div class="flex justify-between text-[14px] mb-3"><span class="text-on-surface-variant">Target</span><span class="font-data-mono font-bold">${inr(active.targetAmount)}</span></div>
      <div class="flex justify-between text-[14px] mb-4"><span class="text-on-surface-variant">Amount remaining</span><span class="font-data-mono font-bold text-primary">${inr(Math.max(0, active.targetAmount - active.raisedAmount))}</span></div>
      ${RubyUI.progressBar(active.raisedAmount, active.targetAmount)}
      <div class="progress-stats mt-2"><span class="progress-pct">${pct.toFixed(0)}% funded</span><span>${active.urgency} urgency</span></div>
    `;
    document.getElementById("pd-next-step-text").textContent = active.status === "FUNDRAISING" ? `Your appeal ${active.id} is live and fundraising at ${active.hospitalName}. Share it to get support.` : `Your appeal ${active.id} is awaiting verification. The hospital will confirm it next.`;
    document.getElementById("pd-next-step-cta").textContent = active.status === "FUNDRAISING" ? "View my case" : "Check status";
    document.getElementById("pd-next-step-cta").href = active.status === "FUNDRAISING" ? `/pages/case-details.html?id=${active.id}` : `/pages/verification.html?case=${active.id}`;
  } else {
    fundingEl.innerHTML = `<p class="text-on-surface-variant text-[14px] mb-4">You have no active appeal yet. Create one to begin verified fundraising.</p>`;
    document.getElementById("pd-next-step-text").textContent = "Create your first medical fund appeal to get verified and start raising support.";
    document.getElementById("pd-next-step-cta").textContent = "Create appeal";
  }

  // My appeals list
  const appealsEl = document.getElementById("pd-appeals");
  if (myAppeals.length) {
    appealsEl.innerHTML = myAppeals.map((a) => `
      <div class="card p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><span class="material-symbols-outlined">medical_services</span></div>
          <div class="min-w-0">
            <p class="font-headline-md text-[15px] truncate">${RubyUI.esc(a.treatment)}</p>
            <p class="font-data-mono text-[12px] text-secondary">${RubyUI.esc(a.id)} · ${RubyUI.esc(a.hospitalName)}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">${RubyUI.statusBadge(a.status)}${RubyUI.statusBadge(a.verificationStatus)}</div>
        <a href="/pages/case-details.html?id=${encodeURIComponent(a.id)}" class="link-underline font-label-caps text-label-caps whitespace-nowrap"><span>View</span><span class="material-symbols-outlined text-[14px]">arrow_forward</span></a>
      </div>`).join("");
  } else {
    appealsEl.innerHTML = RubyUI.emptyState({ icon: "medical_services", title: "No appeals yet", text: "Create your first appeal to begin verified fundraising.", action: `<a class="btn btn-primary mt-2" href="/pages/appeal.html">Create your first appeal</a>` });
  }

  // Notifications
  const notifEl = document.getElementById("pd-notifications");
  const notifs = active
    ? [
        { icon: "verified", color: "text-tertiary-container", title: `Verification update`, text: active.verificationStatus === "HOSPITAL_VERIFIED" ? "Your appeal was verified by the hospital." : "Your appeal is awaiting hospital verification.", time: "Now" },
        { icon: "savings", color: "text-primary", title: `Funding update`, text: active.status === "FUNDRAISING" ? `Your appeal has raised ${inr(active.raisedAmount)}.` : "No donations yet.", time: "Today" },
        { icon: "info", color: "text-secondary", title: "Prototype notice", text: "All verifications and payments are simulated in this demo.", time: "Today" }
      ]
    : [{ icon: "campaign", color: "text-secondary", title: "Get started", text: "Create your first fund appeal to begin your verification journey.", time: "Now" }];
  notifEl.innerHTML = notifs.map((n) => `
    <div class="card p-4 flex items-start gap-3">
      <span class="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[18px] ${n.color}">${n.icon}</span></span>
      <div class="flex-1"><p class="font-body-md font-semibold text-[14px]">${n.title}</p><p class="font-body-sm text-[13px] text-on-surface-variant">${n.text}</p></div>
      <span class="font-body-sm text-[12px] text-on-surface-variant whitespace-nowrap">${n.time}</span>
    </div>`).join("");

  // Profile
  const profileEl = document.getElementById("pd-profile");
  const rows = [
    ["Full name", patient.name], ["RUPID", patient.rupId],
    ["Email", patient.email], ["Mobile", patient.phone || "—"],
    ["Age", patient.age + " yrs"], ["Verification", "Verified (prototype)"],
    ["Member since", fmtDate(patient.createdAt)], ["Verification score", (patient.verificationScore || 96) + "/100"]
  ];
  profileEl.innerHTML = rows.map(([k, v]) => `<div><dt class="font-label-caps text-label-caps text-on-surface-variant mb-1">${k}</dt><dd class="font-data-mono text-data-mono text-on-surface">${RubyUI.esc(v)}</dd></div>`).join("");
});