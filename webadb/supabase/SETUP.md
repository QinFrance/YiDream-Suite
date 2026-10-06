# Mise en route des comptes YiDream Suite

L’interface de gestion utilise Supabase Auth et Postgres. Le schéma isole chaque compte revendeur avec les règles RLS de PostgreSQL. L’adresse et la clé publique du projet sont injectées au moment de la compilation du site. La clé privée `service_role` ne doit jamais être placée dans GitHub Actions ou dans le navigateur.

## 1. Créer la base de données

1. Crée un projet Supabase.
2. Dans **SQL Editor**, exécute tout le fichier `webadb/supabase/migrations/20261006000000_reseller_admin.sql`.
3. Dans les réglages du projet, relève **Project URL** et la clé publique **anon/publishable**.

## 2. Configurer la connexion Google

1. Dans **Authentication → URL Configuration**, ajoute ces URL de redirection :
   - `https://qinfrance.github.io/YiDream-Suite/admin.html`
   - `http://localhost:5173/admin.html` pour les essais locaux.
2. Dans **Authentication → Providers → Google**, active Google.
3. Crée des identifiants OAuth de type application Web dans Google Cloud. Ajoute comme URI de redirection autorisée l’URL de rappel Supabase affichée dans les réglages du fournisseur Google (elle ressemble à `https://<identifiant-du-projet>.supabase.co/auth/v1/callback`).
4. Copie l’identifiant et le secret OAuth Google dans les champs du fournisseur Google de Supabase. Ne les mets pas dans le dépôt.

## 3. Relier le site à Supabase

Dans GitHub, ouvre **YiDream-Suite → Settings → Secrets and variables → Actions → New repository secret** et ajoute :

- `VITE_SUPABASE_URL` : le **Project URL** Supabase.
- `VITE_SUPABASE_ANON_KEY` : la clé publique **anon/publishable** Supabase.

Puis relance **Actions → Deploy YiDream Web ADB → Run workflow**. Les prochains changements du dossier `webadb/` relanceront aussi le déploiement.

## Ce qui sera disponible

Après configuration, les revendeurs pourront créer un compte par e-mail/mot de passe ou via Google. Les profils, clients, appareils et journaux seront conservés dans la base et isolés par compte. Le nouveau tableau de bord s’ouvre avec la tuile **Admin** de YiDream Suite.

Les fiches appareils sont des enregistrements de parc, pas un signal de connexion. La configuration Android en USB reste dans l’outil Android. Le contrôle à distance et la synchronisation en direct ne sont pas fournis par cette interface.

Les comptes et fiches créés précédemment dans le navigateur ne sont pas migrés automatiquement.