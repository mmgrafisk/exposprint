# ExposPrint webshop

Premium Vinext-webshop for personaliseret messeudstyr. Storefronten bruger mørk grafit, kobber og creme sammen med de godkendte ExposPrint-produktbilleder.

## Det er implementeret

- Datadrevne sprog, valutaer, markeder, moms, oversættelser og juridiske dokumenter i Supabase.
- 132 kilderækker konsolideret til 122 unikke produkter. 23 er publiceret; resten afventer pris, billede, konfiguration eller godkendt leveringstid.
- DKK som prisgrundlag, 40 % bruttoavance (`leverandørpris / 0,60`), markedets moms og administrerbar valutaafrunding.
- Gratis fragt som synlig prislinje samt levering beregnet af produktionstid og zonetransport i arbejdsdage.
- Serverbaseret quote og Stripe Checkout. Beløb fra browseren ignoreres.
- Gæstekøb, valgfri passwordless konto, idempotente Stripe-webhooks og komplette ordresnapshots.
- Private, resumérbare TUS-artworkuploads med signerede tokens, filvalidering og serverbaseret rate limiting.
- Juridisk CMS-model med versioner, accepteret version på ordren og lanceringslås.
- Adminroller fra Supabase `app_metadata`; ingen e-mailbaseret administratorliste.

## Lokal kørsel

1. Kopiér `.env.example` til `.env.local` og brug testnøgler.
2. Kør `pnpm install`.
3. Kør `pnpm dev`.
4. Kør `pnpm lint`, `pnpm build` og `node --test tests/exposprint.test.mjs` før aflevering.

Databasen bygges af migrationerne i `supabase/migrations`. Startdata kan lægges ind med `pnpm db:seed`, når `SUPABASE_SECRET_KEY` er sat lokalt. Stripe- og Supabase-hemmeligheder må kun ligge på serveren.

Lancering er bevidst blokeret, indtil virksomhedens navn, CVR/VAT, fysiske adresse, e-mail, telefon, returadresse og de danske juridiske dokumenter er udfyldt og godkendt.
