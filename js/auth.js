/* ============================================================
   RUBY — authentication & session management.
   Demo accounts (prototype only):
     patient@ruby.demo / demo123
     donor@ruby.demo   / demo123
     hospital@ruby.demo/ demo123
     admin@ruby.demo   / admin123
   ============================================================ */
const Auth = (() => {
  const DEMO_ACCOUNTS = [
    { role: "patient", email: "patient@ruby.demo", password: "demo123", name: "Priya Sharma" },
    { role: "donor", email: "donor@ruby.demo", password: "demo123", name: "Aarav Donor" },
    { role: "hospital", email: "hospital@ruby.demo", password: "demo123", name: "Meera Multispeciality Hospital" },
    { role: "admin", email: "admin@ruby.demo", password: "admin123", name: "RUBY Admin" }
  ];

  function session() { return Storage.getSession(); }
  function isAuthenticated() { return !!session(); }
  function role() { const s = session(); return s ? s.role : null; }

  async function login(email, password) {
    const sData = await API.login(email, password);
    Storage.setSession(sData);
    return sData;
  }

  function dashboardUrl() {
    const s = session();
    if (!s) return "/pages/login.html";
    switch (s.role) {
      case "patient": return "/pages/patient-dashboard.html";
      case "donor": return "/pages/ledger.html";
      case "hospital": return "/pages/hospital-dashboard.html";
      case "admin": return "/pages/admin.html";
      default: return "/index.html";
    }
  }

  function redirectToDashboard() {
    window.location.href = dashboardUrl();
  }

  function logout() {
    Storage.setSession(null);
    const toasts = window.RubyUI;
    if (toasts && toasts.toast) toasts.toast("success", "Signed out");
    window.location.href = "/index.html";
  }

  function requireRole(allowedRoles) {
    const s = session();
    if (!s || !allowedRoles.includes(s.role)) {
      window.location.href = "/pages/login.html?next=" + encodeURIComponent(window.location.pathname + window.location.search);
      return null;
    }
    return s;
  }

  return { DEMO_ACCOUNTS, session, isAuthenticated, role, login, logout, dashboardUrl, redirectToDashboard, requireRole };
})();