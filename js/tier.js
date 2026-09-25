/* Tier list: 9 lists (mode x difficulty band), picked with the shared header picker, shown as a compact S/A/B/C board of one-line hero cards.
   Scores = average of independent rankings over code-checked hero profiles; tags are facts from those profiles (popup + search). */
(function (K) {
  const { W, P, INDEX, esc, subtabs } = K; const T = W.tier; if (!T) return;
  const byId = Object.fromEntries((W.heroes || []).map(h => [h.id, h]));
  const band = n => n <= 3 ? 'N1-3' : n <= 6 ? 'N4-6' : 'N7-9';
  const MODEL = { main: 'Main', chall: 'Challenge', death: 'Death' };
  const lock = h => { const g = h.gate || ''; if (!g || g === 'none') return '';
    let m = /map level (\d+)\+ or (\d+) and below/i.exec(g); if (m) return `ML ≤${m[2]} or ${m[1]}+`;
    m = /([\d,]+) World Points/.exec(g); return m ? m[1] + ' WP' : /map level/i.test(g) ? 'ML ' + (g.match(/\d+/) || [''])[0] + '+' : 'solo'; };
  /* pickable on a new account by the solo player these lists are for: no gate, the solo-lobby hero, a "map level N and below" gate */
  const openStart = h => { const g = h.gate || ''; return !g || g === 'none' || /solo lobby|and below/i.test(g); };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  /* the calculator line "Score 98 · boss kill 58 min · pack clear 13 s · survives 1 s vs the boss · damage:... · Legacy:... · Items:..." as score + label/value rows */
  const trSec = t => { const m = /^(under )?([\d.]+) (s|min|h)$/.exec(t || ''); return m ? (m[1] ? 0.5 : 1) * m[2] * { s: 1, min: 60, h: 3600 }[m[3]] : NaN; };   // ux2
  const whyRows = w => { let score = '', bs = NaN; const rows = [], stg = [], top = [];   // ux3: stage letters in one row, end-of-run speed labelled
    for (const p of String(w || '').split(' · ')) { let m;
      if ((m = /^Score (.+)$/.exec(p))) score = m[1];
      else if (/^(Finishes the run|Can't finish the run)/.test(p)) top.push(`<b></b><span>${esc(p)}</span>`);
      else if ((m = /^(?:Whole run: )?(Early|Mid|Late) ([SABC-])$/.exec(p))) stg.push(m[1] + ' ' + m[2]);
      else if ((m = /^end of the run vs an average hero: (.+)$/.exec(p))) rows.push(`<b>End of run</b><span>${esc(m[1])} <span class="small">vs an average hero</span></span>`);
      else if ((m = /^(boss kill|pack clear|survives) (.+)$/.exec(p)) || (m = /^([A-Za-z ]{2,20}): (.+)$/.exec(p))) { let v = m[2];
        if (m[1] === 'boss kill') bs = trSec(v);
        if (m[1] === 'survives') { v = v.replace(/ vs the boss$/, ''); if (trSec(v) >= bs) v = 'the whole boss fight'; }
        rows.push(`<b>${esc(cap(m[1]))}</b><span>${esc(v)}</span>`); }
      else if (p) rows.push(`<b></b><span>${esc(p)}</span>`); }
    return { score, rows: top.concat(stg.length ? [`<b>Stages</b><span>${esc(stg.join(' · '))}</span>`] : [], rows).join('') }; };
  let cur = {};   /* the list on screen (why or why_bis for this key): the popup reads it */
  P.tier = (_, f) => {
    const n = Number(K.filters.n || 1), md = MODEL[K.filters.md] ? K.filters.md : 'main', key = md + '|' + band(n);
    const bis = f.bis === '1' && T.tiers_bis, tst = ['early', 'mid', 'late'].includes(f.tst) ? f.tst : '';   // whole run (25/35/40 %) or one stage of the run (user quiz 2026-09-25)
    const tiers = tst ? ((((bis ? T.stage_tiers_bis : T.stage_tiers) || {})[key] || {})[tst] || (bis ? T.tiers_bis : T.tiers)[key]) : (bis ? T.tiers_bis : T.tiers)[key]; if (!tiers) return '<h2>Tier list</h2><p class="small">No list for this pick.</p>';
    const open = f.to === 'open', ok = id => byId[id] && (!open || openStart(byId[id]));
    /* Your account (user quiz 2026-09-25): with a Run planner save / account set, heroes you can finish a run at this exact N and mode come first */
    const has = !!(K.plan && K.plan.saved && K.plan.saved()), you = has && f.acct !== 'typ', PDp = you ? K.plan.PD : null, cl = you ? (PDp.clear[n + '|' + { main: 'm', chall: 'c', death: 'd' }[md]] || null) : null;
    const canDo = id => { if (you && K.plan.fin) return K.plan.fin(id, n, { main: 'm', chall: 'c', death: 'd' }[md]); if (!cl) return true; const i = PDp.heroes.indexOf(id); return i >= 0 && cl.lv[i] !== 'x' && +cl.lv[i] <= K.plan.step((byId[id] || {}).main_stat || 'STR'); };
    cur = { why: ((bis ? T.why_bis : T.why) || {})[key] || {}, cap: (tst ? { early: 'Early (Start Camp to Steel Fortress)', mid: 'Mid (Rebel Camps to the Pirate Ship)', late: 'Late (Blood Elf Village to the end)' }[tst] : 'Whole run: Early 25%, Mid 35%, Late 40%') + (bis ? ', builds with hard farms' : ', builds with easy + medium items') };
    const RC = (((bis ? T.reach_bis : T.reach) || {})[key]) || {};
    const card = id => { const h = byId[id], lk = lock(h), rc = RC[id], fs = K.plan && K.plan.fast && K.plan.fast(id, n, { main: 'm', chall: 'c', death: 'd' }[md], you);
      if (lk) tags[/WP$/.test(lk) ? 'WP' : /^ML/.test(lk) ? 'ML' : 'solo'] = 1; if (fs) tags.fast = 1; if (rc) tags.gets = 1;
      return `<a class="tr-c" href="#hero/${encodeURIComponent(id)}" data-id="${esc(id)}" data-s="${esc([h.name, ...(T.tags[id] || []), lk, rc || ''].join(' ').toLowerCase())}">${K.icon(id)}<span class="tr-n">${esc(h.name)}</span>${lk ? `<span class="tr-k">${esc(lk)}</span>` : ''}${fs ? `<span class="tr-k tr-f" title="finishes with light gear, among the quickest runs">fast</span>` : ''}${rc ? `<span class="tr-k tr-x">${esc(rc)}</span>` : ''}</a>`; };
    const stg = { '': 'whole run', early: 'Early part of the run only', mid: 'Mid part of the run only', late: 'Late part of the run only' }[tst];
    const sum = you ? `Heroes that finish <b>${MODEL[md]} N${n}</b> with <b>your account</b> <span class="small">(${esc(K.plan.stepTxt('STR'))})</span>, best first · ${stg}`
      : `Best heroes to finish <b>${MODEL[md]} ${band(n)}</b> as a <b>normal player</b> · ${stg}`;
    const alt = you ? `<a href="#" class="tr-acct" data-acct="typ">Show for a normal player</a>` : has ? `<a href="#" class="tr-acct" data-acct="">Show for your account</a>`
      : `<a href="#" class="tr-acct hlbtn" data-acct="need">Show for your account</a><div class="card warn tr-need" hidden><b>Load your save file first.</b> The account view needs your save (Map Level, title, Legacy). <a href="#planner">Go to the Run planner and tap Load save file</a>.</div>`;
    const nondef = !!(tst || open || bis);
    let tags = { WP: 0, ML: 0, solo: 0, fast: 0, gets: 0, not: 0 };
    const html_ = `<div class="tr-b">` + ['S', 'A', 'B', 'C'].map(t => { const ids = (tiers[t] || []).filter(ok).filter(canDo); return ids.length ? `<div class="tr-row sgroup"><div class="tr-l t-${t}">${t}</div><div class="tr-cs">${ids.map(card).join('')}</div></div>` : ''; }).join('')
      + (you ? (() => { const no = ['S', 'A', 'B', 'C'].flatMap(t => (tiers[t] || []).filter(ok).filter(id => !canDo(id))); if (no.length) tags.not = 1; return no.length ? `<details class="tr-no"><summary class="small">Not yet: ${no.length} heroes your account can't pick yet or doesn't finish this run with</summary><div class="tr-row sgroup"><div class="tr-l t-C">Not yet</div><div class="tr-cs">${no.map(card).join('')}</div></div></details>` : ''; })() : '') + `</div>`;
    const leg = [tags.WP && 'WP = World Points to unlock', tags.ML && 'ML = Map Level to unlock', tags.solo && 'solo = solo lobby only', tags.fast && 'fast = among the quickest runs with light gear',
                 tags.gets && "gets to X = can't finish, X = the last boss it beats", 0].filter(Boolean);
    return `<h2 class="tr-h">Tier list</h2><p class="tr-sum">${sum}</p><p class="small tr-alt">${alt}</p>`
      + `<div class="tr-ctl"><input class="tsearch tr-q" placeholder="Find a hero or tag: AoE, true dmg ..."><span class="tsearch-n small"></span><span class="small tr-hint">Hover or tap: numbers. Click or tap again: hero page.</span></div>`
      + `<details class="tr-opt"${nondef ? ' open' : ''}><summary>Options</summary><div class="tr-ol">`
      + (T.stage_tiers ? `<div>${subtabs('tier', 'tst', [['', 'Whole run'], ['early', 'Early'], ['mid', 'Mid'], ['late', 'Late']], tst)}<span class="small">rate one part of the run</span></div>` : '')
      + `<div>${subtabs('tier', 'to', [['', 'All heroes'], ['open', 'Open at start']], open ? 'open' : '')}<span class="small">hide heroes a new account can't pick</span></div>`
      + (T.tiers_bis ? `<div><label class="inline tr-bis"><input type="checkbox" id="bis" ${bis ? 'checked' : ''}> Best in slot</label><span class="small">count gear that takes long farming too</span></div>` : '')
      + `</div></details>`
      + html_
      + (leg.length ? `<p class="small tr-leg">${leg.join(' · ')}</p>` : '')
      + (T.notes[key] ? `<p class="small tr-note">${esc(T.notes[key])}</p>` : '')
      + `<details class="tcol tr-how"><summary>How it's ranked</summary><ul class="small">`
      + `<li>A damage calculator runs every hero's checked skill formulas with its own best easy or medium items for each stage of the run (Best in slot: hard farms too) and a typical Legacy bag from the band before.</li>`
      + `<li>It fights this band's reference boss and monster pack, scored for this mode: boss kill (after boss Armor, magic resist and the mode's damage cut), pack clear (AoE, and when the main skill comes online) and survival against the mode's extra hits. Whole run = Early 25% + Mid 35% + Late 40%.</li>`
      + `<li>Unlock cost is not scored. Your account: every hero's run is replayed with your Map Level, title and Legacy (Run planner).</li></ul></details>`;
  };
  /* numbers on hover or keyboard focus (desktop) or first tap (touch); a click or second tap opens the hero's page */
  let pop = null;
  const hide = () => { if (pop) pop.hidden = true; document.querySelectorAll('.tr-c.armed').forEach(x => x.classList.remove('armed')); };
  const show = a => { const id = a.dataset.id, h = byId[id]; if (!h) return;
    if (!pop) { pop = document.createElement('div'); pop.className = 'tpop tr-p'; document.body.appendChild(pop); }
    const w = whyRows((cur.why || {})[id]), g = h.gate && h.gate !== 'none' ? 'Unlock: ' + h.gate : '', sub = [g, ...(T.tags[id] || [])].filter(Boolean);
    pop.innerHTML = `<div class="tr-ph"><b>${esc(h.name)}</b>${w.score ? `<span class="tr-sc">Score ${esc(w.score)}</span>` : ''}</div>`
      + (sub.length ? `<div class="small">${sub.map(esc).join(' · ')}</div>` : '') + (w.rows ? `<div class="kv">${w.rows}</div>` : '') + (cur.cap ? `<div class="small">${esc(cur.cap)}</div>` : '');
    pop.hidden = false; const r = a.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(document.documentElement.clientWidth - pw - 8, r.left)) + 'px';
    pop.style.top = (window.scrollY + (r.bottom + 6 + ph <= window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - ph - 6))) + 'px'; };
  window.addEventListener('hashchange', hide);
  document.addEventListener('click', e => { if (pop && !pop.hidden && !e.target.closest('.tr-c,.tr-p')) hide(); });
  const touch = () => matchMedia('(hover: none)').matches;
  K.hooks.push((page, out) => { hide(); if (page !== 'tier') return;
    out.querySelectorAll('.tr-c').forEach(a => {
      a.addEventListener('mouseenter', () => { if (!touch()) show(a); }); a.addEventListener('mouseleave', () => { if (!touch()) hide(); });
      a.addEventListener('focus', () => { if (!touch()) show(a); }); a.addEventListener('blur', () => { if (!touch()) hide(); });
      a.addEventListener('click', e => { if (touch() && !a.classList.contains('armed')) { e.preventDefault(); hide(); a.classList.add('armed'); show(a); } else { hide(); e.preventDefault(); location.hash = a.getAttribute('href'); } }); });   // user 2026-09-25: go straight to the hero page
    const c = out.querySelector('#bis'); if (c) c.addEventListener('change', () => { K.filters.bis = c.checked ? '1' : ''; K.route(); });
    out.querySelectorAll('.tr-acct').forEach(a => a.addEventListener('click', e => { e.preventDefault(); if (a.dataset.acct === 'need') { const w = out.querySelector('.tr-need'); if (w) w.hidden = false; return; } K.filters.acct = a.dataset.acct; K.route(); })); });
  INDEX.push({ k: 'tier', id: '', t: 'Tier list', s: 'best heroes per mode and difficulty band', w: 6 });
})(window.AP);
