/* Sinkronizacija između uređaja preko Supabasea (bez vanjskih biblioteka).
   Svi podaci jednog korisnika spremaju se kao jedan JSON redak u tablici app_state.
   Spajanje: kolekcije se spajaju po id-u (brisanja se prepoznaju preko popisa id-eva
   iz zadnje sinkronizacije), dnevni unosi i postavke po vremenu zadnje izmjene. */
(function () {
  const CFG = window.SYNC_CONFIG || {};
  const SKEY = 'mojNapredak.session';
  const BKEY = 'mojNapredak.syncBase';
  const LKEY = 'mojNapredak.lastSync';
  const COLS = ['weights', 'workouts', 'meals', 'customFoods', 'templates', 'savedMeals', 'habits'];

  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let session = read(SKEY);
  const status = { state: 'idle', error: null, last: read(LKEY) };
  const listeners = [];
  const emit = (dataChanged = false) => listeners.forEach(fn => { try { fn(dataChanged); } catch (e) { console.warn(e); } });

  const enabled = () => !!(CFG.url && CFG.anonKey);

  function errMsg(data, code) {
    const m = data && (data.msg || data.error_description || data.message || data.error);
    const map = {
      'Invalid login credentials': 'Pogrešan e-mail ili lozinka.',
      'Email not confirmed': 'E-mail još nije potvrđen — klikni link koji smo ti poslali.',
      'User already registered': 'Taj e-mail je već registriran — prijavi se.'
    };
    if (m && map[m]) return map[m];
    if (m && /Password should be at least/i.test(m)) return 'Lozinka mora imati barem 6 znakova.';
    if (m && /rate limit/i.test(m)) return 'Previše pokušaja — pričekaj malo pa probaj ponovno.';
    return m || `Greška (${code})`;
  }

  async function call(path, opts = {}, auth = true) {
    const headers = { apikey: CFG.anonKey, 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (auth) { await ensureFresh(); headers.Authorization = 'Bearer ' + session.access_token; }
    const res = await fetch(CFG.url + path, { ...opts, headers });
    const txt = await res.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!res.ok) { const err = new Error(errMsg(data, res.status)); err.status = res.status; throw err; }
    return data;
  }

  function setSession(s) {
    if (s && s.access_token) {
      session = {
        access_token: s.access_token, refresh_token: s.refresh_token,
        expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (+s.expires_in || 3600),
        user: s.user ? { id: s.user.id, email: s.user.email } : session?.user
      };
    } else session = null;
    write(SKEY, session);
  }

  async function ensureFresh() {
    if (!session) throw new Error('Nisi prijavljen.');
    if (session.expires_at * 1000 - 60000 > Date.now()) return;
    try {
      const s = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) }, false);
      setSession(s);
    } catch (e) {
      if (e.status === 400 || e.status === 401) { setSession(null); emit(); throw new Error('Prijava je istekla — prijavi se ponovno.'); }
      throw e;
    }
  }

  const redirectUrl = () => location.origin + location.pathname;

  async function signUp(email, password) {
    const s = await call(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectUrl())}`, { method: 'POST', body: JSON.stringify({ email, password }) }, false);
    if (s && s.access_token) { setSession(s); await sync(); return { confirmed: true }; }
    return { confirmed: false };
  }

  async function signIn(email, password) {
    const s = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
    setSession(s);
    write(BKEY, null); // novi korisnik na ovom uređaju → sve lokalno je "novo" i spaja se
    emit();
    await sync();
  }

  async function signOut() {
    try { if (session) await call('/auth/v1/logout', { method: 'POST' }); } catch (e) {}
    setSession(null); write(BKEY, null); write(LKEY, null);
    status.last = null; status.state = 'idle'; status.error = null;
    emit();
  }

  // Potvrda e-maila vraća korisnika na stranicu s tokenima u #hashu
  async function consumeRedirect() {
    const h = location.hash;
    if (!/access_token=|error_description=/.test(h)) return false;
    const p = new URLSearchParams(h.replace(/^#\/?/, ''));
    history.replaceState(null, '', location.pathname + '#/postavke');
    if (p.get('error_description')) { status.error = p.get('error_description').replace(/\+/g, ' '); emit(); return true; }
    setSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in'), expires_at: +p.get('expires_at') || undefined });
    try {
      const u = await call('/auth/v1/user');
      session.user = { id: u.id, email: u.email }; write(SKEY, session);
      write(BKEY, null);
      await sync();
    } catch (e) { status.error = e.message; emit(); }
    return true;
  }

  /* ---------- Spajanje ---------- */
  function merge(L, R, base) {
    const out = { ...R, ...L };
    for (const c of COLS) {
      const b = new Set(base?.[c] || []);
      const lm = new Map((L[c] || []).map(x => [x.id, x]));
      const rm = new Map((R[c] || []).map(x => [x.id, x]));
      const res = [];
      for (const [id, x] of lm) if (rm.has(id) || !b.has(id)) res.push(x);          // obrisano na drugom uređaju → izbaci
      for (const [id, x] of rm) if (!lm.has(id) && !b.has(id)) res.push(x);          // novo s drugog uređaja → dodaj
      out[c] = res;
    }
    // jedno mjerenje kilaže po datumu
    const byDate = new Map();
    for (const w of out.weights) if (!byDate.has(w.date) || L.weights?.some(x => x.id === w.id)) byDate.set(w.date, w);
    out.weights = [...byDate.values()];
    // dnevni unosi: novija izmjena pobjeđuje
    out.daily = { ...(R.daily || {}) };
    for (const [d, v] of Object.entries(L.daily || {})) {
      const r = out.daily[d];
      if (!r || (v._t || 0) >= (r._t || 0)) out.daily[d] = v;
    }
    out.settings = (L.settings?._t || 0) >= (R.settings?._t || 0) ? L.settings : R.settings;
    return out;
  }

  const idsOf = (st) => Object.fromEntries(COLS.map(c => [c, (st[c] || []).map(x => x.id)]));

  let running = null, again = false;
  async function sync() {
    if (!enabled() || !session) return;
    if (running) { again = true; return running; }
    running = (async () => {
      let changed = false;
      status.state = 'syncing'; status.error = null; emit();
      try {
        await ensureFresh();
        const uid = session.user.id;
        const rows = await call(`/rest/v1/app_state?select=data&user_id=eq.${uid}`);
        const remote = rows && rows[0] ? rows[0].data : null;
        const local = Store.state;
        const merged = remote ? merge(local, remote, read(BKEY)) : local;
        if (remote && JSON.stringify(merged) !== JSON.stringify(local)) { Store.replace(merged, { silent: true }); changed = true; }
        await call('/rest/v1/app_state?on_conflict=user_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ user_id: uid, data: Store.state, updated_at: new Date().toISOString() })
        });
        write(BKEY, idsOf(Store.state));
        status.last = Date.now(); write(LKEY, status.last);
        status.state = 'ok';
      } catch (e) {
        status.state = 'error';
        status.error = navigator.onLine === false ? 'Nema interneta — sinkronizirat ću kad se spojiš.' : e.message;
      }
      emit(changed);
    })();
    try { await running; } finally {
      running = null;
      if (again) { again = false; sync(); }
    }
  }

  // Automatski: nakon svake promjene (s malom odgodom), pri otvaranju i kad se vrati internet
  let t;
  Store.onSave(() => { if (!session) return; clearTimeout(t); t = setTimeout(sync, 2500); });
  window.addEventListener('online', () => sync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session && Date.now() - (status.last || 0) > 30000) sync();
  });

  window.Sync = {
    enabled, status,
    get user() { return session?.user || null; },
    signUp, signIn, signOut, sync,
    onChange(fn) { listeners.push(fn); },
    async start() {
      if (!enabled()) return;
      if (await consumeRedirect()) return;
      if (session) sync();
    }
  };
})();
