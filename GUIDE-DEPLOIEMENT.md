# Guide de mise en ligne de StreamDesk

Comptez environ 20 à 30 minutes. Suivez les étapes dans l'ordre.

## Étape 1 — Créer votre base de données (Supabase)

1. Allez sur https://supabase.com et cliquez sur "Start your project".
2. Créez un compte gratuit (avec votre email ou GitHub).
3. Cliquez sur "New project". Donnez-lui un nom (ex: "streamdesk"), choisissez un mot de passe pour la base de données (notez-le quelque part), et choisissez une région proche (ex: Europe).
4. Attendez 1 à 2 minutes que le projet soit prêt.
5. Dans le menu de gauche, allez dans **SQL Editor** → **New query**.
6. Ouvrez le fichier `schema.sql` fourni avec ce projet, copiez tout son contenu, collez-le dans l'éditeur, puis cliquez sur **Run**. Cela crée vos tables et sécurise vos données.
7. Toujours dans le menu de gauche, allez dans **Project Settings** (icône d'engrenage) → **API Keys** (Supabase a renommé cette section, ce n'est plus "API").
8. Notez deux informations, vous en aurez besoin à l'étape 3 :
   - **Project URL** (ressemble à `https://xxxxx.supabase.co`)
   - **Publishable key** (une clé qui commence par `sb_publishable_...` — c'est le nouveau nom de ce qu'on appelait "anon key")

   Raccourci : le bouton **Connect** en haut du projet affiche aussi directement l'URL et la clé à copier.

### Important : désactiver la confirmation par email (recommandé pour un usage personnel)
Par défaut, Supabase envoie un email de confirmation à la création de compte. Pour simplifier votre première connexion :
1. Allez dans **Authentication** → **Sign In / Providers**.
2. Cliquez sur **Email** pour ouvrir ses réglages.
3. Désactivez "Confirm email".
4. Sauvegardez.

*(Si le libellé exact diffère légèrement chez vous, cherchez "Email" dans la barre de recherche du dashboard Supabase — l'interface évolue régulièrement.)*

## Étape 2 — Préparer le code

1. Décompressez le dossier `streamdesk-app` fourni.
2. Gardez de côté les deux valeurs notées à l'étape 1 (Project URL et Publishable key) — vous les utiliserez directement dans l'interface de Vercel à l'étape 3, sans avoir besoin de créer de fichier `.env` sur votre ordinateur.

## Étape 3 — Publier en ligne (GitHub + Vercel, sans rien installer)

1. Allez sur https://github.com et créez un compte gratuit (si vous n'en avez pas déjà un).
2. Cliquez sur **"New repository"** (bouton "+" en haut à droite, ou "New" sur la page principale).
3. Donnez-lui un nom (ex: `streamdesk`), laissez-le en **Private**, cliquez **"Create repository"**.
4. Sur la page du dépôt créé, cliquez sur le lien **"uploading an existing file"**.
5. Glissez-déposez **tout le contenu** du dossier `streamdesk-app` (les fichiers et sous-dossiers `src`, `index.html`, `package.json`, `schema.sql`, etc.).
6. En bas de page, cliquez **"Commit changes"** pour valider l'envoi.
7. Allez sur https://vercel.com, créez un compte gratuit (vous pouvez vous inscrire directement avec votre compte GitHub, c'est le plus simple).
8. Cliquez **"Add New..."** → **"Project"**.
9. Choisissez **"Import"** à côté du dépôt `streamdesk` que vous venez de créer sur GitHub.
10. Vercel détecte automatiquement qu'il s'agit d'un projet Vite et propose les bons réglages par défaut — ne changez rien à cette étape.
11. Avant de cliquer sur **"Deploy"**, dépliez la section **"Environment Variables"** et ajoutez vos deux valeurs (celles notées à l'étape 1) :
    - Nom : `VITE_SUPABASE_URL` → Valeur : votre Project URL
    - Nom : `VITE_SUPABASE_PUBLISHABLE_KEY` → Valeur : votre Publishable key
12. Cliquez **"Deploy"**. Après 1 à 2 minutes, Vercel vous donne un lien (ex: `https://streamdesk-xxxx.vercel.app`) — c'est votre application, accessible depuis n'importe quel appareil.

### Pour les futures mises à jour
Si je vous prépare une nouvelle version du code plus tard, il vous suffira de re-glisser-déposer les fichiers modifiés dans votre dépôt GitHub (même procédure qu'à l'étape 5) : Vercel republie automatiquement l'application à chaque changement.

## Étape 4 — Créer votre compte personnel

1. Ouvrez le lien Vercel obtenu.
2. Cliquez sur "Pas encore de compte ? En créer un", entrez l'email et le mot de passe que vous voulez utiliser.
3. Connectez-vous. Vos 3 comptes par défaut (Netflix Famille 1, Netflix Famille 2, Spotify Famille) seront créés automatiquement au premier chargement.

## En cas de blocage

Si une étape ne se passe pas comme prévu, faites une capture d'écran du message d'erreur et montrez-la-moi ici — je vous aiderai à débloquer la situation.
