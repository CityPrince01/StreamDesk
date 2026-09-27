// StreamDesk - Module de notifications navigateur

export function isNotificationSupported() {
  return "Notification" in window && "serviceWorker" in navigator;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("[StreamDesk] Service Worker enregistré:", registration.scope);
    return registration;
  } catch (error) {
    console.error("[StreamDesk] Erreur enregistrement SW:", error);
    return null;
  }
}

export async function showNotification(title, options = {}) {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) {
    await registration.showNotification(title, {
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      ...options,
    });
  } else {
    new Notification(title, {
      icon: "/icon-192.png",
      ...options,
    });
  }
}

// Planifier une notification à un moment précis
export async function scheduleNotification(title, body, delayMs, tag = "") {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: tag || `streamdesk-${Date.now()}`,
    requireInteraction: false,
  };

  // Utiliser le Service Worker pour les notifications planifiées
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      // Pour les notifications immédiates ou courtes
      if (delayMs < 60000) {
        setTimeout(() => {
          registration.showNotification(title, options);
        }, delayMs);
        return;
      }
      // Pour les notifications longues, utiliser l'API Periodic Background Sync si disponible
      // Sinon, stockage dans IndexedDB pour traitement ultérieur
    }
  }

  // Fallback : notification immédiate avec setTimeout
  setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification(title, options);
    }
  }, delayMs);
}

// Types de notifications StreamDesk
export const NotificationTypes = {
  SUBSCRIPTION_EXPIRING: "subscription_expiring",
  SUBSCRIPTION_EXPIRED: "subscription_expired",
  SUBSCRIPTION_RENEWED: "subscription_renewed",
  PAYMENT_PENDING: "payment_pending",
  REVENUE_ALERT: "revenue_alert",
};

export function showSubscriptionExpiring(clientName, daysLeft) {
  const body =
    daysLeft === 0
      ? `L'abonnement de ${clientName} expire aujourd'hui !`
      : daysLeft === 1
      ? `L'abonnement de ${clientName} expire demain.`
      : `L'abonnement de ${clientName} expire dans ${daysLeft} jours.`;

  showNotification("StreamDesk - Échéance proche", {
    body,
    tag: `expiring-${clientName}`,
    data: { type: NotificationTypes.SUBSCRIPTION_EXPIRING, url: "/" },
  });
}

export function showSubscriptionExpired(clientName) {
  showNotification("StreamDesk - Abonnement expiré", {
    body: `L'abonnement de ${clientName} a expiré. Renouvellement automatique appliqué.`,
    tag: `expired-${clientName}`,
    data: { type: NotificationTypes.SUBSCRIPTION_EXPIRED, url: "/" },
  });
}

export function showSubscriptionRenewed(clientName, endDate) {
  const formatted = new Date(endDate).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  showNotification("StreamDesk - Renouvellement automatique", {
    body: `L'abonnement de ${clientName} a été renouvelé jusqu'au ${formatted}.`,
    tag: `renewed-${clientName}`,
    data: { type: NotificationTypes.SUBSCRIPTION_RENEWED, url: "/" },
  });
}

export function showPaymentPending(clientName, amount) {
  showNotification("StreamDesk - Paiement en attente", {
    body: `${clientName} - ${Math.round(amount).toLocaleString("fr-FR")} FCFA en attente de paiement.`,
    tag: `payment-${clientName}`,
    data: { type: NotificationTypes.PAYMENT_PENDING, url: "/" },
  });
}

/**
 * Met à jour le badge sur l'icône PWA (Android/Chrome)
 * Utilise l'API Badge API si disponible
 */
export function setAppBadge(count) {
  if (!("setAppBadge" in navigator)) return;
  try {
    if (count > 0) {
      navigator.setAppBadge(count);
    } else {
      navigator.clearAppBadge();
    }
  } catch {
    // API non supportée ou permission refusée
  }
}
