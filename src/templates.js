// StreamDesk - Module de templates de messages et de détection des rappels

// Clé localStorage pour les templates personnalisés
const TEMPLATES_KEY = "streamdesk_templates";

/**
 * Bloc d'informations de paiement Mobile Money.
 * Centralisé ici : toute modification du numéro ou du nom du titulaire
 * se répercute automatiquement sur tous les templates qui l'utilisent,
 * sans avoir à éditer chaque message un par un.
 */
export const PAYMENT_INFO = {
  mtn: "0157125135",
  moov: "0198426374",
  holder: "Gilles Oboubé Habib Doria JAMES",
};

/** Construit le bloc de paiement prêt à insérer dans un message. */
export function buildPaymentInfoBlock() {
  return [
    "💳 Paiement Mobile Money",
    `MTN : ${PAYMENT_INFO.mtn}`,
    `Moov : ${PAYMENT_INFO.moov}`,
    `Nom du compte : ${PAYMENT_INFO.holder}`,
  ].join("\n");
}

// Templates par défaut
const DEFAULT_TEMPLATES = [
  {
    id: "welcome",
    name: "Bienvenue",
    trigger: "manual",
    content:
      "Bonjour {prenom} ! 🎉\n\nBienvenue chez StreamDesk ! Votre abonnement {compte} est maintenant actif.\n\nProfil : {profil}\nFormule : {formule}\nÉchéance : {date_echeance}\n\nN'hésitez pas à nous contacter pour toute question. Bon streaming !",
  },
  {
    id: "expired",
    name: "Abonnement expiré",
    trigger: "auto",
    condition: "expired",
    content:
      "Bonjour {prenom} ⚠️\n\nVotre abonnement {compte} a expiré.\n\nProfil : {profil}\nDate d'expiration : {date_echeance}\n\nPour renouveler, effectuez le paiement ci-dessous puis envoyez-nous la capture :\n\n{infos_paiement}\n\nMerci !",
  },
  {
    id: "last_day",
    name: "Dernier jour avant expiration",
    trigger: "auto",
    condition: "last_day",
    content:
      "Bonjour {prenom} ⏰\n\nC'est le dernier jour ! Votre abonnement {compte} expire aujourd'hui.\n\nProfil : {profil}\nÉchéance : {date_echeance}\n\nRenouvelez maintenant pour ne pas perdre votre accès :\n\n{infos_paiement}\n\nMerci !",
  },
  {
    id: "renewal_reminder",
    name: "Renouvellement à venir",
    trigger: "auto",
    condition: "renewal_3d",
    content:
      "Bonjour {prenom} 📅\n\nRappel : votre abonnement {compte} expire dans {jours_restants} jours.\n\nProfil : {profil}\nÉchéance : {date_echeance}\n\nPensez à renouveler pour éviter toute interruption :\n\n{infos_paiement}\n\nMerci !",
  },
  {
    id: "payment_received",
    name: "Paiement bien reçu",
    trigger: "manual",
    condition: "paid",
    content:
      "Bonjour {prenom} ✅\n\nMerci ! Votre paiement pour {compte} a bien été reçu.\n\nProfil : {profil}\nNouvelle échéance : {date_echeance}\n\nBon streaming !",
  },
  {
    id: "blocked",
    name: "Notification de blocage",
    trigger: "manual",
    condition: "blocked",
    content:
      "Bonjour {prenom} 🚫\n\nVotre accès au profil {profil} de l'abonnement {compte} a été temporairement suspendu, faute de renouvellement.\n\nPour régulariser votre situation et réactiver votre accès, effectuez le paiement ci-dessous :\n\n{infos_paiement}\n\nCordialement.",
  },
  {
    id: "unblocked",
    name: "Notification de déblocage",
    trigger: "manual",
    condition: "unblocked",
    content:
      "Bonjour {prenom} ✅\n\nVotre abonnement {compte} (profil {profil}) a bien été réactivé.\n\nVous pouvez de nouveau profiter de votre service. Échéance : {date_echeance}.\n\nAu plaisir !",
  },
];

/**
 * Templates qui doivent exposer le bloc d'informations de paiement.
 * Sert à rattraper les templates déjà personnalisés et sauvegardés
 * localement avant l'introduction de la variable {infos_paiement}.
 */
