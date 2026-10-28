# MERKELAPP – prosjektoversikt og oppstart til Codex
Versjon 2.0 · 28. oktober 2026 · Norsk bokmål

> **Oppdrag:** Bygg en fungerende webapp i det nye GitHub-repoet «Merkelapp», gjør den klar for Vercel og få en privat testutgave live når nødvendige tilganger er gitt. Appen skal brukes fra Jobbverktøy-portalen. Ansatte skanner produkter med mobil, skriver inn antall, lagrer i en felles database og åpner samme lapp på PC for redigering, låsing og A3-utskrift. Dette dokumentet samler siste avtalte krav og erstatter tidligere utgaver.

## 1. Det som er avtalt

### Tillegg fra bruker – første testutgave, 28. oktober 2026

- Førsteutgaven lagrer lapper på innlogget brukers konto, med samme innlogging som Jobbverktøy. Tilgang gis først til eierens kontoer. Delt arbeidsgruppearkiv kan utvides senere.
- **Ny lapp** starter en separat lapp; tidligere lagrede lapper beholdes og kan åpnes igjen.
- Lappen beholdes frem til utskrift. Brukeren markerer **Markér som skrevet ut**, siden nettleseren ikke kan bekrefte fysisk utskrift. Slettefristen er da sju dager. Etter fristen er lappen utilgjengelig; daglig opprydding sletter lapp og revisjoner fysisk. Gjenåpning for redigering avbryter fristen frem til ny utskriftsbekreftelse.
- Flere varelinjer gir automatisk flere A3-sider. **Fordel sidene balansert**, for eksempel seks varer på hver side ved tolv vanlige varelinjer, fremfor ti små på første side og to på andre. Mål innholdet, behold varerekkefølgen og bruk færrest mulig sider innenfor lesbarhets- og strekkodekravene.
- Ledig plass brukes til større tekst, antall og varefelt, også på hver side av en flersidig lapp.
- ZXing-C++ via `zxing-wasm` er valgt gratis skannermotor. Under testingen hentes varenavn, variant og bilde fra Obs BYGG ved verifisert EAN-treff. Manuell registrering beholdes. Bildet vises ved registrering, i varelisten og i A3-PDF-en. Skannbare koder i produktbilder dekkes i utskriften; utrygge/utgåtte bilder gir en plassholder og beskjed.


- Appnavn/arbeidstittel: **Merkelapp**.
- Brukeren oppretter GitHub-repo og gir Codex tilgang. Repo-URL er ikke oppgitt her.
- Hosting: **Vercel**, med en testutgave som faktisk kan brukes på mobil og PC.
- Appen skal være tilgjengelig fra **Jobbverktøy-portalen**. Nytt repo er valgt; ikke flytt eller bygg om hele portalen.
- Mobilkamera leser EAN. Appen henter riktig varenavn og et lite bilde fra obsbygg.no dersom tilgjengelig.
- Brukeren fyller inn antall. **Antall er alltid stk, og bare tallet skal vises på lappen.**
- Dagens dato settes automatisk ved opprettelse, i Europe/Oslo.
- Varenavn, EAN som lesbare sifre, antall og en skannbar strekkode skal være med.
- **Butikk/varehus skal ikke stå på lappen.**
- A3 stående er hovedformat.
- Oppsettet skal bruke **færrest mulig ark** innenfor krav til lesbarhet og skannbarhet.
- Reduser tomrom først, tilpass deretter rad- og skriftstørrelse. Ikke bruk en fast grense på tre varer.
- Ti vanlige varer skal kunne få plass på ett A3-ark i normaltilfellet. Lange navn og mer krevende innhold kan kreve flere sider.
- Strekkoden plasseres i et eget felt **rett ved antallet**, med tydelig tilhørighet til riktig vare.
- Lagrede lapper kan åpnes og redigeres. Etter redigering må de låses igjen før ny utskrift.
- **Skannerkvalitet er første tekniske prioritet**, ikke en funksjon som legges til etter at resten er ferdig.

Dette er en app for å lage tellings-/merkelapper. Første versjon skal ikke endre beholdning i ERP eller butikkens lagersystem.

## 2. Vedlegg og hva som faktisk er prøvd

