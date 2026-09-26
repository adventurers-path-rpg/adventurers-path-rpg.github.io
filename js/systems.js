/* Game systems (verified pages from findings/public/systems_guide), commands, changelog, credits */
(function (K) {
  const { W, P, INDEX, esc, fmt, ilink, ulink, item, unitByCode, bossByCode, shopByCode, link, subtabs } = K;
  const SY = W.sys || [];
  const ref = c => item[c.id] ? `<a href="#item/${encodeURIComponent(c.id)}">${K.icon(c.id)}<span class="${item[c.id].rar ? 'r-' + item[c.id].rar : ''}">${esc(c.name || K.iname(c.id))}</span></a>` : (unitByCode[c.id] || bossByCode[c.id]) ? ulink(c.id, c.name) : /^z\d\d$/.test(c.id) ? link('zones', c.id, c.name) : shopByCode[c.id] ? link('shop', c.id, c.name) : esc(c.name);
  /* ---- Game systems: page chips on top, section chips FILTER (one section in view, nothing jump-scrolls). Every table is a
     fold row; the section's first table not marked collapsed starts open; 24+ row tables get a search box.
     TFIX (by table title; a renamed table just renders plain) makes wide tables fit a phone without dropping a fact:
     merge [[cols], header, fn] = several columns become one cell; fold [col] = column moves into the first cell as '· Label: value';
     group col (+ glab) = tr.grp rows instead of a repeated column; join = rows equal in every other column list their first cells;
     by [header, fn] = one row per first-cell value, the other columns listed; ren = shorter header; cards = few long rows as cards;
     phone = table on desktop, cards on a phone;
     flip = transpose (few rows of many short numbers). A 1-row table with 6+ columns becomes a one-line strip. ---- */
  const nb = v => v >= 1e6 && v % (v >= 1e9 ? 1e7 : 1e4) === 0 ? K.big(v) : fmt(v);   // 202,500,000 -> 202.5 M, only when exact
  const cell = c => c == null || c === '' ? '<span class="small">-</span>' : typeof c === 'number' ? nb(c)
    : Array.isArray(c) ? c.map((x, i) => cell(x) + (i < c.length - 1 ? (typeof x === 'string' || typeof c[i + 1] === 'string' ? ' ' : ', ') : '')).join('') : typeof c === 'object' ? (c.id ? ref(c) : esc(c.text || c.name || '')) : esc(c);
  K.cell = cell;
  const txt = c => c == null ? '' : c.h != null ? c.t : typeof c === 'number' ? c + ' ' + nb(c) : Array.isArray(c) ? c.map(txt).join(' ')
    : typeof c === 'object' ? String(c.name || c.text || (item[c.id] ? K.iname(c.id) : (unitByCode[c.id] || bossByCode[c.id] || shopByCode[c.id] || {}).name || '')) : String(c);
  const H = c => c != null && c.h != null ? c.h : cell(c);
  const hv = (h, v) => ({ h, t: v.map(txt).join(' ') });
  const dash = v => v == null || v === '' || v === '-';
  const cut = (...v) => v.every(dash) ? '-' : v.map(H).join(' / ');
  const plus = (...p) => p.filter(Boolean).join(' + ') || '-';
  const STR_RES = [['Strength (M, x difficulty)', 'Magic resist'], 'Strength (M) / magic resist', cut];
  const TFIX = {
    'Kept vs lost': { group: 'Kept?', glab: v => ({ Yes: 'Kept', No: 'Lost' }[v] || esc(v)) },
    'Difficulties': { merge: [[['N', 'Name', 'Challenge Tokens (Challenge mode)'], 'Difficulty', (n, nm, tk) => `N${fmt(n)} ${esc(nm)}` + (tk > 0 ? ` <span class="small">· ${fmt(tk)} Challenge Token${tk > 1 ? 's' : ''}</span>` : '')], [['Zone monster HP %', 'Monster damage %', 'Monster attack speed %'], 'Monster HP / dmg / atk speed %', cut]] },
    'Special Merchant exchanges (one per run)': { merge: [[['Gold', 'Boss Souls', 'Points (x Map Level)'], 'Price', (g, s, p) => plus(dash(g) ? '' : fmt(g) + ' gold', dash(s) ? '' : fmt(s) + ' Boss Souls', dash(p) ? '' : `Map Level x ${fmt(p)} Points`)]] },
    'Stat board': { fold: ['Cap'] },
    'Copies: hero and pet': { join: true, ren: { Item: 'Items' } },
    'Stones': { group: 'Gear' },
    'Where to get stones and tokens': { by: ['From', (fr, ch) => H(fr) + (dash(ch) ? '' : ` <span class="small">${fmt(ch)}%</span>`)] },
    'Items that work from the pet bag': { group: 'Copies', glab: v => 'Copies: ' + esc(v) },
    'Best Boss Souls farm per zone': { merge: [[['Boss', 'Zone'], 'Boss', (b, z) => `${H(b)} <span class="small">· ${H(z)}</span>`]], ren: { 'Souls per kill (N1)': 'Souls / kill (N1)', 'Souls per minute (N1)': 'Souls / min (N1)' } },
    'Stage payout by difficulty': { merge: [[['Main', 'Challenge', 'Death'], 'Main / Chall. / Death', cut]] },
    'Run buys': { group: 'Where' },
    'Legacy gear and upgrades': { group: 'Where' },
    'Account unlocks': { group: 'Where' },
    'Endgame buys': { group: 'Where' },
    'Illidan by ticket tier': { ren: { 'World Points (every player)': 'World Points', 'Magic resistance %': 'Magic resist %' } },
    'World Points shop': { merge: [[['World Points', 'Points'], 'Price', (w, p) => plus(dash(w) ? '' : fmt(w) + ' World Points', dash(p) ? '' : fmt(p) + ' Points')]] },
    'Milestone rewards': { merge: [[['Bonus', 'Item (goes to your pet)'], 'Reward', (b, it) => plus(dash(b) ? '' : H(b), dash(it) ? '' : `${H(it)} <span class="small">(goes to your pet)</span>`)]] },
    'Title ladder': { merge: [[['Tier', 'Title'], 'Title', (n, t) => `${fmt(n)}. ${H(t)}`]], fold: ['Extra / gate'], bare: true },
    'Achievements': { group: 'Achievement' },
    'Minigame Master streaks': { flip: true },
    'Level-up tickets': { cards: true },
    'All books': { fold: ['Limits'] },
    'Talents': { group: 'Rerolled by', glab: v => esc({ 'A, Talent Change': 'Pool A (and the 30-Point change)', 'B, Talent Change': 'Pool B (and the 30-Point change)', 'A, B, Talent Change': 'Pools A and B (and the 30-Point change)', 'Talent Change': '30-Point change only' }[v] || v), merge: [[['Cooldown Lv1', 'Cooldown Lv5'], 'Cooldown Lv1 → Lv5', (a, b) => a === b ? fmt(a) : `${fmt(a)} → ${fmt(b)}`]] },
    'Shop challenges (only the ticket user is moved in)': { merge: [STR_RES], phone: true },
    'Drop-ticket challenges (all heroes are moved in, Treant Lord: only the user)': { merge: [[['Drops from', 'Chance %'], 'Ticket drops from', (d, c) => H(d) + (dash(c) ? '' : ` ${fmt(c)}%`)], STR_RES], phone: true },
    'Hidden hunts': { cards: true },
    'Key waves': { merge: [[['Avg HP (N1)', 'Avg HP (N9)'], 'Avg HP N1 / N9', cut]] },
    'Potions': { group: 'Get from' },
  };
  const prep = t => { const F = TFIX[t.title] || {}, ren = F.ren || {};
    let cols = (t.columns || []).slice(), rows = (t.rows || []).map(r => r.slice()), groups = null;
    for (const [cs, head, fn] of F.merge || []) { const is = cs.map(c => cols.indexOf(c)); if (is.some(i => i < 0)) continue; const i0 = Math.min(...is);
      rows = rows.map(r => r.map((c, i) => i === i0 ? hv(fn(...is.map(j => r[j])), is.map(j => r[j])) : c).filter((_, i) => i === i0 || !is.includes(i)));
      cols = cols.map((c, i) => i === i0 ? head : c).filter((_, i) => i === i0 || !is.includes(i)); }
    for (const c of F.fold || []) { const i = cols.indexOf(c); if (i < 1) continue;
      rows = rows.map(r => { const o = r.filter((_, j) => j !== i), v = r[i]; if (!dash(v) && v !== 0) o[0] = hv(`${H(r[0])} <span class="small">· ${F.bare ? '' : esc(ren[c] || c) + ': '}${H(v)}</span>`, [r[0], v]); return o; });
      cols = cols.filter((_, j) => j !== i); }
    const bucket = (key, val) => { const m = new Map(); rows.forEach(r => { const k = key(r); if (!m.has(k)) m.set(k, [val(r), []]); m.get(k)[1].push(r); }); return [...m.values()]; };
    if (F.join) rows = bucket(r => JSON.stringify(r.slice(1).map(txt)), r => r.slice(1)).map(([rest, L]) => [hv(L.map(r => H(r[0])).join(', '), L.map(r => r[0])), ...rest]);
    if (F.by) { rows = bucket(r => txt(r[0]), r => r[0]).map(([k, L]) => [k, hv(L.map(r => F.by[1](...r.slice(1))).join(' · '), L.flatMap(r => r.slice(1)))]); cols = [cols[0], F.by[0]]; }
    if (F.group) { const i = cols.indexOf(F.group); if (i >= 0 && cols.length > 1) { groups = bucket(r => txt(r[i]), r => r[i]).map(([v, L]) => [F.glab ? F.glab(v) : H(v), L.map(r => r.filter((_, j) => j !== i))]); cols = cols.filter((_, j) => j !== i); } }
    cols = cols.map(c => ren[c] || c);
    return { title: t.title || '', note: t.note, warn: t.warn, collapsed: !!t.collapsed, fit: t.fit || cols.length <= 3, cols, rows, groups, cards: F.cards, flip: F.flip, phone: F.phone && !groups,
      n: groups ? groups.reduce((a, g) => a + g[1].length, 0) : rows.length, strip: !F.cards && !F.flip && rows.length === 1 && cols.length >= 6 };
  };
  const trow = (r, s, nc) => `<tr${s ? ` data-s="${esc(r.map(txt).join(' ').toLowerCase())}"` : ''}>${r.map((c, i) => `<td${nc[i] ? ' class="num"' : ''}>${H(c)}</td>`).join('')}</tr>`;
  const cards = m => `<div class="sy-cards">${m.rows.map(r => `<div class="card"><b>${H(r[0])}</b>${m.cols.slice(1).map((c, i) => dash(r[i + 1]) ? '' : `<div class="sy-kl"><i>${esc(c)}</i> ${H(r[i + 1])}</div>`).join('')}</div>`).join('')}</div>`;
  const tHtml = (m, s) => {
    if (m.cards) return cards(m);
    const head = m.flip ? [esc(m.cols[0]), ...m.rows.map(r => H(r[0]))] : m.cols.map(esc);
    const body = m.flip ? [m.cols.slice(1).map((c, i) => [c, ...m.rows.map(r => r[i + 1])])] : m.groups ? m.groups.map(g => g[1]) : [m.rows], all = body.flat();
    const nc = head.map((_, i) => all.some(r => typeof r[i] === 'number') && all.every(r => dash(r[i]) || typeof r[i] === 'number'));   // right-align whole number columns
    const rows = body.map((L, gi) => (m.groups && !m.flip ? `<tr class="grp"><td colspan="${head.length}">${m.groups[gi][0]}</td></tr>` : '') + L.map(r => trow(r, s, nc)).join('')).join('');
    const tb = `<div class="tbl compact${m.fit && !m.flip ? ' fit' : ''}"><table><tr>${head.map((h, i) => `<th${nc[i] ? ' class="num"' : ''}>${h}</th>`).join('')}</tr>${rows}</table></div>`;
    return m.phone ? `<div class="sy-desk">${tb}</div><div class="sy-phone">${cards(m)}</div>` : tb;   // wide text tables: cards on a phone
  };
  const strip = m => `<div class="sy-strip"><b>${esc(m.title)}</b>${dash(m.rows[0][0]) ? '' : `<span class="small">${H(m.rows[0][0])}</span>`}${m.cols.slice(1).map((c, i) => `<span class="sy-sv"><i>${esc(c)}</i> ${H(m.rows[0][i + 1])}</span>`).join('')}${m.note ? `<span class="small sy-sn">${esc(m.note)}</span>` : ''}</div>`;
  const fold = (m, open) => { const s = m.n >= 24;
    return `<details class="sy-fold"${open ? ' open' : ''}><summary>${esc(m.title || 'Full table')} <span class="small">· ${fmt(m.n)} row${m.n === 1 ? '' : 's'}</span></summary><div class="sy-fb">`
      + (m.note ? `<p class="small">${esc(m.note)}</p>` : '') + (m.warn ? `<p class="warntext">${esc(m.warn)}</p>` : '')
      + (s ? `<p class="sy-find"><input class="tsearch" placeholder="Search this table"> <span class="tsearch-n small"></span></p>` : '') + tHtml(m, s) + `</div></details>`; };
  const table = t => { const m = prep(t); return m.strip ? strip(m) : fold(m, !m.collapsed); };
  K.table = table;
  const BULB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>';
  const AL = W.sys_alias || {};
  const body = (s, st) => { const how = s.how || [], tips = s.tips || [], ms = (s.tables || []).map(prep), list = ms.filter(m => !m.strip);
    const lead = list.find(m => st && m.title === st) || list.find(m => !m.collapsed);
    return (s.what || s.open ? `<p class="what">${esc(s.what || '')}${s.open ? ` <span class="small">· ${esc(s.open)}</span>` : ''}</p>` : '')
      + (how.length || tips.length ? `<div class="sys-grid${how.length && tips.length ? '' : ' one'}">${how.length ? `<div class="card"><h4 style="margin-top:0">How</h4><ol>${how.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}${tips.length ? `<div class="card tips"><h4 style="margin-top:0">${BULB}Tips</h4><ul>${tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}</div>` : '')
      + ms.filter(m => m.strip).map(strip).join('') + list.map(m => fold(m, m === lead)).join(''); };
  /* page chips remember each page's last section; a link or search hit (#systems/<section key>, old keys via sys_alias) selects its chip */
  const PG = {}; for (const p of SY) for (const x of (p.sections || [p])) PG[x.key] = p.key;
  const MEM = {}; let fresh = true, lastId = null, go = null;   /* go = the table / row a search hit points at */
  window.addEventListener('hashchange', () => { fresh = true; });
  const systabs = k => `<h2>Game systems</h2><div class="sub-tabs sy-pages">${SY.map((x, i) => `<a href="#systems/${MEM[x.key] || x.key}" class="${x.key === k ? 'on' : ''}">${esc(x.title || x.key)}</a>` + (i === 0 ? `<a href="#commands" class="${k === 'commands' ? 'on' : ''}">Commands</a>` : '')).join('')}</div>`;
  P.systems = (id, f) => {
    if (!SY.length) return '<h2>Game systems</h2><p class="small">Coming soon.</p>';
    const nav = fresh || id !== lastId; fresh = false; lastId = id;      // nav = arrived by a link; otherwise a chip re-render
    const want = id || f.sys || '', k0 = PG[want] || AL[want] || want;
    const k = SY.some(x => x.key === k0) ? k0 : SY[0].key, pg = SY.find(x => x.key === k), secs = pg.sections || [];
    const has = x => secs.some(y => y.key === x), st = nav ? f.syt || '' : ''; go = nav && (f.syt || f.syr) ? { t: f.syt || '', r: f.syr || '' } : null;
    const sk = !secs.length ? '' : nav ? (has(want) ? want : MEM[k] || secs[0].key) : has(f.sec) ? f.sec : MEM[k] || secs[0].key;
    delete K.filters.syt; delete K.filters.syr; K.filters.sys = k; if (sk) K.filters.sec = MEM[k] = sk;
    return systabs(k) + (secs.length > 1 ? `<div class="sy-secs">${subtabs('systems', 'sec', secs.map(y => [y.key, y.title || y.key]), sk)}</div>` : '')
      + body(secs.find(y => y.key === sk) || pg, st);
  };
  const ROWS_IX = { 'Terms': 'term', 'Stat board': 'stat' };   /* tables whose rows are search hits of their own */
  for (const s of SY) for (const x of (s.sections || [s])) { INDEX.push({ k: 'systems', id: x.key, t: x.title || x.key, s: String(x.what || '').slice(0, 110), w: 5 });
    if ((x.tables || []).length > 1) for (const t of x.tables) if (t.title && t.title !== x.title) INDEX.push({ k: 'systems?syt=' + encodeURIComponent(t.title), id: x.key, t: t.title, s: 'table · ' + (x.title || x.key), w: 3 });
    for (const t of (x.tables || []).filter(t => ROWS_IX[t.title])) for (const r of t.rows || []) { const nm = txt(r[0]).trim(); if (nm) INDEX.push({ k: 'systems?syt=' + encodeURIComponent(t.title) + '&syr=' + encodeURIComponent(nm), id: x.key, t: nm, s: ROWS_IX[t.title] + ' · ' + txt(r[1]).slice(0, 110), w: 4 }); } }
  K.hooks.push((page, root) => { if (page !== 'systems' || !go) return; const g = go; go = null;
    const fold = [...root.querySelectorAll('details.sy-fold[open]')].find(d => !g.t || d.querySelector('summary').textContent.trim().startsWith(g.t));
    const row = g.r && fold ? [...fold.querySelectorAll('tr')].find(r => r.cells[0] && r.cells[0].tagName === 'TD' && r.cells[0].textContent.trim().toLowerCase().startsWith(g.r.toLowerCase())) : null;
    if (row) row.classList.add('gl-hit'); const el = row || fold; if (el) setTimeout(() => el.scrollIntoView({ block: row ? 'center' : 'start' }), 0); });

  /* ---- commands: only what the map itself tells players, grouped ---- */
  const CMDG = { '-save': 'Save and account', '-achievements': 'Save and account', '-jf': 'Save and account', '-sj': 'Save and account', '-ml / -maplevel': 'Save and account',
    '-xb': 'Hero and pet', '-fuhuo': 'Hero and pet', '-niao': 'Hero and pet', '-ms': 'Hero and pet', '-bug': 'Hero and pet', '-qc': 'Lobby and screen', '-on / -off': 'Lobby and screen', '-jt<number>': 'Lobby and screen', '-tr2 / -tr3 / -tr4': 'Lobby and screen',
    '-lx': 'For one item or hero', '-hdxs': 'For one item or hero', '-xn': 'For one item or hero', '-xf': 'For one item or hero' };
  P.commands = () => { const m = new Map(); for (const c of (W.commands || [])) { const g = CMDG[c.cmd] || 'Other'; if (!m.has(g)) m.set(g, []); m.get(g).push(c); }
    return systabs('commands') + `<div class="tbl compact fit sy-cmd"><table><tr><th>Command</th><th>What it does</th></tr>${[...m].map(([g, L]) => `<tr class="grp"><td colspan="2">${esc(g)}</td></tr>` + L.map(c => `<tr><td><code>${esc(c.cmd)}</code></td><td>${esc(c.does)}</td></tr>`).join('')).join('')}</table></div>`; };
  for (const c of (W.commands || [])) INDEX.push({ k: 'commands', id: '', t: c.cmd, s: c.does, w: 3 });

  /* ---- changelog: one entry per DAY (date only), newest first; every category once per day, in this order:
     Map update, Zones, Monsters, Heroes, Items, Quests, Legacy, Game systems, Calculators, Whole wiki. New lines merge into today's category. ---- */
  const CHANGES = [
    ['27 Sep 2026', [
      ['Map update', [
        'Wiki follows map 1.04. Every Legacy line now evolves from the Bag or either Storage, on its difficulty or higher (mode and hero rules unchanged). The new item lands in the same bag.',
        'One kill moves each Legacy item one step, and two lines on the same boss both move.',
        'Skeleton Belt, Gray Axe and Survival Gloves 1 now drop on every difficulty.',
        'Adult Black Dragon now shows up on N4+ and the Jungle Guardian Spirit on N5+, so Grimoire and 3rd-Generation Legacy Arrow steps work on higher N too.',
        'Bonuses Mantle is now a Player Bonus gift at Map Level 31+ for every player: +20% All stats amp, +10 x N x N All stats, works from the pet.',
        'The Curse Blade + Refined Sword refund takes both swords back. -qc now really clears ground loot (Player Red only).',
      ]],
      ['Calculators', [
        'Run planner: Mid and Late gear lines say what each new item replaces, with a Swaps row per part (sell, drop or pet bag).',
        'Run planner: Frodo’s quest chain now sits where your route reaches the last hunt boss (Centaur Khan), and Firelands steps come after it.',
        'Run planner: optional farm-rate selector for Boss Souls and gold per minute (runs and plans are unchanged).',
        'Run planner: every item, boss, quest and zone in the step hints is now a link, and your picked bonus item shows up in the route itself (gear row, skipped pickups, swaps).',
        'Run planner: no Bag swaps for Legacy upgrades any more, chance items can sit in a Storage, and N+ steps count on every higher difficulty.',
        'Run planner: the Bonuses Mantle sits in your pet bag from Map Level 31.',
      ]],
    ]],
    ['26 Sep 2026', [
      ['Map update', [
        'Wiki follows map 1.03. War God of the North is single-rank again: Powerful Slash Str x7, Axe Throw Str x2, Blood Sacrifice 40% Max HP, Battle Spirit up to +30% base Str and +10% spell lifesteal, War God Transformation 95 s.',
        'Mana Mage Magic Power: +1% Skill amp per 5 base All stats. Immortal King Wraith Bind: the -40 Armor stacks again, no limit.',
        'Death\'s Reprieve Necklace: every step works on its difficulty or higher and evolves from the Bag or either Storage. The other 14 Legacy lines are unchanged.',
        'Jarvan V pays Points on his first kill only. Nature Guardian respawns 60 s after each death: Nature Strength and a Fist roll every kill, and its Legacy Arrow step can be retried.',
        'Revival Cross no longer revives a dead hero (50,000 gold back). -fuhuo needs and uses a revive. -qc works for Player Red only.',
        'New names from the map: Wooden, Copper and Steel Guard, Fortress Light Talisman, Guardian - [Scroll].',
      ]],
      ['Items', [
        'Legacy: kill steps count any unit you own (pet and summons too); solo lobby steps need player slots 2-4 empty the whole game.',
        'Item pages show where exactly: a pin map for drops from Rock Chunks, barrels, cages and single units (Dragon Ball: all 7 spots). Walled-in spots say how to reach them.',
        'Fixed: Silver Codex STR amp +80% is for the Paladin. The Curse Blade + Refined Sword refund stops the swords from next game, it does not take the ones you hold.',
      ]],
      ['Calculators', [
        'Run planner cards show each upgrade as from → to with what sets the run (e.g. Frost Shield → Frigid Round Shield (Challenge, Wandering Swordsman)), and where each new Legacy item drops.',
        'All kill counts, drop farms and enhancing costs now use average luck (e.g. Cloth Helmet to 5: ~50 Wyverns, +20 Legacy stones ~15,700 Boss Souls).',
        'Run planner card rebuilt for play: one step per row with a tick box and NEXT marker, coloured GET / BUY / ENHANCE / LEGACY / FARM / GATE badges, gear, pet bag, rune and skills shown at the top of each part. Pick your Player Bonus / Beginner item: the card says whether to wear it and how it upgrades.',
        'Run planner: pet bag back in Before you start (free start gift tagged), Frodo’s chain sits where your hero can finish it, Absolute Ring after the boat.',
        'Run planner Souls farm: the Flame Lord (30 s respawn) now counts once your run opens the Firelands for a Legacy item, not only for gear.',
        'Run planner: bosses open from the start (Centaur Khan, Troll Boss ...) no longer say go straight there at level 1: the fight check assumes your end-of-Early level, so the card now plays the Early part first.',
        'Run planner BUY lines also name the best monster drop you could farm instead (e.g. Agile Hood · or drop: Bristleback Healer 1.3%, ~80 kills).',
        'Points per run: Jarvan V counts once (map 1.03).',
      ]],
    ]],
    ['25 Sep 2026', [
      ['Zones', [
        'Zones tab = the route of your run at your difficulty: Early, Mid, Late, After the main quest. One small card per zone, only main-route zones numbered.',
        'Zone maps zoom in and outline the zone in gold. Boss and NPC maps centre on them.',
        'Map: clearer colours, every portal, path and gate shows where it leads, names never overlap. Fixed: 3 portals listed under the wrong zone.',
      ]],
      ['Monsters', [
        'Boss DPS next to damage per hit (more Agility = up to 5x faster), scaled to your difficulty.',
        'Monsters by stage of your run, zone groups, search. Tap any monster for a card: small map, level, HP, gold, drops.',
        'Bosses sorted by type with a Points tag. Boss pages shorter, fight rules folded.',
      ]],
      ['Heroes', [
        'Tier list: compact S/A/B/C board with search, rates the whole run (Early 25%, Mid 35%, Late 40%). Tap a hero for its speed, again for its page.',
        'Tier list and guides assume a normal run: gear you can farm by each stage, up to your stage boss, rare drops left out. Best in slot switch for the no-limit build.',
        'All 99 kits re-checked in the map (Magic Cycle, stacking stats, armor break, stat conversions, illusions). Every build gets its rune, Level 35 / 100 books and enhanced gear.',
        'Bosses fight as they really do: attack speed, armor, heals, invulnerable phases, adds. A death resets the fight.',
        'Mana counts: casters can run dry early on N1-3.',
        '258 items with procs and auras count, on-cast effects fire only on real casts, shared procs once.',
        'Skills level with your hero. Hero levels from full-run sims (N1-3: about 30 / 64 / 100 at the end of Early / Mid / Late).',
        'Challenge and Death: own kill speed, veteran account, x2 / x3 stage Points, mode-only item bonuses. Heroes that finish rank first, the rest show how far they get.',
        'Hero pages: build guide first (6 slots per stage, Key item, Legacy goal, stat priority), one skill-order line, skills folded.',
        'Heroes tab: one column per main stat. Red STR, green AGI, blue INT badges everywhere.',
        'Fixed: every hero got a free Comprehensive Enhancement book.',
      ]],
      ['Items', [
        'When on every item for N1-3 / N4-6 / N7-9, from its real source: bosses you can beat, gates, tickets, recipe parts, drop chances.',
        'How to get on every crafted item: numbered steps, recipe scroll last (used up on pickup).',
        'Evolution card on 13 item lines (e.g. Giant Scythe to Abyss Scythe), forks and 5% crafts included.',
        'Items that need an NPC talk first say so (Staff, Void Soul Fragment, Spirit King fragments, Outland Evil Soul, Corrupted Elf Soul).',
        'Points starting swords added, with their start merges (Val\'anyr, Massacre Blade, Dimensional Destroyer).',
        '326 item effects rewritten in plain words with real numbers.',
        'Items: 20 rows at a time, When and Has stat filters. Recipes: search all 260.',
        'Fixed: Flame Heart crafts are one per player per game, Nature Strength comes from the Nature Guardian (the Frostlands crate is walled in).',
      ]],
      ['Quests', [
        'Main / Side chips, main quest in stages, side quests by NPC with search. Tap a spot for a small map.',
      ]],
      ['Legacy', [
        'Every Legacy item leads with how to start its line, what unlocks it, what\'s next and who can do the next step.',
        '+20 steps say where the stones are (Holy Light Fortress, about 15,700 Boss Souls, 6,500 with Protection Stones).',
        'Divine Arrow and Divine Armor Seal lines plan end to end on N7-9.',
        'Fixed: stats on 1,163 steps (+1,000 read as +1), Ashen Reaper sent backwards, Cloth Helmet 3 to 4 needs boss kills.',
      ]],
      ['Game systems', [
        'New Spending Points page: starting gear, titles, rolls, Legacy evolve items.',
        'Difficulties: No pick row (N1 with 100% monster HP).',
        'Fixed -fuhuo: the copy loses its EXP bar, bonus stats and passives and counts as Human.',
        'Commands: player commands only, -ms and -bug added.',
        'Modes: the Challenge / Death damage cut hits true damage too, illusions never cut.',
        'Trimmed: repeats cut, Potions 31 rows to 13, section chips, tables fold.',
      ]],
      ['Calculators', [
        'New Run planner (beta): load your save (Legacy, Points, Map Level, title, World Points) or pick by hand. Only heroes you can pick.',
        'Goals: Legacy (most upgrades, 112 of 123 plannable), Points, First Legacy items.',
        'Each run replayed 26 times as a normal player: finish chance on every card, runs under 5 in 10 hidden, a tag for new players.',
        'Gear level: Just enough / A bit more / Overgeared, plus a rare-drop farming switch.',
        'Routes list every prerequisite: gate bosses, keys, arena and Spirit King tickets, Shadow Lord, Frodo\'s chain (one line, Show steps).',
        'Step list: skill order, pet bag, rune and books, where to farm each item and Boss Souls, Legacy Bag per run, free evolutions on the way.',
        'Next buy line: the title that pays back, or keep your Points.',
        'No clock times: runs are short / medium / long, farming in kills and Boss Souls.',
        'Fixed: Death N9 offered to a Map Level 26 account, Windmill Village Chief fight rule.',
        'Points per run: results next to the inputs, every Jarvan V kill counts. Enhancing: Normal or Legacy gear.',
        'Run cards shorter, quest steps folded, plain tags (Full clear OK, X/10 test runs finished, Beginner-friendly) with a tag key.',
      ]],
      ['Whole wiki', [
        'Header shows the last update.',
        'Quick-look cards on every cross-tab link, links inside swap in place with a back arrow.',
        'Search finds items by wiki name, side quests, stats and Terms.',
        'Every tab trimmed: shorter notes, filters on the chip row, one-row tab bar on phones.',
        'Str/Agi/Int is All stats everywhere.',
      ]],
    ]],
    ['24 Sep 2026', [
      ['Map update', [
        'Real numbers everywhere: about 410 spots that showed a tooltip value now show what the game really does (183 Legacy steps, 125 hero skills, every system page).',
      ]],
      ['Zones', [
        'How to get there on every zone and boss: routes between zones and back, where the Dragon Turtle and Green Dragon Key gates are, the Goblin Shipyard boat (4,000 gold, the whole party fits), portals and the Firelands scroll. Every zone lists its Energy Circles.',
        'Zone list shows Gold per kill and tags side zones. Teleport is only blocked by a boss within 700 range, not by normal monsters.',
        'New Map tab: the whole map drawn from the map file, with every Teleport Stone, Energy Circle, portal (and where it leads), gate and boss. Drag, zoom, tap a marker. Every zone and boss page has its own small map.',
        'How to get there rewritten for all 32 zones and every boss: one short line each, zone names are links.',
        'Zone pages: quests show who gives them, quest givers left the shop list, same-name shops (Universal Skill Trainer) grouped.',
        'Map: tap a portal to see only its entrance and exit, tap anything for a small panel (boss HP and damage for your difficulty, drops, quests given, what opens a gate). Quest givers have their own ! marker.',
        'Zones in quest order with side zones after the zone they branch from, a legend line (SIDE, lit, portals stay open), danger notes on early side zones. Boats: both Goblin Shipyards, 4,000 gold, 10 units. True Fortress and the Steel Seal explained. Boss arena entry rules the same on every page.',
      ]],
      ['Monsters', [
        'Cleaner drop tables: conditional drops read clearly, repeated notes said once, HP columns say which difficulty they show.',
        'Adult Black Dragon added (N4 only, Dark Forest, after the Young Black Dragon dies).',
        'Boss "Hit" column renamed to Damage per hit. Bosses list: new Mode picker, a Points column with one number for your difficulty and mode, and a Pays Points filter. Sort by HP to see the bosses from easiest to hardest.',
        'Boss pages show real Armor for your difficulty (it was missing each boss base armor) and how much physical damage it blocks. Other difficulties stage bosses show pays on N#. Drop pools say what they give (random Normal item, 1 of 8).',
      ]],
      ['Heroes', [
        'About 30 skills that had no numbers now say exactly what they do, about 55 hero item bonuses are listed (Prophet Soul, Coin of Fate and more), traits show the real starting bonus, and a new Open at start filter shows who you can pick right away.',
        'Heroes list: two filters that combine, Stat (STR / AGI / INT / World) and Unlock (Open / World Points / Map Level / Solo lobby), open heroes first. Hero pages: no empty rows.',
        'Tier list now comes from a damage calculator: every hero’s checked skill formulas at a typical build per band, against that band’s reference boss and monster pack, weighted by what the mode needs (boss kill, pack clear, survival). Hover or tap a hero for its numbers.',
        'New Tier list tab: S/A/B/C for Main, Challenge and Death on N1-3, N4-6 and N7-9, from three independent rankings of the checked hero and boss data, with damage-type tags and unlock tags.',
        'Every hero skill and trait checked against the map: 84 skill texts fixed (stuns, ranges, damage types, hit counts, Magic Cycle bonuses), e.g. Tauren Chieftain W is 6% less damage taken, not immunity.',
      ]],
      ['Items', [
        'Every missing icon now shows a default from the map instead of an empty box. Items sort by the zone you get them in, sealed copies fold into their item, duplicate sources are gone, and crafted items show where the scroll is sold.',
        'Chest and draw chances fixed: a roll range like 91-96 is 6%, not 9.6%. Random pools show the chance per item. Items without stats show their effect.',
        'All 57 Runes show their real numbers per Rune level (chance, damage, cooldown), plus the one-Rune rule.',
        'Other tab is now Universal skills: every book with its effect at book level 1 to 5. Rune and skill pages show the real numbers instead of the tooltip text.',
        'Ticket tab split into Exchanges, Titles, Boss tickets, Keys, Quests and Bonuses and draws. Where from reads cleaner (no doubled words). Recipes: a sealed craft and its unseal are one row.',
        'Rune and Universal skill hits can crit like any hit (Crit Damage applies), now said on both tabs. 9 item zones fixed. Sealed gear rule said once. Hero names in item lines use the map names.',
        'Full check of every item, Rune and Universal skill against the in-game tooltip and the map: about 400 fixes. Fixed Enhance +N stones set the item to exactly +N and can lower it.',
      ]],
      ['Quests', [
        'Main quest rebuilt as a step-by-step guide: every monster, NPC, item and zone is a link, with Gate and Difficulty columns, the real Points on steps 21-29 and a route for every zone change.',
        'New step 0 for the first minute, every quest NPC has its spot, the traps sit in their step (Steel Fortress turning hostile, the wrong portal, the Shadow Monster), each last step tells you to -save, and step 21 warns how strong the Adult Green Dragon is.',
        'Main quest cut to Where / Do / Reward, one short line per step, the rules said once on top.',
        'Side quests: All / Boss kills / Hidden filters, only one-time quests are tagged, rewards read One of: ...',
      ]],
      ['Legacy', [
        'New Your first Legacy item box and easy starters. Lines are grouped by slot with their final item.',
        'Starters table with zone and when, the Legacy Bag rules in one box, seal wording fixed, new average enhance cost table.',
        'Find my step on every Legacy line: type your current item, see the next steps.',
        'Lines table: new First 3 steps need column (hero, N, mode, enhance level).',
        'All 1,976 Legacy steps checked against the map: 7 evolve conditions fixed.',
      ]],
      ['Game systems', [
        'New Terms page. Less clutter: weak tips and repeated tables cut, Stats moved up. New Best Boss Souls farms table.',
        'Boss Souls farm per zone. Points page: sources first, late spends folded. -fuhuo and -maplevel listed, -save lists everything it keeps.',
        'Game systems cut from 19 pages to 9 (related pages merged into sections). Most tips removed: only real tricks stay. Every page trimmed.',
        'World Boss: N7+ Main only (the old N1 tip was wrong). Farming Points table on Points. Mode effects said once, plainly. Challenge ticket prices added. Enhancing: +20 average cost said once, one name per stone.',
        'Attack amp is NOT dead: it adds that % of your total main stat as green attack damage (proven in game). Universal skill level 5 aura values fixed (Concentration Aura +300 Armor, Demon Energy -220).',
      ]],
      ['Whole wiki', [
        'English title on the map banner. Fresh players read the wiki cold (twice), everything that confused them was fixed.',
        'Table columns that only a row or two use are folded into the first cell, so tables are narrower.',
        'Click any column name in any table to sort it, click again to flip.',
        'One Difficulty + Mode picker at the top, remembered on every page. New tab order, Commands moved into Game systems. A column with the same value on every row is said once above the table. About 150 wording cuts.',
      ]],
    ]],
    ['23 Sep 2026', [
      ['Map update', [
        'Wiki now follows map version 1.02. Steel Fortress drops are per player, Jarvan V comes back 10 s after he and G.S.D die, Flame Demon gives everyone a Flame Heart, repeat quests restart by themselves, and War God of the North, Storm Warrior, Immortal King, Beastmaster and Night Demon King got their 1.02 fixes.',
      ]],
      ['Zones', [
        'New Zones tab: all 33 zones in the order the main quest walks them, with monsters, bosses, quests, shops and how to get there. Key gates, boss portals, the ship and the Firelands scroll are all spelled out.',
      ]],
      ['Monsters', [
        'Monsters and bosses rebuilt from the map: HP, hit and Boss Souls for any difficulty, full drop tables. Bosses hit for their Intelligence, not their Strength.',
      ]],
      ['Heroes', [
        'All 99 hero pages rebuilt: kit items, gates and each hero\'s real starting bonus on top, then every skill in a compact row with its map icon.',
      ]],
      ['Items', [
        '1,080 items rebuilt with every source in one table, rarity colours from the game, and 346 recipes. Unobtainable, test and paid items are gone.',
      ]],
      ['Quests', [
        'Main quest (29 steps) and 30 side quests with the real reward chances.',
      ]],
      ['Legacy', [
        'All 15 Legacy lines, 1,976 steps: a short Key steps table per line, the full chain folded, solo and hero gates on every step.',
      ]],
      ['Game systems', [
        '18 system pages rebuilt from scratch and checked in the map again, each with the 1-3 rules you won\'t spot by playing, real tricks only, and clean tables.',
        'Fixed on the way: 35 items work from the pet bag (not 50), Survival monsters have 20,000-80,000 x difficulty x wave HP, the Equipment Draw Horn is 1 in 20,000, Minigame Master gives Protection Stones, and universal books have no separate pools.',
      ]],
      ['Calculators', [
        'New Calculators tab: Points per run with the runs to your next title, and enhancing cost in Boss Souls, tokens and Protection Stones for any level range.',
      ]],
      ['Whole wiki', [
        'New look from the map itself: loading-screen banner, its colours, in-game rarity colours and icons. Clean Home page with the map\'s Discord. Map codes and dev notes are gone everywhere.',
      ]],
    ]],
  ];
  { const u = document.getElementById('wupd'); if (u && CHANGES[0]) u.textContent = CHANGES[0][0]; }   // header date = newest changelog entry
  K.changes = CHANGES;                          /* Home shows the newest date */
  /* newest day open, older days folded to one line (date · count · categories); categories are small labels, not headings */
  P.changelog = () => `<h2>Changelog</h2>${CHANGES.map(([d, cats], i) => { const nn = cats.reduce((a, c) => a + c[1].length, 0);
    return `<details class="cg-day"${i ? '' : ' open'}><summary><b>${esc(d)}</b><span class="small"> · ${nn} change${nn === 1 ? '' : 's'}</span><span class="small cg-cats">: ${esc(cats.map(c => c[0]).join(', '))}</span></summary>${cats.map(([c, xs]) => `<div class="cg-cat"><span class="tag">${esc(c)}</span><ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</details>`; }).join('')}`;
  P.credits = () => `<h2>Credits</h2><ul><li>The Adventurer's Path RPG 1.04: original Chinese map Zhengcheng Zhi Lu by Suifeng Erdong, Reforged port by Gwelawyr.</li><li><b>Special thanks: Beast (draelokk)</b>, for tons of testing and feedback.</li><li>Built with Anthropic's Claude.</li></ul>`;
})(window.AP);
