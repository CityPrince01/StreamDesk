import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient";
import {
  Play,
  Search,
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  RotateCcw,
  Lock,
  Unlock,
  CheckCircle2,
  Circle,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Clapperboard,
  Music2,
  Settings2,
  Sun,
  Moon,
  Bell,
  BellOff,
  Zap,
  TrendingUp,
  Clock,
  Send,
} from "lucide-react";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  setAppBadge,
} from "./notifications";
import {
  runAutomation,
  getUpcomingDeadlines,
  buildBulkReminderMessages,
  getMonthlyRevenue,
  cleanOldNotificationLog,
} from "./automation";
import {
  loadTemplates,
  saveTemplates,
  fillTemplate,
  detectReminders,
  buildWhatsAppUrl,
} from "./templates";

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function statusOf(sub) {
  if (sub.blocked) return "blocked";
  const d = daysUntil(sub.end_date);
  if (d < 0) return "expired";
  if (d <= 5) return "soon";
  return "ok";
}

const STATUS_LABEL = { ok: "Actif", soon: "Échéance proche", expired: "Expiré", blocked: "Bloqué" };
const STATUS_STYLE = {
  ok: "bg-emerald-500/10 text-success border-emerald-500/30",
  soon: "bg-amber-500/10 text-warning border-amber-500/30",
  expired: "bg-red-500/10 text-danger border-red-500/30",
  blocked: "bg-gray-500/10 text-neutral border-gray-500/30",
};
const STATUS_DOT = { ok: "bg-dot-success", soon: "bg-dot-warning", expired: "bg-dot-danger", blocked: "bg-dot-neutral" };

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatFCFA(n) {
  return `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
}

function buildReminderMessage(sub, account) {
  const d = daysUntil(sub.end_date);
  const when =
    d < 0
      ? `expiré depuis ${Math.abs(d)} jour${Math.abs(d) > 1 ? "s" : ""}`
      : d === 0
      ? "expire aujourd'hui"
      : `expire dans ${d} jour${d > 1 ? "s" : ""}`;
  return `Bonjour ${sub.client_name}\n\nVotre abonnement ${account ? account.platform : ""} (profil "${sub.profile_name}") ${when}, le ${formatDate(
    sub.end_date
  )}.\n\nPour continuer à profiter de votre abonnement sans interruption, merci d'effectuer le renouvellement par Mobile Money et de m'envoyer la capture de paiement.\n\nMerci de votre confiance !`;
}

function whatsappLink(contact, message) {
  const digits = (contact || "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function PlatformIcon({ platform, size = 14 }) {
  if (platform === "Spotify") return <Music2 size={size} className="text-green-500 shrink-0" />;
  return <Clapperboard size={size} className="text-red-500 shrink-0" />;
}

function Badge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const DEFAULT_ACCOUNTS = [
  { name: "Netflix Famille 1", platform: "Netflix", slots: 5, email: "" },
  { name: "Netflix Famille 2", platform: "Netflix", slots: 5, email: "" },
  { name: "Spotify Famille", platform: "Spotify", slots: 6, email: "" },
];

const inputCls =
  "w-full text-sm bg-input-bg border border-input-border rounded px-2 py-1.5 text-input-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-input-border";
const btnGhost =
  "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-input-border text-secondary hover:bg-hover";

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("streamdesk-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "dark";
  });

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("streamdesk-theme", theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return <div className="min-h-screen bg-base flex items-center justify-center text-muted text-sm">Chargement...</div>;
  }

  return session ? <Dashboard theme={theme} toggleTheme={toggleTheme} /> : <Login />;
}

function Logo({ size = 36 }) {
  return (
    <div className="rounded-xl flex items-center justify-center shrink-0 bg-brand-gradient" style={{ width: size, height: size }}>
      <Play size={size * 0.5} className="text-white" fill="white" />
    </div>
  );
}

function Login() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim() || !password.trim()) {
      setError("Renseignez votre identifiant et votre mot de passe.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setLoading(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("Identifiant ou mot de passe incorrect.");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo("Compte créé. Vérifiez votre boîte mail pour confirmer, puis connectez-vous.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Logo size={48} />
          <h1 className="text-xl font-semibold text-primary text-center mt-3">StreamDesk</h1>
          <p className="text-sm text-muted text-center mt-0.5">Gestion de vos abonnements Netflix &amp; Spotify</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card border border-line rounded-lg p-5 space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1">Identifiant (email)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="vous@exemple.com" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Au moins 6 caractères" />
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
          {info && <div className="text-xs text-success">{info}</div>}
          <button type="submit" disabled={loading} className="w-full text-sm px-3 py-2 rounded text-white font-medium disabled:opacity-50 bg-brand-gradient">
            {loading ? "Patientez..." : mode === "signin" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setInfo("");
          }}
          className="w-full text-xs text-muted mt-3 hover:text-secondary"
        >
          {mode === "signin" ? "Pas encore de compte ? En créer un" : "Déjà un compte ? Se connecter"}
        </button>
      </div>
    </div>
  );
}

function Dashboard({ theme, toggleTheme }) {
  const [accounts, setAccounts] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState("");
  const [showFormModal, setShowFormModal] = useState(null);
  const [editingAccounts, setEditingAccounts] = useState(false);
  const [messageModal, setMessageModal] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [openAccountId, setOpenAccountId] = useState(null);
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());
  const [automationSummary, setAutomationSummary] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [templates, setTemplates] = useState(loadTemplates);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [detailSubId, setDetailSubId] = useState(null);
  const [blockedNotice, setBlockedNotice] = useState(null);

  const accountsById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const loadAll = useCallback(async () => {
    setLoadError("");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;

    let { data: accs, error: accErr } = await supabase.from("accounts").select("*").order("created_at");
    if (accErr) {
      setLoadError("Erreur de chargement des comptes.");
      return;
    }
    if (!accs || accs.length === 0) {
      const toInsert = DEFAULT_ACCOUNTS.map((a) => ({ ...a, user_id: userId }));
      const { data: inserted, error: insErr } = await supabase.from("accounts").insert(toInsert).select();
      if (!insErr) accs = inserted;
    }
    setAccounts(accs || []);

    const { data: subsData, error: subsErr } = await supabase.from("subscriptions").select("*").order("end_date");
    if (subsErr) {
      setLoadError("Erreur de chargement des profils.");
      return;
    }
    setSubs(subsData || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Exécuter l'automatisation : rappels + renouvellement auto
  const automationRan = useRef(false);
  useEffect(() => {
    if (!loaded || !subs.length || automationRan.current) return;
    automationRan.current = true;

    cleanOldNotificationLog();

    runAutomation(subs, accountsById, updateSub).then((summary) => {
      setAutomationSummary(summary);
      if (summary.renewed.length > 0) {
        const names = summary.renewed.map((r) => r.client).join(", ");
        showToast(`Renouvellement auto : ${names}`);
      }
      // Recharger pour refléter les renouvellements
      if (summary.renewed.length > 0) loadAll();
    });

    // Vérifier toutes les heures
    const interval = setInterval(async () => {
      const s = await runAutomation(subs, accountsById, updateSub);
      setAutomationSummary(s);
      if (s.renewed.length > 0) loadAll();
    }, 3600000);

    return () => clearInterval(interval);
  }, [loaded, subs, accountsById, updateSub]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  async function saveProfile(form, editId) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    const payload = {
      account_id: form.accountId,
      client_name: form.clientName,
      contact: form.contact,
      profile_name: form.profileName,
      formula: form.formula,
      pin: form.pin,
      start_date: form.startDate,
      end_date: form.endDate,
      price: form.price,
    };
    let error;
    if (editId) {
      ({ error } = await supabase.from("subscriptions").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("subscriptions").insert([{ ...payload, user_id: userId, paid: false, blocked: false }]));
    }
    if (error) {
      showToast("Erreur lors de l'enregistrement");
      return;
    }
    await loadAll();
    setShowFormModal(null);
    showToast(editId ? "Profil mis à jour" : "Profil ajouté");
  }

  async function updateSub(id, patch) {
    const { error } = await supabase.from("subscriptions").update(patch).eq("id", id);
    if (error) {
      showToast("Erreur lors de la mise à jour");
      return;
    }
    await loadAll();
  }

  // Bloquer / débloquer un client.
  // Lors d'un blocage, prépare automatiquement le message de notification WhatsApp.
  async function toggleBlocked(sub) {
    const willBlock = !sub.blocked;
    const account = accountsById[sub.account_id];

    await updateSub(sub.id, { blocked: willBlock });

    if (account) {
      const templateId = willBlock ? "blocked" : "unblocked";
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setBlockedNotice({ sub, account, template, willBlock });
        showToast(
          willBlock
            ? `${sub.client_name} bloqué — message de notification prêt`
            : `${sub.client_name} débloqué — message de notification prêt`
        );
        return;
      }
    }

    showToast(willBlock ? `${sub.client_name} bloqué` : `${sub.client_name} débloqué`);
  }

  async function deleteSub(id) {
    const { error } = await supabase.from("subscriptions").delete().eq("id", id);
    if (error) {
      showToast("Erreur lors de la suppression");
      return;
    }
    await loadAll();
    showToast("Profil supprimé");
  }

  async function renew(sub) {
    const base = new Date(sub.end_date) > new Date() ? new Date(sub.end_date) : new Date();
    base.setDate(base.getDate() + 30);
    await updateSub(sub.id, { end_date: base.toISOString().slice(0, 10), paid: true, blocked: false });
    showToast("Abonnement renouvelé (+30 jours)");
  }

  async function updateAccount(id, patch) {
    const { error } = await supabase.from("accounts").update(patch).eq("id", id);
    if (error) {
      showToast("Erreur lors de la mise à jour du compte");
      return;
    }
    await loadAll();
  }

  async function addAccount() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    const { error } = await supabase
      .from("accounts")
      .insert([{ user_id: userId, name: "Nouveau compte", platform: "Netflix", slots: 5, email: "" }]);
    if (error) {
      showToast("Erreur lors de l'ajout du compte");
      return;
    }
    await loadAll();
  }

  async function deleteAccount(id) {
    if (subs.some((s) => s.account_id === id)) {
      showToast("Impossible : des profils sont rattachés à ce compte");
      return;
    }
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) {
      showToast("Erreur lors de la suppression du compte");
      return;
    }
    await loadAll();
  }

  async function copyMessage(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Message copié");
    } catch (e) {
      showToast("Copie impossible, sélectionnez le texte manuellement");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  // Détection automatique des rappels
  const pendingReminders = useMemo(() => detectReminders(subs, accountsById), [subs, accountsById]);

  // Mettre à jour le badge PWA quand le nombre de rappels change
  useEffect(() => {
    setAppBadge(pendingReminders.length);
  }, [pendingReminders.length]);

  // Fonction pour envoyer un template à un client via WhatsApp
  function sendTemplateToClient(template, sub, account) {
    const extraVars = { jours_restants: daysUntil(sub.end_date) };
    const message = fillTemplate(template.content, sub, account, extraVars);
    const url = buildWhatsAppUrl(sub.contact, message);
    if (url) {
      window.open(url, "_blank");
      showToast(`Message "${template.name}" ouvert pour ${sub.client_name}`);
    } else {
      showToast("Ajoutez un contact WhatsApp pour cet envoi");
    }
  }

  // Fonction pour copier un template rempli
  async function copyTemplateToClient(template, sub, account) {
    const extraVars = { jours_restants: daysUntil(sub.end_date) };
    const message = fillTemplate(template.content, sub, account, extraVars);
    await copyMessage(message);
  }

  const filteredSubs = useMemo(() => {
    let result = subs;
    
    // Filtrage par catégorie interactive du tableau de bord
    if (filterCategory !== "all") {
      result = result.filter(s => statusOf(s) === filterCategory);
    }
    
    // Filtrage par recherche texte
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((s) => s.client_name?.toLowerCase().includes(q) || s.profile_name?.toLowerCase().includes(q));
    }
    
    return result;
  }, [subs, search, filterCategory]);

  const sortedSubs = [...filteredSubs].sort((a, b) => {
    const order = { expired: 0, soon: 1, ok: 2, blocked: 3 };
    return order[statusOf(a)] - order[statusOf(b)] || daysUntil(a.end_date) - daysUntil(b.end_date);
  });

  const counts = subs.reduce(
    (acc, s) => {
      const st = statusOf(s);
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    },
    { ok: 0, soon: 0, expired: 0, blocked: 0 }
  );

  const expectedRevenue = subs.filter((s) => !s.blocked).reduce((sum, s) => sum + (Number(s.price) || 0), 0);

  const occupiedByAccount = accounts.map((acc) => ({
    ...acc,
    occupied: subs.filter((s) => s.account_id === acc.id && !s.blocked).length,
  }));

  const openAccount = openAccountId ? accountsById[openAccountId] : null;
  const accountSubs = openAccountId ? subs.filter((s) => s.account_id === openAccountId) : [];

  const detailSub = detailSubId ? subs.find((s) => s.id === detailSubId) : null;
  const detailAccount = detailSub ? accountsById[detailSub.account_id] : null;

  if (!loaded && !loadError) {
    return <div className="min-h-screen bg-base flex items-center justify-center text-muted text-sm">Chargement...</div>;
  }

  return (
    <div className="min-h-screen w-full bg-base">
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6 font-sans text-primary min-h-screen flex flex-col">
        <header className="border-b border-line pb-5 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <Logo />
              <div>
                <h1 className="app-title font-semibold text-primary">StreamDesk</h1>
                <p className="text-sm text-muted mt-0.5">Gestion des abonnements Netflix &amp; Spotify</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-semibold text-primary leading-none">{subs.length}</div>
              <div className="text-xs text-muted mt-1">profils</div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {pendingReminders.length > 0 && (
              <button
                onClick={() => setTab("relances")}
                className="text-xs text-danger border border-red-500/30 rounded px-2.5 py-1.5 hover:bg-red-500/10 inline-flex items-center gap-1.5"
                title="Voir les rappels en attente"
              >
                <Bell size={13} />
                {pendingReminders.length} relance{pendingReminders.length > 1 ? "s" : ""}
              </button>
            )}
            <button
              onClick={async () => {
                const result = await requestNotificationPermission();
                setNotifPermission(result);
                if (result === "granted") {
                  showToast("Notifications activées");
                } else if (result === "denied") {
                  showToast("Notifications refusées par le navigateur");
                }
              }}
              className={`text-xs border rounded px-2.5 py-1.5 inline-flex items-center gap-1.5 ${
                notifPermission === "granted"
                  ? "text-success border-emerald-500/30 bg-emerald-500/10"
                  : "text-secondary border-input-border hover:bg-hover"
              }`}
              title={notifPermission === "granted" ? "Notifications activées" : "Activer les notifications"}
            >
              {notifPermission === "granted" ? <Bell size={13} /> : <BellOff size={13} />}
              {notifPermission === "granted" ? "Actives" : "Alertes"}
            </button>
            <button
              onClick={toggleTheme}
              className="text-xs text-secondary border border-input-border rounded px-2.5 py-1.5 hover:bg-hover inline-flex items-center gap-1.5"
              aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"}
              title={theme === "dark" ? "Thème clair" : "Thème sombre"}
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
              {theme === "dark" ? "Clair" : "Sombre"}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs text-secondary border border-input-border rounded px-2.5 py-1.5 hover:bg-hover inline-flex items-center gap-1.5"
              title="Paramètres"
            >
              <Settings2 size={13} /> Paramètres
            </button>
            <button
              onClick={handleSignOut}
              className="text-xs text-secondary border border-input-border rounded px-2.5 py-1.5 hover:bg-hover inline-flex items-center gap-1.5"
            >
              <LogOut size={13} /> Déconnexion
            </button>
          </div>

          {loadError && (
            <div className="mt-4 text-xs text-danger bg-red-500/10 border border-red-500/30 rounded px-3 py-1.5">{loadError}</div>
          )}
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {[
            { key: "ok", label: "Actifs" },
            { key: "soon", label: "Échéance proche" },
            { key: "expired", label: "Expirés" },
            { key: "blocked", label: "Bloqués" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setFilterCategory((c) => (c === s.key ? "all" : s.key));
                setTab("dashboard");
                setOpenAccountId(null);
              }}
              title={`Voir les clients : ${s.label}`}
              className={`rounded-lg bg-card border px-2 py-2.5 text-center transition-colors ${
                filterCategory === s.key
                  ? "border-primary ring-1 ring-primary"
                  : "border-line hover:border-input-border hover:bg-hover"
              }`}
            >
              <div className="text-lg font-semibold text-primary">{counts[s.key] || 0}</div>
              <div className="text-[11px] text-muted leading-tight mt-0.5">{s.label}</div>
            </button>
          ))}
          <div className="rounded-lg bg-revenue-gradient px-2 py-2.5 text-center">
            <div className="text-sm font-semibold text-white leading-tight">{formatFCFA(expectedRevenue)}</div>
            <div className="text-[11px] text-gray-200 leading-tight mt-0.5">Revenu attendu</div>
          </div>
        </div>

        {/* Indicateur de filtre actif */}
        {filterCategory !== "all" && (
          <div className="mb-4 flex items-center gap-2 text-sm text-secondary">
            <span>
              Filtre actif :{" "}
              <strong className="text-primary">
                {STATUS_LABEL[filterCategory]}
              </strong>{" "}
              ({counts[filterCategory] || 0} client{(counts[filterCategory] || 0) > 1 ? "s" : ""})
            </span>
            <button
              onClick={() => setFilterCategory("all")}
              className="text-xs text-muted hover:text-primary underline inline-flex items-center gap-1"
            >
              Réinitialiser
            </button>
          </div>
        )}

        {/* Alertes automatiques */}
        {(() => {
          const upcoming = getUpcomingDeadlines(subs, 7);
          const monthly = getMonthlyRevenue(subs);
          const hasAlerts = upcoming.length > 0 || (automationSummary?.renewed.length || 0) > 0;

          if (!hasAlerts) return null;

          return (
            <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Bell size={15} className="text-amber-400" />
                <span className="subsection-title text-amber-300">Alertes automatiques</span>
                <span className="text-xs text-muted ml-auto">{upcoming.length} échéance{upcoming.length > 1 ? "s" : ""} à venir</span>
              </div>

              {/* Revenu du mois */}
              <div className="flex items-center gap-2 text-secondary mb-2 bg-card border border-line rounded px-2 py-1.5 client-text">
                <TrendingUp size={13} className="text-success shrink-0" />
                <span>Revenu du mois : <strong className="text-primary">{formatFCFA(monthly.total)}</strong> ({monthly.count} paiement{monthly.count > 1 ? "s" : ""})</span>
              </div>

              {/* Renouvellements automatiques récents */}
              {automationSummary?.renewed.length > 0 && (
                <div className="mb-2">
                  {automationSummary.renewed.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-success mb-1 client-text">
                      <Zap size={12} className="shrink-0" />
                      <span>{r.client} : renouvelé automatiquement jusqu&apos;au {formatDate(r.newDate)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Échéances à venir */}
              {upcoming.length > 0 && (
                <div className="space-y-1">
                  {upcoming.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-secondary client-text">
                      <Clock size={12} className={`shrink-0 ${s.daysLeft <= 1 ? "text-red-400" : s.daysLeft <= 3 ? "text-amber-400" : "text-muted"}`} />
                      <span className="truncate">
                        <strong className="text-primary">{s.client_name}</strong> — échéance {s.daysLeft === 0 ? "aujourd'hui" : s.daysLeft === 1 ? "demain" : `dans ${s.daysLeft} j`}
                      </span>
                      <span className="text-muted ml-auto shrink-0">{formatDate(s.end_date)}</span>
                    </div>
                  ))}
                  {upcoming.length > 5 && (
                    <div className="text-xs text-muted mt-1">+ {upcoming.length - 5} autre(s) échéance(s)</div>
                  )}
                </div>
              )}

              {/* Bouton rappel en masse */}
              {upcoming.length > 0 && (
                <button
                  onClick={() => setShowAlerts(true)}
                  className="mt-2 text-xs text-success hover:text-emerald-300 inline-flex items-center gap-1"
                >
                  <Send size={12} /> Envoyer les rappels WhatsApp en masse
                </button>
              )}
            </div>
          );
        })()}

        <div className="flex gap-1 mb-4 border-b border-line">
          {[
            { key: "dashboard", label: "Tableau de bord" },
            { key: "relances", label: `Relances${pendingReminders.length > 0 ? ` (${pendingReminders.length})` : ""}` },
            { key: "accounts", label: "Comptes" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setOpenAccountId(null);
              }}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setShowFormModal({ mode: "add" })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white rounded-md px-3 py-1.5 mb-1.5 self-center bg-brand-gradient"
          >
            <Plus size={15} /> Nouveau profil
          </button>
        </div>

        {tab === "dashboard" && !detailSub && (
          <div className="space-y-2">
            <div className="relative mb-2">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un client ou un profil..."
                className={`${inputCls} pl-8`}
              />
            </div>
            {sortedSubs.length === 0 && (
              <div className="text-center py-12 text-muted text-sm bg-card border border-line rounded-lg">
                {search
                  ? "Aucun résultat pour cette recherche."
                  : filterCategory !== "all"
                  ? `Aucun client dans la catégorie « ${STATUS_LABEL[filterCategory]} ».`
                  : "Aucun profil pour l'instant. Ajoutez votre premier client avec \"+ Nouveau profil\"."}
              </div>
            )}
            {sortedSubs.map((s) => (
              <ProfileRow
                key={s.id}
                sub={s}
                account={accountsById[s.account_id]}
                onOpenDetail={() => setDetailSubId(s.id)}
                onMessage={() => setMessageModal(s)}
                onTogglePaid={() => updateSub(s.id, { paid: !s.paid })}
                onRenew={() => renew(s)}
                onToggleBlocked={() => toggleBlocked(s)}
                onSendWelcome={() => {
                  const t = templates.find((t) => t.id === "welcome");
                  if (t && accountsById[s.account_id]) sendTemplateToClient(t, s, accountsById[s.account_id]);
                }}
                onSendPaymentReceived={() => {
                  const t = templates.find((t) => t.id === "payment_received");
                  if (t && accountsById[s.account_id]) sendTemplateToClient(t, s, accountsById[s.account_id]);
                }}
              />
            ))}
          </div>
        )}

        {tab === "relances" && (
          <div className="space-y-2">
            {pendingReminders.length === 0 && (
              <div className="text-center py-12 text-muted text-sm bg-card border border-line rounded-lg">
                Aucun rappel en attente. Tous vos clients sont à jour !
              </div>
            )}
            {pendingReminders.map(({ sub, account, template, reason }) => {
              const extraVars = { jours_restants: daysUntil(sub.end_date) };
              const message = fillTemplate(template.content, sub, account, extraVars);
              const waUrl = buildWhatsAppUrl(sub.contact, message);
              return (
                <div key={sub.id} className="rounded-lg border border-line bg-card px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {account && <PlatformIcon platform={account.platform} />}
                        <span className="subsection-title text-primary truncate">{sub.client_name}</span>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded border ${
                          reason === "Expiré" ? "bg-red-500/10 text-danger border-red-500/30" :
                          reason === "Expire aujourd'hui" ? "bg-amber-500/10 text-warning border-amber-500/30" :
                          "bg-amber-500/10 text-warning border-amber-500/30"
                        }`}>
                          {reason}
                        </span>
                      </div>
                      <div className="text-sm text-muted mt-1 client-text">
                        {account ? account.name : "Compte supprimé"} · profil "{sub.profile_name}" · échéance {formatDate(sub.end_date)}
                      </div>
                      <div className="text-xs text-muted mt-1 italic">{template.name}</div>
                    </div>
                  </div>
                  <div className="text-sm text-secondary mt-2 whitespace-pre-line line-clamp-3 bg-input-bg border border-line rounded p-2 client-text">
                    {message}
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => copyTemplateToClient(template, sub, account)}
                      className={btnGhost}
                    >
                      Copier
                    </button>
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <Send size={12} /> Envoyer
                      </a>
                    ) : (
                      <span className="text-xs text-muted self-center">Pas de contact WhatsApp</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Fiche détaillée d'un client (point 7 & 8) */}
        {detailSub && (
          <div className="space-y-3">
            <button
              onClick={() => setDetailSubId(null)}
              className="text-sm text-secondary hover:text-primary inline-flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Retour à la liste
            </button>

            <div className="rounded-lg border border-line bg-card px-4 py-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  {detailAccount && <PlatformIcon platform={detailAccount.platform} size={24} />}
                  <div className="min-w-0">
                    <h2 className="section-title text-primary truncate">{detailSub.client_name}</h2>
                    <p className="text-sm text-muted mt-0.5">
                      {detailAccount ? detailAccount.name : "Compte supprimé"}
                    </p>
                  </div>
                </div>
                <Badge status={statusOf(detailSub)} />
              </div>

              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 client-text">
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide">Type d'abonnement</dt>
                  <dd className="text-primary">{detailAccount ? detailAccount.platform : "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide">Profil</dt>
                  <dd className="text-primary">{detailSub.profile_name || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide">Formule</dt>
                  <dd className="text-primary">{detailSub.formula || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide">Code PIN</dt>
                  <dd className="text-primary">{detailSub.pin || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide">Contact WhatsApp</dt>
                  <dd className="text-primary">{detailSub.contact || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide">Prix</dt>
                  <dd className="text-primary">{detailSub.price ? formatFCFA(detailSub.price) : "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide">Date de début</dt>
                  <dd className="text-primary">{formatDate(detailSub.start_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide">Date d'échéance</dt>
                  <dd className="text-primary">
                    {formatDate(detailSub.end_date)}
                    <span className="text-muted">
                      {daysUntil(detailSub.end_date) >= 0
                        ? ` (${daysUntil(detailSub.end_date)} j)`
                        : ` (dépassé de ${Math.abs(daysUntil(detailSub.end_date))} j)`}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide">Paiement</dt>
                  <dd className="text-primary">{detailSub.paid ? "Payé" : "Non payé"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted uppercase tracking-wide">État</dt>
                  <dd className="text-primary">{detailSub.blocked ? "Bloqué" : "Actif"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-line bg-card px-4 py-4">
              <div className="subsection-title text-primary mb-3">Actions</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowFormModal({ mode: "edit", sub: detailSub })}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-input-border text-secondary hover:bg-hover"
                >
                  <Pencil size={13} /> Modifier
                </button>
                <button
                  onClick={() => setMessageModal(detailSub)}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-input-border text-secondary hover:bg-hover"
                >
                  <MessageSquare size={13} /> Rappel
                </button>
                <button
                  onClick={() => updateSub(detailSub.id, { paid: !detailSub.paid })}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-input-border text-secondary hover:bg-hover"
                >
                  {detailSub.paid ? <Circle size={13} /> : <CheckCircle2 size={13} />}
                  {detailSub.paid ? "Marquer non payé" : "Marquer payé"}
                </button>
                <button
                  onClick={() => renew(detailSub)}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-emerald-500/30 text-success hover:bg-emerald-500/10"
                >
                  <RotateCcw size={13} /> Renouveler +30j
                </button>
                <button
                  onClick={() => toggleBlocked(detailSub)}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-input-border text-secondary hover:bg-hover"
                >
                  {detailSub.blocked ? <Unlock size={13} /> : <Lock size={13} />}
                  {detailSub.blocked ? "Débloquer" : "Bloquer"}
                </button>
                <button
                  onClick={() => {
                    const t = templates.find((t) => t.id === "welcome");
                    if (t && detailAccount) sendTemplateToClient(t, detailSub, detailAccount);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-emerald-500/30 text-success hover:bg-emerald-500/10"
                >
                  <MessageSquare size={13} /> Message de bienvenue
                </button>
                <button
                  onClick={() => {
                    const t = templates.find((t) => t.id === "payment_received");
                    if (t && detailAccount) sendTemplateToClient(t, detailSub, detailAccount);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-emerald-500/30 text-success hover:bg-emerald-500/10"
                >
                  <CheckCircle2 size={13} /> Paiement bien reçu
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Supprimer définitivement le profil de ${detailSub.client_name} ?`)) {
                      setDetailSubId(null);
                      deleteSub(detailSub.id);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-red-500/30 text-danger hover:bg-red-500/10 sm:ml-auto"
                >
                  <Trash2 size={13} /> Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "accounts" && !openAccount && !detailSub && (
          <div className="space-y-2">
            {occupiedByAccount.map((acc) => (
              <div key={acc.id} className="rounded-lg border border-line bg-card px-3 py-3">
                {editingAccounts ? (
                  <div className="space-y-2">
                    <input value={acc.name} onChange={(e) => updateAccount(acc.id, { name: e.target.value })} className={inputCls} placeholder="Nom du compte" />
                    <div className="flex gap-2">
                      <select value={acc.platform} onChange={(e) => updateAccount(acc.id, { platform: e.target.value })} className={inputCls}>
                        <option>Netflix</option>
                        <option>Spotify</option>
                      </select>
                      <input
                        type="number"
                        value={acc.slots}
                        onChange={(e) => updateAccount(acc.id, { slots: Number(e.target.value) })}
                        className={`${inputCls} w-20`}
                        placeholder="Places"
                      />
                      <input value={acc.email} onChange={(e) => updateAccount(acc.id, { email: e.target.value })} className={inputCls} placeholder="Email du compte" />
                    </div>
                    <button onClick={() => deleteAccount(acc.id)} className="text-xs text-danger hover:underline inline-flex items-center gap-1">
                      <Trash2 size={12} /> Supprimer ce compte
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setOpenAccountId(acc.id)} className="w-full flex items-center justify-between text-left">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform={acc.platform} size={18} />
                      <div>
                        <div className="subsection-title text-primary">{acc.name}</div>
                        <div className="text-muted mt-0.5 client-text">
                          {acc.platform} · {acc.occupied}/{acc.slots} places occupées
                          {acc.email ? ` · ${acc.email}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-track rounded-full overflow-hidden">
                        <div
                          className={`h-full ${acc.occupied >= acc.slots ? "bg-red-500" : "bg-gray-400"}`}
                          style={{ width: `${Math.min(100, (acc.occupied / acc.slots) * 100)}%` }}
                        />
                      </div>
                      <ChevronRight size={16} className="text-muted" />
                    </div>
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingAccounts((v) => !v)} className={`${btnGhost} bg-card`}>
                <Settings2 size={13} /> {editingAccounts ? "Terminer" : "Modifier les comptes"}
              </button>
              {editingAccounts && (
                <button onClick={addAccount} className={`${btnGhost} bg-card`}>
                  <Plus size={13} /> Ajouter un compte
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "accounts" && openAccount && !detailSub && (
          <div className="space-y-2">
            <button onClick={() => setOpenAccountId(null)} className="text-sm text-secondary hover:text-primary mb-1 inline-flex items-center gap-1">
              <ArrowLeft size={14} /> Retour aux comptes
            </button>
            <div className="bg-card border border-line rounded-lg px-3 py-3 mb-2 flex items-center gap-2.5">
              <PlatformIcon platform={openAccount.platform} size={20} />
              <div>
                <div className="subsection-title text-primary">{openAccount.name}</div>
                <div className="text-muted mt-0.5 client-text">
                  {openAccount.platform} · {accountSubs.filter((s) => !s.blocked).length}/{openAccount.slots} places occupées
                </div>
              </div>
            </div>
            {accountSubs.length === 0 && (
              <div className="text-center py-8 text-muted text-sm bg-card border border-line rounded-lg">
                Aucun profil sur ce compte pour l'instant.
              </div>
            )}
            {accountSubs.map((s) => (
              <ProfileRow
                key={s.id}
                sub={s}
                account={openAccount}
                onOpenDetail={() => setDetailSubId(s.id)}
                onMessage={() => setMessageModal(s)}
                onTogglePaid={() => updateSub(s.id, { paid: !s.paid })}
                onRenew={() => renew(s)}
                onToggleBlocked={() => toggleBlocked(s)}
                onSendWelcome={() => {
                  const t = templates.find((t) => t.id === "welcome");
                  if (t && openAccount) sendTemplateToClient(t, s, openAccount);
                }}
                onSendPaymentReceived={() => {
                  const t = templates.find((t) => t.id === "payment_received");
                  if (t && openAccount) sendTemplateToClient(t, s, openAccount);
                }}
              />
            ))}
          </div>
        )}

        {showFormModal && (
          <ProfileFormModal
            accounts={accounts}
            initial={showFormModal.mode === "edit" ? showFormModal.sub : null}
            onCancel={() => setShowFormModal(null)}
            onSubmit={(form) => saveProfile(form, showFormModal.mode === "edit" ? showFormModal.sub.id : null)}
          />
        )}

        {/* Modale de rappel en masse WhatsApp */}
        {showAlerts && (() => {
          const messages = buildBulkReminderMessages(subs, accountsById);
          if (messages.length === 0) return null;
          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-card border border-line rounded-lg max-w-lg w-full p-4 max-h-[85vh] flex flex-col">
                <div className="subsection-title text-primary mb-1 flex items-center gap-1.5">
                  <Send size={15} /> Rappels en masse — {messages.length} client{messages.length > 1 ? "s" : ""}
                </div>
                <p className="text-xs text-muted mb-3">
                  Messages de rappel WhatsApp pour les échéances à venir. Cliquez pour envoyer à chaque client.
                </p>
                <div className="space-y-2 overflow-y-auto flex-1">
                  {messages.map(({ sub, message, whatsappUrl }) => (
                    <div key={sub.id} className="rounded border border-line bg-input-bg p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="subsection-title text-primary">{sub.client_name}</span>
                        {sub.daysLeft !== undefined && (
                          <span className={`text-[11px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[sub.daysLeft <= 1 ? "expired" : sub.daysLeft <= 3 ? "soon" : "ok"]}`}>
                            {sub.daysLeft === 0 ? "Aujourd'hui" : sub.daysLeft === 1 ? "Demain" : `${sub.daysLeft} j`}
                          </span>
                        )}
                      </div>
                      <div className="text-muted mb-2 whitespace-pre-line line-clamp-3 client-text">{message}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyMessage(message)}
                          className={`${btnGhost} flex-1 justify-center`}
                        >
                          Copier
                        </button>
                        {whatsappUrl ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 text-center text-xs px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            Envoyer
                          </a>
                        ) : (
                          <span className="flex-1 text-center text-xs text-muted py-1">Pas de contact</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-3 pt-3 border-t border-line">
                  <button onClick={() => setShowAlerts(false)} className="text-sm px-3 py-1.5 rounded border border-input-border text-secondary">
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Notification de blocage générée automatiquement (point 5) */}
        {blockedNotice && (() => {
          const { sub, account, template, willBlock } = blockedNotice;
          const message = fillTemplate(template.content, sub, account, {
            jours_restants: daysUntil(sub.end_date),
          });
          const waUrl = buildWhatsAppUrl(sub.contact, message);
          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-card border border-line rounded-lg max-w-md w-full p-4">
                <div className="subsection-title text-primary mb-1 flex items-center gap-1.5">
                  {willBlock ? <Lock size={15} /> : <Unlock size={15} />}
                  {willBlock ? "Client bloqué — notifier" : "Client débloqué — notifier"}
                </div>
                <p className="text-xs text-muted mb-3">
                  Le profil de <strong className="text-primary">{sub.client_name}</strong> est maintenant{" "}
                  {willBlock ? "bloqué" : "débloqué"}. Le message ci-dessous a été généré automatiquement — envoyez-le
                  pour l&apos;informer.
                </p>
                <textarea
                  readOnly
                  value={message}
                  className="w-full h-44 text-sm bg-input-bg border border-input-border rounded p-2 text-input-text resize-none client-text"
                />
                <div className="flex flex-wrap justify-end gap-2 mt-3">
                  <button onClick={() => setBlockedNotice(null)} className="text-sm px-3 py-1.5 rounded border border-input-border text-secondary">
                    Fermer
                  </button>
                  <button onClick={() => copyMessage(message)} className="text-sm px-3 py-1.5 rounded border border-input-border text-secondary">
                    Copier le message
                  </button>
                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setBlockedNotice(null)}
                      className="text-sm px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-center"
                    >
                      Envoyer sur WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-muted self-center">Ajoutez un contact pour l&apos;envoi direct</span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {messageModal && (
          <MessageModal
            sub={messageModal}
            account={accountsById[messageModal.account_id]}
            templates={templates}
            onClose={() => setMessageModal(null)}
            onCopy={copyMessage}
          />
        )}

        {toast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-hover border border-input-border text-primary text-sm px-4 py-2 rounded-md shadow-lg z-50">
            {toast}
          </div>
        )}

        {/* Modale Paramètres - Gestion des templates */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-line rounded-lg max-w-lg w-full p-4 max-h-[85vh] flex flex-col">
              <div className="subsection-title text-primary mb-1 flex items-center gap-1.5">
                <Settings2 size={15} /> Paramètres
              </div>
              <p className="text-xs text-muted mb-3">
                Gérez vos templates de messages. Variables disponibles : {'{prenom}'}, {'{date_echeance}'}, {'{compte}'}, {'{profil}'}, {'{formule}'}, {'{jours_restants}'}, {'{infos_paiement}'}
              </p>
              <div className="space-y-3 overflow-y-auto flex-1">
                {templates.map((t, idx) => (
                  <div key={t.id} className="rounded border border-line bg-input-bg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="subsection-title text-primary">{t.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        t.trigger === "auto" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-gray-500/10 text-neutral border-gray-500/30"
                      }`}>
                        {t.trigger === "auto" ? "Automatique" : "Manuel"}
                      </span>
                    </div>
                    <textarea
                      value={t.content}
                      onChange={(e) => {
                        const updated = [...templates];
                        updated[idx] = { ...t, content: e.target.value };
                        setTemplates(updated);
                        saveTemplates(updated);
                      }}
                      className="w-full h-24 text-xs bg-input-bg border border-input-border rounded p-2 text-input-text resize-none"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-line">
                <button
                  onClick={() => {
                    setTemplates(loadTemplates());
                    saveTemplates(loadTemplates());
                    showToast("Templates réinitialisés");
                  }}
                  className="text-xs text-danger hover:underline"
                >
                  Réinitialiser par défaut
                </button>
                <button onClick={() => setShowSettings(false)} className="text-sm px-3 py-1.5 rounded border border-input-border text-secondary">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageModal({ sub, account, templates, onClose, onCopy }) {
  const defaultTemplateId = templates.find((t) => t.id === "renewal_reminder")?.id || templates[0]?.id;
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplateId);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];
  const message = selectedTemplate
    ? fillTemplate(selectedTemplate.content, sub, account, { jours_restants: daysUntil(sub.end_date) })
    : buildReminderMessage(sub, account);
  const waUrl = buildWhatsAppUrl(sub.contact, message);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-line rounded-lg max-w-md w-full p-4">
        <div className="subsection-title text-primary mb-2 flex items-center gap-1.5">
          <MessageSquare size={15} /> Message de rappel
        </div>
        <div className="mb-2">
          <label className="block text-xs text-muted mb-1">Template</label>
          <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className={inputCls}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          readOnly
          value={message}
          className="w-full h-40 text-sm bg-input-bg border border-input-border rounded p-2 text-input-text resize-none client-text"
        />
        <div className="flex flex-wrap justify-end gap-2 mt-3">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded border border-input-border text-secondary">
            Fermer
          </button>
          <button onClick={() => onCopy(message)} className="text-sm px-3 py-1.5 rounded border border-input-border text-secondary">
            Copier le message
          </button>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-center"
            >
              Envoyer sur WhatsApp
            </a>
          ) : (
            <span className="text-xs text-muted self-center">Ajoutez un contact pour l&apos;envoi direct</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileRow({
  sub: s,
  account,
  onOpenDetail,
  onMessage,
  onTogglePaid,
  onRenew,
  onToggleBlocked,
  onSendWelcome,
  onSendPaymentReceived,
}) {
  const status = statusOf(s);
  const d = daysUntil(s.end_date);
  return (
    <div
      onClick={onOpenDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail();
        }
      }}
      className="rounded-lg border border-line bg-card px-3 py-3 hover:border-input-border transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {account && <PlatformIcon platform={account.platform} />}
            <span className="subsection-title text-primary truncate">{s.client_name}</span>
            <Badge status={status} />
            {s.paid ? (
              <span className="text-xs text-success inline-flex items-center gap-1"><CheckCircle2 size={12} /> Payé</span>
            ) : (
              <span className="text-xs text-muted inline-flex items-center gap-1"><Circle size={12} /> Non payé</span>
            )}
          </div>
          <div className="text-sm text-muted mt-1 client-text">
            {account ? account.name : "Compte supprimé"} · profil "{s.profile_name}"
            {s.formula ? ` · ${s.formula}` : ""} · échéance {formatDate(s.end_date)}
            {d >= 0 ? ` (${d} j)` : ` (dépassé de ${Math.abs(d)} j)`}
            {s.price ? ` · ${formatFCFA(s.price)}` : ""}
          </div>
          {s.contact && <div className="text-sm text-muted mt-0.5 client-text">{s.contact}</div>}
        </div>
        <ChevronRight size={16} className="text-muted shrink-0 mt-1" />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2.5" onClick={(e) => e.stopPropagation()}>
        <button onClick={onMessage} className={btnGhost}>
          <MessageSquare size={12} /> Rappel
        </button>
        <button onClick={onTogglePaid} className={btnGhost}>
          {s.paid ? <Circle size={12} /> : <CheckCircle2 size={12} />} {s.paid ? "Non payé" : "Payé"}
        </button>
        <button onClick={onRenew} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-emerald-500/30 text-success hover:bg-emerald-500/10">
          <RotateCcw size={12} /> +30j
        </button>
        <button onClick={onToggleBlocked} className={btnGhost}>
          {s.blocked ? <Unlock size={12} /> : <Lock size={12} />} {s.blocked ? "Débloquer" : "Bloquer"}
        </button>
        {onSendWelcome && (
          <button onClick={onSendWelcome} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-emerald-500/30 text-success hover:bg-emerald-500/10">
            <MessageSquare size={12} /> Bienvenue
          </button>
        )}
        {onSendPaymentReceived && (
          <button onClick={onSendPaymentReceived} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-emerald-500/30 text-success hover:bg-emerald-500/10">
            <CheckCircle2 size={12} /> Paiement reçu
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileFormModal({ accounts, initial, onCancel, onSubmit }) {
  const isEdit = Boolean(initial);
  const [clientName, setClientName] = useState(initial?.client_name || "");
  const [contact, setContact] = useState(initial?.contact || "");
  const [accountId, setAccountId] = useState(initial?.account_id || accounts[0]?.id || "");
  const [profileName, setProfileName] = useState(initial?.profile_name || "");
  const [formula, setFormula] = useState(initial?.formula || "Standard");
  const [pin, setPin] = useState(initial?.pin || "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    initial?.end_date ||
      (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().slice(0, 10);
      })()
  );
  const [error, setError] = useState("");

  function handleSubmit() {
    if (!clientName.trim()) return setError("Le nom du client est requis");
    if (!accountId) return setError("Sélectionnez un compte");
    if (!profileName.trim()) return setError("Le nom du profil est requis");
    if (!startDate || !endDate) return setError("Les dates sont requises");
    if (new Date(endDate) < new Date(startDate)) return setError("La date de fin doit être après la date de début");
    setError("");
    onSubmit({ clientName, contact, accountId, profileName, formula, pin, startDate, endDate, price: Number(price) || 0 });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-line rounded-lg max-w-md w-full p-4 max-h-[85vh] overflow-y-auto">
        <div className="subsection-title text-primary mb-3">{isEdit ? "Modifier le profil" : "Nouveau profil"}</div>
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs text-muted mb-1">Nom du client</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} placeholder="ex : Awa Koné" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Contact WhatsApp (avec indicatif pays, ex : 22961000000)</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} placeholder="ex : 22961000000" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Compte</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1">Nom du profil</label>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className={inputCls} placeholder="ex : Awa" />
            </div>
            <div className="w-28">
              <label className="block text-xs text-muted mb-1">Formule</label>
              <select value={formula} onChange={(e) => setFormula(e.target.value)} className={inputCls}>
                <option>Standard</option>
                <option>Avec TV</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1">Code PIN</label>
              <input value={pin} onChange={(e) => setPin(e.target.value)} className={inputCls} placeholder="ex : 4821" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1">Prix (FCFA)</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} placeholder="ex : 2000" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1">Date de début</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1">Date d'échéance</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          {error && <div className="text-xs text-danger">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded border border-input-border text-secondary">
            Annuler
          </button>
          <button onClick={handleSubmit} className="text-sm px-3 py-1.5 rounded text-white bg-brand-gradient">
            {isEdit ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
