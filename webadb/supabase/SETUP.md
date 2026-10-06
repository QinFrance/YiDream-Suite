# Mise en route des comptes YiDream Suite

L’interface utilise Supabase Auth et Postgres. Les données sont isolées entre les comptes revendeurs par les règles RLS de PostgreSQL. L’URL du projet et la clé publique publishable sont déjà configurées dans le client du site ; cette clé est destinée à être utilisée côté navigateur. La clé privée `service_role` ne doit jamais être placée dans GitHub ou dans le navigateur.

Projet Supabase : `https://jqrznghqwdjbizjehzrm.supabase.co`

## 1. Créer les tables

1. Dans le tableau de bord Supabase, ouvre **SQL Editor**.
2. Dans GitHub, ouvre le fichier `webadb/supabase/migrations/20261006000000_reseller_admin.sql` de cette branche et copie tout son contenu.
3. Colle-le dans une nouvelle requête SQL et clique sur **Run**.

## 2. Autoriser les adresses du site

Dans Supabase, ouvre **Authentication → URL Configuration** et ajoute dans **Redirect URLs** :

- `https://qinfrance.github.io/YiDream-Suite/admin.html`
- `http://localhost:5173/admin.html` pour les essais locaux.

## 3. Activer Google (facultatif)

Les comptes e-mail et mot de passe fonctionnent sans cette étape. Pour activer Google :

1. Dans Supabase, ouvre **Authentication → Providers → Google** et suis les instructions affichées pour créer un client OAuth de type application Web dans Google Cloud.
2. Dans Google Cloud, ajoute comme URI de redirection autorisée l’URL de rappel Supabase affichée dans les réglages Google. Elle ressemble à `https://jqrznghqwdjbizjehzrm.supabase.co/auth/v1/callback`.
3. Colle l’identifiant client et le secret client Google dans les champs Supabase, puis active le fournisseur Google.

Ne mets jamais le secret Google dans le dépôt ni dans le code du site.

## 4. Publier l’interface

Quand les tables sont créées et que l’URL de redirection est enregistrée, fusionne la pull request YiDream-Suite #2. GitHub Actions publiera alors l’interface admin.

## Ce qui sera disponible

Les revendeurs pourront créer un compte par e-mail et mot de passe, ou avec Google si le fournisseur Google a été activé. Les profils, clients, fiches appareils et journaux seront stockés dans Supabase et isolés par compte.

Les fiches appareils sont des enregistrements de parc, pas un signal de connexion. La configuration Android en USB reste dans l’outil Android. Le contrôle à distance et la synchronisation en direct ne sont pas fournis par cette interface.

Les comptes et fiches créés précédemment dans le navigateur ne sont pas migrés automatiquement.
