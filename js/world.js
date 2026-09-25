/* Adventurer's Path wiki - core helpers, search and router, plus the world pages (zones, monsters, bosses, items,
   recipes, quests, shops, legacy). Other modules (systems.js, heroes.js, tools.js, home.js) register on AP.P / AP.INDEX. */
window.AP = (function () {
  const W = window.WIKI; const $ = s => document.querySelector(s); const out = $('#out');
  const ICONS = window.AP_ICONS || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => { if (n == null || n === '') return ''; const v = Number(n); if (!isFinite(v)) return String(n); let d = 3; if (v !== 0 && Math.abs(v) < 0.001) d = Math.min(12, Math.ceil(-Math.log10(Math.abs(v))) + 2); return v.toLocaleString('en-US', { maximumFractionDigits: d }); };
  const big = n => n >= 1e9 ? fmt(Math.round(n / 1e7) / 100) + ' B' : n >= 1e6 ? fmt(Math.round(n / 1e4) / 100) + ' M' : fmt(Math.round(n));
  const link = (kind, id, text) => `<a href="#${kind}/${encodeURIComponent(id)}">${esc(text != null ? text : id)}</a>`;
  const HEROIDS = new Set((W.heroes || []).map(h => h.id));
  /* map icon, else a default from the map by kind: item (by slot), hero, skill */
  const icon = c => { const k = ICONS[c] ? c : (W.items || []).length && ITM[c] ? (ICONS['_d_' + ITM[c].slot] ? '_d_' + ITM[c].slot : '_d_item') : HEROIDS.has(c) ? '_d_hero' : '_d_ability'; return ICONS[k] ? `<img class="ico" src="data:image/webp;base64,${ICONS[k]}" alt="">` : '<span class="ico ph"></span>'; };
  const ITM = Object.fromEntries((W.items || []).map(i => [i.id, i]));

  /* ---------- lookups ---------- */
  const item = Object.fromEntries((W.items || []).map(i => [i.id, i]));
  const MON = W.mon || {}, BOSS = W.boss || {};
  const SHOPS = W.shops || []; const shopByCode = Object.fromEntries(SHOPS.map(s => [s.id, s]));
  const unitByCode = MON, bossByCode = BOSS;
  const ZONES = (W.zones || []).slice().sort((a, b) => a.order - b.order); const Z = Object.fromEntries(ZONES.map(z => [z.id, z]));
  const ZNUM = {}; { let k_ = 0; for (const x of ZONES) if (!x.optional) ZNUM[x.id] = ++k_; }   // user quiz 2026-09-25: numbers = main zones in route order, side zones none
  const UZ = W.unit_zone || {};
  const LEG = W.legacy || { lines: [], rules: [], item_line: {} };
  const iname = id => item[id] ? (item[id].dn || item[id].name) : id;
  const ilink = id => item[id] ? `<a href="#item/${encodeURIComponent(id)}">${icon(id)}<span class="${item[id].rar ? 'r-' + item[id].rar : ''}">${esc(item[id].dn || item[id].name)}</span></a>` : esc(id);
  const ulink = (id, name) => BOSS[id] ? link('boss', id, name || BOSS[id].name) : MON[id] ? link('unit', id, name || MON[id].name) : shopByCode[id] ? link('shop', id, name || shopByCode[id].name) : esc(name || id);
  const ref = r => !r ? '' : typeof r === 'string' ? esc(r) : item[r.id] ? ilink(r.id) : (BOSS[r.id] || MON[r.id] || shopByCode[r.id]) ? ulink(r.id, r.name) : esc(r.name || '');
  const zlink = zid => Z[zid] ? link('zones', zid, Z[zid].name) : '';
  const UNAME = W.unames || {};
  const tok = s => esc(s).replace(/\{\{([uiz]):([A-Za-z0-9]+)(?:\|([^}]*))?\}\}/g, (m, k, id, txt) => k === 'i' ? (item[id] ? ilink(id) : esc(txt || id)) : k === 'z' ? (Z[id] ? link('zones', id, txt || Z[id].name) : esc(txt || id)) : ((BOSS[id] || MON[id] || shopByCode[id]) ? ulink(id, txt) : esc(txt || UNAME[id] || id)));
  const REACH = W.reach || {};
  const ZNAMES = (W.zones || []).map(z => [z.name, z.id]).sort((a, b) => b[0].length - a[0].length);
  const zoneLinks = h => { const parts = []; let t = h; ZNAMES.forEach(([n, id], i) => { const e = esc(n); let k = 0, o = '', pos; parts[i] = `<a href="#zones/${id}">${e}</a>`;
    while ((pos = t.indexOf(e, k)) >= 0) { const ok = !/[A-Za-z0-9']/.test(t[pos - 1] || ' ') && !/[A-Za-z0-9]/.test(t[pos + e.length] || ' '); o += t.slice(k, pos) + (ok ? `\u0001${i}\u0002` : e); k = pos + e.length; } t = o + t.slice(k); }); return t.replace(/\u0001(\d+)\u0002/g, (_, i) => parts[i]); };
  const reach = id => REACH[id] ? zoneLinks(esc(REACH[id])) : '';
  const rich = s => esc(s);
  const clean = s => String(s == null ? '' : s);
  const stats = s => s || '';

  /* ---------- difficulty (one picker for every page that shows enemy numbers) ---------- */
  const D = W.diff || { names: [], mon: [], boss: [] };
  let K_howTo = () => '';
  const filters = {};
  const nsel = () => { const n = Number(filters.n || 1); return n >= 1 && n <= 9 ? n : 1; };
  const npick = () => '';   /* the shared header picker replaced the per-page one */
  const MODES = [['main', 'Main'], ['chall', 'Challenge'], ['death', 'Death']];
  try { const s = JSON.parse(localStorage.getItem('ap_pick') || '{}'); if (s.n) filters.n = s.n; if (s.md) filters.md = s.md; } catch (e) {}
  const gpick = () => `<label>Difficulty <select id="g-n">${D.names.map((nm, i) => `<option value="${i + 1}" ${i + 1 === nsel() ? 'selected' : ''}>N${i + 1} ${esc(nm)}</option>`).join('')}</select></label>`
    + `<label>Mode <select id="g-md">${MODES.map(([v, l]) => `<option value="${v}" ${(filters.md || 'main') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  const PICK_PAGES = ['zones', 'monsters', 'unit', 'boss', 'tier', 'heroes', 'hero'];
  const monHp = m => m.hp * (D.mon[nsel() - 1] || 1);
  const bmul = b => b.scales_with_difficulty === false ? 1 : (D.boss[nsel() - 1] || 1);
  const bossStr = b => Math.min(b.str * bmul(b), 2147483647);   // in game Strength clamps at 2^31 - 1 (Doom Lord N8)
  const bossHit = b => Math.min((b.int || 0) * bmul(b), 2147483647);   // Intelligence clamps like Strength
  const bossHp = b => Math.min(13 * bossStr(b) + 1, 2147481600);   // Max HP clamps just under 2^31 (Doom Lord N8 in game: 2,147,481,600)
  /* BOSS DPS (patch_boss_dps 2026-09-25): bosses are hero units without the difficulty aura (in game 2026-09-25); attack time = weapon
     cooldown / (1 + min(4, (AGI + N multiplier) x 0.003)); crit only from the boss's own text (b.crit = [chance, x]). Challenge / Death add
     an extra hit on every attack: Challenge 1 x hit as Spells (x0.7 vs heroes), Death 0.5 x hit chaos. Monsters get the aura:
     damage x (1 + D.mon_dmg[N]), attack speed + D.mon_asp[N]. */
  const bossIvl = b => (b.cool || 2.2) / (1 + Math.min(4, ((b.agi || 0) + bmul(b)) * 0.003));
  const bossDps = b => bossHit(b) * (b.crit ? 1 + b.crit[0] * (b.crit[1] - 1) : 1) / bossIvl(b);
  const bossXDps = () => ({ chall: 0.7, death: 0.5 })[filters.md] || 0;
  const monDmg = m => { const r = String(m.damage || '').match(/^\s*(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*$/); if (!r) return null;
    const a = 1 + ((D.mon_dmg || [])[nsel() - 1] || 0); return [+r[1] * a, +(r[2] || r[1]) * a]; };
  const monDps = m => { const d = monDmg(m); return d && m.attack_cooldown ? (d[0] + d[1]) / 2 * (1 + ((D.mon_asp || [])[nsel() - 1] || 0)) / m.attack_cooldown : 0; };
  const souls = b => b.souls_base ? Math.floor(b.souls_base * (0.8 + 0.2 * nsel())) : 0;

  /* ---------- small renderers ---------- */
  const tbl = (cols, rows, cls) => `<div class="tbl compact${cls ? ' ' + cls : ''}"><table><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${rows.join('')}</table></div>`;
  const tr = cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
  const pct = c => c == null || c === '' ? '' : `${fmt(c)}%`;
  const dropList = (ds, max) => { const a = (ds || []).slice().sort((x, y) => (y.chance || 0) - (x.chance || 0)); const s = a.slice(0, max || a.length).map(d => `${ref(d)}${d.chance != null ? ` <span class="small">${pct(d.chance)}</span>` : ''}${d.note ? ` <span class="small">${esc(d.note)}</span>` : ''}`).join(', '); return (s || '<span class="small">-</span>') + (max && a.length > max ? ` <span class="small">+${a.length - max} more</span>` : ''); };
  const KIND = { drop: 'Drops from', shop: 'Sold at', craft: 'Crafted', quest: 'Quest reward', points: 'Points', world_points: 'World Points', exchange: 'Special Merchant', free: 'Free', chest: 'From chest', 'hero kit': 'Hero kit', evolves: 'Evolves from' };
  const kindLab = s => { const k = KIND[s.kind] || s.kind, n = (s.from && s.from.name) || ''; return n && (n.startsWith(k) || n.split(' ')[0] === k.split(' ')[0] && ['points', 'world_points', 'exchange'].includes(s.kind)) ? '' : esc(k) + ' '; };
  const srcShort = s => `${kindLab(s)}${s.from ? ref(s.from) : s.note ? esc(s.note.split(' / ')[0]) : ''}${s.chance != null ? ' ' + pct(s.chance) : ''}`.trim();
  const srcLine = s => `<b>${esc(KIND[s.kind] || s.kind)}</b>${s.from ? ': ' + ref(s.from) : ''}${s.chance != null ? ` <span class="small">${pct(s.chance)}</span>` : ''}${s.note ? ` <span class="small">${esc(s.note)}</span>` : ''}`;

  /* drops (Monsters tab UX pass 2026-09-25): a pool drop ('random Normal item (1 of 8)') shows without 'random', in its rarity colour,
     and can list its items (W.pools); the drops table is Item | Chance with a row's note under its item */
  const POOLS = W.pools || {}, POOLN = Object.fromEntries(Object.values(POOLS).map(p => [p.name, p]));
  const poolOf = d => d.id ? null : POOLS[d.pool] || POOLN[d.name] || null;
  const dname = d => { if (d.id) return ref(d); const t = String(d.name || ''), r = (t.match(/\b(Normal|Uncommon|Rare|Perfect|Epic|Legendary)\b/) || [])[1], s = esc(t.replace(/^random /, '')); return r ? `<span class="r-${r.toLowerCase()}">${s}</span>` : s; };
  const byChance = ds => (ds || []).slice().sort((x, y) => (y.chance || 0) - (x.chance || 0));
  const moDrops = ds => byChance(ds).map(d => dname(d) + (d.chance != null ? ` <span class="small">${pct(d.chance)}</span>` : '') + (d.note ? ` <span class="small">${esc(d.note)}</span>` : '')).join(' · ') || '<span class="small">-</span>';
  const poolLine = (p, max) => { const L = p.items || []; return L.slice(0, max || L.length).map(x => ref(x)).join(', ') + (max && L.length > max ? ` <span class="small">+${L.length - max} more</span>` : ''); };
  const dropTable = ds => { const a = byChance(ds); if (!a.length) return '<p class="small">No item drops.</p>';
    const common = a.length > 1 && a.every(d => d.note && d.note === a[0].note) ? a[0].note : '';
    return (common ? `<p class="small">${esc(common)}</p>` : '') + `<div class="tbl compact fit"><table><tr><th>Item</th><th class="num">Chance</th></tr>` + a.map(d => { const p = poolOf(d);
      return `<tr><td>${dname(d)}${d.note && !common ? ` <span class="small">· ${esc(d.note)}</span>` : ''}${p ? `<details class="mo-pool"><summary>see all ${fmt((p.items || []).length)}</summary><div>${poolLine(p)}</div></details>` : ''}</td><td class="num">${pct(d.chance) || '-'}</td></tr>`; }).join('') + `</table></div>`; };
  const P = {};
  /* ---------- zones ---------- */
  /* compact list (a row opens its card in place, with a mini map), zone page; shop / NPC pages are further down */
  const znIsQ = s => (s.sells || []).length && (s.sells || []).every(x => (item[x.id] || {}).slot === 'Quests');
  const znMons = z => (z.monsters || []).map(m => MON[m]).filter(Boolean).sort((a, b) => (a.level || 0) - (b.level || 0));
  const znBosses = z => (z.bosses || []).map(b => BOSS[b]).filter(Boolean);
  const znLv = z => { const ls = znMons(z).map(m => m.level || 0); if (!ls.length) return ''; const a = Math.min(...ls), b = Math.max(...ls); return a === b ? fmt(a) : fmt(a) + '-' + fmt(b); };
  const znShops = z => Object.values((z.shops || []).map(s => shopByCode[s]).filter(s => s && !znIsQ(s)).reduce((m, s) => { (m[s.name] = m[s.name] || []).push(s); return m; }, {})).map(g => Object.assign({}, g[0], { n: g.length, sells: [...new Map(g.flatMap(s => s.sells || []).map(x => [x.id, x])).values()] }));
  const znQuests = z => ((W.quests || {}).side || []).filter(q => q.zone === z.id);
  const znQName = q => String(q.name || '').replace(/^Hidden Quest - /, '').replace(/\s*\(Boss\)$/, '');
  const znQRew = q => [esc(q.reward === 'One roll' ? 'One of:' : q.reward || ''), (q.reward_items || []).map(x => (x.count > 1 ? fmt(x.count) + 'x ' : '') + ref(x) + (x.chance != null && x.chance < 100 ? ' ' + pct(x.chance) : '')).join(', ')].filter(Boolean).join(' · ').replace('One of: · ', 'One of: ');
  const znQRows = L => L.map(q => `<tr><td>${esc(znQName(q))}${q.repeat ? '' : ' <span class="tag">once</span>'}${/^Hidden Quest/.test(q.name || '') ? ' <span class="tag">hidden</span>' : ''}${q.needs ? `<br><span class="small">${esc(q.needs)}</span>` : ''}</td><td><span class="small">${znQRew(q) || '-'}</span></td></tr>`).join('');
  const znDrops2 = (ds, rows) => { if (rows > 8) return ''; const a = (ds || []).slice().sort((x, y) => (y.chance || 0) - (x.chance || 0)); return a.length ? `<br><span class="small">${a.slice(0, 2).map(d => dname(d) + (d.chance != null ? ' ' + pct(d.chance) : d.note ? ` (${esc(d.note)})` : '')).join(', ')}${a.length > 2 ? ` +${a.length - 2} more` : ''}</span>` : ''; };
  const znSent = s => String(s || '').split(/(?<=\.)\s+/).filter(Boolean);
  const znPts = (K, test) => K && K.mapPts ? K.mapPts.map((p, i) => test(p) ? i : -1).filter(i => i >= 0) : [];
  /* every monster's gold range = the same multiple of its level -> one line instead of a Gold column (else the column stays) */
  const znGold = (() => { let lo = null, hi = null, ok = true;
    for (const m of Object.values(MON)) { const g = /^(\d+)-(\d+)$/.exec(m.gold_range || ''); if (!g || !m.level) { if (m.gold != null) ok = false; continue; }
      const a = g[1] / m.level, b = g[2] / m.level; if (lo === null) { lo = a; hi = b; } else if (a !== lo || b !== hi) ok = false; }
    return ok && lo !== null ? `Gold per kill (N1): ${fmt(lo)}-${fmt(hi)} x monster level.` : ''; })();
  const znIn = (x, t) => t === 'main' ? !x.optional : t === 'side' ? !!x.optional : t === 'shops' ? znShops(x).length > 0 : true;
  /* UX pass 2 (2026-09-25): zone notes = W.zones what / story (verified route facts: keys, dangers, quest drops) minus lines the route already
     says; shops that stand side by side under one name (6 Universal Skill Trainers, 12 skills each); the zone a shop card is shown for;
     'where' text only when it says more than the zone's own name ('Starting area' = Start Camp) */
  const znWd = t => new Set((String(t || '').toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 3));
  const znOver = (t, r) => { const a = znWd(t), b = znWd(r); let n = 0; a.forEach(w => { if (b.has(w)) n++; }); return a.size ? n / a.size : 0; };
  const znStory = z => (z.story || []).filter(Boolean);
  const znNotes = z => (z.what || []).filter(t => t && !/^(Reached|Enter through|Passage:)/.test(t) && znOver(t, REACH[z.id]) <= 0.6 && znOver(t, znStory(z).join(' ')) < 0.5);
  const SZ = {}; ZONES.forEach(z => (z.shops || []).forEach(x => { (SZ[x] = SZ[x] || []).push(z.id); }));
  const znSibs = s => SHOPS.filter(x => x.name === s.name && x.where === s.where);
  const znHere = id => { const m = /^#zones\/(z\d+)/.exec(location.hash); return m && (SZ[id] || []).includes(m[1]) ? m[1] : zoneOf(id); };
  const znWhere = (s, zid) => { const w = s.where || ''; return !w || w === (Z[zid] || {}).name || /^Starting area$/i.test(w) ? '' : zoneLinks(esc(w)); };
  /* one open card in the whole Zones list: each route band is its own list for xOpen, so a card left open in another band is closed here */
  const znOne = keep => out.querySelectorAll('.zn-list .xr.open').forEach(r => { if (r === keep) return; r.classList.remove('open'); const d = r.nextElementSibling; if (d && d.classList.contains('xd')) d.remove(); });
  P.zones = (id, f) => {
    if (!ZONES.length) return '<h2>Zones</h2><p class="small">Coming soon.</p>';
    if (!Z[id]) {
      const TR = W.travel || {}, ZM = W.zones_meta || {}, how = TR.how || [], intro = znSent(ZM.intro);
      const BULB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>';
      const rules = [...how.slice(0, 1), ...znSent(ZM.legend).filter(x => !/^SIDE\b/.test(x)), ...how.slice(1)], tips = TR.tips || [];   // ux3: the drop rule lives on Monsters
      /* the route of a run (user 2026-09-25: "compact it more, easier to read"): three columns = start / middle / end of a run at the picked
         difficulty (same thirds as the Build guide), main zones as one-line rows, each side zone a small row right under the zone it branches from */
      const n = nsel(), band = n <= 3 ? 'N1-3' : n <= 6 ? 'N4-6' : 'N7-9', cut = (W.stage_orders || {})[band] || [5, 12];
      const stext = x => [x.name, ...znBosses(x).map(b => b.name), ...znMons(x).map(m => m.name), ...(x.shops || []).map(s => (shopByCode[s] || {}).name || ''), ...znQuests(x).map(q => q.name), ...(x.circles || [])].join(' ').toLowerCase();
      const bossLine = x => { const bl = znBosses(x), ns = znShops(x).length; return bl.length ? bl.slice(0, 2).map(b => esc(b.name)).join(', ') + (bl.length > 2 ? ` +${bl.length - 2}` : '') : ns ? `${ns} shop${ns > 1 ? 's' : ''}` : ''; };
      const row = x => `<div class="zr xr${x.optional ? ' zr-side' : ''}" data-x="zones/${encodeURIComponent(x.id)}" data-s="${esc(stext(x))}"><div class="zr-h">${x.optional ? '<span class="zr-br">↳</span>' : `<span class="zn-o">${ZNUM[x.id]}</span>`}${link('zones', x.id, x.name)}${znLv(x) ? `<span class="zr-lv">Lv ${znLv(x)}</span>` : ''}</div>${bossLine(x) ? `<div class="zr-b">${bossLine(x)}</div>` : ''}</div>`;
      const G_ = W.qguide || {}, last = 20 + n, endOrd = Math.max(cut[1] + 1, ...(G_.steps || []).filter(s => Number(s.step) <= last && Z[s.zone]).map(s => Number(Z[s.zone].order)));   // the main quest has 21 steps on N1, +1 per difficulty
      const cols = [['Early run', o => o <= cut[0]], ['Mid run', o => o > cut[0] && o <= cut[1]], ['Late run', o => o > cut[1] && o <= endOrd], ['After the main quest', o => o > endOrd]];
      let parent = 0; const ord = {}; for (const x of ZONES) { if (!x.optional) parent = Number(x.order); ord[x.id] = x.optional ? parent : Number(x.order); }   // a side zone goes with the zone it branches from
      return `<h2>Zones</h2><div class="zn-bar"><input class="tsearch" type="search" placeholder="zone, boss, monster, NPC ..."><span class="tsearch-n small"></span></div>`
        + `<p class="small zn-lead">Your run at N${n}, zone by zone. Tap a zone for its map, bosses and shops.</p>`
        + (rules.length || tips.length ? `<details class="zn-rules"><summary>Travel rules</summary><ul>${rules.map(x => `<li>${esc(x)}</li>`).join('')}${tips.map(x => `<li class="zn-tip">${BULB}${esc(x)}</li>`).join('')}</ul></details>` : '')
        + `<div class="zn-list">` + cols.map(([t, fn]) => { const L = ZONES.filter(x => fn(ord[x.id])); return L.length ? `<section class="zn-band sgroup"><h3>${t} <span class="small">${L.length} zone${L.length > 1 ? 's' : ''}</span></h3><div class="zn-grid">${L.map(row).join('')}</div></section>` : ''; }).join('')
        + `</div>`;
    }
    const z = Z[id], zi = ZONES.indexOf(z), n = nsel();
    const mons = znMons(z), bos = znBosses(z), shops = znShops(z), qs = znQuests(z);
    const qg = [], at = {}; for (const q of qs) { const k = (q.npc && q.npc.id) || '?'; if (!(k in at)) { at[k] = qg.length; qg.push([q.npc, []]); } qg[at[k]][1].push(q); }
    const circ = (z.circles || []).length ? `<span class="small"><b>Energy Circles:</b> ${z.circles.map(esc).join(', ')}</span>` : '';
    const st = znStory(z), hw = [reach(z.id) ? `<b>How to get there:</b> ${reach(z.id)}` : '', circ, st.length ? `<span class="small"><b>Story:</b> ${st.map(t => zoneLinks(esc(t))).join(' · ')}</span>` : '',
      ...znNotes(z).map(t => `<span class="small zn-nt">${zoneLinks(esc(t))}</span>`)].filter(Boolean);
    /* keep '<b>How to get there:</b>... </p>': map.js drops the mini map right after that paragraph */
    return `<div class="zn-page"><p class="small">${link('zones', '', 'All zones').replace('/"', '"')}${zi > 0 ? ' · ← ' + link('zones', ZONES[zi - 1].id, ZONES[zi - 1].name) : ''}${zi < ZONES.length - 1 ? ' · ' + link('zones', ZONES[zi + 1].id, ZONES[zi + 1].name) + ' →' : ''}</p>`
      + `<h2>${z.optional ? '' : ZNUM[z.id] + '. '}${esc(z.name)}${z.optional ? ' <span class="tag">side</span>' : ''}</h2>`
      + (hw.length ? `<div class="zn-top"><p class="zn-how">${hw.join('<br>')}</p></div>` : '')   /* ux3: map.js puts the map after this </p>, so it lands in.zn-top beside the text */
      + (bos.length ? `<h4>Bosses</h4><div class="tbl compact"><table><tr><th>Boss</th><th class="num">HP (N${n})</th><th class="num">Dmg / hit</th><th class="num">DPS</th><th class="num">Boss Souls</th></tr>`
        + bos.map(b => `<tr class="xr" data-x="boss/${encodeURIComponent(b.id)}"><td>${ulink(b.id)}${znDrops2(b.drops, bos.length)}</td><td class="num">${big(bossHp(b))}</td><td class="num">${big(bossHit(b))}</td><td class="num">${big(bossDps(b))}</td><td class="num">${souls(b) ? fmt(souls(b)) : '-'}</td></tr>`).join('') + `</table></div>` : '')
      + (mons.length ? `<h4>Monsters</h4><div class="tbl compact"><table><tr><th>Monster</th><th class="num">Lv</th><th class="num">HP (N${n})</th></tr>`
        + mons.map(m => `<tr class="xr" data-x="unit/${encodeURIComponent(m.id)}"><td>${ulink(m.id)}${znDrops2(m.drops, mons.length)}</td><td class="num">${fmt(m.level)}</td><td class="num">${big(monHp(m))}</td></tr>`).join('') + `</table></div>` : '')
      + (qs.length ? `<h4>Quests</h4><div class="tbl compact"><table><tr><th>Quest</th><th>Reward</th></tr>` + qg.map(([npc, L]) => `<tr class="grp"><td colspan="2">${npc ? ref(npc) : '-'}</td></tr>` + znQRows(L)).join('') + `</table></div>` : '')
      + (shops.length ? `<h4>Shops</h4><div class="zn-pills">` + shops.map(s => `<a class="zn-pill xr" data-x="shop/${encodeURIComponent(s.id)}" href="#shop/${encodeURIComponent(s.id)}">${esc(s.name)}${s.n > 1 ? ` <span class="small">x${s.n}</span>` : ''}</a>`).join('') + `</div>` : '')
      + `</div>`;
  };
  /* in-place zone card (Zones list rows): the facts + 'Open page', and a small interactive map drawn by the xhook below.
     UX pass 2: Story (main-quest chapter here) and Notes (keys, dangers, quest drops) rows; a shop link swaps the card to that shop (listener below) */
  const znCard = id => { const z = Z[id]; if (!z) return '';
    const more = (a, k, fn) => a.slice(0, k).map(fn).join(', ') + (a.length > k ? ` <span class="small">+${a.length - k} more</span>` : '');
    const bl = znBosses(z), ms = znMons(z), sh = znShops(z), qs = znQuests(z), st = znStory(z), nts = znNotes(z);
    return `<div class="zn-card" data-z="${esc(id)}"><div class="zn-cf"><div class="kv">`
      + (reach(id) ? `<b>Get there</b><span>${reach(id)}</span>` : '')
      + (st.length ? `<b>Story</b><span>${st.map(t => zoneLinks(esc(t))).join('<br>')}</span>` : '')
      + (bl.length ? `<b>Bosses</b><span>${more(bl, 6, b => ulink(b.id))}</span>` : '')
      + (nts.length ? `<b>Notes</b><span>${nts.map(t => zoneLinks(esc(t))).join('<br>')}</span>` : '')
      + (ms.length ? `<b>Monsters</b><span>${more(ms, 5, m => ulink(m.id))}</span>` : '')
      + (sh.length ? `<b>Shops</b><span>${more(sh, 6, s => link('shop', s.id, s.name) + (s.n > 1 ? ` <span class="small">x${s.n}</span>` : ''))}</span>` : '')
      + (qs.length ? `<b>Quests</b><span>${more(qs, 4, q => esc(znQName(q)))}</span>` : '')
      + ((z.circles || []).length ? `<b>Energy Circles</b><span>${z.circles.map(esc).join(', ')}</span>` : '')
      + `</div><div class="pk-open"><a href="#zones/${encodeURIComponent(id)}" class="pk-go">Open page →</a></div></div><div class="zn-cm"></div></div>`; };
  /* shop / NPC facts (UX pass 2): where (only when it says more than this zone), one price / note when shared, quests, items (a quest giver's
     'stock' of quest items and its 'quest, 4 in stock' note are skipped); shops with the same name standing side by side (the 6 Universal Skill
     Trainers) get chips 1..N that switch the list, so no trainer's stock is hidden behind 'x6' */
  const znShopFacts = (id, zid) => { const s = shopByCode[id]; if (!s) return '';
    const sib = znSibs(s), L = sib.length > 1 ? sib : [s], all = L.flatMap(x => x.sells || []);
    const pr = [...new Set(all.map(x => x.price || ''))], nt = [...new Set(all.map(x => x.note || ''))], one = pr.length === 1 && all.length > 1 ? pr[0] : '';
    const qs = ((W.quests || {}).side || []).filter(q => q.npc && q.npc.id === id), qo = znIsQ(s) && qs.length;
    const head = [znWhere(s, zid), !qo && one ? 'Price: ' + esc(one) : '', !qo && nt.length === 1 && nt[0] ? esc(nt[0]) : ''].filter(Boolean).join(' · ');
    const list = x => { const a = x.sells || []; return a.slice(0, 12).map(y => ref(y) + (!one && y.price ? ` <span class="small">${esc(y.price)}</span>` : '')).join(', ') + (a.length > 12 ? ` <span class="small">+${a.length - 12} more</span>` : ''); };
    const items = qo || !all.length ? '' : L.length < 2 ? `<div>${list(s)}</div>`
      : `<div class="zn-sib"><div class="small">${L.length} stand side by side, each with its own list:</div><div class="zn-sbs">${L.map((x, k) => `<button type="button" class="zn-sb${x.id === id ? ' on' : ''}" data-k="${k}" aria-pressed="${x.id === id}">${k + 1}</button>`).join('')}</div>`
        + L.map((x, k) => `<div class="zn-sl" data-k="${k}"${x.id === id ? '' : ' hidden'}>${list(x)}</div>`).join('') + `</div>`;
    return (head ? `<div class="small">${head}</div>` : '') + (s.note ? `<div class="small zn-snote">${esc(s.note)}</div>` : '') + (qs.length ? `<div><b>Quests:</b> ${qs.map(q => esc(znQName(q))).join(', ')}</div>` : '')
      + items + `<div class="pk-open"><a href="#shop/${encodeURIComponent(id)}" class="pk-go">Open page →</a></div>`; };
  /* in-place shop / NPC card (shop pills on zone pages): facts left, a mini map of this zone with the NPC ringed right (stacked on a phone) */
  const znShopCard = id => { const s = shopByCode[id]; if (!s) return ''; const zid = znHere(id);
    return `<div class="zn-card${Z[zid] ? '' : ' zn-nomap'}"><div class="zn-cf">${znShopFacts(id, zid)}</div>${Z[zid] ? `<div class="mp-slot zn-cm" data-zone="${zid}" data-pt="${esc(id)}"></div>` : ''}</div>`; };
  /* detail / xhooks / xOpen are const further down this file: registering here directly would throw (TDZ), so register once the file has run */
  queueMicrotask(() => {
    detail.zones = znCard; detail.shop = detail.npc = znShopCard;
    xhooks.push((pg, id, el) => { const box = pg === 'zones' ? el.querySelector('.zn-cm') : null; if (!box) return; const K = window.AP;
      try {
        if (K.miniMap) K.miniMap(box, id);   /* map.js helper (requested): render + wire a small map of zone id inside box */
        else if (K.mapSvg && ((W.map || {}).zones || []).some(x => x.id === id)) {
          box.innerHTML = K.mapSvg({ focus: id, hl: new Set(znPts(K, p => (p.zone === id || p.tz === id) && p.k !== 'npc')) });
          K.hooks.forEach(h => { try { h('xcard', box); } catch (e) {} });   /* map.js wires every.mapbox in the root it gets; page-gated hooks ignore 'xcard' */
        }
      } catch (e) {}
      if (!box.children.length) { box.parentElement.classList.add('zn-nomap'); box.remove(); } });
    /* a zone link inside the Zones list (e.g. in a card's route) opens that zone's row card instead of its big page */
    out.addEventListener('click', e => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      const a = e.target.closest('a[href^="#zones/"]'); if (!a || a.classList.contains('pk-go') || !a.closest('.zn-list')) return;
      const x = 'zones/' + a.getAttribute('href').slice(7), own = a.closest('.xr'); if (own && own.dataset.x === x) return;
      const row = [...out.querySelectorAll('.zn-list .xr')].find(r => r.dataset.x === x && !r.hidden); if (!row) return;
      e.preventDefault(); znOne(row); if (!row.classList.contains('open')) xOpen(row);
      row.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
    /* UX pass 2: chips 1..N switch a side-by-side shop's list; a shop link inside a Zones-list card swaps that card to the shop in the same
       frame (its map rings the NPC), '‹ zone' swaps back. The list never leaves the screen (user: rows open small panels, not big pages). */
    out.addEventListener('click', e => {
      const zr = e.target.closest('.zn-list .xr'); if (zr) znOne(zr);   // one open card in the whole Zones list (each band is its own list for xOpen)
      const b = e.target.closest('.zn-sb');
      if (b) { const w = b.closest('.zn-sib'); w.querySelectorAll('.zn-sb').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        w.querySelectorAll('.zn-sl').forEach(x => { x.hidden = x.dataset.k !== b.dataset.k; }); return; }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      const card = e.target.closest('.zn-list .zn-card[data-z]'); if (!card) return;
      const bk = e.target.closest('.zn-back'), a = bk ? null : e.target.closest('a[href^="#shop/"]:not(.pk-go)'); if (!bk && !a) return;
      const K = window.AP, cf = card.querySelector('.zn-cf'), cm = card.querySelector('.zn-cm'), zid = card.dataset.z; e.preventDefault();
      if (bk) { if (card._zh) cf.innerHTML = card._zh; if (cm && K.miniMap) K.miniMap(cm, zid); return; }
      const sid = decodeURIComponent(a.getAttribute('href').slice(6)), sh = shopByCode[sid]; if (!sh) return;
      if (!card._zh) card._zh = cf.innerHTML;
      cf.innerHTML = `<div class="mph"><b>${esc(sh.name)}</b><button type="button" class="zn-back">‹ ${esc((Z[zid] || {}).name || 'Back')}</button></div>` + znShopFacts(sid, zid);
      if (cm && K.miniMap) K.miniMap(cm, zid, { pt: sid }); });
  });
  /* ---------- monsters and bosses ---------- */
  const zoneOf = id => UZ[id] || (MON[id] || BOSS[id] || {}).zone;
  const zord = id => (Z[zoneOf(id)] || { order: 99 }).order;
  /* Monsters tab (UX pass 2026-09-25, QA pass ux2). Chips hide rows (class mo-off + hidden) instead of leaving them out, so the tab search
     finds every monster / boss; an empty search puts the chip back (input listener below). Monster chips = stage of the run at the picked N
     (moStage = the Zones tab cut), so a zone never splits over two chips. Rows open unitMapCard in place (K.detail.unit / K.detail.boss);
     tr.grp = zone rows. Stage Points: W.boss_points, topped up from the Points page table when missing. */
  const MO_KIND = { stage: 'Main-quest boss', field: 'Field boss', challenge: 'Challenge boss', hidden: 'Hidden boss', world: 'World boss' };
  const BPX = (() => { const o = Object.assign({}, W.boss_points || {}), ang = [];
    for (const pg of W.sys || []) for (const sec of (pg.sections || [pg])) if (sec.key === 'points') for (const t of sec.tables || []) for (const r of t.rows || []) {
      const m = typeof r[0] === 'string' && r[0].match(/^N(\d)\b/); if (!m || !r[1] || !r[1].id || r.length < 5) continue;
      if (!(o[r[1].id] || {}).stage) o[r[1].id] = { stage: +m[1], pts: [r[2], r[3], r[4]] }; if (r[5] != null) ang[+m[1] - 1] = String(r[5]); }
    for (const id in o) if (o[id].angel && !o[id].angel.length && ang.length) o[id] = { angel: ang };
    return o; })();
  const bpOf = b => BPX[b.id] || (b.stage ? { stage: b.stage } : null);
  const bpPays = (b, n) => { const x = bpOf(b); return !!x && (!x.stage || x.stage === n); };
  const ptw = v => `${v} Point${String(v).trim() === '1' ? '' : 's'}`;
  const bpTag = (b, n, mi) => { const x = bpOf(b); if (!x) return '';
    if (x.stage) return x.stage === n && x.pts ? ` <span class="tag mo-pt">${ptw(fmt(x.pts[mi]))}</span>` : ` <span class="tag">Points on N${x.stage}</span>`;
    if (x.angel) { const v = String((x.angel[n - 1] || '').split(' / ')[mi] || '').trim(); return v ? ` <span class="tag mo-pt">${ptw(esc(v))} first kill</span>` : ''; }
    return x.flat != null ? ` <span class="tag mo-pt">${ptw(fmt(x.flat))} ${b.id === 'Hlgr' ? 'each kill' : 'once'}</span>` : ''; };
  const bpLine = b => { const x = bpOf(b), n = nsel(); if (!x) return '';
    if (x.stage) return (x.pts ? `${x.pts.map(fmt).join(' / ')} <span class="small">(Main / Challenge / Death), ` : '<span class="small">') + `on N${x.stage} only, once per run</span>`;
    if (x.angel && x.angel[n - 1]) return `${esc(x.angel[n - 1])} <span class="small">(Main / Challenge / Death) on N${n}</span>`;
    return ''; };
  const moSt = (v, l) => `<span class="mo-st"><b>${v}</b><i>${l}</i></span>`;
  /* kill gold at the picked N (trigger Jin Bi): (3 x level +- up to 1 x level) x (0.8 + 0.2 x N), for every hero within 1500; shown as its range */
  const moGold = m => { const f = 0.8 + 0.2 * nsel(), L = m.level || 0; return `${fmt(Math.floor(2 * L * f + 1e-9))}-${fmt(Math.floor(4 * L * f + 1e-9))}`; };
  const monStats = m => (m.damage ? (d => d ? moSt(d[0] === d[1] ? big(d[0]) : `${big(d[0])}-${big(d[1])}`, `Damage (N${nsel()})`) + (monDps(m) ? moSt(big(monDps(m)), `DPS (N${nsel()})`) : '') : moSt(esc(m.damage), 'Damage (N1)'))(monDmg(m)) : '') + (m.armor != null ? moSt(fmt(m.armor), 'Armor') : '')
    + (m.level ? moSt(moGold(m), `Gold (N${nsel()})`) : '') + (m.exp != null ? moSt(fmt(m.exp), 'Exp') : '');
  /* stage of the run for a zone at the picked N: 0 start, 1 middle, 2 end, 3 after the main quest (same cut as the Zones tab list;
     a side zone goes with the zone it branches from) */
  const moStage = () => { const n = nsel(), cut = (W.stage_orders || {})[n <= 3 ? 'N1-3' : n <= 6 ? 'N4-6' : 'N7-9'] || [5, 12], last = 20 + n;
    const end = Math.max(cut[1] + 1, ...((W.qguide || {}).steps || []).filter(s => Number(s.step) <= last && Z[s.zone]).map(s => Number(Z[s.zone].order)));
    const ord = {}; let parent = 0; for (const x of ZONES) { if (!x.optional) parent = Number(x.order); ord[x.id] = x.optional ? parent : Number(x.order); }
    return zid => { const o = ord[zid]; return o == null ? 3 : o <= cut[0] ? 0 : o <= cut[1] ? 1 : o <= end ? 2 : 3; }; };
  /* main-quest steps that ask for this unit (a step that starts with it = its quest giver, skipped) */
  const moQuest = id => { const t = '{{u:' + id; return ((W.qguide || {}).steps || []).filter(s => { const d = String(s.do || ''); return (d.includes(t + '}}') || d.includes(t + '|')) && !d.startsWith(t); })
    .map(s => `Step ${fmt(s.step)}${s.on && s.on !== 'N1+' ? ` <span class="small">(${esc(s.on)})</span>` : ''}: ${tok(s.do)}`).join('<br>'); };
  /* how to get in = the part of a boss's Where after ' · ' (a scroll, a boat, a ticket, N4 only...) */
  const moNeed = id => { const r = String(REACH[id] || ''), k = r.indexOf(' · '); return k < 0 ? '' : zoneLinks(esc(r.slice(k + 3).replace(/^./, c => c.toUpperCase()))); };
  const moDropsN = (ds, max) => { const a = byChance(ds); return a.slice(0, max).map(d => dname(d) + (d.chance != null ? ` <span class="small">${pct(d.chance)}</span>` : '') + (d.note ? ` <span class="small">${esc(d.note)}</span>` : '')).join(' · ') + (a.length > max ? ` <span class="small">+${a.length - max} more</span>` : ''); };
  const moHasMap = z => !!Z[z] && ((W.map || {}).zones || []).some(x => x.id === z);
  const moZone = id => { const K_ = window.AP; return (K_ && K_.ptZone && K_.ptZone(id)) || zoneOf(id); };
  /* page body under the stat boxes: Drops | Map side by side on wide screens, drops first on phones; map.js fills the slot (and skips its own boss map) */
  const moTwo = (left, z, attr) => { const mp = moHasMap(z); return `<div class="mo-two${mp ? ' mo-2c' : ''}"><div>${left}</div>${mp ? `<div><h4 class="mo-h">Map</h4><div class="mp-slot" data-zone="${z}"${attr}></div></div>` : ''}</div>`; };
  const bArmor = b => { if (b.def == null) return ''; const A = b.def + ((b.agi || 0) + (D.boss || [])[nsel() - 1]) * 0.01;
    return moSt(`${fmt(Math.round(A))} <small>blocks ${Math.round(0.02 * A / (1 + 0.02 * A) * 100)}% phys.</small>`, 'Armor'); };
  const bMres = b => moSt(b.immune ? 'immune' : (b.spell_reduction_pct || 0) + '%', 'Magic resist');
  const bDps = b => { const x = bossXDps(), md = { chall: 'Challenge', death: 'Death' }[filters.md];
    return moSt(big(bossDps(b)) + (b.crit ? ` <small>with ${fmt(Math.round(b.crit[0] * 100))}% crit x${fmt(b.crit[1])}</small>` : '')
      + (x ? ` <small>+${big(bossHit(b) * x / bossIvl(b))} ${md} hit</small>` : ''), 'DPS'); };
  const bResp = b => moSt(b.respawn_s ? b.respawn_s + ' s' : 'no', 'Respawn');
  const bSub = (b, withZone) => esc(MO_KIND[b.kind] || 'Boss') + (withZone && Z[zoneOf(b.id)] ? ' · ' + zlink(zoneOf(b.id)) : '') + (b.scales_with_difficulty === false ? ' · same HP and damage on every N' : '');
  const bossKv = b => { const pl = bpLine(b);
    return (pl ? `<b>Points</b><span>${pl}</span>` : '') + ((b.rewards || []).length ? `<b>Rewards</b><span>${b.rewards.map(esc).join('<br>')}</span>` : '')
      + (b.summon ? `<b>Summon</b><span>${ref(b.summon)}</span>` : '') + (reach(b.id) ? `<b>Where</b><span>${reach(b.id)}</span>` : ''); };
  /* in-place cards (unitMapCard) skip what their row already shows (HP, Lv, drops), so they suit these list rows and the Zones tab rows alike */
  const rowSays = (key, t) => { const r = out.querySelector(`.xr[data-x="${key}"]`); return !!(r && t && r.textContent.includes(t)); };
  const dropTxt = d => d ? (d.id ? iname(d.id) : String(d.name || '').replace(/^random /, '')) : '';
  document.addEventListener('input', e => { const inp = e.target.closest ? e.target.closest('.mo-list input.tsearch') : null; if (!inp || inp.value.trim()) return;
    inp.closest('.mo-list').querySelectorAll('.mo-off').forEach(r => { r.hidden = true; }); });
  P.monsters = (_, f) => {
    const mt = f.mt === 'bosses' ? 'bosses' : 'monsters', n = nsel();
    const bar = (chips, ph) => `<div class="mo-bar"><input class="tsearch" type="search" placeholder="${ph}"><span class="tsearch-n small"></span>${chips}</div>`;
    const fold = (t, L) => `<details class="mo-rules"><summary>${t}</summary><ul>${L.map(x => `<li>${x}</li>`).join('')}</ul></details>`;
    const byZone = L => { const g = [], at = {}; for (const x of L) { const z = zoneOf(x.id) || '?'; if (!(z in at)) { at[z] = g.length; g.push([z, []]); } g[at[z]][1].push(x); } return g; };
    const grp = (z, on) => `<tr class="grp${on ? '' : ' mo-off'}"${on ? '' : ' hidden'}><td colspan="${mt === 'bosses' ? 5 : 4}">${Z[z] ? zlink(z) + (Z[z].optional ? ' <span class="tag">side</span>' : '') : 'Other'}</td></tr>`;
    const row = (x, on, pg, s, cells) => `<tr class="xr${on ? '' : ' mo-off'}"${on ? '' : ' hidden'} data-x="${pg}/${encodeURIComponent(x.id)}" data-s="${esc(s.filter(Boolean).join(' ').toLowerCase())}">${cells}</tr>`;
    const head = `<h2>Monsters</h2>${subtabs('monsters', 'mt', [['monsters', 'Monsters'], ['bosses', 'Bosses']], mt)}`;
    if (mt === 'bosses') {
      const mi = { chall: 1, death: 2 }[f.md] || 0;
      const bk = ['stage', 'field', 'challenge', 'special', 'points', 'all'].includes(f.mbk) ? f.mbk : f.bp === '1' ? 'points' : 'stage';
      const inK = b => bk === 'all' || (bk === 'points' ? bpPays(b, n) : bk === 'special' ? b.kind === 'hidden' || b.kind === 'world' : b.kind === bk);
      const G = byZone(Object.values(BOSS).sort((a, b) => zord(a.id) - zord(b.id) || a.str - b.str));
      return head + `<div class="mo-list">` + bar(subtabs('monsters', 'mbk', [['stage', 'Main quest'], ['field', 'Field'], ['challenge', 'Challenge'], ['special', 'Hidden & World'], ['points', 'Pays Points'], ['all', 'All']], bk), 'Search bosses or drops')
        + fold('Boss rules', [`HP and damage per hit (before your Armor) × ${(D.boss || []).map(fmt).join(' / ')} on N1 to N9.`,
          'DPS = damage per hit ÷ time between attacks. More boss Agility = faster attacks (up to 5x).',
          "Only your difficulty's stage boss pays stage Points, once per run. Points tags use your difficulty and mode.",
          'Challenge bosses are summoned in the Boss Challenge Arena: no Boss Souls, no respawn.'])
        + `<div class="tbl compact"><table><tr><th>Boss</th><th class="num">HP (N${n})</th><th class="num">Dmg/hit</th><th class="num">DPS</th><th class="num">Souls</th></tr>`
        + G.map(([z, L]) => grp(z, L.some(inK)) + L.map(b => row(b, inK(b), 'boss', [b.name, (Z[zoneOf(b.id)] || {}).name, MO_KIND[b.kind], (b.summon || {}).name, ...(b.drops || []).map(d => d.id ? iname(d.id) : d.name)],
          `<td>${ulink(b.id)}${bpTag(b, n, mi)}</td><td class="num">${big(bossHp(b))}</td><td class="num">${big(bossHit(b))}</td><td class="num">${big(bossDps(b))}</td><td class="num">${fmt(souls(b))}</td>`)).join('')).join('') + `</table></div></div>`;
    }
    const stg = moStage(), ST = [['0', 'Early'], ['1', 'Mid'], ['2', 'Late'], ['3', 'After main quest']].filter(([k]) => Object.values(MON).some(m => stg(zoneOf(m.id)) === +k));
    const sk = f.mst === 'all' || !ST.length ? 'all' : (ST.find(x => x[0] === f.mst) || ST[0])[0];
    const inL = m => sk === 'all' || stg(zoneOf(m.id)) === +sk;
    const MR = W.monster_rules || {};
    const rules = ['drops', 'pool_rows', 'gold', 'exp', 'exp_share', 'respawn'].filter(k => MR[k]).map(k => esc(MR[k].replace(/\s*The list shows[^.]*\./, '').replace("'random ... item (1 of N)'", "'... item (1 of N)'")));
    const G = byZone(Object.values(MON).sort((a, b) => zord(a.id) - zord(b.id) || (a.level || 0) - (b.level || 0)));
    return head + `<div class="mo-list">` + bar(subtabs('monsters', 'mst', [...ST, ['all', 'All']], sk), 'Search monsters, zones or drops')
      + (rules.length ? fold('Kill rules: drops, gold, exp', rules) : '<p class="small">Drops roll once for every hero within 1500 range.</p>')
      + `<div class="tbl compact"><table><tr><th>Monster</th><th class="num">Lv</th><th class="num">HP (N${n})</th><th>Drops</th></tr>`
      + G.map(([z, L]) => grp(z, L.some(inL)) + L.map(m => row(m, inL(m), 'unit', [m.name, (Z[zoneOf(m.id)] || {}).name, ...(m.drops || []).map(d => d.id ? iname(d.id) : String(d.name || '').replace(/^random /, ''))],
        `<td>${ulink(m.id)}</td><td class="num">${fmt(m.level)}</td><td class="num">${big(monHp(m))}</td><td><span class="small">${moDrops(m.drops)}</span></td>`)).join('')).join('') + `</table></div></div>`;
  };
  /* monster page: sub line (Lv, zone, how many on the map, respawn), stat boxes, main-quest step, then Drops | Map with the spawn spots ringed */
  P.unit = id => {
    const m = MON[id]; if (!m) return BOSS[id] ? P.boss(id) : shopByCode[id] ? P.shop(id) : '<p>Unknown monster.</p>';
    const z = zoneOf(id), sp = (W.mon_spawn || {})[id] || [], cnt = sp.reduce((a, q) => a + (q[2] || 1), 0), mq = moQuest(id);
    return `<h2>${esc(m.name)}</h2><p class="small mo-sub">Monster · Lv ${fmt(m.level)}${Z[z] ? ' · ' + zlink(z) : ''}${cnt ? ` · ${fmt(cnt)} on the map` : ''} · ${m.respawns ? 'respawns in 60 s' : 'no respawn'}</p>`
      + `<div class="mo-stats">${moSt(big(monHp(m)), `HP (N${nsel()})`)}${monStats(m)}</div>` + (mq ? `<div class="kv mo-kv"><b>Main quest</b><span>${mq}</span></div>` : '')
      + moTwo(`<h4 class="mo-h">Drops</h4>` + dropTable(m.drops), z, ` data-mon="${esc(id)}"`);
  };
  /* boss page: stat boxes, Points / Rewards / Summon / Where / Main quest, then Drops | Map (the page has its own slot, so map.js adds none), moves folded */
  P.boss = id => {
    const b = BOSS[id]; if (!b) return '<p>Unknown boss.</p>';
    const n = nsel(), ms = b.mechanics || [], mq = moQuest(id), kv = bossKv(b) + (mq ? `<b>Main quest</b><span>${mq}</span>` : '');
    return `<h2>${esc(b.name)}</h2><p class="small mo-sub">${bSub(b, true)}</p>`
      + `<div class="mo-stats">${moSt(big(bossHp(b)), b.scales_with_difficulty === false ? 'HP' : `HP (N${n})`)}${moSt(big(bossHit(b)), 'Damage per hit')}${bDps(b)}${bArmor(b)}${bMres(b)}${moSt(fmt(souls(b)), `Boss Souls (N${n})`)}${bResp(b)}</div>`
      + (kv ? `<div class="kv mo-kv">${kv}</div>` : '') + moTwo(`<h4 class="mo-h">Drops</h4>` + dropTable(b.drops), moZone(id), ` data-boss="${esc(id)}"`)
      + (ms.length ? `<details class="mo-fold"><summary>How it fights <span class="small">· ${ms.length}</span><span class="mo-pv">${esc(ms[0])}</span></summary><ul>${ms.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : '');
  };
  /* ---------- items ---------- */
  const normal = (W.items || []).filter(i => !i.legacy && !i.sealed_of);
  const sealedOf = {}; for (const i of (W.items || [])) if (i.sealed_of) (sealedOf[i.sealed_of] = sealedOf[i.sealed_of] || []).push(i.id);
  const SLOT_ORDER = ['Weapon', 'Armor', 'Boots', 'Accessory', 'Rune', 'Universal skills', 'Consumable', 'Material', 'Scroll', 'Exchanges', 'Titles', 'Boss tickets', 'Keys', 'Quests', 'Bonuses and draws'];
  const SLOTS = [...new Set(normal.map(i => i.slot).filter(Boolean))].sort((a, b) => (SLOT_ORDER.indexOf(a) + 1 || 99) - (SLOT_ORDER.indexOf(b) + 1 || 99));
  const itemZone = i => { if (i.zone && Z[i.zone]) return Z[i.zone].order; let best = 99; for (const s of i.sources || []) { const zo = s.from && Z[zoneOf(s.from.id)]; if (zo && zo.order < best) best = zo.order; } return best; };
  /* Items: 4 groups -> types, a search box for this tab only (names, stats, effects), When (difficulty band) and Has stat filters.
     20 compact rows at a time (icon + name + stats | Zone | When), 'Show more' for the rest; a row opens its card in place. */
  const IGROUPS = [['Gear', ['Weapon', 'Armor', 'Boots', 'Accessory']], ['Build', ['Rune', 'Universal skills', 'Consumable']], ['Crafting', ['Material', 'Scroll']], ['Other', ['Exchanges', 'Titles', 'Boss tickets', 'Keys', 'Quests', 'Bonuses and draws']]];
  const SN = W.stat_names || {};
  let itemQuery = '';
  /* ux2 2026-09-25: tooltip leftovers that are not effects ('Hidden Quest Reward', 'Exclusive Item', 'Created through synthesis', 'Boss drop:...') never show as an effect */
  const EFF_JUNK = /^(?:Hidden Quest Reward|Exclusive Item|Created through synthesis|Crafted through a synthesis scroll|Boss drop:[^.]*)\.?$/i;
  const effClean = t => String(t || '').split(/(?<=\.)\s+/).filter(x => !EFF_JUNK.test(x.trim())).join(' ').trim();
  const statTxt = i => [i.stats || (i.real ? '' : effClean(i.effect).split(/(?<=\.)\s/)[0]), i.xs].filter(Boolean).join(', ');
  const AV = W.avail || {}, BANDS = ['N1-3', 'N4-6', 'N7-9', 'post'], EFF = ['easy', 'medium', 'hard', 'very hard'];
  /* ux2 2026-09-25 (user: "Early suggested items that are really mid / late"): the list, its When filter and sort, the small cards and the
     recipes read the acquisition model (W.acq: first band you can get it in + early / mid / late in that run), not the band alone.
     A Map Level gate on every source ('Ranking Reward, Map Level 30-39') moves the item to the band whose player has that level
     (10 / 35 / 70, the model's own numbers) and shows an 'ML 30+' tag. Items the model does not cover keep W.avail (stage unknown = late). */
  const ACQ = W.acq || {}, WST = ['early', 'mid', 'late'], WEF = { e: 'easy', m: 'medium', h: 'hard', v: 'very hard' }, ML_B = [10, 35, 70], WHC = {};
  const mlGate = i => { let g = null; for (const s of i.sources || []) { const m = /Map Level (\d+)\s*(?:\+|-\s*\d)/.exec(s.note || ''); g = Math.min(g === null ? 1e9 : g, m ? +m[1] : 0); } return g || 0; };
  const whenOf = i => { if (WHC[i.id]) return WHC[i.id]; const q = ACQ[i.id], a = AV[i.id], ml = mlGate(i), mb = ml > ML_B[2] ? 3 : ml > ML_B[1] ? 2 : ml > ML_B[0] ? 1 : 0;
    let b = -1, s = 2, e = ''; const k = q ? q.findIndex(x => x[0] < 3) : -1;
    if (k >= 0) { b = k; s = q[k][0]; e = WEF[q[k][1]] || ''; } else if (a) { b = BANDS.indexOf(a[0]); e = a[1] || ''; }
    if (b >= 0 && mb > b) { b = mb; s = 0; }
    return (WHC[i.id] = { b, s, e, ml }); };
  const bandOf = i => whenOf(i).b;
  const SCUT = W.stage_cut || {}, zRange = c => c && c[0] ? c[0] + (c[1] ? ' to ' + c[1] : ' onward') : '', ECUT = zRange((SCUT['N1-3'] || {}).early);
  const whenTxt = w => w.b < 0 ? '' : w.b === 3 ? (w.ml ? `ML ${w.ml}+` : 'post-game') : BANDS[w.b] + ' ' + WST[w.s];
  const whenTip = w => w.b === 3 ? (w.ml ? `needs Map Level ${w.ml}+` : 'after beating the game')
    : [(c => c ? `${WST[w.s]} in a ${BANDS[w.b]} run: ${c}` : '')(zRange((SCUT[BANDS[w.b]] || {})[WST[w.s]])), w.ml ? `needs Map Level ${w.ml}+` : ''].filter(Boolean).join(' · ');
  /* one row per item: the per-player-slot copies (Sword of Divine Might(2) to (4), same stats as (1)) stay out of the list */
  const SLOTCOPY = new Set(normal.filter(i => { const m = /^(.*)\(([2-9])\)$/.exec(i.name || ''); return m && normal.some(x => x.name === m[1] + '(1)' && x.stats === i.stats); }).map(i => i.id));
  const stkTxt = t => String(t).replace(/^1 counts/, 'only one copy counts');
  const FLAT = new Set(['ad', 'str', 'agi', 'int', 'hp', 'mana', 'armor', 'move_speed', 'all_stats', 'hp_regen']);   /* every other stat value is a % */
  const IPAGE = 20; let itemLimit = IPAGE, itemKey = '';
  const ISX = {}; const itemSx = i => ISX[i.id] || (ISX[i.id] = [i.name, statTxt(i), i.effect || '', Object.keys(i.st || {}).map(k => SN[k] || k).join(' ')].join(' ').toLowerCase());
  const whenCell = i => { const w = whenOf(i); return `<span class="it-w" title="${esc(whenTip(w))}"><span class="it-b">${esc(whenTxt(w))}</span>${w.ml && w.b < 3 ? ` <span class="tag ix-ml">ML ${w.ml}+</span>` : ''}${w.e ? ` <span class="small it-e${EFF.indexOf(w.e)}">${esc(w.e)}</span>` : ''}</span>`; };
  const fromCell = i => (i.sources || []).length ? `<div class="it-c small">${srcShort(i.sources[0])}${i.sources.length > 1 ? ` +${i.sources.length - 1}` : ''}</div>` : '-';
  P.items = (_, f) => {
    const grp = IGROUPS.find(g => g[0] === f.ig) || IGROUPS[0]; const types = grp[1].filter(t => SLOTS.includes(t));
    const slot = types.includes(f.slot) ? f.slot : '';
    let rows = normal.filter(i => (slot ? i.slot === slot : types.includes(i.slot)) && !SLOTCOPY.has(i.id));
    const hasW = rows.some(i => bandOf(i) >= 0), wh = hasW && ['e', '0', '1', '2'].includes(f.wh) ? f.wh : '';
    if (wh) rows = rows.filter(i => { const w = whenOf(i); return wh === 'e' ? w.b === 0 && w.s === 0 : w.b >= 0 && w.b <= +wh; });
    const statsHere = {}; rows.forEach(i => Object.keys(i.st || {}).forEach(k => statsHere[k] = (statsHere[k] || 0) + 1));
    const sk = statsHere[f.st] ? f.st : '';
    if (sk) rows = rows.filter(i => i.st && i.st[sk] != null).sort((a, b) => b.st[sk] - a.st[sk]);
    else { const bk = i => { const w = whenOf(i); return w.b < 0 ? 40 : w.b * 10 + w.s; };   /* band, then early / mid / late, then zone; unknown last */
      rows.sort((a, b) => bk(a) - bk(b) || itemZone(a) - itemZone(b) || (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name)); }
    const key = [grp[0], slot, wh, sk].join('|'); if (key !== itemKey) { itemKey = key; itemLimit = IPAGE; }
    const showT = !slot, showW = rows.some(i => bandOf(i) >= 0), showF = rows.some(i => bandOf(i) < 0);
    const opts = Object.entries(statsHere).filter(([k]) => k !== 'armor_ignore').sort((a, b) => b[1] - a[1]).map(([k]) => `<option value="${k}" ${k === sk ? 'selected' : ''}>${esc(SN[k] || k)}</option>`).join('');
    const note = slot === 'Rune' && W.rune_rule ? ' ' + esc(W.rune_rule) : slot === 'Universal skills' ? ` One book at hero level 35, a second at 100, tickets level them: ${link('systems', 'universal_books', 'Universal Books')}.` : '';
    const sval = v => (Math.abs(v) >= 1000 ? fmt(v) : String(v)) + (FLAT.has(sk) ? '' : '%');
    const WH = [['', 'any time'], ['e', 'N1-3 early'], ['0', 'by N1-3'], ['1', 'by N4-6'], ['2', 'by N7-9']];
    const filt = (hasW ? `<label class="inline">When <select id="f-wh">${WH.map(([v, l]) => `<option value="${v}" ${v === wh ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : '')
      + (opts ? `<label class="inline">Has stat <select id="f-st"><option value="">any</option>${opts}</select></label>` : '');
    return `<h2>Items</h2>`
      + `<div class="search isearch"><input id="isearch" type="search" placeholder="search items: all stats, magic resist, dawn shield ..." value="${esc(itemQuery)}"><span class="small" id="icount"></span></div>`
      + subtabs('items', 'ig', IGROUPS.map(g => [g[0], g[0]]), grp[0])
      + `<div class="it-bar">${subtabs('items', 'slot', [['', 'All'], ...types.map(t => [t, t])], slot)}${filt ? `<div class="row it-f">${filt}</div>` : ''}</div>`   /* ux3: type chips + filters on one row */
      + `<p class="small">${rows.length} items, ${sk ? 'highest ' + esc(SN[sk] || sk) + ' first' : 'earliest first' + (showW && ECUT ? ` (N1-3 early = ${esc(ECUT)})` : '')}.${note}${grp[0] === 'Gear' ? ` Legacy gear is on the ${link('legacy', '', 'Legacy').replace('/"', '"')} tab.` : ''}</p>`
      + `<div class="tbl compact it-tbl" data-slots="${esc((slot ? [slot] : types).join('|'))}"><table><tr><th>Item</th>${sk ? `<th>${esc(SN[sk] || sk)}</th>` : ''}<th class="it-z">Zone</th><th>${showW && showF ? 'When / from' : showW ? 'When' : 'From'}</th></tr>`
      + rows.map((i, n) => `<tr class="xr" data-x="item/${encodeURIComponent(i.id)}" data-s="${esc(itemSx(i))}"${n >= itemLimit ? ' hidden' : ''}>`
        + `<td><div class="it-c">${ilink(i.id)}${sealedOf[i.id] ? ' <span class="tag" title="A sealed copy also exists: base stats only until unsealed">sealed copy</span>' : ''} <span class="small">${showT ? esc(i.slot) + (statTxt(i) ? ' · ' : '') : ''}${esc(statTxt(i))}</span></div></td>`
        + (sk ? `<td><b>${sval(i.st[sk])}</b></td>` : '') + `<td class="it-z"><span class="small">${Z[i.zone] ? zlink(i.zone) : '-'}</span></td><td>${bandOf(i) >= 0 ? whenCell(i) : fromCell(i)}</td></tr>`).join('')
      + `</table></div><div class="it-more" id="imore"></div>`;
  };
  /* search (every word must match) + paging: only the first itemLimit matching rows show; 'also in' links to matches in other types */
  const applyItemSearch = root => { const inp = root.querySelector('#isearch'); if (!inp) return;
    const cnt = root.querySelector('#icount'), more = root.querySelector('#imore'), box = root.querySelector('.it-tbl'), tb = box && box.querySelector('table');
    const vs = new Set(((box && box.dataset.slots) || '').split('|'));
    const run = () => { itemQuery = inp.value; const ws = inp.value.toLowerCase().split(/\s+/).filter(Boolean); let n = 0; const here = new Set();
      root.querySelectorAll('.it-tbl tr[data-s]').forEach(r => { here.add(r.dataset.x); const ok = ws.every(w => r.dataset.s.includes(w)); if (ok) n++; r.hidden = !ok || n > itemLimit;
        if (r.hidden && r.classList.contains('open')) { r.classList.remove('open'); const d = r.nextElementSibling; if (d && d.classList.contains('xd')) d.remove(); } });
      const left = n - Math.min(n, itemLimit);
      if (more) more.innerHTML = left > 0 ? `<button type="button" data-n="more">Show ${Math.min(IPAGE, left)} more</button><button type="button" data-n="all">Show all ${fmt(n)}</button>` : '';
      let also = '';
      if (ws.length) { const by = {}; let hid = 0;
        for (const i of normal) { if (here.has('item/' + encodeURIComponent(i.id)) || !ws.every(w => itemSx(i).includes(w))) continue; if (vs.has(i.slot)) hid++; else by[i.slot] = (by[i.slot] || 0) + 1; }
        also = (hid ? ` · <a href="#items" data-clear="1" title="Clear When and Has stat">${hid} hidden by filters</a>` : '')
          + (Object.keys(by).length ? ' · also in ' + SLOTS.filter(s => by[s]).map(s => `<a href="#items" data-ig="${esc((IGROUPS.find(g => g[1].includes(s)) || IGROUPS[0])[0])}" data-slot="${esc(s)}">${esc(s)} ${by[s]}</a>`).join(', ') : ''); }
      cnt.innerHTML = ws.length ? `${n} match${n === 1 ? '' : 'es'}${also}` : ''; };
    inp.addEventListener('input', () => { itemLimit = IPAGE; run(); });
    if (more) more.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; itemLimit = b.dataset.n === 'all' ? 1e9 : itemLimit + IPAGE; run(); });
    cnt.addEventListener('click', e => { const a = e.target.closest('a[data-ig],a[data-clear]'); if (!a) return; e.preventDefault(); if (a.dataset.ig) { filters.ig = a.dataset.ig; filters.slot = a.dataset.slot; } filters.wh = ''; filters.st = ''; route(); });
    /* a header click sorts every row (shared sorter, skipped while a card row is open): close the card first, then re-apply the paging */
    if (tb) tb.rows[0].addEventListener('click', () => { tb.querySelectorAll('tr.xd').forEach(x => x.remove()); tb.querySelectorAll('tr.xr.open').forEach(x => x.classList.remove('open')); setTimeout(run); });
    run(); };
  /* when in a run you can really get an item, per difficulty band (acquisition model: beat the boss, access, recipe parts) */
  const ACQ_ST = ['early', 'mid', 'late'], ACQ_EF = { e: 'easy', m: 'medium', h: 'hard', v: 'very hard' };
  const acqLine = id => { const q = (W.acq || {})[id]; if (!q) return ''; const same = q.every(x => x[0] === q[0][0] && x[1] === q[0][1]), ml = item[id] ? whenOf(item[id]).ml : 0;
    return (ml ? `<span class="tag ix-ml" title="every source needs this Map Level">ML ${ml}+</span> ` : '') + (same ? [['N1-9', 0]] : ['N1-3', 'N4-6', 'N7-9'].map((b, k) => [b, k])).map(([b, k]) => `<span class="aq${q[k][0] > 2 ? ' aq-no' : ''}"><b>${b}</b> ${q[k][0] > 2 ? 'not in this run' : ACQ_ST[q[k][0]] + (ACQ_EF[q[k][1]] ? ', ' + ACQ_EF[q[k][1]] : '')}</span>`).join(' ')
      + (q.some(x => x[0] < 3 && x[2]) ? `<div class="small aq-why">Decided by: ${esc([...new Set(q.filter(x => x[0] < 3 && x[2]).map(x => x[2]))].join(' / '))}</div>` : ''); };
  /* effect text: '[Name]text' reads as a bold 'Name:' label */
  const effFmt = t => esc(t).replace(/\[([^\]]{1,40})\]\s*:?\s*/g, '<b class="efn">$1:</b> ');
  const madeBy = id => (W.recipes || []).filter(r => (r.result || (r.results || [])[0] || {}).id === id || (r.unseal && r.unseal.result.id === id));
  const usedIn = id => (W.recipes || []).filter(r => r.parts.some(p => p.id === id) || (r.unseal && r.unseal.talisman.id === id));
  /* ITEM EVOLUTIONS (2026-09-25, patch_evolutions): W.evo from findings/public/evolutions.json (map 1.02 script). The card shows the item's
     whole line: the main path inline (item → condition → item, this page's item highlighted), side branches as small ⤷ rows, rare craft
     results as '% of crafts' rows, what the last items craft into, one hint line. e = {from: [[to, kind, condition, chance, mutation]]} */
  const EVO = W.evo || { e: {}, roots: {}, tail: {}, hint: {} };
  const evTok = s => String(s || '').split(/(\{[uih]:[A-Za-z0-9]{4}\|[^}]*\})/).map(p => { const m = /^\{([uih]):([A-Za-z0-9]{4})\|([^}]*)\}$/.exec(p); if (!m) return esc(p);
    return m[1] === 'u' ? ulink(m[2], m[3]) : m[1] === 'h' ? link('hero', m[2], m[3]) : item[m[2]] ? link('item', m[2], m[3]) : esc(m[3]); }).join('');
  const evDepth = (id, seen) => { if (seen.has(id)) return 0; seen.add(id); const N = ((EVO.e || {})[id] || []).filter(x => !x[4]); return N.length ? 1 + Math.max(...N.map(x => evDepth(x[0], new Set(seen)))) : 0; };
  const evIt = (id, me) => id === me ? `<b class="evo-it evo-me">${icon(id)}<span class="${item[id] && item[id].rar ? 'r-' + item[id].rar : ''}">${esc(iname(id))}</span></b>` : `<span class="evo-it">${ilink(id)}</span>`;
  const evoCard = id => {
    const roots = (EVO.roots || {})[id], EE = EVO.e || {}; if (!roots || !roots.length) return '';
    const seen = new Set(), rows = [], queue = [], leaves = [], kinds = new Set();
    const mainOf = cur => { const N = (EE[cur] || []).filter(x => !x[4] && !seen.has(x[0])); if (N.length < 2) return N[0] || null;   /* the longest branch goes on */
      const d = N.map(x => evDepth(x[0], new Set([cur]))), mx = Math.max(...d); return mx > 0 && d.filter(v => v === mx).length === 1 ? N[d.indexOf(mx)] : null; };
    const path = (cur, head) => { let h = head + evIt(cur, id); seen.add(cur);
      for (;;) { const m = mainOf(cur), E = (EE[cur] || []).filter(x => !seen.has(x[0]));
        E.forEach(x => { kinds.add(x[1]); if (x !== m) queue.push([cur, x, m]); });
        if (!E.length) leaves.push(cur);
        if (!m) break;
        h += `<span class="evo-ar">→ ${evTok(m[2])} →</span>`; cur = m[0]; seen.add(cur); h += evIt(cur, id); }
      return h; };
    const side = ([f, x, m]) => { if (seen.has(x[0])) return;
      if (x[4]) { const base = (EE[f] || []).find(y => !y[4] && y[1] === 'craft'); rows.push(`<div class="evo-line evo-fork"><span class="evo-ar">⤷ ${pct(x[3])} of crafts give</span>${path(x[0], '')}${base ? `<span class="evo-ar">instead of ${esc(iname(base[0]))}</span>` : ''}</div>`); return; }
      rows.push(`<div class="evo-line evo-fork"><span class="evo-ar">⤷ ${m ? `from ${esc(iname(f))}: ` : ''}${evTok(x[2])} →</span>${path(x[0], '')}</div>`); };
    roots.forEach(r => { if (seen.has(r)) return; rows.push(`<div class="evo-line">${path(r, '')}</div>`); while (queue.length) side(queue.shift()); });
    const tails = leaves.filter(l => ((EVO.tail || {})[l] || []).length).map(l => { const L = EVO.tail[l];
      return `<div class="evo-tail small">${esc(iname(l))} crafts into ${L.slice(0, 4).map(ilink).join(', ')}${L.length > 4 ? ` +${L.length - 4} more` : ''}</div>`; });
    const hint = [...new Set([...kinds].map(k => (EVO.hint || {})[k]).filter(Boolean))].join(' ');
    return `<div class="card evo"><h4 style="margin-top:0">Evolution</h4>${rows.join('')}${tails.join('')}${hint ? `<div class="evo-tail small">${esc(hint)}</div>` : ''}</div>`; };
  const recipeRow = r => tr([r.unseal ? ref(r.unseal.result) + ` <span class="small">crafted sealed, then ${fmt(r.unseal.count)}x ${ref(r.unseal.talisman)}</span>` : (r.results || [r.result]).map(x => ref(x) + (x.chance != null && r.results ? ` <span class="small">${pct(x.chance)}</span>` : '')).join(' or '), r.parts.map(p => (p.count > 1 ? p.count + 'x ' : '') + ref(p)).join(' + '), r.scroll_from ? ref(r.scroll_from) : r.scroll ? '<span class="small">scroll</span>' : '<span class="small">-</span>']);
  /* item page: sources grouped by kind (group row), the note ending shared by a whole group shown once on its group row */
  const KORD = ['free', 'shop', 'craft', 'quest', 'drop', 'chest', 'evolves', 'points', 'exchange', 'world_points', 'hero kit'];
  const noteTail = L => { if (L.length < 2 || L.some(e => e.raw == null)) return ''; let s = L[0].raw;
    for (const e of L) { let k = 0; while (k < s.length && k < e.raw.length && s[s.length - 1 - k] === e.raw[e.raw.length - 1 - k]) k++; s = s.slice(s.length - k); }
    while (s && (/^\s/.test(s) || L.some(e => e.raw.length > s.length && !/\s/.test(e.raw[e.raw.length - s.length - 1])))) s = s.replace(/^\S*\s*/, '');
    return s.length >= 12 ? s : ''; };
  /* How to get (user 2026-09-25): a numbered path for every craftable item: scroll (and where it is), each part with its best
     source and zone, combine, then unseal. A crafted part gets its own short steps one level down. */
  const HT_ORD = { shop: 0, free: 1, quest: 2, drop: 3, chest: 4, points: 5, exchange: 6, world_points: 7, 'hero kit': 8, evolves: 9 };
  /* the zone once: 'Windmill Village King Blacksmith' already says where it is */
  const htWhere = f => { if (!f) return ''; const z = zoneOf(f.id), nm = String(f.name || (shopByCode[f.id] || {}).name || ''), wh = shopByCode[f.id] && shopByCode[f.id].where;
    return Z[z] ? (nm.includes(Z[z].name) ? '' : ` <span class="small">(${zlink(z)})</span>`) : wh && !nm.includes(wh) ? ` <span class="small">(${esc(wh)})</span>` : ''; };
  const zOnce = f => { const z = zoneOf(f.id); return Z[z] && !String(f.name || '').includes(Z[z].name) ? ` <span class="small">${zlink(z)}</span>` : ''; };
  const htSrc = (id, short) => {           /* the best way to get a non-crafted part: the curated 'how' when there is one, else shop > free > quest > drop (best chance) > chest */
    const i = item[id]; if (!i) return '';
    const rank = s => (HT_ORD[s.kind] ?? 20) + (s.chance != null && s.chance < 25 && ['free', 'chest', 'points'].includes(s.kind) ? 30 : 0);   // random pools (a 1.6% Player Bonus roll) go last
    const ch = s => s.chance ?? (s.kind === 'drop' ? 30 : 101);                                                                                   // a boss drop with no known chance ranks below a sure 50%
    const L = (i.sources || []).filter(s => s.kind !== 'craft').sort((x, y) => rank(x) - rank(y) || ch(y) - ch(x));
    const s = L[0]; if (!s) return AV[id] ? esc(AV[id][2]) : '';
    const verb = { shop: 'buy at', free: 'free at', quest: 'quest reward from', drop: 'drops from', chest: 'from', points: 'Points buy at', exchange: 'exchange at', world_points: 'World Points buy at', 'hero kit': 'starting item of', evolves: 'evolves from' }[s.kind] || s.kind;
    const q = s.kind === 'quest' ? (QRW[id] || []).find(x => !s.from || !x.npc || x.npc.id === s.from.id) : null, qr = q && (q.reward_items || []).find(x => x.id === id);
    const extra = [q ? esc(znQName(q)) + (qr && qr.count > 1 ? `, ${fmt(qr.count)}${q.repeat ? ' per turn-in' : 'x'}` : '') : '', s.chance != null ? pct(s.chance) : '', s.kind === 'shop' && s.note ? esc(s.note) : '', s.kind === 'drop' && /each nearby hero/.test(s.note || '') ? 'every hero nearby rolls' : '',
      s.kind === 'drop' && /talk to|only after|N[0-9]\+/.test(s.note || '') ? esc(s.note) : ''].filter(Boolean).join(', ');   // clue drops: the NPC talk / N gate that switches the drop on
    return `${verb} ${s.from ? ref(s.from) : esc(s.note || '')}${htWhere(s.from)}${extra ? ` <span class="small">${extra}</span>` : ''}${L.length > 1 ? (short ? ` <span class="small">+${L.length - 1} more</span>` : ` <span class="small">· or ${L.length - 1} more (item page)</span>`) : ''}`; };
  const htScroll = r => { if (!r.scroll) return ''; const sc = item[r.scroll.id], src = sc && (sc.sources || [])[0], f = r.scroll_from;
    const how = r.scroll_via === 'drop' ? `: it drops from ${ref(f)}${htWhere(f)}` : src && src.kind === 'free' ? ` free at ${ref(f || src.from)}${htWhere(f || src.from)}` : f ? ` at ${ref(f)}${htWhere(f)}${src && src.note && src.kind === 'shop' ? ` <span class="small">${esc(src.note)}</span>` : ''}` : ': ' + htSrc(r.scroll.id);
    return `Get the <a href="#item/${encodeURIComponent(r.scroll.id)}">recipe scroll</a>${how}`; };
  /* ux2 2026-09-25: only the free [Exclusive Item Crafting] scrolls are power-ups (item data 'powerup' = 1): used the moment you pick
     them up, so they come last. Shop and boss scrolls (item data: not a power-up) sit in the bag as a normal part until the last part
     arrives (the craft check runs on every pickup, war3map.j YDWEStringFormula__CraftItem). */
  const htPowerup = r => { const sc = r && r.scroll && item[r.scroll.id]; return !!sc && /^\[Exclusive Item Crafting\]/.test(sc.name || ''); };
  /* quest rewards (ux2 2026-09-25: the Magic Ring page never said what its hidden quest asks): quest, NPC, where, what it asks, count /
     chance. Shown as How to get when a quest is the item's best route (same order as the craft steps: shop > free > quest > drop) */
  const QRW = {}; for (const q of ((W.quests || {}).side || [])) for (const x of q.reward_items || []) (QRW[x.id] = QRW[x.id] || []).push(q);
  const qHow = id => { const L = QRW[id] || [], i = item[id]; if (!L.length || !i || madeBy(id).length) return '';
    const rk = s => (HT_ORD[s.kind] ?? 20) + (s.chance != null && s.chance < 25 && ['free', 'chest', 'points'].includes(s.kind) ? 30 : 0);
    if (Math.min(99, ...(i.sources || []).filter(s => s.kind !== 'craft').map(rk)) !== HT_ORD.quest) return '';
    return `<ol class="ht">${L.map(q => { const r = (q.reward_items || []).find(x => x.id === id) || {}, hint = String(q.zone_hint || (Z[q.zone] || {}).name || '').replace(/\s*\(([^()]*)\)\s*$/, ', $1');
      const tail = [r.count > 1 ? fmt(r.count) + (q.repeat ? ' per turn-in' : 'x') : '', r.chance != null && r.chance < 100 ? pct(r.chance) : ''].filter(Boolean).join(', ');
      return `<li>Quest <b>${esc(znQName(q))}</b>${/^Hidden Quest/.test(q.name || '') ? ' <span class="tag">hidden</span>' : ''}${q.repeat ? '' : ' <span class="tag">once</span>'} from ${q.npc ? ref(q.npc) : '-'}${hint ? ` <span class="small">(${zoneLinks(esc(hint))})</span>` : ''}: ${zoneLinks(esc(q.needs || '-'))}${tail ? ` <span class="small">· ${tail}</span>` : ''}</li>`; }).join('')}</ol>`; };
  const qCovers = (id, s) => s.kind === 'quest' && !!s.from && (QRW[id] || []).some(q => q.npc && q.npc.id === s.from.id);
  /* one-line best route for the small cards (user 2026-09-25: small panels lead with what matters): the recipe (parts + scroll, then the
     unseal), else the best single source with its zone */
  const getLine = id => { const rs = madeBy(id); if (!rs.length) return htSrc(id, true);
    const r = rs.find(x => x.unseal && x.unseal.result.id === id) || rs.find(x => (x.result || {}).id === id) || rs[0], un = r.unseal && r.unseal.result.id === id;
    return 'craft ' + r.parts.map(p => (p.count > 1 ? fmt(p.count) + 'x ' : '') + ref(p)).join(' + ')
      + (r.scroll ? ` + <a href="#item/${encodeURIComponent(r.scroll.id)}">${htPowerup(r) ? 'free scroll' : 'scroll'}</a>${r.scroll_from ? ` <span class="small">(${ref(r.scroll_from)})</span>` : ''}` : '')
      + (un ? `, then ${fmt(r.unseal.count)}x ${ref(r.unseal.talisman)}` : '') + (rs.length > 1 ? ` <span class="small">+${rs.length - 1} more recipes</span>` : ''); };
  const howTo = (id, depth) => {
    depth = depth || 0; const rs = madeBy(id); if (!rs.length) return '';
    const r = rs.find(x => x.unseal && x.unseal.result.id === id) || rs.find(x => (x.result || {}).id === id) || rs[0];
    const made = r.unseal && r.unseal.result.id === id ? r.result : ((r.results || []).find(x => x.id === id) || r.result);
    const steps = [];
    for (const p of r.parts) { const sub = depth < 1 && madeBy(p.id).length ? howTo(p.id, depth + 1) : '';
      steps.push(`Get ${p.count > 1 ? fmt(p.count) + 'x ' : ''}${ref(p)}: ${sub ? 'craft it' + sub : madeBy(p.id).length ? `craft it <span class="small">(see its page)</span>` : htSrc(p.id) || '<span class="small">see its page</span>'}`); }
    const odds = (r.results || []).length > 1 ? ` <span class="small">${r.results.map(x => ref(x) + ' ' + pct(x.chance)).join(', ')}</span>` : '';
    const pu = htPowerup(r);
    if (r.scroll) steps.push(htScroll(r) + (pu ? ` <span class="small">(pick it up last: it is used on pickup, so every part must already be on that unit)</span>` : ''));
    steps.push(`${pu ? 'With every part on one unit (hero or pet), the scroll turns them' : r.scroll ? 'With the scroll and every part on one unit (hero or pet), they combine' : 'With every part on one unit (hero or pet), they combine'} into ${ref(made)}${odds}${r.note && !r.unseal ? ` <span class="small">(${esc(r.note)})</span>` : ''}.`);
    if (r.unseal && r.unseal.result.id === id) {
      steps.push(`Get ${fmt(r.unseal.count)}x ${ref(r.unseal.talisman)}: ${htSrc(r.unseal.talisman.id)}`);
      steps.push(`Keep them on the unit that holds ${ref(r.result)}: at its next item pickup ${fmt(r.unseal.count)} are used and it unseals into ${ref(r.unseal.result)} <span class="small">(the named hero's bonus switches on)</span>.`); }
    const alt = rs.length > 1 && depth === 0 ? `<p class="small" style="margin:4px 0 0">Other recipes: see Made from below.</p>` : '';
    return depth ? `<ol class="ht-sub">${steps.map(s => `<li>${s}</li>`).join('')}</ol>` : `<ol class="ht">${steps.map(s => `<li>${s}</li>`).join('')}</ol>${alt}`; };
  /* Legacy items (user 2026-09-25: "legacy items bought with Points don't show how to get them anywhere"): the item leads with how to get it.
     ux2 2026-09-25: the start names its boss / merchant as a link (quick look with the map) + its zone; a Points start says where Points come from;
     a step names the step it really evolves from (Steel Helmet / Ashen Reaper branch); the timing tag comes from the start's zone with the same
     Early / Mid / Late cut as item timing (W.stage_cut N1-3), Points buys and N4+ drops get their own tag */
  const lgOf = id => { const ln = LEG.lines.find(l => l.root.id === id || l.steps.some(s => s.id === id)); if (!ln) return null;
    const k = Math.max(0, ln.steps.findIndex(s => s.id === id)); let prev = null, how = '';
    if (k > 0) { for (const s of ln.steps) { const a = s.to && s.to.id === id ? s : (s.alt || []).find(x => x.to && x.to.id === id && !x.back); if (a) { prev = s; how = a.next || ''; break; } }
      if (!prev) { prev = ln.steps[k - 1]; how = prev.next || ''; } }
    return { ln, k, st: ln.steps[k], prev, how }; };
  let LGN = null;   /* boss names + the merchants that sell a Legacy ticket, longest first */
  const lgSrc = ln => { if (!LGN) { const m = new Map(); for (const [id, b] of Object.entries(BOSS)) if (b.name && !m.has(b.name)) m.set(b.name, id);
      for (const s of SHOPS) if (s.name && (s.sells || []).some(x => (LEG.item_line || {})[x.id])) m.set(s.name, s.id); LGN = [...m].sort((a, b) => b[0].length - a[0].length); }
    const t = String(ln.start || ''); for (const [n, id] of LGN) { const p = t.indexOf(n); if (p >= 0 && !/[A-Za-z0-9]/.test(t[p - 1] || ' ') && !/[A-Za-z0-9]/.test(t[p + n.length] || ' ')) return [id, n]; } return null; };
  const lgZone = ln => { const s = (LEG.starter_list || []).find(x => x.id === ln.root.id), src = lgSrc(ln), t = String(ln.start || '');
    return (s && Z[s.zone] ? s.zone : '') || (src && Z[zoneOf(src[0])] ? zoneOf(src[0]) : '') || (ZNAMES.find(([n]) => t.includes(n.replace(/ Arena$/, ''))) || [])[1] || ''; };
  const LG_W = { early: 'Early run', mid: 'Mid run', late: 'Late run', hi: 'N4 and up', pts: 'Bought with Points', rng: 'Random drop' };
  const lgWhen = ln => { const t = String(ln.start || ''), p = /(\d[\d,]*) Points/.exec(t), n = /\bon N(\d)/.exec(t); if (p) return ['pts', p[1] + ' Points'];
    if (n && +n[1] >= 4) return ['hi', 'N' + n[1]];
    const z = lgZone(ln); if (!Z[z]) return /%/.test(t) ? ['rng', 'RNG'] : ['', ''];
    const cut = (W.stage_cut || {})['N1-3'] || {}, ord = nm => (ZONES.find(x => x.name === nm) || {}).order, e = ord((cut.early || [])[1]), m = ord((cut.mid || [])[1]), o = Z[z].order;
    return e == null ? ['', ''] : o <= e ? ['early', 'Early'] : m != null && o <= m ? ['mid', 'Mid'] : ['late', 'Late']; };
  const lgPts = ln => /\d[\d,]* Points/.test(String(ln.start || ''));
  const lgPtsNote = () => `Points save with -save; most come from the stage boss at the end of each run (<a href="#calc">Points per run</a>). ${esc((LEG.first || []).find(x => /tickets charge/.test(x)) || '')}`;
  const lgStartH = ln => { const src = lgSrc(ln), z = lgZone(ln); let h = esc(ln.start || 'see the line page'), lk = '';
    if (src) { const n = esc(src[1]), p = h.indexOf(n); if (p >= 0) { h = h.slice(0, p) + '\u0003' + h.slice(p + n.length); lk = ulink(src[0], src[1]); } }
    h = zoneLinks(h).replace('\u0003', () => lk); return h + (Z[z] && !h.includes(`#zones/${z}"`) ? ` <span class="small">(${zlink(z)})</span>` : ''); };
  /* item page -> line page on this step's chip with its row lit and scrolled to (legacyline hook) */
  const lgDeep = (ln, k) => { const r = ln.root.id; return `#legacyline?lls=${encodeURIComponent(r + ':' + Math.floor(k / LL_CH) * LL_CH)}&llme=${encodeURIComponent(r + ':' + k)}&llgo=1/${encodeURIComponent(r)}`; };
  /* the Points tickets + the Player Bonuses reward (not steps themselves): where to get one and which line it starts */
  const lgTicket = (id, short) => { const i = item[id] || {}, ln = LEG.lines.find(l => l.name === (i.legacy || (LEG.item_line || {})[id]));
    const sh = SHOPS.map(s => [s, (s.sells || []).find(x => x.id === id)]).filter(x => x[1]), pts = sh.some(([, x]) => /Points/.test(x.price || ''));
    const buy = sh.map(([s, x]) => `${ulink(s.id, s.name)}${Z[zoneOf(s.id)] ? ` <span class="small">(${zlink(zoneOf(s.id))})</span>` : ''}${x.price ? ': ' + esc(x.price) : ''}${x.note ? ` <span class="small">${esc(x.note)}</span>` : ''}`);
    const gives = ln ? `On pickup it turns into ${ref(ln.root)}, step 1 of the ${link('legacyline', ln.root.id, ln.name)} line (${fmt(ln.steps.length)} steps).` : '';
    if (short) return [buy.length ? `<b>Get it:</b> ${buy.join(' · ')}` : '', gives].filter(Boolean).join('<br>');
    return `<ol class="ht">${buy.length ? `<li><b>Get it:</b> ${buy.join('<br>')}</li>` : ''}${gives ? `<li>${gives}</li>` : ''}</ol>${pts ? `<p class="small">${lgPtsNote()}</p>` : ''}`; };
  const lgHow = (id, short) => { const g = lgOf(id); if (!g) return ''; const { ln, k, prev, how } = g;
    const start = k === 0 ? `<b>Get it:</b> ${lgStartH(ln)}` : `<b>Start the line:</b> ${ref(ln.root)} · ${lgStartH(ln)}`;
    const up = k > 0 && prev ? `<b>Then evolve:</b> ${esc(how).split(' OR ').join(' <i>or</i> ')} <span class="small">(${ref(prev)} → step ${fmt(k + 1)} of ${fmt(ln.steps.length)})</span>` : '';
    const need = ln.first_needs && k < 3 ? `<span class="small">First steps need: ${esc(ln.first_needs)}</span>` : '';
    return short ? [start, up].filter(Boolean).join('<br>') : `<ol class="ht"><li>${start}</li>${up ? `<li>${up}</li>` : ''}</ol>${need}${k === 0 && lgPts(ln) ? `<p class="small">${lgPtsNote()}</p>` : ''}`; };
  P.item = id => {
    const i = item[id]; if (!i) return '<p>Unknown item.</p>';
    if (lgOf(id)) { const { ln, k, st } = lgOf(id), n = ln.steps.length, nx = st && (st.to || ln.steps[k + 1]);   /* every step (I0BA had no legacy flag) */
      return `<h2>${icon(id).replace('class="ico', 'class="ico big')}${esc(iname(id))}</h2>`
        + `<div class="card howto"><h4 style="margin-top:0">How to get</h4>${lgHow(id)}</div>`
        + `<div class="card"><div class="kv"><b>Legacy line</b><span>${link('legacyline', ln.root.id, ln.name)} <span class="small">${esc(ln.slot || '')} · step ${fmt(k + 1)} of ${fmt(n)} · <a href="${lgDeep(ln, k)}">show in the line</a></span></span>`
        + (st && st.stats ? `<b>Stats</b><span>${esc(st.stats)}</span>` : '')
        + (k < n - 1 && st && st.next ? `<b>Next step when</b><span>${esc(st.next).split(' OR ').join('<br><i>or</i> ')}${nx ? ` <span class="small">→ ${ref(nx)}</span>` : ''}</span>` : k === n - 1 ? '<b>Next step</b><span>last step of the line</span>' : '')
        + (() => { const PD = W.plan; if (!PD || k >= n - 1) return '';                                  /* who can do the next upgrade */
            const E = (PD.edges[id] || [])[0]; if (!E) return '';
            const a = E[2][0] || [], mask = a[3] ? BigInt('0x' + a[3]) : 0n, ids = PD.heroes.filter((h, i) => ((mask >> BigInt(i)) & 1n) === 1n);
            if (!ids.length) return '';
            const nn = a[1] || 1, mk = { m: 'main', c: 'chall', d: 'death' }[a[2] || 'm'], L = ((W.tier || {}).lists || {})[mk + '|' + (nn <= 3 ? 'N1-3' : nn <= 6 ? 'N4-6' : 'N7-9')] || [];
            const sc = h => { const r = L.find(x => x[0] === h); return r ? r[1] : 0; }, top = ids.slice().sort((x, y) => sc(y) - sc(x));
            const hn = h => { const x = (W.heroes || []).find(y => y.id === h); return x ? x.name : h; };
            return `<b>Who can do it</b><span>${ids.length >= PD.heroes.length - 2 ? 'any hero' : top.slice(0, 8).map(h => `<a href="#hero/${encodeURIComponent(h)}">${esc(hn(h))}</a>`).join(', ') + (ids.length > 8 ? ` <span class="small">+${ids.length - 8} more</span>` : '')}${ids.length < PD.heroes.length - 2 ? ' <span class="small">(strongest first)</span>' : ''}</span>`; })()
        + `</div></div>`; }
    if (i.legacy) return `<h2>${icon(id).replace('class="ico', 'class="ico big')}${esc(i.name)}</h2><div class="card howto"><h4 style="margin-top:0">How to get</h4>${lgTicket(id)}</div>`;
    const mb = madeBy(id), ui = usedIn(id), a = AV[id], rc = i.rar ? 'r-' + i.rar : '';
    const swap = mb.length > 0 && (i.sources || []).filter(s => s.kind === 'craft').length === mb.length;   /* the craft sources are these recipes: show the recipe (linked parts) instead */
    const ht_ = howTo(id), qh = ht_ ? '' : qHow(id);   /* the How to get steps replace the craft rows of the source list */
    const ents = (i.sources || []).filter(s => !((swap || ht_) && s.kind === 'craft') && !(qh && qCovers(id, s))).map(s => ({ k: s.kind, ch: s.chance, raw: [s.note, s.pool].filter(Boolean).join(' · ').replace('One of: · ', 'One of: '),
        from: s.from ? ref(s.from) + (s.via ? ` <span class="small">(${ref(s.via)})</span>` : '') + zOnce(s.from) : '' }))
      .concat(swap && !ht_ ? mb.map(r => { const x = (r.results || []).find(y => y.id === id), un = r.unseal && r.unseal.result.id === id, alt = x ? r.results.filter(y => y.id !== id) : [];
        return { k: 'craft', ch: x ? x.chance : null, raw: null, from: r.parts.map(p => (p.count > 1 ? p.count + 'x ' : '') + ref(p)).join(' + '),
          html: [un ? `makes ${ref(r.result)} first, then ${fmt(r.unseal.count)}x ${ref(r.unseal.talisman)} in the same bag unseal it` : '', alt.length ? 'else ' + alt.map(y => ref(y) + ' ' + pct(y.chance)).join(', ') : '', r.note && !un ? esc(r.note) : '',
            r.scroll_from ? (r.unseal ? 'free scroll: ' : r.scroll_via === 'drop' ? 'scroll drops from ' : 'scroll sold at ') + ref(r.scroll_from) : ''].filter(Boolean).join(' · ') }; }) : []);
    const cut = (r, t) => { const p = r.slice(0, r.length - t.length).replace(/\s+$/, '').replace(/\s+for$/, '').replace(/[\s:,·]+$/, ''); return /^\d[\d.]*%$/.test(p) ? 'rolls ' + p : p; };
    const kl = k => esc(KIND[k] || k), note = (e, t) => e.html || esc(t ? cut(e.raw, t) : e.raw);
    let src = '', kvSrc = '';
    if (!ents.length) kvSrc = ht_ || qh ? '' : '<b>Where from</b><span class="small">no known source</span>';
    else if (ents.length <= 2) kvSrc = ents.map(e => `<b>${kl(e.k)}</b><span>${[e.from, e.ch != null ? `<span class="small">${pct(e.ch)}</span>` : '', note(e, '') ? `<span class="small">${note(e, '')}</span>` : ''].filter(Boolean).join(' ') || '-'}</span>`).join('');
    else { const hasC = ents.some(e => e.ch != null), hasN = ents.some(e => e.html || e.raw), cs = 1 + hasC + hasN;
      const G = KORD.concat(ents.map(e => e.k)).filter((k, n, A) => A.indexOf(k) === n && ents.some(e => e.k === k)).map(k => { const L = ents.filter(e => e.k === k).sort((x, y) => (y.ch == null ? -1 : y.ch) - (x.ch == null ? -1 : x.ch)); return [k, L, noteTail(L)]; });
      src = `<h4>Where from</h4><div class="tbl compact it-src"><table><tr><th>From</th>${hasC ? '<th>Chance</th>' : ''}${hasN ? '<th>Note</th>' : ''}</tr>`
        + G.map(([k, L, t]) => `<tr class="grp"><td colspan="${cs}">${kl(k)}${t ? ` <span class="small">· ${esc(t.replace(/^for\s+/, ''))}</span>` : ''}</td></tr>`
          + L.map(e => `<tr><td>${e.from || '-'}</td>${hasC ? `<td>${e.ch != null ? pct(e.ch) : '-'}</td>` : ''}${hasN ? `<td><span class="small">${note(e, t)}</span></td>` : ''}</tr>`).join('')).join('') + `</table></div>`; }
    const rt = ['Result', 'Parts', 'Scroll'];
    return `<h2>${icon(id).replace('class="ico', 'class="ico big')}<span class="${rc}">${esc(i.name)}</span></h2><div class="card"><div class="kv">`
      + `<b>Type</b><span>${esc(i.slot || '-')}${i.rarity ? ` · <span class="${rc}">${esc(i.rarity)}</span>` : ''}</span>${Z[i.zone] ? `<b>Zone</b><span>${zlink(i.zone)}</span>` : ''}`
      + (i.real ? `<b>Effect${i.slot === 'Universal skills' && !/Ticket/.test(i.name) ? ' (book level 1 to 5)' : ''}</b><span>${esc(i.stats)}</span>` : (i.stats ? `<b>Stats</b><span>${esc(i.stats)}</span>` : '') + (effClean(i.effect) ? `<b>Effect</b><span>${effFmt(effClean(i.effect))}</span>` : ''))
      + (i.slot === 'Rune' && W.rune_rule ? `<b>Rule</b><span>${esc(W.rune_rule)}</span>` : '') + (i.slot === 'Universal skills' ? `<b>How</b><span>${link('systems', 'universal_books', 'Universal Books')}</span>` : '')
      + (acqLine(id) ? `<b>When</b><span>${acqLine(id)}${a && !ht_ && !qh ? ` <span class="small">· ${esc(a[2])}</span>` : ''}</span>` : a ? `<b>When</b><span>${esc(a[0] === 'post' ? 'after beating the game' : 'from ' + a[0])} <span class="small">· ${esc(a[1])} · ${esc(a[2])}</span></span>` : '')
      + kvSrc + (i.stacks && i.stacks !== '-' ? `<b>Copies</b><span>${esc(stkTxt(i.stacks))}</span>` : '') + (i.pet_bag ? `<b>Pet bag</b><span>works from the pet bag</span>` : '') + `</div></div>`
      + evoCard(id)
      + (ht_ || qh ? `<div class="card howto"><h4 style="margin-top:0">How to get</h4>${ht_ || qh}</div>` : '')
      + src
      + (mb.length && !swap ? `<h4>Made from</h4>` + tbl(rt, mb.map(recipeRow)) : '')
      + (ui.length ? `<h4>Used in</h4>` + tbl(rt, ui.slice(0, 8).map(recipeRow)) + (ui.length > 8 ? `<details class="tcol"><summary>${ui.length - 8} more recipes</summary>${tbl(rt, ui.slice(8).map(recipeRow))}</details>` : '') : '');
  };
  /* the Items tab's in-place card: only what the row does not show (the open row unclamps its own name + stats) */
  const itemCard = id => { const i = item[id]; if (!i) return ''; const a = AV[id], nf = a ? 2 : 3, hq = howTo(id), qh = hq ? '' : qHow(id), ht = hq || qh;
    const eff = i.real ? '' : i.stats ? effClean(i.effect) : effClean(i.effect).split(/(?<=\.)\s/).slice(1).join(' ');
    const oth = (i.sources || []).filter(s => !(hq && s.kind === 'craft') && !(qh && qCovers(id, s)));   /* the How to get steps already say these */
    const us = [...new Map(usedIn(id).map(r => r.unseal && r.unseal.talisman.id === id && !r.parts.some(p => p.id === id) ? r.unseal.result : r.result || (r.results || [])[0]).filter(x => x && x.id).map(x => [x.id, x])).values()];
    return `<div class="kv"><b>Type</b><span>${esc(i.slot || '-')}${i.rarity ? ` · <span class="${i.rar ? 'r-' + i.rar : ''}">${esc(i.rarity)}</span>` : ''}</span>`
      + (Z[i.zone] ? `<b class="it-zk">Zone</b><span class="it-zk">${zlink(i.zone)}</span>` : '')
      + (eff ? `<b>Effect</b><span>${effFmt(eff)}</span>` : '') + (ht ? `<b>How to get</b><span>${ht}</span>` : a ? `<b>How to get</b><span>${esc(a[2])}</span>` : '')
      + (oth.length ? `<b>${ht ? 'Also from' : 'From'}</b><span>${oth.slice(0, nf).map(srcShort).join(' · ')}${oth.length > nf ? ` <span class="small">+${oth.length - nf} more</span>` : ''}</span>` : '')
      + (us.length ? `<b>Used in</b><span>${us.slice(0, 4).map(ref).join(', ')}${us.length > 4 ? ` <span class="small">+${us.length - 4} more</span>` : ''}</span>` : '')
      + (i.stacks && i.stacks !== '-' ? `<b>Copies</b><span>${esc(stkTxt(i.stacks))}</span>` : '') + (i.pet_bag ? '<b>Pet bag</b><span>works from the pet bag</span>' : '')
      + `</div><div class="pk-open"><a href="#item/${encodeURIComponent(id)}" class="pk-go">Open page →</a></div>`; };
  /* registered from the items hook (detail is declared further down); other tabs keep the default peek card for item rows */
  const itemDetail = id => document.body.dataset.page === 'items' ? itemCard(id) : peekCard('item', id).replace(/<a href="#" class="mpx"[^>]*>×<\/a>/, '');
  /* ---------- recipes: slot chips x 'how' chips over ONE table (group rows = where the scroll comes from); a row = result + parts
     and opens its card in place (detail.recipe); the search box looks through every recipe, whatever the chips ---------- */
  const rcRes = r => r.unseal ? r.unseal.result : (r.result || (r.results || [])[0] || {});
  const rcSlot = r => { const s = (item[(r.result || (r.results || [])[0] || {}).id] || {}).slot || 'Other'; return s === 'Quests' ? 'Material' : s; };
  const rcKind = r => r.unseal || /seal/i.test(r.note || '') ? 'seal' : r.scroll_via ? 'boss' : r.scroll_from || r.scroll ? 'shop' : 'parts';
  const rcGroup = r => { const k = rcKind(r); return k === 'parts' || k === 'boss' ? k : k + ':' + ((r.scroll_from || {}).id || ''); };
  const rcIt = (id, nm) => item[id] ? `<a href="#item/${encodeURIComponent(id)}"><span class="${item[id].rar ? 'r-' + item[id].rar : ''}">${esc(iname(id))}</span></a>` : esc(nm || id);
  let rcSells = null; const rcSell = id => { if (!rcSells) { rcSells = {}; for (const s of SHOPS) for (const x of s.sells || []) if (x.id && !rcSells[x.id]) rcSells[x.id] = x; } return id ? rcSells[id] : null; };
  const rcUni = rs => { const c = [...new Set(rs.filter(r => r.unseal).map(r => r.unseal.count))]; return c.length === 1 ? rs.find(r => r.unseal).unseal : null; };
  const rcHead = (rs, uni) => { const r = rs[0], k = rcKind(r), sh = r.scroll_from, at = sh ? ulink(sh.id, sh.name) + ((shopByCode[sh.id] || {}).where ? ` <span class="small">${esc(shopByCode[sh.id].where)}</span>` : '') : '';
    if (k === 'parts') return 'No scroll needed';
    if (k === 'boss') return 'Scroll drops from a boss';
    if (k === 'shop') return at ? (htPowerup(r) ? 'Free scroll at ' : 'Scroll sold at ') + at : 'Scroll';
    return (at ? 'Sealed hero gear · ' + at : 'Unseal a sealed copy') + (uni ? ` · unseal: ${fmt(uni.count)}x ${rcIt(uni.talisman.id, uni.talisman.name)}` : ''); };
  const rcRow = (r, i, uni, off) => { const res = rcRes(r), it = item[res.id] || {}, k = rcKind(r), sl = rcSell((r.scroll || {}).id);
    const main = (r.results || []).find(x => x.id === res.id), alt = (r.results || []).filter(x => x.id !== res.id);
    const extra = [main && main.chance != null ? pct(main.chance) : '', ...alt.map(x => `or ${rcIt(x.id, x.name)} ${pct(x.chance)}`)].filter(Boolean).join(' · ');
    const tail = [k === 'boss' && r.scroll_from ? ulink(r.scroll_from.id, r.scroll_from.name) : '', k === 'shop' && sl && sl.price ? esc(sl.price) : '', k === 'seal' && sl && sl.note ? esc(sl.note) : '',
      r.unseal && !uni ? `then ${fmt(r.unseal.count)}x ${rcIt(r.unseal.talisman.id, r.unseal.talisman.name)}` : '', r.note && !/^sealed item:/.test(r.note) ? esc(r.note) : ''].filter(Boolean).join(' · ');
    const s = [iname(res.id), res.name, (r.result || {}).name, ...(r.results || []).map(x => x.name), ...r.parts.map(p => p.name), (r.scroll_from || {}).name, sl && sl.note, rcSlot(r)].filter(Boolean).join(' ').toLowerCase();
    return `<tr class="xr${off ? ' rc-off' : ''}" data-x="recipe/${i}" data-s="${esc(s)}"><td>${icon(res.id)}<span class="${it.rar ? 'r-' + it.rar : ''}">${esc(iname(res.id))}</span>${extra ? ` <span class="small">${extra}</span>` : ''}${it.id && whenOf(it).b >= 0 ? ` <span class="small ix-rw" title="${esc(whenTip(whenOf(it)))}">· ${esc(whenTxt(whenOf(it)))}</span>` : ''}</td>`
      + `<td>${r.parts.map(p => (p.count > 1 ? fmt(p.count) + 'x ' : '') + rcIt(p.id, p.name)).join(' + ')}${tail ? ` <span class="small">· ${tail}</span>` : ''}</td></tr>`; };
  /* the card under a recipe row: what the result is, when it shows up, other ways to get it, what it goes into next */
  const rcCard = i => { const r = (W.recipes || [])[+i]; if (!r) return ''; const res = rcRes(r), it = item[res.id] || {}, av = (W.avail || {})[res.id];
    const also = (it.sources || []).filter(s => s.kind !== 'craft'), used = usedIn(res.id), st = statTxt(it);
    const kv = (k, v) => v ? `<b>${k}</b><span>${v}</span>` : '';
    return `<div class="mph"><b>${icon(res.id)}<span class="${it.rar ? 'r-' + it.rar : ''}">${esc(iname(res.id))}</span></b></div>`
      + `<div class="small">${[it.slot, it.rarity].filter(Boolean).map(esc).join(' · ')}</div><div class="kv">`
      + kv('Stats', st ? esc(st) : '')
      + kv('When', it.id && whenOf(it).b >= 0 ? whenCell(it) : av ? esc(av[0] === 'post' ? 'after beating the game' : 'from ' + av[0]) : '')
      + kv('Also from', also.slice(0, 2).map(srcShort).join(' · ') + (also.length > 2 ? ` <span class="small">+${also.length - 2} more</span>` : ''))
      + kv('Used in', used.slice(0, 5).map(x => ref(rcRes(x))).join(', ') + (used.length > 5 ? ` <span class="small">+${used.length - 5} more</span>` : ''))
      + `</div>${rcKind(r) === 'seal' && W.sealed_rule ? `<div class="small">${esc(W.sealed_rule)}</div>` : ''}`
      + `<div class="pk-open"><a href="#item/${encodeURIComponent(res.id)}" class="pk-go">Open item page →</a></div>`; };
  P.recipes = (_, f) => { detail.recipe = rcCard;
    const R = W.recipes || [], ORD = ['Weapon', 'Accessory', 'Armor', 'Boots', 'Material'], LAB = { Material: 'Materials' };
    const slots = [...new Set(R.map(rcSlot))].sort((a, b) => (ORD.indexOf(a) + 1 || 99) - (ORD.indexOf(b) + 1 || 99));
    const rs = f.rs === 'all' || slots.includes(f.rs) ? f.rs : slots[0], inS = r => rs === 'all' || rcSlot(r) === rs;
    const kinds = [['all', 'Any'], ['parts', 'No scroll'], ['shop', 'Shop scroll'], ['boss', 'Boss scroll'], ['seal', 'Sealed gear']].map(([k, l]) => [k, l, R.filter(r => inS(r) && (k === 'all' || rcKind(r) === k)).length]).filter(x => x[2]);
    const rk = kinds.some(x => x[0] === f.rck) ? f.rck : (kinds.find(x => x[0] === 'parts') || kinds[0] || ['all'])[0];
    const on = r => inS(r) && (rk === 'all' || rcKind(r) === rk);
    const G = new Map(); R.forEach((r, i) => { const g = rcGroup(r); if (!G.has(g)) G.set(g, []); G.get(g).push([r, i]); });
    const rwk = r => { const it = item[rcRes(r).id], w = it ? whenOf(it) : null; return !w || w.b < 0 ? 40 : w.b * 10 + w.s; };   /* ux2: earliest first inside each group */
    G.forEach(g => g.sort((x, y) => rwk(x[0]) - rwk(y[0]) || x[1] - y[1]));
    const KO = { parts: 0, shop: 1, boss: 2, seal: 3 }, groups = [...G.values()].sort((a, b) => KO[rcKind(a[0][0])] - KO[rcKind(b[0][0])]);
    const solo = rk !== 'all' && groups.filter(g => rcKind(g[0][0]) === rk).length === 1;   // one group only: its header would repeat the chip
    const body = groups.map(g => { const rs2 = g.map(x => x[0]), uni = rcUni(rs2), vis = rs2.some(on);
      return `<tr class="grp${vis && !solo ? '' : ' rc-off'}"><td colspan="2">${rcHead(rs2, uni)}</td></tr>` + g.map(([r, i]) => rcRow(r, i, uni, !on(r))).join(''); }).join('');
    return `<h2>Recipes</h2><p class="small">Scroll (if any) and every part on one unit (hero or pet): the item forms on the spot. Earliest first.</p>`
      + `<div class="rc-find"><input class="tsearch" placeholder="Search all ${R.length} recipes: result, part or hero"> <span class="tsearch-n small"></span></div>`
      + `<div class="rc-ch">${subtabs('recipes', 'rs', slots.map(s => [s, `${LAB[s] || s} ${R.filter(r => rcSlot(r) === s).length}`]).concat([['all', `All ${R.length}`]]), rs)}${subtabs('recipes', 'rck', kinds.map(([k, l, n]) => [k, `${l} ${n}`]), rk)}</div>`
      + ((rk === 'seal' || rk === 'all') && W.sealed_rule && R.some(r => on(r) && rcKind(r) === 'seal') ? `<p class="small"><b>Sealed gear:</b> ${esc(W.sealed_rule)}</p>` : '')
      + `<div class="tbl compact rc-list"><table class="rc-t"><tr><th>Result</th><th>Parts</th></tr>${body}</table></div>`;
  };
  /* ---------- quests, shops ---------- */
  /* quests: chips Main quest / Side quests. Main = the step guide cut into stages (chips, 'All' = every step, a Next link ends each stage),
     the zone shows once per run of steps in it. Side = one line per quest (name + reward preview) grouped by NPC in zone order, with an
     in-tab search; a tap opens Needs / every reward with its chance / Where in place (K.detail.quest). */
  const QSTAGES = [[0, 'Start'], [4, 'Windmill'], [9, 'Steel Fortress'], [17, 'Green Dragon'], [22, 'N2+']];
  const qName = q => q.name.replace(/^Hidden Quest - /, '').replace(/\s*\(Boss\)$/, '');
  /* Boss kills chip: '(Boss)' in the name OR Needs = 'Kill (the) <a boss>' (Dragon Turtle Hunt, Defeat the Soul Walker, the two hidden boss quests) */
  const qBN = new Set(Object.values(BOSS).map(b => b.name)), qIsBoss = q => /\(Boss\)/.test(q.name) || qBN.has((/^Kill (?:the )?(.+?)(?= in | below | after |$)/.exec(q.needs || '') || [])[1]), qIsHid = q => /^Hidden Quest/.test(q.name);
  /* Needs names become links: a monster / boss opens its card with the map, an item its sources ('Bring' quests link items, the rest units) */
  let qNL = null;
  const qLink = t => { t = String(t || ''); if (!qNL) { const u = new Map(), it = new Map();
      for (const [id, b] of Object.entries(BOSS)) if (b.name && !u.has(b.name)) u.set(b.name, id);
      for (const [id, m] of Object.entries(MON)) if (m.name && !u.has(m.name)) u.set(m.name, id);
      for (const x of W.items || []) { const n = x.dn || x.name; if (!x.legacy && n && !it.has(n)) it.set(n, x.id); }
      const srt = m => [...m].filter(([n]) => n.length >= 3).sort((a, b) => b[0].length - a[0].length); qNL = { u: srt(u), i: srt(it) }; }
    const hit = []; let s = t;
    for (const [n, id] of /^Bring\b/.test(t) ? qNL.i : qNL.u) for (const a of /man$/.test(n) ? [n, n.slice(0, -3) + 'men'] : [n]) {
      const m = new RegExp('(^|[^A-Za-z])(' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:e?s)?)(?![A-Za-z])').exec(s); if (!m) continue;
      const p = m.index + m[1].length; hit.push([p, m[2].length, id]); s = s.slice(0, p) + '\u0000'.repeat(m[2].length) + s.slice(p + m[2].length); }
    let o = '', k = 0; for (const [p, len, id] of hit.sort((a, b) => a[0] - b[0])) { const w = t.slice(p, p + len); o += esc(t.slice(k, p)) + (item[id] ? `<a href="#item/${encodeURIComponent(id)}">${esc(w)}</a>` : ulink(id, w)); k = p + len; }
    return o + esc(t.slice(k)); };
  /* the guide says 'Type -save': the Legacy load has to come first, or that save wipes the saved Legacy gear (the Legacy tab's warning) */
  const qSave = () => (LEG.first || []).some(x => /Legacy Equipment Load/.test(x)) ? '<li>Before your first -save each game: Legacy Equipment Load on the Legacy Bag (F2), or the save wipes your saved <a href="#legacy">Legacy gear</a>.</li>' : '';
  const qPv = q => [/^\d/.test(q.reward || '') ? q.reward.split(', ')[0] : '', ...(q.reward_items || []).map(x => (x.count > 1 ? fmt(x.count) + 'x ' : '') + (item[x.id] ? iname(x.id) : x.name || ''))].filter(Boolean).join(', ');
  const qCard = id => { const q = ((W.quests || {}).side || []).find(x => x.id === id); if (!q) return '';
    const hint = q.zone_hint && q.zone_hint !== (Z[q.zone] || {}).name && q.zone_hint !== 'Starting area' ? q.zone_hint : '';
    const rw = [q.reward ? esc(q.reward === 'One roll' ? 'One of:' : q.reward) : '', ...(q.reward_items || []).map(x => (x.count > 1 ? fmt(x.count) + 'x ' : '') + ref(x) + (x.chance != null && x.chance < 100 ? ` <span class="small">${pct(x.chance)}</span>` : ''))].filter(Boolean);
    return `<div class="kv qs-kv"><b>Needs</b><span>${q.needs ? qLink(q.needs) : '-'}</span><b>Reward</b><span>${rw.join('<br>') || '-'}</span>${hint ? `<b>Where</b><span>${zoneLinks(esc(hint))}</span>` : ''}</div>`; };
  out.addEventListener('click', e => { if (!e.target.closest('.qs-next a')) return; const el = out.querySelector('.qs-stg'); if (el) el.scrollIntoView({ block: 'start' }); });
  P.quests = (_, f) => { detail.quest = qCard; const Q = W.quests || { main: [], side: [] }; const G = W.qguide || {}; const S = Q.side || []; const steps = G.steps || [];
    const view = f.qv === 'side' ? 'side' : 'main'; let body = '';
    if (view === 'main' && steps.length) { const last = steps[steps.length - 1].step;
      const ST = QSTAGES.filter(([a]) => steps.some(s => s.step >= a)).map(([a, nm], i, arr) => ({ a, b: i + 1 < arr.length ? arr[i + 1][0] - 1 : last, nm }));
      const st = f.qst === 'all' ? null : ST.find(t => String(t.a) === f.qst) || ST[0]; const vis = st ? steps.filter(s => s.step >= st.a && s.step <= st.b) : steps;
      const nx = st && ST[ST.indexOf(st) + 1]; let pz = '';
      body = ((G.before || []).length ? `<div class="card hi one"><p><b>Before you start:</b> ${G.before.map(tok).join(' ')}</p></div>` : '')
        + (Array.isArray(G.intro) ? `<div class="card qs-rules"><ul>${G.intro.map(x => `<li>${tok(x)}</li>` + (/-save/.test(x) ? qSave() : '')).join('')}${G.intro.some(x => /-save/.test(x)) ? '' : qSave()}</ul></div>` : G.intro ? `<p class="small">${tok(G.intro)}</p>` : '')
        + `<div class="qs-stg">${subtabs('quests', 'qst', [...ST.map(t => [String(t.a), `${t.a}-${t.b} ${t.nm}`]), ['all', 'All']], st ? String(st.a) : 'all')}</div>`
        + `<div class="qs-steps">` + vis.map(s => { const zl = s.zone && s.zone !== pz && Z[s.zone] ? `<div class="qs-z">${link('zones', s.zone, Z[s.zone].name)}</div>` : ''; pz = s.zone;
          return `<div class="qs-st"><span class="qs-n">${fmt(s.step)}${s.on && s.on !== 'N1+' ? `<small>${esc(s.on)}</small>` : ''}</span><div>${zl}<div>${tok(s.do)}</div>${s.note ? `<div class="small">${tok(s.note)}</div>` : ''}${s.reward && s.reward !== '-' ? `<div class="qs-r"><b>Reward</b>${tok(s.reward)}</div>` : ''}</div></div>`; }).join('') + `</div>`
        + (G.points_note && vis.some(s => /Point/.test(s.reward || '')) ? `<p class="small">${esc(G.points_note)}</p>` : '')
        + (nx ? `<div class="sub-tabs qs-next"><a href="#quests" data-f="qst=${nx.a}">Next: ${nx.a}-${nx.b} ${esc(nx.nm)} →</a></div>` : ''); }
    else if (view === 'main') body = tbl(['#', 'Step', 'Where', 'Done by', 'On'], (Q.main || []).map(s => tr([fmt(s.step), esc(s.title), `<span class="small">${esc(s.where || '')}</span>`, `<span class="small">${esc(s.done_by || '')}</span>`, `<span class="small">${esc(s.difficulty || 'all')}</span>`])));
    else { const sq = ['boss', 'hidden'].includes(f.sq) ? f.sq : ''; const L = S.filter(q => sq === 'boss' ? qIsBoss(q) : sq === 'hidden' ? qIsHid(q) : true);
      const groups = []; const at = {}; for (const q of L) { const key = (q.npc && q.npc.id) || '?'; if (!(key in at)) { at[key] = groups.length; groups.push([q, []]); } groups[at[key]][1].push(q); }
      const zo = q => Z[q.zone] ? Z[q.zone].order : 999; groups.sort((x, y) => zo(x[0]) - zo(y[0]));
      const row = q => `<tr class="xr" data-x="quest/${encodeURIComponent(q.id)}" data-s="${esc([q.name, q.npc && q.npc.name, (Z[q.zone] || {}).name, q.zone_hint, q.needs, q.reward, ...(q.reward_items || []).map(x => item[x.id] ? iname(x.id) : x.name), q.repeat ? '' : 'once', qIsBoss(q) ? 'boss' : ''].filter(Boolean).join(' ').toLowerCase())}"><td>${esc(qName(q))}${q.repeat ? '' : ' <span class="tag">once</span>'}${qIsHid(q) ? ' <span class="tag">hidden</span>' : ''}</td><td><div class="qs-pv">${esc(qPv(q) || '-')}</div></td></tr>`;
      body = `<p class="small">Side quests repeat, except the ones tagged once.</p>`
        + `<div class="qs-bar">${subtabs('quests', 'sq', [['', `All (${S.length})`], ['boss', `Boss kills (${S.filter(qIsBoss).length})`], ['hidden', `Hidden (${S.filter(qIsHid).length})`]], sq)}<input class="tsearch" placeholder="Quest, NPC, item or monster"><span class="tsearch-n small"></span></div>`
        + `<div class="tbl compact qs-sq nosort"><table><tr><th>Quest</th><th>Reward</th></tr>` + groups.map(([g, qs]) => `<tr class="grp"><td colspan="2">${g.npc ? ref(g.npc) : 'No quest giver'}${g.zone ? ` <span class="small">· ${zlink(g.zone)}</span>` : ''}</td></tr>` + qs.map(row).join('')).join('') + `</table></div>`; }
    return `<h2>Quests</h2>${(Q.how || []).length ? `<div class="card"><h4 style="margin-top:0">How</h4><ol>${Q.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}`
      + subtabs('quests', 'qv', [['main', `Main quest (${steps.length || (Q.main || []).length} steps)`], ['side', `Side quests (${S.length})`]], view) + body; };
  P.shop = id => { const s = shopByCode[id]; if (!s) return '<p>Unknown shop.</p>';
    const K = window.AP, zid = zoneOf(id), sells = s.sells || [], pr = [...new Set(sells.map(x => x.price || ''))], nt = [...new Set(sells.map(x => x.note || ''))];
    const qs = ((W.quests || {}).side || []).filter(q => q.npc && q.npc.id === id), showItems = sells.length && !(znIsQ(s) && qs.length);
    const plain = showItems && (pr.length === 1 || sells.length === 1) && nt.length === 1;   /* one price and one note: stated once, items as a compact grid */
    /* map (UX pass 2): one town = that town zoomed in with the NPC ringed; several towns = every spot ringed on one map. An NPC merged into a
       neighbour's marker by the build (within 300) falls back to the marker of the same name there (map.js ptAt) */
    const zs = SZ[id] || (Z[zid] ? [zid] : []), pts = znPts(K, p => p.k !== 'boss' && (p.id === id || (p.n === s.name && zs.includes(p.zone))));
    const mh = zs.length === 1 && Z[zs[0]] && K.miniMapHtml ? K.miniMapHtml(zs[0], { pt: id })
      : pts.length && K.mapSvg ? K.mapSvg({ hl: new Set(pts), spots: pts.map(i => [K.mapPts[i].x, K.mapPts[i].y, 20]) }) : '';
    const map = mh ? `<div class="zn-sm"><h4>On the map</h4>${mh}</div>` : '';
    const sib = znSibs(s), sub = [znWhere(s, zid), plain && pr[0] ? 'Price: ' + esc(pr[0]) : '', plain && nt[0] ? esc(nt[0]) : ''].filter(Boolean).join(' · ');
    return `<p class="small">${Z[zid] ? '← ' + zlink(zid) : link('zones', '', 'All zones').replace('/"', '"')}</p><h2>${esc(s.name)}</h2>`
      + (sub ? `<p class="small">${sub}</p>` : '') + (s.note ? `<p class="small zn-snote">${esc(s.note)}</p>` : '')
      + (sib.length > 1 ? `<p class="small">${sib.length} stand side by side, each with its own list: ${sib.map((x, k) => x.id === id ? `<b>${k + 1}</b>` : `<a href="#shop/${encodeURIComponent(x.id)}">${k + 1}</a>`).join(' · ')}</p>` : '')
      + `<div class="${map ? 'zn-sp' : ''}"><div>`
      + (qs.length ? `<h4>Quests</h4><div class="tbl compact"><table><tr><th>Quest</th><th>Reward</th></tr>${znQRows(qs)}</table></div>` : '')
      + (!showItems ? '' : `<h4>Sells</h4>` + (plain ? `<div class="zn-ilist">${sells.map(x => `<div>${ref(x)}</div>`).join('')}</div>`
        : tbl(['Item', 'Price', ...(nt.length > 1 ? ['Note'] : [])], sells.map(x => tr([ref(x), `<span class="small">${esc(x.price || '')}</span>`, ...(nt.length > 1 ? [`<span class="small">${esc(x.note || '')}</span>`] : [])])))))
      + `</div>${map}</div>`; };
  P.npc = P.shop;
  /* ---------- legacy ---------- */
  /* Legacy tab: the save warning stays in view, the Bag how-to and the reading rules fold, then the 15 lines by slot (chips: All,
     By timing, one per slot); a row opens its line card in place (detail.lgl): how to get (boss / merchant link + zone), first 3 steps, end item.
     ux2 2026-09-25: every line gets its timing tag from lgWhen (was 7 hand tags with the Flame Lord starts called 'early'); 'By timing' lists all 15 */
  const LG_ORD = ['Main Weapon', 'Support Weapon', 'Helmet', 'Armor', 'Gloves', 'Belt', 'Accessory', 'Treasure'];
  const lgBold = x => esc(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const lgCard = id => { const l = LEG.lines.find(x => x.root.id === id); if (!l) return ''; const w = lgWhen(l);
    return `<div class="mph"><b>${icon(l.root.id)}${esc(l.name)}</b></div><div class="small">${esc(l.slot || '')} · ${fmt(l.steps.length)} steps${w[1] ? ' · ' + esc(w[1]) : ''}</div><div class="kv">`
      + `<b>How to get</b><span>${lgStartH(l)}${lgPts(l) ? `<br><span class="small">${lgPtsNote()}</span>` : ''}</span><b>First item</b><span>${ref(l.root)}</span>`
      + (l.first_needs ? `<b>First 3 steps need</b><span>${esc(l.first_needs)}</span>` : '') + (l.final ? `<b>Ends at</b><span>${ref(l.final)}</span>` : '') + `</div>`
      + `<div class="pk-open"><a href="#legacyline/${encodeURIComponent(id)}" class="pk-go">Open line page →</a></div>`; };
  const lgRow = (l, tag) => { const w = tag ? lgWhen(l) : ['', ''];
    return `<tr class="xr" data-x="lgl/${encodeURIComponent(l.root.id)}"><td>${icon(l.root.id)}<b>${esc(l.name)}</b>${w[1] ? ` <span class="tag">${esc(w[1])}</span>` : ''}</td><td class="small">${esc(l.start || '')}</td><td class="num">${fmt(l.steps.length)}</td></tr>`; };
  P.legacy = (_, f) => { detail.lgl = lgCard;
    const slots = [...new Set(LEG.lines.map(l => l.slot || ''))].sort((a, b) => (LG_ORD.indexOf(a) + 1 || 99) - (LG_ORD.indexOf(b) + 1 || 99));
    const v = f.lgs === 'start' || slots.includes(f.lgs) ? f.lgs : '', so = l => LG_ORD.indexOf(l.slot) + 1 || 99, cut = (W.stage_cut || {})['N1-3'] || {};
    const glab = k => k === 'early' && (cut.early || [])[1] ? `${LG_W.early} (${cut.early[0]} to ${cut.early[1]})` : k === 'mid' && (cut.mid || [])[1] ? `${LG_W.mid} (to ${cut.mid[1]})` : LG_W[k] || 'Other';
    const groups = v === 'start' ? ['early', 'mid', 'late', 'hi', 'pts', 'rng', ''].map(k => [glab(k), LEG.lines.filter(l => lgWhen(l)[0] === k).sort((a, b) => so(a) - so(b))]).filter(g => g[1].length)
      : (v ? [v] : slots).map(s => [s, LEG.lines.filter(l => (l.slot || '') === s)]);
    const warn = (LEG.first || []).filter(x => /\*\*/.test(x)), how = (LEG.first || []).filter(x => !/\*\*/.test(x));
    return `<h2>Legacy gear</h2>${LEG.summary ? `<p class="small">${esc(LEG.summary)}</p>` : ''}`
      + warn.map(x => `<div class="card warn one"><p>${lgBold(x)}</p></div>`).join('')
      + (how.length ? `<details class="card lg-how"><summary>How the Legacy Bag works</summary><ul>${how.map(x => `<li>${lgBold(x)}</li>`).join('')}</ul></details>` : '')   /* ux3: 'Reading the steps' stays on the line pages */
      + subtabs('legacy', 'lgs', [['', 'All'], ['start', 'By timing'], ...slots.map(s => [s, s])], v)
      + `<div class="tbl compact lg-t"><table><tr><th>Line</th><th>Starts from</th><th class="num">Steps</th></tr>`
      + groups.map(([g, ls]) => (v && v !== 'start' ? '' : `<tr class="grp"><td colspan="3">${esc(g)}</td></tr>`) + ls.map(l => lgRow(l, v !== 'start')).join('')).join('') + `</table></div>`;
  };
  /* Legacy line page: chips pick the rows (key steps, 1-20, 21-40... all); stats that changed since the step before are bold;
     long 'to evolve' text folds to 2 lines with a 'more' button; on a phone a step = item + stats on one line, then 'to evolve' */
  const LL_CH = 20;
  const llStats = (l, i, hl) => { const cur = (l.steps[i].stats || '').split(', ').filter(Boolean); if (!hl || !i) return esc(cur.join(', '));
    const prev = new Set((l.steps[i - 1].stats || '').split(', ')); return cur.map(t => prev.has(t) ? esc(t) : `<b class="ll-up">${esc(t)}</b>`).join(', '); };
  const llNext = (l, i) => { const s = l.steps[i], nx = l.steps[i + 1];
    return `<span class="ll-nx">${s.to && (!nx || nx.id !== s.to.id) ? `→ ${ref(s.to)}: ` : ''}${esc(s.next || '').split(' OR ').join('<br><i>or</i> ')}</span>`; };
  const llTable = (l, idx, hl, me) => `<div class="tbl compact ll-t"><table><tr><th class="num">#</th><th>Item</th><th>Stats</th><th>To evolve</th></tr>${idx.map(i => `<tr${i === me ? ' class="ll-me"' : ''}><td class="num">${fmt(i + 1)}</td><td>${ref(l.steps[i])}</td><td class="small">${llStats(l, i, hl)}</td><td class="small">${llNext(l, i)}</td></tr>`).join('')}</table></div>`;
  const llFold = root => root.querySelectorAll('.ll-nx').forEach(e => { const b = e.nextElementSibling; if (b && b.classList.contains('ll-more')) return; if (e.scrollHeight > e.clientHeight + 2) e.insertAdjacentHTML('afterend', '<button type="button" class="ll-more">more</button>'); });
  out.addEventListener('click', e => { const b = e.target.closest('button.ll-more'); if (!b) return; const on = b.previousElementSibling.classList.toggle('full'); b.textContent = on ? 'less' : 'more'; });
  P.legacyline = (id, f) => { const l = LEG.lines.find(x => x.root.id === id); if (!l) return '<p>Unknown line.</p>';
    const n = l.steps.length, all = l.steps.map((_, i) => i), keys = (l.key_steps || []).filter(i => l.steps[i]);
    const rng = k => { const a = k * LL_CH + 1, b = Math.min(n, (k + 1) * LL_CH); return a === b ? String(a) : `${a}–${b}`; };
    const opts = (keys.length ? [['key', 'Key steps']] : []).concat(Array.from({ length: Math.ceil(n / LL_CH) }, (_, k) => [String(k * LL_CH), rng(k)]), n > LL_CH ? [['all', `All ${n}`]] : []);
    /* chip and lit row are kept per line ('<root>:<value>'): another line opens on its own Key steps; an item page's 'show in the line' sets both */
    const pre = l.root.id + ':', cur = String(f.lls || '').startsWith(pre) ? String(f.lls).slice(pre.length) : '', v = opts.some(o => o[0] === cur) ? cur : opts[0][0];
    const me = String(f.llme || '').startsWith(pre) ? +String(f.llme).slice(pre.length) : -1;
    const idx = v === 'key' ? keys : v === 'all' ? all : all.slice(+v, +v + LL_CH);
    return `<h2>${esc(l.name)}</h2><p class="small">${esc(l.slot || '')} · ${fmt(n)} steps · starts from ${ref(l.root)}: ${lgStartH(l)}${lgPts(l) ? ' · <a href="#calc">Points per run</a>' : ''}${l.final ? ` · ends at ${ref(l.final)}` : ''}</p>`
      + `<div class="card hi ll-find"><label>Find my step <input id="lfind" data-root="${esc(l.root.id)}" list="lsteps" placeholder="type or pick your current item"></label><datalist id="lsteps">${l.steps.map((s, i) => `<option value="${esc(s.name)}">step ${i + 1}</option>`).join('')}</datalist><div id="lnext"></div></div>`
      + (opts.length > 1 ? subtabs('legacyline/' + encodeURIComponent(l.root.id), 'lls', opts.map(([k, t]) => [pre + k, t]), pre + v) : '')
      + ((LEG.rules || []).length ? `<details class="ll-rules"><summary>Reading the steps</summary><ul>${LEG.rules.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : '')
      + llTable(l, idx, v !== 'key', me); };

  /* ---------- search ---------- */
  const INDEX = [];
  for (const i of W.items || []) INDEX.push({ k: 'item', id: i.id, t: i.dn || i.name, x: i.dn && i.dn !== i.name ? i.name : '', s: (i.legacy ? 'legacy · ' : (i.slot || '') + ' · ') + (i.stats || ''), w: i.legacy ? 0 : 2 });
  for (const m of Object.values(MON)) INDEX.push({ k: 'unit', id: m.id, t: m.name, s: 'monster · ' + ((Z[zoneOf(m.id)] || {}).name || ''), w: 2 });
  for (const b of Object.values(BOSS)) INDEX.push({ k: 'boss', id: b.id, t: b.name, s: 'boss · ' + ((Z[zoneOf(b.id)] || {}).name || ''), w: 3 });
  for (const s of SHOPS) INDEX.push({ k: 'shop', id: s.id, t: s.name, s: 'shop · ' + (s.where || ''), w: 2 });
  for (const z of ZONES) INDEX.push({ k: 'zones', id: z.id, t: z.name, s: 'zone', w: 4 });
  for (const q of ((W.quests || {}).side || [])) INDEX.push({ k: 'quests?qv=side&sq=&xo=' + encodeURIComponent('quest/' + encodeURIComponent(q.id)), id: '', t: q.name, s: 'side quest · ' + [(q.npc || {}).name, (Z[q.zone] || {}).name, q.needs].filter(Boolean).join(' · '), w: 3 });
  for (const l of LEG.lines) INDEX.push({ k: 'legacyline', id: l.root.id, t: l.name, s: 'legacy line · ' + (l.slot || ''), w: 3 });
  const KL = { systems: 'Game system', zones: 'Zone', quests: 'Quest', hero: 'Hero', boss: 'Boss', unit: 'Monster', shop: 'Shop', legacyline: 'Legacy line', item: 'Item', calc: 'Calculator', commands: 'Commands', map: 'Map', tier: 'Tier list' };
  /* each word also matches its stem (enhance -> Enhancing, revive -> Revives, gloves -> glove); e.x = extra text that matches but never shows */
  const srStem = w => w.length > 4 ? w.replace(/(ing|ed|es|e|s)$/, '') : w;
  function search(q) { q = q.trim().toLowerCase(); if (q.length < 2) return []; const words = q.split(/\s+/).map(w => [w, srStem(w)]);
    return INDEX.map(e => { const t = e.t.toLowerCase(), s = ((e.s || '') + ' ' + (e.x || '')).toLowerCase(); let sc = 0; for (const [w, v] of words) { if (t === w) sc += 10; else if (t.startsWith(w)) sc += 6; else if (t.includes(w)) sc += 4; else if (v !== w && t.includes(v)) sc += 3; else if (s.includes(w) || (v !== w && s.includes(v))) sc += 1; else return null; } return { e, sc: sc + e.w }; }).filter(Boolean).sort((a, b) => b.sc - a.sc || a.e.t.length - b.e.t.length).slice(0, 80); }
  const href = e => '#' + e.k + (e.id !== '' && e.id != null ? '/' + encodeURIComponent(e.id) : '');
  /* results grouped by kind, the group with the best hit first; each group = one card with its top 5 hits on one line each + '+N more' */
  const SR_TOP = 5;
  function renderSearch(q) { const hits = search(q), gp = $('#gpick'); if (gp) gp.hidden = true; $('#qcount').textContent = hits.length ? hits.length + ' results' : ''; if (!hits.length) { out.innerHTML = `<p class="small">No match for "${esc(q)}".</p>`; return; }
    const groups = {}; for (const h of hits) { const k = h.e.k.split('?')[0]; (groups[k] = groups[k] || []).push(h); }
    const hit = (h, i) => { const it = h.e.k === 'item' && item[h.e.id]; return `<div class="hit"${i >= SR_TOP ? ' hidden' : ''}><a href="${esc(href(h.e))}">${it ? icon(h.e.id) + `<span class="${it.rar ? 'r-' + it.rar : ''}">${esc(h.e.t)}</span>` : esc(h.e.t)}</a><span class="small">${esc(String(h.e.s || '').slice(0, 120))}</span></div>`; };
    out.innerHTML = `<h2>Search: ${esc(q)}</h2><div class="sr-grid">` + Object.keys(groups).sort((a, b) => groups[b][0].sc - groups[a][0].sc).map(k => `<div class="card sr-g"><h4>${esc(KL[k] || k)} <span class="small">· ${groups[k].length}</span></h4>`
      + groups[k].map(hit).join('') + (groups[k].length > SR_TOP ? `<button type="button" class="sr-more">+${groups[k].length - SR_TOP} more</button>` : '') + '</div>').join('') + '</div>'; }
  out.addEventListener('click', e => { const b = e.target.closest('.sr-more'); if (!b) return; b.parentElement.querySelectorAll('.hit[hidden]').forEach(h => { h.hidden = false; }); b.remove(); });

  /* ---------- router ---------- */
  const hooks = []; let lastView = '';
  hooks.push((page, root) => { if (!detail.item) detail.item = itemDetail; if (page === 'items') applyItemSearch(root); });
  hooks.push((page, root) => { if (page !== 'legacyline') return; llFold(root);
    if (filters.llgo) { delete filters.llgo; const me = root.querySelector('.ll-t tr.ll-me'); if (me) requestAnimationFrame(() => me.scrollIntoView({ block: 'center' })); }   /* item page 'show in the line': bring the step into view once */
    const inp = root.querySelector('#lfind'); if (!inp) return;
    const l = LEG.lines.find(x => x.root.id === inp.dataset.root); const box = root.querySelector('#lnext');
    const show = () => { const q = inp.value.trim().toLowerCase(); if (!q) { box.innerHTML = ''; return; }
      let i = l.steps.findIndex(s => (s.name || '').toLowerCase() === q); if (i < 0) i = l.steps.findIndex(s => (s.name || '').toLowerCase().includes(q));
      box.innerHTML = i < 0 ? '<p class="small">No step with that name in this line.</p>' : `<p class="ll-at"><b>You are on step ${i + 1} of ${l.steps.length}.</b>${i === l.steps.length - 1 ? ' This is the final item.' : ''}</p>`
        + llTable(l, l.steps.map((_, k) => k).slice(i, i + 4), true, i); llFold(box); };
    inp.addEventListener('input', show); inp.addEventListener('change', show); });
  /* recipes: while the search box has text, rows outside the chips show too (the search covers every recipe) */
  hooks.push((page, root) => { if (page !== 'recipes') return; const inp = root.querySelector('input.tsearch'), box = root.querySelector('.rc-list'); if (!inp || !box) return;
    inp.addEventListener('input', () => box.classList.toggle('rc-q', !!inp.value.trim())); });
  /* ---------- tables (every tab). A row whose only cell spans the table (tr.grp group header, tr.xd detail card) is not a data row:
     numbers, sparse columns, zebra and sorting work on the data rows and keep group rows in place. ---------- */
  const fullRow = r => r.cells.length === 1 && r.cells[0].colSpan > 1;
  const plainTbl = tb => { const rows = [...tb.rows]; return rows.length > 1 && !!rows[0].querySelector('th') && !tb.querySelector('[rowspan]')
    && rows.every((r, i) => (i && fullRow(r)) || ![...r.cells].some(c => c.colSpan > 1)); };
  const dataRows = tb => [...tb.rows].slice(1).filter(r => !fullRow(r));
  const NUMCELL = /^[-+−~x×]?\d[\d.,]*\s*(%|s|x|k|K|M|B)?(\s*[-–]\s*\d[\d.,]*\s*(%|s|x|k|K|M|B)?)?$/, NUMSKIP = /^(-|–|—|no|none)?$/i;
  const alignNums = root => root.querySelectorAll('table').forEach(tb => { if (!plainTbl(tb)) return; const head = tb.rows[0], body = dataRows(tb).filter(r => !r.querySelector('th'));
    [...head.cells].forEach((th, ci) => { let n = 0; for (const r of body) { const c = r.cells[ci]; if (!c) continue; const t = c.textContent.trim(); if (NUMSKIP.test(t)) continue; if (!NUMCELL.test(t)) return; n++; }
      if (n) { th.classList.add('num'); for (const r of body) if (r.cells[ci]) r.cells[ci].classList.add('num'); } }); });
  /* a column filled on only 1-2 rows (or under 8%) wastes width: fold its values into the first cell and drop it;
     a column with one value on every row becomes a line above the table. Never folds a table below 2 columns. */
  const sparseCols = root => root.querySelectorAll('table').forEach(tb => { if (!plainTbl(tb)) return; const rows = [...tb.rows], head = rows[0], body = dataRows(tb);
    if (body.length < 4) return;
    const drop = ci => { for (const r of rows) { if (fullRow(r)) r.cells[0].colSpan = Math.max(1, r.cells[0].colSpan - 1); else if (r.cells[ci]) r.deleteCell(ci); } };
    for (let ci = head.cells.length - 1; ci >= 1; ci--) { if (head.cells.length <= 2) break; const full = body.filter(r => r.cells[ci] && !/^-?$/.test(r.cells[ci].textContent.trim()));
      const same = full.length === body.length && body.length >= 5 && full.every(r => r.cells[ci].textContent.trim() === full[0].cells[ci].textContent.trim());
      if (same) { (tb.closest('.tbl') || tb).insertAdjacentHTML('beforebegin', `<p class="small">${esc(head.cells[ci].textContent.trim())}: ${full[0].cells[ci].innerHTML} (all rows)</p>`); drop(ci); continue; }
      if (full.length > Math.max(2, Math.floor(body.length * 0.08))) continue;
      const lab = head.cells[ci].textContent.trim(); for (const r of full) r.cells[0].insertAdjacentHTML('beforeend', ` <span class="small">· ${esc(lab)}: ${r.cells[ci].innerHTML}</span>`);
      drop(ci); } });
  /* after every render: a stray table gets its own scroll box; zebra rows (restart under each group row); long tables that fit the
     screen get a sticky header row (a sideways-scrolling box cannot hold one); no sort cursor where sorting cannot work; chip rows
     and the tab bar (one scrolling row on phones) bring their selected chip into view and fade the edge that has more */
  const stripe = tb => { if (dataRows(tb).length < 5) return; let k = 0;
    for (const r of [...tb.rows].slice(1)) { if (fullRow(r)) { if (!r.classList.contains('xd')) k = 0; } else if (!r.hidden) r.classList.toggle('z', k++ % 2 === 1); } };
  const edge = el => { const l = el.scrollLeft > 2, r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2; if (l || r) el.dataset.ov = (l ? 'l' : '') + (r ? 'r' : ''); else delete el.dataset.ov; };
  const fitTbl = root => root.querySelectorAll('.tbl').forEach(b => { const tb = b.querySelector(':scope > table'); b.classList.remove('stk');
    if (tb && tb.rows.length > 13 && b.getClientRects().length && b.scrollWidth <= b.clientWidth + 1) b.classList.add('stk'); edge(b); });
  let chipX = null;   /* [index of the clicked chip row, its scrollLeft]: a chip click re-renders the page, the row keeps its place */
  out.addEventListener('click', e => { const st = e.target.closest('.sub-tabs'); chipX = st ? [[...out.querySelectorAll('.sub-tabs')].indexOf(st), st.scrollLeft] : null; }, true);
  const chipFx = (root, center) => { const bars = [...root.querySelectorAll('.sub-tabs')]; if (chipX && bars[chipX[0]]) bars[chipX[0]].scrollLeft = chipX[1]; chipX = null;
    for (const el of [...bars, $('nav.tabs')]) { if (!el) continue; const on = el.querySelector('a.on');
      if (center && on && el.scrollWidth > el.clientWidth) { const e = el.getBoundingClientRect(), o = on.getBoundingClientRect(); if (o.left < e.left || o.right > e.right) el.scrollLeft += o.left - e.left - (e.width - o.width) / 2; }
      edge(el); } };
  const tableFx = root => {
    root.querySelectorAll('table').forEach(tb => { if (!tb.closest('.tbl') && !tb.parentElement.closest('table,.peek,.xdc')) { const b = document.createElement('div'); b.className = 'tbl'; tb.before(b); b.appendChild(tb); }
      if (!plainTbl(tb) || dataRows(tb).length < 3) tb.classList.add('nosort'); stripe(tb); });
    fitTbl(root); chipFx(root, true); };
  let rsz = 0, lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; clearTimeout(rsz); rsz = setTimeout(() => { fitTbl(out); chipFx(out, true); }, 150); });
  document.addEventListener('scroll', e => { const el = e.target; if (el.nodeType === 1 && el.matches('nav.tabs,.sub-tabs,.tbl')) edge(el); }, true);
  out.addEventListener('toggle', e => { if (e.target.open) fitTbl(e.target); }, true);
  out.addEventListener('input', () => requestAnimationFrame(() => out.querySelectorAll('table').forEach(stripe)));
  function route() {
    const raw = location.hash.slice(1) || 'home'; let [page, idRaw] = raw.split('/'); const id = idRaw ? decodeURIComponent(idRaw) : ''; const y0 = window.scrollY;
    if (page.includes('?')) { const [p, qs] = page.split('?'); page = p; Object.assign(filters, Object.fromEntries(new URLSearchParams(qs))); history.replaceState(null, '', '#' + page + (idRaw ? '/' + idRaw : '')); }
    const tab = { unit: 'monsters', boss: 'monsters', item: 'items', shop: 'zones', npc: 'zones', legacyline: 'legacy', hero: 'heroes', commands: 'systems' }[page] || page;
    document.querySelectorAll('nav.tabs a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + tab));
    document.body.dataset.page = tab;
    const fn = P[page] || P.home; out.innerHTML = fn(id, { ...filters });
    out.classList.remove('pg-in'); void out.offsetWidth; out.classList.add('pg-in');
    const gp = $('#gpick'); if (gp) { gp.hidden = !PICK_PAGES.includes(page); if (!gp.hidden) { gp.innerHTML = gpick(); gp.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => { filters[sel.id.slice(2)] = sel.value; try { localStorage.setItem('ap_pick', JSON.stringify({ n: filters.n, md: filters.md })); } catch (e) {} route(); })); } }
    out.querySelectorAll('select[id^="f-"]').forEach(sel => sel.addEventListener('change', () => { filters[sel.id.slice(2)] = sel.value; route(); }));
    out.querySelectorAll('.sub-tabs a[data-f]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); const [k, v] = a.dataset.f.split('='); filters[k] = decodeURIComponent(v); route(); }));
    for (const h of hooks) h(page, out); sparseCols(out); alignNums(out); tableFx(out);
    const view = page + '/' + id; const same = view === lastView; lastView = view; window.scrollTo(0, same ? y0 : 0);
    if (filters.xo) { const x = filters.xo; delete filters.xo; const row = [...out.querySelectorAll('.xr')].find(r => r.dataset.x === x && !r.hidden);
      if (row) { if (!row.classList.contains('open')) xOpen(row); row.scrollIntoView({ block: 'center' }); } }
  }
  const subtabs = (page, key, list, cur) => `<div class="sub-tabs">${list.map(([k, l]) => `<a href="#${page}" data-f="${key}=${encodeURIComponent(k)}" class="${k === cur ? 'on' : ''}">${esc(l)}</a>`).join('')}</div>`;
  /* click a column header to sort that table (numbers by value, 2.6 M / 13k / 1,234 / 45% understood; empty last).
     Rows sort inside their group (tr.grp keeps its rows under it); an open detail card closes first. */
  const sortVal = t => { t = t.trim(); if (!t || t === '-' || t === 'no') return null; const m = t.replace(/,/g, '').match(/^[^\d-]{0,3}(-?\d+(?:\.\d+)?)\s*(B|M|k)?\b/);
    return m ? parseFloat(m[1]) * ({ B: 1e9, M: 1e6, k: 1e3 }[m[2]] || 1) : t.toLowerCase(); };
  out.addEventListener('click', e => { const th = e.target.closest('th'); if (!th || th.closest('.nosort')) return; const tr0 = th.parentElement, tb = th.closest('table');
    if (!tb || tb.rows[0] !== tr0 || !plainTbl(tb)) return; const ci = [...tr0.cells].indexOf(th); const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
    [...tb.rows].forEach(r => { if (r.classList.contains('xd')) r.remove(); else r.classList.remove('open'); });
    tr0.querySelectorAll('th').forEach(h => { delete h.dataset.dir; }); th.dataset.dir = dir; const body = tb.rows[1] ? tb.rows[1].parentElement : null; if (!body) return;
    const key = r => sortVal(r.cells[ci] ? r.cells[ci].textContent : '');
    const cmp = (a, b) => { const x = key(a), y = key(b); if (x === null) return y === null ? 0 : 1; if (y === null) return -1;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return dir === 'asc' ? c : -c; };
    const segs = [[null, []]]; for (const r of [...tb.rows].slice(1)) { if (fullRow(r)) segs.push([r, []]); else segs[segs.length - 1][1].push(r); }
    for (const [g, rs] of segs) { if (g) body.appendChild(g); rs.sort(cmp).forEach(r => body.appendChild(r)); } stripe(tb); });
  /* ---------- peek panel: a link to an item / monster / boss / hero / zone / shop / legacy line opens a short card here;
     'Open page' (or ctrl / middle click) goes to the full page. One component for the whole site. ---------- */
  const PEEK = new Set(['item', 'unit', 'boss', 'hero', 'zones', 'shop', 'npc', 'legacyline']);
  const peekCard = (page, id) => {
    const head = (t, sub) => `<div class="mph"><b>${t}</b><a href="#" class="mpx" title="Close">×</a></div>${sub ? `<div class="small">${sub}</div>` : ''}`;
    const open = pg => `<div class="pk-open"><a href="#${pg || page}/${encodeURIComponent(id)}" class="pk-go">Open page →</a></div>`;
    if (page === 'item' && item[id] && lgOf(id)) { const { ln, k, st } = lgOf(id);
      return head(icon(id) + esc(iname(id)), `Legacy · ${esc(ln.slot || '')} · step ${fmt(k + 1)} of ${fmt(ln.steps.length)}`)
        + `<div class="small" style="margin:4px 0">${lgHow(id, true)}</div>` + (st && st.stats ? `<div>${esc(st.stats)}</div>` : '')
        + (st && st.next && k < ln.steps.length - 1 ? `<div class="small">Next step when: ${esc(st.next)}</div>` : '') + open(); }
    if (page === 'item' && item[id] && item[id].legacy) return head(icon(id) + esc(item[id].name), `Legacy · starts the ${esc(item[id].legacy)} line`) + `<div class="small" style="margin:4px 0">${lgTicket(id, true)}</div>` + open();
    if (page === 'item' && item[id]) { const i = item[id];
      const eff = i.real ? '' : effClean(i.effect).split(/(?<=\.)\s/)[0], st = statTxt(i), w = whenOf(i), g = getLine(id);
      return head(icon(id) + `<span class="${i.rar ? 'r-' + i.rar : ''}">${esc(i.name)}</span>`, [i.slot, i.rarity].filter(Boolean).map(esc).join(' · '))
        + (st ? `<div>${esc(st)}</div>` : '')
        + (w.b >= 0 ? `<div class="small ix-pk"><b>When</b>${whenCell(i)}</div>` : '')
        + (g ? `<div class="small ix-pk"><b>Get</b>${g}</div>` : '')
        + (eff && eff !== st ? `<div class="small">${effFmt(eff.slice(0, 220))}</div>` : '') + open(); }
    if ((page === 'unit' || page === 'boss') && BOSS[id]) { const b = BOSS[id];
      return head(esc(b.name), 'Boss' + (zoneOf(id) && Z[zoneOf(id)] ? ' · ' + zlink(zoneOf(id)) : ''))
        + `<div class="kv"><b>HP (N${nsel()})</b><span>${big(bossHp(b))}</span><b>Damage per hit</b><span>${big(bossHit(b))}</span><b>DPS</b><span>${big(bossDps(b))}</span>${souls(b) ? `<b>Boss Souls</b><span>${fmt(souls(b))}</span>` : ''}</div>`
        + (reach(id) ? `<div class="small">Where: ${reach(id)}</div>` : '') + ((b.drops || []).length ? `<div class="small">Drops: ${dropList(b.drops, 3)}</div>` : '') + open('boss'); }
    if (page === 'unit' && MON[id]) { const m = MON[id];
      return head(esc(m.name), 'Monster' + (zoneOf(id) && Z[zoneOf(id)] ? ' · ' + zlink(zoneOf(id)) : ''))
        + `<div class="kv"><b>Level</b><span>${fmt(m.level)}</span><b>HP (N${nsel()})</b><span>${big(monHp(m))}</span></div>` + ((m.drops || []).length ? `<div class="small">Drops: ${dropList(m.drops, 3)}</div>` : '') + open(); }
    if (page === 'hero') { const h = (W.heroes || []).find(x => x.id === id); if (!h) return '';
      const n = nsel(), md = { chall: 'chall', death: 'death' }[filters.md] || 'main', band = n <= 3 ? 'N1-3' : n <= 6 ? 'N4-6' : 'N7-9', key = md + '|' + band;
      const tiers = ((W.tier || {}).tiers || {})[key] || {}; const t = Object.keys(tiers).find(k => tiers[k].includes(id));
      const ml = { main: 'Main', chall: 'Challenge', death: 'Death' }[md];
      /* ux2 2026-09-25: quick look = tier, key item, trait, stat priority (skill names only on the page) */
      const ki = (((W.key_items || {})[id] || {})[band]) || [], kit = (h.kit_items || []).filter(i => i && i.id).map(i => item[i.id] ? ilink(i.id) : esc(i.name)).join(', ');
      const gs = ((((W.guide || {})[id] || {})[band + '|' + md]) || []).filter(x => x[1] > 0), mv = (gs.find(x => x[0] === 'Main stat') || [])[1];
      const pri = gs.filter(x => !(x[0] === 'All stats' && mv != null && x[1] <= mv * 1.05)).map(x => esc(x[0])).join(' › ');
      const tr = h.trait ? esc(h.trait) + (!/:/.test(h.trait) && kit ? ` <span class="small">from its starting</span> ${kit}` : '') : '';
      return head(icon(id) + esc(h.name), [h.main_stat, h.gate && h.gate !== 'none' ? h.gate : 'open at start'].map(esc).join(' · '))
        + (t ? `<div>Tier <b>${t}</b> <span class="small">${ml} · ${band}</span></div>` : '')
        + (ki.length ? `<div>Key item: ${ki.map(x => ilink(x[0])).join(', ')} <span class="small">boss kills ${ki[0][1]}x faster</span></div>` : '')
        + (tr ? `<div class="small"><b>Trait</b> ${tr}</div>` : '')
        + (pri ? `<div class="small"><b>Stat priority</b> ${pri}</div>` : '') + open(); }
    if (page === 'zones' && Z[id]) { const z = Z[id], bl = znBosses(z), sh = znShops(z), lv = znLv(z);
      const more = (a, k, fn) => a.slice(0, k).map(fn).join(', ') + (a.length > k ? ` +${a.length - k}` : '');
      return head(esc(z.name), [z.optional ? 'Side zone' : 'Zone ' + ZNUM[z.id], lv ? 'Lv ' + lv : ''].filter(Boolean).join(' · '))
        + (typeof pkPlace === 'function' ? '' : `<div class="mp-slot pk-map" data-zone="${esc(id)}"></div>`)   // patch_global's pkPlace adds this same map on the click path: one map only
        + (reach(id) ? `<div class="small">Get there: ${reach(id)}</div>` : '')
        + (bl.length ? `<div class="small">Bosses: ${more(bl, 4, b => ulink(b.id))}</div>` : '')
        + (sh.length ? `<div class="small">Shops: ${more(sh, 4, x => link('shop', x.id, x.name))}</div>` : '') + open(); }
    if ((page === 'shop' || page === 'npc') && shopByCode[id]) { const s = shopByCode[id], zid = zoneOf(id), sells = s.sells || [], sib = znSibs(s);
      const qs = ((W.quests || {}).side || []).filter(q => q.npc && q.npc.id === id), qo = znIsQ(s) && qs.length;
      const pr = [...new Set(sells.map(x => x.price || ''))], one = pr.length === 1 && sells.length > 1 ? pr[0] : '';
      return head(esc(s.name), [znWhere(s, '') || (Z[zid] ? zlink(zid) : ''), !qo && one ? 'Price: ' + esc(one) : ''].filter(Boolean).join(' · '))
        + (Z[zid] && typeof pkPlace !== 'function' ? `<div class="mp-slot pk-map" data-zone="${zid}" data-pt="${esc(id)}"></div>` : '')
        + (s.note ? `<div class="small zn-snote">${esc(s.note)}</div>` : '')
        + (qs.length ? `<div class="small">Quests: ${qs.map(q => esc(znQName(q))).join(', ')}</div>` : '')
        + (sells.length && !qo ? `<div class="small">Sells: ${sells.slice(0, 6).map(x => ref(x) + (!one && x.price ? ' ' + esc(x.price) : '')).join(', ')}${sells.length > 6 ? ` +${sells.length - 6}` : ''}</div>` : '')
        + (sib.length > 1 ? `<div class="small">${sib.length} stand side by side, each with its own list</div>` : '') + open(); }
    if (page === 'legacyline') { const l = LEG.lines.find(x => x.root.id === id); if (!l) return ''; const w = lgWhen(l);
      return head(esc(l.name), esc(l.slot || '') + ' · ' + fmt(l.steps.length) + ' steps' + (w[1] ? ' · ' + esc(w[1]) : ''))
        + `<div style="margin:4px 0"><b>Get ${ref(l.root)}:</b> ${lgStartH(l)}</div>` + (l.first_needs ? `<div class="small">First steps need: ${esc(l.first_needs)}</div>` : '')
        + (l.final ? `<div class="small">Ends at ${ref(l.final)}</div>` : '') + open(); }
    return '';
  };
  /* Quests tab (user 2026-09-25): a place link shows WHERE it is: name + a small map with the spot ringed + Open page */
  /* monster / boss card = facts line + small map with the spot(s) ringed (user 2026-09-25: "it should open the highlighted small map").
     Quick look (withHead): kind, zone, HP..., then how to get in (bosses: scroll / boat / ticket), the map, drops.
     A list row's in-place card skips what its row shows (HP, Lv, drops) and adds what it lacks: kind, how to get in, drops of boss rows,
     the items of a '1 of N' drop for monster rows. */
  const unitMapCard = (page, id, withHead) => {
    const b = BOSS[id], m = b ? null : MON[id]; if (!b && !m) return '';
    const key = (b ? 'boss/' : 'unit/') + encodeURIComponent(id), inRow = t => !withHead && rowSays(key, t), z = moZone(id), n = nsel();
    const ds = byChance((b || m).drops), all = ds.length > 0 && ds.every(d => inRow(dropTxt(d))), base = inRow(big(b ? bossHp(b) : monHp(m)));
    const facts = (b ? [bSub(b, withHead), base ? '' : `HP ${big(bossHp(b))} (N${n})`, base ? '' : `hits ${big(bossHit(b))} · ${big(bossDps(b))} DPS`, !base && souls(b) ? `${fmt(souls(b))} Boss Souls` : '']
      : [withHead ? 'Monster' : '', withHead && Z[z] ? zlink(z) : '', base ? '' : `Lv ${fmt(m.level)}`, base ? '' : `HP ${big(monHp(m))} (N${n})`, m.level ? `${moGold(m)} gold${base ? ` (N${n})` : ''}` : '', m.exp != null ? `${fmt(m.exp)} exp` : '']).filter(Boolean);
    const need = b ? [moNeed(id), b.summon ? ref(b.summon) : ''].filter(Boolean).join(' · ') : '';
    const pools = !b && all ? ds.filter(poolOf).map(d => `<div class="small">${dname(d)}: ${poolLine(poolOf(d), 12)}</div>`).join('') : '';
    return (withHead ? `<div class="mph"><b>${esc((b || m).name)}</b><a href="#" class="mpx" title="Close">×</a></div>` : '')
      + (facts.length ? `<div class="small">${facts.join(' · ')}</div>` : '') + (need ? `<div class="mo-need">${need}</div>` : '')
      + (moHasMap(z) ? `<div class="mp-slot pk-map mo-cmap" data-zone="${z}"${b ? ` data-boss="${esc(id)}"` : ` data-mon="${esc(id)}"`}></div>` : '')
      + (ds.length && !all ? `<div class="small">Drops: ${moDropsN(ds, b ? 5 : 3)}</div>` : pools)
      + `<div class="pk-open"><a href="#${b ? 'boss' : 'unit'}/${encodeURIComponent(id)}" class="pk-go">Open page →</a></div>`; };
  /* data-w too: map.js's own slot filler (an xhook that runs after this one) then skips the slot instead of drawing the map a second time */
  const fillMaps = root => root.querySelectorAll('.mp-slot[data-zone]:not([data-filled])').forEach(el => { const K_ = window.AP; if (!K_ || !K_.miniMap) return; el.dataset.filled = '1'; el.dataset.w = '1';
    K_.miniMap(el, el.dataset.zone, { boss: el.dataset.boss || undefined, pt: el.dataset.pt || undefined, spots: el.dataset.mon ? (W.mon_spawn || {})[el.dataset.mon] : undefined }); });
  const peekMap = (page, id) => {
    const K_ = window.AP; if (!K_ || !K_.miniMap) return '';
    const b = (page === 'unit' || page === 'boss') && BOSS[id];
    const z = page === 'zones' ? id : (K_.ptZone && K_.ptZone(id)) || zoneOf(id); if (!z || !Z[z]) return '';
    const nm = page === 'zones' ? Z[z].name : b ? b.name : page === 'unit' && MON[id] ? MON[id].name : shopByCode[id] ? shopByCode[id].name : '';
    if (!nm) return '';
    const pg = page === 'unit' && b ? 'boss' : page;
    return `<div class="mph"><b>${esc(nm)}</b><a href="#" class="mpx" title="Close">×</a></div>${page !== 'zones' ? `<div class="small">${zlink(z)}</div>` : ''}`
      + `<div class="mp-slot pk-map" data-zone="${z}"${b ? ` data-boss="${esc(id)}"` : page === 'shop' || page === 'npc' ? ` data-pt="${esc(id)}"` : ''}></div>`
      + (page === 'zones' && reach(z) ? `<div class="small">Get there: ${reach(z)}</div>` : '')
      + `<div class="pk-open"><a href="#${pg}/${encodeURIComponent(id)}" class="pk-go">Open page →</a></div>`;
  };
  let peekEl = null, peekStack = [];
  const peekClose = () => { if (peekEl) peekEl.hidden = true; peekStack = []; };
  const peekSet = html => { peekEl.innerHTML = html.replace('<div class="mph">', '<div class="mph">' + (peekStack.length ? '<a href="#" class="pk-back" title="Back">‹</a>' : ''));
    peekEl.querySelectorAll('.mp-slot[data-zone]').forEach(el => { delete el.dataset.filled; }); fillMaps(peekEl);
    peekEl.classList.remove('pk-in'); void peekEl.offsetWidth; peekEl.classList.add('pk-in'); };
  const peekShow = (html, anchor) => {
    if (!peekEl) { peekEl = document.createElement('div'); peekEl.className = 'peek'; document.body.appendChild(peekEl);
      peekEl.addEventListener('click', e => { if (e.target.closest('.mpx')) { e.preventDefault(); peekClose(); }
        else if (e.target.closest('.pk-back')) { e.preventDefault(); const prev = peekStack.pop(); if (prev) peekSet(prev); }
        else if (e.target.closest('.pk-go')) peekClose(); }); }
    const inside = anchor.closest('.peek');                   // a link inside the card: swap the content in place, keep the spot
    const r = inside ? null : anchor.getBoundingClientRect(); // measure BEFORE the content changes
    if (inside && !peekEl.hidden) { peekStack.push(peekEl.innerHTML.replace(/<a href="#" class="pk-back"[^>]*>‹<\/a>/, '')); peekSet(html); return; }
    peekStack = []; peekSet(html); peekEl.hidden = false;
    if (window.innerWidth < 700) { peekEl.classList.add('sheet'); peekEl.style.left = peekEl.style.top = ''; return; }
    peekEl.classList.remove('sheet'); const wd = 340;
    peekEl.style.left = Math.max(8, Math.min(window.innerWidth - wd - 8, r.left)) + 'px';
    const below = r.bottom + 8, hh = peekEl.offsetHeight;
    peekEl.style.top = (window.scrollY + (below + hh < window.innerHeight ? below : Math.max(8, r.top - hh - 8))) + 'px';
  };
  /* zone / shop quick-look (every tab but Quests, which has its own map card): the card plus a small map right under its title
     (zone outlined, the NPC ringed), so it answers 'where is it' like the monster and boss cards */
  const pkPlace = (page, id) => { if (!['zones', 'shop', 'npc'].includes(page)) return '';
    const K_ = window.AP, base = peekCard(page, id), z = page === 'zones' ? id : (K_ && K_.ptZone && K_.ptZone(id)) || zoneOf(id);
    if (!base || !K_ || !K_.miniMap || !Z[z] || !((W.map || {}).zones || []).some(x => x.id === z)) return base;
    const map = `<div class="mp-slot pk-map" data-zone="${esc(z)}"${page === 'zones' ? '' : ` data-pt="${esc(id)}"`}></div>`;
    let i = base.indexOf('</div>', base.indexOf('class="mph"')) + 6; if (base.startsWith('<div class="small">', i)) i = base.indexOf('</div>', i) + 6;
    return base.slice(0, i) + map + base.slice(i); };
  const TAB_OF = { item: 'items', unit: 'monsters', boss: 'monsters', hero: 'heroes', zones: 'zones', shop: 'zones', npc: 'zones', legacyline: 'legacy' };
  document.addEventListener('click', e => {
    if (e.defaultPrevented) return;
    const a = e.target.closest('a[href^="#"]');
    if (peekEl && !peekEl.hidden && !e.target.closest('.peek') && !a) peekClose();
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    if (a.closest('nav.tabs') || a.closest('.sub-tabs') || a.classList.contains('pk-go') || a.classList.contains('mpx') || a.classList.contains('pk-back') || a.closest('.mapbtn') || a.dataset.expand || a.dataset.layer) return;
    if (a.closest('.sr-grid')) { $('#q').value = ''; $('#qcount').textContent = ''; if (a.getAttribute('href') === location.hash) { e.preventDefault(); route(); } return; }   // search hits: always the page
    const [page, idRaw] = a.getAttribute('href').slice(1).split('/'); if (!PEEK.has(page) || !idRaw) return;
    const own = !a.closest('.peek') && a.closest('.xr');                               // a name inside its own list row: that row opens in place, on every tab
    if (own && out.contains(own) && own.dataset.x === page + '/' + idRaw) { e.preventDefault(); xOpen(own); return; }
    if (!a.closest('.peek') && TAB_OF[page] === document.body.dataset.page) return;   // the tab's own things elsewhere on its pages: open the page
    const id_ = decodeURIComponent(idRaw), html = ((page === 'unit' || page === 'boss') && unitMapCard(page, id_, true)) || (document.body.dataset.page === 'quests' && peekMap(page, id_)) || pkPlace(page, id_) || peekCard(page, id_); if (!html) return;
    e.preventDefault(); peekShow(html, a);
  });
  /* ---------- inline detail: any element with class "xr" and data-x="page/id" opens a short card right under it (the list stays put,
     nothing scrolls; 'Open page' still goes to the full page). A tab can register a richer card: K.detail[page] = id => html.
     K.xhooks: (page, id, detailEl) => {} runs after a card opens (e.g. to draw a mini map). One open card per list. ---------- */
  const detail = {}, xhooks = [];
  const xOpen = row => {
    const box = row.parentElement, was = row.classList.contains('open');
    box.querySelectorAll(':scope > .xd').forEach(x => x.remove()); box.querySelectorAll(':scope > .xr.open').forEach(x => x.classList.remove('open'));
    if (was) return;
    const [pg, idRaw] = row.dataset.x.split('/'); const id = decodeURIComponent(idRaw || '');
    const html = detail[pg] ? detail[pg](id) : peekCard(pg, id).replace(/<a href="#" class="mpx"[^>]*>×<\/a>/, ''); if (!html) return;
    row.classList.add('open');
    if (row.tagName === 'TR') row.insertAdjacentHTML('afterend', `<tr class="xd"><td colspan="${row.cells.length}"><div class="xdc">${html}</div></td></tr>`);
    else row.insertAdjacentHTML('afterend', `<div class="xd"><div class="xdc">${html}</div></div>`);
    const d = row.nextElementSibling; d.classList.add('pk-in'); for (const h of xhooks) h(pg, id, d);
    const r = d.getBoundingClientRect(), over = r.bottom - window.innerHeight + 12;
    if (over > 0 && r.height) window.scrollBy({ top: Math.min(over, Math.max(0, row.getBoundingClientRect().top - 8)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  out.addEventListener('click', e => { const row = e.target.closest('.xr'); if (!row || !out.contains(row) || e.target.closest('a,button,input,select,summary,label,.xd')) return; xOpen(row); });
  /* in-tab search: <input class="tsearch"> hides every [data-s] element in #out that does not contain the text (data-s = lower-case text);
     table group headers (tr.grp) and boxes with class "sgroup" hide when nothing under them is left */
  out.addEventListener('input', e => { const inp = e.target.closest('input.tsearch'); if (!inp) return; const q = inp.value.trim().toLowerCase();
    out.querySelectorAll('.xd').forEach(x => x.remove()); out.querySelectorAll('.xr.open').forEach(x => x.classList.remove('open'));
    out.querySelectorAll('[data-s]').forEach(el => { el.hidden = !!q && !el.dataset.s.includes(q); });
    out.querySelectorAll('table').forEach(t => { let g = null, any = false; const fin = () => { if (g) g.hidden = !any; };
      for (const r of t.rows) { if (r.classList.contains('grp')) { fin(); g = r; any = false; } else if (r.dataset.s !== undefined && !r.hidden) any = true; } fin(); });
    out.querySelectorAll('.sgroup').forEach(s => { s.hidden = !!q && !s.querySelector('[data-s]:not([hidden])'); });
    const c = out.querySelector('.tsearch-n'); if (c) c.textContent = q ? out.querySelectorAll('[data-s]:not([hidden])').length + ' found' : ''; });
  queueMicrotask(() => { detail.unit = id => unitMapCard('unit', id, false); detail.boss = id => unitMapCard('boss', id, false); xhooks.push((pg, id, el) => fillMaps(el)); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') peekClose(); });
  window.addEventListener('hashchange', peekClose);
  function start() {
    window.addEventListener('hashchange', () => { $('#q').value = ''; $('#qcount').textContent = ''; route(); });
    $('#q').addEventListener('input', e => { const v = e.target.value; if (v.trim().length >= 2) renderSearch(v); else { $('#qcount').textContent = ''; route(); } });
    $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { const a = out.querySelector('.hit a'); if (a) { const h = a.getAttribute('href'); $('#q').value = ''; $('#qcount').textContent = ''; if (h === location.hash) route(); else location.hash = h; } } });
    route();
  }
  return { znum: ZNUM, W, P, INDEX, KL, hooks, filters, route, start, subtabs, detail, xhooks, xOpen, peekCard, fmt, big, esc, clean, link, ilink, ulink, iname, icon, rich, tok, stats, ref, zlink, item, unitByCode, bossByCode, shopByCode, $ };
})();
