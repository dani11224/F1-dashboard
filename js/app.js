import { jolpica, findMeeting, fastestLapPackage, raceDate } from './api.js';
import * as M from './mensajes.js';
import { glosario } from './glosario.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const g = (key, text) => `<span class="g" data-g="${key}">${text}</span>`;

const TEAM = {
  ferrari: '#dc0000', mercedes: '#27f4d2', red_bull: '#3671c6', mclaren: '#ff8000',
  aston_martin: '#229971', alpine: '#ff87bc', williams: '#64c4ff', rb: '#6692ff',
  sauber: '#52e252', audi: '#bb0a30', haas: '#b6babd', cadillac: '#c9a227',
};
const teamColour = (id) => TEAM[id] || '#8a8f9c';

const fmtDay = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const fmtShort = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const SESSION_NAMES = [
  ['FirstPractice', 'Práctica 1'],
  ['SecondPractice', 'Práctica 2'],
  ['ThirdPractice', 'Práctica 3'],
  ['SprintQualifying', 'Clasificación sprint'],
  ['SprintShootout', 'Clasificación sprint'],
  ['Sprint', 'Sprint'],
  ['Qualifying', 'Clasificación'],
];

function sessionsOf(race) {
  const out = [];
  for (const [k, name] of SESSION_NAMES) {
    const d = raceDate(race, k);
    if (d) out.push({ name, start: d, len: k === 'Sprint' ? 60 : 75 });
  }
  out.push({ name: 'Carrera', start: raceDate(race), len: 130 });
  return out.sort((a, b) => a.start - b.start);
}

const raceDone = (race) => raceDate(race).getTime() + 3 * 3600000 < Date.now();

function lapStr(sec) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = (sec - m * 60).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

// ---------- Hoja inferior (glosario, nota) ----------
function openSheet(title, html, cls = '') {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = html;
  $('#sheet-body').className = cls;
  $('#sheet').classList.remove('hidden');
}
function closeSheet() { $('#sheet').classList.add('hidden'); }
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
document.addEventListener('click', (e) => {
  const el = e.target.closest('.g[data-g]');
  if (!el) return;
  const item = glosario[el.dataset.g];
  if (item) openSheet(item.t, `<p>${esc(item.d)}</p>`);
});

// ---------- Saludo y nota escondida ----------
function initGreeting() {
  const h = new Date().getHours();
  $('#saludo').textContent = h < 12 ? M.saludos.manana : h < 19 ? M.saludos.tarde : M.saludos.noche;
  if (M.pistaNota) $('#pista-nota').textContent = M.pistaNota;

  let taps = 0;
  let timer;
  $('#badge').addEventListener('click', () => {
    taps++;
    clearTimeout(timer);
    timer = setTimeout(() => (taps = 0), 2500);
    if (taps >= 5) {
      taps = 0;
      const n = M.notaEscondida;
      openSheet(n.titulo, n.parrafos.map((p) => `<p>${esc(p)}</p>`).join('') + `<p class="muted">${esc(n.firma)}</p>`, 'note');
    }
  });
}

// ---------- Glosario ----------
function initGlossary() {
  $('#glos-body').innerHTML = Object.values(glosario)
    .map((it) => `<details class="g-item"><summary>${esc(it.t)}</summary><p>${esc(it.d)}</p></details>`)
    .join('');
}

