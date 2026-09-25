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
    'Title ladder': { merge: [[['Tier', 'Title'], 'Title', (n, t) => `${fmt(n)}. ${H(t)}`]], fold: ['Extra / gate'] },
    'Achievements': { group: 'Achievement' },
    'Minigame Master streaks': { flip: true },
    'Level-up tickets': { cards: true },
    'All books': { fold: ['Limits'] },
    'Talents': { group: 'Rerolled by', glab: v => 'Rerolled by: ' + esc(v), merge: [[['Cooldown Lv1', 'Cooldown Lv5'], 'Cooldown Lv1 → Lv5', (a, b) => a === b ? fmt(a) : `${fmt(a)} → ${fmt(b)}`]] },
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
      rows = rows.map(r => { const o = r.filter((_, j) => j !== i), v = r[i]; if (!dash(v) && v !== 0) o[0] = hv(`${H(r[0])} <span class="small">· ${esc(ren[c] || c)}: ${H(v)}</span>`, [r[0], v]); return o; });
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
    '-xb': 'Hero and pet', '-fuhuo': 'Hero and pet', '-niao': 'Hero and pet', '-qc': 'Lobby and screen', '-on / -off': 'Lobby and screen', '-jt<number>': 'Lobby and screen', '-tr2 / -tr3 / -tr4': 'Lobby and screen',
    '-lx': 'For one item or hero', '-hdxs': 'For one item or hero', '-xn': 'For one item or hero', '-xf': 'For one item or hero' };
  P.commands = () => { const m = new Map(); for (const c of (W.commands || [])) { const g = CMDG[c.cmd] || 'Other'; if (!m.has(g)) m.set(g, []); m.get(g).push(c); }
    return systabs('commands') + `<div class="tbl compact fit sy-cmd"><table><tr><th>Command</th><th>What it does</th></tr>${[...m].map(([g, L]) => `<tr class="grp"><td colspan="2">${esc(g)}</td></tr>` + L.map(c => `<tr><td><code>${esc(c.cmd)}</code></td><td>${esc(c.does)}</td></tr>`).join('')).join('')}</table></div>`; };
  for (const c of (W.commands || [])) INDEX.push({ k: 'commands', id: '', t: c.cmd, s: c.does, w: 3 });

  /* ---- changelog: one entry per DAY (date only), newest first; every category once per day, in this order:
     Map update, Zones, Monsters, Heroes, Items, Quests, Legacy, Game systems, Calculators, Whole wiki. New lines merge into today's category. ---- */
  const CHANGES = [
    ['25 Sep 2026', [
      ['Zones', [
        'Zone numbers now count only the main route (1, 2, 3 ...); side zones show no number.',
        'Zones tab is the route of your run at your difficulty: Early, Mid, Late and After the main quest, one small card per zone (level, bosses), side zones marked, one search. Tap a zone for its map, bosses, shops and quests.',
        'Zone maps zoom in tight on the zone, dim everything else and outline it in gold. A boss or NPC map centres on it.',
        'Map: clearer colours on both themes, every portal, path and gate shows where it leads (arrow + the target zone lit), arena bosses in one marker, names never overlap, taps open the panel in place. 3 portals were listed under the wrong zone (fixed).',
      ]],
      ['Monsters', [
        'Boss DPS next to damage per hit (bosses attack at very different speeds; more Agility = faster, up to 5x), on boss pages, lists and quick-look cards. Monster damage and DPS follow your difficulty.',
        'Monsters: chips by stage of your run, zone groups, search. Tap a monster or boss anywhere for its card with a small map (spawn spots ringed in gold), level, HP, gold and drops. Bosses sorted by type with a Points tag for your difficulty, boss pages shorter, fight rules folded.',
      ]],
      ['Heroes', [
        'Mana counts: skills cost their real mana (regen = INT x 0.04 per second), so casters can run dry. Big on N1-3 early (Demon Hunter Immolation, Death Knight, Fire Mage, Ice Witch clear packs about 2x slower), almost no change later.',
        'Item effects fixed: on-cast effects fire only on real skill casts, not on passive or aura ticks (Lich was far too fast), rune and book booster items work (22 items), shared procs fire once when you hold several, Priestess night items, race relics, set reflect and Strike Back count.',
        'Item effects now count in every fight: 258 items with procs, auras and on-cast hits read from the map code (Lost Ruby, Wooden Gong of Harmony, Elunise and more), each effect once, sealed items only after unsealing.',
        'Difficulty aura checked in game: monsters from N2 up hit harder and attack faster (N9: x100 damage, +300% attack speed), bosses do not get it. Boss HP stops at the game limit (about 2.1 billion: Doom Lord N8), % max HP hits count against that. A one-shot kills through lifesteal. The N7-9 tier list assumes a Map Level 100 player (Count title, deep Legacy).',
        'Universal skill books come at their real hero level (35 / 100): slot 1 is level 5 after one Ancient Snow Beast quest, slot 2 stays level 1 unless you run Water Supplies (N7-9). Fixed: every hero got a free Comprehensive Enhancement on top of its own book.',
        'Pet bag: builds fill the 6 pet slots with bag items too (copy limits as in the map), hero guides list them.',
        'More power counted: the free +30 stone at Map Level 90+ and Challenge Tokens (+20 to +25), once per run on the item you end with, the level 60 talent (average of the 17) and Points you hold (Ranking Reward) on Your account.',
        'Damage calculator re-checked against the map code: skills scale with their real level (Immortal King Q passive = Q x W, items no longer tied to same-name skills), lifesteal from the right hits, summons crit, magic resistance and cooldown caps as in the map.',
        'Tier list: one plain line says what the list shows (difficulty, mode, normal player or your account), extra switches sit under Options, a short legend explains the tags on screen. With a save loaded it shows your account by default; without one, a link takes you to load it.',
        'Tier list and guides stop at the stage boss of your difficulty: items from zones after it no longer count. A fast tag marks the quickest runs with light gear.',
        'Skills now level with your hero (1 point per level, the ultimate when it unlocks, then the skills that help the fight most). Early fights on high difficulties got much harder, late fights did not change. Hero pages show the same skill order.',
        'Hero levels from a full-run simulation: end of Early / Mid / Late about 30 / 64 / 100 on N1-3, 31 / 53 / 114 on N4-6, 25 / 93 / 123 on N7-9 (Challenge and Death higher: longer runs).',
        'Death N1-N3 tier note: why Void Walker stops some heroes there (it heals from your hits below 50% HP).',
        'Hero pages: skill order is one priority line (R whenever it unlocks › Q › W › E, with the level each rank needs) for your difficulty and mode.',
        'Hero pages: the build guide now comes before the skills.',
        'Heroes tab: one column per main stat with tier letters for your difficulty and mode, one stat at a time on phones. Hero pages: one header card, skills folded.',
        'Build guide: all 6 slots for the early, mid and late part of one run at your difficulty and mode, only with items you can really get by then (kept items and cheap starter gear tagged), plus Legacy goals and stat priority. A Key item line when one item changes a hero a lot (Heart Sword for Blademaster).',
        'Tier list: a compact S/A/B/C board with search (finds tags like true dmg) that rates the whole run (Early 25%, Mid 35%, Late 40%), with Early / Mid / Late chips. Hover or tap a hero for its speed next to an average hero, click or tap again for its page.',
        'Tier list: all 99 kits re-checked in the code (Magic Cycle upgrades, stacking stats, armor break, stat conversions, locked attack speed, illusion damage), each hero with its own best items and a Legacy bag.',
        'Every build now has its best rune (level 5) and Level 35 / 100 universal skills, enhances its gear with the run’s Boss Souls, and fights each boss as it really is: attack speed, attack type vs hero armor, heals, invulnerable phases, adds.',
        'A death resets a boss fight (you revive in town, the boss heals), so a hero must outlast every boss the run needs.',
        'Tier list and build guides now assume a normal run: each stage only holds gear you can farm in that stage (bad luck and look-up time included), gold, Boss Souls and Points added up per build, rare drops left out. Tick Best in slot for the no-limit build.',
        'Challenge and Death: their own kill speed (Death farming up to 12x slower) and a longer farming budget, survival gear first and a veteran account (Map Level 35 to 150, titles and deep Legacy, higher on harder bands). Items that double or triple in Death (Death Scroll, Dead Scroll, Dragonrin Fragment and more) and Berserk Soul Shield in Challenge count. Heroes that finish the run (every required main-quest boss within your revives) rank first, the rest show how far they get (gets to X).',
        'Challenge and Death: boss difficulty for drops uses the veteran account those modes assume, gold and Boss Souls come at the mode’s farming speed, and stage Points pay x2 (Challenge) / x3 (Death).',
        'Main stat shown on every hero: a red STR, green AGI or blue INT badge and card edge (tier board, World Heroes), a coloured dot on hero links.',
      ]],
      ['Items', [
        'The Points starting swords are in the item list: Soul-Dominating Demonic Sword and Storm Sword Lv 1-3, Windseeker’s Blessed Sword, Mithril Holy Sword, Curse Blade, Refined Sword, and what they merge into at the start (Val’anyr, Massacre Blade, Dimensional Destroyer). Only your highest level, only for the account that bought it, works from the pet bag.',
        'Difficulties: a No pick row (wait out the 30 s timer): N1 rules with 100% monster HP instead of 150%.',
        'Evolution card on every item in a line (13 lines, e.g. Giant Scythe to Abyss Scythe): each step and what it needs, forks and the rare 5% craft results.',
        'Items that need an NPC talk first now say so: the Staff (Prophet, with the Insignia), Void Soul Fragment (Wonder Woman, 100+ Wyvern Scales), Spirit King fragments and tickets (Anduin, Divine Arrow Seal 10 in the Legacy Bag), Outland Evil Soul, Corrupted Elf Soul, all N7+. Armor Fragment lists all 4 crates.',
        'Item timing: those drops no longer count on N1-6. Naga Coast, Ferocious Beast Path, Azure Dragon Lair and the Elf Sisters’ Land open once you beat the Storm Beast Gatekeeper and Evil Jaina.',
        'Flame Heart and its crafts (Dragon Transformation Stone, Sands of Time and more): one per player per game.',
        'Builds never spend Points: Points stay for titles and Legacy, so crafts use drops instead of Points Merchant packs. Challenge and Death stage Points now include the N5+ bonus.',
        'Items: 20 rows at a time, a When filter (by N1-3 / N4-6 / N7-9) next to Has stat, tap a row for its card. Stats hidden in effect text count (e.g. Dawn Shield Magic resist 25%).',
        'When on every item is per difficulty (N1-3 / N4-6 / N7-9: early, mid or late in the run, how hard), worked out from the real source: can you beat the boss that drops it, gates and tickets, recipe parts, drop chances, gold. Quest rewards count what the quest really asks (Magic Ring needs the Flame Lord: late on N1-3), Refining Stone gear is N7+ only, and every item says what decides its timing.',
        'Sea God’s Bright Moon Staff: the Death +50% only works on Bullet Mage. The 12-gem hero exclusives need Light Guardian Fortress (after Evil Jaina).',
        'Carry-and-kill evolutions (the scythe line up to Abyss Scythe) count their route kills as nearly free. Drops are planned for 85 players in 100 (a 10% drop = 18 kills).',
        'Item timing re-checked item by item in the code: Boss Souls prices (Tombstone of Oblivion 40,000), one Special Merchant trade per game, one-roll drops (Nature Guardian, barrels, fortress heroes), Light Guardian Fortress only after Evil Jaina, Firelands after the Boss Hunt, the Ringwraith growing x1.5 each kill (Nazgul Claw: not on N1-3).',
        'Item timing redone: Early now means the first zones of your run (Start Camp to Steel Fortress on N1-3). Points buys no longer count as early (they cost many runs of Points), a boss counts only once its zone is on your route, quest rewards count where the task is, evolutions count their kills, and an early item has to be quick to get.',
        'Item timing third pass: a boss counts only once it is no harder to survive than the bosses your run needs (a death resets the fight), Firelands evolve kills need the Boss Hunt first, quest items you must bring cost their gold, Souls or Points, repeat-quest rewards come on the Nth clear (Hunter’s Heirloom: 5th Troll Boss Hunt), super-rare drops no longer set an item’s stage.',
        'Hero kit items handed out at a hero level (Flower sin Hammer at level 150) count only once the run gets there.',
        'Crafts that need a part at +10 / +20 (the Sources, Nature Boots) now pay the enhancing (about 690 / 5,600 Boss Souls). Nameless Treasure Bag: one sure bag, then 1 in 6 kills. Points Merchant packs are bought whole (Dark Core only as 30 for 100 Points).',
        'How to get on every crafted item: numbered steps with each part and where it drops, the recipe scroll last (it is used up the moment you pick it up), then unsealing.',
        '326 item effects rewritten from the map code in plain words, with real numbers (Heart Sword copies work in every mode).',
        'Recipes: search all 260, chips by slot and how you make them, one line per recipe.',
      ]],
      ['Quests', [
        'Quests: Main quest / Side quests chips, main quest in stages, side quests one line each grouped by NPC with search. Tap a side quest for needs, rewards and where.',
        'Tap a zone, NPC, boss or monster in Quests for a small map with the spot marked.',
      ]],
      ['Legacy', [
        'Fixed: Ashen Reaper owners were sent to turn it back into plain Ashen Reaper (Purified Holy Water is a downgrade). Cloth Helmet 3 to 4 needs boss kills, not any kill (1 in 15). Chance steps count the kills you need (Half-Dragon Lord 10%: 19 kills). Wyvern, Windmill Village Chief and Jungle Guardian Spirit upgrades are plannable now.',
        'Dawn Sentinel shows (tagged untested: the N9 Frost Lord one-shots Alleria in our math) when the rest of the chain works. Armor Fragment x7 plans all 7 spots in one run, the Kodo Beast and the Gunslinger last (they turn a fortress hostile).',
        'Divine Arrow and Divine Armor Seal lines plan end to end on N7-9 (Seal 2 to 3, 4 to 5, 5 to 6, Seal 10 to Divine Arrow, Beast Armor to King Armor). Dawn Sentinel stays out: Alleria must beat the N9 Frost Lord first.',
        'Legacy: slot chips, tap a line for its card. Line pages in step ranges, changed stats in bold.',
        'Every Legacy item leads with how to get it: how to start its line (drop, ticket or Points price), which step it is, what unlocks it and what comes next.',
        'Every Legacy item says who can do its next upgrade, strongest first.',
        'Hero guides name the Legacy item to aim for at your difficulty (a step you can really reach), with how to get it. The tier list counts only the Legacy you bring into that difficulty.',
        'Legacy step stats fixed: +1,000 was read as +1 and AGI/INT +30 was dropped on 1,163 steps.',
      ]],
      ['Game systems', [
        'New Spending Points page: VIP (15,000 / 30,000 / 45,000 / 800,000 Points for VIP 1 / 2 / 4 / 10: more Boss Souls and gold, more Points, safer enhancing, stats per level), gear you start every run with, titles, the coin-flip game, random gear rolls and Legacy evolve items. Boss Souls, Points and enhancing pages note what VIP adds.',
        'Commands: only commands every player can use (Player 1 kick commands removed), -save and -qc texts fixed, -ms and -bug added. Tips trimmed to the useful ones.',
        'New tip: Points you hold pay a bonus every run (Points).',
        'Game systems trimmed: tables and rows that repeat another page are gone (Death Enhancer shop, Equipment Draw odds, the pet copies table, 16 Ranking Reward rows into 1 and more), Potions down from 31 rows to 13, endgame Points buys moved into Legacy gear and Account unlocks.',
        'Section chips filter the page instead of scrolling, tables fold, How and Tips cards fit their text.',
        'Modes table: the Challenge / Death cut hits true damage too, damage dealt by illusions is never cut.',
      ]],
      ['Calculators', [
        'Run planner routes now show every step a goal needs first: gate bosses before portal bosses (Nature Guardian, Spider Queen + Green Dragon Key, Storm Beast Gatekeeper, Evil Jaina), arena ticket farms (the arena must be empty), Spirit King tickets (250,000-350,000 gold in Light Guardian Fortress), Shadow Lord (1,000 Points + 10 Challenge Tokens from Challenge clears), the Windmill Village Chief chain, and "enhance to +N first". Each step is timed and every boss on the way is checked.',
        'Run planner: Frodo’s quest chain is one line with a Show steps button. It sits where your hero beats all 7 hunt bosses, before anything in the Firelands (his scroll is the only way in).',
        'Run planner: chance evolutions are farm goals (e.g. Cloth Helmet to 5: any monsters + any bosses + Wyverns, 85% luck per step). "Any boss" steps name no boss; your route’s kills already count.',
        'Fixed: Windmill Village Chief fights you only if you drop the Purified Seal-Breaking Stone or give it to your pet right after walking up with it; if it is still on your hero 12 s later, he takes it and there is no fight. The +20 stone cost with VIP was too high (VIP 4: about 6,200 Boss Souls, not 11,600).',
        'Run planner: Legacy Bag per run (the 6 to carry, what to leave in storage, and when to swap an item in for an upgrade, then back). Hero pages show your best 6 for that hero when your save is loaded.',
        'Run planner: Also on the way lists the free evolutions your route gives (e.g. Cloth Helmet: 2 steps likely, only while it sits in the Legacy Bag) and counts boss chains (A to B to C) as upgrades. A run may now upgrade two items of the same slot type (swap between the fights).',
        'Run planner step list (tester feedback): skill priority, pet bag (free items by your Map Level), the rune and universal skills per part, and Frodo’s hidden Boss Hunt (7 bosses in order after you bring him the letter, earlier kills don’t count, then Firelands, Flame Lord and a Magic Ring).',
        'Fixed: the Frostlands crate with Nature Strength is walled in by trees (unreachable); Nature Strength comes from the Nature Guardian.',
        'Run planner reads your VIP level from the save (or pick it): more Boss Souls and gold, VIP x Points, better enhancing and stats per level count. A Next buy line says if VIP or a title pays back soon enough, or to keep your Points (never costing you a Points-held bonus without saying so).',
        'Run planner: each run card says how often it finishes (every run played 26 times with random drops) and tags runs that also work for a brand-new, slow player. Runs under 5 in 10 are hidden.',
        'Run planner: farming more never makes a run fail any more (the simulated player keeps the gear that worked instead of swapping it). Every gear level is now simulated: Overgeared and an I’ll farm rare drops switch (rare items whose source you can farm again and again).',
        'Builds use the Special Merchant once per run (some builds traded twice). Mutated Reaper Scythe is the 5% result of the Abyss Scythe craft; each try uses up Demonic Sword Apophis (max 2 per game), so no plan counts on it.',
        'Run planner redesign: ranked run cards side by side, tap one for a clean step-by-step route (tap back for all runs). Filters for hero, difficulty, mode and run length. Gear level: Just enough / A bit more / Overgeared.',
        'Run planner only shows runs that also finish with a bit more farming (coin-flip runs hidden). Legacy runs rank by items, but a longer run needs more items to win. Accounts below Map Level 90 are never judged with the +30 stone. Item lists show every slot: copies (Strength Axe x4) and starter gear. Jarvan V repeat Points confirmed in game.',
        'Run planner shows no minutes or hours any more (every player is faster or slower): runs are short / medium / long, farming is in kills (85% luck) and Boss Souls, Points per run and 5 Points per Jarvan V kill. Time only ranks the options.',
        'Death Enhancer (+26 to +30) counted: it only takes an item already at +25 and costs 750-870 Boss Souls a try at 50%, so it rarely pays off in a run. Best in slot uses the free +30 stone once per run too. Eldest Elf Sister fights with her real armor (150).',
        'Run planner route: where to farm each suggested item (source, zone, drop chance, minutes) and where to farm Boss Souls for enhancing (the best boss you beat there, Souls per minute).',
        'Run planner Points goal: farm Jarvan V after the main quest (5 Points a kill, back 10 s after he and G.S.D die) plus the optional Points bosses worth the time. Legacy runs show them as side goals.',
        'Run planner: Legacy upgrades without a boss are planned too (Survival Challenge waves, items in one bag, Death Enhancer trades, any-kill steps, Eldest Elf Sister): 112 of 123.',
        'Run planner: a Legacy upgrade that loses its slot to another pick in the same run now counts as doable; Not doable yet means no run can do it. Points box (Points you hold add their Ranking Reward bonus). Replays now include step 29 (Na Wyvern on N9), realistic runes, Revival Crosses for gold, potions, enhancing and books on the way.',
        'Run planner: a First Legacy items goal (the run that starts the most Legacy lines), a route for every run (quest steps, where each boss fits, where to stop) and a Your account view on the tier list.',
        'Run planner: a Legacy boss counts only if the hero also beats every boss on the way to it (main quest bosses before it, portal and gate kills).',
        'New Run planner tab: load your save file (Legacy Bag + both storages, Points, Map Level, title) or pick your Legacy by hand. Legacy goal: the run that upgrades the most of your items (one per slot type), which heroes can do it and their items. Points goal: the difficulty + mode that pays the most Points per hour you can finish. Your Map Level bonuses (milestones, Player Bonus gift, Ranking Reward) and title count on top of your Legacy (at +0: enhancing resets every run).',
        'Points per run: results next to the inputs, every Jarvan V kill and your own low Map Level lobby bonus count, the Map Level a title needs is shown, and it starts at your picked difficulty.',
        'Enhancing: Normal or Legacy gear, +26 to +30 marked Death mode only.',
      ]],
      ['Whole wiki', [
        'Run planner reads your exact account: Map Level, title and your best Legacy item per slot count as they are, not rounded to a step.',
        'Run planner only suggests heroes your account can pick: Map Level and World Points unlocks read from your save (World Points box for hand entry).',
        'Run planner rebuilt on full-run replays of a normal player (walking, reading, creeps, farming, every boss, a death resets the fight) for every hero, difficulty, mode and account level. It only recommends runs the replay finishes, shows the run time, and the gear is just enough for the run’s last boss (Safer run switch: farm a bit more). Fixed: it could recommend Death N9 to a Map Level 26 account.',
        'Home: Past the start? now points at the Run planner first.',
        'Tap an item, monster, hero, zone, shop or Legacy line from another tab for a quick-look card, links inside the card swap it in place with a back arrow.',
        'Cleaner tables, yellow chips, one-row tab bar on phones, grouped search results, changelog folded by day, Home cards with live counts.',
        'Str/Agi/Int is now called All stats everywhere (All stats amp).',
        'Search: items by their wiki names, side quests open the quest, stats and Terms are found (crit, Legacy Bag, enhance), a hit always opens its page.',
        'Tap a name in a list row and that row opens in place, same as tapping the row. Zone and shop quick-looks show a small map.',
        'Every tab trimmed: shorter rules and notes, lines said twice on a page cut, one Stages row in the tier popup, filters on the chip row (Items, Tier list, Recipes), the zone map next to How to get there, Early / Mid / Late on Zones and Monsters too, a Run planner card on Home.',
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
        'Every hero skill and trait checked against the map code: 84 skill texts fixed (stuns, ranges, damage types, hit counts, Magic Cycle bonuses), e.g. Tauren Chieftain W is 6% less damage taken, not immunity.',
      ]],
      ['Items', [
        'Every missing icon now shows a default from the map instead of an empty box. Items sort by the zone you get them in, sealed copies fold into their item, duplicate sources are gone, and crafted items show where the scroll is sold.',
        'Chest and draw chances fixed: a roll range like 91-96 is 6%, not 9.6%. Random pools show the chance per item. Items without stats show their effect.',
        'All 57 Runes show their real numbers per Rune level (chance, damage, cooldown), plus the one-Rune rule.',
        'Other tab is now Universal skills: every book with its effect at book level 1 to 5. Rune and skill pages show the real numbers instead of the tooltip text.',
        'Ticket tab split into Exchanges, Titles, Boss tickets, Keys, Quests and Bonuses and draws. Where from reads cleaner (no doubled words). Recipes: a sealed craft and its unseal are one row.',
        'Rune and Universal skill hits can crit like any hit (Crit Damage applies), now said on both tabs. 9 item zones fixed. Sealed gear rule said once. Hero names in item lines use the map names.',
        'Full check of every item, Rune and Universal skill against the in-game tooltip and the map code: about 400 fixes. Fixed Enhance +N stones set the item to exactly +N and can lower it.',
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
        'All 1,976 Legacy steps checked against the code: 7 evolve conditions fixed.',
      ]],
      ['Game systems', [
        'New Terms page. Less clutter: weak tips and repeated tables cut, Stats moved up. New Best Boss Souls farms table.',
        'Boss Souls farm per zone. Points page: sources first, late spends folded. -fuhuo and -maplevel listed, -save lists everything it keeps.',
        'Game systems cut from 19 pages to 9 (related pages merged into sections). Most tips removed: only real tricks stay. Every page trimmed.',
        'World Boss: N7+ Main only (the old N1 tip was wrong). Farming Points table on Points. Mode effects said once, plainly. Challenge ticket prices added. Enhancing: +20 average cost said once, one name per stone.',
        'Attack amp is NOT dead: it adds that % of your total main stat as green attack damage (proven in game). Universal skill level 5 aura values fixed (Concentration Aura +300 Armor, Demon Energy -220).',
      ]],
      ['Whole wiki', [
        'English title on the map banner. Four fresh test players read the wiki cold, and everything that confused them was fixed.',
        'A second round of fresh test players, and what still confused them was fixed.',
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
  K.changes = CHANGES;                          /* Home shows the newest date */
  /* newest day open, older days folded to one line (date · count · categories); categories are small labels, not headings */
  P.changelog = () => `<h2>Changelog</h2>${CHANGES.map(([d, cats], i) => { const nn = cats.reduce((a, c) => a + c[1].length, 0);
    return `<details class="cg-day"${i ? '' : ' open'}><summary><b>${esc(d)}</b><span class="small"> · ${nn} change${nn === 1 ? '' : 's'}</span><span class="small cg-cats">: ${esc(cats.map(c => c[0]).join(', '))}</span></summary>${cats.map(([c, xs]) => `<div class="cg-cat"><span class="tag">${esc(c)}</span><ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</details>`; }).join('')}`;
  P.credits = () => `<h2>Credits</h2><ul><li>The Adventurer's Path RPG 1.02, Reforged port by Gwelawyr.</li><li>Every number comes from the map's own data.</li><li><b>Special thanks: Beast (draelokk)</b>, for tons of testing and feedback.</li><li>Built with Anthropic's Claude.</li></ul>`;
})(window.AP);
