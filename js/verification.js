/* ============================================================
   RUBY — verification tracker + demo analyser.
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const initialCase = params.get("case");

  /* ---------- Tracker ---------- */
  const emptyBox = document.getElementById("tracker-empty");
  const bodyBox = document.getElementById("tracker-body");
  const inputEl = document.getElementById("tracker-case-input");
  const loadBtn = document.getElementById("tracker-load");

  async function loadCase(id) {
    emptyBox.classList.add("hidden");
    bodyBox.classList.remove("hidden");
    bodyBox.querySelector("h2")?.classList.remove("hidden");

    const wrap = document.getElementById("tr-timeline");
    wrap.innerHTML = RubyUI.skeleton(6);

    let appeal = null;
    try {
      appeal = await API.getAppeal(id);
    } catch { /* not found */ }
    if (!appeal) {
      bodyBox.classList.add("hidden");
      emptyBox.classList.remove("hidden");
      inputEl.value = id;
      RubyUI.toast("error", "Case not found.");
      return;
    }

    document.getElementById("tr-case-id").textContent = appeal.id;
    const badgeStatus = ["FUNDRAISING", "FUNDED", "DISBURSED", "REJECTED"].includes(appeal.status)
      ? appeal.status
      : (appeal.verificationStatus || appeal.status);
    document.getElementById("tr-case-status").innerHTML = RubyUI.statusBadge(badgeStatus);
    document.getElementById("tr-treatment").textContent = appeal.treatment;
    document.getElementById("tr-hospital").textContent = `${appeal.hospitalName} · ${appeal.department}`;
    document.getElementById("tr-patient").textContent = appeal.patientName;
    document.getElementById("tr-target").textContent = inr(appeal.targetAmount);
    document.getElementById("tr-score").textContent = appeal.verificationScore ? `${appeal.verificationScore} / 100` : "—";
    document.getElementById("tr-created").textContent = fmtDate(appeal.createdAt);

    // Timeline stages
    const stages = [
      ["Appeal submitted", "Medical appeal created", appeal.createdAt ? "done" : ""],
      ["AI verification", "Prototype analysis", appeal.verificationStatus === "AI_VERIFIED" || appeal.verificationScore > 0 ? "done" : appeal.verificationStatus === "SUBMITTED" ? "active" : ""],
      ["Hospital verification", "Awaiting partner confirmation", appeal.verificationStatus === "HOSPITAL_VERIFIED" ? "done" : appeal.verificationStatus === "AI_VERIFIED" ? "active" : appeal.verificationStatus === "REJECTED" || appeal.verificationStatus === "MORE_INFO_REQUESTED" ? "risk" : ""],
      ["Admin approval", "Human review", appeal.approvedAt ? "done" : appeal.verificationStatus === "HOSPITAL_VERIFIED" ? "active" : ""],
      ["Fundraising", appeal.status === "FUNDRAISING" ? `${inr(appeal.raisedAmount)} raised` : "Not started", appeal.status === "FUNDRAISING" ? "done" : ""],
      ["Disbursement", appeal.disbursements?.length ? "Milestones being settled to hospital" : "Awaiting funding", appeal.status === "DISBURSED" ? "done" : ""]
    ];
    wrap.innerHTML = stages.map(([t, d, state]) => `
      <li class="tl-item"><span class="tl-dot ${state === "done" ? "done" : state === "active" ? "active" : ""}"></span>
        <p class="font-body-md font-semibold">${t}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${d}</p></li>`).join("");

    // Actions based on role
    const actionsEl = document.getElementById("tr-actions");
    const s = Auth.session();
    let actions = "";
    if (s && s.role === "hospital" && (appeal.verificationStatus === "AI_VERIFIED" || appeal.verificationStatus === "SUBMITTED" || appeal.verificationStatus === "MORE_INFO_REQUESTED")) {
      actions = `
        <button class="w-full btn bg-tertiary text-on-tertiary" data-hosp-action="VERIFY"><span class="material-symbols-outlined text-[18px]">check</span>Verify as hospital</button>
        <button class="w-full btn btn-outline" data-hosp-action="INFO"><span class="material-symbols-outlined text-[18px]">info</span>Request more information</button>
        <button class="w-full btn btn-danger" data-hosp-action="REJECT"><span class="material-symbols-outlined text-[18px]">close</span>Reject</button>
        <p class="text-[11px] text-on-surface-variant text-center">Prototype action — no real hospital API is used.</p>`;
    } else if (s && s.role === "admin" && appeal.verificationStatus === "HOSPITAL_VERIFIED" && appeal.status !== "FUNDRAISING") {
      actions = `
        <button class="w-full btn bg-tertiary text-on-tertiary" data-admin-action="APPROVED"><span class="material-symbols-outlined text-[18px]">check</span>Approve for fundraising</button>
        <button class="w-full btn btn-danger" data-admin-action="REJECTED"><span class="material-symbols-outlined text-[18px]">close</span>Reject appeal</button>
        <p class="text-[11px] text-on-surface-variant text-center">Final decision is a human admin review.</p>`;
    } else if (!s) {
      actions = `<a href="/pages/login.html" class="text-center text-secondary font-label-caps text-label-caps hover:underline py-2">Sign in to take action</a>`;
    }
    actionsEl.innerHTML = actions;

    // AI result panel
    const aiEl = document.getElementById("tr-ai");
    aiEl.innerHTML = `
      <div class="flex items-center gap-3 mb-4">
        <div class="w-14 h-14 rounded-full bg-secondary/10 text-secondary flex items-center justify-center"><span class="material-symbols-outlined" style="font-size:26px;">psychology_alt</span></div>
        <div class="flex flex-col gap-1.5">
          ${RubyUI.aiLabel()}
          <p class="font-headline-md text-[16px]">AI verification analysis</p>
          <p class="font-body-sm text-[13px] text-on-surface-variant">Score ${appeal.verificationScore || 0}/100 · ${appeal.verificationStatus}</p>
        </div>
        ${appeal.verificationScore ? `<div class="ml-auto">${RubyUI.statusBadge(appeal.verificationScore >= 80 ? "LOW_RISK" : appeal.verificationScore >= 60 ? "MEDIUM_RISK" : "HIGH_RISK")}</div>` : ""}
      </div>
      ${appeal.verificationScore ? `
        <div class="flex flex-wrap gap-2 mb-3">
          <span class="status-badge verified"><span class="material-symbols-outlined text-[13px]">check_circle</span>Identity consistency</span>
          <span class="status-badge verified"><span class="material-symbols-outlined text-[13px]">check_circle</span>Hospital information</span>
          <span class="status-badge verified"><span class="material-symbols-outlined text-[13px]">check_circle</span>Treatment information</span>
          <span class="status-badge verified"><span class="material-symbols-outlined text-[13px]">check_circle</span>Funding calculation</span>
        </div>
        <p class="text-[14px] text-on-surface-variant mb-2">${RubyUI.esc(appeal.verificationSummary || appeal.story || "")}</p>
        <p class="text-[12px] font-semibold text-tertiary-container">Recommendation: ${RubyUI.esc(appeal.verificationScore >= 80 ? "Proceed to human review." : "Additional manual review required.")}</p>
      ` : `
        <p class="text-[14px] text-on-surface-variant">This appeal has not been analysed yet. Click <strong>Run AI Verification</strong> below or submit the appeal first.</p>
        <button class="btn btn-secondary mt-4" id="tr-run-ai"><span class="material-symbols-outlined text-[18px]">auto_awesome</span>Run AI Verification</button>`}
      <p class="text-[11px] text-on-surface-variant mt-3"><span class="material-symbols-outlined text-[14px] align-middle">info</span> AI-assisted prototype analysis — not a medical or legal decision. Final approval requires human/admin review.</p>`;

    const runAi = document.getElementById("tr-run-ai");
    if (runAi) {
      runAi.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        RubyUI.setLoading(btn, true, "Analysing…");
        try {
          let result = null;
          try {
            const res = await API.submitAppeal(appeal.id);
            result = (res && res.verification) || null;
          } catch { /* backend offline */ }
          if (!result || result.verificationScore === undefined) {
            result = await API.analyze({ ...appeal, caseId: appeal.id });
          }
          if (result.verificationScore !== undefined) {
            Storage.update("appeals", appeal.id, { verificationScore: result.verificationScore, verificationStatus: "AI_VERIFIED", status: "PENDING_VERIFICATION", verificationSummary: result.summary });
            RubyUI.toast("success", `AI verification complete — score ${result.verificationScore}`);
            loadCase(appeal.id);
          }
        } catch (e) {
          RubyUI.setLoading(btn, false);
          RubyUI.toast("error", "Analysis failed — try again.");
        }
      });
    }
  }

  // Hospital actions
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-hosp-action]");
    if (btn) {
      const id = document.getElementById("tr-case-id").textContent;
      const action = btn.dataset.hospAction;
      const ok = await RubyUI.confirm({
        title: action === "VERIFY" ? "Verify this case?" : action === "REJECT" ? "Reject this case?" : "Request more information?",
        message: action === "VERIFY" ? "The hospital confirms the diagnosis, treatment and cost estimate." : "The hospital requests additional documents or details.",
        confirmLabel: action === "VERIFY" ? "Verify" : action === "REJECT" ? "Reject" : "Request info",
        danger: action === "REJECT"
      });
      if (!ok) return;
      RubyUI.setLoading(btn, true, "Updating…");
      try {
        await API.verifyHospital(id, action, "");
        RubyUI.toast("success", action === "VERIFY" ? "Case verified by hospital ✓" : "Status updated");
        loadCase(id);
      } catch { RubyUI.setLoading(btn, false); RubyUI.toast("error", "Action failed — try again."); }
      return;
    }
    const adminBtn = e.target.closest("[data-admin-action]");
    if (adminBtn) {
      const id = document.getElementById("tr-case-id").textContent;
      const action = adminBtn.dataset.adminAction;
      const ok = await RubyUI.confirm({
        title: action === "APPROVED" ? "Approve this appeal for fundraising?" : "Reject this appeal?",
        message: "Final approval is a human admin decision (prototype).",
        confirmLabel: action === "APPROVED" ? "Approve" : "Reject",
        danger: action === "REJECTED"
      });
      if (!ok) return;
      RubyUI.setLoading(adminBtn, true, "Updating…");
      try {
        if (action === "APPROVED") {
          await API.setAppealStatus(id, "APPROVED");
          Storage.update("appeals", id, { status: "FUNDRAISING", verificationStatus: "APPROVED", approvedAt: new Date().toISOString() });
        } else {
          await API.setAppealStatus(id, "REJECTED");
        }
        RubyUI.toast("success", action === "APPROVED" ? "Appeal approved — case is now fundraising ✓" : "Appeal rejected");
        loadCase(id);
      } catch { RubyUI.setLoading(adminBtn, false); RubyUI.toast("error", "Action failed — try again."); }
      return;
    }
    const trackBtn = e.target.closest("#tracker-load");
    if (trackBtn) {
      const id = inputEl.value.trim();
      if (!id) { RubyUI.toast("error", "Enter a case ID."); return; }
      loadCase(id);
    }
    const inputEnter = e.target.closest("#tracker-case-input");
    if (inputEnter && e.key === "Enter") loadCase(inputEnter.value.trim());
  });

  inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") loadCase(inputEl.value.trim()); });

  if (initialCase) {
    inputEl.value = initialCase;
    loadCase(initialCase);
  }

  /* ---------- Demo analyser ---------- */
  const runBtn = document.getElementById("an-run");
  runBtn.addEventListener("click", async () => {
    const resultBox = document.getElementById("an-result");
    resultBox.innerHTML = `<div class="flex items-center gap-2 text-surface/70"><span class="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Running analysis…</div>`;
    const payload = {
      patientName: "Sample Patient",
      rupId: "RBY-0000-0000-AA",
      hospitalId: "HSP-RBY-001",
      diagnosis: "Sample condition",
      treatment: "Sample treatment",
      targetAmount: Number(document.getElementById("an-target").value),
      estimatedTreatmentCost: Number(document.getElementById("an-est").value),
      amountRequired: Number(document.getElementById("an-required").value),
      story: document.getElementById("an-story").value
    };
    try {
      const result = await API.analyze(payload);
      const flags = result.flags || [];
      resultBox.innerHTML = `
        <div class="flex flex-col gap-2 mb-4">
          ${RubyUI.aiLabel()}
          <div class="flex items-center justify-between">
            <p class="font-headline-md text-[16px]">Analysis result</p>
            ${RubyUI.statusBadge(result.status)}
          </div>
        </div>
        <div class="flex items-center gap-4 mb-4">
          <div class="w-20 h-20 rounded-full bg-white/10 border-2 border-secondary-fixed-dim flex items-center justify-center"><span class="font-data-mono text-[26px] font-bold">${result.verificationScore}</span></div>
          <div class="text-[13px] text-surface/80"><p>Verification score / 100</p><p>Risk score: ${result.riskScore}</p></div>
        </div>
        ${flags.length ? `<div class="mb-3"><p class="font-label-caps text-label-caps text-error mb-2">Flags</p>${flags.map((f) => `<p class="text-[13px] text-error mb-1">• ${RubyUI.esc(f)}</p>`).join("")}</div>` : `<p class="text-[13px] text-tertiary-fixed-dim mb-2">✓ No flags raised.</p>`}
        <p class="text-[13px] text-surface/85 mb-2">${RubyUI.esc(result.summary || "")}</p>
        <p class="text-[12px] font-semibold text-secondary-fixed-dim">Recommendation: ${RubyUI.esc(result.recommendation || "")}</p>
        <p class="text-[11px] text-surface/50 mt-3">AI-assisted prototype analysis — not a medical or legal decision.</p>`;
    } catch {
      resultBox.innerHTML = `<p class="text-error text-[14px]">Analysis failed. The prototype analyser is unavailable — try again.</p>`;
    }
  });
});