// ---------- Próximo GP y cuenta regresiva ----------
let countdownTimer;
function renderNext(races) {
  const box = $('#next-body');
  const next = races.find((r) => !raceDone(r));
  if (!next) {
    box.innerHTML = '<p class="next__name">Temporada terminada</p><p class="next__place">Nos vemos en la próxima. Mientras tanto, revisa el calendario y los circuitos.</p>';
    return null;
  }
  const loc = next.Circuit.Location;
  const sessions = sessionsOf(next);
  const isSprint = sessions.some((s) => s.name === 'Sprint');

  box.innerHTML = `
    <p class="next__name">${esc(next.raceName)}</p>
    <p class="next__place">${esc(next.Circuit.circuitName)} · ${esc(loc.locality)}, ${esc(loc.country)} · Ronda ${next.round}${isSprint ? ` · fin de semana con ${g('sprint', 'sprint')}` : ''}</p>
    <p class="countdown__label" id="cd-label"></p>
    <div class="countdown" id="cd">
      <div><b id="cd-d">0</b><span>días</span></div>
      <div><b id="cd-h">0</b><span>horas</span></div>
      <div><b id="cd-m">0</b><span>min</span></div>
      <div><b id="cd-s">0</b><span>seg</span></div>
    </div>
    <ul class="sched" id="sched"></ul>
    <p class="tiny muted" style="margin:8px 0 0">Horas en tu zona horaria.</p>`;

  const sched = $('#sched');
  const tick = () => {
    const now = Date.now();
    const live = sessions.find((s) => now >= s.start && now < s.start.getTime() + s.len * 60000);
    const upcoming = sessions.find((s) => s.start > now);

    if (live) {
      $('#cd-label').innerHTML = `<b style="color:var(--gold)">● En vivo ahora: ${esc(live.name)}</b>`;
      $('#cd').style.display = 'none';
    } else if (upcoming) {
      $('#cd').style.display = '';
      $('#cd-label').textContent = `Falta para: ${upcoming.name}`;
      let ms = upcoming.start - now;
      const d = Math.floor(ms / 86400000); ms -= d * 86400000;
      const h = Math.floor(ms / 3600000); ms -= h * 3600000;
      const m = Math.floor(ms / 60000); ms -= m * 60000;
      $('#cd-d').textContent = d;
      $('#cd-h').textContent = String(h).padStart(2, '0');
      $('#cd-m').textContent = String(m).padStart(2, '0');
      $('#cd-s').textContent = String(Math.floor(ms / 1000)).padStart(2, '0');
    }

    sched.innerHTML = sessions.map((s) => {
      const end = s.start.getTime() + s.len * 60000;
      const cls = now >= end ? 'done' : now >= s.start ? 'now' : '';
      return `<li class="${cls}"><b>${esc(s.name)}</b><time>${cap(fmtDay.format(s.start))} · ${fmtTime.format(s.start)}</time></li>`;
    }).join('');
  };
  tick();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 1000);
  return next;
}

// ---------- Calendario ----------
function renderCalendar(races, winners) {
  const nextRace = races.find((r) => !raceDone(r));
  $('#cal-body').innerHTML = races.map((r) => {
    const done = raceDone(r);
    const cls = done ? 'done' : r === nextRace ? 'next' : '';
    const w = winners[r.round];
    const sub = done && w ? `Ganó ${esc(w)}` : esc(r.Circuit.Location.locality);
    return `<li class="${cls}"><button data-round="${r.round}">
      <span class="rnd">R${r.round}</span>
      <span><span class="nm">${esc(r.raceName.replace(' Grand Prix', ''))}</span><span class="wn">${sub}</span></span>
      <span class="dt">${fmtShort.format(raceDate(r))}</span>
    </button></li>`;
  }).join('');

  $('#cal-body').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-round]');
    if (!b) return;
    const race = races.find((r) => r.round === b.dataset.round);
    if (race) {
      showCircuit(race);
      $('#circuito').scrollIntoView({ behavior: 'smooth' });
    }
  });
}

// ---------- Circuito 3D ----------
let track = null;
let trackModule = null;
let circuitToken = 0;

async function ensureTrack() {
  if (track) return track;
  if (!trackModule) trackModule = await import('./track3d.js');
  track = new trackModule.Track3D($('#track'), {
    onHud: (speed, t) => {
      $('#hud-speed').textContent = speed != null ? `${Math.round(speed)} km/h` : '—';
      $('#hud-time').textContent = lapStr(t);
    },
    onPlayState: (playing) => {
      $('#btn-play').textContent = playing ? '⏸' : '▶';
      $('#btn-play').setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    },
  });
  $('#btn-play').addEventListener('click', () => track.toggle());
  $('#btn-restart').addEventListener('click', () => track.restart());
  $('#speed-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-s]');
    if (!b) return;
    $('#speed-seg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    track.setSpeed(+b.dataset.s);
  });
  return track;
}

