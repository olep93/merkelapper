# Kontroll av førsteutgaven – 28. oktober 2026

## Automatiske kontroller som har passert

- TypeScript og produksjonsbygg (Next.js).
- EAN-8/EAN-13, kontrollsiffer og innledende nuller.
- Ikke-negative heltallsantall; store trygge heltall til og med JavaScripts sikre heltallsgrense.
- Målt A3-layout for 1, 3, 6, 10, 11, 12, 16, 20 og 40 varer; lange navn og store antall. Varerekkefølgen bevares, ingen delte rader, minstestørrelser beholdes.
- Ti vanlige produkter på én side; tolv på to sider med seks på hver.
- Færre varer gir større tekst. Store antall får mer kolonnebredde.
- PDF-sideformat 297 × 420 mm. Alle ti vektorstrekkoder i en 200 dpi-rendering er avkodet av ZXing og sammenlignet med riktig EAN i riktig radrekkefølge.
- Integrasjon mot den faktiske Supabase-databasen med midlertidige kontoer: lagring, kontoisolasjon, idempotent opprettelse, versjonskonflikt, blokkert direkte oppdatering, låsing, revisjon, slettefrist og gjenåpning. Testkontoer og data ryddes bort.
- HTTP-tester gjennom portalens preview: felles økt, avvisning uten innlogging, opprettelse/lagring, layout, låst PDF, gjenåpning som ugyldiggjør gjeldende PDF og avvisning av skrivekall fra annet opphav.
- Portalens `check-zones.sh` med alle fire verktøy, RSC-ruter, logo og manifest på preview. Ingen feil.
- Utløpte lapper skjules av RLS før fysisk sletting. Cron krever riktig hemmelighet og sletter faktisk forfalte testlapper.

## Visuelt og i nettleser

- Opprettet lapp fra portalflisen med samme innlogging.
- Automatisk lagring av navn, EAN, varenavn og antall gjennom grensesnittet.
- ZXing-WASM har lest kjent EAN fra en generert etikettfil gjennom appens «Les fra bilde», med korrekt EAN og tomt antall i bekreftelsesformen.
- Låsing og forhåndsvisning fra lagrede data.
- PDF med 1, 3, 10 og 12 varelinjer er rendret og kontrollert visuelt for plassering, leselighet og avkutting.
- Mobilvisning kontrollert ved 390 × 844 piksler; feltene holder seg innenfor skjermen. Duplikat med eksplisitt antallsøkning, fjerning/angre og gjenåpning er prøvd gjennom grensesnittet.
- Endelig adresse `https://jobbverktoy.no/merkelapp` er kontrollert med de samme HTTP-testene og portalens rutekontroll.

## Gjenstår fysisk / senere

- Kamera på faktisk iPhone/Safari og Android/Chrome, inkludert valg av bakre objektiv, lys/zoom, skjermlås og lengre bruk. Etikettfiltesten bekrefter avkodingen, men erstatter ikke kameratest.
- Butikkens etikettsett og akseptansemål fra prosjektintroduksjonen er ikke målt ennå.
- Fysisk A3-utskrift ved 100 %, lest med både telefon og håndskanner.
- Delt arbeidsgruppearkiv inngår ikke i førsteutgaven; lapper er private per konto. Produktbilder vises i grensesnittet og i den oppdaterte PDF-en.
- Lengre nettutfall må prøves på faktiske telefoner. UI viser serverbekreftet lagring, nettfeil og konflikter. Ulagrede endringer holdes i den åpne siden; lukk ikke fanen under nettutfall.

Appen er en første testutgave, ikke en fysisk godkjent butikkpilot.

## Tillegg: varenavn og produktbilde fra Obs BYGG

- Ti faktiske eksempel-EAN-er er slått opp via nettbutikkens offentlige autocomplete og verifisert mot riktig SKU/variant i produktsidens JSON-LD. Alle ti bilde-URL-er svarte med HTTP 200 og bildeinnhold. Lokale samlede oppslag inkludert bilde-HEAD tok ca. 0,4–0,9 sekunder per vare i denne prøven; dette er ikke en lovnad om mobil/nettverkshastighet.
- Egne tester dekker feil variant, pakningsstørrelse, motstridende identiteter, manglende bilde, ugyldig JSON-LD, utrygge bildeadresser, ingen treff, kildefeil, flere treff og normalisering av norske tegn før utskrift.
- Verifisert produktmetadata følger kontolagring og låst revisjon, mens manuelt varenavn beholdes. Dette er testet mot ekte HTTP-ruter på preview og gjennom jobbverktoy.no.
- Mobilgrensesnittet er prøvd med virkelig varenavn/bilde, tomt antall, eget navn skrevet før oppslaget kom tilbake, lagring og gjenåpning. Produktbildet var lastet og fulgte den lagrede linjen.
- Ved ukjent EAN eller timeout beholdes manuell registrering. Ingen test skal tolkes som at hele Obs BYGG-sortimentet er tilgjengelig på nett.

## Tillegg: produktbilder i PDF

