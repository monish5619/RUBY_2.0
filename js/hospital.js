/* ============================================================
   RUBY — hospital partner flow (register + dashboard).
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  /* ===================== REGISTER ===================== */
  if (page === "hospital-register") initHospitalRegister();

  function initHospitalRegister() {
    let hospitalDocs = [];
    const drop = document.getElementById("h-drop");
    const input = document.getElementById("h-doc-input");
    const docNameEl = drop.querySelector(".doc-name");
    const docError = document.getElementById("h-doc-error");

    drop.addEventListener("click", () => input.click());
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("border-secondary"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("border-secondary"); }));
    drop.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) acceptDocs(e.dataTransfer.files); });
    input.addEventListener("change", () => { if (input.files.length) acceptDocs(input.files); });

    function acceptDocs(files) {
      const valid = Array.from(files).filter((f) => ["application/pdf", "image/jpeg", "image/png"].includes(f.type) && f.size <= 10 * 1024 * 1024);
      if (valid.length !== files.length) {
        docError.textContent = "Some files were skipped (PDF/JPG/PNG only, max 10 MB).";
        docError.classList.add("visible");
      } else {
        docError.classList.remove("visible");
      }
      if (valid.length) {
        hospitalDocs = valid.map((f) => ({ name: f.name, type: f.type, size: f.size }));
        docNameEl.textContent = `✓ ${hospitalDocs.map((d) => d.name).join(", ")}`;
      }
    }

    document.getElementById("hospital-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      Validator.clearAllErrors(form);
      const errors = Validator.validateForm(form, {
        hospitalName: ["required", "Hospital name is required."],
        registrationNumber: ["minLen5", "Enter a valid registration number."],
        hospitalType: ["required", "Select the hospital type."],
        address: ["minLen5", "Enter the facility address."],
        city: ["required", "Enter city / state."],
        contactPhone: (v) => !/^(\+91[-\s]?)?[6-9]\d{9}$/.test(v) && "Enter a valid phone number." || /^(\+91[-\s]?)?\d{10,11}$/.test(v) ? false : "Enter a valid phone number.",
        contactEmail: ["email", "Enter a valid email address."],
        adminName: ["required", "Administrator name is required."],
        adminEmail: ["email", "Enter a valid administrator email."],
        license: ["minLen5", "Enter the medical license."],
        bankLast4: (v) => !/^\d{4}$/.test(v) && "Enter the last 4 digits only.",
        terms: ["consent", "Please accept the partnership terms."]
      });
      if (!hospitalDocs.length) {
        errors.docs = "Upload the operating certificate / license documents.";
        docError.textContent = errors.docs;
        docError.classList.add("visible");
      }
      Validator.showFormSummary(form, errors);
      if (Object.keys(errors).length) { RubyUI.toast("error", "Please correct the highlighted fields."); return; }

      const submitBtn = form.querySelector('button[type="submit"]');
      RubyUI.setLoading(submitBtn, true, "Submitting…");
      const payload = {
        hospitalName: document.getElementById("h-name").value.trim(),
        registrationNumber: document.getElementById("h-reg").value.trim(),
        hospitalType: document.getElementById("h-type").value,
        address: document.getElementById("h-address").value.trim(),
        city: document.getElementById("h-city").value.trim(),
        contactPhone: document.getElementById("h-phone").value.trim(),
        contactEmail: document.getElementById("h-email").value.trim(),
        adminName: document.getElementById("h-admin").value.trim(),
        adminEmail: document.getElementById("h-admin-email").value.trim(),
        license: document.getElementById("h-license").value.trim(),
        bankLast4: document.getElementById("h-bank").value.trim(),
        documents: hospitalDocs
      };
      try {
        const res = await API.hospitalRegister(payload);
        const hospitalId = res.hospitalId || (res.hospital && res.hospital.id);
        document.getElementById("hospital-form-wrap").classList.add("hidden");
        document.getElementById("hospital-success").classList.remove("hidden");
        document.getElementById("hs-id").textContent = hospitalId || "HSP-RBY-###";
        RubyUI.toast("success", "Partnership request submitted ✓");
        document.querySelector("#hospital-success").scrollIntoView({ behavior: "smooth" });
      } catch (err) {
        RubyUI.setLoading(submitBtn, false);
        RubyUI.toast("error", err.message || "Submission failed — try again.");
      }
    });
  }

  /* ===================== DASHBOARD ===================== */
  if (page === "hospital-dashboard") initHospitalDashboard();

  async function initHospitalDashboard() {
    const dash = document.getElementById("hospital-dash");
    const loginReq = document.getElementById("hospital-login-required");
    const session = Auth.session();
    if (!session || session.role !== "hospital") {
      loginReq.classList.remove("hidden");
      dash.classList.add("hidden");
      return;
    }
    loginReq.classList.add("hidden");
    dash.classList.remove("hidden");

    let hospital = null;
    try { hospital = await API.getHospital(session.hospitalId); } catch { /* offline */ }
    if (!hospital) {
      hospital = Storage.find("hospitals", session.hospitalId) ||
        Storage.collection("hospitals")[0] || { id: "HSP-RBY-001", name: "Meera Multispeciality Hospital", verificationStatus: "PARTNER_APPROVED" };
    }

    document.getElementById("hd-name").textContent = hospital.name;
    document.getElementById("hd-id").textContent = hospital.id;
    document.getElementById("hd-partner-badge").innerHTML = RubyUI.statusBadge(hospital.verificationStatus);

    let cases = [];
    try { cases = await API.getCases(); } catch { /* fall through */ }
    // include pending cases too (they aren't public yet)
    let allPending = [];
    try { allPending = (await API.getAppeals()).filter((a) => ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "MORE_INFO_REQUESTED"].includes(a.status)); } catch {
      allPending = Storage.collection("appeals").filter((a) => ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "MORE_INFO_REQUESTED"].includes(a.status));
    }
    const allCases = cases.concat(allPending.filter((p) => !cases.find((c) => c.id === p.id)));
    const mine = allCases.filter((c) => c.hospitalId === hospital.id);

    const queue = mine.filter((c) => ["AI_VERIFIED", "SUBMITTED", "MORE_INFO_REQUESTED"].includes(c.verificationStatus) && ["PENDING_VERIFICATION", "VERIFICATION_PENDING"].includes(c.status));
    const active = mine.filter((c) => ["FUNDRAISING", "FUNDED", "DISBURSED"].includes(c.status));

    // Stats
    const fundsRaised = active.reduce((s, c) => s + Number(c.raisedAmount || 0), 0);
    const fundsDisbursed = active.reduce((s, c) => s + (c.disbursements || []).filter((d) => d.status === "DISBURSED").reduce((x, d) => x + Number(d.amount || 0), 0), 0);
    const escrowPending = active.reduce((s, c) => s + Math.max(0, Number(c.raisedAmount || 0) - fundsDisbursedFor(c)), 0);
    function fundsDisbursedFor(c) {
      return (c.disbursements || []).filter((d) => d.status === "DISBURSED").reduce((x, d) => x + Number(d.amount || 0), 0);
    }
    const verifiedPatients = new Set(mine.map((c) => c.rupId)).size;

    const stats = [
      { icon: "verified_user", label: "Verified Patients", value: String(verifiedPatients), color: "text-tertiary-container" },
      { icon: "campaign", label: "Active Appeals", value: String(active.length), color: "text-primary" },
      { icon: "hourglass_top", label: "Pending Verifications", value: String(queue.length), color: "text-secondary" },
      { icon: "savings", label: "Funds Raised", value: inrCompact(fundsRaised), color: "text-primary" },
      { icon: "lock", label: "Funds Pending", value: inrCompact(escrowPending), color: "text-secondary" },
      { icon: "account_balance_wallet", label: "Funds Disbursed", value: inrCompact(fundsDisbursed), color: "text-tertiary-container" }
    ];
    document.getElementById("hd-stats").innerHTML = stats.map((s) => `
      <div class="stat-tile">
        <span class="stat-icon"><span class="material-symbols-outlined ${s.color}">${s.icon}</span></span>
        <p class="font-data-mono text-[20px] font-bold mt-2">${s.value}</p>
        <p class="text-[11px] text-on-surface-variant mt-0.5">${s.label}</p>
      </div>`).join("");

    // Queue
    document.getElementById("hd-pending-count").textContent = `${queue.length} pending`;
    const queueEl = document.getElementById("hd-queue");
    if (queue.length === 0) {
      queueEl.innerHTML = RubyUI.emptyState({ icon: "verified_user", title: "No cases awaiting verification", text: "New appeals filed under this hospital will appear here for your review." });
    } else {
      queueEl.innerHTML = queue.map((c) => `
        <div class="card p-5 flex flex-col md:flex-row md:items-center gap-4">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">${initials(c.patientName)}</div>
            <div class="min-w-0">
              <p class="font-headline-md text-[15px] truncate">${RubyUI.esc(c.treatment)}</p>
              <p class="font-data-mono text-[12px] text-secondary">${RubyUI.esc(c.id)} · ${RubyUI.esc(c.patientName)} · ${inr(c.targetAmount)}</p>
              <p class="font-body-sm text-[12px] text-on-surface-variant truncate">${RubyUI.esc(c.diagnosis)}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">${RubyUI.statusBadge(c.verificationStatus)}</div>
          <div class="flex gap-2 flex-wrap">
            <button class="btn bg-tertiary text-on-tertiary px-4 py-2.5" data-hverify="VERIFY" data-case="${c.id}">Verify</button>
            <button class="btn btn-ghost border border-outline-variant px-4 py-2.5" data-hverify="INFO" data-case="${c.id}">Request Info</button>
            <button class="btn btn-danger px-4 py-2.5" data-hverify="REJECT" data-case="${c.id}">Reject</button>
          </div>
        </div>`).join("");
    }

    // Disbursements
    const disbEl = document.getElementById("hd-disb-list");
    if (active.length === 0) {
      disbEl.innerHTML = RubyUI.emptyState({ icon: "account_balance_wallet", title: "No funded cases yet", text: "Cases that reach their funding target will show escrow and disbursement status here." });
    } else {
      disbEl.innerHTML = active.map((c) => {
        const disbTotal = fundsDisbursedFor(c);
        const available = Math.max(0, Number(c.raisedAmount || 0) - disbTotal);
        const next = (c.milestones || []).find((m) => m.status === "ESCROW" || m.status === "PENDING");
        return `
        <div class="card p-6">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p class="font-headline-md text-[15px]">${RubyUI.esc(c.treatment)}</p>
              <p class="font-data-mono text-[12px] text-secondary">${RubyUI.esc(c.id)}</p>
            </div>
            <div class="flex items-center gap-2">${RubyUI.statusBadge(c.status)}</div>
          </div>
          <div class="flex justify-between text-[13px] mb-2"><span class="text-on-surface-variant">Raised</span><span class="font-data-mono font-bold">${inr(c.raisedAmount)}</span><span class="text-on-surface-variant">Disbursed</span><span class="font-data-mono">${inr(disbTotal)}</span></div>
          ${RubyUI.progressBar(c.raisedAmount, c.targetAmount)}
          <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            ${(c.milestones || []).map((m) => `
              <div class="rounded-xl bg-surface-container p-4 text-[13px] border border-outline-variant/30">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-semibold">${RubyUI.esc(m.label)}</span>
                  ${RubyUI.statusBadge(m.status)}
                </div>
                <div class="flex items-center justify-between mt-2">
                  <span class="font-data-mono">${inr(m.amount)}</span>
                  ${m.status === "ESCROW" || m.status === "PENDING" ? `<button class="link-underline text-[12px] font-label-caps font-bold" data-disburse="${c.id}" data-amount="${m.amount}" data-milestone="${RubyUI.esc(m.label)}" ${available < m.amount ? "disabled style='opacity:.4;cursor:not-allowed'" : ""}>Approve disbursement</button>` : ""}
                </div>
              </div>`).join("")}
          </div>
          <div class="mt-3 text-[12px] text-on-surface-variant flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px] text-secondary">lock</span>Escrow available for disbursement: <span class="font-data-mono font-bold">${inr(available)}</span></div>
        </div>`;
      }).join("");
    }

    // Actions
    document.body.addEventListener("click", async (e) => {
      const vBtn = e.target.closest("[data-hverify]");
      if (vBtn) {
        const caseId = vBtn.dataset.case;
        const action = vBtn.dataset.hverify;
        const ok = await RubyUI.confirm({
          title: action === "VERIFY" ? "Verify this patient case?" : action === "REJECT" ? "Reject this case?" : "Request more information?",
          message: action === "VERIFY" ? "You are confirming the diagnosis, treatment and cost estimate for this appeal." : action === "REJECT" ? "This will reject the appeal." : "This will request additional documents or details from the patient.",
          confirmLabel: action === "VERIFY" ? "Verify" : action === "REJECT" ? "Reject" : "Request info",
          danger: action === "REJECT"
        });
        if (!ok) return;
        RubyUI.setLoading(vBtn, true, "…");
        try {
          await API.verifyHospital(caseId, action, "");
          RubyUI.toast("success", action === "VERIFY" ? "Case verified — sent for admin review ✓" : "Case status updated");
          setTimeout(initHospitalDashboard, 600);
        } catch { RubyUI.setLoading(vBtn, false); RubyUI.toast("error", "Action failed — try again."); }
        return;
      }
      const dBtn = e.target.closest("[data-disburse]");
      if (dBtn) {
        const caseId = dBtn.dataset.disburse;
        const amount = Number(dBtn.dataset.amount);
        const milestone = dBtn.dataset.milestone;
        const ok = await RubyUI.confirm({
          title: "Approve milestone disbursement?",
          message: `Disburse ${inr(amount)} to the hospital for "${milestone}"? This is a simulated transfer recorded on the prototype ledger.`,
          confirmLabel: "Approve disbursement"
        });
        if (!ok) return;
        RubyUI.setLoading(dBtn, true, "…");
        try {
          await API.disburse(caseId, { milestone, amount });
          RubyUI.toast("success", `Disbursement of ${inr(amount)} approved ✓`);
          setTimeout(initHospitalDashboard, 600);
        } catch { RubyUI.setLoading(dBtn, false); RubyUI.toast("error", "Disbursement failed — try again."); }
      }
    });

    // Notifications
    const notifs = [
      { icon: "verified_user", color: "text-tertiary-container", title: "Partner status", text: `You are verified as a partner hospital (${hospital.verificationStatus}).`, time: "Now" },
      { icon: "hourglass_top", color: "text-secondary", title: "Verification queue", text: `${queue.length} case${queue.length === 1 ? "" : "s"} awaiting your review.`, time: "Today" },
      { icon: "account_balance_wallet", color: "text-primary", title: "Disbursements", text: escrowPending > 0 ? `${inrCompact(escrowPending)} is available in prototype escrow.` : "No escrow available yet.", time: "Today" }
    ];
    document.getElementById("hd-notifications").innerHTML = notifs.map((n) => `
      <div class="card p-4 flex items-start gap-3">
        <span class="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[18px] ${n.color}">${n.icon}</span></span>
        <div class="flex-1"><p class="font-body-md font-semibold text-[14px]">${n.title}</p><p class="font-body-sm text-[13px] text-on-surface-variant">${n.text}</p></div>
        <span class="font-body-sm text-[12px] text-on-surface-variant">${n.time}</span>
      </div>`).join("");
  }
});