async function lapForRace(race) {
  const y = +race.season;
  if (raceDone(race)) {
    const m = await findMeeting(race, y).catch(() => null);
    if (m) {
      const pkg = await fastestLapPackage(m).catch(() => null);
      if (pkg) return { pkg, label: `Vuelta más rápida del GP de ${y}` };
    }
  }
  for (const py of [y - 1, y - 2]) {
    const m = await findMeeting(race, py).catch(() => null);
    if (!m) continue;
    const pkg = await fastestLapPackage(m).catch(() => null);
    if (pkg) return { pkg, label: `Vuelta más rápida del GP de ${py}` };
  }
  return null;
}

async function showCircuit(race) {
  const token = ++circuitToken;
  const loc = race.Circuit.Location;
  $('#circuit-name').textContent = race.Circuit.circuitName;
  $('#circuit-sub').textContent = `${race.raceName} · ${loc.locality}, ${loc.country}`;
  $('#track-msg').textContent = 'Cargando pista…';
  $('#track-msg').classList.remove('hidden');
  $('#lap-info').innerHTML = '';
  $('#winners').innerHTML = '';
  $('#hud-speed').textContent = '—';
  $('#hud-time').textContent = '0:00.000';

  jolpica.circuitWinners(race.Circuit.circuitId).then((list) => {
    if (token !== circuitToken || !list.length) return;
    $('#winners').innerHTML = `<h3>Últimos ganadores aquí</h3><ol class="rows">${list.map((r) => {
      const res = r.Results[0];
      const c = res.Constructor;
      return `<li class="${c.constructorId === 'ferrari' ? 'ferrari' : ''}">
        <span class="pos">${r.season}</span><span class="bar" style="background:${teamColour(c.constructorId)}"></span>
        <span class="who">${esc(res.Driver.givenName)} ${esc(res.Driver.familyName)}</span>
        <span class="val"><small>${esc(c.name)}</small></span></li>`;
    }).join('')}</ol>`;
  }).catch(() => {});

  let t;
  try {
    t = await ensureTrack();
  } catch (e) {
    if (token === circuitToken) $('#track-msg').textContent = 'No se pudo cargar el visor 3D. Revisa la conexión y recarga la página.';
    return;
  }

  const res = await lapForRace(race).catch(() => null);
  if (token !== circuitToken) return;

  if (!res) {
    t.clear();
    $('#track-msg').textContent = 'Todavía no hay datos de este circuito. Si es nuevo en el calendario, aparecerá después de su primera carrera.';
    return;
  }

  $('#track-msg').classList.add('hidden');
  t.load(res.pkg);

  const p = res.pkg;
  const sec = p.sectors.map((s, i) => `<div><span>Sector ${i + 1}</span><b>${s ? s.toFixed(3) : '—'}</b></div>`).join('');
  $('#lap-info').innerHTML = `
    <h3>${g('vueltaRapida', esc(res.label))}</h3>
    <div class="stats">
      <div class="stat stat--wide"><span>Piloto</span><b style="color:${p.driver.colour}">${esc(p.driver.name)}</b> <span class="muted">${esc(p.driver.team)}</span></div>
      <div class="stat"><span>Tiempo</span><b>${lapStr(p.lapTime)}</b></div>
      <div class="stat"><span>Velocidad máxima</span><b>${p.topSpeed ? Math.round(p.topSpeed) + ' km/h' : '—'}</b></div>
    </div>
    <div class="sectors">${sec}</div>
    <p class="tiny muted" style="margin:6px 0 0">${g('sectores', 'Sectores')} · vuelta ${p.lapNumber}</p>`;
}

