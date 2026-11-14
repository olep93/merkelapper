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

## Navn på den som laget lappen

- Forhåndsvisning og hver PDF-side viser «Laget av Fornavn E.» øverst ved datoen. Forkortelsen hentes på serveren fra kontoens profilnavn; klienten sender ikke utskriftsnavnet.
- Merkelapper er personlige. PDF-ruten kontrollerer eksplisitt at lappen tilhører innlogget konto før den bruker kontoprofilen, så eksisterende lapper får også navn uten å endre lagrede varelinjer/revisjoner.
- Kontrollert de fire etterspurte profilforkortelsene, automatisk navnetest, rendret PDF med «Laget av Ole K.» og 22 beståtte tester samt TypeScript-kontroll.

## Tillegg: områder med varer flere steder – 3. november 2026

- Egne tester dekker summering, utregning, nullantall, for store summer, over 500 varer, feil utregning, varsel om endret kildeliste, 25 varer per ark, vekslende sider, lange navn og at bilder ikke lastes.
- Grensesnittet er prøvd på desktop og ved 375 × 812 piksler med ekte klient, layout og PDF-kode, men med testdata i minnet. Sammenslåing er ikke kjørt mot den faktiske databasen eller gjennom innlogget portal.
- Alle strekkoder på et ark med 25 rader er avkodet av ZXing i riktig rekkefølge ved 200 dpi.
- Med skannerens innstillinger og utsnitt rundt én kode (med radene over og under) ble 25 koder lest ved 15 oppløsninger fra 120 til 400 dpi: 375 av 375 riktige, ingen feil.
- Når hele A3-arket ble analysert samlet, ble alle koder funnet, men ZXing ga i tillegg enkelte feil koder ved noen oppløsninger (1 ved 300 dpi i en kontroll med 100 EAN-er over 11 oppløsninger, 1 ved 300 dpi på eksempelarket med 28 varer). Vanlige lapper ga ingen feil koder i samme kontroll. Dette er bilder av PDF-en, ikke kamera eller papir.
- Gjenstår: fysisk A3-utskrift ved 100 %, lest med både telefon og håndskanner. Strekkodene er 9,7 mm høye mot 22,85 mm på vanlige lapper.

## Områdelister delt per varehus (2026-11-04)

Kontrollert: migreringen og tilgangsreglene mot lokal Postgres (PGlite) med forenklede Driftssjekk-tabeller, inkludert kollegaer, annet varehus, driftssjef, bruker uten Merkelapp-tilgang, skriveforsøk fra kollega, revisjoner, papirkurv og overføring av eksisterende lister.

Kontrollert i portalens Supabase-prosjekt 2026-11-04: migreringen er kjørt, og kolonner, funksjoner, tilgangsregel og rettigheter er bekreftet. 2 av 3 eksisterende områdelister ble delt, og ingen vanlige lapper er delt. `pnpm build` er grønn.

Ikke kontrollert: grensesnittet i nettleser med to ekte kontoer.

## Dørmerking og valgt variant (2026-11-09)

- Felles oppslag for merkelapp, områdeliste og dørmerking setter `v=ObsBygg-<skannet EAN>` før produktsiden hentes. Aktiv `CURRENT_PAGE.ean`/`variationCode`, synlig Artikkelnummer, Valgt størrelse og JSON-LD må stemme. Et treff i variantlisten alene er ikke nok. Manglende/motstridende data gir ingen automatisk valgt vare.
- Lagret produktinformasjon uten den nye variantkontrollen hentes på nytt når varefeltet åpnes. Eksisterende lagrede navn endres ikke automatisk; bruk «Bruk varenavnet fra Obs BYGG» etter kontroll ved behov.
- Live-kontroll av Vera H 90 × 210 (`7072354067865`), Vera V 100 × 210 (`7072354067834`), Ask lett 80 × 200 (`7072354065892`), Slett lett 80 × 210 (`7072354068916`) og Silje H 90 × 190 (`7072354000770`). De ti ordinære varene i `scripts/check-products.ts` passerer fortsatt. Ask sitt JFIF-bilde støttes av visning, validering og oppslag.
- Åpne **Dørmerking** og trykk direkte på venstre eller høyre halvdel av A4-eksempelet. En tom halvdel åpner EAN/kamera for akkurat den plassen; en fylt halvdel åpner redigering, bytt dør, kopier eller fjern. Den gamle døren beholdes ved avbrutt eller mislykket bytte. **Nytt ark** gir et nytt grafisk ark; **Skann neste dør** kan fortsatt fylle neste ledige plass automatisk. Maks. 30 ark.
- Lagrede merker lagres på kontoen (14. november 2026), slik at de finnes på både mobil og PC. Endringer lagres automatisk etter et øyeblikk, og knappen Lagre lagrer med en gang og viser Lagret når alt er på kontoen. Merker som ligger i nettleseren fra den gamle lokale lagringen, flyttes til kontoen første gang dørmerkingen åpnes på den enheten. Redigering skjer i en egen dialog; Avbryt beholder det lagrede merket. Utskrift er sperret mens dialogen er åpen. Lagringsfeil vises tydelig.
- Utskrift/PDF: A4 stående, 100 %, ingen marger, uten topp-/bunntekst. Hvert merke er 105 × 297 mm. To ulike merker gir én A4-side; fire gir to sider. Tomme sider og redigeringsknapper skal ikke skrives ut. Ikke ferdigutfylt høyre halvdel blir blank.
- Utskrift krever lagrede merker, ferdiglastede bilder og tekst som får plass. Lagre krever EAN, navn, positive mål, slagretning, 1–5 argumenter og bekreftet kontroll. Målene er oppgitt variantstørrelse/modulmål, ikke automatisk dørbladmål. H/V uten entydig retning gjettes ikke. Manglende retning på innerdører må kontrolleres og fylles inn, for eksempel Vendbar.
- Automatiske tester: 55 tester, TypeScript og produksjonsbygg bestått. Regresjonstester dekker feil aktiv EAN, feil artikkelnummer, feil/manglende valgt størrelse, søkelenke til standardvariant, varer uten størrelsesvelger og JFIF-bilder.
- Nettleserprøve i Chrome med simulert innlogging og faktiske Obs BYGG-oppslag: fire ulike merker på to sider, lagring/gjenoppretting etter reload, redigering, avbryt redigering, fjern/angre, automatisk sideoppretting og desktop 1440 px / mobil 390 px uten horisontal sideoverflyt. Forhåndsvisningen viser ett helt A4-ark skalert etter skjermbredde og høyde; piler og arkknapper bytter side. Arket er hovedmenyen, uten en separat liste med redigeringsknapper. PDF-en har to A4-sider; alle fire strekkoder dekodet fra renderingen i riktig side-/plassrekkefølge. Begge PDF-sidene visuelt kontrollert.
- Gjenstår fysisk utstyrstest i butikk: kameratillatelse/skanning på telefon, skriverens 100 %-skalering og strekkodelesing fra papir. Produktbildet kan være felles for flere slagretninger; bildet er merket som illustrasjon og retningen står separat.

- Grafisk meny kontrollert i Chrome: høyre halvdel kan fylles før venstre; Enter på en fokusert halvdel åpner den; bytte/feiloppslag/avbryt påvirker ikke den andre døren. Nye ark og mobiltrykk testet. Klikkmarkeringer og eksempelillustrasjoner er skjerminnhold og utelates fra PDF. Utskrift av tre merker på to sider dekoder alle tre EAN-ene på riktig side/halvdel.
