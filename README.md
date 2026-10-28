# Merkelapp

Mobilskanning, private tellingslapper og balansert A3-utskrift i Jobbverktøy.

**Adresse:** https://jobbverktoy.no/merkelapp

## Førsteutgaven

- Felles Supabase-innlogging med portalen. Krever `merkelapp` i brukerens serverstyrte `app_metadata.apps`.
- Egne lapper per konto. Ny lapp, søk, autosparing og åpning på mobil/PC.
- ZXing-C++ via `zxing-wasm`, med lokalt servert WASM. EAN-8/13, kontrollsiffer, bakre kamera, smalt avlesningsområde, kameravalg og lys/zoom der tilgjengelig. Pause ved treff og stopp ved lukking/skjermlås. Manuell EAN eller HID-skanner i EAN-feltet med Enter. Bildeavlesning som reserve.
- Eksakt EAN-oppslag mot Obs BYGG henter varenavn, pakningsvariant og produktbilde. Treff bekreftes mot strukturerte produktdata på produktsiden. Navnet kan redigeres, og manuell registrering fungerer ved manglende treff eller teknisk feil. Bilde vises ved registrering, i varelisten og i A3-PDF-en.
- Antall starter tomt og må være et heltall >= 0. Duplikat-EAN krever eksplisitt Legg til/Erstatt/Avbryt. Fjernede linjer kan angres.
- Lås før utskrift. PDF genereres fra en uforanderlig revisjon. Gjenåpning krever ny låsing før neste utskrift.
- A3 stående, vektorstrekkoder, lesbar EAN og bare tallet i antallskolonnen. Målt tekst og balansert sidefordeling: normalt 10 varer på ett ark, 12 fordelt 6+6. Færre varer får større skrift og mer plass. Ekstremt store antall får bredere antallskolonne.
- **Markér som skrevet ut** starter en 7-dagers slettefrist. Utskriftsdialog/PDF-åpning alene gjør ikke dette. Lappen blir utilgjengelig ved fristen; Vercel cron sletter forfalte lapper og revisjoner daglig. Gjenåpning avbryter fristen frem til neste utskriftsbekreftelse.

## Utvikling

Node 22+ og pnpm. Kopier `.env.example` til `.env.local` og fyll inn portalens Supabase-adresse, publiserbar nøkkel og servernøkkel. Servernøkkelen brukes kun av oppryddingsjobben; ordinære operasjoner bruker brukerens økt og RLS.

```sh
pnpm install
pnpm dev --port 3014
pnpm typecheck
pnpm test
pnpm build
```

Åpne `http://localhost:3014/merkelapp`. Delt innlogging krever at du åpner gjennom en lokal portal med rewrite til denne adressen, eller logger inn med samme Supabase-prosjekt på samme origin.

Kjør SQL-filene under `supabase/migrations` i rekkefølge i Supabase SQL Editor. De oppretter bare Merkelapps egne tabeller/funksjoner. Begge migreringene er kjørt i portalens prosjekt. Alternativt kan `scripts/db.mjs migrate <fil>` brukes med egen Postgres-tilkobling. Sikkerhetskritiske skrivehandlinger er samlet i `merkelapp_write`, med kontosjekk, validering, radlås, optimistisk versjon og idempotent operasjons-ID.

### Vercel og portal

Appens `basePath` og `assetPrefix` er `/merkelapp`. Eget Vercel-prosjekt heter `merkelapp`. Bruk `.env.example` for nødvendige variabler. `CRON_SECRET` skal være en lang tilfeldig hemmelighet; cron sender den automatisk som Bearer-token. Ikke legg nøkler i Git.

Portalen har Merkelapp i `tools.ts`, `zones.ts`, rewrites, service worker-unntak og `check-zones.sh`. Innlogging deles gjennom informasjonskapsler på `/`, uten token i URL. Nye kontoer får ikke tilgang automatisk.

### Kontroll og begrensninger

Se `QA.md` for hva som faktisk er kontrollert. Mobilkamera på fysiske etiketter og papirskanning må prøves i butikken. Lokal forhåndsvisning viser sidefordelingen; PDF-en er den autoritative utskriften. PDF-en inkluderer produktbilder og de genererte vektorstrekkodene. Bilder undersøkes med ZXing før innbygging; påviste koder dekkes med hvite vektorfelt i PDF-en, slik at de ikke konkurrerer med varelinjens kode. Dersom et bilde ikke kan hentes eller undersøkes, vises en plassholder, og grensesnittet oppgir antallet manglende bilder.