**A3_designforslag_varetelling.pdf** viser ti reelle produkter fra obsbygg.no på ett A3-ark, med strekkoder i egen kolonne ved antallet. Butikknavn og enhetsord under antall er fjernet. Antallene er fiktive.

- PDF-formatet er kontrollert til 297 × 420 mm.
- Alle ti genererte strekkoder er avkodet fra en 200 dpi-rendering og kontrollert mot EAN i tilhørende rad.
- Kontrollsifrene er kontrollert.
- Dette er digital kontroll av designet. Fysisk utskrift og lesning med telefon/håndskanner gjenstår.
- Vedlegget er et designforslag, ikke en ferdig webapp eller bevis på at automatisk layout er implementert.

Designreferansen er brukerens opprinnelige foto av dagens manuelle lapp. Den nye utgaven beholder tydelig dato, varenavn og antall, og bruker mindre tomrom.

## 3. Anbefalt teknisk løsning

| Del | Anbefalt valg |
|---|---|
| App | Next.js, TypeScript og responsivt React-grensesnitt |
| Hosting | Vercel; separat testmiljø og miljøvariabler |
| Felles data | Supabase Postgres, dersom en eksisterende portalbackend ikke allerede kan gjenbrukes |
| Innlogging | Gjenbruk portalens innlogging der det er praktisk; ellers invitasjonsbasert Supabase Auth for testgruppen |
| PDF/bilder | Privat objektlagring, for eksempel Supabase Storage |
| Skannermotor | **ZXing-C++ via `zxing-wasm`**, gratis og åpen kildekode, som førstevalg gjennom et utskiftbart adapterlag |
| Produktoppslag | Serverbasert integrasjon mot verifisert Obs BYGG-kilde, med cache og manuell reserveflyt |
| PDF-generering | Serverbasert vektor-/tekst-PDF med målbar layout og skaleringskontroll |

Dette er anbefalte startvalg. Codex skal lese repoets README, AGENTS.md og eksisterende kode og gjenbruke fungerende oppsett. Ikke legg til dobbelt autentiseringssystem eller ny database hvis de allerede finnes.

### Kobling til Jobbverktøy

Første test kan åpnes fra et kort/menypunkt «Merkelapp» i Jobbverktøy. Bruk den nye appens faktiske test-URL. Felles pålogging kan gjenbrukes gjennom dokumentert integrasjon; ikke send påloggingstoken ukritisk i URL-er.

Dersom portalen ikke er tilgjengelig for Codex, leveres appen og den konkrete lenken/instruksen for portalmenyen. Ikke la manglende portalrepo stoppe resten.

Butikknavn skal ikke være i PDF eller utskriftsvisning. Tilgang kan fremdeles avgrenses til arbeidsgruppe/organisasjon i databasen uten at dette vises på lappen.

## 4. Arbeidsflyt

### Mobil

1. Åpne Merkelapp → **Ny lapp**.
2. Sett dagens Oslo-dato automatisk. Valgfri sone/plassering kan registreres; den skal ikke være obligatorisk.
3. Trykk **Skann vare**.
4. Les EAN, vis tydelig bekreftelse og pause nye skannehendelser.
5. Hent riktig produkt. Vis lite bilde, fullt navn og EAN.
6. Brukeren oppgir antall med numerisk tastatur.
7. Trykk **Legg til og skann neste**.
8. Gjenta. Autospar til server og vis om endringen er bekreftet lagret.
9. **Lagre og lukk**.

Antall skal starte tomt, ikke med 1. Ingen automatisk økning fordi samme kode er synlig i flere videobilder.

### PC

1. Åpne listen over lapper som arbeidsgruppen har tilgang til.
2. Finn etter dato, status, navn, EAN eller lapp-ID.
3. Åpne og rediger.
4. Se A3-forhåndsvisning og sideantall.
5. Trykk **Lås for utskrift**.
6. Åpne gjeldende PDF og skriv ut i A3, faktisk størrelse/100 %.

Data som er bekreftet lagret på mobil, skal være synlige på PC etter oppfriskning. Nettleserlagring alene er ikke delt lagring.

### Redigere igjen

En låst lapp åpnes i lesemodus. **Åpne for redigering** lager en ny arbeidsrevisjon og gjør forrige PDF historisk. Ny utskrift krever ny låsing. Telledatoen endres ikke automatisk ved gjenåpning neste dag.

