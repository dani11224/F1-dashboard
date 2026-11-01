// Acceso a las APIs públicas de F1.
// - Jolpica (sucesora de Ergast): calendario, resultados y campeonatos.
// - OpenF1: posiciones del carro, vueltas y telemetría de sesiones pasadas.
// Todo se pide desde el navegador; las respuestas se guardan un rato en
// localStorage para no repetir llamadas y para que funcione sin señal.

const J = 'https://api.jolpi.ca/ergast/f1';
const O = 'https://api.openf1.org/v1';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lsGet(k) {
  try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* lleno o bloqueado */ }
}

// Cola por servidor para respetar los límites de cada API.
const queues = {};
function enqueue(host, gapMs, task) {
  const prev = queues[host] || Promise.resolve();
  const run = prev.then(task, task);
  queues[host] = run.then(() => sleep(gapMs), () => sleep(gapMs));
  return run;
}

async function rawFetch(url) {
  const host = new URL(url).host;
  const gap = host.includes('openf1') ? 400 : 260;
  return enqueue(host, gap, async () => {
    let lastErr;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(url);
        if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
      } catch (e) {
        lastErr = e;
        await sleep(700 * (i + 1));
      }
    }
    throw lastErr || new Error('Sin respuesta');
  });
}

const mem = new Map();

// Pide un JSON con caché. ttlMin = minutos que dura la copia guardada.
// store=false: solo memoria (para respuestas grandes).
export function getJSON(url, ttlMin = 30, store = true) {
  if (mem.has(url)) return mem.get(url);
  const key = 'f1c:' + url;
  const cached = store ? lsGet(key) : null;
  if (cached && Date.now() - cached.t < ttlMin * 60000) return Promise.resolve(cached.d);

  const p = rawFetch(url)
    .then((d) => { if (store) lsSet(key, { t: Date.now(), d }); return d; })
    .catch((e) => {
      mem.delete(url);
      if (cached) return cached.d; // copia vieja mejor que nada
      throw e;
    });
  mem.set(url, p);
  return p;
}

const races = (d) => d?.MRData?.RaceTable?.Races || [];

export const jolpica = {
  season: () => getJSON(`${J}/current.json?limit=100`, 360).then(races),
  driverStandings: () =>
    getJSON(`${J}/current/driverStandings.json?limit=100`, 30)
      .then((d) => d.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || []),
  constructorStandings: () =>
    getJSON(`${J}/current/constructorStandings.json?limit=100`, 30)
      .then((d) => d.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || []),
  lastRace: () => getJSON(`${J}/current/last/results.json?limit=100`, 30).then((d) => races(d)[0]),
  lastQualifying: () => getJSON(`${J}/current/last/qualifying.json?limit=100`, 30).then((d) => races(d)[0]),
  // Carreras de la temporada con el piloto que terminó en `pos` (1, 2 o 3).
  finishedAt: (pos) => getJSON(`${J}/current/results/${pos}.json?limit=100`, 60).then(races),
  poles: () => getJSON(`${J}/current/qualifying/1.json?limit=100`, 60).then(races),
  // Últimos ganadores en un circuito (del más reciente al más viejo).
  circuitWinners: async (circuitId, n = 5) => {
    const base = `${J}/circuits/${circuitId}/results/1.json`;
    const first = await getJSON(`${base}?limit=1`, 60);
    const total = +first.MRData.total || 0;
    if (!total) return [];
    const off = Math.max(0, total - n);
    const d = await getJSON(`${base}?limit=${n}&offset=${off}`, 60);
    return races(d).reverse();
  },
};

const enc = encodeURIComponent;

export const openf1 = {
  meetings: (year) => getJSON(`${O}/meetings?year=${year}`, 720),
  raceSession: (meetingKey) =>
    getJSON(`${O}/sessions?meeting_key=${meetingKey}&session_name=Race`, 720).then((a) => a[0] || null),
  laps: (sessionKey) => getJSON(`${O}/laps?session_key=${sessionKey}`, 60, false),
  location: (sk, dn, t0, t1) =>
    getJSON(`${O}/location?session_key=${sk}&driver_number=${dn}&date>=${enc(t0)}&date<=${enc(t1)}`, 60, false),
  carData: (sk, dn, t0, t1) =>
    getJSON(`${O}/car_data?session_key=${sk}&driver_number=${dn}&date>=${enc(t0)}&date<=${enc(t1)}`, 60, false),
  driver: (sk, dn) => getJSON(`${O}/drivers?session_key=${sk}&driver_number=${dn}`, 1440).then((a) => a[0] || null),
};

// ---------- Utilidades para cruzar Jolpica con OpenF1 ----------

