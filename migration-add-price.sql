-- Migration : ajout du champ "prix" par profil
-- À exécuter une seule fois dans Supabase > SQL Editor > New query > Run
-- (Sans danger pour vos données existantes déjà ajoutées)

alter table subscriptions add column if not exists price numeric not null default 0;