Nedlastede eller fysiske utskrifter kan ikke tilbakekalles. Diskret lapp-ID og revisjon i footer gjør at gjeldende og tidligere utgaver kan skilles.

## 5. Skanneren skal fungere fra første test

### 5.1 Hovedvalg og oppstartsrekkefølge

**Avklart med bruker 28. oktober 2026:** Start med **ZXing-C++ via `zxing-wasm`** som gratis skannermotor. Dette er den valgte ZXing-varianten for prosjektet. Lag et lite adapterlag så motoren kan byttes om det er nødvendig. Valget er en kandidat som skal prøves mot kvalitetsmålene nedenfor, ikke en påstand om at den allerede er best på våre telefoner og etiketter.

Førstevalget krever ingen betalt SDK-lisens eller prøvenøkkel. Dokumenter og overhold åpen kildekode-lisensene, og sett opp WASM og kamera korrekt. Scandit eller en annen betalt motor vurderes bare dersom fysisk testing viser at gratisløsningen ikke oppfyller behovet. Ikke kjøp abonnement uten avtale. En test uten fungerende skannermotor skal merkes som ufullstendig, ikke som ferdig testutgave.

Native BarcodeDetector kan brukes som optimalisering, men ikke som eneste grunnlag på tvers av iPhone og Android. Den valgte motoren må prøves fysisk på både iPhone og Android.

### 5.2 Oppførsel

- EAN-13 og EAN-8 fra starten. UPC-A ved behov, med dokumentert normalisering.
- Kameraet åpnes ved brukerhandling og bruker bakovervendt objektiv.
- Velg egnet fokus/oppløsning; tilby kamerabytte der automatisk valg treffer feil.
- Synlig siktefelt med prioritering av koden brukeren sikter på.
- Begrens avlesningsområdet for å redusere feil når flere koder er i bildet.
- Vis lommelykt/zoom bare der dette støttes.
- Vis rask grønn/synlig bekreftelse og valgfri lyd/vibrasjon ved korrekt lesning.
- Pause hendelser mens varen og antallet bekreftes. Behold gjerne kameraet klart mellom varer.
- Stopp stream ved lukking/navigering, og håndter gjenopptak etter skjermlås.
- Ikke send kameravideo til server for ordinær avkoding.
- Registrer EAN som tekst, behold nuller og valider kontrollsiffer.
- Ingen AI/OCR-gjetting av uleselige koder.
- Skill «kode lest» fra «produkt funnet». Tregt produktnett skal ikke oppfattes som svak skanner.
- Støtt manuell EAN og USB-/Bluetooth-HID-skanner med Enter.
- Ikke fang globale tastetrykk fra vanlige skrivefelt.
- Kamera krever HTTPS og brukerens tillatelse.

### 5.3 Konkrete prosjektmål

Målene under er akseptansekrav som skal måles, ikke lovnader om en SDK.

| Prøve | Krav/mål |
|---|---|
| Utvalg | Minst 50 ulike faktiske butikketiketter, tre forsøk per etikett per enhet |
| Enheter | Minst én representativ iPhone/Safari og én Android/Chrome |
| Vanlige lesbare etiketter | Mål: minst 99 % korrekt lest innen 1,5 sekund når kameraet er klart |
| Små/blanke/buede/slitte etiketter | Mål: minst 95 % korrekt lest innen 3 sekunder i avtalt utfordrende testsett |
| Feil EAN | Ingen feil identitet godtas i testsettet |
| Duplikater | Ingen ekstra registreringer når samme kode holdes i bildet i 10 sekunder |
| Stabilitet | 30 minutter aktiv bruk, kamerabytte, skjermlås og kort nettutfall |
| Papirlapp | Alle koder på fysisk A3-utskrift leses som EAN i riktig rad; test også sikting mellom to rader |

Mål oppstartstid, avkodingstid og produktoppslag separat. Prøv samme etiketter med eksisterende håndskanner. Dersom mål ikke nås, prioriter motor-/kamera-/siktejustering før funksjonsutvidelser. Dokumenter resultater per telefonmodell.

## 6. Produktdata fra obsbygg.no

