# print relief to stl

Captain John-ateliertool: bewerk 3D-golfreliëfs in de browser en exporteer ze als printbare STL-modellen.

De editor superponeert tot zes harmonieken. Schuifjes voor golflengte, amplitude, richting, fase, plaatgrootte en bodemdikte werken realtime. Het mesh is een dichte plaat met vlakke onderkant, zodat je hem plat op het printbed kunt zetten.

## Starten

Je hebt Node.js 20+ nodig. MongoDB is optioneel; zonder database bewaar je patronen lokaal.

```bash
docker compose up -d
copy .env.example .env
npm run install:all
npm run dev
```

- Editor: http://localhost:5173
- API: http://localhost:3001/api/health

## Gebruik

1. Laad een van de drie startpatronen: **Interferentie**, **Radiale rimpel** of **Staande golf**.
2. Zet het aantal **harmonieken** en stem per golf amplitude, golflengte, richting en fase.
3. Stel **plaatgrootte**, **golfhoogte** en **bodemdikte** in millimeters in. Het mesh verandert live.
4. **Exporteer STL** en open het bestand in je slicer. De onderkant ligt op 0 mm.

## Printtips

- Eenheden zijn millimeters.
- De onderkant is vlak; supports zijn meestal niet nodig.
- Houd bodemdikte minstens 1,6 mm voor FDM.
- Bij hoge, steile golven: kleinere laagdikte (0,16 mm) en 15% infill.