function initCircuitChips(races) {
  const next = races.find((r) => !raceDone(r));
  const last = [...races].reverse().find(raceDone);
  const chips = [];
  if (next) chips.push(['next', 'Próximo GP', next]);
  if (last) chips.push(['last', 'Último GP', last]);
  const box = $('#circuit-chips');
  box.innerHTML = chips.map(([k, label]) => `<button class="chip" data-k="${k}">${label}</button>`).join('');

  const select = (k) => {
    box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.k === k));
    const hit = chips.find((c) => c[0] === k);
    if (hit) showCircuit(hit[2]);
  };
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) select(b.dataset.k);
  });

  // Si la última carrera fue hace poco (3 días o menos), mostrar esa primero.
  const recent = last && Date.now() - raceDate(last).getTime() < 3 * 86400000;
  select(recent || !next ? 'last' : 'next');
}

// ---------- Campeonato ----------
function initStandings() {
  let kind = 'drivers';
  let all = false;
  const data = {};

  const render = () => {
    const list = data[kind];
    if (!list) return;
    if (!list.length) { $('#standings-body').innerHTML = '<p class="muted">Aún no hay puntos esta temporada.</p>'; return; }
    const rows = all ? list : list.slice(0, 10);
    $('#standings-body').innerHTML = `<ol class="rows">${rows.map((s) => {
      if (kind === 'drivers') {
        const c = s.Constructors[s.Constructors.length - 1] || {};
        return `<li class="${c.constructorId === 'ferrari' ? 'ferrari' : ''}">
          <span class="pos">${s.position || '—'}</span><span class="bar" style="background:${teamColour(c.constructorId)}"></span>
          <span class="who">${esc(s.Driver.givenName)} <b>${esc(s.Driver.familyName)}</b><small>${esc(c.name || '')}</small></span>
          <span class="val"><b>${s.points}</b><small>pts</small></span></li>`;
      }
      const c = s.Constructor;
      return `<li class="${c.constructorId === 'ferrari' ? 'ferrari' : ''}">
        <span class="pos">${s.position || '—'}</span><span class="bar" style="background:${teamColour(c.constructorId)}"></span>
        <span class="who"><b>${esc(c.name)}</b></span>
        <span class="val"><b>${s.points}</b><small>pts</small></span></li>`;
    }).join('')}</ol>`;
    $('#standings-more').textContent = all ? 'Ver menos' : 'Ver todos';
    $('#standings-more').classList.toggle('hidden', list.length <= 10);
  };

  $('#standings-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    kind = b.dataset.k;
    $('#standings-seg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    if (!data[kind]) $('#standings-body').innerHTML = '<p class="loading">Cargando…</p>';
    render();
  });
  $('#standings-more').addEventListener('click', () => { all = !all; render(); });

  const fail = () => { $('#standings-body').innerHTML = '<p class="error">No se pudo cargar el campeonato. Intenta recargar.</p>'; };
  const p1 = jolpica.driverStandings().then((d) => { data.drivers = d; render(); }).catch(fail);
  jolpica.constructorStandings().then((d) => { data.teams = d; render(); }).catch(() => { data.teams = []; });
  return p1;
}