Det er kontrollert at konkrete produktsider viser navn, artikkelnummer/EAN og bilder. **Dette bekrefter ikke et tilgjengelig produkt-API.** Codex må verifisere faktisk integrasjonsmulighet, tilgang og tillatt bruk.

Anbefalt rekkefølge:

1. Eksakt EAN-treff i kortvarig cache med oppgitt opprinnelse.
2. Eksisterende godkjent produktintegrasjon eller Obs BYGG-feed/API hvis tilgjengelig.
3. Tillatt serverbasert oppslag på obsbygg.no dersom stabilt og teknisk mulig.
4. Manuell registrering av varenavn ved ukjent vare eller feil.

Krav:

- Verifiser eksakt variant og pakningsstørrelse. Ikke bruk første søkeresultat ukritisk.
- Flere mulige treff må bekreftes av bruker.
- Behold skannet EAN også når varen ikke finnes på nett.
- Skill mellom «ingen treff» og timeout/teknisk feil.
- Manglende bilde skal ikke stoppe registrering eller utskrift.
- Produktnavn kan overstyres manuelt i utkast; ikke overskriv brukerens endring i bakgrunnen.
- En låst revisjon beholder sitt navn/bilde selv om nettkatalogen endres.
- Bruk serverbasert tilgang, timeout, cache, rate limiting og godkjente bildedomener.
- Ikke omgå botbeskyttelse eller innlogging.
- Ikke hent pris eller lagerstatus i første versjon.

Prøv minst 30 EAN-er før pilot, inkludert pakningsvarianter, vare uten bilde og vare som ikke finnes på nett. Krev riktig identitet for alle returnerte treff; ikke krev at hele butikkens sortiment finnes på nettet.

## 7. Antall og duplikater

- Antall er et **heltall større enn eller lik 0**.
- Ingen desimaler, negative tall eller valg av enhet.
- Bare tallet vises i antallskolonnen: eksempelvis **24**, uten «stk», «sett», «pakker» eller «bokser».
- Varenavn kan fremdeles beskrive pakningen, for eksempel «270 stk» eller «25 pk» som del av selve produktnavnet.
- Ingen automatisk omregning fra pakning til løse skruer. Antall gjelder antall av den skannede varen/pakningen.
- Ved gjentatt EAN på samme lapp vises eksisterende antall. Brukeren velger **Legg til**, **Erstatt** eller **Avbryt**.
- Hold ulike paknings-GTIN adskilt.
- Tilfeldige gjentatte skannehendelser skal aldri øke antall.
- Fjernede linjer skal kunne angres mens lappen er utkast.

Ikke innfør en vilkårlig lav grense på antall. Valider mot databasetype og sørg for at store tall får plass uten avkutting.

## 8. Design og strekkodeplassering

### Mobil/PC

Mobilen prioriterer skann → kontroller vare → antall → neste. Store trykkflater, lite navigering og synlig lagringsstatus.

PC prioriterer oversikt, redigering og en forhåndsvisning som viser faktisk sideantall. Vis statusene **Utkast**, **Låst**, **PDF klargjøres** og **PDF-feil** tydelig.

### Utskriftsoppsett

| Område | Utforming |
|---|---|
| Header | VARETELLING/MERKELAPP og dato; kompakt, uten butikk |
| Varefelt | Lite bilde, navn/variant og tydelig EAN som tekst |
| Antall | Stor fet skrift, bare tallet |
| Skann vare | Egen kolonne rett ved antallet, samme radramme |
| Footer | Diskret lapp-ID, revisjon og side x av y |
| Stil | Hvit bakgrunn, svart tekst, tydelige skillelinjer; gul overskriftsrad |

Valgfri sone kan vises hvis brukeren faktisk registrerer den. Ingen tomme sonefelter skal ta utskriftsplass.

### Strekkodekrav

