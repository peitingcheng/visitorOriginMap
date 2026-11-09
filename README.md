# Visitor Origins Map

An Iwo Jima Museum prototype for a front-desk iPad. Visitors can enter a US ZIP code or choose a country or territory. The map has World, U.S., and Texas views and starts without sample responses. Clear data removes only responses saved in the current browser.

## Run locally

From this folder, run:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Serve these static files over HTTP so the map can load its bundled data files.

## Data

Responses are saved in browser storage. The prototype uses no server or shared database.

Map boundaries are from [U.S. Atlas](https://github.com/topojson/us-atlas) and [World Atlas](https://github.com/topojson/world-atlas). Location data is from [GeoNames](https://www.geonames.org/) and [Countries](https://github.com/mledoze/countries).