// ---------- Resultados ----------
function initResults() {
  let kind = 'race';
  const data = {};

  const render = () => {
    const race = data[kind];
    if (race === undefined) { $('#results-body').innerHTML = '<p class="loading">Cargando…</p>'; return; }
    if (!race) { $('#results-body').innerHTML = '<p class="muted">Todavía no hay resultados.</p>'; return; }
    $('#results-title').textContent = race.raceName;

    if (kind === 'race') {
      $('#results-body').innerHTML = `<ol class="rows">${race.Results.map((r) => {
        const c = r.Constructor;
        const finished = r.Time?.time || /lap/i.test(r.status) || r.status === 'Finished';
        let val = r.Time?.time ? esc(r.Time.time) : /lap/i.test(r.status) ? esc(r.status.replace('Laps', 'vueltas').replace('Lap', 'vuelta')) : g('dnf', 'DNF');
        if (!finished && r.status) val += `<small>${esc(r.status)}</small>`;
        const fl = r.FastestLap?.rank === '1' ? `<span class="tag g" data-g="vueltaRapida">VR</span>` : '';
        return `<li class="${c.constructorId === 'ferrari' ? 'ferrari' : ''}">
          <span class="pos">${r.position}</span><span class="bar" style="background:${teamColour(c.constructorId)}"></span>
          <span class="who">${esc(r.Driver.familyName)}${fl}<small>${esc(c.name)}</small></span>
          <span class="val">${val}${+r.points ? `<small>+${r.points} pts</small>` : ''}</span></li>`;
      }).join('')}</ol>`;
    } else {
      $('#results-body').innerHTML = `<p class="tiny muted" style="margin:4px 0 0">${g('clasificacion', '¿Qué son Q1, Q2 y Q3?')}</p><ol class="rows">${race.QualifyingResults.map((r) => {
        const c = r.Constructor;
        const best = r.Q3 || r.Q2 || r.Q1 || '—';
        const round = r.Q3 ? 'Q3' : r.Q2 ? 'Q2' : 'Q1';
        const pole = r.position === '1' ? `<span class="tag g" data-g="pole">POLE</span>` : '';
        return `<li class="${c.constructorId === 'ferrari' ? 'ferrari' : ''}">
          <span class="pos">${r.position}</span><span class="bar" style="background:${teamColour(c.constructorId)}"></span>
          <span class="who">${esc(r.Driver.familyName)}${pole}<small>${esc(c.name)}</small></span>
          <span class="val">${esc(best)}<small>${round}</small></span></li>`;
      }).join('')}</ol>`;
    }
  };

  $('#results-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    kind = b.dataset.k;
    $('#results-seg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    render();
  });

  jolpica.lastQualifying().then((d) => { data.quali = d || null; if (kind === 'quali') render(); }).catch(() => { data.quali = null; });
  return jolpica.lastRace()
    .then((d) => { data.race = d || null; render(); return d; })
    .catch(() => { $('#results-body').innerHTML = '<p class="error">No se pudieron cargar los resultados.</p>'; return null; });
}

// ---------- Mensaje de Ferrari ----------
function renderFerrari(race) {
  if (!race?.Results?.length) return;
  const ours = race.Results.filter((r) => r.Constructor.constructorId === 'ferrari');
  if (!ours.length) return;
  const best = Math.min(...ours.map((r) => +r.position));
  const pts = ours.reduce((a, r) => a + +r.points, 0);
  const m = best <= 3 ? pick(M.ferrariPodio) : pts > 0 ? pick(M.ferrariPuntos) : pick(M.ferrariMal);
  const detail = ours.map((r) => `${r.Driver.familyName} P${r.position}`).join(' · ');
  const box = $('#ferrari-msg');
  box.innerHTML = `<h3>${esc(m.titulo)}</h3><p>${esc(m.texto)}</p><p class="tiny" style="margin-top:6px;opacity:.8">${esc(race.raceName)}: ${esc(detail)}</p>`;
  box.classList.remove('hidden');
}

