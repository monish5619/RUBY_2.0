/* ============================================================
   RUBY — case details page.
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const body = document.getElementById("cd-body");
  const skeleton = document.getElementById("cd-skeleton");

  if (!id) {
    skeleton.classList.add("hidden");
    body.classList.add("hidden");
    const main = document.querySelector("main");
    main.innerHTML = `<div class="text-center py-20"><p class="text-on-surface-variant">No case selected.</p><a class="text-secondary hover:underline" href="/pages/cases.html">Browse cases</a></div>`;
    return;
  }

  let c = null;
  try { c = await API.getCase(id); } catch { /* not found */ }
  if (!c) {
    skeleton.classList.add("hidden");
    const main = document.querySelector("main");
    main.innerHTML = `<div class="text-center py-20"><span class="material-symbols-outlined text-[48px] text-outline">search_off</span><p class="text-on-surface-variant mt-2">Case not found.</p><a class="text-secondary hover:underline" href="/pages/cases.html">Browse cases</a></div>`;
    return;
  }

  skeleton.classList.add("hidden");
  body.classList.remove("hidden");

  document.getElementById("cd-avatar").textContent = initials(c.patientName);
  document.getElementById("cd-treatment").textContent = c.treatment;
  document.getElementById("cd-patient").textContent = c.patientName;
  document.getElementById("cd-age").textContent = c.age;
  document.getElementById("cd-location").textContent = c.location || "India";
  document.getElementById("cd-verification-badge").innerHTML = RubyUI.statusBadge(c.verificationStatus);
  document.getElementById("cd-status-badge").innerHTML = RubyUI.statusBadge(c.status);
  document.getElementById("cd-urgency-badge").innerHTML = RubyUI.statusBadge(c.urgency);
  document.getElementById("cd-urgency-badge").insertAdjacentHTML("afterend", RubyUI.aiLabel());
  document.getElementById("cd-id").textContent = c.id;
  document.getElementById("cd-hospital").textContent = c.hospitalName;
  document.getElementById("cd-department").textContent = c.department;
  document.getElementById("cd-deadline").textContent = fmtDate(c.deadline);
  document.getElementById("cd-diagnosis").textContent = c.diagnosis;
  document.getElementById("cd-treatment-detail").textContent = c.treatment;
  document.getElementById("cd-procedure").textContent = c.procedure || "—";
  document.getElementById("cd-est").textContent = inr(c.estimatedTreatmentCost);
  document.getElementById("cd-duration").textContent = c.treatmentDuration || "—";
  document.getElementById("cd-story").textContent = c.story || "—";
  document.getElementById("cd-usage").textContent = c.fundingUsage || "—";

  document.getElementById("cd-docs").innerHTML = (c.documents || []).map((d) => `
    <button class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/50 text-[12px] font-data-mono hover:bg-surface-container-high transition-colors" onclick="RubyUI.toast('info','Demo document — not downloadable in prototype')">
      <span class="material-symbols-outlined text-secondary text-[16px]">description</span>${RubyUI.esc(d.type)} · ${RubyUI.esc(d.name)}
    </button>`).join("");

  // Timeline
  const stages = [
    ["AI verification", "Prototype analysis", c.verificationScore > 0 ? "done" : "active"],
    ["Hospital verification", "Confirmed by hospital", c.verificationStatus === "HOSPITAL_VERIFIED" || c.hospitalVerifiedAt ? "done" : ""],
    ["Admin approval", "Human review", c.approvedAt ? "done" : ""],
    ["Fundraising", `${inr(c.raisedAmount)} raised`, c.status === "FUNDRAISING" ? "done" : ""],
    ["Disbursement", (c.disbursements || []).filter((d) => d.status === "DISBURSED").length ? "Milestones settled to hospital" : "Awaiting funding", c.status === "DISBURSED" ? "done" : ""]
  ];
  document.getElementById("cd-timeline").innerHTML = stages.map(([t, d, state]) => `
    <li class="tl-item"><span class="tl-dot ${state}"></span><p class="font-body-md font-semibold">${t}</p><p class="font-body-sm text-body-sm text-on-surface-variant">${d}</p></li>`).join("");

  // Funding panel
  const pct = RubyUI.progressPct(c.raisedAmount, c.targetAmount);
  document.getElementById("cd-funding").innerHTML = `
    <div class="flex justify-between text-[14px] mb-1"><span class="text-on-surface-variant">Raised</span><span class="font-data-mono font-bold text-primary">${inr(c.raisedAmount)}</span></div>
    <div class="flex justify-between text-[14px] mb-4"><span class="text-on-surface-variant">Target</span><span class="font-data-mono font-bold">${inr(c.targetAmount)}</span></div>
    ${RubyUI.progressBar(c.raisedAmount, c.targetAmount)}
    <div class="flex justify-between text-[12px] text-on-surface-variant mt-2"><span>${pct.toFixed(0)}% funded</span><span>${inr(Math.max(0, c.targetAmount - c.raisedAmount))} to go</span></div>
    <div class="mt-5 rounded-xl bg-surface-container p-4 text-[12px] text-on-surface-variant">
      <div class="flex justify-between mb-1"><span>Already available</span><span class="font-data-mono">${inr(c.amountAlreadyAvailable)}</span></div>
      <div class="flex justify-between"><span>Insurance coverage</span><span class="font-data-mono">${inr(c.insuranceCoverage)}</span></div>
    </div>`;

  // Transparency sidebar
  document.getElementById("cd-t-target").textContent = inr(c.targetAmount);
  document.getElementById("cd-t-raised").textContent = inr(c.raisedAmount);
  document.getElementById("cd-t-remaining").textContent = inr(Math.max(0, c.targetAmount - c.raisedAmount));
  const disbursed = (c.disbursements || []).filter((d) => d.status === "DISBURSED").reduce((s, d) => s + Number(d.amount || 0), 0);
  document.getElementById("cd-t-disbursed").textContent = inr(disbursed);

  // Donate button
  document.getElementById("cd-donate-btn").href = `/pages/donor.html?case=${encodeURIComponent(c.id)}`;
});