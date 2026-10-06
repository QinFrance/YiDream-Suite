# Connexion Supabase et Google — YiDream Suite

L’espace admin utilise Supabase Auth et Postgres. Les profils, clients, appareils et journaux sont séparés par compte grâce aux règles RLS.

L’URL Supabase et la clé publique `publishable` du projet YiDream Suite sont configurées comme valeurs par défaut dans `webadb/src/cloud-admin.js`. Cette clé est faite pour être utilisée dans le navigateur. Ne place jamais la clé privée `service_role` ni un secret OAuth Google dans le dépôt.

## Créer les tables

Dans le projet Supabase, ouvre **SQL Editor** et exécute le fichier `webadb/supabase/migrations/20261006000000_reseller_admin.sql`. La migration crée le profil revendeur, les clients, les appareils et le journal, avec des règles pour isoler les comptes.

## Activer la connexion Google

Le bouton **Continuer avec Google** et le flux de connexion sont présents dans l’interface. Google doit aussi être autorisé dans Supabase :

1. Dans [Google Cloud Console](https://console.cloud.google.com/), crée un identifiant OAuth de type **Application Web**.
2. Dans les origines JavaScript autorisées, ajoute `https://qinfrance.github.io`.
3. Dans les URI de redirection autorisées, ajoute l’URL de rappel affichée sur la page du fournisseur Google dans Supabase. Pour ce projet, elle est normalement `https://jqrznghqwdjbizjehzrm.supabase.co/auth/v1/callback`.
4. Copie l’identifiant client et le secret client générés.
5. Dans Supabase, ouvre **Authentication → Providers → Google**, active Google et colle l’identifiant et le secret client.
6. Dans **Authentication → URL Configuration**, ajoute `https://qinfrance.github.io/YiDream-Suite/admin.html` aux URL de redirection autorisées. Le projet local peut aussi utiliser `http://localhost:5173/admin.html`.

Le secret Google doit rester dans le tableau de bord Supabase. N’envoie-le pas ici et ne le mets pas dans GitHub. Une première connexion Google demandera le nom de la boutique pour créer le profil revendeur.

## Ce que gère l’espace admin

Les revendeurs peuvent se connecter par e-mail/mot de passe ou Google, gérer leurs clients, inscrire et retirer des fiches appareils, puis consulter leur journal. Le tableau de bord affiche uniquement des données enregistrées dans leur compte.

Les fiches ne signalent pas une connexion en direct. Le contrôle à distance et la synchronisation des appareils ne sont pas encore fournis par cette interface. La configuration Android en USB reste dans YiDream Suite.

Les anciennes fiches stockées dans le navigateur ne sont pas migrées automatiquement.
