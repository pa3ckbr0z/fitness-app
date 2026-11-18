/* Spremanje podataka u localStorage preglednika (sve ostaje na tvom računalu). */
(function () {
  const KEY = 'mojNapredak.v1';

  const DEFAULT = {
    settings: {
      name: '',
      height: 180,          // cm
      targetWeight: null,   // kg
      kcalGoal: 2400,
      proteinGoal: 150,     // g
      carbsGoal: 260,
      fatGoal: 75,
      waterGoal: 8,         // čaše
      sleepGoal: 8,         // sati
      stepsGoal: 10000,
      workoutsPerWeek: 4,
      program: {},        // tjedni plan: { '1': 't1', ... } dan u tjednu (0=ned) → id predloška
      increment: 2.5,     // kg za progresiju
      theme: 'auto',
      // Kalkulator ciljeva
      sex: 'm',
      age: null,
      activity: 1.55,
      pace: 0.5,          // kg tjedno
      autoGoals: true     // prilagodi kalorije pri svakoj novoj kilaži
    },
    weights: [],   // {id, date, weight, bodyFat, waist, note}
    workouts: [],  // {id, date, type, duration, exercises:[{name, sets:[{reps, weight}]}], notes}
    meals: [],     // {id, date, slot, name, grams, foodId, kcal, protein, carbs, fat}
    customFoods: [], // {id, name, kcal, protein, carbs, fat, portions:[{label,g}]} — vrijednosti na 100 g
    habits: [
      { id: 'h1', name: 'Bez slatkiša', icon: '🍫' },
      { id: 'h2', name: 'Istezanje 10 min', icon: '🧘' },
      { id: 'h3', name: 'Čitanje 20 min', icon: '📖' },
      { id: 'h4', name: 'Bez alkohola', icon: '🚫' }
    ],
    templates: [   // predlošci treninga
      { id: 't1', name: 'Push', type: 'Snaga', exercises: [
        { name: 'Bench press', sets: [{ reps: 8, weight: '' }, { reps: 8, weight: '' }, { reps: 8, weight: '' }] },
        { name: 'Potisak iznad glave', sets: [{ reps: 8, weight: '' }, { reps: 8, weight: '' }, { reps: 8, weight: '' }] },
        { name: 'Kosi potisak s bučicama', sets: [{ reps: 10, weight: '' }, { reps: 10, weight: '' }, { reps: 10, weight: '' }] },
        { name: 'Triceps na sajli', sets: [{ reps: 12, weight: '' }, { reps: 12, weight: '' }, { reps: 12, weight: '' }] }] },
      { id: 't2', name: 'Pull', type: 'Snaga', exercises: [
        { name: 'Zgibovi', sets: [{ reps: 8, weight: 0 }, { reps: 8, weight: 0 }, { reps: 8, weight: 0 }] },
        { name: 'Veslanje s šipkom', sets: [{ reps: 8, weight: '' }, { reps: 8, weight: '' }, { reps: 8, weight: '' }] },
        { name: 'Lat pulldown', sets: [{ reps: 10, weight: '' }, { reps: 10, weight: '' }, { reps: 10, weight: '' }] },
        { name: 'Biceps pregib', sets: [{ reps: 12, weight: '' }, { reps: 12, weight: '' }, { reps: 12, weight: '' }] }] },
      { id: 't3', name: 'Noge', type: 'Snaga', exercises: [
        { name: 'Čučanj', sets: [{ reps: 5, weight: '' }, { reps: 5, weight: '' }, { reps: 5, weight: '' }] },
        { name: 'Rumunjsko mrtvo dizanje', sets: [{ reps: 8, weight: '' }, { reps: 8, weight: '' }, { reps: 8, weight: '' }] },
        { name: 'Iskoraci', sets: [{ reps: 10, weight: '' }, { reps: 10, weight: '' }, { reps: 10, weight: '' }] },
        { name: 'Podizanje na prste', sets: [{ reps: 15, weight: '' }, { reps: 15, weight: '' }, { reps: 15, weight: '' }] }] }
    ],
    savedMeals: [], // {id, name, items:[{name, grams, foodId, kcal, protein, carbs, fat}]}
    daily: {}      // 'YYYY-MM-DD': {habits:{id:true}, water, sleep, steps, mood, note}
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULT);
      const data = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT),
        ...data,
        settings: { ...DEFAULT.settings, ...(data.settings || {}) }
      };
    } catch (e) {
      console.warn('Ne mogu učitati podatke', e);
      return structuredClone(DEFAULT);
    }
  }

  let state = load();

  // Oznaka vremena promjene postavki (za sinkronizaciju između uređaja)
  const settingsSig = (st) => { const { _t, ...rest } = st; return JSON.stringify(rest); };
  let lastSettings = settingsSig(state.settings);
  const listeners = [];

  function save(opts = {}) {
    const sig = settingsSig(state.settings);
    if (sig !== lastSettings) { state.settings._t = Date.now(); lastSettings = sig; }
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('Ne mogu spremiti podatke', e); }
    if (!opts.silent) listeners.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } });
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  window.Store = {
    get state() { return state; },
    save,
    uid,
    onSave(fn) { listeners.push(fn); },
    day(date) {
      if (!state.daily[date]) state.daily[date] = { habits: {}, water: 0, sleep: null, steps: null, mood: null, note: '' };
      state.daily[date]._t = Date.now(); // day() se poziva samo prije izmjene
      return state.daily[date];
    },
    peekDay(date) { return state.daily[date] || null; },
    replace(data, opts = {}) {
      state = { ...structuredClone(DEFAULT), ...data, settings: { ...DEFAULT.settings, ...(data.settings || {}) } };
      if (opts.silent) lastSettings = settingsSig(state.settings); // ne mijenjaj oznaku vremena kod spajanja
      save(opts);
    },
    reset() { state = structuredClone(DEFAULT); save(); },
    exportJSON() { return JSON.stringify(state, null, 2); }
  };
})();