- Produktbildet er gjengitt i en kontrollutskrift fra et lokalt bevart snapshot av brukerens lapp. Ingen lappedata ble endret under kontrollen.
- Ti reelle produktbilder er gjengitt på ett A3-ark uten bildeutfall. PDF-en er kontrollert visuelt, og hver genererte EAN er avkodet fra en 200 dpi-rendering i riktig radrekkefølge.
- En test med en konkurrerende EAN i selve produktbildet bekrefter at bildekoden dekkes og ikke blir avlest fra den ferdige PDF-en. Den genererte varekoden blir fremdeles lest korrekt.
- Egne tester kontrollerer bildeplass, balansert 6 + 6-fordeling, faktisk bildeobjekt på PDF-siden og at bildeutfall gir en brukbar PDF med oppgitt manglende bilde.
- Skannbare mål for den genererte koden er uendret. Fysisk papirkontroll gjenstår.

- Verifisert på Vercel-preview: ti bildeobjekter er faktisk tegnet på én A3-side, ingen manglende bilder, omtrent 386 kB PDF. Første servergenerering i denne testen tok cirka 4,6 sekunder, inkludert bildebehandlingen.
- Kontrollert gjennom jobbverktoy.no etter publisering: alle ti produktbilder er innebygd, ingen bildeutfall, og portalens rutekontroll passerer for alle verktøy.

## Bredde, EAN og gjenopprettbar sletting

- Eksemplet med én vare får hele navnet på to linjer og stor, svart EAN under. Navnefeltet er større, mens antallskolonnen måles etter innhold og kodekolonnen er 43 mm bred med uendrede strekkodemål.
- Ti varer med bilder er rendret visuelt og avkodet ved 200 dpi; alle ti EAN-er blir lest i riktig rekkefølge. Bildets konkurrerende kode er fremdeles skjult.
- Database- og preview-HTTP-tester bekrefter at papirkurv skjules fra aktiv liste, beholder ni varelinjer og den låste revisjonen, blokkerer redigering/utskrift og andre kontoer, og gjenoppretter identisk innhold. Utløpt papirkurv blir utilgjengelig og ryddes fysisk.
- Den tidligere slettede ni-varers lappen ble ikke gjenopprettet: den siste tilgjengelige daglige sikkerhetskopien var fra før opprettelsen, tidspunktbasert gjenoppretting var ikke aktivert, og brukeren hadde ikke PDF-en. Det ble ikke utført tilbakeføring av databasen.

## Størrelseskontroll for 1–3 varer

- Testet korte og lange navn med/uten bilder, kontrollert hele ord, tekstbredde, radgrenser og at hele EAN får plass i 34 punkter.
- Navn skaleres individuelt. Forhåndsvisningen beholder de beregnede linjene uten ny bokstavbryting i nettleseren.
- Rendret og visuelt kontrollert A3-PDF med henholdsvis én, to og tre testvarer: navn på to–tre linjer og stor EAN rett under. Testnavn/bilder er illustrasjonsdata.
- Alle 20 automatiske tester og TypeScript-kontrollen bestått.

## Samlet vurdering av bilde, tekst og kolonner

- Ved 1–3 varer står bildet over teksten og vokser etter tilgjengelig radhøyde, opptil 90 mm. Navnet får hele varekolonnens bredde, med maksimalt 48 punkter; EAN står sentrert under i 34 punkter. Antall er dempet til maksimalt 80 punkter.
- Kolonneoverskriftene er sentrert over innholdet og økt fra 11 til 14 punkter. EAN er også sentrert i tekstfeltet på tettere ark.
- Visuelt kontrollert rendret PDF med 1, 2, 3 og 10 faktiske Obs BYGG-produkter (testantall). Ingen avkuttede navn, bilder eller EAN; bildene bruker ledig høyde uten å presse teksten sammen.
- 21 automatiske tester og TypeScript-kontroll bestått; ny test kontrollerer bildestørrelse og samlet plass for bilde, navn og EAN.

## Oppdater PDF fra PC

- Ny knapp «Oppdater PDF» henter siste lagrede lapp fra kontoen, lagrer eventuelle lokale endringer først og låser et oppdatert utkast som ny utskriftsrevisjon. Versjonskontroll hindrer overskriving ved samtidige endringer.
- PDF-en hentes uten mellomlagring. Knappen gjenbruker en tidligere åpnet PDF-fane når den fremdeles er tilgjengelig, og åpner ellers en ny fane eller laster ned filen dersom nettleseren blokkerer popup.
- TypeScript, alle 21 eksisterende tester og produksjonsbygg bestått. Produksjonsdeploy bekreftet Ready. PDF-fanegjenbruk er ikke manuelt kontrollert i alle nettlesere.

## Automatisk synkronisering mellom PC og mobil

- Synlig app henter lappelisten hvert 5. sekund og umiddelbart ved fokus, synlig fane eller gjenopprettet nett. Skjulte faner pauser intervallets nettverkskall. En manuell «Oppdater lapper»-knapp er også tilgjengelig.
- Oppdaterer valgt lapp fra kontoen bare når lokale endringer er lagret og ingen vareregistrering/skanner er åpen. Svar som kommer etter et lokalt lagringskall eller bytte av lapp forkastes. Nye lapper velges ikke automatisk.
- Nettfeil vises ved oppdateringsknappen, og neste intervall forsøker igjen. TypeScript, 21 eksisterende tester og produksjonsbygg bestått. Samtidig bruk av to fysiske enheter er ikke manuelt testet i denne runden.
