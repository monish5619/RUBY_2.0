/* ============================================================
   RUBY — case rendering components (shared by home & cases).
   ============================================================ */
const RubyCase = (() => {
  function renderCard(c, opts = {}) {
    const pct = RubyUI.progressPct(c.raisedAmount, c.targetAmount);
    const pctText = pct >= 100 ? "100" : pct.toFixed(0);
    const showActions = opts.showActions !== false;
    const urgent = (c.urgency || "").toUpperCase() === "CRITICAL";
    return `
    <article class="card card-hover flex flex-col overflow-hidden relative">
      <div class="p-5 flex flex-col gap-4 flex-grow">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="relative shrink-0">
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary flex items-center justify-center font-headline-md text-[15px] font-bold">${RubyUI.esc(initials(c.patientName))}</div>
              <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center"><span class="material-symbols-outlined text-[10px] text-tertiary-container" style="font-variation-settings:'FILL' 1;">verified</span></span>
            </div>
            <div class="min-w-0">
              <p class="font-headline-md text-[15px] leading-tight truncate">${RubyUI.esc(c.patientName)} <span class="text-on-surface-variant font-body-md text-[12px] font-normal">· ${c.age} yrs</span></p>
              <p class="font-data-mono text-data-mono text-[11px] text-secondary mt-0.5 truncate">${RubyUI.esc(c.id)}</p>
            </div>
          </div>
          <div class="flex flex-col items-end gap-1.5 shrink-0">
            ${RubyUI.statusBadge(c.urgency)}
            ${RubyUI.statusBadge(c.verificationStatus)}
          </div>
        </div>
        <div>
          <h3 class="font-headline-md text-[17px] text-on-surface leading-snug">${RubyUI.esc(c.treatment)}</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-1.5 flex items-center gap-1.5"><span class="material-symbols-outlined text-[15px] text-secondary">local_hospital</span><span class="truncate">${RubyUI.esc(c.hospitalName)} · ${RubyUI.esc(c.location || "")}</span></p>
        </div>
        <div class="mt-auto space-y-2.5">
          ${RubyUI.progressBar(c.raisedAmount, c.targetAmount)}
          <div class="progress-stats">
            <span class="text-on-surface font-semibold">${inr(c.raisedAmount)} <span class="font-normal text-on-surface-variant">of ${inr(c.targetAmount)}</span></span>
            <span class="progress-pct">${pctText}%</span>
          </div>
          <div class="flex justify-between text-[11.5px] text-on-surface-variant">
            <span>${pct >= 100 ? "Fully funded 🎉" : (pct >= 60 ? "Over halfway there" : "Goal in progress")}</span>
            <span>${c.deadline ? "Deadline " + fmtDate(c.deadline) : ""}</span>
          </div>
        </div>
      </div>
      ${showActions ? `<div class="p-4 bg-gradient-to-b from-transparent to-primary/[0.03] border-t border-outline-variant/30 flex gap-3">
        <a href="/pages/case-details.html?id=${encodeURIComponent(c.id)}" class="btn btn-primary flex-1 py-3">
          <span class="material-symbols-outlined text-[17px]">visibility</span>View Case
        </a>
        <a href="/pages/donor.html?case=${encodeURIComponent(c.id)}" class="btn btn-outline flex-1 py-3">
          <span class="material-symbols-outlined text-[17px]">volunteer_activism</span>Donate
        </a>
      </div>` : ""}
    </article>`;
  }

  function renderSkeleton(n = 3) {
    return Array.from({ length: n }).map(() => RubyUI.skeletonCard(5)).join("");
  }

  return { renderCard, renderSkeleton };
})();