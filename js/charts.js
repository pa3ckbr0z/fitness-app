/* Jednostavni SVG grafovi bez vanjskih biblioteka. */
(function () {
  const specs = new Map();
  let seq = 0;

  function niceRange(min, max, pad = 0.1) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    return [min - span * pad, max + span * pad];
  }

  function ticks(min, max, count = 4) {
    const step = (max - min) / count;
    return Array.from({ length: count + 1 }, (_, i) => min + step * i);
  }

  const fmt = (v, d = 1) => Number(v).toLocaleString('hr-HR', { maximumFractionDigits: d });
  const shortDate = (iso) => { const [, m, d] = iso.split('-'); return `${+d}.${+m}.`; };

  /**
   * Linijski graf.
   * series: [{name, color, points:[{x:'YYYY-MM-DD', y:Number}]}]
   * opts: {height, goal, goalLabel, unit, decimals}
   */
  function lineSVG(series, opts, W) {
    const H = opts.height || 220;
    const P = { t: 12, r: 14, b: 26, l: 42 };
    const all = series.flatMap(s => s.points);
    if (all.length === 0) return `<div class="empty">Još nema podataka za graf.</div>`;

    const xs = [...new Set(all.map(p => p.x))].sort();
    const t0 = Date.parse(xs[0]), t1 = Date.parse(xs[xs.length - 1]);
    const ys = all.map(p => p.y);
    if (opts.goal != null) ys.push(opts.goal);
    const [yMin, yMax] = niceRange(Math.min(...ys), Math.max(...ys));

    const sx = (x) => t1 === t0 ? P.l + (W - P.l - P.r) / 2 : P.l + (Date.parse(x) - t0) / (t1 - t0) * (W - P.l - P.r);
    const sy = (y) => P.t + (1 - (y - yMin) / (yMax - yMin)) * (H - P.t - P.b);

    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
    for (const tv of ticks(yMin, yMax)) {
      const y = sy(tv);
      svg += `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/>`;
      svg += `<text class="axis-label" x="${P.l - 8}" y="${y + 4}" text-anchor="end">${fmt(tv, opts.decimals ?? 1)}</text>`;
    }
    const labelIdx = xs.length <= 6 ? xs.map((_, i) => i) : [0, Math.floor(xs.length / 3), Math.floor(2 * xs.length / 3), xs.length - 1];
    for (const i of labelIdx) {
      svg += `<text class="axis-label" x="${sx(xs[i])}" y="${H - 6}" text-anchor="middle">${shortDate(xs[i])}</text>`;
    }
    if (opts.goal != null) {
      const gy = sy(opts.goal);
      svg += `<line class="goal" x1="${P.l}" x2="${W - P.r}" y1="${gy}" y2="${gy}"/>`;
      svg += `<text class="goal-label" x="${W - P.r}" y="${gy - 5}" text-anchor="end">${opts.goalLabel || 'Cilj'}</text>`;
    }
    for (const s of series) {
      const pts = [...s.points].sort((a, b) => a.x.localeCompare(b.x));
      if (!pts.length) continue;
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
      svg += `<path class="line" d="${d}" stroke="${s.color}" vector-effect="non-scaling-stroke"/>`;
      if (pts.length <= 40) {
        for (const p of pts) svg += `<circle class="dot" cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.5" fill="${s.color}" vector-effect="non-scaling-stroke"/>`;
      }
      for (const p of pts) {
        svg += `<circle class="hit" cx="${sx(p.x)}" cy="${sy(p.y)}" r="12" data-tip="${s.name ? s.name + ': ' : ''}${fmt(p.y, opts.decimals ?? 1)}${opts.unit ? ' ' + opts.unit : ''} · ${shortDate(p.x)}"/>`;
      }
    }
    svg += `</svg>`;
    return `<div class="chart-wrap">${svg}<div class="tooltip"></div></div>`;
  }

  /**
   * Stupčasti graf.
   * bars: [{label, value, color?}], opts: {height, goal, unit}
   */
  function barsSVG(data, opts, W) {
    const H = opts.height || 200;
    const P = { t: 12, r: 10, b: 26, l: 42 };
    if (!data.length) return `<div class="empty">Još nema podataka.</div>`;
    const max = Math.max(1, ...data.map(d => d.value), opts.goal || 0) * 1.1;
    const sy = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
    const bw = (W - P.l - P.r) / data.length;

    let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
    for (const tv of ticks(0, max)) {
      const y = sy(tv);
      svg += `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/>`;
      svg += `<text class="axis-label" x="${P.l - 8}" y="${y + 4}" text-anchor="end">${fmt(tv, 0)}</text>`;
    }
    data.forEach((d, i) => {
      const x = P.l + i * bw + bw * 0.18;
      const w = bw * 0.64;
      const y = sy(d.value);
      const h = Math.max(0, H - P.b - y);
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${d.color || 'var(--c1)'}"/>`;
      svg += `<rect class="hit" x="${P.l + i * bw}" y="${P.t}" width="${bw}" height="${H - P.t - P.b}" data-tip="${d.label}: ${fmt(d.value, 0)}${opts.unit ? ' ' + opts.unit : ''}"/>`;
      const every = Math.ceil(data.length / Math.max(3, Math.floor(W / 48)));
      if ((data.length - 1 - i) % every === 0) svg += `<text class="axis-label" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${d.label}</text>`;
    });
    if (opts.goal) {
      const gy = sy(opts.goal);
      svg += `<line class="goal" x1="${P.l}" x2="${W - P.r}" y1="${gy}" y2="${gy}"/>`;
      svg += `<text class="goal-label" x="${W - P.r}" y="${gy - 5}" text-anchor="end">Cilj</text>`;
    }
    svg += `</svg>`;
    return `<div class="chart-wrap">${svg}<div class="tooltip"></div></div>`;
  }

  // Tooltip na hover / dodir
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (!t) return;
    const wrap = t.closest('.chart-wrap');
    const tip = wrap.querySelector('.tooltip');
    const r = t.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    tip.textContent = t.dataset.tip;
    tip.style.left = (r.left + r.width / 2 - wr.left) + 'px';
    tip.style.top = (t.tagName === 'rect' ? (r.top - wr.top + 10) : (r.top + r.height / 2 - wr.top)) + 'px';
    tip.classList.add('show');
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (t) t.closest('.chart-wrap').querySelector('.tooltip').classList.remove('show');
  });

  function slot(kind, data, opts = {}) {
    const id = 'c' + (++seq);
    specs.set(id, { kind, data, opts });
    return `<div class="chart-slot" data-chart="${id}"></div>`;
  }

  function renderAll(root = document) {
    root.querySelectorAll('.chart-slot').forEach(el => {
      const spec = specs.get(el.dataset.chart);
      if (!spec) return;
      const W = Math.max(260, el.clientWidth);
      el.innerHTML = (spec.kind === 'line' ? lineSVG : barsSVG)(spec.data, spec.opts, W);
    });
  }

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => renderAll(), 120); });

  window.Charts = {
    line: (series, opts) => slot('line', series, opts),
    bars: (data, opts) => slot('bars', data, opts),
    renderAll,
    clear: () => specs.clear()
  };
})();
