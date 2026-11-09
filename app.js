'use strict';

const get = (id) => document.getElementById(id);
const names = new Intl.DisplayNames(['en'], { type: 'region' });
const numbers = new Intl.NumberFormat('en-US');
const storageKey = 'ijmm-origins-prototype-v1';
const scopes = ['world', 'us', 'texas'];
const scopeNames = { world: 'World', us: 'United States', texas: 'Texas' };
const starPath = 'M0,-10L2.7,-2.7L10,0L2.7,2.7L0,10L-2.7,2.7L-10,0L-2.7,-2.7Z';
const scopeButtons = [...document.querySelectorAll('[data-scope]')];
let scope = 'us';
let maps;
let places;
let local = readLocal();
let isDomestic = true;

function readLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return { zip: saved.zip || {}, country: saved.country || {} };
  } catch {
    return { zip: {}, country: {} };
  }
}

function svg(tag, attrs = {}, label) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (label) node.textContent = label;
  return node;
}

function responses(tally) {
  return Object.entries(tally).filter(([, count]) => Number.isSafeInteger(count) && count > 0);
}

function drawBase() {
  const data = maps[scope];
  get('insets').toggleAttribute('hidden', scope !== 'us');
  get('states').replaceChildren(...data.paths.map((d) => svg('path', { d, class: 'state ' + scope })));
  get('labels').replaceChildren(...data.labels.map(([name, x, y, dx, dy]) =>
    svg('text', { x: x + dx, y: y + dy, class: 'city-label' }, name)));
  const [x, y] = data.museum;
  get('museum').replaceChildren(
    svg('circle', { cx: x, cy: y, r: 9, class: 'museum-ring' }),
    svg('path', { d: starPath, transform: 'translate(' + x + ' ' + y + ') scale(.62)', class: 'museum-star' }),
    svg('text', { x: x - 13, y: y + (scope === 'texas' ? 5 : 15), class: 'museum-label' }, 'Iwo Jima Museum')
  );
}

function drawData() {
  const cities = new Map();
  let domesticTotal = 0;
  for (const [zip, count] of responses(local.zip)) {
    if (!Object.hasOwn(places.zips, zip)) continue;
    const city = places.zips[zip];
    const state = places.cities[city][0].slice(-2);
    if (scope === 'texas' && state !== 'TX') continue;
    cities.set(city, (cities.get(city) || 0) + count);
    domesticTotal += count;
  }

  let points;
  let total = domesticTotal;
  if (scope === 'world') {
    const countries = new Map(responses(local.country));
    countries.set('US', domesticTotal);
    points = [...countries].filter(([code, count]) => count > 0 && Object.hasOwn(maps.world.positions, code))
      .map(([code, count]) => [names.of(code), ...maps.world.positions[code], count]);
    total = points.reduce((sum, point) => sum + point[3], 0);
  } else {
    points = [...cities].map(([id, count]) => {
      const [name, x, y] = places.cities[id];
      return [name, x, y, count];
    });
    if (scope === 'texas') {
      const [s, dx, dy] = maps.texas.transform;
      points = points.map(([name, x, y, count]) => [name, x * s + dx, y * s + dy, count]);
    }
  }

  const marks = points.sort((a, b) => b[3] - a[3]).map(([label, x, y, count]) => {
    const size = Math.min(2.2, .32 + .15 * Math.sqrt(count));
    const marker = svg('path', { d: starPath, transform: 'translate(' + x + ' ' + y + ') scale(' + size + ')', class: 'map-dot' });
    marker.append(svg('title', {}, label + ' · ' + numbers.format(count) + (count === 1 ? ' response' : ' responses')));
    return marker;
  });
  get('dots').replaceChildren(...marks);
  if (scope === 'world') {
    const labels = [];
    const occupied = points.map(([, x, y]) => [x - 9, y - 9, x + 9, y + 9]);
    for (const [name, x, y] of points.slice(0, 8)) {
      const short = name.length > 24 ? name.slice(0, 22) + '…' : name;
      const width = short.length * 6.8;
      const offset = name === 'United States' ? 27 : 14;
      const candidates = [[x, y - offset], [x, y + offset + 8], [x + width / 2 + 12, y + 4], [x - width / 2 - 12, y + 4]];
      for (const [lx, ly] of candidates) {
        const bounds = [lx - width / 2 - 3, ly - 10, lx + width / 2 + 3, ly + 3];
        if (bounds[0] < 12 || bounds[2] > 888 || bounds[1] < 15 || bounds[3] > 515) continue;
        if (occupied.some(([l, t, r, b]) => l < bounds[2] && r > bounds[0] && t < bounds[3] && b > bounds[1])) continue;
        labels.push(svg('text', { x: lx, y: ly, class: 'city-label' }, short));
        occupied.push(bounds);
        break;
      }
    }
    get('labels').replaceChildren(...labels);
  }
  get('response-total').textContent = numbers.format(total);
  get('response-label').textContent = total === 1 ? 'response' : 'responses';
}