- Generer **EAN-13 for gyldig 13-sifret EAN** og **EAN-8 for gyldig 8-sifret EAN**.
- Koden skal inneholde varens identitet, ikke antall, URL eller intern lapp-ID.
- Ved annen identifikatortype må korrekt symbolformat velges eksplisitt. Ikke kutt GTIN-14 til 13 sifre.
- Lag strekkoden som vektor fra lagret EAN. Ikke bruk et foto av produktets eksisterende strekkode.
- Vis bare én skannbar identitet per varelinje.
- Plasser strekkoden i eget hvitt område med nødvendig friplass til tekst, rammer og nabokoder.
- Bruk samme vertikale radgrenser for vare, antall og kode. Ikke legg kode på grensen mellom to varer.
- Behold EAN som store lesbare sifre i varefeltet; små sifre under strekkoden er bare ekstra kontroll.
- Produktbilder kan selv inneholde strekkoder. De skal ikke gi en ekstra lesbar, eventuelt annerledes kode på utskriften. Utelat/sladd kodeområdet i utskriftsbildet dersom nødvendig, eller utelat bildet. Ikke endre original produktidentitet.
- For EAN-13 anbefales X-dimensjon 0,33 mm, 95 moduler med streker/mellomrom, minst 11X friplass til venstre og 7X til høyre. Dette gir 37,29 mm bredde inklusive friplass. Ordinære streker skal være minst 22,85 mm høye ved dette valget; avsett ekstra plass til vaktstreker og sifre.
- Ikke krymp eller gjør koden lavere for å få flere varer på arket. Koden skal bevare gyldige fysiske mål selv om resten av raden tilpasses.
- Andre symboltyper har andre mål og må håndteres med tilsvarende dokumentasjon.
- Test faktisk skriver, 100 % utskrift, telefon og håndskanner. Digital avkoding er ikke nok til fysisk godkjenning.

Rammer og avstand reduserer feilsikting, men hindrer ikke fysisk at en skanner peker på nabokoden. Appens egen skanner bør bruke smalt sikteområde og vise varenavn/EAN ved treff. En ekstern skanner kan ikke styres av PDF-en.

## 9. Automatisk tilpassing: færrest mulig ark

**Ingen fast grense på tre varer.** Algoritmen skal minimere antall sider, og deretter velge størst mulig skrift innenfor dette sideantallet og avtalte minimumsgrenser.

**Dynamisk størrelse ved færre varer:** Når lappen inneholder færre enn ti varer, skal tilgjengelig plass på A3-arket brukes til å gjøre hver vare større og mest mulig leselig. Radhøyde, varenavn, EAN, antall og eventuelt produktbilde skal tilpasses dynamisk etter faktisk innhold og antall varer; ikke behold ti-varers størrelse med ubrukt plass. Strekkodene skal beholde korrekte proporsjoner og fysiske mål og kan ikke strekkes for å fylle raden. Samme prinsipp gjelder sider med færre varer i en flersidig lapp.

Rekkefølge:

1. Bruk A3 stående, foreslått 10 mm utskriftsmarg, kompakt header/footer.
2. Mål tekst, bilde, antall og strekkode med faktiske skrifter.
3. Reduser unødvendig radpadding og avstander først. Behold friplass rundt strekkoder.
4. Reduser eventuelt produktbildets størrelse.
5. Tilpass skrift gradvis innenfor tillatte profiler, og bryt hele varenavn over linjer.
6. Beregn minste nødvendige høyde for hver rad, basert på største av tekstblokk, antall og skannbar kode.
7. Finn færrest mulige sider med hele rader. Bevar varerekkefølgen.
8. Fordel rader hensiktsmessig og øk skrift der det er rom. Unngå overdrevent tomrom.
9. Vis sideantall i forhåndsvisningen før låsing.
10. Legg til side når minimumsgrenser ellers brytes. Ingen avkutting eller delte varer.

Foreslåtte startverdier, som må prøves på faktisk papir:

| Innhold | Varenavn | EAN i varefelt | Antall |
|---|---|---|---|
| 1–3 varer | 30–40 pt | 24–32 pt | 70–110 pt |
| 4–6 varer | 24–30 pt | 20–24 pt | 54–70 pt |
| 7–10 varer | 20–24 pt | 16–20 pt | 40–54 pt |
| Tetteste tillatte | Minst 18 pt | Minst 16 pt | Minst 36 pt |

Tallene er layoutvalg, ikke GS1-standarder. Strekkodens fysiske minimum er separat og må overholdes.

