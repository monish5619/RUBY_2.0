/* ============================================================
   RUBY — case discovery (search / filter / sort).
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("cases-grid");
  const countEl = document.getElementById("result-count");
  const input = document.getElementById("filter-search");
  const catEl = document.getElementById("filter-category");
  const urgEl = document.getElementById("filter-urgency");
  const stEl = document.getElementById("filter-status");
  const sortEl = document.getElementById("sort-by");

  let allCases = [];

  const skeleton = () => `<div class="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">${Array.from({ length: 3 }).map(() => RubyUI.skeletonCard(5)).join("")}</div>`;
  grid.innerHTML = skeleton();

  try {
    allCases = await API.getCases();
    if (!Array.isArray(allCases)) allCases = [];
  } catch {
    grid.innerHTML = `<div class="col-span-full">${RubyUI.errorState({ icon: "cloud_off", title: "Could not load cases", text: "Check the backend connection and try again." })}</div>`;
    return;
  }

  const categoryMap = {
    "Cardiac": ["cardiac", "coronary", "bypass", "heart", "stent"],
    "Oncology": ["onco", "cancer", "carcin", "chemo", "tumor", "tumour", "lymph"],
    "Trauma / Emergency": ["trauma", "accident", "emergency", "fracture", "polytrauma", "road-traffic"],
    "Kidney / Nephrology": ["kidney", "renal", "nephro", "dialysis", "transplant"],
    "Paediatric": ["paediatr", "pediatr", "child", "congenital", "neonat"],
    "General Surgery": ["surgery", "laparoscopic", "cholecystectomy", "hernia", "appendix"]
  };

  function matchesCategory(c, cat) {
    if (!cat) return true;
    const terms = categoryMap[cat] || [];
    if (!terms.length) return true;
    const hay = `${c.treatment} ${c.diagnosis} ${c.procedure} ${c.department}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  }

  function applyFilters() {
    const q = input.value.trim().toLowerCase();
    const cat = catEl.value;
    const urg = urgEl.value;
    const st = stEl.value;
    const sort = sortEl.value;

    let list = allCases.filter((c) => {
      if (q && !`${c.treatment} ${c.diagnosis} ${c.hospitalName} ${c.location} ${c.patientName}`.toLowerCase().includes(q)) return false;
      if (cat && !matchesCategory(c, cat)) return false;
      if (urg && c.urgency !== urg) return false;
      if (st && c.status !== st) return false;
      return true;
    });

    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    if (sort === "urgency") list.sort((a, b) => (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3));
    else if (sort === "newest") list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (sort === "raised") list.sort((a, b) => Number(b.raisedAmount) - Number(a.raisedAmount));
    else if (sort === "target") list.sort((a, b) => Number(b.targetAmount) - Number(a.targetAmount));

    countEl.textContent = `${list.length} ${list.length === 1 ? "case" : "cases"} found`;
    grid.innerHTML = list.length
      ? list.map((c) => RubyCase.renderCard(c)).join("")
      : `<div class="col-span-full text-center py-14 rounded-2xl border border-dashed border-outline-variant">
          <span class="material-symbols-outlined text-[40px] text-outline">search_off</span>
          <p class="text-on-surface-variant mt-2">No cases match your filters. Try clearing them.</p>
        </div>`;
  }

  [input, catEl, urgEl, stEl, sortEl].forEach((el) => el && el.addEventListener("input", applyFilters));
  document.getElementById("filter-clear").addEventListener("click", () => {
    input.value = ""; catEl.value = ""; urgEl.value = ""; stEl.value = ""; sortEl.value = "urgency";
    applyFilters();
  });

  applyFilters();
});