`node scripts/check-database.mjs` oppretter og rydder bort isolerte testkontoer for integrasjonstesten. `node scripts/qa-account.mjs create` lager en midlertidig UI-konto i en ignorert lokal fil; fjern den etter test med `node scripts/qa-account.mjs remove`. `node scripts/check-http.mjs <portal-url>` bruker denne kontoen til å teste de ekte HTTP-rutene.

ZXing-WASM har MIT-lisens, underliggende ZXing-C++ har Apache-2.0-lisens. Tredjepartslisensene følger pakkene; se `THIRD_PARTY_NOTICES.md`.

### Portalens kildekode ved første levering

Portaltillegget er lagret på `codex/merkelapp-portal` i `olep93/jobbverktoy` og lagt inn i portalens eksisterende arbeidsmappe. Seks eksisterende konto-/innloggingsfiler var allerede i drift, men ikke committet; disse er bevart urørt i arbeidsmappen og i produksjonsdeployen. Ikke deploy portalens gamle `main` direkte før disse eksisterende endringene og Merkelapp-integrasjonen er samlet i en gjennomgått commit/merge.

## Obs BYGG-oppslag – testintegrasjon

`POST /merkelapp/api/products` krever innlogging og Merkelapp-tilgang. En gyldig EAN sendes til nettbutikkens offentlige autocomplete-funksjon. Kandidaten er ikke et bekreftet treff før produktsidens JSON-LD har eksplisitt samsvarende GTIN eller `ObsBygg-<EAN>` som SKU. Variantens navn, størrelse/farge og bilde brukes. Ingen søkemotortreff eller EAN i fritekst brukes som identitetsbevis. Flere verifiserte treff må velges av bruker.

Dette er en begrenset testintegrasjon mot den offentlige nettbutikken, ikke en avtalt eller dokumentert leverandør-API. Den bruker ingen innlogging, API-nøkkel eller omgåelse av beskyttelse. Tilgangsfeil/429 stopper oppslaget og gir manuell reserveflyt. Nettbutikkens pris-/lagerfelt fra autocomplete brukes ikke og lagres ikke. Ikke bruk dette til bulkinnhenting.

- Tidsgrense 8 sekunder, maks fire kandidatsider, inntil 30 forespørsler per bruker/minutt per serverinstans.
- Verifiserte treff mellomlagres i prosessminnet i fire timer; manglende treff i fem minutter. Nettverksfeil mellomlagres ikke. Samtidige identiske forespørsler slås sammen.
- Bare produktbilder fra tillatte `https://www.obsbygg.no/globalassets/...`-stier vises. Manglende/feil bilde gir et nøytralt ikon.
- EAN, kildenavn, originalt varenavn, bilde-URL, produktlenke og hentetid lagres i varelinjens valgfrie `product`-felt og følger den låste revisjonen. Den redigerbare `name` er adskilt fra kildenavnet. Ingen ny databasemigrering kreves.
- Et forsinket svar kan ikke fylle inn en annen vare eller overskrive et manuelt redigert navn. Eksisterende linjer beholder navnet sitt; «Bruk varenavnet fra Obs BYGG» er et eksplisitt valg.

Kjør `pnpm exec tsx scripts/check-products.ts` for de ti reelle eksempel-EAN-ene og bildene. `node scripts/check-product-http.mjs <test-url>` kontrollerer oppslag, metadata, kontolagring, manuelt navn, revisjon og PDF mot en midlertidig QA-konto.

### Produktbilder i A3-PDF

Bilder hentes fra den låste revisjonens eksisterende bilde-URL, behandles på serveren med Sharp, og undersøkes av ZXing-WASM før de tegnes i PDF-en. PNG/JPEG/WebP blir til JPEG med begrenset oppløsning. Et originalbilde blir ikke erstattet i produktdataene. Påviste strekkoder/QR-koder dekkes i den tegnede PDF-en; dersom sikker behandling feiler, utelates bildet. Prosessen har en samlet tidsgrense, avgrensede bildefiler og tre samtidige nedlastinger. Forberedte bilder mellomlagres i fire timer.

Layoutberegningen reserverer plass til bildet og måler teksten ved siden av. Forhåndsvisningen bruker samme mål og sidefordeling. Bilder gjør ikke de genererte strekkodene mindre. Ti vanlige varer med bilder er testet på én A3-side, og tolv balanseres fremdeles som seks og seks. Nedlast en ny PDF for å få den oppdaterte utskriftsmalen.

`public/zxing_reader.wasm` inkluderes eksplisitt i PDF-rutens filsporing, slik at avkoderen fungerer på Vercel. Test med `pnpm exec tsx scripts/render-image-fixtures.ts` etter produktoppslagstesten, og `node scripts/check-pdf-images-http.mjs <preview-url>` mot en midlertidig QA-konto.