function setScope(next) {
  scope = next;
  const index = scopes.indexOf(scope);
  scopeButtons.forEach((button) => {
    button.disabled = false;
    button.setAttribute('aria-pressed', String(button.dataset.scope === scope));
  });
  get('zoom-out').disabled = index === 0;
  get('zoom-in').disabled = index === scopes.length - 1;
  get('map-name').textContent = scopeNames[scope] + ' visitor origins map';
  drawBase();
  drawData();
}

function zoom(step) {
  const next = scopes[scopes.indexOf(scope) + step];
  if (maps && next) setScope(next);
}

scopeButtons.forEach((button) => button.addEventListener('click', () => setScope(button.dataset.scope)));
get('zoom-in').addEventListener('click', () => zoom(1));
get('zoom-out').addEventListener('click', () => zoom(-1));

const fullscreenButton = get('fullscreen');
if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
  fullscreenButton.hidden = false;
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      get('confirmation').textContent = 'Full screen is unavailable in this window.';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = Boolean(document.fullscreenElement);
    fullscreenButton.setAttribute('aria-pressed', String(isFullscreen));
    fullscreenButton.setAttribute('aria-label', isFullscreen ? 'Exit full screen' : 'Enter full screen');
  });
}

const frame = get('map-frame');
function touchDistance(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}
let startDistance = 0;
frame.addEventListener('touchstart', (event) => {
  if (event.touches.length === 2) startDistance = touchDistance(event.touches);
}, { passive: true });
frame.addEventListener('touchmove', (event) => {
  if (event.touches.length !== 2) return;
  if (event.cancelable) event.preventDefault();
  if (!startDistance) return;
  const ratio = touchDistance(event.touches) / startDistance;
  if (ratio > 1.2 || ratio < .83) {
    zoom(ratio > 1 ? 1 : -1);
    startDistance = 0;
  }
}, { passive: false });
for (const type of ['touchend', 'touchcancel']) {
  frame.addEventListener(type, () => { startDistance = 0; }, { passive: true });
}

function setMode(domestic) {
  isDomestic = domestic;
  get('domestic').setAttribute('aria-pressed', String(domestic));
  get('abroad').setAttribute('aria-pressed', String(!domestic));
  get('zip-fields').hidden = !domestic;
  get('country-fields').hidden = domestic;
  showError('');
}

function showError(message, field) {
  get('form-error').textContent = message;
  for (const input of [get('zip'), get('country')]) input.removeAttribute('aria-invalid');
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  }
}

get('open').addEventListener('click', () => {
  get('location-form').reset();
  setMode(true);
  get('confirmation').textContent = '';
  get('entry').showModal();
  get('zip').focus();
});
get('clear-data').addEventListener('click', () => {
  const confirmation = get('confirmation');
  try {
    localStorage.removeItem(storageKey);
  } catch {
    confirmation.textContent = 'Couldn’t clear saved responses in this browser.';
    return;
  }
  local = { zip: {}, country: {} };
  drawData();
  confirmation.textContent = 'Saved responses cleared.';
});
get('close').addEventListener('click', () => get('entry').close());
get('domestic').addEventListener('click', () => setMode(true));
get('abroad').addEventListener('click', () => setMode(false));
get('zip').addEventListener('input', () => showError(''));
get('country').addEventListener('change', () => showError(''));

get('location-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const field = get(isDomestic ? 'zip' : 'country');
  const value = field.value.trim();
  if (isDomestic && !/^\d{5}$/.test(value)) {
    showError('Enter a 5-digit ZIP code.', field);
    return;
  }
  if (isDomestic && !Object.hasOwn(places.zips, value)) {
    showError('We couldn’t find that ZIP code. Check the digits or choose a country or territory.', field);
    return;
  }
  if (!isDomestic && !places.countries.includes(value)) {
    showError('Choose a country or territory.', field);
    return;
  }
  const tally = isDomestic ? local.zip : local.country;
  tally[value] = (tally[value] || 0) + 1;
  try { localStorage.setItem(storageKey, JSON.stringify(local)); } catch { /* Keep the response for this session. */ }
  if (!isDomestic) setScope('world');
  else if (scope === 'texas' && !places.cities[places.zips[value]][0].endsWith(', TX')) setScope('us');
  else drawData();
  get('entry').close();
  get('confirmation').textContent = 'Thanks for adding your location!';
});

async function load(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Unable to load ' + path);
  return response.json();
}

Promise.all([load('map.json'), load('places.json'), load('views.json')]).then(([mapData, placeData, views]) => {
  places = placeData;
  maps = {
    us: mapData,
    texas: { ...views.texas, paths: [views.texas.path] },
    world: { ...views.world, labels: [] }
  };
  maps.world.positions.CS = maps.world.positions.RS;
  maps.world.positions.AN = maps.world.positions.CW;
  const options = places.countries.filter((code) => code !== 'CS' && code !== 'AN').map((code) => [code, names.of(code)])
    .sort((a, b) => a[1].localeCompare(b[1]));
  get('country').append(...options.map(([code, label]) => new Option(label, code)));
  setScope(scope);
  get('map').removeAttribute('hidden');
  get('loading').hidden = true;
  get('open').disabled = false;
  get('clear-data').disabled = false;
}).catch(() => {
  get('loading').textContent = 'The map couldn’t load. Refresh the page to try again.';
});
