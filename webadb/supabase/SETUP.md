# Portail administrateur et connexion — YiDream Suite

YiDream Suite sépare le portail public, la candidature, la console propriétaire et l’espace des administrateurs approuvés. Les règles d’accès sont appliquées dans Supabase, pas seulement dans l’interface.

## Installer le schéma

Dans le projet Supabase, ouvre **SQL Editor** et exécute les migrations dans l’ordre :

1. `20261006000000_reseller_admin.sql`
2. `20261007000000_owner_admin_portal.sql`

La seconde migration ajoute les candidatures d’administrateur, les rôles propriétaire/administrateur et l’état de préparation des appareils.

## Initialiser le propriétaire YiDream

Après avoir exécuté les migrations :

1. Dans **Authentication → Users**, ouvre le compte Google qui doit être propriétaire et copie son identifiant UUID.
2. Dans **SQL Editor**, remplace `UUID_DU_PROPRIETAIRE` dans cette requête puis exécute-la :

```sql
insert into public.platform_admins (user_id, role, email)
select id, 'owner', coalesce(email, '')
from auth.users
where id = 'UUID_DU_PROPRIETAIRE';
```

Cette opération est nécessaire une seule fois et l’adresse du propriétaire n’est pas publiée dans le dépôt.

## Parcours d’accès

- Le portail `/admin/` présente YiDream Suite sans connexion et permet de se connecter ou de postuler.
- Les comptes peuvent s’authentifier par Google ou par e-mail, mais un nouveau compte n’obtient pas automatiquement de droits.
- Le propriétaire examine les candidatures et accorde ou retire les accès administrateur.
- La configuration Android et les outils de gestion demandent une session avec un rôle approuvé.
- Les appareils peuvent être enregistrés avec l’état **À configurer**. Seul le propriétaire peut les passer à **Configuré**, après la préparation physique.

## Connexion Google

1. Crée un client OAuth Google de type **Application Web**.
2. Dans les origines JavaScript autorisées, ajoute `https://qinfrance.github.io`.
3. Dans les URI de redirection autorisées, ajoute l’URL de rappel Supabase : `https://jqrznghqwdjbizjehzrm.supabase.co/auth/v1/callback`.
4. Dans Supabase **Authentication → Providers → Google**, active Google et ajoute le Client ID et le secret.
5. Dans **Authentication → URL Configuration**, autorise `https://qinfrance.github.io/YiDream-Suite/admin/`.

Ne mets jamais le secret OAuth Google ni une clé `service_role` dans GitHub. La clé publishable présente dans le client web est conçue pour être publique et reste soumise aux politiques RLS.
