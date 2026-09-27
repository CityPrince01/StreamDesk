// StreamDesk - Module d'automatisation
// Gère : vérification des échéances, renouvellement automatique, rappels

import { showSubscriptionExpiring, showSubscriptionExpired, showSubscriptionRenewed, showPaymentPending } from "./notifications";

// Déclencheurs de rappel (jours avant échéance)
const REMINDER_DAYS = [7, 3, 1];

// Clé pour stocker l'état des notifications déjà envoyées
const NOTIFICATION_LOG_KEY = "streamdesk_notification_log";

function getNotificationLog() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_LOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveNotificationLog(log) {
  try {
    localStorage.setItem(NOTIFICATION_LOG_KEY, JSON.stringify(log));
  } catch {
    // stockage indisponible
  }
}

function alreadyNotified(log, key) {
  return log[key] === true;
}

function markNotified(log, key) {
  log[key] = true;
  saveNotificationLog(log);
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function getNextRenewalDate(endDateStr) {
  const base = new Date(endDateStr) > new Date() ? new Date(endDateStr) : new Date();
  base.setDate(base.getDate() + 30);
  return base.toISOString().slice(0, 10);
}

/**
 * Vérifie tous les abonnements et déclenche les actions automatiques :
 * - Notifications de rappel (J-7, J-3, J-1)
 * - Renouvellement automatique à échéance
 * - Notifications de paiement en attente
 *
 * Retourne un résumé des actions effectuées.
 */
export async function runAutomation(subs, accountsById, updateSub) {
  const log = getNotificationLog();
  const actions = {
    renewed: [],
    reminders: [],
    payments: [],
  };

  for (const sub of subs) {
    if (sub.blocked) continue;

    const d = daysUntil(sub.end_date);

    // 1. Renouvellement automatique si expiré
    if (d < 0 && !sub.paid) {
      const newDate = getNextRenewalDate(sub.end_date);
      await updateSub(sub.id, { end_date: newDate, paid: true, blocked: false });
      markNotified(log, `renewed-${sub.id}`);
      actions.renewed.push({ client: sub.client_name, newDate });
      showSubscriptionRenewed(sub.client_name, newDate);
      continue;
    }

    // 2. Rappels de renouvellement (J-7, J-3, J-1)
    if (d >= 0 && d <= 7 && REMINDER_DAYS.includes(d)) {
      const reminderKey = `reminder-${sub.id}-d${d}`;
      if (!alreadyNotified(log, reminderKey)) {
        markNotified(log, reminderKey);
        actions.reminders.push({ client: sub.client_name, daysLeft: d });
        showSubscriptionExpiring(sub.client_name, d);
      }
    }

    // 3. Alerte paiement en attente
    if (!sub.paid && d >= 0 && d <= 3) {
      const paymentKey = `payment-${sub.id}-d${d}`;
      if (!alreadyNotified(log, paymentKey)) {
        markNotified(log, paymentKey);
        actions.payments.push({ client: sub.client_name, price: sub.price });
        showPaymentPending(sub.client_name, sub.price);
      }
    }
  }

  saveNotificationLog(log);
  return actions;
}

/**
 * Génère un résumé des échéances à venir (7 prochains jours)
 */
export function getUpcomingDeadlines(subs, days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return subs
    .filter((s) => {
      if (s.blocked) return false;
      const d = daysUntil(s.end_date);
      return d >= 0 && d <= days;
    })
    .map((s) => ({ ...s, daysLeft: daysUntil(s.end_date) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Génère les messages de rappel WhatsApp pour les échéances à venir
 */
export function buildBulkReminderMessages(subs, accountsById) {
  const upcoming = getUpcomingDeadlines(subs, 7);

  return upcoming.map((sub) => {
    const account = accountsById[sub.account_id];
    const d = sub.daysLeft;
    const when =
      d === 0
        ? `expire aujourd'hui`
        : d === 1
        ? `expire demain`
        : `expire dans ${d} jour${d > 1 ? "s" : ""}`;

    const message = `Bonjour ${sub.client_name}\n\nVotre abonnement ${account ? account.platform : ""} (profil "${sub.profile_name}") ${when}, le ${new Date(
      sub.end_date
    ).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}.\n\nPour continuer à profiter de votre abonnement sans interruption, merci d'effectuer le renouvellement par Mobile Money et de m'envoyer la capture de paiement.\n\nMerci de votre confiance !`;

    return {
      sub,
      message,
      whatsappUrl: buildWhatsAppUrl(sub.contact, message),
    };
  });
}

function buildWhatsAppUrl(contact, message) {
  const digits = (contact || "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Calcule les revenus du mois en cours
 */
export function getMonthlyRevenue(subs) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const paidThisMonth = subs.filter((s) => {
    if (!s.paid) return false;
    const created = new Date(s.created_at);
    return created.getMonth() === month && created.getFullYear() === year;
  });

  const total = paidThisMonth.reduce((sum, s) => sum + (Number(s.price) || 0), 0);

  return { total, count: paidThisMonth.length };
}

/**
 * Réinitialise le journal de notifications (pour tests ou reset)
 */
export function resetNotificationLog() {
  localStorage.removeItem(NOTIFICATION_LOG_KEY);
}

/**
 * Nettoie les anciennes entrées du journal (plus de 30 jours)
 */
export function cleanOldNotificationLog() {
  const log = getNotificationLog();
  const keys = Object.keys(log);
  // Le log ne stocke que des valeurs true, on reset complet si trop grand
  // Approche simple : reset si plus de 100 entrées
  if (keys.length > 100) {
    saveNotificationLog({});
  }
}

// Export des constantes utiles
export { REMINDER_DAYS, getNextRenewalDate };