const PAYMENT_TEMPLATES = new Set(["expired", "last_day", "renewal_reminder", "blocked"]);

/**
 * Garantit la présence du bloc de paiement dans les templates concernés,
 * sans dupliquer la variable si elle est déjà présente.
 */
function ensurePaymentInfo(templates) {
  return templates.map((t) => {
    if (!PAYMENT_TEMPLATES.has(t.id)) return t;
    if (typeof t.content !== "string" || t.content.includes("{infos_paiement}")) return t;
    return { ...t, content: `${t.content}\n\n{infos_paiement}` };
  });
}

/**
 * Charge les templates depuis localStorage, ou retourne les défauts
 */
export function loadTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Fusionner avec les défauts pour ajouter les nouveaux templates manquants
        const customIds = parsed.map((t) => t.id);
        const missing = DEFAULT_TEMPLATES.filter((t) => !customIds.includes(t.id));
        return ensurePaymentInfo([...parsed, ...missing]);
      }
    }
  } catch {
    // stockage indisponible
  }
  return ensurePaymentInfo([...DEFAULT_TEMPLATES]);
}

/**
 * Sauvegarde les templates dans localStorage
 */
export function saveTemplates(templates) {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // stockage indisponible
  }
}

/**
 * Construit la libellé du type d'abonnement à partir des deux champs existants :
 * - le niveau / formule (champ `formula` de la fiche client : Standard, Premium, Avec TV...)
 * - le service (champ `platform` du compte : Netflix, Spotify)
 *
 * Exemples : "Standard Netflix", "Premium Netflix", "Spotify"
 */
export function buildSubscriptionLabel(sub, account) {
  const service = account?.platform || "";
  const tier = (sub?.formula || "").trim();

  if (tier && service) return `${tier} ${service}`;
  if (tier) return tier;
  if (service) return service;
  return "votre abonnement";
}

/**
 * Remplace les variables dans un template par les données du client
 */
export function fillTemplate(templateContent, sub, account, extraVars = {}) {
  const prenom = sub.client_name?.split(" ")[0] || sub.client_name || "";
  const compte = buildSubscriptionLabel(sub, account);
  const dateEcheance = formatDateFr(sub.end_date);
  const joursRestants = extraVars.jours_restants ?? daysUntil(sub.end_date);

  return templateContent
    .replace(/\{prenom\}/g, prenom)
    .replace(/\{date_echeance\}/g, dateEcheance)
    .replace(/\{compte\}/g, compte)
    .replace(/\{profil\}/g, sub.profile_name || "")
    .replace(/\{formule\}/g, sub.formula || "")
    .replace(/\{jours_restants\}/g, String(joursRestants))
    .replace(/\{infos_paiement\}/g, buildPaymentInfoBlock());
}

/**
 * Détecte quels clients ont besoin d'un rappel automatique
 * Retourne un tableau de { sub, account, template, priority }
 */
export function detectReminders(subs, accountsById) {
  const reminders = [];

  for (const sub of subs) {
    if (sub.blocked) continue;

    const d = daysUntil(sub.end_date);
    const account = accountsById[sub.account_id];

    // Abonnement expiré (d < 0)
    if (d < 0) {
      const template = DEFAULT_TEMPLATES.find((t) => t.id === "expired");
      if (template) {
        reminders.push({ sub, account, template, priority: 1, reason: "Expiré" });
      }
      continue;
    }

    // Dernier jour avant expiration (d === 0)
    if (d === 0) {
      const template = DEFAULT_TEMPLATES.find((t) => t.id === "last_day");
      if (template) {
        reminders.push({ sub, account, template, priority: 2, reason: "Expire aujourd'hui" });
      }
      continue;
    }

    // Renouvellement à venir (d <= 3)
    if (d <= 3) {
      const template = DEFAULT_TEMPLATES.find((t) => t.id === "renewal_reminder");
      if (template) {
        reminders.push({ sub, account, template, priority: 3, reason: `Expire dans ${d} j` });
      }
      continue;
    }
  }

  // Trier par priorité (1 = plus urgent)
  return reminders.sort((a, b) => a.priority - b.priority);
}

/**
 * Construit le lien WhatsApp avec le message
 */
export function buildWhatsAppUrl(contact, message) {
  const digits = (contact || "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// Helpers locaux
function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function formatDateFr(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
