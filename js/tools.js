/* Calculators: Points per run (+ runs to a title), Enhancing cost. Numbers come from W.calc, which build.py
   extracts from the verified Game systems tables, so a rebuild keeps them in sync.
   Layout: inputs as compact "label | control" rows on the left, the result card on the right (sticky); on a phone the
   result card sticks to the bottom of the screen while the inputs scroll, so a change always shows its result. */
(function (K) {
  const { W, P, INDEX, esc, fmt, link, subtabs } = K;
  const C = W.calc || {};
  const MODES = [['main', 'Main'], ['challenge', 'Challenge'], ['death', 'Death']];
  const S = { ml: 'lo' };                         /* last inputs; a new player (Map Level below 5) is the default */
  /* title Map Level gates (Title ladder) and the Legacy stones (Stones) come from the same verified Game systems tables */
  const SYT = title => { for (const p of W.sys || []) for (const x of (p.sections || [p])) for (const t of x.tables || []) if (t.title === title) return t; return null; };
  const GATE = (() => { const t = SYT('Title ladder'), o = {}; if (!t) return o; const ti = t.columns.indexOf('Title'), gi = t.columns.indexOf('Extra / gate');
    if (ti >= 0 && gi >= 0) for (const r of t.rows || []) { const nm = r[ti] && typeof r[ti] === 'object' ? r[ti].name : r[ti], g = String(r[gi] || ''); if (/Map Level/.test(g)) o[nm] = g; } return o; })();
  const STONES = legacy => { const t = SYT('Stones'); if (!t) return []; const c = n => t.columns.indexOf(n), L = [];
    for (const r of t.rows || []) { if (/Legacy/.test(String(r[c('Gear')] || '')) !== legacy) continue;
      const lv = String(r[c('Levels')] || '').match(/\+(\d+) to \+(\d+)/), m = String(r[c('Cost per try')] || '').match(/(\d+) x (\(level \+ 1\)|level)/); if (!lv || !m) return [];
      for (let k = +lv[1]; k < +lv[2]; k++) L.push({ from: k, chance: Number(r[c('Chance %')]) / 100, cost_souls: +m[1] * (m[2] === 'level' ? k : k + 1), token: null, fail: /-1/.test(String(r[c('On fail')] || '')) ? 'minus1' : 'stay' }); }
    return L; };
  const LEGE = STONES(true);
  const DEATH_LV = (() => { const t = SYT('Stones'); if (!t) return 0; const r = (t.rows || []).find(x => /Death mode only/.test(String(x[t.columns.indexOf('Gear')] || ''))), m = r && String(r[t.columns.indexOf('Levels')] || '').match(/\+(\d+) to/); return m ? +m[1] : 0; })();
  const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const fld = (lab, ctl) => `<label class="cl-f"><span>${esc(lab)}</span>${ctl}</label>`;
  const box = (id, lab) => `<label class="inline"><input type="checkbox" id="${id}" ${S[id.slice(2)] ? 'checked' : ''}>${esc(lab)}</label>`;
  const wrap = (ins, res, more) => `<div class="cl-wrap"><div class="cl-in">${ins}</div><div class="cl-out card">${res}</div>${more ? `<div class="cl-more">${more}</div>` : ''}</div>`;

  function pointsCalc() {
    const R = C.points || []; if (!R.length) return '<p class="small">No data.</p>';
    const T = C.titles || [];
    const mode = S.mode || { chall: 'challenge', death: 'death' }[K.filters.md] || 'main', mi = MODES.findIndex(m => m[0] === mode);   /* first visit: the header pick */
    const row = R.find(r => r.n === Number(S.n || K.filters.n || 1)) || R[0];
    const jk = Math.max(0, Math.floor(Number(S.jarvan || 0))), jv = jk * 5, sh = S.shadow ? 10 : 0;   /* Jarvan V pays every kill after the main quest, Shadow Monster once */
    const afk = Math.floor(Number(S.hours || 0) * 4) * (2 + Number(S.fow || 0));
    /* Points of one finished run on difficulty r. Your Map Level 1-4: +10 (N9 +15); every player at Map Level 5 or lower, you too, gives the lobby +2 x N */
    const pts = r => { const o = { stage: r[mode], low: S.ml === 'lo' ? (r.n === 9 ? 15 : 10) : 0, lowers: (Number(S.lowers || 0) + (S.ml === 'hi' ? 0 : 1)) * 2 * r.n, arch: (S.arch ? r.arch[mi] : 0) + (S.frost ? r.arch[mi] : 0) };
      o.total = o.stage + o.low + o.lowers + o.arch + jv + sh + afk; return o; };
    const { stage, low, lowers, arch, total } = pts(row);
    const cur = Number(S.tier || 0), goal = Math.max(cur + 1, Number(S.goal || cur + 1)), top = !T.length || cur >= T[T.length - 1].tier;
    const tname = t => (T.find(x => x.tier === t) || { name: 'no title' }).name;
    const need = top ? 0 : (T.find(t => t.tier === goal) || T[T.length - 1]).total - (cur ? (T.find(t => t.tier === cur) || { total: 0 }).total : 0);
    const runs = t => t > 0 ? Math.ceil(need / t) : 0;
    const ins = fld('Difficulty', sel('c-n', R.map(r => [r.n, r.label]), row.n)) + fld('Mode', sel('c-mode', MODES, mode))
      + fld('Hours in game (for AFK Points)', `<input type="number" id="c-hours" min="0" max="24" step="0.25" value="${esc(S.hours || 0)}">`)
      + fld('Flow of Wealth level', sel('c-fow', [0, 1, 2, 3, 4, 5].map(x => [x, x ? 'Level ' + x : 'none']), S.fow || 0))
      + fld('Your Map Level', sel('c-ml', [['lo', '1 to 4'], ['5', '5'], ['hi', '6 or higher']], S.ml))
      + fld('Other players at Map Level 5 or lower', sel('c-lowers', [0, 1, 2, 3].map(x => [x, x]), S.lowers || 0))
      + (T.length ? fld('Your title', sel('c-tier', [[0, 'none'], ...T.map(t => [t.tier, t.name])], cur)) + (top ? '' : fld('Goal title', sel('c-goal', T.filter(t => t.tier > cur).map(t => [t.tier, t.name]), goal))) : '')
      + `<div class="cl-bx"><span class="small">Killed:</span>${box('c-arch', 'Archangel')}${box('c-frost', 'Frost Lord')}${box('c-shadow', 'Shadow Monster (after the main quest)')}</div>`
      + fld('Jarvan V kills after the main quest', `<input type="number" id="c-jarvan" min="0" max="999" step="1" value="${esc(jk)}">`)
      + '<p class="small cl-note">Only the last main quest boss of your difficulty pays Points, earlier stage bosses pay nothing.</p>';
    const res = `<div class="big">${fmt(total)} <span class="cl-u">Points per run</span></div>
      <p class="small">Final boss ${fmt(stage)}${low ? ` · low Map Level +${low}` : ''}${lowers ? ` · low-level lobby bonus +${fmt(lowers)}` : ''}${arch ? ` · Archangel / Frost Lord +${fmt(arch)}` : ''}${jv ? ` · Jarvan V +${fmt(jv)}` : ''}${sh ? ` · Shadow Monster +${sh}` : ''}${afk ? ` · AFK +${fmt(afk)}` : ''}</p>`
      + (!T.length ? '' : top ? '<p>You already have the top title.</p>'
        : `<div class="big">${fmt(runs(total))} <span class="cl-u">runs to ${esc(tname(goal))}</span></div><p class="small">${fmt(need)} Points from ${esc(tname(cur))} to ${esc(tname(goal))}${T.filter(t => t.tier > cur && t.tier <= goal && GATE[t.name]).map(t => ` · ${esc(t.name)} ${esc(GATE[t.name])}`).join('')}</p>`);
    /* every difficulty at once, same mode and settings (folded): answers "which N pays best for me" without flipping the picker */
    const more = `<details class="cl-cmp"><summary>All difficulties <span class="small">· ${esc(MODES[mi][1])}, same settings</span></summary><div class="tbl compact fit"><table><tr><th>Difficulty</th><th>Points per run</th>${top ? '' : `<th>Runs to ${esc(tname(goal))}</th>`}</tr>${R.map(r => { const t = pts(r).total;
      return `<tr class="${r === row ? 'cl-on' : ''}"><td>${esc(r.label)}</td><td>${fmt(t)}</td>${top ? '' : `<td>${fmt(runs(t))}</td>`}</tr>`; }).join('')}</table></div></details>`;
    return wrap(ins, res, more);
  }

  /* Enhancing: expected tries and Boss Souls from level a to level b. Steps that can lose a level on fail are a
     Markov chain: E[k] = (cost_k + p_k E[k+1] + (1-p_k) E[k-1]) solved forward; protection turns a loss into "stay". */
  function enhanceCalc() {
    const leg = S.gear === 'legacy' && LEGE.length > 0, E = leg ? LEGE : C.enhance || []; if (!E.length) return '<p class="small">No data.</p>';
    const lv = E.map(e => e.from); const max = Math.max(...lv) + 1;
    const a = Math.min(max - 1, Number(S.ea || 0)), b = Math.max(a + 1, Math.min(max, Number(S.eb || Math.min(max, 15))));
    const prot = !!S.prot;
    /* g[k] = expected tries to go from k to k+1 (including falls back and the climb back up); same for souls */
    const g = {}, gs = {}, gt = {};
    for (const e of [...E].sort((x, y) => x.from - y.from)) {
      const k = e.from, p = e.chance > 1 ? e.chance / 100 : e.chance, down = e.fail === 'minus1' && !prot && k > 0;
      const c = e.cost_souls || 0, tk = e.token ? 1 : 0;
      if (!down) { g[k] = 1 / p; gs[k] = c / p; gt[k] = tk / p; }
      else { const q = 1 - p; g[k] = (1 + q * (g[k - 1] || 0)) / p; gs[k] = (c + q * (gs[k - 1] || 0)) / p; gt[k] = (tk + q * (gt[k - 1] || 0)) / p; }
    }
    let tries = 0, souls = 0, tokens = 0, prots = 0;
    for (let k = a; k < b; k++) { if (g[k] == null) continue; tries += g[k]; souls += gs[k]; tokens += gt[k]; const e = E.find(x => x.from === k); if (prot && e && e.fail === 'minus1') { const p = e.chance > 1 ? e.chance / 100 : e.chance; prots += g[k] * (1 - p); } }
    const tok = (E.find(e => e.token) || {}).token, tokName = tok && tok.name ? tok.name + 's' : 'tokens';
    const opts = [...Array(max + 1).keys()].map(x => [x, '+' + x]);
    const ins = (LEGE.length ? fld('Gear', sel('c-gear', [['normal', 'Normal gear'], ['legacy', 'Legacy gear']], leg ? 'legacy' : 'normal')) : '') + fld('From', sel('c-ea', opts.slice(0, -1), a)) + fld('To', sel('c-eb', opts.filter(o => o[0] > a), b))
      + `<div class="cl-bx">${box('c-prot', 'Use a Protection Stone on every fail that would drop a level')}</div>`
      + `<p class="small cl-note">Average for one item at base chances (see ${link('systems', 'enhancing', 'Game systems · Enhancing')}).</p>`;
    const res = `<div class="big">${fmt(Math.round(souls))} <span class="cl-u">Boss Souls</span></div><p class="small">About ${fmt(Math.round(tries))} tries${tokens ? ` · also ${fmt(Math.round(tokens * 10) / 10)} ${esc(tokName)}` : ''}${prots ? ` · ${fmt(Math.round(prots * 10) / 10)} Protection Stones` : ''}</p>${!leg && DEATH_LV && b > DEATH_LV ? `<p class="small">+${DEATH_LV + 1} and up can only be done in Death mode only.</p>` : ''}`;
    return wrap(ins, res);
  }

  const MODES_C = [['points', 'Points per run'], ['enhance', 'Enhancing']];
  P.calc = (_, f) => {
    const m = MODES_C.some(x => x[0] === f.calc) ? f.calc : 'points';
    return `<h2>Calculators</h2>${subtabs('calc', 'calc', MODES_C, m)}<div class="calc">${m === 'points' ? pointsCalc() : enhanceCalc()}</div>`;
  };
  K.hooks.push((page, out) => {
    if (page !== 'calc') return;
    out.querySelectorAll('.calc select, .calc input').forEach(e => e.addEventListener('change', () => {
      const k = e.id.slice(2); S[k] = e.type === 'checkbox' ? e.checked : e.value; K.route();
    }));
  });
  INDEX.push({ k: 'calc', id: '', t: 'Points per run calculator', s: 'points runs title difficulty mode', w: 4 });
  INDEX.push({ k: 'calc?calc=enhance', id: '', t: 'Enhancing cost calculator', s: 'enhance boss souls stones tries', w: 4 });
})(window.AP);
