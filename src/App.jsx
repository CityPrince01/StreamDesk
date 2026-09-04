import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";

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
  ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  soon: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  expired: "bg-red-500/10 text-red-400 border-red-500/30",
  blocked: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};
const STATUS_DOT = { ok: "bg-emerald-400", soon: "bg-amber-400", expired: "bg-red-400", blocked: "bg-gray-400" };

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
  "w-full text-sm bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500";
const btnGhost =
  "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800";

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">Chargement...</div>;
  }

  return session ? <Dashboard /> : <Login />;
}

function Logo({ size = 36 }) {
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #dc2626 0%, #16a34a 100%)",
      }}
    >
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
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Logo size={48} />
          <h1 className="text-xl font-semibold text-gray-50 text-center mt-3">StreamDesk</h1>
          <p className="text-sm text-gray-500 text-center mt-0.5">Gestion de vos abonnements Netflix &amp; Spotify</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Identifiant (email)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="vous@exemple.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Au moins 6 caractères" />
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
          {info && <div className="text-xs text-emerald-400">{info}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full text-sm px-3 py-2 rounded text-white font-medium disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #dc2626 0%, #16a34a 100%)" }}
          >
            {loading ? "Patientez..." : mode === "signin" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setInfo("");
          }}
          className="w-full text-xs text-gray-500 mt-3 hover:text-gray-300"
        >
          {mode === "signin" ? "Pas encore de compte ? En créer un" : "Déjà un compte ? Se connecter"}
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
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

  const accountsById = Object.fromEntries(accounts.map((a) => [a.id, a]));

  const filteredSubs = useMemo(() => {
    if (!search.trim()) return subs;
    const q = search.trim().toLowerCase();
    return subs.filter((s) => s.client_name?.toLowerCase().includes(q) || s.profile_name?.toLowerCase().includes(q));
  }, [subs, search]);

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

  if (!loaded && !loadError) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 text-sm">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 py-6 px-4">
      <div className="w-full max-w-3xl mx-auto font-sans text-gray-100">
        <div className="border-b border-gray-800 pb-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo />
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-50">StreamDesk</h1>
                <p className="text-sm text-gray-500 mt-0.5">Gestion des abonnements Netflix &amp; Spotify</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-semibold text-gray-50">{subs.length}</div>
                <div className="text-xs text-gray-500">profils</div>
              </div>
              <button onClick={handleSignOut} className="text-xs text-gray-400 border border-gray-700 rounded px-2 py-1 hover:bg-gray-800 inline-flex items-center gap-1">
                <LogOut size={13} /> Déconnexion
              </button>
            </div>
          </div>
          {loadError && (
            <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-1.5">{loadError}</div>
          )}
        </div>

        <div className="grid grid-cols-5 gap-2 mb-5">
          {[
            { key: "ok", label: "Actifs" },
            { key: "soon", label: "Échéance proche" },
            { key: "expired", label: "Expirés" },
            { key: "blocked", label: "Bloqués" },
          ].map((s) => (
            <div key={s.key} className="rounded-lg bg-gray-900 border border-gray-800 px-2 py-2.5 text-center">
              <div className="text-lg font-semibold text-gray-50">{counts[s.key] || 0}</div>
              <div className="text-[11px] text-gray-500 leading-tight mt-0.5">{s.label}</div>
            </div>
          ))}
          <div className="rounded-lg px-2 py-2.5 text-center" style={{ background: "linear-gradient(135deg, #7f1d1d 0%, #14532d 100%)" }}>
            <div className="text-sm font-semibold text-white leading-tight">{formatFCFA(expectedRevenue)}</div>
            <div className="text-[11px] text-gray-200 leading-tight mt-0.5">Revenu attendu</div>
          </div>
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-800">
          {[
            { key: "dashboard", label: "Tableau de bord" },
            { key: "accounts", label: "Comptes" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setOpenAccountId(null);
              }}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? "border-gray-100 text-gray-50" : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setShowFormModal({ mode: "add" })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white rounded-md px-3 py-1.5 mb-1.5 self-center"
            style={{ background: "linear-gradient(135deg, #dc2626 0%, #16a34a 100%)" }}
          >
            <Plus size={15} /> Nouveau profil
          </button>
        </div>

        {tab === "dashboard" && (
          <div className="space-y-2">
            <div className="relative mb-2">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un client ou un profil..."
                className={`${inputCls} pl-8`}
              />
            </div>
            {sortedSubs.length === 0 && (
              <div className="text-center py-12 text-gray-500 text-sm bg-gray-900 border border-gray-800 rounded-lg">
                {search ? "Aucun résultat pour cette recherche." : "Aucun profil pour l'instant. Ajoutez votre premier client avec \"+ Nouveau profil\"."}
              </div>
            )}
            {sortedSubs.map((s) => (
              <ProfileRow
                key={s.id}
                sub={s}
                account={accountsById[s.account_id]}
                onEdit={() => setShowFormModal({ mode: "edit", sub: s })}
                onMessage={() => setMessageModal(s)}
                onTogglePaid={() => updateSub(s.id, { paid: !s.paid })}
                onRenew={() => renew(s)}
                onToggleBlocked={() => updateSub(s.id, { blocked: !s.blocked })}
                onDelete={() => deleteSub(s.id)}
              />
            ))}
          </div>
        )}

        {tab === "accounts" && !openAccount && (
          <div className="space-y-2">
            {occupiedByAccount.map((acc) => (
              <div key={acc.id} className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-3">
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
                    <button onClick={() => deleteAccount(acc.id)} className="text-xs text-red-400 hover:underline inline-flex items-center gap-1">
                      <Trash2 size={12} /> Supprimer ce compte
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setOpenAccountId(acc.id)} className="w-full flex items-center justify-between text-left">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform={acc.platform} size={18} />
                      <div>
                        <div className="font-medium text-gray-100">{acc.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {acc.platform} · {acc.occupied}/{acc.slots} places occupées
                          {acc.email ? ` · ${acc.email}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${acc.occupied >= acc.slots ? "bg-red-500" : "bg-gray-400"}`}
                          style={{ width: `${Math.min(100, (acc.occupied / acc.slots) * 100)}%` }}
                        />
                      </div>
                      <ChevronRight size={16} className="text-gray-600" />
                    </div>
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingAccounts((v) => !v)} className={`${btnGhost} bg-gray-900`}>
                <Settings2 size={13} /> {editingAccounts ? "Terminer" : "Modifier les comptes"}
              </button>
              {editingAccounts && (
                <button onClick={addAccount} className={`${btnGhost} bg-gray-900`}>
                  <Plus size={13} /> Ajouter un compte
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "accounts" && openAccount && (
          <div className="space-y-2">
            <button onClick={() => setOpenAccountId(null)} className="text-sm text-gray-400 hover:text-gray-100 mb-1 inline-flex items-center gap-1">
              <ArrowLeft size={14} /> Retour aux comptes
            </button>
            <div className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-3 mb-2 flex items-center gap-2.5">
              <PlatformIcon platform={openAccount.platform} size={20} />
              <div>
                <div className="font-medium text-gray-100">{openAccount.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {openAccount.platform} · {accountSubs.filter((s) => !s.blocked).length}/{openAccount.slots} places occupées
                </div>
              </div>
            </div>
            {accountSubs.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm bg-gray-900 border border-gray-800 rounded-lg">
                Aucun profil sur ce compte pour l'instant.
              </div>
            )}
            {accountSubs.map((s) => (
              <ProfileRow
                key={s.id}
                sub={s}
                account={openAccount}
                onEdit={() => setShowFormModal({ mode: "edit", sub: s })}
                onMessage={() => setMessageModal(s)}
                onTogglePaid={() => updateSub(s.id, { paid: !s.paid })}
                onRenew={() => renew(s)}
                onToggleBlocked={() => updateSub(s.id, { blocked: !s.blocked })}
                onDelete={() => deleteSub(s.id)}
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

        {messageModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-md w-full p-4">
              <div className="font-medium text-gray-100 mb-2 flex items-center gap-1.5">
                <MessageSquare size={15} /> Message de rappel
              </div>
              <textarea
                readOnly
                value={buildReminderMessage(messageModal, accountsById[messageModal.account_id])}
                className="w-full h-40 text-sm bg-gray-800 border border-gray-700 rounded p-2 text-gray-200 resize-none"
              />
              <div className="flex flex-wrap justify-end gap-2 mt-3">
                <button onClick={() => setMessageModal(null)} className="text-sm px-3 py-1.5 rounded border border-gray-700 text-gray-300">
                  Fermer
                </button>
                <button
                  onClick={() => copyMessage(buildReminderMessage(messageModal, accountsById[messageModal.account_id]))}
                  className="text-sm px-3 py-1.5 rounded border border-gray-700 text-gray-300"
                >
                  Copier le message
                </button>
                {whatsappLink(messageModal.contact, buildReminderMessage(messageModal, accountsById[messageModal.account_id])) ? (
                  <a
                    href={whatsappLink(messageModal.contact, buildReminderMessage(messageModal, accountsById[messageModal.account_id]))}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-center"
                  >
                    Envoyer sur WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-gray-500 self-center">Ajoutez un contact pour l'envoi direct</span>
                )}
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 text-gray-100 text-sm px-4 py-2 rounded-md shadow-lg z-50">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ sub: s, account, onEdit, onMessage, onTogglePaid, onRenew, onToggleBlocked, onDelete }) {
  const status = statusOf(s);
  const d = daysUntil(s.end_date);
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-3 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {account && <PlatformIcon platform={account.platform} />}
            <span className="font-medium text-gray-100 truncate">{s.client_name}</span>
            <Badge status={status} />
            {s.paid ? (
              <span className="text-xs text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Payé</span>
            ) : (
              <span className="text-xs text-gray-500 inline-flex items-center gap-1"><Circle size={12} /> Non payé</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {account ? account.name : "Compte supprimé"} · profil "{s.profile_name}"
            {s.formula ? ` · ${s.formula}` : ""} · échéance {formatDate(s.end_date)}
            {d >= 0 ? ` (${d} j)` : ` (dépassé de ${Math.abs(d)} j)`}
            {s.price ? ` · ${formatFCFA(s.price)}` : ""}
          </div>
          {s.contact && <div className="text-xs text-gray-600 mt-0.5">{s.contact}</div>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        <button onClick={onEdit} className={btnGhost}>
          <Pencil size={12} /> Modifier
        </button>
        <button onClick={onMessage} className={btnGhost}>
          <MessageSquare size={12} /> Rappel
        </button>
        <button onClick={onTogglePaid} className={btnGhost}>
          {s.paid ? <Circle size={12} /> : <CheckCircle2 size={12} />} {s.paid ? "Non payé" : "Payé"}
        </button>
        <button onClick={onRenew} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
          <RotateCcw size={12} /> +30j
        </button>
        <button onClick={onToggleBlocked} className={btnGhost}>
          {s.blocked ? <Unlock size={12} /> : <Lock size={12} />} {s.blocked ? "Débloquer" : "Bloquer"}
        </button>
        <button onClick={onDelete} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 ml-auto">
          <Trash2 size={12} /> Supprimer
        </button>
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
      <div className="bg-gray-900 border border-gray-800 rounded-lg max-w-md w-full p-4 max-h-[85vh] overflow-y-auto">
        <div className="font-medium text-gray-100 mb-3">{isEdit ? "Modifier le profil" : "Nouveau profil"}</div>
        <div className="space-y-2.5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nom du client</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} placeholder="ex : Awa Koné" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contact WhatsApp (avec indicatif pays, ex : 22961000000)</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} placeholder="ex : 22961000000" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Compte</label>
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
              <label className="block text-xs text-gray-500 mb-1">Nom du profil</label>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className={inputCls} placeholder="ex : Awa" />
            </div>
            <div className="w-28">
              <label className="block text-xs text-gray-500 mb-1">Formule</label>
              <select value={formula} onChange={(e) => setFormula(e.target.value)} className={inputCls}>
                <option>Standard</option>
                <option>Avec TV</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Code PIN</label>
              <input value={pin} onChange={(e) => setPin(e.target.value)} className={inputCls} placeholder="ex : 4821" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Prix (FCFA)</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} placeholder="ex : 2000" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Date de début</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Date d'échéance</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded border border-gray-700 text-gray-300">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="text-sm px-3 py-1.5 rounded text-white"
            style={{ background: "linear-gradient(135deg, #dc2626 0%, #16a34a 100%)" }}
          >
            {isEdit ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