export const norm = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function raceDate(race, key = null) {
  const s = key ? race[key] : race;
  if (!s?.date) return null;
  return new Date(`${s.date}T${s.time || '12:00:00Z'}`);
}

// Busca en OpenF1 el GP equivalente a una carrera de Jolpica en un año dado.
export async function findMeeting(race, year) {
  const list = (await openf1.meetings(year)).filter((m) => !/test/i.test(m.meeting_name || ''));
  if (!list.length) return null;

  // Mismo año: por fecha (el GP empieza 2-4 días antes de la carrera).
  if (year === +race.season) {
    const rd = raceDate(race);
    const hit = list.find((m) => {
      const diff = (rd - new Date(m.date_start)) / 86400000;
      return diff >= -0.5 && diff <= 5;
    });
    if (hit) return hit;
  }

  // Por nombre del GP.
  const rn = norm(race.raceName);
  let hit = list.find((m) => norm(m.meeting_name) === rn || norm(m.meeting_official_name || '').includes(rn));
  if (hit) return hit;

  // Por ciudad o circuito.
  const loc = norm(race.Circuit?.Location?.locality);
  const cn = norm(race.Circuit?.circuitName);
  hit = list.find((m) => {
    const hay = norm(`${m.location} ${m.circuit_short_name} ${m.meeting_name}`);
    return (loc && hay.includes(loc)) || (cn && norm(m.circuit_short_name) && cn.includes(norm(m.circuit_short_name)));
  });
  if (hit) return hit;

  // Por país, solo si hay un único GP en ese país.
  const country = norm(race.Circuit?.Location?.country);
  const same = list.filter((m) => {
    const c = norm(m.country_name);
    return c && (c === country || (country === 'usa' && c === 'unitedstates') || (country === 'uk' && c === 'unitedkingdom') || (country === 'uae' && c === 'unitedarabemirates'));
  });
  return same.length === 1 ? same[0] : null;
}

// Arma la vuelta más rápida de un GP: forma de la pista, velocidad y tiempos.
export async function fastestLapPackage(meeting) {
  const cacheKey = 'f1lap:' + meeting.meeting_key;
  const cached = lsGet(cacheKey);
  if (cached) return cached;

  const session = await openf1.raceSession(meeting.meeting_key);
  if (!session) return null;
  if (session.date_end && new Date(session.date_end) > new Date()) return null;

  const laps = await openf1.laps(session.session_key);
  const valid = laps.filter((l) => l.lap_duration && !l.is_pit_out_lap && l.lap_number > 1);
  if (!valid.length) return null;
  const best = valid.reduce((a, b) => (b.lap_duration < a.lap_duration ? b : a));

  const start = new Date(best.date_start).getTime();
  const end = start + best.lap_duration * 1000;
  const t0 = new Date(start - 400).toISOString();
  const t1 = new Date(end + 400).toISOString();

  const loc = await openf1.location(session.session_key, best.driver_number, t0, t1);
  const car = await openf1.carData(session.session_key, best.driver_number, t0, t1);
  const drv = await openf1.driver(session.session_key, best.driver_number).catch(() => null);

  const carRows = car
    .map((c) => ({ t: new Date(c.date).getTime(), v: c.speed }))
    .filter((c) => Number.isFinite(c.t) && c.v != null)
    .sort((a, b) => a.t - b.t);

  let j = 0;
  const points = loc
    .map((p) => ({ t: new Date(p.date).getTime(), x: p.x, y: p.y, z: p.z }))
    .filter((p) => Number.isFinite(p.t) && !(p.x === 0 && p.y === 0))
    .sort((a, b) => a.t - b.t)
    .map((p) => {
      while (j < carRows.length - 1 && Math.abs(carRows[j + 1].t - p.t) <= Math.abs(carRows[j].t - p.t)) j++;
      const v = carRows.length ? carRows[j].v : 0;
      return [Math.round(p.t - start), p.x, p.y, p.z, v];
    });

  if (points.length < 30) return null;

  const inLap = carRows.filter((c) => c.t >= start && c.t <= end);
  const pkg = {
    year: meeting.year,
    meeting: meeting.meeting_name,
    lapTime: best.lap_duration,
    lapNumber: best.lap_number,
    sectors: [best.duration_sector_1, best.duration_sector_2, best.duration_sector_3],
    topSpeed: inLap.length ? Math.max(...inLap.map((c) => c.v)) : null,
    driver: {
      number: best.driver_number,
      name: drv?.full_name || drv?.broadcast_name || `#${best.driver_number}`,
      code: drv?.name_acronym || '',
      team: drv?.team_name || '',
      colour: drv?.team_colour ? '#' + drv.team_colour : '#dc0000',
    },
    points,
  };
  lsSet(cacheKey, pkg);
  return pkg;
}
