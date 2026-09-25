/* Heroes tab and hero pages (facts only: no ratings, no model notes) */
(function (K) {
  const { W, P, INDEX, esc, fmt, ilink, item, link, subtabs } = K;
  const HS = W.heroes || []; const byId = Object.fromEntries(HS.map(h => [h.id, h]));
  const kit = h => (h.kit_items || []).filter(i => i && i.id).map(i => item[i.id] ? ilink(i.id) : esc(i.name)).join(', ');
  const preview = t => { const s = String(t || '').split(/(?<=[.!])\s/)[0]; return s.length > 110 ? s.slice(0, 107) + '...' : s; };
  /* hero levels to learn a skill: an even ladder (1, 3, 5... 19) prints as "1, 3 … 19" */
  const lv = a => { if (!Array.isArray(a)) return esc(a || ''); const d = a[1] - a[0];
    return a.length > 3 && d > 0 && a.every((x, i) => !i || x - a[i - 1] === d) ? `${a[0]}, ${a[1]} … ${a[a.length - 1]}` : a.join(', '); };
  /* two filters that combine: Stat (from main_stat, World = World Heroes taverns) and Unlock (open at start / locked) */
  const statOf = h => /^World/.test(h.tavern) ? 'World' : h.main_stat;
  const unlockOf = h => !h.gate || h.gate === 'none' ? 'Open' : /World Points/.test(h.gate) ? 'World Points' : /map level/i.test(h.gate) ? 'Map Level' : /solo/i.test(h.gate) ? 'Solo lobby' : 'Other';
  const wp = h => { const m = /([\d,]+) World Points/.exec(h.gate || ''); return m ? +m[1].replace(/,/g, '') : 0; };
  const tierOf = id => { const n = Number(K.filters.n || 1), md = { chall: 'chall', death: 'death' }[K.filters.md] || 'main';
    const key = md + '|' + (n <= 3 ? 'N1-3' : n <= 6 ? 'N4-6' : 'N7-9'); const tt = ((W.tier || {}).tiers || {})[key] || {};
    return { t: Object.keys(tt).find(x => tt[x].includes(id)) || '', key }; };
  const TORD = { S: 0, A: 1, B: 2, C: 3, '': 4 };
  const MODE = { main: 'Main', chall: 'Challenge', death: 'Death' };
  const TL = t => `<span class="tl${t ? ' t-' + t : ''}">${t || ''}</span>`;
  /* short unlock tag on a card (full text in the tooltip and on the hero page): 250 WP / ML 9+ / ML ≤14 or 25+ / solo */
  const gateTag = h => { const u = unlockOf(h); if (u === 'Open') return ''; const n = h.gate.match(/\d[\d,]*/g) || [];
    const s = u === 'World Points' ? fmt(wp(h)) + ' WP' : u === 'Map Level' ? (/ or /.test(h.gate) && n.length > 1 ? `ML ≤${n[1]} or ${n[0]}+` : `ML ${n[0] || ''}+`) : u === 'Solo lobby' ? 'solo' : h.gate;
    return `<span class="tag" title="${esc(h.gate)}">${esc(s)}</span>`; };
  /* item bonus text: each item it names links to that item's card (only when exactly one item has the name) */
  let INM = null;
  const noteHtml = s => { if (!INM) { INM = Object.create(null); for (const i of Object.values(item)) { const n = i.dn || i.name; INM[n] = n in INM ? '' : i.id; } }
    const re = /(^|\. )(With )?([^:.]+):/g; let o = '', last = 0, m;
    while ((m = re.exec(s))) { const st = m.index + m[1].length + (m[2] || '').length, id = INM[m[3]];
      if (id) { o += esc(s.slice(last, st)) + ilink(id); last = st + m[3].length; } }
    return o + esc(s.slice(last)); };
  /* ux2 2026-09-25 hero page helpers. hxCut = Early / Mid / Late labels from the run order with side zones skipped (True Fortress,
     Frostlands, Ringwraith Island are optional, a stage label must name a zone every run passes); hxKey = key item with when + how;
     hxStats = one of Main stat / All stats when they tie (All stats always holds the main stat); hxLeg = Legacy goals one per line
     with how the line starts (Points price, boss drop, free) */
  const hxBI = { 'N1-3': 0, 'N4-6': 1, 'N7-9': 2 }, hxST = ['Early', 'Mid', 'Late'];
  const hxCut = band => { const so = (W.stage_orders || {})[band]; if (!so) return (W.stage_cut || {})[band] || {};
    const Z = (W.zones || []).filter(z => !z.optional && /^\d+$/.test(String(z.order))).sort((a, b) => a.order - b.order);
    const first = lo => (Z.find(z => +z.order > lo) || {}).name || '', last = hi => (Z.filter(z => +z.order <= hi).pop() || {}).name || '';
    return { early: [first(0), last(so[0])], mid: [first(so[0]), last(so[1])], late: [first(so[1]), ''] }; };
  const hxKey = (id, band) => { const ki = (((W.key_items || {})[id] || {})[band]) || []; if (!ki.length) return '';
    return `<div class="hr-key">Key item: ${ki.map(([i, f]) => { const a = ((W.acq || {})[i] || [])[hxBI[band]], how = ((W.avail || {})[i] || [])[2];
      return `${K.ilink(i)} <span class="small">boss kills ${f}x faster${a && hxST[a[0]] ? ` · ${hxST[a[0]]} in the run` : ''}${how ? ' · ' + esc(how) : ''}</span>`; }).join('<br>')}</div>`; };
  const hxStats = g => { const m = (g.find(x => x[0] === 'Main stat') || [])[1]; return g.filter(x => !(x[0] === 'All stats' && m != null && x[1] <= m * 1.05)); };
  /* SKILL PRIORITY (2026-09-25): ONE line with the calculator's rule (tier_calc skill_levels): 1 point per hero level, each point goes to the
     first skill in the line that can take a rank: the ultimate whenever a rank unlocks, then the value order for the page's difficulty + mode
     (skill_prio; equal values print as '='). Rank k needs hero level reqLevel + (k-1) x levelSkip (checks/skill_rules.json), said once as
     'each rank needs N more hero levels', the skills that differ in brackets. All one-rank skills: the hero level each is taken, in order.
     Built-in skills (skill_fixed) get a short note; heroes without skill points (Beastmaster, Engineer, Hell Executioner) one short line. */
  const hxOrder = (h, gk) => { /* SKILLPRIO */
    const fixed = new Set((W.skill_fixed || {})[h.id] || []), all = h.skills || [];
    const sk = all.filter(x => x.key && Array.isArray(x.req) && x.req.length && !fixed.has(x.key));
    const nm = x => esc(x.key), fx = all.filter(x => x.key && fixed.has(x.key)).map(x => nm(x) + ': built in');   // user 2026-09-25: letters only (R › E › W › Q)
    const row = (v, sm) => `<b>Skill priority</b><span>${v}${sm ? ` <span class="small">· ${sm}</span>` : ''}</span>`;
    if (!sk.length) return fx.length ? row((W.skill_by_use || []).includes(h.id) ? 'No skill points: each skill levels up as you use it' : 'No skill points: every skill is ready from level 1') : '';
    const P = (W.skill_prio || {})[h.id] || {}; let pr = P[gk] || [], most = '';
    if (!pr.length) {   // no numbers for this difficulty + mode: the order most of them use
      const C = {}; for (const v of Object.values(P)) if ((v || []).length) { const k = v.map(x => x[0]).join(); (C[k] = C[k] || [0, v])[0]++; }
      const b = Object.values(C).sort((x, y) => y[0] - x[0])[0]; if (b) { pr = b[1]; most = 'order most difficulties use'; } }
    const by = new Map(sk.map(x => [x.key, x])), R = by.get('R');
    const rest = pr.filter(x => x[0] !== 'R' && by.has(x[0])).map(x => [by.get(x[0]), x[1]]);
    for (const x of sk) if (x !== R && !rest.some(y => y[0] === x)) rest.push([x, null]);
    if (sk.every(x => x.req.length === 1)) {   // one rank each: the hero level each is taken (1 point per level, the line's order on a tie)
      const order = (R ? [R] : []).concat(rest.map(y => y[0])), at = new Map(); let pts = 0;
      for (let L = 1; L <= 500 && at.size < order.length; L++) { pts++; for (const x of order) if (pts > 0 && !at.has(x) && x.req[0] <= L) { at.set(x, L); pts--; } }
      return row(order.slice().sort((x, y) => at.get(x) - at.get(y)).map(nm).join(' › '), fx.join(' · '));
    }
    /* ranks: the most common ladder is the rule (d = hero levels between ranks, a start above d is named: 6, 12, 18 = 'every 6' needs none) */
    const lad = x => { const a = x.req, n = a.length; if (n < 2) return null; const d = a[n - 1] - a[n - 2]; return { d, s: a[0] > 1 && a[0] !== d ? a[0] : 0, ok: a.slice(2).every((v, k) => v - a[k + 1] === d) }; };
    const cnt = {}; for (const x of sk) { const l = lad(x); if (l && l.ok) { const k = l.d + '|' + l.s; cnt[k] = (cnt[k] || 0) + 1; } }
    const mk = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0] || '0|0', [md, ms] = mk.split('|').map(Number);
    const ex = [], first = [], one = [];
    for (const x of sk) { const l = lad(x), k = esc(x.key);
      if (!l) { one.push(`${k} Lv ${x.req[0]}`); continue; }
      if (!l.ok) { ex.push(`${k}: Lv ${lv(x.req)}`); continue; }
      if (l.d !== md) ex.push(`${k}: ${l.d} more${l.s !== ms ? ' from Lv ' + x.req[0] : ''}`);
      else if (l.s !== ms) first.push(`${k} Lv ${x.req[0]}`); }
    const br = [ex.join(', '), first.length ? 'first rank: ' + first.join(', ') : '', one.length ? '1 rank: ' + one.join(', ') : ''].filter(Boolean).join('; ');
    const rule = md ? `each rank needs ${md} more hero levels${ms ? ` from Lv ${ms}` : ''}${br ? ` (${br})` : ''}` : br;
    const G = []; for (const [x, v] of rest) { const g = G[G.length - 1]; if (g && v != null && g.v === v) g.a.push(x); else G.push({ v, a: [x] }); }
    const line = [R ? nm(R) : '', ...G.map(g => g.a.map(nm).join(' = '))].filter(Boolean).join(' › ');
    return row(line, fx.join(' · '));
  };
  K.hxOrder = hxOrder;   /* TESTER PAGE FIXES (2026-09-25): the Run planner shows the same skill priority line */
  const hxLeg = leg => { const LL = {}; for (const l of ((W.legacy || {}).lines || [])) LL[l.root.id] = l;
    return leg.map(([r, s]) => { const l = LL[r] || { name: r, steps: [] }, st = (l.steps || []).find(x => x.id === s) || {};
      const to = !st.name || st.name === l.name ? '' : st.name.startsWith(l.name + ' ') ? ' ' + esc(st.name.slice(l.name.length + 1)) : ' → ' + esc(st.name);
      const hw = (W.leg_how || {})[s];
      if (hw) return `<span class="hx-lg">${K.ilink(s)} <span class="small">· ${esc(hw[0].split(' > ').pop())}${hw[1] ? ' · ' + esc(hw[1]) : ''}</span></span>`;
      return `<span class="hx-lg"><a href="#legacyline/${encodeURIComponent(r)}">${esc(l.name)}</a>${to}${l.start ? ` <span class="small">· ${esc(l.start)}</span>` : ''}</span>`; }).join(''); };
  /* ux3 2026-09-25: Build guide legend = only the tags this guide really shows (hard / very hard, +N, keep, basic, key item) */
  const u3Leg = (best, KEY) => { const S = ['early', 'mid', 'late'].map(st => best[st] || []), U = S.flat(), seen = new Set(), L = []; let keep = false;
    S.forEach(A => { if (A.some(x => seen.has(x[0]))) keep = true; A.forEach(x => seen.add(x[0])); });
    const PB3 = ['early', 'mid', 'late'].map(st => best[st + '_pet'] || []), seenP = new Set();   // PET BAG rows: hard / keep / free tags too
    PB3.forEach(A => { if (A.some(x => x[1] !== 'g' && seenP.has(x[0]))) keep = true; A.forEach(x => seenP.add(x[0])); }); U.push(...PB3.flat().filter(x => x[1] === 'h' || x[1] === 'v').map(x => ['', x[1]]));
    if (U.some(x => x[1] === 'h' || x[1] === 'v')) L.push('<b>hard</b> long farm');
    if (U.some(x => x[5])) L.push('<b>+10</b> enhance it that far with Boss Souls');
    if (keep) L.push('<b>keep</b> from the part before');
    if (U.some(x => x[1] === 'b')) L.push('<b>basic</b> cheap starter gear');
    if (PB3.flat().some(x => x[1] === 'g')) L.push('<b>free</b> from your Map Level');
    if (U.some(x => KEY.has(x[0]))) L.push('gold frame = key item');
    return L.join(' · '); };
  /* Heroes tab: one column per main stat (World separate), compact cards sorted by tier at the picked difficulty + mode; a card opens the hero page.
     Phone: one column at a time, picked with the stat chips (the chips are hidden on desktop, where every column shows). */
  P.heroes = (_, f) => {
    const ul = ['Open', 'Locked'].includes(f.ul) ? f.ul : '';
    const okU = h => !ul || (unlockOf(h) === 'Open') === (ul === 'Open');
    const cols = [['STR', 'Strength'], ['AGI', 'Agility'], ['INT', 'Intelligence'], ['World', 'World Heroes']];
    const L = {}; for (const [c] of cols) L[c] = HS.filter(h => statOf(h) === c && okU(h)).sort((a, b) => TORD[tierOf(a.id).t] - TORD[tierOf(b.id).t] || a.name.localeCompare(b.name));
    const live = cols.filter(([c]) => L[c].length); const hs = live.some(([c]) => c === f.hs) ? f.hs : (live[0] || [''])[0]; const pick = live.length > 1;
    const card = h => `<a class="hcard" href="#hero/${encodeURIComponent(h.id)}">${TL(tierOf(h.id).t)}${K.icon(h.id)}<span class="nm">${esc(h.name)}</span>${gateTag(h)}</a>`;
    const key = tierOf('').key.split('|'); const nOpen = HS.filter(h => unlockOf(h) === 'Open').length;
    return `<h2>Heroes <span class="hr-sub">tier letters: ${MODE[key[0]]} · ${key[1]}</span></h2>`
      + ((W.heroes_intro || []).length ? `<details class="hr-rules"><summary>Hero pick rules</summary><p class="small">${W.heroes_intro.map(esc).join(' ')}</p></details>` : '')
      + `<div class="hr-f">${pick ? `<div class="hr-stat">${subtabs('heroes', 'hs', live.map(([c]) => [c, `${c} ${L[c].length}`]), hs)}</div>` : ''}`
      + subtabs('heroes', 'ul', [['', `All ${HS.length}`], ['Open', `Open ${nOpen}`], ['Locked', `Locked ${HS.length - nOpen}`]], ul) + '<span class="small hr-u3">WP = World Points · ML = Map Level</span></div>'
      + `<div class="hcols${pick ? ' hr-pick' : ''}">${live.map(([c, nm]) => `<div class="hcol${c === hs ? '' : ' hr-off'}" data-col="${c}"><h3>${nm} <span class="small">${L[c].length}</span></h3>${L[c].map(card).join('')}</div>`).join('')}</div>`;
  };
  P.hero = id => {
    const h = byId[id]; if (!h) return '<p>Unknown hero.</p>';
    const sk = h.skills || [];
    const t0 = tierOf(h.id), key = t0.key.split('|');
    const bare = h.trait && !/:/.test(h.trait) && kit(h);   // ux2: trait name only = the starting item's bonus
    const facts = [unlockOf(h) !== 'Open' ? ['Unlock', esc(h.gate)] : null, bare ? ['Trait', `${esc(h.trait)} <span class="small">from its starting</span> ${kit(h)}`] : h.trait ? ['Trait', esc(h.trait)] : null, kit(h) && !bare ? ['Starts with', kit(h)] : null, h.note ? ['Item bonus', noteHtml(h.note)] : null].filter(Boolean);
    /* one header card: icon, name, stat + tavern, tier badge at the picked difficulty + mode (links to the Tier tab), then only the facts this hero has */
    const head = `<div class="card hi hr-head" data-st="${String(h.main_stat || '').toLowerCase()}"><div class="hr-top">${K.icon(h.id).replace('class="ico', 'class="ico big')}<div class="hr-id"><h2>${esc(h.name)}</h2><div class="small">${esc(h.main_stat)} hero · ${esc(h.tavern)} tavern</div>${hxKey(h.id, key[1])}</div>`
      + (t0.t ? `<a class="hr-tier" href="#tier" title="Tier list">${TL(t0.t)}<span class="small">${MODE[key[0]]} ${key[1]}</span></a>` : '') + '</div>'
      + (facts.length ? `<div class="hr-kv">${facts.map(([k, v]) => `<div><b>${k}</b>${v}</div>`).join('')}</div>` : '') + '</div>';
    /* skills folded with a one-line preview (hidden when open); levels / hero levels / cooldown in one small line inside */
    const meta = s => [s.levels ? `${s.levels} level${s.levels == 1 ? '' : 's'}` : '', Array.isArray(s.req) && s.req.length ? `hero level ${lv(s.req)}` : '',
      s.cooldown && !/cool\s*down/i.test(s.text || '') ? `cooldown ${Array.isArray(s.cooldown) ? fmt(s.cooldown[0]) + '-' + fmt(s.cooldown[s.cooldown.length - 1]) : fmt(s.cooldown)} s` : ''].filter(Boolean).join(' · ');
    const skills = `<div class="hr-sk"><div class="hr-skh"><h3>Skills</h3><a href="#" data-expand="1" class="small">Expand all</a></div>`
      + sk.map(s => `<details class="skill"><summary>${s.icon ? K.icon(s.icon) : ''}<span class="key">${esc(s.key || '')}</span><span class="nm">${esc(s.name || '')}</span><span class="pv">${esc(preview(s.text))}</span></summary><div class="body"><p>${esc(s.text || '')}</p>${meta(s) ? `<p class="small">${meta(s)}</p>` : ''}</div></details>`).join('') + '</div>';
    const guide = ''
      + (() => { const tr = tierOf(h.id); const [md, band] = tr.key.split('|'); const gk = band + '|' + md;   // Build guide (2026-09-25): one run at the picked difficulty + mode
          const g = (((W.guide || {})[h.id] || {})[gk] || []).filter(x => x[1] > 0);
          const best = (((W.best_items || {})[h.id] || {})[gk]) || {};
          const leg = (((W.guide_legacy || {})[h.id] || {})[gk]) || [];
          if (!g.length && !Object.keys(best).length) return '';
          const cut = hxCut(band);   // ux2: side zones never name a stage
          const LN = {}, LS = {}; for (const l of ((W.legacy || {}).lines || [])) { LN[l.root.id] = l.name; for (const s of (l.steps || [])) LS[s.id] = s.name; }
          const why = x => [x[2] > 0 ? `boss kill time -${x[2]}%` : '', x[3] > 0 ? `pack clear time -${x[3]}%` : '', x[4] > 0 ? (x[4] >= 100 ? `survives ${String(+(1 + x[4] / 100).toFixed(1))}x longer` : `survives ${x[4]}% longer`) : ''].filter(Boolean).join(', ');
          const seen = new Set(), KI = (((W.key_items || {})[h.id] || {})[band]) || [], KEY = new Set(KI.map(x => x[0]));
          /* PET BAG (2026-09-25): the open pet page per stage (6 slots, only listed items work there), compact like the item line: free Map Level items first, then the picks */
          const seenP = new Set();
          const petLine = st => { const L = (best[st + '_pet'] || []).filter(x => x[1] !== 'g' || !seenP.has(x[0])); if (!L.length) return '';   // free items only where they first show
            const G = []; for (const x of L) { const g = G.find(y => y[0][0] === x[0]); if (g) g[1]++; else G.push([x, 1]); }
            const html = G.map(([x, n]) => `<span class="gi" title="${esc(x[1] === 'g' ? 'free from your Map Level' : why(x))}">${K.ilink(x[0])}${n > 1 ? ` <span class="small">x${n}</span>` : ''}${x[1] === 'g' ? ' <span class="small">free</span>' : seenP.has(x[0]) ? ' <span class="small">keep</span>' : ''}${x[1] === 'h' ? ' <span class="small">hard</span>' : x[1] === 'v' ? ' <span class="small">very hard</span>' : ''}</span>`).join(', ');
            L.forEach(x => seenP.add(x[0]));
            return `<span class="gi-ad"><span class="small">Pet bag</span> ${html}</span>`; };
          const row = st => { const L = best[st] || []; if (!L.length) return '';
            const c = cut[st] || []; const where = c[0] ? `${esc(c[0])} → ${c[1] ? esc(c[1]) : 'end'}` : '';
            const G = []; for (const x of L) { const g = G.find(y => y[0][0] === x[0]); if (g) g[1]++; else G.push([x, 1]); }   // the full 6-slot build, repeats as xN
            const html = G.map(([x, n]) => `<span class="gi${KEY.has(x[0]) ? ' gk' : ''}" title="${esc(KEY.has(x[0]) ? ['Key item: its hero bonus makes boss kills ' + (KI.find(k => k[0] === x[0]) || [])[1] + 'x faster', why(x) ? 'its stats: ' + why(x) : ''].filter(Boolean).join('; ') : why(x))}">${K.ilink(x[0])}${x[5] ? ` <span class="small">+${x[5]}</span>` : ''}${n > 1 ? ` <span class="small">x${n}</span>` : ''}${seen.has(x[0]) ? ' <span class="small">keep</span>' : ''}${x[1] === 'h' ? ' <span class="small">hard</span>' : x[1] === 'v' ? ' <span class="small">very hard</span>' : ''}${x[1] === 'b' ? ' <span class="small">basic</span>' : ''}</span>`).join(', ');
            L.forEach(x => seen.add(x[0]));
            const ad = ((((W.addons || {})[h.id] || {})[gk]) || {})[st] || [];
            const adh = ad.some(Boolean) ? `<span class="gi-ad small">${ad[0] ? 'Rune ' + K.ilink(ad[0]) : ''}${ad[1] ? (ad[0] ? ' · ' : '') + 'Skills ' + ad.slice(1).filter(Boolean).map(K.ilink).join(', ') : ''}</span>` : '';
            return `<b>${{ early: 'Early', mid: 'Mid', late: 'Late' }[st]}${where ? `<span class="small gw">${where}</span>` : ''}</b><span>${html}${petLine(st)}${adh}</span>`; };
          return `<div class="card guide"><h4 style="margin-top:0">Build guide <span class="small">· ${band} ${{ main: 'Main', chall: 'Challenge', death: 'Death' }[md]}</span></h4><div class="row2">`
            + (hxStats(g).length ? `<b>Stat priority</b><span>${hxStats(g).map(x => esc(x[0])).join(' › ')}</span>` : '')
            + hxOrder(h, gk)
            + ['early', 'mid', 'late'].map(row).join('')
            + (leg.length ? `<b>Legacy goals</b><span>${hxLeg(leg)}</span>` : '')
            + (() => { const b = K.plan && K.plan.best6 ? K.plan.best6(h.id, gk) : null;   // LEGACY BAG (patch_legacy_bag): your save's strongest 6 by this hero's stat weights
                return b && b.bag.length ? `<b>Your best 6</b><span>${b.bag.map(K.ilink).join(', ')} <span class="small">in your Legacy Bag${b.rest.length ? ', the rest in storage' : ''}</span></span>` : ''; })()
            + (((W.leg_hero || {})[h.id] || []).length ? `<b>Legacy only it can push</b><span><details class="gi-lh"><summary>${(W.leg_hero[h.id]).length} upgrades</summary>${W.leg_hero[h.id].map(([sid, what]) => `<div>${K.ilink(sid)} <span class="small">· ${esc(what)}</span></div>`).join('')}</details></span>` : '')
            + `</div><p class="small" style="margin:6px 0 0">Best first, only what a normal run can farm by then (an empty slot = your starter gear stays).${u3Leg(best, KEY) ? ' ' + u3Leg(best, KEY) + '.' : ''} Hover an item for what it adds.</p></div>`; })()
      ;   /* end of the build guide expression above */
    return head + guide + skills;                                     // user quiz 2026-09-25: build guide above skills
  };
  K.hooks.push((page, out) => {
    if (page === 'hero') { const a = out.querySelector('[data-expand]'); if (a) a.addEventListener('click', e => { e.preventDefault(); const open = a.textContent === 'Expand all'; out.querySelectorAll('details.skill').forEach(d => d.open = open); a.textContent = open ? 'Collapse all' : 'Expand all'; }); }
  });
  /* main-stat colours (user 2026-09-25): every hero link gets data-st = str / agi / int, CSS colours it red / green / blue */
  const STAT = {}; for (const h of HS) STAT[h.id] = String(h.main_stat || '').toLowerCase();
  const tagHeroes = root => { if (!root || !root.querySelectorAll) return;
    for (const a of root.querySelectorAll('a[href^="#hero/"]:not([data-st])')) { const s = STAT[decodeURIComponent(a.getAttribute('href').slice(6).split('/')[0])]; if (s) a.dataset.st = s; } };
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) tagHeroes(n.parentElement || n); }).observe(document.body, { childList: true, subtree: true });
  tagHeroes(document.body);
  for (const h of HS) INDEX.push({ k: 'hero', id: h.id, t: h.name, s: h.tavern + ' · ' + h.main_stat, w: 4 });
  for (const h of HS) for (const s of (h.skills || [])) if (s.name && s.name !== h.name) INDEX.push({ k: 'hero', id: h.id, t: s.name + ' (' + h.name + ')', s: 'skill · ' + String(s.text || '').slice(0, 120), w: 1 });
})(window.AP);