**Måltest:** Ti vanlige varer med korte/moderate navn, standard antall og EAN-13 får plass på ett A3-ark. Det vedlagte designet viser dette. Ingen universell maksgrense skal hardkodes: lange navn, store tall eller en annen strekkodetype kan endre kapasiteten. Strekkodens høyde setter en naturlig grense selv om teksten kunne vært pakket tettere.

Eksempel: 20 varer kan bli to sider dersom ti passer per side, men algoritmen skal måle innholdet fremfor å anta at alle varer er like høye.

## 10. Delt lagring, revisjoner og tilgang

Bruk en vedvarende serverdatabase. Vercels lokale filsystem og localStorage skal ikke være fellesarkiv.

### Logisk datamodell

- **sheets:** id/kort lapp-ID, arbeidsgruppe/organisasjon, count_date, valgfri location, state, version, working_revision, created_by, updated_by, timestamps, current_locked_revision_id.
- **lines:** sheet_id, rekkefølge, raw_barcode, barcode_format, validert EAN som tekst, dokumentert normalized_gtin, source_name, manual_name_override, image_reference, source_url, lookup_status, product_source, quantity som heltall.
- **revisions:** sheet_id, revisjonsnummer, uforanderlig snapshot av metadata/linjer, content_hash, template_version, locked_by, locked_at, PDF-status/filreferanse.
- **events:** opprettet, endret, låst, gjenåpnet, PDF generert, arkivert.
- **product_cache:** verifisert identitet, kilde, navn/bilde og hentetidspunkt.

Ingen dynamisk enhet er nødvendig. Hvis et eksisterende skjema har unit-felt, sett det fast til stk og ikke vis det i brukerflyt/utskrift.

### Sikker endring og låsing

- Alle handlinger sjekker brukerens tilgang til arbeidsgruppen. Bruk RLS/serverhåndheving også for bilder/PDF.
- version/ETag med compare-and-swap hindrer at to enheter overskriver hverandre stille. Returner f.eks. 409 ved konflikt.
- Mobilforsøk har operasjons-ID så retry ikke lager doble linjer eller antall.
- Låsing validerer siste lagrede versjon og oppretter snapshot, gjeldende revisjon og genereringsjobb atomisk.
- Låste lapper kan ikke endres via direkte API-/databasekall.
- PDF lages fra snapshot; jobben må ikke gjøre gammel revisjon gjeldende etter gjenåpning.
- PDF-feil skal kunne prøves igjen fra samme revisjon.
- Private PDF-er krever autorisert tilgang/kortlivede lenker.
- Nettutfall skal gi tydelig «Venter på nett». Lokal gjenoppretting kan brukes, men «Lagret» krever serverbekreftelse.
- Ikke tillat låsing før ventende endringer er lagret.
- Ny låsing gir ny revisjon. Tidligere PDF beholdes som historisk.
- Vektorstrekkoder, skrifter og produkter skal kunne gjengis stabilt fra revisjonen.
- Nettleseren kan åpne utskriftsdialog, men kan ikke bekrefte at papir faktisk er skrevet ut.

## 11. Roadmap / rekkefølge til Codex

### Fase 0 – Oppstart og avklar integrasjonene

1. Les repo, AGENTS.md og eventuell portalintegrasjon.
2. Sett opp Next.js/TypeScript og konfigurasjonsmal uten nøkler.
3. Opprett/tilknytt Vercel-prosjekt og fast testdomene slik at kamera og SDK-domene kan prøves.
4. Kartlegg Supabase/eksisterende database og tilgang for testgruppen.
5. Integrer ZXing-C++ via `zxing-wasm` og prøv en ekte telefon.
6. Verifiser produkttreff på minst ti reelle EAN-er.

**Ferdig når:** telefon leser reell EAN, og integrasjonsbehov/konfigurasjon er dokumentert. Ikke bruk hele første fase på dekorativ UI.

### Fase 1 – Første brukbare testutgave live

1. Ny lapp med automatisk dato.
2. Skann → produkt → antall → neste.
3. Manuell reserveflyt og duplikatkontroll.
4. Felles serverlagring og åpning av samme lapp på PC.
5. Redigerbart utkast og låsing.
6. A3-PDF med vare, tydelig EAN, tall og kode ved antallet.
7. Ti normale varer på ett ark; flere sider når nødvendig.
8. Gjenåpne → rediger → lås på nytt.
9. Deploy fungerende testutgave til Vercel og lever URL.

