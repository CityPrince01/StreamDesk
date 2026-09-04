# Mise à jour de StreamDesk — nouvelles fonctionnalités

Ce qui est ajouté :
- Bouton **Modifier** sur chaque profil
- Clic sur un compte → vue détaillée avec ses profils, éditables directement
- Bouton **Envoyer sur WhatsApp** (message pré-rempli, prêt à envoyer) — nécessite un contact au format `22961000000` (indicatif pays + numéro, sans espace ni +)
- Champ **Prix** par profil + **revenu attendu** affiché en haut du tableau de bord
- Barre de **recherche** par client/profil
- Application **installable sur Android** ("Ajouter à l'écran d'accueil" depuis Chrome, après ouverture du lien)

## Comment l'appliquer

### 1. Mettre à jour la base de données (une seule fois)
Dans Supabase → **SQL Editor** → **New query**, copiez-collez le contenu du fichier `migration-add-price.sql`, puis cliquez **Run**. Cela ajoute le champ prix sans toucher à vos données existantes.

### 2. Mettre à jour le code
Dans le dossier `streamdesk-app` que vous aviez déployé :
1. Remplacez le fichier `src/App.jsx` par la nouvelle version fournie
2. Remplacez `index.html` par la nouvelle version
3. Ajoutez le dossier `public/` (contient `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`) — nécessaire pour l'installation sur Android

### 3. Republier
Dans le terminal, à la racine du dossier :
```
vercel --prod
```
Votre lien reste identique, il affiche simplement la nouvelle version.

### 4. Ajouter un numéro WhatsApp aux profils existants
Pour que le bouton "Envoyer sur WhatsApp" fonctionne, éditez chaque profil (bouton **Modifier**) et complétez le champ contact au format `22961000000` si ce n'est pas déjà fait.

### 5. Installer sur Android
Ouvrez votre lien StreamDesk dans **Chrome** sur votre téléphone → menu (⋮) → **"Ajouter à l'écran d'accueil"** (ou une bannière d'installation apparaîtra automatiquement). L'icône s'ajoute comme une vraie application.

---

# Mise à jour v3 — Thème sombre + icônes

Ce qui change :
- Thème sombre sur toute l'application
- Touches de couleur : rouge pour les éléments Netflix, vert pour Spotify (logo dégradé rouge→vert)
- Icônes sur toutes les actions (modifier, supprimer, rappel, renouveler, bloquer, etc.)
- Une petite icône de plateforme (🎬 rouge / 🎵 vert) devant chaque compte et chaque profil

## Comment l'appliquer
1. Remplacez `src/App.jsx`, `src/index.css`, `index.html` et `public/manifest.json` par les nouvelles versions
2. Remplacez aussi `package.json` (une nouvelle dépendance, `lucide-react`, a été ajoutée pour les icônes)
3. Dans le terminal, à la racine du dossier :
   ```
   npm install
   vercel --prod
   ```
   (le `npm install` est nécessaire cette fois pour récupérer la nouvelle dépendance avant de republier)

Aucun changement côté base de données pour cette mise à jour — vos données ne sont pas concernées.
