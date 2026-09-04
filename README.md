# Hoogte — print relief to STL

Ateliertool van [captainjohn.nl](https://captainjohn.nl): ontwerp in de browser een **printbare reliëfplaat** en exporteer die als binair STL-bestand in millimeters.

Je kunt golven superponeren, letters verhoogd of verdiept in het oppervlak zetten, of een echt landschap (Zuid-Limburg, Berner Oberland, Geirangerfjord) als hoogtekaart printen — inclusief wegen en hoogtelijnen. Het mesh is een dichte plaat met **vlakke onderkant op 0 mm**, zodat je hem plat op het printbed legt.

## Wat je ermee maakt

- Wandreliëfs en onderzetters met interferentie- of staande golven
- Radiale rimpelpatronen, alsof je stenen in water gooit
- Naamplaten: tekst omhoog of gegraveerd in het reliëf
- Miniatuurlandschappen van echte terreinen, met wegen als dunne ribbels

Eenheden zijn millimeters. De 3D-viewport toont live afmetingen, driehoekentelling en geschatte STL-grootte.

## Starten

Je hebt **Node.js 20+** nodig. MongoDB is optioneel: zonder database bewaar je patronen in de browser (`localStorage`).

```bash
docker compose up -d
copy .env.example .env
npm run install:all
npm run dev
```

| Service | URL |
| --- | --- |
| Editor | http://localhost:5173 |
| API | http://localhost:3001 |
| Health | http://localhost:3001/api/health |

`docker compose up -d` start alleen MongoDB 7 op poort `27017`. De editor en API draaien lokaal via Vite en Express. Vite proxyt `/api` naar poort 3001. `npm run dev` houdt de API op 3001, ook als `.env` een andere `PORT` heeft (zoals 8080 op Railway).

Zonder Docker werkt de editor gewoon; de pill rechtsboven blijft dan **Lokaal** en opslaan valt terug op de browser.

### Scripts

| Commando | Functie |
| --- | --- |
| `npm run install:all` | Installeert root, server en client |
| `npm run dev` | Start API en editor tegelijk |
| `npm run dev:server` | Alleen Express (`node --watch`) |
| `npm run dev:client` | Alleen Vite |
| `npm run build` | Bouwt de Vue-editor naar `client/dist` |
| `npm start` | Productie: API + gebouwde editor op `PORT` |
| `npm test` | Controleert of gegenereerde STL’s geldig en waterdicht zijn |

## Deploy (Railway / Railpack)

Railway vindt geen startcommando als alleen `dev` in de root-`package.json` staat. Daarom staan `build` en `start` in de root, en herhaalt `railpack.json` het startcommando.

Het image installeert server- en client-dependencies, bouwt de editor, en start `node server/src/index.js`. Express serveert `client/dist` en luistert op `0.0.0.0:$PORT`.

Zet in Railway minstens:

```
MONGODB_URI=mongodb+srv://…
```

Zonder Mongo blijft de editor werken; patronen blijven dan in de browser.

## Editor gebruiken

1. Kies een modus: **Interferentie**, **Radiaal**, **Staande golf** of **Kaart**.
2. Stem het oppervlak: harmonieken of radialen, of een regio plus wegen/hoogtelijnen.
3. Optioneel: typ letters onder **Tekst** (verhoogd of verdiept), schuif ze over de plaat en draai ze.
4. Stel **plaatgrootte**, **golf-/reliëfhoogte**, **bodemdikte** en **resolutie** in. Het mesh verandert live.
5. **Bewaar** het patroon in de bibliotheek, of **Exporteer STL** en open het bestand in je slicer.

Verder:

- **Nieuw** — reset naar de standaardwaarden.
- **Dobbelen** — willekeurige modus, golven en (bij kaart) regio.
- De bibliotheek toont bewaarde patronen. Zonder Mongo blijven de starters **Interferentie**, **Radiale rimpel**, **Staande golf** en **Zuid-Limburg** in de browser staan.

## Modi

### Interferentie

Tot zes vlakke sinusgolven met eigen amplitude, golflengte, richting en fase. Samen vormen ze klassieke interferentiepatronen. Globale schalen (**Golflengte ×**, **Amplitude ×**) en **Draaiing** werken op alle harmonieken tegelijk.

### Radiaal

Elke bron is een rimpel vanuit een eigen middelpunt. Je zet **afstand tot midden** en **positie** (hoek) per radiaal, tot zes stenen in het water. Extra radialen voeg je toe of verwijder je met de knoppen.

### Staande golf

Gekruiste sinussen: `sin(k·u) · cos(k·v)` per harmoniek. Handig voor een regelmatig, bijna textielachtig reliëf.

### Kaart

Hoogtegrid van een voorgeprepareerde regio, genormaliseerd naar **reliëfhoogte**. Optioneel:

- **Wegen** — hoofdwegen als verhoogde lijnen (OpenStreetMap via Overpass, gecached in JSON)
- **Hoogtelijnen** — zeven niveaus over het terrein
- **Lijnhoogte / lijndikte** — ribbel bovenop het landschap
- **Randdemping** — laat de randen naar de bodem zakken, zodat de plaat netjes sluit

| Regio | Land | Karakter |
| --- | --- | --- |
| Zuid-Limburg | Nederland | Heuvels rond Vaals en Gulpen |
| Berner Oberland | Zwitserland | Alpenreliëf rond Interlaken |
| Geirangerfjord | Noorwegen | Diep fjord met steile wanden |

Kaarten staan in `server/src/data/maps/*.json`. Ontbreekt live data, dan valt de client terug op een synthetisch heuvellandschap zodat je alsnog kunt printen.

Hoogte komt van Terrarium-tiles (Mapzen/AWS terrain-RGB). Wegen uit Overpass (motorway tot tertiary). Opnieuw ophalen:

```bash
node server/src/build-maps.js
```

## Tekst

Letters worden als masker over het hoogteveld gelegd (canvas-raster, tot vier regels).

| Instelling | Bereik | Opmerking |
| --- | --- | --- |
| Lettergrootte | 6–80 mm | Bij de eerste letter gaat de resolutie automatisch naar minstens 140 |
| Hoogte / diepte | 0,4–8 mm | Verhoogd telt mee in de totale printhoogte |
| Links/rechts, voor/achter | ± helft van de plaat | |
| Draaiing | 0–360° | |

**Verhoogd** legt de letters op het reliëf. **Verdiept** snijdt ze erin, nooit door de bodem heen.

## Printplaat

| Parameter | Bereik | Standaard |
| --- | --- | --- |
| Plaatgrootte | 40–280 mm | 120 mm |
| Golf- / reliëfhoogte | 0,6–32 mm | 8 mm (kaart vaak 12 mm) |
| Bodemdikte | 0,8–10 mm | 2,4 mm |
| Resolutie | 24–180 | 90 (tekst/kaart: 140+) |
| Harmonieken / radialen | 1–6 | 3 |
| Randdemping | 0–1 | 0,18 |

Resolutie is het aantal punten per zijde. Bij 90 punten is een plaat van 120 mm ongeveer 31k driehoeken; bij 180 ongeveer 128k. Hogere resolutie maakt letters en wegen scherper, maar de STL groeit snel.

## Printtips

- De onderkant ligt op **0 mm**. Supports zijn meestal niet nodig.
- Houd bodemdikte minstens **1,6 mm** voor FDM (standaard 2,4 mm is veilig).
- Bij hoge, steile golven of bergreliëf: laagdikte 0,16 mm en ongeveer 15% infill.
- Wegen en hoogtelijnen zijn dunne ribbels: print ze niet lager dan 0,4 mm dik, anders verdwijnen ze in de eerste lagen.
- Gegraveerde tekst: diepte 0,8–1,6 mm is leesbaar zonder de plaat te verzwakken.
- Schaal in de slicer niet na: het model is al in millimeters.

## Architectuur

```
hoogte/
├── client/                 Vue 3 + Vite + Three.js
│   └── src/
│       ├── App.vue         Editor, schuifjes, bibliotheek
│       ├── components/     Viewport3D, SliderField
│       └── lib/            golf, tekst, kaart, STL-export, API
├── server/                 Express + Mongoose
│   └── src/
│       ├── index.js        Health, maps, patterns
│       ├── routes/         CRUD + STL-download
│       ├── data/maps/      Gecachte hoogtegrids
│       └── stl.js          Zelfde watervaste mesh als de client
├── docker-compose.yml      MongoDB 7
└── .env.example
```

De hoogtewiskunde leeft in `client/src/lib/wave.js`. De server importeert diezelfde modules (plus `clampParams`) zodat preview en export hetzelfde oppervlak maken.

### Mesh

Elk patroon wordt een gesloten volume:

1. Hoogteveld `n × n` (golven, kaart, daarna tekst)
2. Bovenkant: twee driehoeken per cel
3. Onderkant: vlak op z = 0, winding omgedraaid
4. Zijwanden tussen bodem en rand van het reliëf

Binair STL: 80-byte header (`captainjohn.nl print relief to stl`), `uint32` driehoekentelling, daarna 50 bytes per driehoek (normaal + drie vertices + attribute byte count).

### Opslaan

| Situatie | Gedrag |
| --- | --- |
| Mongo verbonden | Patronen in `hoogte.patterns`, starters worden geseed als de collectie leeg is |
| Mongo weg | Client schrijft naar `localStorage` onder `hoogte-patterns` |
| Health | `GET /api/health` → `{ ok, mongo }` |

## API

Basis-URL: `http://localhost:3001`.

| Methode | Pad | Beschrijving |
| --- | --- | --- |
| `GET` | `/api/health` | Serverstatus en Mongo-verbinding |
| `GET` | `/api/maps` | Lijst regio’s |
| `GET` | `/api/maps/:id` | Hoogtegrid + wegen (`limburg`, `interlaken`, `geiranger`) |
| `GET` | `/api/patterns` | Alle patronen, nieuwste eerst |
| `GET` | `/api/patterns/:id` | Eén patroon |
| `POST` | `/api/patterns` | Nieuw patroon (body wordt geclamped) |
| `PUT` | `/api/patterns/:id` | Bijwerken |
| `DELETE` | `/api/patterns/:id` | Verwijderen |
| `POST` | `/api/patterns/:id/stl` | Binaire STL; filename uit de naam |

Pattern-routes geven `503` als Mongo niet verbonden is. De editor vangt dat af en slaat lokaal op.

Voorbeeld:

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/maps/limburg
```

## Omgeving

Kopieer `.env.example` naar `.env`:

```
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/hoogte
```

`.env` staat in `.gitignore`. Commit geen credentials.

## Test

```bash
npm test --prefix server
```

`check-stl.js` bouwt STL’s voor interferentie, radiaal, staande golf en kaart en controleert:

- driehoekentelling versus `meshStats`
- bestandsgrootte `84 + triangles × 50`
- onderkant exact op 0 mm
- maximale hoogte (golfmodi) binnen 0,15 mm van de verwachte printhoogte

## Stack

- **Client:** Vue 3, Vite 6, Three.js (OrbitControls)
- **Server:** Express, Mongoose, dotenv, pngjs (Terrarium-tiles bij kaart-rebuild)
- **Data:** MongoDB 7 (optioneel), OpenStreetMap Overpass, AWS Terrarium-hoogte
- **Export:** binair STL, millimeters, watervast
