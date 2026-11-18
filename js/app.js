/* Moj Napredak — glavna logika aplikacije. */
(function () {
  const S = () => Store.state;
  const $view = document.getElementById('view');

  /* ---------- Pomoćne funkcije ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
  const fmt = (v, d = 1) => v == null ? '–' : Number(v).toLocaleString('hr-HR', { maximumFractionDigits: d });
  const DAYS = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub'];
  const MONTHS = ['siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja', 'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenoga', 'prosinca'];
  const longDate = (s) => { const d = new Date(s + 'T12:00:00'); return `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`; };
  const shortDate = (s) => { const d = new Date(s + 'T12:00:00'); return `${d.getDate()}.${d.getMonth() + 1}.`; };
  const dayLabel = (s) => s === today() ? 'Danas' : s === addDays(today(), -1) ? 'Jučer' : longDate(s);
  const weekStart = (s) => { const d = new Date(s + 'T12:00:00'); const wd = (d.getDay() + 6) % 7; return addDays(s, -wd); };
  const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }

  const WORKOUT_TYPES = ['Snaga', 'Kardio', 'HIIT', 'Mobilnost', 'Sport', 'Ostalo'];
  const SLOTS = ['Doručak', 'Ručak', 'Večera', 'Užina'];
  const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

  /* ---------- UI stanje (ne sprema se) ---------- */
  const ui = {
    foodDate: today(),
    lifeDate: today(),
    weightRange: 90,
    reportWeek: null, // ponedjeljak tjedna u izvještaju (null = zadnji završeni tjedan)
    exercise: null,
    selFood: null,   // odabrana namirnica iz baze u formi za obrok
    sug: [],         // trenutni rezultati pretrage
    sugIdx: -1,
    draft: newDraft()
  };
  function newDraft() {
    return { date: today(), type: 'Snaga', duration: '', notes: '', exercises: [{ name: '', sets: [{ reps: '', weight: '' }] }] };
  }

  /* ---------- Izračuni ---------- */
  const sortedWeights = () => [...S().weights].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = () => { const w = sortedWeights(); return w[w.length - 1] || null; };
  const mealsOn = (date) => S().meals.filter(m => m.date === date);
  const dayTotals = (date) => {
    const ms = mealsOn(date);
    return { kcal: sum(ms, m => m.kcal), protein: sum(ms, m => m.protein), carbs: sum(ms, m => m.carbs), fat: sum(ms, m => m.fat) };
  };
  const habitsDone = (date) => {
    const d = Store.peekDay(date);
    if (!d) return 0;
    return S().habits.filter(h => d.habits[h.id]).length;
  };
  function habitStreak(id) {
    let n = 0, d = today();
    if (!Store.peekDay(d)?.habits[id]) d = addDays(d, -1); // danas još nije gotovo — ne prekida niz
    while (Store.peekDay(d)?.habits[id]) { n++; d = addDays(d, -1); }
    return n;
  }
  function workoutStreakWeeks() {
    const goal = S().settings.workoutsPerWeek || 1;
    let n = 0, ws = weekStart(addDays(weekStart(today()), -1));
    const count = (start) => S().workouts.filter(w => w.date >= start && w.date < addDays(start, 7)).length;
    if (count(weekStart(today())) >= goal) n++;
    while (count(ws) >= goal) { n++; ws = addDays(ws, -7); }
    return n;
  }
  const exerciseNames = () => [...new Set(S().workouts.flatMap(w => w.exercises.map(e => e.name.trim())).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'hr'));
  const est1RM = (w, r) => r <= 1 ? w : w * (1 + r / 30); // Epley

  /* ---------- Kalkulator ciljeva ---------- */
  const ACTIVITY = [
    [1.2, 'Sjedilački — uredski posao, bez treninga'],
    [1.375, 'Lagano aktivan — 1–3 treninga tjedno'],
    [1.55, 'Umjereno aktivan — 3–5 treninga tjedno'],
    [1.725, 'Vrlo aktivan — 6–7 treninga ili fizički posao'],
    [1.9, 'Ekstremno aktivan — težak fizički posao + trening']
  ];
  const PACES = [[0.25, 'Polako — 0,25 kg tjedno'], [0.5, 'Umjereno — 0,5 kg tjedno (preporuka)'], [0.75, 'Brže — 0,75 kg tjedno'], [1, 'Agresivno — 1 kg tjedno']];
  const KCAL_PER_KG = 7700;

  /** Mifflin-St Jeor + aktivnost → dnevne kalorije i makronutrijenti za zadani cilj. */
  function calcGoals(p) {
    const { sex, age, height, weight, target, activity, pace } = p;
    if (!age || !height || !weight || !target || !activity) return null;
    const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'f' ? -161 : 5);
    const tdee = bmr * activity;
    const diff = target - weight;
    const dir = Math.abs(diff) < 0.5 ? 0 : Math.sign(diff); // -1 mršavljenje, +1 dobivanje
    const warns = [];
    let wantPace = dir === 0 ? 0 : (pace || 0.5);
    if (dir > 0 && wantPace > 0.5) { wantPace = 0.5; warns.push('Za dobivanje mase preporučeno je najviše ~0,5 kg tjedno (inače se dobiva uglavnom mast) — tempo je ograničen na 0,5 kg.'); }
    if (dir < 0 && wantPace > weight * 0.01) warns.push(`Tempo veći od 1% tjelesne mase tjedno (${fmt(weight * 0.01)} kg) teško je održati i povećava gubitak mišića.`);
    let kcal = tdee + dir * wantPace * KCAL_PER_KG / 7;
    const floor = Math.max(bmr, sex === 'f' ? 1200 : 1500);
    if (dir < 0 && kcal < floor) {
      kcal = floor;
      warns.push(`Kalorije su ograničene na ${fmt(Math.round(floor / 10) * 10, 0)} kcal (ne ispod bazalnog metabolizma) — zato je tempo malo sporiji.`);
    }
    kcal = Math.round(kcal / 10) * 10;
    const realPace = Math.abs(kcal - tdee) * 7 / KCAL_PER_KG;
    const ref = dir < 0 ? target : weight; // proteini prema ciljnoj masi kod mršavljenja
    const protein = Math.round(ref * (dir < 0 ? 2.0 : 1.8));
    const fat = Math.max(Math.round(ref * 0.8), Math.round(kcal * 0.22 / 9));
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    const weeks = dir === 0 || realPace === 0 ? 0 : Math.abs(diff) / realPace;
    const eta = weeks ? addDays(today(), Math.round(weeks * 7)) : null;
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, delta: Math.round(kcal - tdee), protein, fat, carbs, dir, realPace, weeks, eta, warns, diff };
  }

  const profile = (over = {}) => {
    const st = S().settings, lw = latestWeight();
    return { sex: st.sex, age: st.age, height: st.height, weight: lw ? lw.weight : null, target: st.targetWeight, activity: st.activity, pace: st.pace, ...over };
  };

  function calcResultHtml(p, r) {
    if (!r) return `<div class="empty" style="padding:30px 8px">Upiši dob, visinu, trenutnu i ciljnu kilažu — kalorije se izračunaju odmah.</div>`;
    const mon = (s) => { const d = new Date(s + 'T12:00:00'); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}.`; };
    const goal = r.dir < 0 ? 'mršavljenje' : r.dir > 0 ? 'dobivanje mase' : 'održavanje';
    // stvarni tempo zadnja 4 tjedna
    const sw = sortedWeights(), lw = sw[sw.length - 1];
    const ago = sw.filter(w => w.date <= addDays(today(), -28)).pop();
    const actual = lw && ago ? (lw.weight - ago.weight) / (daysBetween(ago.date, lw.date) / 7) : null;
    let feedback = '';
    if (actual != null && r.dir !== 0) {
      const planned = r.dir * r.realPace;
      if (r.dir < 0 && actual > planned + 0.2) feedback = `<div class="warn">📉 Zadnja 4 tjedna mijenjaš se ${fmt(actual, 2)} kg/tj, a plan je ${fmt(planned, 2)} kg/tj. Ako se to nastavi još 1–2 tjedna, smanji unos za ~100–150 kcal ili dodaj kretanja.</div>`;
      else if (r.dir < 0 && actual < planned - 0.4) feedback = `<div class="warn">⚡ Gubiš brže od plana (${fmt(actual, 2)} kg/tj). Pazi da ne izgubiš mišiće — možeš dodati ~100–200 kcal.</div>`;
      else feedback = `<div class="good">✅ Stvarni tempo zadnja 4 tjedna: ${fmt(actual, 2)} kg/tj — u skladu s planom.</div>`;
    }
    return `
      <div class="small muted">Dnevni unos za ${goal}</div>
      <div class="calc-big">${fmt(r.kcal, 0)}<small>kcal</small></div>
      <div class="macros3">
        <div><b>${r.protein} g</b><span>Proteini</span></div>
        <div><b>${r.carbs} g</b><span>Ugljikohidrati</span></div>
        <div><b>${r.fat} g</b><span>Masti</span></div>
      </div>
      <div class="calc-lines">
        <div><span class="muted">Bazalni metabolizam (BMR)</span><span>${fmt(r.bmr, 0)} kcal</span></div>
        <div><span class="muted">Dnevna potrošnja (održavanje)</span><span>${fmt(r.tdee, 0)} kcal</span></div>
        <div><span class="muted">${r.delta < 0 ? 'Deficit' : r.delta > 0 ? 'Suficit' : 'Razlika'}</span><span>${r.delta > 0 ? '+' : ''}${fmt(r.delta, 0)} kcal / dan</span></div>
        ${r.dir ? `<div><span class="muted">Tempo</span><span>${r.dir < 0 ? '−' : '+'}${fmt(r.realPace, 2)} kg tjedno</span></div>
        <div><span class="muted">${fmt(p.weight)} → ${fmt(p.target)} kg</span><span>~${Math.ceil(r.weeks)} tjedana · oko ${mon(r.eta)}</span></div>` : ''}
      </div>
      ${r.warns.map(w => `<div class="warn">⚠️ ${w}</div>`).join('')}
      ${feedback}`;
  }

  function readCalcForm(form) {
    return { sex: form.sex.value, age: num(form.age.value), height: num(form.height.value), weight: num(form.weight.value),
      target: num(form.target.value), activity: num(form.activity.value), pace: num(form.pace.value) };
  }

  function applyGoals(r) {
    const s = S().settings;
    s.kcalGoal = r.kcal; s.proteinGoal = r.protein; s.carbsGoal = r.carbs; s.fatGoal = r.fat;
  }

  /* ---------- Prošli put (zadnji trening s istom vježbom) ---------- */
  function lastSession(name) {
    const n = (name || '').trim().toLowerCase();
    if (!n) return null;
    const ws = [...S().workouts].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    for (const w of ws) {
      const ex = w.exercises.find(e => e.name.trim().toLowerCase() === n);
      if (ex && ex.sets.length) return { date: w.date, sets: ex.sets };
    }
    return null;
  }
  function lastHtml(name, i) {
    const l = lastSession(name);
    if (!l) return '';
    return `Prošli put (${shortDate(l.date)}): <span class="num">${l.sets.map(s => s.weight ? `${s.reps}×${fmt(s.weight)}` : s.reps).join(', ')}</span> · <a href="#" data-act="filllast" data-i="${i}">učitaj</a>`;
  }

  /* ---------- Timer odmora ---------- */
  const timer = { end: 0, iv: null, ctx: null };
  const mmss = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
  function beep() {
    try {
      const ctx = timer.ctx; if (!ctx) return;
      [0, 0.35, 0.7].forEach(t => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.26);
      });
    } catch (e) { /* bez zvuka */ }
  }
  function tickRest() {
    const el = document.getElementById('timer');
    const left = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
    document.getElementById('timer-time').textContent = mmss(left);
    if (left === 0 && !el.classList.contains('done')) {
      el.classList.add('done'); clearInterval(timer.iv);
      beep(); navigator.vibrate?.([300, 150, 300]);
      const end = timer.end;
      setTimeout(() => { if (timer.end === end) el.hidden = true; }, 8000);
    }
  }
  function startRest(sec) {
    try { timer.ctx = timer.ctx || new (window.AudioContext || window.webkitAudioContext)(); timer.ctx.resume?.(); } catch (e) {}
    timer.end = Date.now() + sec * 1000;
    const el = document.getElementById('timer');
    el.classList.remove('done'); el.hidden = false;
    clearInterval(timer.iv); timer.iv = setInterval(tickRest, 250); tickRest();
  }

  /* ---------- Instalacija (PWA) ---------- */
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (route() === 'postavke') render(); });
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  /* ---------- Baza namirnica ---------- */
  const norm = (s) => String(s).toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const allFoods = () => [...(S().customFoods || []).map(f => ({ ...f, cat: 'Moje namirnice', custom: true })), ...window.FOODS];
  const r1 = (v) => Math.round(v * 10) / 10;

  function searchFoods(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const usage = {};
    S().meals.forEach(m => { if (m.foodId) usage[m.foodId] = (usage[m.foodId] || 0) + 1; });
    const res = [];
    for (const f of allFoods()) {
      const n = norm(f.name);
      if (!words.every(w => n.includes(w))) continue;
      let score = Math.min(usage[f.id] || 0, 10) * 2 + (f.custom ? 5 : 0);
      if (n.startsWith(words[0])) score += 10;
      else if (n.split(/[\s(/,-]+/).some(t => t.startsWith(words[0]))) score += 5;
      res.push({ type: 'food', f, score });
    }
    // Ranije ručno upisani obroci (bez veze na bazu) — fiksne vrijednosti
    const seen = new Set();
    for (const m of [...S().meals].reverse()) {
      if (m.foodId) continue;
      const n = norm(m.name);
      if (seen.has(n) || !words.every(w => n.includes(w))) continue;
      seen.add(n);
      res.push({ type: 'meal', m, score: 4 + (n.startsWith(words[0]) ? 10 : 0) });
    }
    return res.sort((a, b) => b.score - a.score).slice(0, 12);
  }

  const mealForm = () => $view.querySelector('form[data-form="meal"]');

  function renderSuggest(input) {
    const box = document.getElementById('suggest');
    if (!box) return;
    const q = input.value.trim();
    ui.sug = searchFoods(q);
    ui.sugIdx = ui.sug.length ? 0 : -1;
    if (!q) { box.hidden = true; return; }
    box.innerHTML = ui.sug.length ? ui.sug.map((r, i) => {
      const v = r.type === 'food' ? r.f : r.m;
      const sub = r.type === 'food'
        ? `${esc(r.f.cat)} · na 100 g: P ${fmt(v.protein)} · UH ${fmt(v.carbs)} · M ${fmt(v.fat)}`
        : `ranije upisano${v.grams ? ` · ${fmt(v.grams, 0)} g` : ''} · P ${fmt(v.protein)} · UH ${fmt(v.carbs)} · M ${fmt(v.fat)}`;
      return `<button type="button" data-act="pickfood" data-i="${i}" class="${i === 0 ? 'hl' : ''}">
        <div class="grow"><div class="nm">${esc(v.name)}</div><div class="mac">${sub}</div></div>
        <span class="kc">${fmt(v.kcal, 0)} kcal${r.type === 'food' ? '/100 g' : ''}</span></button>`;
    }).join('') : `<div class="none">Nema u bazi. Upiši vrijednosti ručno — i označi „Spremi u moje namirnice” da je idući put nađeš.</div>`;
    box.hidden = false;
  }

  const hideSuggest = () => { const b = document.getElementById('suggest'); if (b) b.hidden = true; };

  function updateFoodSel() {
    const el = document.getElementById('food-sel');
    if (!el) return;
    const f = ui.selFood;
    el.innerHTML = f ? [
      ...f.portions.map(p => `<button type="button" class="btn sm" data-act="portion" data-g="${p.g}">1 ${esc(p.label)} (${fmt(p.g, 0)} g)</button>`),
      `<button type="button" class="btn sm" data-act="portion" data-g="100">100 g</button>`
    ].join('') : '';
    const sc = document.getElementById('save-custom');
    if (sc) sc.hidden = !!f;
  }

  function recalcMeal() {
    const form = mealForm(), f = ui.selFood;
    if (!form || !f) return;
    const g = num(form.grams.value);
    if (g == null) return;
    const k = g / 100;
    form.kcal.value = Math.round(f.kcal * k);
    form.protein.value = r1(f.protein * k);
    form.carbs.value = r1(f.carbs * k);
    form.fat.value = r1(f.fat * k);
  }

  function pickSuggestion(i) {
    const r = ui.sug[i], form = mealForm();
    if (!r || !form) return;
    if (r.type === 'food') {
      ui.selFood = r.f;
      form.name.value = r.f.name;
      form.grams.value = r.f.portions[0]?.g || 100;
      recalcMeal();
    } else {
      ui.selFood = null;
      const m = r.m;
      form.name.value = m.name;
      form.grams.value = m.grams ?? '';
      ['kcal', 'protein', 'carbs', 'fat'].forEach(k => form[k].value = m[k] ?? '');
    }
    hideSuggest();
    updateFoodSel();
    form.grams.focus(); form.grams.select();
  }

  function movingAvg(points, win = 7) {
    return points.map((p, i) => {
      const from = addDays(p.x, -win + 1);
      const slice = points.slice(0, i + 1).filter(q => q.x >= from);
      return { x: p.x, y: sum(slice, q => q.y) / slice.length };
    });
  }

  /* ---------- Komponente ---------- */
  const stat = (label, value, unit, sub = '') =>
    `<div class="card stat"><div class="label">${label}</div><div class="value">${value}${unit ? `<small>${unit}</small>` : ''}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;

  function progress(label, val, goal, unit) {
    const pct = goal ? Math.min(100, (val / goal) * 100) : 0;
    const over = goal && val > goal * 1.05;
    return `<div class="macro"><div class="row"><span>${label}</span><span class="num muted">${fmt(val, 0)} / ${fmt(goal, 0)} ${unit}</span></div>
      <div class="bar ${over ? 'over' : ''}"><i style="width:${pct}%"></i></div></div>`;
  }

  const dateNav = (key, date) => `
    <div class="datenav">
      <button class="btn sm" data-act="day" data-key="${key}" data-n="-1" aria-label="Prethodni dan">‹</button>
      <input type="date" value="${date}" data-change="setdate" data-key="${key}">
      <button class="btn sm" data-act="day" data-key="${key}" data-n="1" aria-label="Sljedeći dan">›</button>
      ${date !== today() ? `<button class="btn sm ghost" data-act="today" data-key="${key}">Danas</button>` : ''}
    </div>`;

  /* ============================================================
     PREGLED
     ============================================================ */
  function viewDashboard() {
    const st = S().settings, t = today();
    const lw = latestWeight();
    const sw = sortedWeights();
    const monthAgo = sw.filter(w => w.date <= addDays(t, -30)).pop() || sw[0];
    const wDiff = lw && monthAgo && lw !== monthAgo ? lw.weight - monthAgo.weight : null;
    const tot = dayTotals(t);
    const ws = weekStart(t);
    const weekWorkouts = S().workouts.filter(w => w.date >= ws && w.date <= t);
    const hDone = habitsDone(t), hTot = S().habits.length;
    const hour = new Date().getHours();
    const greet = hour < 10 ? 'Dobro jutro' : hour < 18 ? 'Dobar dan' : 'Dobra večer';

    const weightPts = sw.filter(w => w.date >= addDays(t, -90)).map(w => ({ x: w.date, y: w.weight }));
    const kcalBars = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(t, i - 6);
      return { label: DAYS[new Date(d + 'T12:00:00').getDay()], value: dayTotals(d).kcal };
    });

    // Toplinska karta aktivnosti: zadnjih 5 tjedana
    const start = addDays(ws, -28);
    let heat = '';
    for (let i = 0; i < 35; i++) {
      const d = addDays(start, i);
      if (d > t) { heat += `<div style="opacity:.3"></div>`; continue; }
      const trained = S().workouts.some(w => w.date === d);
      const hp = hTot ? habitsDone(d) / hTot : 0;
      const score = (trained ? 2 : 0) + (hp >= .5 ? 1 : 0);
      const lvl = score >= 3 ? 'l3' : score === 2 ? 'l2' : score === 1 ? 'l1' : '';
      heat += `<div class="${lvl}" title="${shortDate(d)}${trained ? ' · trening' : ''} · navike ${Math.round(hp * 100)}%"></div>`;
    }

    const recent = [...S().workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    const empty = !S().weights.length && !S().workouts.length && !S().meals.length;

    return `
      <div class="page-head"><div><h1>${greet}${st.name ? ', ' + esc(st.name) : ''} 👋</h1><p class="muted">${longDate(t)}</p></div></div>
      ${empty ? `<div class="card" style="margin-bottom:16px"><div class="row"><div class="grow"><h2>Dobrodošao!</h2>
        <p class="muted small" style="margin:4px 0 0">Kreni upisom kilaže u <a href="#/tijelo">Tijelo</a>, postavi ciljeve u <a href="#/postavke">Postavkama</a>,
        ili učitaj primjer podataka da vidiš kako sve izgleda.</p></div><span class="spacer"></span>
        <button class="btn" data-act="demo">Učitaj primjer</button></div></div>` : ''}
      <div class="grid grid-4">
        ${stat('Kilaža', lw ? fmt(lw.weight) : '–', 'kg', wDiff != null ? `<span class="${wDiff > 0 ? 'up' : 'down'}">${wDiff > 0 ? '▲' : '▼'} ${fmt(Math.abs(wDiff))} kg</span> u 30 dana` : (st.targetWeight ? `cilj ${fmt(st.targetWeight)} kg` : 'upiši prvo mjerenje'))}
        ${stat('Kalorije danas', fmt(tot.kcal, 0), 'kcal', `${fmt(Math.max(0, st.kcalGoal - tot.kcal), 0)} preostalo`)}
        ${stat('Treninzi ovaj tjedan', weekWorkouts.length, `/ ${st.workoutsPerWeek}`, `🔥 ${workoutStreakWeeks()} tj. zaredom na cilju`)}
        ${stat('Navike danas', hDone, `/ ${hTot}`, `💧 ${Store.peekDay(t)?.water || 0} / ${st.waterGoal} čaša vode`)}
      </div>
      <div class="grid grid-2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h2>Kilaža · 90 dana</h2><a class="small" href="#/tijelo">Sve →</a></div>
          ${Charts.line([{ name: '', color: 'var(--c1)', points: weightPts }], { unit: 'kg', goal: st.targetWeight, goalLabel: 'Cilj' })}</div>
        <div class="card"><div class="card-head"><h2>Kalorije · 7 dana</h2><a class="small" href="#/prehrana">Prehrana →</a></div>
          ${Charts.bars(kcalBars, { unit: 'kcal', goal: st.kcalGoal })}</div>
      </div>
      <div class="grid grid-3" style="margin-top:16px">
        <div class="card"><div class="card-head"><h2>Makronutrijenti danas</h2></div>
          ${progress('Kalorije', tot.kcal, st.kcalGoal, 'kcal')}
          ${progress('Proteini', tot.protein, st.proteinGoal, 'g')}
          ${progress('Ugljikohidrati', tot.carbs, st.carbsGoal, 'g')}
          ${progress('Masti', tot.fat, st.fatGoal, 'g')}</div>
        <div class="card"><div class="card-head"><h2>Zadnji treninzi</h2><a class="small" href="#/trening">+ Novi</a></div>
          ${recent.length ? `<div class="list">${recent.map(w => `<div class="list-item"><div class="grow"><div class="title">${esc(w.type)}${w.duration ? ` · ${w.duration} min` : ''}</div>
            <div class="small muted">${dayLabel(w.date)} · ${w.exercises.length} vježbi</div></div></div>`).join('')}</div>` : `<div class="empty">Još nema treninga.</div>`}</div>
        <div class="card"><div class="card-head"><h2>Aktivnost · 5 tjedana</h2></div>
          <div class="heat">${heat}</div>
          <div class="legend" style="margin-top:12px"><span><i style="background:var(--surface-2)"></i>ništa</span><span><i class="" style="background:color-mix(in srgb,var(--accent) 30%,var(--surface-2))"></i>navike</span><span><i style="background:color-mix(in srgb,var(--accent) 60%,var(--surface-2))"></i>trening</span><span><i style="background:var(--accent)"></i>oboje</span></div></div>
      </div>
      ${weeklyReport()}`;
  }

  /* ============================================================
     TJEDNI IZVJEŠTAJ
     ============================================================ */
  function weekStats(ws) {
    const we = addDays(ws, 6), t = today();
    const inW = (d) => d >= ws && d <= we;
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).filter(d => d <= t);
    const weights = S().weights.filter(w => inW(w.date));
    const fed = days.filter(d => mealsOn(d).length);
    const wos = S().workouts.filter(w => inW(w.date));
    const sets = wos.flatMap(w => w.exercises.flatMap(e => e.sets));
    const hN = S().habits.length;
    const sleeps = days.map(d => Store.peekDay(d)?.sleep).filter(v => v != null);
    const steps = days.map(d => Store.peekDay(d)?.steps).filter(v => v != null);
    // Rekordi: najveća težina u tjednu veća od svega prije tog tjedna
    const prs = [];
    const best = {};
    for (const w of wos) for (const e of w.exercises) {
      const top = Math.max(0, ...e.sets.map(s => s.weight || 0));
      const n = e.name.trim();
      if (top && (!best[n] || top > best[n])) best[n] = top;
    }
    for (const [n, top] of Object.entries(best)) {
      const prior = S().workouts.filter(w => w.date < ws).flatMap(w => w.exercises.filter(e => e.name.trim() === n).flatMap(e => e.sets.map(s => s.weight || 0)));
      if (prior.length && top > Math.max(...prior)) prs.push({ name: n, weight: top, prev: Math.max(...prior) });
    }
    return {
      days: days.length,
      weight: weights.length ? sum(weights, w => w.weight) / weights.length : null,
      kcal: fed.length ? sum(fed, d => dayTotals(d).kcal) / fed.length : null,
      protein: fed.length ? sum(fed, d => dayTotals(d).protein) / fed.length : null,
      fedDays: fed.length,
      workouts: wos.length,
      minutes: sum(wos, w => w.duration),
      volume: sum(sets, s => (s.reps || 0) * (s.weight || 0)),
      habits: hN && days.length ? sum(days, d => habitsDone(d)) / (hN * days.length) : null,
      sleep: sleeps.length ? sum(sleeps, v => v) / sleeps.length : null,
      steps: steps.length ? sum(steps, v => v) / steps.length : null,
      prs
    };
  }

  function weeklyReport() {
    const st = S().settings;
    const curWs = weekStart(today());
    const ws = ui.reportWeek || addDays(curWs, -7);
    const a = weekStats(ws), b = weekStats(addDays(ws, -7));
    const isCurrent = ws === curWs;
    const lw = latestWeight();
    const loseGoal = st.targetWeight && lw ? st.targetWeight < lw.weight : true;

    // promjena u odnosu na prošli tjedan; good = smjer koji je dobar
    const delta = (x, y, d, unit, good) => {
      if (x == null || y == null) return `<div class="d">prošli tj. –</div>`;
      const diff = x - y;
      if (Math.abs(diff) < Math.pow(10, -d) / 2) return `<div class="d">= kao prošli tjedan</div>`;
      const cls = good == null ? '' : (good === 'down' ? diff < 0 : diff > 0) ? 'down' : 'up';
      return `<div class="d"><span class="${cls}">${diff > 0 ? '▲' : '▼'} ${fmt(Math.abs(diff), d)}${unit}</span> vs prošli tj.</div>`;
    };
    const tile = (label, v, unit, dHtml) => `<div><div class="label">${label}</div><div class="v">${v}${unit ? `<small>${unit}</small>` : ''}</div>${dHtml}</div>`;

    // Kratki zaključci
    const hl = [];
    if (a.weight != null && b.weight != null) {
      const dw = a.weight - b.weight;
      const okDir = loseGoal ? dw < 0 : dw > 0;
      hl.push(`${okDir ? '✅' : Math.abs(dw) < 0.1 ? '➖' : '⚠️'} Prosječna kilaža ${dw < 0 ? 'pala' : 'porasla'} za ${fmt(Math.abs(dw), 2)} kg${st.pace ? ` (plan ${loseGoal ? '−' : '+'}${fmt(st.pace, 2)} kg)` : ''}.`);
    }
    if (a.kcal != null) {
      const off = (a.kcal - st.kcalGoal) / st.kcalGoal;
      hl.push(`${Math.abs(off) <= 0.07 ? '✅' : '⚠️'} Kalorije u prosjeku ${fmt(a.kcal, 0)} kcal — ${Math.abs(off) <= 0.07 ? 'u skladu s ciljem' : off > 0 ? `${fmt(a.kcal - st.kcalGoal, 0)} kcal iznad cilja` : `${fmt(st.kcalGoal - a.kcal, 0)} kcal ispod cilja`}${a.fedDays < a.days ? ` (upisano ${a.fedDays} od ${a.days} dana)` : ''}.`);
    }
    if (a.protein != null && st.proteinGoal) hl.push(`${a.protein >= st.proteinGoal * 0.9 ? '✅' : '⚠️'} Proteini ${fmt(a.protein, 0)} g dnevno (cilj ${st.proteinGoal} g).`);
    hl.push(`${a.workouts >= st.workoutsPerWeek ? '✅' : isCurrent ? '⏳' : '⚠️'} ${a.workouts} od ${st.workoutsPerWeek} planiranih treninga.`);
    if (a.prs.length) hl.push(`🏆 Novi rekordi: ${a.prs.map(p => `${esc(p.name)} ${fmt(p.weight)} kg (+${fmt(p.weight - p.prev)})`).join(', ')}.`);

    const label = `${shortDate(ws)} – ${shortDate(addDays(ws, 6))}`;
    return `
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h2>📊 Tjedni izvještaj</h2>
          <div class="datenav">
            <button class="btn sm" data-act="repweek" data-n="-7" aria-label="Prethodni tjedan">‹</button>
            <span class="small num" style="min-width:100px;text-align:center;font-weight:600">${isCurrent ? 'Ovaj tjedan' : label}</span>
            <button class="btn sm" data-act="repweek" data-n="7" aria-label="Sljedeći tjedan" ${isCurrent ? 'disabled' : ''}>›</button>
          </div></div>
        <div class="report">
          ${tile('Prosječna kilaža', a.weight != null ? fmt(a.weight) : '–', 'kg', delta(a.weight, b.weight, 1, ' kg', loseGoal ? 'down' : 'up'))}
          ${tile('Kalorije / dan', a.kcal != null ? fmt(a.kcal, 0) : '–', 'kcal', delta(a.kcal, b.kcal, 0, ''))}
          ${tile('Proteini / dan', a.protein != null ? fmt(a.protein, 0) : '–', 'g', delta(a.protein, b.protein, 0, ' g', 'up'))}
          ${tile('Treninzi', a.workouts, `/ ${st.workoutsPerWeek}`, delta(a.workouts, b.workouts, 0, '', 'up'))}
          ${tile('Volumen', fmt(a.volume / 1000), 't', `<div class="d">${fmt(a.minutes / 60)} h treninga</div>`)}
          ${tile('Navike', a.habits != null ? Math.round(a.habits * 100) : '–', '%', delta(a.habits != null ? a.habits * 100 : null, b.habits != null ? b.habits * 100 : null, 0, ' %', 'up'))}
          ${tile('San', a.sleep != null ? fmt(a.sleep) : '–', 'h', delta(a.sleep, b.sleep, 1, ' h', 'up'))}
          ${tile('Koraci / dan', a.steps != null ? fmt(a.steps, 0) : '–', '', delta(a.steps, b.steps, 0, '', 'up'))}
        </div>
        <ul class="highlights">${hl.map(h => `<li>${h}</li>`).join('')}</ul>
      </div>`;
  }

  /* ============================================================
     TRENING
     ============================================================ */
  function viewTraining() {
    const d = ui.draft;
    const names = exerciseNames();
    if (!ui.exercise || !names.includes(ui.exercise)) ui.exercise = names[0] || null;
    const t = today();
    const monthW = S().workouts.filter(w => w.date >= addDays(t, -29));
    const vol = sum(monthW.flatMap(w => w.exercises.flatMap(e => e.sets)), s => (s.reps || 0) * (s.weight || 0));
    const min = sum(monthW, w => w.duration);

    // Napredak odabrane vježbe
    let progressHtml = `<div class="empty">Spremi trening s vježbama da vidiš napredak.</div>`;
    if (ui.exercise) {
      const sessions = S().workouts.filter(w => w.exercises.some(e => e.name.trim() === ui.exercise))
        .map(w => {
          const sets = w.exercises.filter(e => e.name.trim() === ui.exercise).flatMap(e => e.sets).filter(s => s.reps);
          const max = Math.max(0, ...sets.map(s => s.weight || 0));
          const orm = Math.max(0, ...sets.map(s => est1RM(s.weight || 0, s.reps)));
          const volume = sum(sets, s => s.reps * (s.weight || 0));
          const reps = sum(sets, s => s.reps);
          return { date: w.date, max, orm, volume, reps, sets: sets.length };
        }).sort((a, b) => a.date.localeCompare(b.date));
      const bodyweight = sessions.every(s => s.max === 0);
      const best = sessions.reduce((b, s) => (bodyweight ? s.reps > (b?.reps || 0) : s.max > (b?.max || 0)) ? s : b, null);
      const series = bodyweight
        ? [{ name: 'Ponavljanja', color: 'var(--c2)', points: sessions.map(s => ({ x: s.date, y: s.reps })) }]
        : [{ name: 'Max', color: 'var(--c1)', points: sessions.map(s => ({ x: s.date, y: s.max })) },
           { name: 'Proc. 1RM', color: 'var(--c2)', points: sessions.map(s => ({ x: s.date, y: Math.round(s.orm * 10) / 10 })) }];
      progressHtml = `
        <div class="row" style="margin-bottom:12px">
          <select data-change="exercise" style="width:auto;max-width:100%">${names.map(n => `<option ${n === ui.exercise ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
          <span class="spacer"></span>
          ${best ? `<span class="tag accent">🏆 Rekord: ${bodyweight ? best.reps + ' ponavljanja' : fmt(best.max) + ' kg'} · ${shortDate(best.date)}</span>` : ''}
        </div>
        ${Charts.line(series, { unit: bodyweight ? 'pon.' : 'kg' })}
        ${bodyweight ? '' : `<div class="legend" style="margin-top:8px"><span><i style="background:var(--c1)"></i>Najveća težina</span><span><i style="background:var(--c2)"></i>Procijenjeni 1RM</span></div>`}`;
    }

    const history = [...S().workouts].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    return `
      <div class="page-head"><div><h1>Trening</h1><p class="muted">Bilježi treninge i prati napredak u vježbama.</p></div></div>
      <div class="grid grid-4">
        ${stat('Treninzi (30 dana)', monthW.length, '')}
        ${stat('Vrijeme (30 dana)', fmt(min / 60), 'h')}
        ${stat('Volumen (30 dana)', fmt(vol / 1000), 't', 'ponavljanja × kg')}
        ${stat('Niz tjedana', workoutStreakWeeks(), 'tj.', `cilj ${S().settings.workoutsPerWeek}× tjedno`)}
      </div>
      <div class="grid grid-2" style="margin-top:16px;align-items:start">
        <form class="card" data-form="workout">
          <div class="card-head"><h2>Novi trening</h2></div>
          ${S().templates.length ? `<div class="chips" style="margin-bottom:14px"><span class="small muted">Predlošci:</span>
            ${S().templates.map(t => `<span class="chip"><button type="button" data-act="loadtpl" data-id="${t.id}">📋 ${esc(t.name)}</button><button type="button" class="x" data-act="deltpl" data-id="${t.id}" title="Obriši predložak">✕</button></span>`).join('')}</div>` : ''}
          <div class="form-grid">
            <label class="field">Datum<input type="date" name="date" value="${d.date}" required></label>
            <label class="field">Vrsta<select name="type">${WORKOUT_TYPES.map(x => `<option ${x === d.type ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            <label class="field">Trajanje (min)<input type="number" name="duration" min="0" inputmode="numeric" value="${esc(d.duration)}" placeholder="60"></label>
          </div>
          <datalist id="exnames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
          <div style="margin-top:14px">
            ${d.exercises.map((ex, i) => `
              <div class="exercise">
                <div class="row" style="flex-wrap:nowrap">
                  <input list="exnames" data-ex="${i}" data-f="name" value="${esc(ex.name)}" placeholder="Vježba (npr. Čučanj)">
                  <button type="button" class="icon-btn" data-act="rmex" data-i="${i}" title="Ukloni vježbu">✕</button>
                </div>
                <div class="last" data-last="${i}">${lastHtml(ex.name, i)}</div>
                <div class="set-row small muted" style="margin-top:10px"><span class="n">Set</span><span>Ponavljanja</span><span>Težina (kg)</span><span></span></div>
                ${ex.sets.map((s, j) => `
                  <div class="set-row">
                    <span class="n">${j + 1}</span>
                    <input type="number" min="0" inputmode="numeric" data-ex="${i}" data-set="${j}" data-f="reps" value="${esc(s.reps)}" placeholder="10">
                    <input type="number" min="0" step="0.5" inputmode="decimal" data-ex="${i}" data-set="${j}" data-f="weight" value="${esc(s.weight)}" placeholder="0">
                    <button type="button" class="icon-btn" data-act="rmset" data-i="${i}" data-j="${j}" title="Ukloni set">✕</button>
                  </div>`).join('')}
                <button type="button" class="btn sm ghost" style="margin-top:8px" data-act="addset" data-i="${i}">+ Set</button>
              </div>`).join('')}
            <div class="row" style="margin-top:10px"><button type="button" class="btn sm" data-act="addex">+ Vježba</button>
              <span class="spacer"></span><span class="small muted">⏱ Odmor:</span>
              ${[60, 90, 120, 180].map(s => `<button type="button" class="btn sm" data-act="rest" data-s="${s}">${mmss(s)}</button>`).join('')}</div>
          </div>
          <label class="field" style="margin-top:14px">Bilješke<textarea name="notes" placeholder="Kako je prošlo?">${esc(d.notes)}</textarea></label>
          <div class="row" style="margin-top:14px"><button class="btn primary" type="submit">Spremi trening</button><button type="button" class="btn ghost" data-act="savetpl">Spremi kao predložak</button><button type="button" class="btn ghost" data-act="cleardraft">Očisti</button></div>
          <p class="hint">Za kardio možeš upisati samo vrstu i trajanje. Za vježbe s vlastitom težinom ostavi težinu 0.</p>
        </form>
        <div class="stack">
          <div class="card"><div class="card-head"><h2>Napredak u vježbi</h2></div>${progressHtml}</div>
          <div class="card"><div class="card-head"><h2>Povijest</h2><span class="muted small">${history.length} ukupno</span></div>
            ${history.length ? `<div>${history.slice(0, 30).map(w => `
              <div class="workout">
                <div class="row"><span class="tag accent">${esc(w.type)}</span><strong>${dayLabel(w.date)}</strong>
                  <span class="muted small">${w.duration ? w.duration + ' min' : ''}</span><span class="spacer"></span>
                  <button class="btn sm ghost" data-act="repeatworkout" data-id="${w.id}" title="Kopiraj u novi trening">↻ Ponovi</button>
                  <button class="icon-btn" data-act="delworkout" data-id="${w.id}" title="Obriši">✕</button></div>
                ${w.exercises.length ? `<ul>${w.exercises.map(e => `<li><strong style="color:var(--text)">${esc(e.name)}</strong> — ${e.sets.map(s => s.weight ? `${s.reps}×${fmt(s.weight)}` : `${s.reps}`).join(', ')}</li>`).join('')}</ul>` : ''}
                ${w.notes ? `<div class="small muted" style="margin-top:6px">📝 ${esc(w.notes)}</div>` : ''}
              </div>`).join('')}</div>` : `<div class="empty">Još nema spremljenih treninga.</div>`}
          </div>
        </div>
      </div>`;
  }

  function syncDraft() {
    const form = $view.querySelector('form[data-form="workout"]');
    if (!form) return;
    const d = ui.draft;
    d.date = form.date.value; d.type = form.type.value; d.duration = form.duration.value; d.notes = form.notes.value;
    form.querySelectorAll('[data-ex]').forEach(el => {
      const ex = d.exercises[+el.dataset.ex];
      if (!ex) return;
      if (el.dataset.set != null) ex.sets[+el.dataset.set][el.dataset.f] = el.value;
      else ex[el.dataset.f] = el.value;
    });
  }

  /* ============================================================
     PREHRANA
     ============================================================ */
  function viewFood() {
    const st = S().settings, date = ui.foodDate;
    const tot = dayTotals(date);
    const ms = mealsOn(date);

    // Česte namirnice za brzi unos
    const freq = {};
    for (const m of S().meals) {
      const k = m.name.trim().toLowerCase();
      if (!freq[k]) freq[k] = { n: 0, m };
      freq[k].n++;
      if (m.date >= freq[k].m.date) freq[k].m = m;
    }
    const frequent = Object.values(freq).sort((a, b) => b.n - a.n).slice(0, 8).map(f => f.m);
    const foods = Object.values(freq).map(f => f.m);

    const hour = new Date().getHours();
    const defSlot = hour < 11 ? 'Doručak' : hour < 16 ? 'Ručak' : hour < 21 ? 'Večera' : 'Užina';

    const last14 = Array.from({ length: 14 }, (_, i) => {
      const d = addDays(date, i - 13);
      return { label: shortDate(d), value: dayTotals(d).kcal };
    });
    const logged = last14.filter(x => x.value > 0);
    const avg = logged.length ? sum(logged, x => x.value) / logged.length : 0;
    const protPts = Array.from({ length: 14 }, (_, i) => addDays(date, i - 13)).map(d => ({ x: d, y: dayTotals(d).protein })).filter(p => p.y > 0);

    return `
      <div class="page-head"><div><h1>Prehrana</h1><p class="muted">${dayLabel(date)}</p></div>${dateNav('foodDate', date)}</div>
      <div class="grid grid-2" style="align-items:start">
        <div class="stack">
          <div class="card">
            <div class="card-head"><h2>Dnevni unos</h2><a class="small" href="#/postavke" style="margin-left:auto">🎯 Ciljevi</a><span class="tag ${tot.kcal > st.kcalGoal * 1.05 ? '' : 'accent'}">${fmt(Math.round(st.kcalGoal - tot.kcal), 0)} kcal ${tot.kcal > st.kcalGoal ? 'iznad cilja' : 'preostalo'}</span></div>
            ${progress('Kalorije', tot.kcal, st.kcalGoal, 'kcal')}
            ${progress('Proteini', tot.protein, st.proteinGoal, 'g')}
            ${progress('Ugljikohidrati', tot.carbs, st.carbsGoal, 'g')}
            ${progress('Masti', tot.fat, st.fatGoal, 'g')}
          </div>
          <form class="card" data-form="meal">
            <div class="card-head"><h2>Dodaj obrok</h2></div>
            <div class="form-grid">
              <label class="field">Obrok<select name="slot">${SLOTS.map(s => `<option ${s === defSlot ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
              <div class="search-wrap" style="grid-column:span 2">
                <label class="field">Namirnica / jelo<input name="name" required autocomplete="off" placeholder="Traži: piletina, riža, jaje…" data-search="food"></label>
                <div class="suggest" id="suggest" hidden></div>
              </div>
            </div>
            <div class="row" style="margin-top:12px;align-items:flex-end;flex-wrap:nowrap">
              <label class="field" style="width:130px;flex-shrink:0">Količina (g)<input type="number" name="grams" min="0" step="any" inputmode="decimal" placeholder="g" data-grams></label>
              <div class="food-sel" id="food-sel" style="flex:1"></div>
            </div>
            <div class="form-grid" style="margin-top:12px">
              <label class="field">Kalorije<input type="number" name="kcal" min="0" inputmode="numeric" placeholder="kcal"></label>
              <label class="field">Proteini (g)<input type="number" name="protein" min="0" step="0.1" inputmode="decimal"></label>
              <label class="field">UH (g)<input type="number" name="carbs" min="0" step="0.1" inputmode="decimal"></label>
              <label class="field">Masti (g)<input type="number" name="fat" min="0" step="0.1" inputmode="decimal"></label>
            </div>
            <div class="row" style="margin-top:14px"><button class="btn primary" type="submit">Dodaj</button><span class="spacer"></span>
              <label class="check-label" id="save-custom"><input type="checkbox" name="saveCustom"> Spremi u moje namirnice</label></div>
            <p class="hint">Baza: ${allFoods().length} namirnica. Odaberi namirnicu i upiši grame — kalorije i makronutrijenti izračunaju se sami. Vrijednosti su približne; za pakirane proizvode provjeri deklaraciju.</p>
            ${S().savedMeals.length ? `<div style="margin-top:16px"><div class="small muted" style="margin-bottom:8px">Spremljeni obroci (dodaju se u odabrani obrok):</div>
              <div class="chips">${S().savedMeals.map(sm => `<span class="chip"><button type="button" data-act="addsaved" data-id="${sm.id}">🍽 ${esc(sm.name)} <span class="muted">${fmt(sum(sm.items, x => x.kcal), 0)}</span></button><button type="button" class="x" data-act="delsaved" data-id="${sm.id}" title="Obriši">✕</button></span>`).join('')}</div></div>` : ''}
            ${frequent.length ? `<div style="margin-top:16px"><div class="small muted" style="margin-bottom:8px">Brzo dodavanje (često jedeš):</div>
              <div class="row">${frequent.map(m => `<button type="button" class="btn sm" data-act="quickmeal" data-id="${m.id}">+ ${esc(m.name)} <span class="muted">${fmt(m.kcal, 0)}</span></button>`).join('')}</div></div>` : ''}
          </form>
        </div>
        <div class="stack">
          <div class="card"><div class="card-head"><h2>Obroci</h2><span class="spacer"></span><span class="muted small">${ms.length} unosa</span>
            ${mealsOn(addDays(date, -1)).length ? `<button class="btn sm" data-act="copyday" title="Kopiraj sve obroke s prethodnog dana">⧉ Kopiraj ${date === today() ? 'jučer' : 'prethodni dan'}</button>` : ''}</div>
            ${ms.length ? SLOTS.filter(sl => ms.some(m => m.slot === sl)).map(sl => {
              const items = ms.filter(m => m.slot === sl);
              return `<div style="margin-bottom:8px"><div class="row" style="justify-content:space-between;margin-top:6px"><h3>${sl}</h3><span class="spacer"></span><span class="small muted num">${fmt(sum(items, m => m.kcal), 0)} kcal</span>
                  <button class="btn sm ghost" data-act="savemeal" data-slot="${sl}" title="Spremi kao obrok za brzo dodavanje">💾 Spremi</button></div>
                <div class="list">${items.map(m => `<div class="list-item"><div class="grow"><div>${esc(m.name)}</div>
                  <div class="small muted num">${m.grams ? fmt(m.grams, 0) + ' g · ' : ''}${fmt(m.kcal, 0)} kcal · P ${fmt(m.protein)} · UH ${fmt(m.carbs)} · M ${fmt(m.fat)}</div></div>
                  <button class="icon-btn" data-act="delmeal" data-id="${m.id}" title="Obriši">✕</button></div>`).join('')}</div></div>`;
            }).join('') : `<div class="empty">Nema obroka za ovaj dan.</div>`}
          </div>
          <div class="card"><div class="card-head"><h2>Kalorije · 14 dana</h2><span class="muted small">prosjek ${fmt(avg, 0)} kcal</span></div>
            ${Charts.bars(last14, { unit: 'kcal', goal: st.kcalGoal, height: 180 })}</div>
          <div class="card"><div class="card-head"><h2>Proteini · 14 dana</h2></div>
            ${Charts.line([{ name: 'Proteini', color: 'var(--c2)', points: protPts }], { unit: 'g', goal: st.proteinGoal, decimals: 0, height: 170 })}</div>
        </div>
      </div>`;
  }

  /* ============================================================
     TIJELO
     ============================================================ */
  function viewBody() {
    const st = S().settings, sw = sortedWeights();
    const lw = sw[sw.length - 1], first = sw[0];
    const bmi = lw && st.height ? lw.weight / ((st.height / 100) ** 2) : null;
    const bmiTxt = bmi == null ? '' : bmi < 18.5 ? 'pothranjenost' : bmi < 25 ? 'normalno' : bmi < 30 ? 'prekomjerno' : 'pretilost';
    const range = ui.weightRange;
    const from = range ? addDays(today(), -range) : '0000';
    const pts = sw.filter(w => w.date >= from).map(w => ({ x: w.date, y: w.weight }));
    const fatPts = sw.filter(w => w.date >= from && w.bodyFat != null).map(w => ({ x: w.date, y: w.bodyFat }));
    const waistPts = sw.filter(w => w.date >= from && w.waist != null).map(w => ({ x: w.date, y: w.waist }));

    // Tempo zadnjih 4 tjedna
    const ago = sw.filter(w => w.date <= addDays(today(), -28)).pop();
    const rate = lw && ago ? (lw.weight - ago.weight) / (daysBetween(ago.date, lw.date) / 7) : null;
    let eta = '';
    if (rate && st.targetWeight && lw) {
      const left = st.targetWeight - lw.weight;
      if (Math.sign(left) === Math.sign(rate) && Math.abs(left) > 0.1) eta = `~${Math.ceil(Math.abs(left / rate))} tj. do cilja ovim tempom`;
    }

    return `
      <div class="page-head"><div><h1>Tijelo</h1><p class="muted">Kilaža, postotak masti i opseg struka.</p></div></div>
      <div class="grid grid-4">
        ${stat('Trenutno', lw ? fmt(lw.weight) : '–', 'kg', lw ? dayLabel(lw.date) : '')}
        ${stat('Ukupna promjena', lw && first ? (lw.weight - first.weight > 0 ? '+' : '') + fmt(lw.weight - first.weight) : '–', 'kg', first ? `od ${shortDate(first.date)}` : '')}
        ${stat('Tempo', rate != null ? (rate > 0 ? '+' : '') + fmt(rate, 2) : '–', 'kg/tj', eta || 'zadnja 4 tjedna')}
        ${stat('BMI', bmi ? fmt(bmi) : '–', '', bmi ? bmiTxt + (st.targetWeight && lw ? ` · do cilja ${fmt(Math.abs(lw.weight - st.targetWeight))} kg` : '') : 'postavi visinu')}
      </div>
      <div class="grid grid-2" style="margin-top:16px;align-items:start">
        <div class="stack">
          <form class="card" data-form="weight">
            <div class="card-head"><h2>Novo mjerenje</h2></div>
            <div class="form-grid">
              <label class="field">Datum<input type="date" name="date" value="${today()}" required></label>
              <label class="field">Kilaža (kg)<input type="number" name="weight" step="0.1" min="20" max="400" inputmode="decimal" required placeholder="${lw ? fmt(lw.weight) : '80'}"></label>
              <label class="field">Masnoća (%)<input type="number" name="bodyFat" step="0.1" min="2" max="70" inputmode="decimal" placeholder="neobavezno"></label>
              <label class="field">Struk (cm)<input type="number" name="waist" step="0.5" min="30" max="250" inputmode="decimal" placeholder="neobavezno"></label>
            </div>
            <label class="field" style="margin-top:12px">Bilješka<input name="note" placeholder="npr. ujutro, natašte"></label>
            <div class="row" style="margin-top:14px"><button class="btn primary" type="submit">Spremi</button></div>
            <p class="hint">Najtočnije je vagati se ujutro, nakon WC-a, prije doručka. Ako za taj datum već postoji unos, bit će zamijenjen.</p>
          </form>
          <div class="card"><div class="card-head"><h2>Mjerenja</h2></div>
            ${sw.length ? `<div class="table-wrap" style="max-height:380px;overflow-y:auto"><table><thead><tr><th>Datum</th><th>kg</th><th>Promjena</th><th>Mast %</th><th>Struk</th><th></th></tr></thead><tbody>
              ${[...sw].reverse().map((w, i, arr) => {
                const prev = arr[i + 1];
                const diff = prev ? w.weight - prev.weight : null;
                return `<tr title="${esc(w.note || '')}"><td>${shortDate(w.date)}${w.date.slice(0, 4) !== today().slice(0, 4) ? w.date.slice(0, 4) : ''}</td><td><strong>${fmt(w.weight)}</strong></td>
                  <td class="${diff > 0 ? 'up' : diff < 0 ? 'down' : 'muted'}">${diff == null ? '' : (diff > 0 ? '+' : '') + fmt(diff)}</td>
                  <td>${fmt(w.bodyFat)}</td><td>${fmt(w.waist)}</td>
                  <td style="text-align:right"><button class="icon-btn" data-act="delweight" data-id="${w.id}" title="Obriši">✕</button></td></tr>`;
              }).join('')}</tbody></table></div>` : `<div class="empty">Još nema mjerenja.</div>`}
          </div>
        </div>
        <div class="stack">
          <div class="card">
            <div class="card-head"><h2>Kilaža</h2>
              <div class="tabs">${[[30, '30 d'], [90, '3 mj'], [365, '1 g'], [0, 'Sve']].map(([v, l]) => `<button data-act="range" data-v="${v}" class="${range === v ? 'active' : ''}">${l}</button>`).join('')}</div></div>
            ${Charts.line([
              { name: 'Kilaža', color: 'var(--c1)', points: pts },
              ...(pts.length >= 5 ? [{ name: 'Prosjek 7 d', color: 'var(--c3)', points: movingAvg(pts).map(p => ({ x: p.x, y: Math.round(p.y * 10) / 10 })) }] : [])
            ], { unit: 'kg', goal: st.targetWeight, goalLabel: 'Cilj', height: 260 })}
            ${pts.length >= 5 ? `<div class="legend" style="margin-top:8px"><span><i style="background:var(--c1)"></i>Dnevno mjerenje</span><span><i style="background:var(--c3)"></i>Prosjek 7 dana (pravi trend)</span></div>` : ''}
          </div>
          ${fatPts.length ? `<div class="card"><div class="card-head"><h2>Postotak masti</h2></div>${Charts.line([{ name: 'Mast', color: 'var(--c4)', points: fatPts }], { unit: '%', height: 170 })}</div>` : ''}
          ${waistPts.length ? `<div class="card"><div class="card-head"><h2>Opseg struka</h2></div>${Charts.line([{ name: 'Struk', color: 'var(--c2)', points: waistPts }], { unit: 'cm', height: 170 })}</div>` : ''}
        </div>
      </div>`;
  }

  /* ============================================================
     ŽIVOT (navike, san, voda, raspoloženje)
     ============================================================ */
  function viewLife() {
    const st = S().settings, date = ui.lifeDate;
    const d = Store.peekDay(date) || { habits: {}, water: 0, sleep: null, steps: null, mood: null, note: '' };
    const done = S().habits.filter(h => d.habits[h.id]).length;

    const days14 = Array.from({ length: 14 }, (_, i) => addDays(date, i - 13));
    const sleepPts = days14.map(x => ({ x, y: Store.peekDay(x)?.sleep })).filter(p => p.y != null);
    const steps = days14.map(x => ({ label: shortDate(x), value: Store.peekDay(x)?.steps || 0 }));
    const moodPts = Array.from({ length: 30 }, (_, i) => addDays(date, i - 29)).map(x => ({ x, y: Store.peekDay(x)?.mood })).filter(p => p.y != null);

    const last30 = Array.from({ length: 30 }, (_, i) => addDays(today(), -i));
    const rate = (id) => Math.round(last30.filter(x => Store.peekDay(x)?.habits[id]).length / 30 * 100);

    return `
      <div class="page-head"><div><h1>Život</h1><p class="muted">${dayLabel(date)} · navike, san, voda i raspoloženje.</p></div>${dateNav('lifeDate', date)}</div>
      <div class="grid grid-2" style="align-items:start">
        <div class="stack">
          <div class="card"><div class="card-head"><h2>Navike</h2><span class="tag accent">${done} / ${S().habits.length}</span></div>
            <div class="stack" style="gap:8px">
              ${S().habits.map(h => `<div class="habit ${d.habits[h.id] ? 'done' : ''}" data-act="habit" data-id="${h.id}" role="checkbox" aria-checked="${!!d.habits[h.id]}" tabindex="0">
                <span class="check"></span><span>${esc(h.icon || '')} ${esc(h.name)}</span><span class="streak">🔥 ${habitStreak(h.id)} · ${rate(h.id)}%</span></div>`).join('') || `<div class="empty">Dodaj navike u Postavkama.</div>`}
            </div>
            <p class="hint">🔥 = dana zaredom · % = uspješnost u zadnjih 30 dana</p>
          </div>
          <div class="card">
            <div class="grid grid-2">
              <div><h3 style="margin-bottom:10px">💧 Voda</h3>
                <div class="counter"><button class="btn sm" data-act="water" data-n="-1">−</button><span class="val">${d.water || 0}</span><button class="btn sm" data-act="water" data-n="1">+</button><span class="muted small">/ ${st.waterGoal} čaša</span></div>
                <div class="bar" style="margin-top:10px"><i style="width:${Math.min(100, (d.water || 0) / st.waterGoal * 100)}%;background:var(--c2)"></i></div></div>
              <div><h3 style="margin-bottom:10px">Raspoloženje</h3>
                <div class="mood">${MOODS.map((m, i) => `<button data-act="mood" data-v="${i + 1}" class="${d.mood === i + 1 ? 'sel' : ''}" aria-label="Raspoloženje ${i + 1}">${m}</button>`).join('')}</div></div>
            </div>
            <div class="form-grid" style="margin-top:16px">
              <label class="field">😴 San (sati)<input type="number" step="0.25" min="0" max="24" inputmode="decimal" value="${d.sleep ?? ''}" data-change="daynum" data-f="sleep" placeholder="${st.sleepGoal}"></label>
              <label class="field">👟 Koraci<input type="number" min="0" inputmode="numeric" value="${d.steps ?? ''}" data-change="daynum" data-f="steps" placeholder="${st.stepsGoal}"></label>
            </div>
            <label class="field" style="margin-top:12px">📝 Dnevnik<textarea data-change="daynote" placeholder="Kako je prošao dan? Što je išlo dobro?">${esc(d.note || '')}</textarea></label>
          </div>
        </div>
        <div class="stack">
          <div class="card"><div class="card-head"><h2>San · 14 dana</h2><span class="muted small">prosjek ${sleepPts.length ? fmt(sum(sleepPts, p => p.y) / sleepPts.length) : '–'} h</span></div>
            ${Charts.line([{ name: 'San', color: 'var(--c2)', points: sleepPts }], { unit: 'h', goal: st.sleepGoal, height: 180 })}</div>
          <div class="card"><div class="card-head"><h2>Koraci · 14 dana</h2></div>
            ${Charts.bars(steps.map(s => ({ ...s, color: s.value >= st.stepsGoal ? 'var(--c1)' : 'var(--c3)' })), { goal: st.stepsGoal, height: 180 })}</div>
          <div class="card"><div class="card-head"><h2>Raspoloženje · 30 dana</h2></div>
            ${Charts.line([{ name: '', color: 'var(--c4)', points: moodPts }], { decimals: 0, height: 150 })}</div>
        </div>
      </div>`;
  }

  /* ============================================================
     POSTAVKE
     ============================================================ */
  function calcCard() {
    const st = S().settings, p = profile(), r = calcGoals(p);
    const opt = (list, cur) => list.map(([v, l]) => `<option value="${v}" ${+cur === v ? 'selected' : ''}>${l}</option>`).join('');
    return `
      <form class="card" data-form="calc" id="calc">
        <div class="card-head"><h2>🎯 Kalkulator ciljeva</h2><span class="muted small">kalorije i makronutrijenti prema tvom cilju</span></div>
        <div class="calc">
          <div>
            <div class="form-grid">
              <label class="field">Spol<select name="sex"><option value="m" ${st.sex !== 'f' ? 'selected' : ''}>Muško</option><option value="f" ${st.sex === 'f' ? 'selected' : ''}>Žensko</option></select></label>
              <label class="field">Dob (god.)<input type="number" name="age" min="14" max="100" inputmode="numeric" value="${st.age ?? ''}" required></label>
              <label class="field">Visina (cm)<input type="number" name="height" min="120" max="230" inputmode="numeric" value="${st.height ?? ''}" required></label>
            </div>
            <div class="form-grid" style="margin-top:12px">
              <label class="field">Trenutna kilaža (kg)<input type="number" name="weight" step="0.1" min="30" max="350" inputmode="decimal" value="${p.weight ?? ''}" required></label>
              <label class="field">Ciljna kilaža (kg)<input type="number" name="target" step="0.1" min="30" max="350" inputmode="decimal" value="${st.targetWeight ?? ''}" required></label>
            </div>
            <label class="field" style="margin-top:12px">Aktivnost<select name="activity">${opt(ACTIVITY, st.activity)}</select></label>
            <label class="field" style="margin-top:12px">Tempo<select name="pace">${opt(PACES, st.pace)}</select></label>
            <label class="check-label" style="margin-top:14px"><input type="checkbox" name="autoGoals" ${st.autoGoals ? 'checked' : ''}> Automatski prilagodi kalorije kad upišem novu kilažu</label>
            <div class="row" style="margin-top:14px"><button class="btn primary" type="submit">Primijeni ciljeve</button></div>
            <p class="hint">Izračun: Mifflin-St Jeor formula × razina aktivnosti, 1 kg masti ≈ 7700 kcal. Proteini ~2 g po kg ciljne mase čuvaju mišiće. Ovo je procjena — prati kilažu 2–3 tjedna i prilagodi.</p>
          </div>
          <div class="calc-out" id="calc-result">${calcResultHtml(p, r)}</div>
        </div>
      </form>`;
  }

  function syncStatusText() {
    const s = Sync.status;
    if (s.state === 'syncing') return '↻ Sinkroniziram…';
    if (s.state === 'error') return `⚠️ ${esc(s.error)}`;
    if (!s.last) return 'Još nije sinkronizirano.';
    const min = Math.round((Date.now() - s.last) / 60000);
    return `✅ Zadnja sinkronizacija: ${min < 1 ? 'upravo sada' : min < 60 ? `prije ${min} min` : new Date(s.last).toLocaleString('hr-HR', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  }

  function syncCard() {
    const head = `<div class="card-head"><h2>☁️ Sinkronizacija</h2>${window.Sync && Sync.user ? '<span class="tag accent">uključena</span>' : ''}</div>`;
    if (!window.Sync || !Sync.enabled()) return `<div class="card">${head}<p class="small muted" style="margin:0">Sinkronizacija još nije podešena.</p></div>`;
    const u = Sync.user;
    if (!u) return `
      <form class="card" data-form="login">${head}
        <p class="small muted" style="margin-top:0">Prijavi se istim računom na mobitelu i računalu — podaci se automatski spajaju i spremaju u oblak (sigurnosna kopija).</p>
        <label class="field">E-mail<input type="email" name="email" autocomplete="username" required></label>
        <label class="field" style="margin-top:10px">Lozinka<input type="password" name="password" autocomplete="current-password" minlength="6" required></label>
        <div class="row" style="margin-top:12px"><button class="btn primary" type="submit" value="in">Prijava</button><button class="btn" type="submit" value="up">Registracija</button></div>
        <div class="hint" id="sync-msg">${Sync.status.error ? '⚠️ ' + esc(Sync.status.error) : 'Prvi put? Upiši e-mail i lozinku (min. 6 znakova) i klikni Registracija. Već imaš račun? Klikni Prijava.'}</div>
      </form>`;
    return `
      <div class="card">${head}
        <p class="small" style="margin-top:0">Prijavljen: <strong>${esc(u.email)}</strong></p>
        <p class="small muted" id="sync-status">${syncStatusText()}</p>
        <div class="row"><button class="btn" data-act="syncnow">↻ Sinkroniziraj sada</button><button class="btn ghost" data-act="logout">Odjava</button></div>
        <p class="hint">Promjene se šalju automatski nekoliko sekundi nakon upisa i preuzimaju pri svakom otvaranju aplikacije.</p>
      </div>`;
  }

  function viewSettings() {
    const st = S().settings;
    const f = (name, label, attrs = '') => `<label class="field">${label}<input type="number" name="${name}" value="${st[name] ?? ''}" ${attrs}></label>`;
    return `
      <div class="page-head"><div><h1>Postavke</h1><p class="muted">Ciljevi, navike i tvoji podaci.</p></div></div>
      ${calcCard()}
      <div class="grid grid-2" style="align-items:start;margin-top:16px">
        <form class="card" data-form="settings">
          <div class="card-head"><h2>Profil i ciljevi</h2></div>
          <div class="form-grid">
            <label class="field">Ime<input name="name" value="${esc(st.name)}" placeholder="Kako da te zovem?"></label>
            ${f('workoutsPerWeek', 'Treninga tjedno', 'min="0" max="14"')}
          </div>
          <h3 style="margin:18px 0 10px">Prehrana (dnevno)</h3>
          <div class="form-grid">
            ${f('kcalGoal', 'Kalorije')}${f('proteinGoal', 'Proteini (g)')}${f('carbsGoal', 'UH (g)')}${f('fatGoal', 'Masti (g)')}
          </div>
          <p class="hint">Ove vrijednosti postavlja kalkulator iznad${st.autoGoals ? ' (i prilagođava ih pri svakoj novoj kilaži)' : ''}. Možeš ih i ručno promijeniti.</p>
          <h3 style="margin:18px 0 10px">Svakodnevno</h3>
          <div class="form-grid">
            ${f('waterGoal', 'Voda (čaše)')}${f('sleepGoal', 'San (h)', 'step="0.5"')}${f('stepsGoal', 'Koraci')}
          </div>
          <h3 style="margin:18px 0 10px">Izgled</h3>
          <select name="theme" style="max-width:220px">${[['auto', 'Automatski (sustav)'], ['light', 'Svijetla tema'], ['dark', 'Tamna tema']].map(([v, l]) => `<option value="${v}" ${st.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <div class="row" style="margin-top:18px"><button class="btn primary" type="submit">Spremi postavke</button></div>
        </form>
        <div class="stack">
          ${syncCard()}
          <div class="card"><div class="card-head"><h2>Moje navike</h2></div>
            <div class="list">${S().habits.map(h => `<div class="list-item"><span style="font-size:1.2rem">${esc(h.icon)}</span><div class="grow">${esc(h.name)}</div>
              <button class="icon-btn" data-act="delhabit" data-id="${h.id}" title="Ukloni">✕</button></div>`).join('')}</div>
            <form data-form="habit" class="row" style="margin-top:12px;flex-wrap:nowrap">
              <input name="icon" placeholder="🙂" style="width:60px;text-align:center" maxlength="4">
              <input name="name" placeholder="Nova navika, npr. Meditacija" required>
              <button class="btn" type="submit">Dodaj</button>
            </form>
          </div>
          <div class="card"><div class="card-head"><h2>Moje namirnice</h2><span class="muted small">vrijednosti na 100 g</span></div>
            ${(S().customFoods || []).length ? `<div class="list">${S().customFoods.map(f => `<div class="list-item"><div class="grow"><div class="title">${esc(f.name)}</div>
              <div class="small muted num">${fmt(f.kcal, 0)} kcal · P ${fmt(f.protein)} · UH ${fmt(f.carbs)} · M ${fmt(f.fat)}${f.portions[0] ? ` · 1 ${esc(f.portions[0].label)} = ${fmt(f.portions[0].g, 0)} g` : ''}</div></div>
              <button class="icon-btn" data-act="delfood" data-id="${f.id}" title="Ukloni">✕</button></div>`).join('')}</div>` : `<p class="small muted" style="margin-top:0">Dodaj proizvode koje često jedeš (npr. svoj omiljeni jogurt) — vrijednosti prepiši s deklaracije.</p>`}
            <form data-form="customfood" style="margin-top:12px">
              <label class="field">Naziv<input name="name" required placeholder="npr. Dukat proteinski puding"></label>
              <div class="form-grid" style="margin-top:10px">
                <label class="field">kcal / 100 g<input type="number" name="kcal" min="0" step="any" required></label>
                <label class="field">Proteini<input type="number" name="protein" min="0" step="any"></label>
                <label class="field">UH<input type="number" name="carbs" min="0" step="any"></label>
                <label class="field">Masti<input type="number" name="fat" min="0" step="any"></label>
              </div>
              <div class="form-grid" style="margin-top:10px">
                <label class="field">Porcija (naziv)<input name="portionLabel" placeholder="npr. čaša"></label>
                <label class="field">Porcija (g)<input type="number" name="portionG" min="0" step="any" placeholder="neobavezno"></label>
              </div>
              <div class="row" style="margin-top:12px"><button class="btn" type="submit">Spremi namirnicu</button></div>
            </form>
          </div>
          <div class="card"><div class="card-head"><h2>📱 Aplikacija na mobitelu</h2></div>
            ${isStandalone() ? `<p class="small" style="margin-top:0">✅ Aplikacija je instalirana i radi i bez interneta.</p>` : ''}
            ${installPrompt ? `<button class="btn primary" data-act="install">Instaliraj aplikaciju</button>` : ''}
            <p class="small muted" style="margin-bottom:0">
              <strong>Android (Chrome):</strong> izbornik ⋮ → „Instaliraj aplikaciju” / „Dodaj na početni zaslon”.<br>
              <strong>iPhone (Safari):</strong> gumb Dijeli → „Dodaj na početni zaslon”.<br>
              Podaci se spremaju posebno na svakom uređaju — za prijenos koristi Izvezi / Uvezi.</p>
          </div>
          <div class="card"><div class="card-head"><h2>Podaci</h2></div>
            <p class="small muted" style="margin-top:0">Svi podaci spremaju se samo u ovom pregledniku na ovom uređaju. Redovito napravi sigurnosnu kopiju.</p>
            <div class="row">
              <button class="btn" data-act="export">⬇ Izvezi (JSON)</button>
              <label class="btn" style="cursor:pointer">⬆ Uvezi<input type="file" accept=".json,application/json" data-change="import" hidden></label>
              <button class="btn" data-act="demo">Učitaj primjer</button>
              <button class="btn danger" data-act="reset">Obriši sve</button>
            </div>
            <p class="hint">${S().workouts.length} treninga · ${S().meals.length} obroka · ${S().weights.length} mjerenja · ${Object.keys(S().daily).length} dana u dnevniku</p>
          </div>
        </div>
      </div>`;
  }

  /* ---------- Demo podaci ---------- */
  function loadDemo() {
    const t = today();
    const st = { ...S().settings, name: S().settings.name || '', height: 182, targetWeight: 82, kcalGoal: 2300, proteinGoal: 160 };
    const weights = [], workouts = [], meals = [], daily = {};
    let w = 89.4;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const plan = [
      ['Snaga', [['Čučanj', 80, 5], ['Bench press', 65, 6], ['Veslanje s šipkom', 55, 8]]],
      ['Kardio', []],
      ['Snaga', [['Mrtvo dizanje', 100, 5], ['Potisak iznad glave', 40, 6], ['Zgibovi', 0, 6]]]
    ];
    let k = 0;
    for (let i = 70; i >= 0; i--) {
      const d = addDays(t, -i);
      w += rnd(-0.32, 0.22);
      if (Math.random() < 0.8) weights.push({ id: Store.uid(), date: d, weight: Math.round(w * 10) / 10, bodyFat: i % 7 === 0 ? Math.round((22 - (70 - i) * 0.03) * 10) / 10 : null, waist: i % 14 === 0 ? Math.round((94 - (70 - i) * 0.05) * 2) / 2 : null, note: '' });
      const wd = new Date(d + 'T12:00:00').getDay();
      if ([1, 3, 5].includes(wd) || (wd === 6 && Math.random() < .4)) {
        const [type, exs] = plan[k++ % plan.length];
        const prog = (70 - i) / 70;
        workouts.push({
          id: Store.uid(), date: d, type, duration: type === 'Kardio' ? 35 : 60, notes: '',
          exercises: exs.map(([name, base, reps]) => ({
            name, sets: Array.from({ length: 3 }, () => ({ reps: base ? reps : reps + Math.round(prog * 4), weight: base ? Math.round((base + prog * base * 0.15) / 2.5) * 2.5 : 0 }))
          }))
        });
      }
      if (i <= 20) {
        meals.push({ id: Store.uid(), date: d, slot: 'Doručak', name: 'Zobene pahuljice s bananom', kcal: 450, protein: 18, carbs: 72, fat: 9 });
        meals.push({ id: Store.uid(), date: d, slot: 'Ručak', name: i % 2 ? 'Piletina s rižom' : 'Tjestenina bolonjez', kcal: i % 2 ? 680 : 760, protein: i % 2 ? 52 : 38, carbs: 80, fat: i % 2 ? 14 : 24 });
        meals.push({ id: Store.uid(), date: d, slot: 'Užina', name: 'Grčki jogurt', kcal: 180, protein: 17, carbs: 8, fat: 9 });
        if (i > 0) meals.push({ id: Store.uid(), date: d, slot: 'Večera', name: 'Losos i povrće', kcal: Math.round(rnd(550, 800)), protein: 40, carbs: 30, fat: 28 });
      }
      if (i <= 30 && i > 0) {
        const hb = {};
        S().habits.forEach(h => { if (Math.random() < 0.7) hb[h.id] = true; });
        daily[d] = { habits: hb, water: Math.round(rnd(4, 10)), sleep: Math.round(rnd(6, 8.75) * 4) / 4, steps: Math.round(rnd(4000, 14000)), mood: Math.ceil(rnd(2.5, 5)), note: '' };
      }
    }
    Store.replace({ ...S(), settings: st, weights, workouts, meals, daily: { ...daily, ...S().daily } });
    toast('Primjer podataka učitan');
    render();
  }

  /* ---------- Ruter ---------- */
  const routes = { '': viewDashboard, trening: viewTraining, prehrana: viewFood, tijelo: viewBody, zivot: viewLife, postavke: viewSettings };
  const route = () => location.hash.replace(/^#\/?/, '').split('/')[0];

  function render() {
    const r = route();
    const fn = routes[r] || viewDashboard;
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === (routes[r] ? r : '')));
    Charts.clear();
    ui.selFood = null; // forma za obrok se iscrtava iznova
    $view.innerHTML = fn();
    Charts.renderAll($view);
  }

  function applyTheme() {
    const t = S().settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  /* ---------- Događaji ---------- */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) hideSuggest();
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const a = el.dataset.act, id = el.dataset.id;
    const st = S();
    switch (a) {
      case 'day': ui[el.dataset.key] = addDays(ui[el.dataset.key], +el.dataset.n); break;
      case 'today': ui[el.dataset.key] = today(); break;
      case 'demo':
        if (st.workouts.length || st.weights.length || st.meals.length) {
          if (!confirm('Ovo će zamijeniti tvoje treninge, obroke i mjerenja primjerom. Nastaviti?')) return;
        }
        return loadDemo();
      // Trening
      case 'addex': syncDraft(); ui.draft.exercises.push({ name: '', sets: [{ reps: '', weight: '' }] }); break;
      case 'rmex': syncDraft(); ui.draft.exercises.splice(+el.dataset.i, 1); break;
      case 'addset': {
        syncDraft();
        const sets = ui.draft.exercises[+el.dataset.i].sets;
        const last = sets[sets.length - 1] || { reps: '', weight: '' };
        sets.push({ ...last });
        break;
      }
      case 'rmset': syncDraft(); ui.draft.exercises[+el.dataset.i].sets.splice(+el.dataset.j, 1); break;
      case 'cleardraft': ui.draft = newDraft(); break;
      case 'rest': startRest(+el.dataset.s); return;
      case 'restadd': {
        timer.end = Math.max(timer.end, Date.now()) + 30000;
        const tEl = document.getElementById('timer'); tEl.classList.remove('done'); tEl.hidden = false;
        clearInterval(timer.iv); timer.iv = setInterval(tickRest, 250); tickRest(); return;
      }
      case 'reststop': clearInterval(timer.iv); timer.end = 0; document.getElementById('timer').hidden = true; return;
      case 'filllast': {
        e.preventDefault(); syncDraft();
        const ex = ui.draft.exercises[+el.dataset.i];
        const l = lastSession(ex.name);
        if (l) ex.sets = l.sets.map(s => ({ reps: s.reps, weight: s.weight }));
        break;
      }
      case 'loadtpl': {
        const t = st.templates.find(x => x.id === id);
        syncDraft();
        ui.draft = {
          date: ui.draft.date || today(), type: t.type, duration: '', notes: '',
          exercises: t.exercises.map(ex => {
            const l = lastSession(ex.name);
            return { name: ex.name, sets: (l ? l.sets : ex.sets).map(s => ({ reps: s.reps, weight: s.weight })) };
          })
        };
        toast(`Predložak „${t.name}” učitan`);
        break;
      }
      case 'savetpl': {
        syncDraft();
        const exs = ui.draft.exercises.filter(ex => ex.name.trim());
        if (!exs.length) { alert('Dodaj barem jednu vježbu s imenom.'); return; }
        const name = prompt('Ime predloška (npr. Push, Gornji dio, Full body):');
        if (!name || !name.trim()) return;
        st.templates.push({ id: Store.uid(), name: name.trim(), type: ui.draft.type,
          exercises: exs.map(ex => ({ name: ex.name.trim(), sets: ex.sets.map(s => ({ reps: num(s.reps) || '', weight: '' })) })) });
        Store.save(); toast('Predložak spremljen'); break;
      }
      case 'deltpl':
        if (!confirm('Obrisati ovaj predložak?')) return;
        st.templates = st.templates.filter(t => t.id !== id); Store.save(); break;
      case 'install':
        if (!installPrompt) return;
        installPrompt.prompt();
        installPrompt.userChoice.finally(() => { installPrompt = null; render(); });
        return;
      case 'repeatworkout': {
        const w = st.workouts.find(x => x.id === id);
        ui.draft = { date: today(), type: w.type, duration: w.duration ?? '', notes: '', exercises: structuredClone(w.exercises.length ? w.exercises : newDraft().exercises) };
        render(); window.scrollTo({ top: 0, behavior: 'smooth' }); toast('Trening kopiran — prilagodi i spremi');
        return;
      }
      case 'delworkout':
        if (!confirm('Obrisati ovaj trening?')) return;
        st.workouts = st.workouts.filter(w => w.id !== id); Store.save(); toast('Trening obrisan'); break;
      // Prehrana
      case 'quickmeal': {
        const m = st.meals.find(x => x.id === id);
        const slot = $view.querySelector('form[data-form="meal"] [name="slot"]')?.value || m.slot;
        st.meals.push({ ...m, id: Store.uid(), date: ui.foodDate, slot }); Store.save(); toast(`Dodano: ${m.name}`); break;
      }
      case 'pickfood': pickSuggestion(+el.dataset.i); return;
      case 'portion': {
        const form = mealForm();
        form.grams.value = el.dataset.g; recalcMeal(); return;
      }
      case 'delfood':
        if (!confirm('Ukloniti ovu namirnicu iz tvoje baze? Upisani obroci ostaju.')) return;
        st.customFoods = st.customFoods.filter(f => f.id !== id); Store.save(); break;
      case 'copyday': {
        const src = mealsOn(addDays(ui.foodDate, -1));
        src.forEach(m => st.meals.push({ ...m, id: Store.uid(), date: ui.foodDate }));
        Store.save(); toast(`Kopirano ${src.length} unosa`); break;
      }
      case 'savemeal': {
        const items = mealsOn(ui.foodDate).filter(m => m.slot === el.dataset.slot);
        const name = prompt('Ime obroka (npr. Moj doručak):', `Moj ${el.dataset.slot.toLowerCase()}`);
        if (!name || !name.trim()) return;
        st.savedMeals.push({ id: Store.uid(), name: name.trim(),
          items: items.map(({ name, grams, foodId, kcal, protein, carbs, fat }) => ({ name, grams, foodId, kcal, protein, carbs, fat })) });
        Store.save(); toast('Obrok spremljen za brzo dodavanje'); break;
      }
      case 'addsaved': {
        const sm = st.savedMeals.find(x => x.id === id);
        const slot = mealForm()?.slot.value || 'Doručak';
        sm.items.forEach(it => st.meals.push({ ...it, id: Store.uid(), date: ui.foodDate, slot }));
        Store.save(); toast(`Dodano: ${sm.name} (${slot})`); break;
      }
      case 'delsaved':
        if (!confirm('Obrisati spremljeni obrok?')) return;
        st.savedMeals = st.savedMeals.filter(x => x.id !== id); Store.save(); break;
      case 'delmeal': st.meals = st.meals.filter(m => m.id !== id); Store.save(); break;
      // Tijelo
      case 'range': ui.weightRange = +el.dataset.v; break;
      case 'repweek': {
        const cur = weekStart(today());
        const next = addDays(ui.reportWeek || addDays(cur, -7), +el.dataset.n);
        ui.reportWeek = next > cur ? cur : next;
        break;
      }
      case 'delweight':
        if (!confirm('Obrisati ovo mjerenje?')) return;
        st.weights = st.weights.filter(w => w.id !== id); Store.save(); break;
      // Život
      case 'habit': { const d = Store.day(ui.lifeDate); d.habits[id] = !d.habits[id]; Store.save(); break; }
      case 'water': { const d = Store.day(ui.lifeDate); d.water = Math.max(0, (d.water || 0) + +el.dataset.n); Store.save(); break; }
      case 'mood': { const d = Store.day(ui.lifeDate); const v = +el.dataset.v; d.mood = d.mood === v ? null : v; Store.save(); break; }
      // Postavke
      case 'delhabit':
        if (!confirm('Ukloniti ovu naviku? Povijest ostaje spremljena.')) return;
        st.habits = st.habits.filter(h => h.id !== id); Store.save(); break;
      case 'export': {
        const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = Object.assign(document.createElement('a'), { href: url, download: `moj-napredak-${today()}.json` });
        document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
        toast('Sigurnosna kopija preuzeta'); return;
      }
      case 'syncnow': Sync.sync(); return;
      case 'logout':
        if (!confirm('Odjaviti se? Podaci ostaju na ovom uređaju i u oblaku.')) return;
        Sync.signOut().then(render); return;
      case 'reset':
        if (!confirm('Sigurno obrisati SVE podatke? Ovo se ne može poništiti.')) return;
        Store.reset(); applyTheme(); toast('Svi podaci obrisani'); break;
      default: return;
    }
    render();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('[data-search="food"]')) {
      const box = document.getElementById('suggest');
      const open = box && !box.hidden && ui.sug.length;
      if (e.key === 'Escape') { hideSuggest(); return; }
      if (!open) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        ui.sugIdx = (ui.sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + ui.sug.length) % ui.sug.length;
        box.querySelectorAll('button').forEach((b, i) => b.classList.toggle('hl', i === ui.sugIdx));
        box.querySelector('.hl')?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault(); pickSuggestion(Math.max(0, ui.sugIdx));
      }
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.habit')) { e.preventDefault(); e.target.click(); }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    const c = el.dataset.change;
    if (!c) return;
    switch (c) {
      case 'setdate': if (el.value) { ui[el.dataset.key] = el.value; render(); } return;
      case 'exercise': ui.exercise = el.value; render(); return;
      case 'daynum': { const d = Store.day(ui.lifeDate); d[el.dataset.f] = num(el.value); Store.save(); toast('Spremljeno'); render(); return; }
      case 'daynote': { const d = Store.day(ui.lifeDate); d.note = el.value; Store.save(); toast('Dnevnik spremljen'); return; }
      case 'import': {
        const file = el.files[0]; if (!file) return;
        file.text().then(txt => {
          const data = JSON.parse(txt);
          if (!data || typeof data !== 'object' || !Array.isArray(data.workouts)) throw new Error('format');
          if (!confirm('Uvoz će zamijeniti sve trenutne podatke. Nastaviti?')) return;
          Store.replace(data); applyTheme(); toast('Podaci uvezeni'); render();
        }).catch(() => alert('Datoteka nije valjana sigurnosna kopija.'));
        return;
      }
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    const kind = form.dataset.form;
    if (!kind) return;
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    const st = S();
    switch (kind) {
      case 'workout': {
        syncDraft();
        const d = ui.draft;
        const exercises = d.exercises
          .map(ex => ({ name: ex.name.trim(), sets: ex.sets.map(s => ({ reps: num(s.reps) || 0, weight: num(s.weight) || 0 })).filter(s => s.reps > 0) }))
          .filter(ex => ex.name && ex.sets.length);
        if (!exercises.length && !num(d.duration)) { alert('Dodaj barem jednu vježbu sa setom ili upiši trajanje.'); return; }
        st.workouts.push({ id: Store.uid(), date: d.date || today(), type: d.type, duration: num(d.duration), notes: d.notes.trim(), exercises });
        Store.save();
        // Novi rekord?
        const prs = exercises.filter(ex => {
          const top = Math.max(...ex.sets.map(s => s.weight));
          if (!top) return false;
          const before = st.workouts.slice(0, -1).flatMap(w => w.exercises.filter(e2 => e2.name.trim() === ex.name).flatMap(e2 => e2.sets.map(s => s.weight)));
          return before.length && top > Math.max(...before);
        });
        ui.draft = newDraft();
        toast(prs.length ? `🏆 Novi rekord: ${prs.map(p => p.name).join(', ')}!` : 'Trening spremljen 💪');
        break;
      }
      case 'meal': {
        const grams = num(fd.grams);
        const meal = { id: Store.uid(), date: ui.foodDate, slot: fd.slot, name: fd.name.trim(), grams, foodId: ui.selFood?.id || null,
          kcal: num(fd.kcal) || 0, protein: num(fd.protein) || 0, carbs: num(fd.carbs) || 0, fat: num(fd.fat) || 0 };
        let msg = 'Obrok dodan';
        if (fd.saveCustom && !ui.selFood) {
          if (!grams) { alert('Za spremanje u moje namirnice upiši i količinu u gramima (da se izračuna vrijednost na 100 g).'); return; }
          const k = 100 / grams;
          const cf = { id: 'u' + Store.uid(), name: meal.name, kcal: Math.round(meal.kcal * k), protein: r1(meal.protein * k), carbs: r1(meal.carbs * k), fat: r1(meal.fat * k), portions: [{ label: 'porcija', g: grams }] };
          st.customFoods = (st.customFoods || []).filter(f => norm(f.name) !== norm(cf.name));
          st.customFoods.push(cf);
          meal.foodId = cf.id;
          msg = 'Obrok dodan i spremljen u tvoje namirnice';
        }
        st.meals.push(meal);
        ui.selFood = null;
        Store.save(); toast(msg);
        break;
      }
      case 'login': {
        const mode = e.submitter?.value || 'in';
        const msg = form.querySelector('#sync-msg');
        const btns = form.querySelectorAll('button');
        btns.forEach(b => b.disabled = true);
        msg.textContent = mode === 'up' ? 'Registriram…' : 'Prijavljujem…';
        const email = fd.email.trim(), pass = fd.password;
        (mode === 'up' ? Sync.signUp(email, pass) : Sync.signIn(email, pass))
          .then(r => {
            if (mode === 'up' && r && !r.confirmed) {
              msg.innerHTML = '✉️ Poslali smo ti e-mail. <strong>Klikni link u njemu</strong>, a zatim se vrati ovdje i klikni <strong>Prijava</strong>. (Ako nema maila, provjeri neželjenu poštu.)';
              btns.forEach(b => b.disabled = false);
            } else { toast('✅ Prijavljen — podaci se sinkroniziraju'); render(); }
          })
          .catch(err => { msg.textContent = '⚠️ ' + err.message; btns.forEach(b => b.disabled = false); });
        return;
      }
      case 'customfood': {
        const g = num(fd.portionG);
        st.customFoods = (st.customFoods || []).filter(f => norm(f.name) !== norm(fd.name.trim()));
        st.customFoods.push({ id: 'u' + Store.uid(), name: fd.name.trim(), kcal: num(fd.kcal) || 0, protein: num(fd.protein) || 0, carbs: num(fd.carbs) || 0, fat: num(fd.fat) || 0,
          portions: g ? [{ label: fd.portionLabel.trim() || 'porcija', g }] : [] });
        Store.save(); toast('Namirnica spremljena');
        break;
      }
      case 'weight': {
        const entry = { id: Store.uid(), date: fd.date, weight: num(fd.weight), bodyFat: num(fd.bodyFat), waist: num(fd.waist), note: fd.note.trim() };
        st.weights = st.weights.filter(w => w.date !== fd.date);
        st.weights.push(entry);
        let msg = 'Mjerenje spremljeno';
        if (st.settings.autoGoals) {
          const before = st.settings.kcalGoal;
          const r = calcGoals(profile());
          if (r) { applyGoals(r); if (r.kcal !== before) msg = `Spremljeno · novi cilj ${fmt(r.kcal, 0)} kcal`; }
        }
        Store.save(); toast(msg);
        break;
      }
      case 'calc': {
        const p = readCalcForm(form), r = calcGoals(p);
        if (!r) { alert('Upiši dob, visinu, trenutnu i ciljnu kilažu.'); return; }
        const s = st.settings;
        s.sex = p.sex; s.age = p.age; s.height = p.height; s.targetWeight = p.target; s.activity = p.activity; s.pace = p.pace;
        s.autoGoals = !!fd.autoGoals;
        const lw = latestWeight();
        if (!lw || (lw.weight !== p.weight)) {
          // nova trenutna kilaža → upiši mjerenje za danas
          st.weights = st.weights.filter(w => w.date !== today());
          st.weights.push({ id: Store.uid(), date: today(), weight: p.weight, bodyFat: null, waist: null, note: '' });
        }
        applyGoals(r);
        Store.save(); toast(`Ciljevi postavljeni: ${fmt(r.kcal, 0)} kcal`);
        break;
      }
      case 'settings': {
        const s = st.settings;
        s.name = fd.name.trim(); s.theme = fd.theme;
        for (const k of ['workoutsPerWeek', 'kcalGoal', 'proteinGoal', 'carbsGoal', 'fatGoal', 'waterGoal', 'sleepGoal', 'stepsGoal']) s[k] = num(fd[k]);
        Store.save(); applyTheme(); toast('Postavke spremljene');
        break;
      }
      case 'habit':
        st.habits.push({ id: Store.uid(), name: fd.name.trim(), icon: fd.icon.trim() || '✅' });
        Store.save(); toast('Navika dodana');
        break;
    }
    render();
  });

  // Zadrži nacrt treninga dok tipkaš (da se ne izgubi pri promjeni stranice)
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.closest('form[data-form="workout"]')) syncDraft();
    if (t.matches('[data-f="name"][data-ex]')) { const h = $view.querySelector(`[data-last="${t.dataset.ex}"]`); if (h) h.innerHTML = lastHtml(t.value, t.dataset.ex); }
    if (t.matches('[data-search="food"]')) {
      if (ui.selFood && t.value !== ui.selFood.name) { ui.selFood = null; updateFoodSel(); }
      renderSuggest(t);
    }
    if (t.matches('[data-grams]')) recalcMeal();
    const cf = t.closest('form[data-form="calc"]');
    if (cf) { const p = readCalcForm(cf); document.getElementById('calc-result').innerHTML = calcResultHtml(p, calcGoals(p)); }
  });
  document.addEventListener('focusin', (e) => { if (e.target.matches('[data-search="food"]') && e.target.value.trim() && !ui.selFood) renderSuggest(e.target); });

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  applyTheme();
  render();

  if (window.Sync) {
    Sync.onChange((changed) => {
      if (Sync.status.notice) { toast(Sync.status.notice); Sync.status.notice = null; }
      const el = document.getElementById('sync-status');
      if (el) el.innerHTML = syncStatusText();
      const a = document.activeElement;
      if ($view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'submit') return; // ne prekidaj tipkanje
      const shownLoggedIn = !!document.getElementById('sync-status');
      if (changed || (route() === 'postavke' && shownLoggedIn !== !!Sync.user)) { applyTheme(); render(); }
    });
    Sync.start();
  }
})();
