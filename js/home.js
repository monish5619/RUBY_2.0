/* ============================================================
   RUBY — homepage data rendering.
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const fmt = (n) => inrCompact(n);

  // ---- Route "Create Fund Appeal" CTAs to the appeal wizard for verified patients ----
  const session = Auth.session();
  if (session && session.role === "patient" && session.rupId) {
    document.querySelectorAll("#cta-create-appeal, #cta-start-appeal").forEach((el) => {
      el.setAttribute("href", "/pages/appeal.html");
    });
  }

  // ---- Stats (small cards in hero) ----
  const statsEl = document.getElementById("home-stats");
  if (statsEl) {
    try {
      const [cases, hospitals, donations] = await Promise.all([API.getCases(), API.getHospitals(), API.getDonations()]);
      const raised = cases.reduce((s, c) => s + Number(c.raisedAmount || 0), 0);
      const patients = new Set(cases.map((c) => c.rupId)).size;
      const statCards = [
        { label: "Funds Raised", value: fmt(raised), icon: "savings", color: "text-primary" },
        { label: "Active Cases", value: String(cases.length), icon: "campaign", color: "text-secondary" },
        { label: "Verified Patients", value: String(patients), icon: "verified", color: "text-tertiary-container" },
        { label: "Partner Hospitals", value: String(hospitals.length), icon: "local_hospital", color: "text-secondary" }
      ];
      statsEl.innerHTML = statCards.map((s) => `
        <div class="rounded-xl bg-white/70 border border-white/60 backdrop-blur-sm p-4 shadow-card">
          <div class="flex items-center gap-2 ${s.color}"><span class="material-symbols-outlined text-[18px]">${s.icon}</span><span class="font-data-mono text-[18px] font-bold">${s.value}</span></div>
          <p class="text-[11px] text-on-surface-variant mt-1">${s.label}</p>
        </div>`).join("");

      // Top donors
      const donorTotals = {};
      donations.forEach((d) => { donorTotals[d.donorLabel] = (donorTotals[d.donorLabel] || 0) + Number(d.amount); });
      const top = Object.entries(donorTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const donorsEl = document.getElementById("home-top-donors");
      if (donorsEl) {
        donorsEl.innerHTML = top.length
          ? top.map(([name, amt], i) => `
            <div class="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/60 transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-full ${i === 0 ? "bg-gradient-to-br from-[#FFD700] to-[#DAA520] text-white" : i === 1 ? "bg-gradient-to-br from-[#E0E0E0] to-[#BDBDBD] text-on-surface" : "bg-surface-container-high"} flex items-center justify-center font-data-mono text-[12px] font-bold">${i + 1}</div>
                <span class="font-data-mono text-data-mono text-[13px]">${RubyUI.esc(name)}</span>
              </div>
              <span class="font-data-mono text-[12px] text-on-surface-variant">${fmt(amt)}</span>
            </div>`).join("")
          : `<p class="text-[13px] text-on-surface-variant text-center py-2">No donations yet.</p>`;
      }
    } catch {
      statsEl.innerHTML = `<p class="col-span-2 text-[13px] text-on-surface-variant">Could not load stats.</p>`;
    }
  }

  // ---- Featured cases ----
  const featuredEl = document.getElementById("featured-cases");
  if (featuredEl) {
    try {
      const cases = await API.getCases();
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
      const featured = cases.sort((a, b) => (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3)).slice(0, 6);
      featuredEl.innerHTML = featured.length ? featured.map((c) => RubyCase.renderCard(c)).join("") : `<p class="col-span-full text-center text-on-surface-variant py-10">No public cases yet.</p>`;
    } catch {
      featuredEl.innerHTML = `<p class="col-span-full text-center text-on-surface-variant py-10">Could not load cases.</p>`;
    }
  }

  // ---- Transparency stats ----
  const transEl = document.getElementById("transparency-stats");
  if (transEl) {
    try {
      const [cases, hospitals, donations] = await Promise.all([API.getCases(), API.getHospitals(), API.getDonations()]);
      const raised = cases.reduce((s, c) => s + Number(c.raisedAmount || 0), 0);
      const disbursed = cases.reduce((s, c) => s + (c.disbursements || []).reduce((x, d) => x + (d.status === "DISBURSED" ? Number(d.amount || 0) : 0), 0), 0);
      const active = cases.filter((c) => c.status === "FUNDRAISING").length;
      const verifiedHospitals = hospitals.filter((h) => h.partnerStatus === "active").length;
      const items = [
        { label: "Funds Raised", value: inr(raised) },
        { label: "Funds Disbursed", value: inr(disbursed) },
        { label: "Active Cases", value: String(active) },
        { label: "Verified Hospitals", value: String(verifiedHospitals) }
      ];
      transEl.innerHTML = items.map((it) => `
        <div class="rounded-2xl bg-white/[0.07] border border-white/10 p-6 text-center backdrop-blur-sm hover:bg-white/10 transition-colors">
          <p class="font-headline-lg text-headline-lg text-secondary-fixed-dim">${RubyUI.esc(it.value)}</p>
          <p class="font-label-caps text-label-caps text-surface/70 mt-2">${it.label}</p>
        </div>`).join("");
    } catch { /* leave as is */ }
  }

  // ---- Partner hospitals ----
  const hospEl = document.getElementById("partner-hospitals");
  if (hospEl) {
    try {
      const hospitals = await API.getHospitals();
      hospEl.innerHTML = hospitals.map((h) => `
        <div class="card card-hover p-6 flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center"><span class="material-symbols-outlined">local_hospital</span></div>
            <div class="min-w-0">
              <h3 class="font-headline-md text-[17px] leading-tight truncate">${RubyUI.esc(h.name)}</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${RubyUI.esc(h.city)}</p>
            </div>
          </div>
          <div class="flex items-center justify-between text-[12px] mt-auto pt-2 border-t border-outline-variant/30">
            <span class="font-data-mono text-data-mono text-on-surface-variant truncate">${RubyUI.esc(h.registrationNumber)}</span>
            <span class="status-badge verified"><span class="material-symbols-outlined text-[13px]">verified</span>Partner</span>
          </div>
        </div>`).join("");
    } catch {
      hospEl.innerHTML = `<p class="col-span-full text-center text-on-surface-variant py-8">Could not load hospitals.</p>`;
    }
  }
});