// ---------- Comparar pilotos ----------
async function initCompare() {
  const [standings, p1, p2, p3, poles] = await Promise.all([
    jolpica.driverStandings(),
    jolpica.finishedAt(1).catch(() => []),
    jolpica.finishedAt(2).catch(() => []),
    jolpica.finishedAt(3).catch(() => []),
    jolpica.poles().catch(() => []),
  ]);
  if (!standings.length) { $('#cmp-body').innerHTML = '<p class="muted">Aún no hay datos esta temporada.</p>'; return; }

  const count = (races, key) => {
    const out = {};
    for (const r of races) {
      const rows = r[key] || [];
      for (const x of rows) out[x.Driver.driverId] = (out[x.Driver.driverId] || 0) + 1;
    }
    return out;
  };
  const podium = {};
  for (const set of [p1, p2, p3]) {
    const c = count(set, 'Results');
    for (const k in c) podium[k] = (podium[k] || 0) + c[k];
  }
  const wins = count(p1, 'Results');
  const pole = count(poles, 'QualifyingResults');

  const drivers = standings.map((s) => {
    const id = s.Driver.driverId;
    const c = s.Constructors[s.Constructors.length - 1] || {};
    return {
      id,
      name: `${s.Driver.givenName} ${s.Driver.familyName}`,
      colour: teamColour(c.constructorId),
      team: c.name || '',
      stats: { pts: +s.points, pos: +s.position || standings.length, win: +s.wins || wins[id] || 0, pod: podium[id] || 0, pole: pole[id] || 0 },
    };
  });

  const opts = drivers.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  $('#cmp-a').innerHTML = opts;
  $('#cmp-b').innerHTML = opts;
  const has = (id) => drivers.some((d) => d.id === id);
  $('#cmp-a').value = has('leclerc') ? 'leclerc' : drivers[0].id;
  $('#cmp-b').value = has('hamilton') ? 'hamilton' : drivers[1]?.id || drivers[0].id;

  const ROWS = [
    ['Puntos', 'pts'],
    ['Victorias', 'win'],
    ['Podios', 'pod'],
    ['Poles', 'pole', 'pole'],
    ['Posición en el campeonato', 'pos', null, true],
  ];

  const render = () => {
    const a = drivers.find((d) => d.id === $('#cmp-a').value);
    const b = drivers.find((d) => d.id === $('#cmp-b').value);
    // Si los dos son del mismo equipo, el segundo va en blanco para distinguirlos.
    const cb = a.colour === b.colour ? '#e8e8e8' : b.colour;
    $('#cmp-body').innerHTML = ROWS.map(([label, k, gk, inverse]) => {
      const va = a.stats[k];
      const vb = b.stats[k];
      let wa, wb;
      if (inverse) {
        const n = drivers.length;
        wa = ((n - va + 1) / n) * 100;
        wb = ((n - vb + 1) / n) * 100;
      } else {
        const max = Math.max(...drivers.map((d) => d.stats[k]), 1);
        wa = (va / max) * 100;
        wb = (vb / max) * 100;
      }
      const lbl = gk ? g(gk, label) : label;
      return `<div class="cmp-row">
        <div class="cmp-row__labels"><b>${inverse ? 'P' + va : va}</b><span>${lbl}</span><b>${inverse ? 'P' + vb : vb}</b></div>
        <div class="cmp-bars"><div><i style="width:${Math.round(wa)}%;background:${a.colour}"></i></div><div><i style="width:${Math.round(wb)}%;background:${cb}"></i></div></div>
      </div>`;
    }).join('');
  };
  $('#cmp-a').addEventListener('change', render);
  $('#cmp-b').addEventListener('change', render);
  render();
}

// ---------- Arranque ----------
async function main() {
  initGreeting();
  initGlossary();

  initStandings();
  initResults().then(renderFerrari);
  initCompare().catch(() => { $('#cmp-body').innerHTML = '<p class="error">No se pudieron cargar los pilotos.</p>'; });

  let races;
  try {
    races = await jolpica.season();
  } catch {
    $('#next-body').innerHTML = '<p class="error">No se pudo cargar el calendario. Revisa la conexión y recarga.</p>';
    $('#cal-body').innerHTML = '';
    $('#track-msg').textContent = 'Sin calendario no hay circuito que mostrar todavía.';
    return;
  }
  if (!races.length) {
    $('#next-body').innerHTML = '<p class="muted">Todavía no hay calendario para esta temporada.</p>';
    return;
  }

  renderNext(races);
  initCircuitChips(races);

  const winners = {};
  jolpica.finishedAt(1).then((list) => {
    for (const r of list) winners[r.round] = r.Results?.[0]?.Driver?.familyName;
  }).catch(() => {}).finally(() => renderCalendar(races, winners));
}

main();