**Ferdig når:** hele arbeidsflyten virker på faktiske enheter og data bevares mellom mobil og PC. Ikke lever en ren demo med falske treff eller bare lokal lagring.

### Fase 2 – Kvalitet og butikkprøve

- Gjennomfør målingene for skanner.
- Prøv fysisk A3 med telefon og håndskanner; kontroller riktig EAN per rad.
- Test 1, 3, 6, 10, 11, 16, 20 og 40 varer, lange navn og store antall.
- Test nettutfall, samtidighet, retry, tilgang og PDF-feil.
- Rett problemer som gir feil vare, feil antall, dobbeltregistrering eller ustabil skanning først.

**Ferdig når:** skanner, data og papir er godkjent gjennom dokumenterte prøver.

### Fase 3 – Portal og drift

- Ferdig kobling fra Jobbverktøy, og felles innlogging hvis tilgjengelig/avtalt.
- Backup med dokumentert gjenoppretting.
- Enkel feillogging og oversikt over lisens-/kildeavhengigheter.
- Kort mobil-/PC-brukerveiledning og overlevering.

Bygg og kontroller tilgjengelig arbeid autonomt. Manglende produktfeed, fysisk telefon eller eventuell nøkkel til en senere avtalt motor skal rapporteres konkret; ikke skjul avhengigheten og ikke bruk den til å stoppe alt annet arbeid.

## 12. Godkjenningsliste før testutgaven kalles fungerende

- HTTPS-testlenke på Vercel virker på mobil og PC.
- Ekte mobilskanning virker, med oppgitt motor og dokumenterte prøver.
- EAN/varenavn gjelder riktig variant; ukjent vare og timeout håndteres tydelig.
- Bare heltallsantall; bare tallet står i antallskolonnen.
- Ingen butikk på utskrift.
- Ti vanlige varer får plass på én A3-side uten overdreven luft.
- Flere sider opprettes når minimum lesbarhet/strekkodemål krever det.
- Hver strekkode avkodes til EAN i samme rad, aldri til antall eller lapp-ID.
- Ingen ekstra lesbar kode fra produktbilder konkurrerer med den genererte koden.
- Lagret på mobil kan åpnes/redigeres på PC.
- Utkast kan ikke få gjeldende utskrift; gjenåpning krever ny låsing.
- Konflikt/retry gir ikke stille datatap eller doble linjer.
- PDF har riktige fysiske A3-mål, intakt tekst og skannbare koder.
- Autorisasjon gjelder også revisjoner og nedlasting.

Automatiser relevante tester for kontrollsiffer, duplikater, status, samtidighet, tilgang og paginering. Test fysisk kamera og papir i tillegg.

## 13. Oppstartsprompt – send til Codex sammen med filen

> Implementer Merkelapp i GitHub-repoet jeg har gitt deg tilgang til. Les denne prosjektfilen og AGENTS.md først. Bygg en fungerende webapp, klargjør/tilknytt Vercel og få en privat testutgave live når nødvendige tilganger og nøkler er tilgjengelige. Appen skal brukes fra Jobbverktøy-portalen.
>
> Prioriter pålitelig EAN-skanning fra første utviklingstrinn. Start med gratisalternativet ZXing-C++ via `zxing-wasm` gjennom et utskiftbart adapterlag. Dokumenter lisenser og WASM-/kameraoppsett. Prøv ekte telefoner og etiketter tidlig. Betalt motor vurderes bare dersom gratisløsningen ikke oppfyller behovet; ikke lever en kamerademo som om skannerkravet er oppfylt.
>
> Bygg mobilflyten skann → kontroller produkt → oppgi antall → neste, med felles serverlagring og åpning/redigering på PC. Antall er alltid stk og skal vises kun som tallet. Butikk skal ikke vises på lappen. Verifiser faktisk produktoppslag fra obsbygg.no; ikke finn på et API.
>
> Lag versjonert A3-PDF med tydelig varenavn, EAN og antall. Strekkoden skal ligge i en egen hvit kolonne ved antallet og inneholde varens EAN. Automatisk layout skal først redusere tomrom og så tilpasse skrift innenfor minimumsgrenser, med færrest mulig ark som mål. Ti vanlige varer skal normalt passe på ett ark. Behold riktige fysiske strekkodemål.
>
> Implementer utkast, låsing, gjenåpning og ny låsing med revisjoner og beskyttelse mot samtidige endringer. Følg roadmapen, kjør relevante tester, og lever en faktisk test-URL med kort status på hva som er kontrollert og hva som gjenstår fysisk. Ikke kjøp abonnement eller endre andre produksjonssystemer uten avtale. Hvis en tilgang/nøkkel mangler, fullfør det uavhengige arbeidet og angi nøyaktig hva som trengs.

