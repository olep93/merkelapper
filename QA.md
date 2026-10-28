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
- Delt arbeidsgruppearkiv inngår ikke i førsteutgaven; lapper er private per konto. Produktbilder vises i grensesnittet, og PDF-en er fortsatt tekst/vektor uten produktbilder.
- Lengre nettutfall må prøves på faktiske telefoner. UI viser serverbekreftet lagring, nettfeil og konflikter. Ulagrede endringer holdes i den åpne siden; lukk ikke fanen under nettutfall.

Appen er en første testutgave, ikke en fysisk godkjent butikkpilot.

## Tillegg: varenavn og produktbilde fra Obs BYGG

- Ti faktiske eksempel-EAN-er er slått opp via nettbutikkens offentlige autocomplete og verifisert mot riktig SKU/variant i produktsidens JSON-LD. Alle ti bilde-URL-er svarte med HTTP 200 og bildeinnhold. Lokale samlede oppslag inkludert bilde-HEAD tok ca. 0,4–0,9 sekunder per vare i denne prøven; dette er ikke en lovnad om mobil/nettverkshastighet.
- Egne tester dekker feil variant, pakningsstørrelse, motstridende identiteter, manglende bilde, ugyldig JSON-LD, utrygge bildeadresser, ingen treff, kildefeil, flere treff og normalisering av norske tegn før utskrift.
- Verifisert produktmetadata følger kontolagring og låst revisjon, mens manuelt varenavn beholdes. Dette er testet mot ekte HTTP-ruter på preview og gjennom jobbverktoy.no.
- Mobilgrensesnittet er prøvd med virkelig varenavn/bilde, tomt antall, eget navn skrevet før oppslaget kom tilbake, lagring og gjenåpning. Produktbildet var lastet og fulgte den lagrede linjen.
- Ved ukjent EAN eller timeout beholdes manuell registrering. Ingen test skal tolkes som at hele Obs BYGG-sortimentet er tilgjengelig på nett.