## 14. Kilder

Kontrollert 28. oktober 2026. Kildene beskriver produkter eller teknikk, ikke at hele løsningen er implementert.

- [ZXing-WASM](https://github.com/Sec-ant/zxing-wasm): valgt nettleserpakke og MIT-lisens.
- [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp): underliggende skannermotor og Apache-2.0-lisens.
- [Scandit – Barcode Capture for Web](https://docs.scandit.com/sdks/web/barcode-capture/get-started/): offisiell integrasjon og lisensavhengighet.
- [MDN – getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia): kamera/tillatelser/HTTPS.
- [MDN – BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector): begrenset nettlesertilgjengelighet.
- [GS1 Sweden – størrelser og friplass](https://gs1.se/en/guides/how-to-guides/size-guide/): EAN-mål, strekhøyde og quiet zones.
- [GS1 Denmark – EAN-13/EAN-8](https://www.gs1.dk/en/vejledninger/hvor-store-skal-ean-13-og-ean-8-vaere): størrelse og hensyn ved utskrift.
- [Supabase – RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): databasehåndhevet tilgang.
- [MDN – @page size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page/size): A3-format og sidestørrelse.

Eksempelproduktene i PDF-en har klikkbare produktnavn som fører til obsbygg.no. Det er ikke en påstand om lagerstatus i en bestemt butikk. Produktbilder kan være representative bilder valgt av nettbutikken for flere varianter.

| Produkt/variant | EAN | Kilde |
|---|---|---|
| Kellen skruesett utendørs 270 stk | 7025180735989 | [Produktside](https://www.obsbygg.no/trelast-og-tyngre-byggevarer/festemateriell/skruer/treskruer-utendors/2874099) |
| Stanley målebånd 5 m / 0-30-697 | 3253560306977 | [Produktside](https://www.obsbygg.no/verktoy-og-tilbehor/handverktoy/maleverktoy/maleband/2389226) |
| Jotun tynner no.7 0,5 liter | 7029350011217 | [Produktside](https://www.obsbygg.no/maling/rengjoring-hus-og-terrasse/rensemidler/2345806?v=ObsBygg-7029350011217) |
| Kellen treskruer C4 5 × 70 mm, 800 pk | 7025180674691 | [Produktside](https://www.obsbygg.no/trelast-og-tyngre-byggevarer/festemateriell/skruer/treskruer-utendors/2679285?v=ObsBygg-7025180674691) |
| Kellen WAF C4 10 × 100 mm, 25 pk | 7025180690158 | [Produktside](https://www.obsbygg.no/trelast-og-tyngre-byggevarer/festemateriell/skruer/treskruer-utendors/2620242) |
| Stanley målebånd 8 m / 0-30-657 | 3253560306571 | [Produktside](https://www.obsbygg.no/verktoy-og-tilbehor/handverktoy/maleverktoy/maleband/2243248) |
| Stanley målebånd 3 m / 0-33-720 | 3253560306878 | [Produktside](https://www.obsbygg.no/verktoy-og-tilbehor/handverktoy/maleverktoy/maleband/2243240) |
| Bahco MTB-5-25 målebånd | 7314150119080 | [Produktside](https://www.obsbygg.no/verktoy-og-tilbehor/handverktoy/maleverktoy/maleband/2268854) |
| Bahco MTS-5-25 målebånd | 7314150119233 | [Produktside](https://www.obsbygg.no/verktoy-og-tilbehor/handverktoy/maleverktoy/maleband/2304080) |
| Kellen målebånd 5 m | 7025180586857 | [Produktside](https://www.obsbygg.no/verktoy-og-tilbehor/handverktoy/maleverktoy/maleband/2358530) |

