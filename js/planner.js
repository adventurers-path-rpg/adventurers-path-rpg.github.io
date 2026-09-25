/* Run planner (user spec 2026-09-25): your Legacy (save file or by hand) -> goal Legacy upgrades or Points farm -> the run to play.
   Data W.plan (scripts/planner_data.py): edges = every Legacy upgrade from the code (boss, exact N, mode, which heroes), beat = per requirement
   the Legacy level a hero needs to kill that boss, clear = per N x mode the Legacy level a hero needs to finish the run, lv_ref = the Legacy
   items of each level (1-3 = what a normal player holds after Main N1-3 / N4-6 / N7-9, 4-5 = the same lines half / 80% deep).
   Legacy upgrades: several per slot type per run, swapped through the Legacy Bag between fights (ON THE WAY, patch_on_the_way). */
(function (K) {
  const { W, P, INDEX, esc, fmt, subtabs, ilink } = K;
  const PD = W.plan; if (!PD) return;
  const HIDX = {}; PD.heroes.forEach((h, i) => HIDX[h] = i);
  const HERO = {}; (W.heroes || []).forEach(h => HERO[h.id] = h);
  const LINES = (W.legacy || {}).lines || [];
  const POS = {};                                   /* Legacy item id -> {line, idx, slot} */
  LINES.forEach(l => (l.steps || []).forEach((s, i) => POS[s.id] = { line: l.name, idx: i, slot: l.slot }));
  const MN = { m: 'Main', c: 'Challenge', d: 'Death' }, MK = { m: 'main', c: 'chall', d: 'death' }, MCALC = { m: 'main', c: 'challenge', d: 'death' };
  const band = n => n <= 3 ? 'N1-3' : n <= 6 ? 'N4-6' : 'N7-9';
  const bname = id => ((W.boss || {})[id] || {}).name || (PD.bnm || {})[id] || (((W.mon || {})[id]) || {}).name || id;   // AUDIT FIXES (patch_auditfix M2): calculator-only units + creeps
  const iname = id => { const it = K.item[id]; return it ? (it.dn || it.name) : id; };
  const LS = 'ap_plan';
  let S = { own: {}, goal: '', pts: 0, ml: 1, rank: 0, wp: 0, vip: 0, src: '' };
  try { const x = JSON.parse(localStorage.getItem(LS) || 'null'); if (x && x.own) S = Object.assign(S, x); } catch (e) {}
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };
  /* save file (checks/save_format_102.json): a Preload script, lines call BlzSetAbilityTooltip(<n>, "-<190-char chunk>", 0); strip the '-' and
     join the chunks in file order -> "DMO25;" + key#value; pairs (escapes %25 %23 %3B %5C %22). A big save = main file "DMO25M|pages|len|hash"
     + _P0.._Pn.pld pages. IBC1..18 = Legacy Bag (1-6) + Legacy Storage 1-2 (7-18) as int32 item rawcodes (enhance level is not saved),
     IJF = Points, ThisPlayerLevelCheck = Map Level - 1 + EXP fraction. */
  const joinChunks = txt => { const out = [], re = /BlzSetAbilityTooltip\(\s*-?\d+\s*,\s*"((?:[^"\\]|\\.)*)"/g; let m;
    while ((m = re.exec(txt))) { let c = m[1].replace(/\\(.)/g, '$1'); if (c.startsWith('-')) c = c.slice(1); out.push(c); }
    return out.length ? out.join('') : String(txt); };
  function readSave(files) {                        /* files: [{name, text}] (main file and, for big saves, its _P pages) */
    let body = '';
    const pages = files.filter(f => /_P\d+\.pld$/i.test(f.name)).sort((a, b) => +a.name.match(/_P(\d+)\.pld$/i)[1] - +b.name.match(/_P(\d+)\.pld$/i)[1]);
    const main = files.find(f => !/_P\d+\.pld$/i.test(f.name)) || files[0];
    const mt = joinChunks(main.text);
    body = /^DMO25M\|/.test(mt) && pages.length ? pages.map(p => joinChunks(p.text)).join('') : mt;
    const un = v => v.replace(/%3B/gi, ';').replace(/%23/g, '#').replace(/%22/g, '"').replace(/%5C/gi, '\\').replace(/%25/g, '%');
    const get = k => { const m = body.match(new RegExp('(?:^|;)' + k + '#([^;]*)')); return m ? un(m[1]) : null; };
    const own = {};
    for (let i = 1; i <= 18; i++) {
      const v = parseInt(get('IBC' + i) || '0', 10) >>> 0; if (!v) continue;
      const id = String.fromCharCode(v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255), p = POS[id];
      if (p && (!own[p.line] || POS[own[p.line]].idx < p.idx)) own[p.line] = id;
    }
    const mlv = get('ThisPlayerLevelCheck');
    /* VIP: the Points Merchant's VIP buys are saved as WANJIAVIP1/2/3/9 = '1' (no type prefix); level as trigger W1 Vip */
    const vb = k => get('WANJIAVIP' + k) === '1', v1 = vb(1), v2 = vb(2), v3 = vb(3), v9 = vb(9);
    const vip = v1 && v2 && v3 && v9 ? 10 : v1 && v2 && v3 ? 4 : v3 ? 3 : v2 ? 2 : v1 ? 1 : 0;
    return { own, vip, tok: get('Itzlp') == null ? null : parseInt(get('Itzlp'), 10) || 0, pts: parseInt(get('IJF') || '0', 10) || 0, ml: mlv ? 1 + Math.floor(parseFloat(mlv) || 0) : 1, rank: parseInt(get('IJW') || '0', 10) || 0, wp: parseInt(get('ISHIJIE') || '0', 10) || 0, n: Object.keys(own).length,
             valid: /^DMO25/.test(body), saved: get('IJF') !== null || mlv !== null };
  }
  /* the Legacy level a hero of main stat p plays at: the deepest level whose items you match (same line, as deep or deeper) on at least half */
  const lvlOf = p => { let lv = 0;
    PD.lv_ref.forEach((ref, k) => { const ids = ref[p] || []; if (!ids.length) return;
      const ok = ids.filter(id => { const r = POS[id], o = r && S.own[r.line]; return o && POS[o].idx >= r.idx; }).length;
      if (ok * 2 >= ids.length) lv = k + 1; });
    return lv; };
  const LVN = ['no Legacy', 'Legacy of Main N1-3', 'Legacy of Main N4-6', 'Legacy of Main N7-9', 'deep Legacy', 'very deep Legacy', 'maxed Legacy'];
  const TITLES = [[0, 'No title']].concat(((W.calc || {}).titles || []).map(t => [t.tier, t.name]));
  /* power step (planner_data PL = [Map Level, title rank, Legacy level] along a normal account's progress): the highest step you meet in all three */
  const okAt = (s, lv) => s !== undefined && s !== 'x' && +s <= lv;   // 'x' = never (planner_data): must never pass
  const stepOf = p => { const lg = lvlOf(p); let st = 0; (PD.pl || []).forEach(([ml, rk, lv], k) => { if ((S.ml || 1) >= ml && (S.rank || 0) >= rk && lg >= lv) st = k; }); return st; };
  /* exact account (2026-09-25): stepOf needs Map Level, title AND Legacy to reach a step (Map Level 44 = 35). eqStep weighs the account per
     hero x band x mode with that hero's stat weights (PD.sw = tier_calc probe gains in % fight value, PD.probes = [name, {stat: amount}],
     PD.probe_ref = the account the gains were measured on):
     power = sum of gain x probe units (survival parts capped), for your account + Legacy and for every ladder step (PD.pl account +
     PD.lv_ref items); s = k + fraction between the two steps around you (the ladder is made non-decreasing). Replays use k = floor(s). */
  const MILES = [[10, { stat_amp_pct: 30 }], [25, { armor_amp_pct: 30 }], [40, { hp_amp_pct: 30 }], [55, { crit_damage_pct: 200 }], [70, { skill_amp_pct: 30 }],
    [80, { spell_lifesteal_pct: 5 }], [100, { attack_amp_pct: 30 }], [130, { skill_amp_pct: 20, attack_amp_pct: 20, hp_amp_pct: 20 }],
    [140, { crit_chance_pct: 5, dr_pct: 5 }], [150, { skill_amp_pct: 50, attack_amp_pct: 50, hp_amp_pct: 50 }], [160, { spell_lifesteal_pct: 10 }],
    [170, { stat_amp_pct: 200 }], [180, { skill_amp_pct: 200 }]];
  const RANKR = [[30, 100, 0], [40, 100, 5], [50, 100, 10], [60, 150, 10], [65, 150, 15], [70, 200, 15], [75, 200, 20], [80, 300, 20], [85, 300, 30],
    [90, 400, 30], [95, 400, 40], [100, 450, 40], [103, 450, 45], [106, 500, 45], [110, 500, 50], [120, 600, 60]];
  /* planner_data.account: Map Level milestones, +1% Str/Agi/Int amp per Map Level, Player Bonus gift by Map Level, Ranking Reward bracket,
     title +60 All stats per rank and rank 9 +15% amp; lv_log = title EXP -> hero level (tier_calc lv_mult, probe 'Hero level') */
  const PTSH = [[800000, { stat_amp_pct: 40, attack_amp_pct: 40, hp_amp_pct: 40, skill_amp_pct: 40, cdr_pct: 5, spell_lifesteal_pct: 5, dr_pct: 5, crit_chance_pct: 5 }],
    [500000, { stat_amp_pct: 40, attack_amp_pct: 40, hp_amp_pct: 40, skill_amp_pct: 40, cdr_pct: 5, spell_lifesteal_pct: 5 }],
    [200000, { stat_amp_pct: 40, attack_amp_pct: 40, hp_amp_pct: 40, skill_amp_pct: 40 }], [80000, { stat_amp_pct: 30, attack_amp_pct: 30, hp_amp_pct: 30, skill_amp_pct: 30 }],
    [20000, { stat_amp_pct: 20, attack_amp_pct: 20, hp_amp_pct: 20, skill_amp_pct: 20 }]];   // Points held at the Ranking Reward claim (tier_calc PTS_HELD)
  const account = (ml, rank, pts) => { const a = { stat_amp_pct: ml, flat_all_stats: 60 * rank, lv_log: 0.5 * Math.log(1 + 0.25 * rank) };
    const ph = PTSH.find(x => (pts || 0) >= x[0]); if (ph) for (const k in ph[1]) a[k] = (a[k] || 0) + ph[1][k];
    MILES.forEach(([lv, d]) => { if (ml >= lv) for (const k in d) a[k] = (a[k] || 0) + d[k]; });
    if (ml <= 15) a.flat_all_stats += 40; else if (ml <= 30) a.stat_amp_pct += 20; else if (ml <= 45) { a.flat_all_stats += 250; a.stat_amp_pct += 25; } else { a.flat_all_stats += 500; a.stat_amp_pct += 50; }
    const rk = RANKR.filter(r => ml >= r[0]).pop(); if (rk) { a.flat_all_stats += rk[1]; a.stat_amp_pct += rk[2]; }
    if (rank >= 9) a.stat_amp_pct += 15;
    return a; };
  /* VIP (patch_planner_vip 2026-09-25; findings/public/audit_math/vip_system.md): the Points Merchant's VIP item buys the next step (15k ->
     VIP 1, 30k -> VIP 2, 45k -> VIP 4, 800k -> VIP 10), saved as flags and used from the next game. VIP L: +L Str/Agi/Int per hero level-up, kill / quest gold and Boss Souls x(0.8 + 0.2 N + 0.5 L) instead of x(0.8 + 0.2 N), Points x(1 + 0.3 L)
     rounded down on the stage boss, Jarvan V, Shadow Monster, Archangel / Frost Lord; stone chances
     +5 L points. The replays (PD.rp) are VIP 0 players: VIP moves only your account step (stats) and the Points / Boss Souls numbers.
     Hero level for the stats = tier_calc hero_lv late (SIM_LV x SIM_MX for Challenge / Death) x title EXP (sqrt(1 + 0.25 rank)) */
  const vipLv = () => { const v = +S.vip || 0; return [0, 1, 2, 3, 4, 10].includes(v) ? v : 0; };
  const VIPSTEP = [[0, 1, 15000], [1, 2, 30000], [2, 4, 45000], [4, 10, 800000]];
  const VIPLV = { 'N1-3': 100, 'N4-6': 114, 'N7-9': 123 };
  const vipX = gk => { const V = vipLv(); if (!V) return {}; const [b, md] = String(gk).split('|');
    const lv = Math.min(500, (VIPLV[b] || 100) * (md === 'main' ? 1 : 202 / 114)) * Math.sqrt(1 + 0.25 * (+S.rank || 0));
    return { flat_all_stats: V * Math.max(0, lv - 1) }; };
  const vipPts = p => Math.floor(p * (1 + 0.3 * vipLv()) + 1e-6);
  const MMUL = { m: 1, c: 2, d: 3 };
  /* stage boss / Archangel from the VIP 0 table (W.calc.points): the unrounded value when the formula matches the table, else the table's */
  const vipPay = (n, m, p0) => { if (!vipLv()) return p0; const r = n * n * MMUL[m] * (n <= 4 ? 1 : 1 + 0.1 * (n - 4)); return vipPts(Math.floor(r + 1e-6) === p0 ? r : p0); };
  const vipArch = (n, m, a0) => { if (!vipLv() || !a0) return a0; const r = n * n * 0.15 * MMUL[m] + 10; return vipPts(Math.floor(r + 1e-6) === a0 ? r : a0); };
  const gsF = n => 1 + 0.5 * vipLv() / (0.8 + 0.2 * n);   // gold / Boss Souls: (0.8 + 0.2 N + 0.5 L) / (0.8 + 0.2 N)
  /* a Legacy step's stats as calculator keys (tier_calc.item_extra; stats from W.legacy steps). Off-stat Str / Agi / Int and their amps have no probe */
  const MAPX = { all_stats: 'flat_all_stats', stat_amp: 'stat_amp_pct', skill_amp: 'skill_amp_pct', crit_chance: 'crit_chance_pct', crit_damage: 'crit_damage_pct',
    cdr: 'cdr_pct', dr: 'dr_pct', hp: 'hp_bonus', hp_amp: 'hp_amp_pct', armor: 'armor_bonus', armor_amp: 'armor_amp_pct', ad: 'attack_damage_bonus',
    attack_amp: 'attack_amp_pct', lifesteal: 'lifesteal_pct', spell_lifesteal: 'spell_lifesteal_pct', attack_speed: 'attack_speed_pct', magic_resist: 'magic_resist', evasion: 'evasion' };
  const LST = {}; LINES.forEach(l => (l.steps || []).forEach(x => { LST[x.id] = x.st || {}; }));
  const IXC = {};
  const itemX = (id, p) => { const key = p + id; if (IXC[key]) return IXC[key]; const o = {}, q = p.toLowerCase();
    for (const [k, v] of Object.entries(LST[id] || {})) { if (typeof v !== 'number') continue;
      const t = MAPX[k] || (k === q ? 'flat_main_stat' : k === q + '_amp' ? 'main_amp_pct' : ''); if (t) o[t] = (o[t] || 0) + v; }
    return (IXC[key] = o); };
  const PRB = (PD.probes || []).map(x => Object.entries(x[1] || {})), NP = PRB.length, SWC = {};
  /* PD.sw[hero] = base-36 string, per band|mode (PD.swk order) 2 x probes + 1 numbers of 2 chars: value = e^(code / PD.swq) - 1 (planner_pack) */
  const swRow = (h, gk) => { const key = h + '|' + gk; if (key in SWC) return SWC[key];
    const s = (PD.sw || {})[h], j = (PD.swk || []).indexOf(gk), R = 2 * NP + 1, q = +PD.swq || 0; let o = null;
    if (typeof s === 'string' && j >= 0 && q > 0 && NP && s.length >= (j + 1) * 2 * R) { o = [];
      for (let i = 0; i < R; i++) { const c = s.substr((j * R + i) * 2, 2); o.push(Math.expm1((B36.indexOf(c[0]) * 36 + B36.indexOf(c[1])) / q)); } }
    return (SWC[key] = o); };
  /* per probe: (amount - the amount the gains were measured on, PD.probe_ref) / probe amount */
  const units = (v, ref) => PRB.map(d => d.length ? d.reduce((t, [k, a]) => t + (a ? ((v[k] || 0) - ((ref || {})[k] || 0)) / a : 0), 0) / d.length : 0);
  /* PD.sw row = [gain per probe, survival part per probe, survival cap]: offense parts add up, survival parts only up to the cap
     (a hero that already outlasts the boss gains nothing more from HP, armor, lifesteal...) */
  const powOf = (v, w, ref) => { const hasU = w.length > 2 * NP; let o = 0, u = 0;
    units(v, ref).forEach((x, j) => { const g = Math.max(0, +w[j] || 0), su = hasU ? Math.min(g, Math.max(0, +w[NP + j] || 0)) : 0; o += (g - su) * x; u += su * x; });
    return o + (hasU ? Math.min(u, Math.max(0, +w[2 * NP] || 0)) : u); };
  const addTo = (v, x) => { for (const t in x) v[t] = (v[t] || 0) + x[t]; return v; };
  /* LEGACY BAG (patch_legacy_bag 2026-09-25; findings/public/audit_math/legacy_bag_rules.md, extract_102/war3map.j L = line): the Bag (F2,
     H00Q) holds 6 Legacy items, one per slot type. Only Bag items
     give stats, to the hero; the two
     Storages (F3 / F4) give nothing. Items move any time for free through slot 1. Boss,
     Survival, Elf Sister, Death Enhancer and kill-chance upgrades check the Bag; 'Put it in one bag with' combines and +20 stones happen on the hero or pet.
     pickBag = the forced items first, then the best item of each free slot type by the hero's stat weights (the ownVec value), 6 at most */
  const BVC = new Map();
  const bagVal = (h, gk, id) => { const k = h + '|' + gk + '|' + id; if (BVC.has(k)) return BVC.get(k);
    const p = (HERO[h] || {}).main_stat || 'STR', w = swRow(h, gk), v = w && NP ? powOf(itemX(id, p), w.slice(0, NP), null) : 0; BVC.set(k, v); return v; };
  const pickBag = (h, gk, own, forced) => { const bag = [], ty = new Set(), best = {};
    (forced || []).forEach(id => { const r = POS[id]; if (!r || ty.has(r.slot) || bag.length >= 6) return; bag.push(id); ty.add(r.slot); });
    Object.values(own).forEach(id => { const r = POS[id]; if (!r || ty.has(r.slot)) return; const v = bagVal(h, gk, id); if (!best[r.slot] || best[r.slot][0] < v) best[r.slot] = [v, id]; });
    Object.values(best).sort((a, b) => b[0] - a[0]).forEach(x => { if (bag.length < 6) bag.push(x[1]); });
    return bag; };
  /* one Legacy run's Bag: kill-chance upgrades (nbx 'k') ride in the Bag all run; every other Bag upgrade in step order: its item outside the
     best 6 of that moment = a swap before the fight (sw[from>to] = {x, y: the item it pushes out, back: y returns after, weak, kind}); nbx
     'b' / 'e' = done on the hero or pet (hand); an upgrade's new item counts from the next fight on. e = the weakest Bag's eqStep */
  const bagPlan = (h, n, m, all) => { const gk = band(n) + '|' + MK[m], kd = g => g.u.nb ? g.u.nb[0] : 'B';
    const kIds = all.filter(g => kd(g) === 'k').map(g => g.u.from), D0 = pickBag(h, gk, S.own, kIds);
    const out = { start: D0, k: kIds, sw: {}, e: null }, es = [kIds.length ? eqStep(h, n, m, D0) : eqStep(h, n, m)];
    let own = Object.assign({}, S.own);
    all.filter(g => kd(g) !== 'k').map(g => [g, Math.max(0, ...g.at)]).sort((a, b) => a[1] - b[1]).forEach(([g]) => {
      const x = g.u.from, k = kd(g), key = x + '>' + g.u.to, D = pickBag(h, gk, own, kIds), own2 = Object.assign({}, own);
      const tl = (POS[g.u.to] || {}).line; if (tl) { if (tl !== g.u.line) delete own2[g.u.line]; own2[tl] = g.u.to; }
      if (k === 'b' || k === 'e') out.sw[key] = { hand: k, x, toBag: pickBag(h, gk, own2, kIds).includes(g.u.to) };
      else { const F = D.includes(x) ? D : pickBag(h, gk, own, kIds.concat([x])), ef = eqStep(h, n, m, F); es.push(ef);
        if (F !== D) { const y = D.find(id => !F.includes(id)) || '', ed = eqStep(h, n, m, D);
          out.sw[key] = { x, y, kind: k, back: !!y && pickBag(h, gk, own2, kIds).includes(y), weak: ef.s < ed.s - 1e-9 }; } }
      own = own2; });
    out.e = es.reduce((a, b) => (b.s < a.s ? b : a));
    return out; };
  /* hero pages: your save's strongest 6 for this hero (band|mode of its build guide), the rest = storage; null without a Legacy */
  const best6 = (h, gk) => { if (!Object.keys(S.own).length || !HERO[h]) return null; const bag = pickBag(h, gk, S.own, []);
    return { bag, rest: Object.values(S.own).filter(id => POS[id] && !bag.includes(id)) }; };
  const ownVec = (p, w, bag) => { if (bag) return bag.reduce((v, id) => addTo(v, itemX(id, p)), account(+S.ml || 1, +S.rank || 0, +S.pts || 0));   // LEGACY BAG: this exact Bag
    const best = {};                                                // your Legacy: the best item of each slot type, 6 at most (the Legacy Bag)
    Object.values(S.own).forEach(id => { const r = POS[id]; if (!r) return; const x = itemX(id, p), v = powOf(x, w.slice(0, NP), null);
      if (!best[r.slot] || best[r.slot][0] < v) best[r.slot] = [v, x]; });
    return Object.values(best).sort((a, b) => b[0] - a[0]).slice(0, 6).reduce((v, b) => addTo(v, b[1]), account(+S.ml || 1, +S.rank || 0, +S.pts || 0)); };
  const STV = {};
  const stepVec = (p, k) => { const key = p + k; if (STV[key]) return STV[key]; const [ml, rk, lv] = PD.pl[k], v = account(ml, rk);
    (lv ? ((PD.lv_ref || [])[lv - 1] || {})[p] || [] : []).forEach(id => addTo(v, itemX(id, p)));
    return (STV[key] = v); };
  let EQS = '', EQC = {}; const EQM = new Map();   // VIP: a few account states cached (the next-buy tip tries 2-3)
  const LADC = {};                                                   // LEGACY BAG: the ladder never depends on your account
  const eqStep = (h, n, m, bag) => {                                     // {s: exact step, k: floor(s) for replays, f: fraction}
    const sig = (+S.ml || 1) + '|' + (+S.rank || 0) + '|' + (+S.pts || 0) + '|' + vipLv() + '|' + JSON.stringify(S.own);
    if (sig !== EQS) { EQS = sig; EQC = EQM.get(sig) || {}; EQM.delete(sig); EQM.set(sig, EQC); if (EQM.size > 8) EQM.delete(EQM.keys().next().value); for (const x in FCUT) if (x.endsWith('y')) delete FCUT[x]; }
    const gk = band(n) + '|' + MK[m], key = h + '|' + gk + (bag ? '|' + bag.slice().sort().join(',') : ''); if (EQC[key]) return EQC[key];
    const p = (HERO[h] || {}).main_stat || 'STR', w = swRow(h, gk), pl = PD.pl || [];
    let r;
    if (!w || !PRB.length || !pl.length) { const k = stepOf(p); r = { s: k, k, f: 0 }; }   // data without stat weights: the old ladder rule
    else {
      const ref = (PD.probe_ref || {})[gk] || {}, you = powOf(addTo(ownVec(p, w, bag), vipX(gk)), w, ref);   // VIP: + L Str/Agi/Int per hero level
      const ps = LADC[h + '|' + gk] || (LADC[h + '|' + gk] = (() => { let top = -Infinity; return pl.map((x, k) => (top = Math.max(top, powOf(stepVec(p, k), w, ref)))); })());
      let k = 0; ps.forEach((v, j) => { if (you >= v) k = j; });
      const f = k < ps.length - 1 && you > ps[k] ? Math.min(0.999, (you - ps[k]) / Math.max(1e-9, ps[k + 1] - ps[k])) : 0;
      r = { s: k + f, k, f };
    }
    return (EQC[key] = r); };
  const pStep = p => { const ss = [];                                 // one main stat: the median hero over the three bands x three modes
    PD.heroes.forEach(h => { if (((HERO[h] || {}).main_stat || 'STR') !== p) return; for (let n = 2; n <= 8; n += 3) ['m', 'c', 'd'].forEach(m => ss.push(eqStep(h, n, m))); });
    if (!ss.length) { const k = stepOf(p); return { s: k, k, f: 0 }; }
    ss.sort((a, b) => a.s - b.s); return ss[ss.length >> 1]; };
  const mlOf = sv => { const pl = PD.pl || [], k = Math.min(Math.floor(sv), pl.length - 1), a = (pl[k] || [1])[0], b = (pl[k + 1] || pl[k] || [1])[0];
    if (sv <= 0 && (+S.ml || 1) < a) return +S.ml || 1;               // AUDIT minor 7: below the ladder's first step (Map Level 5): your real Map Level
    return Math.round(a + (sv - k) * (b - a)); };
  const topStep = e => e.k >= (PD.pl || []).length - 1;
  const stepTxt = (p, h, n, m) => { const e = h ? eqStep(h, n || 5, m || 'm') : pStep(p); return topStep(e) ? 'a maxed account' : `about a Map Level ${mlOf(e.s)} account`; };
  const accTxt = () => ['STR', 'AGI', 'INT'].map((p, j) => { const e = pStep(p), x = topStep(e) ? '190+' : '~' + mlOf(e.s); return j ? `${x} for ${p}` : `Map Level ${x} account for ${p} heroes`; }).join(', ');
  const bitCache = {};
  const hasBit = (mask, i) => { let b = bitCache[mask]; if (b === undefined) b = bitCache[mask] = BigInt('0x' + (mask || '0')); return ((b >> BigInt(i)) & 1n) === 1n; };
  const score = (h, n, m) => { const L = ((W.tier || {}).lists || {})[MK[m] + '|' + band(n)] || []; const r = L.find(x => x[0] === h); return r ? r[1] : 0; };
  const tierOf = (h, n, m) => { const T = ((W.tier || {}).tiers || {})[MK[m] + '|' + band(n)] || {}; return ['S', 'A', 'B', 'C'].find(t => (T[t] || []).includes(h)) || ''; };
  /* can your account pick this hero? (gates are checked at game start, nothing is spent) */
  const unlocked = h => { const g = String((HERO[h] || {}).gate || ''); if (!g || g === 'none' || /solo lobby/i.test(g)) return true;
    let m = /map level (\d+)\+? or (\d+) and below/i.exec(g); if (m) return (S.ml || 1) >= +m[1] || (S.ml || 1) <= +m[2];
    m = /([\d,]+) World Points/i.exec(g); if (m) return (S.wp || 0) >= +m[1].replace(/,/g, '');
    m = /map level (\d+)/i.exec(g); if (m) return (S.ml || 1) >= +m[1];
    return true; };
  const heroLink = h => `<a href="#hero/${encodeURIComponent(h)}">${K.icon(h)}${esc((HERO[h] || {}).name || h)}</a>`;
  /* replay grid (PD.rp, findings/public/sim/sim_grid.py): per N|mode, hero, account step: jl = lightest gear level that finishes ('x' none),
     reach = last quest step done per gear level, minutes per level (normal player: reading, walking, creeps, farming, bosses) */
  const LVL = PD.lvl || [0.15, 0.35, 0.65, 1.0, 1.5], B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  /* CARDS UI (patch_cards_ui 2026-09-25): lab data, used only when present. PD.fc['N|m'][hero index, or hero id][account step] = share of
     replays that finish the whole run (0-1, or one share per gear level); PD.pace (same shape: true / 1 / 'y' / share >= 0.5 = safe for new
     players); PD.rpf / PD.bbf = replays / builds of a player who farms rare drops (same shape as PD.rp / PD.bb, keys they lack fall back).
     Gear levels = PD.lvl (5 today: very light.. heavy) */
  const NL = (PD.lvl || []).length || 5, FCON = !!PD.fc;
  if (S.gl == null) S.gl = S.safer ? 1 : 0;                           // the old 'Safer run' box = gear level 'A bit more'
  /* ---- GEAR LEVEL IN THE CARD (patch_page_gearlevel 2026-09-25, user-approved): the list ranks each run at the lightest gear level
     that finishes it (tag 'needs:...'); S.gl / S.rf = your comfort pick (remembered in ap_plan), used only inside the open run card.
     G = the level the page computes with right now (list: GL_MIN without rare drops; the open card: max(comfort, needed level)).
     SHOW_JUST_ENOUGH = false (user 2026-09-25): 'Just enough' hidden, the lowest level is 'A bit more' (code path kept).
     RF_LIST: runs that only finish with rare drops stay listed, tagged 'needs rare drops' */
  const SHOW_JUST_ENOUGH = false, GL_MIN = SHOW_JUST_ENOUGH ? 0 : 1, RF_LIST = true;
  const G = { gl: GL_MIN, rf: false };
  const withG = (o, fn) => { const a = G.gl, b = G.rf; G.gl = +o.gl || 0; G.rf = !!o.rf; try { return fn(); } finally { G.gl = a; G.rf = b; } };
  let LSKIP = null;   // (h, n, m) => true: the list being built skips that run (a lighter list already has it)
  const labOf = (T, n, m, i, k) => { const r = (T || {})[n + '|' + m]; if (!r || k == null || k < 0) return null;
    const hv = Array.isArray(r) ? r[i] : r[PD.heroes[i]] != null ? r[PD.heroes[i]] : r[i]; return hv == null || hv[k] == null ? null : hv[k]; };
  /* LAB WIRE (patch_lab_js 2026-09-25): planner_pack (patch_pack_lab) packs PD.fc / PD.pace per gear level: fc = share of the dice
     replays that finish the whole run, pace = the last quest step a brand-new player's replay gets done; null = that level was not tested
     (nothing shown, never borrowed from another level). Both describe the NORMAL replays: not used while 'I'll farm rare drops' plays
     PD.rpf rows */
  const labRow = (T, n, m, i, k) => G.rf && PD.rpf && PD.rpf[n + '|' + m] ? null : labOf(T, n, m, i, k);
  const fcAt = (n, m, i, k, L) => { let v = labRow(PD.fc, n, m, i, k); if (Array.isArray(v)) v = L == null || L < 0 ? null : v[L];
    return typeof v === 'number' && isFinite(v) ? v : null; };
  /* safe for new players: the brand-new player's replay gets to the run's stop (default: the whole run) at the SAME gear level L */
  const paceOk = (n, m, i, k, L, stop) => { const v = labRow(PD.pace, n, m, i, k), st = stop == null ? 20 + n : stop;
    if (Array.isArray(v)) { const r = L == null || L < 0 ? null : v[L]; return typeof r === 'number' && r >= st; }
    return v === true || v === 'y'; };
  const CELLC = {};   // cellOf cache (speed): the packed replay strings never change while the page is open
  const cellOf = (n, m, i, k) => { const ck = (G.rf && PD.rpf ? 'f' : 'n') + n + '|' + m + '|' + i + '|' + k; if (ck in CELLC) return CELLC[ck]; return (CELLC[ck] = cellOf0(n, m, i, k)); };
  const cellOf0 = (n, m, i, k) => { const key = n + '|' + m, src = G.rf && PD.rpf && PD.rpf[key] ? PD.rpf : PD.rp, s = ((((src || {})[key] || {}).h || [])[i] || [])[k]; if (!s) return null;
    const tot = [...Array(NL).keys()].map(j => { const t = s.slice(1 + NL + 2 * j, 3 + NL + 2 * j); return t === 'zz' ? null : (B36.indexOf(t[0]) * 36 + B36.indexOf(t[1])) * 5; });
    const reach = [...s.slice(1, 1 + NL)].map(c => B36.indexOf(c));
    return { jl: s[0] === 'x' ? -1 : finL(reach, n, m, i, k), j0: s[0] === 'x' ? -1 : B36.indexOf(s[0]), reach, tot, n, m, i, k }; };   // FCS: m / i / k for stopL // LAB WIRE: j0 = first finishing replay
  /* KNIFE-EDGE RULE (user 2026-09-25): a gear level counts only when the next heavier level's replay also gets there (farming a bit more
     must not fail: 5% of finishing replays did), so every recommended run has a Safer run behind it; the heaviest level has none to check */
  const robL = (reach, stop) => reach.findIndex((r, x) => r >= stop && (x >= reach.length - 1 || reach[x + 1] >= stop));
  /* with PD.fc: a WHOLE run counts from the lightest gear level that gets there with a finish share of 50%+ (replaces the knife-edge rule);
     a hero / account step without a PD.fc value, and runs that stop at an upgrade boss, keep the knife-edge rule */
  const finL = (reach, n, m, i, k) => { if (!FCON || labRow(PD.fc, n, m, i, k) == null) return robL(reach, 20 + n);   // LAB WIRE: any tested level
    return reach.findIndex((r, x) => r >= 20 + n && (fcAt(n, m, i, k, x) || 0) >= 0.5); };
  /* FINISH CHANCE TO THE STOP (patch_fcs_js 2026-09-25): PD.fcs['N|m'][hero][account step][gear level] = {stop quest step: share of the lab's
     dice replays that get through it} (lab job finish_chance_stops). A run that STOPS EARLY at its last upgrade / start boss counts from the
     lightest gear level that gets there with a share of 50%+ when the lab tested that stop for this hero / account step (at any level);
     no level at 50%+ = the run is not shown. An untested stop keeps the knife-edge rule. Off with 'I'll farm rare drops' (labRow) */
  const fcsAt = (n, m, i, k, L, stop) => { const v = labRow(PD.fcs, n, m, i, k), o = Array.isArray(v) && L != null && L >= 0 ? v[L] : null, x = o ? o[stop] : null;
    return typeof x === 'number' && isFinite(x) ? x : null; };
  const stopL = (c, stop) => { const v = PD.fcs && c.m ? labRow(PD.fcs, c.n, c.m, c.i, c.k) : null;
    if (!Array.isArray(v) || !v.some(o => o && typeof o[stop] === 'number')) return robL(c.reach, stop);
    return c.reach.findIndex((r, x) => r >= stop && (fcsAt(c.n, c.m, c.i, c.k, x, stop) || 0) >= 0.5); };
  /* gear level S.gl: 0 Just enough = the rule above, 1 A bit more = the next heavier level whose replay also gets there (the old Safer run),
     2 Overgeared = the heaviest level whose replay gets there */
  const lvlFor = (c, stop) => { if (!c) return -1; const j = FCON && c.n && stop >= 20 + c.n ? c.jl : stopL(c, stop), g = +G.gl || 0; if (j < 0 || !g) return j;
    /* LAB WIRE: only REPLAYED levels count. PD.rpfl = the grid replayed every level (sim_grid FULL_LEVELS); older grids replayed up to the
       first finish + 1 and packed heavier levels as copies. Overgeared = the heaviest replayed level that gets there */
    const rpd = x => !!PD.rpfl || c.j0 == null || c.j0 < 0 || x <= c.j0 + 1;
    if (g === 1) { const k = c.reach.findIndex((r, x) => x > j && r >= stop && rpd(x)); return k < 0 ? j : k; }
    let k = j; c.reach.forEach((r, x) => { if (x > j && r >= stop && rpd(x)) k = x; }); return k; };
  /* first open quest step of a boss on N (v52: PD.bstep = 9 values per boss, planner_data fs_of; older data = 3 values for N2 / N5 / N8) */
  const fsOf = (b, n) => { const bs = (PD.bstep || {})[b]; if (!bs) return null; const v = bs.length >= 9 ? bs[n - 1] : bs[n <= 3 ? 0 : n <= 6 ? 1 : 2]; return v == null ? null : +v; };
  const stopOf = (b, n) => { const fs = fsOf(b, n); return fs == null ? 20 + n : Math.max(0, fs - 1); };
  const stageOf = st => st <= 12 ? 0 : st <= 20 ? 1 : 2;
  const stEnd = (j, n) => [12, 20, 20 + n][j];
  /* the quest step after which a hero (index i) at account step lv fights boss b on N, mode m (v52): PD.beat 'b|N|m' = the build of the
     stage where the boss opens (stopOf); if that fails, the full build at the end of the first later stage whose row 'b|N|m|stage' passes
     (rows are stored only where they change). -1 = not doable, also when the boss has no row at all */
  /* AUDIT M4: below Map Level PD.nsml (90) there is no +30 stone and the save holds no Challenge Tokens: PD.bns[k] = the same rows
     [opening, stage 0, 1, 2] ('' = no row) with the ladder's stone / tokens / ML 190 boots off, stored where they differ from PD.beat */
  const bnsOf = k => (+S.ml || 1) < (+PD.nsml || 90) ? ((PD.bns || {})[k] || null) : null;
  /* AFTER-RUN FIGHTS (patch_page_afterrun 2026-09-25, user-approved; data planner_pack PD.abf / PD.abon from sim_account's end-of-run
     fights): PD.abf['N|m'][hero][account step][gear level] = the bosses the replay's END gear loses at that gear level (comma list; null =
     not replayed). A boss the beat rows let you fight is not doable when the replay at the gear level of this run (lvlFor to the end of the
     run; no finishing level: to the fight's step) loses it with everything it holds at the end. No data / 'I'll farm rare drops' = the
     beat rows alone */
  const abLost = (b, n, m, i, lv, st) => { if (!PD.abon || st < 0 || (G.rf && PD.rpf)) return false;
    const r = ((PD.abf || {})[n + '|' + m] || {})[PD.heroes[i]], row = r ? r[lv] : null; if (!row) return false;
    const c = cellOf(n, m, i, lv); if (!c) return false; let L = lvlFor(c, 20 + n); if (L < 0) L = lvlFor(c, st);
    const x = L >= 0 ? row[L] : null; return typeof x === 'string' && x !== '' && x.split(',').includes(b); };
  const bossAt0 = (b, n, m, i, lv) => { const s = bossAt00(b, n, m, i, lv); return s >= 0 && abLost(b, n, m, i, lv, s) ? -1 : s; };
  const bossAt00 = (b, n, m, i, lv) => { const k = b + '|' + n + '|' + m, ns = bnsOf(k), s0 = ns ? ns[0] : (PD.beat || {})[k]; if (s0 === undefined) return -1;   // PREREQ GATES: bossAt = this + the hunt
    const st0 = stopOf(b, n); if (okAt(s0[i], lv)) return st0;
    for (let j = stageOf(st0); j <= 2; j++) { const s = ns ? ns[1 + j] || undefined : PD.beat[k + '|' + j]; if (s !== undefined && okAt(s[i], lv)) return Math.max(st0, stEnd(j, n)); }
    return -1; };
  /* where the route lists a boss fought after step st: the step it opens at, or the stage end it was pushed to */
  const slotOf = (b, n, st) => { if (st !== stopOf(b, n)) return st; const fs = fsOf(b, n); return fs == null ? 20 + n : fs; };
  /* ---- upgrades without a boss (patch_bossless 2026-09-25; data planner_data.py): PD.nbx[from>to] = [kind,...], PD.nbi = bag item
     routes, PD.sv = Survival Challenge waves. nbPlan -> null (not doable) or { at: quest step the run must pass, slot: route step, mins,
     pts, wp, sw: Survival wave, kills, how: short tag } */
  const NBX = PD.nbx || {}, NBI = PD.nbi || {}, SVW = PD.svw || [], KPM = PD.kpm || [18, 30];
  /* PD.sv['N|m'][hero] = 3 chars per account step (codes into PD.svw): after step PD.svs (Gul'dan's ticket, halfway Mid gear), end of Mid,
     end of the run (late gear; step 28 at most: the replay grid's N9 route stops there) -> the step after which the hero reaches wave W,
     -1 = never */
  const svAt = (n, m, i, k, W) => { const s = ((PD.sv || {})[n + '|' + m] || [])[i]; if (!s || k < 0) return -1; const st = [+PD.svs || 17, 20, 20 + n];   // AUDIT minor 11: the grid route reaches step 29 on N9 (route29)
    for (let r = 0; r < 3; r++) { const c = s[3 * k + r]; if (c && (SVW[B36.indexOf(c)] || 0) >= W) return st[r]; }
    return -1; };
  /* one bag item's route on N x mode (PD.nbi[key] = [{mode|band: [stage, minutes, kind, source, step, why, gate boss, lowest N]}, [buys]]):
     the farm route first, else the first Points / World Points buy the budget and Map Level allow (Legacy goal only) */
  /* ARMOR FRAGMENT SET (patch_dawn_armorset 2026-09-25): route[8].set = [[label, source, zone, main step, gate boss, side, fight unit, last,
     note]]: a spot opens at its zone's first main-quest step after its gate boss; a step past this run's end counts only with side = 1, as
     soon as the gate boss is beaten (Light Guardian Fortress / Naga Coast behind Evil Jaina); a fight unit must pass its beat row (Kodo
     Beast, Dwarven Gunslinger); one spot missing = the set is not plannable on this N */
  const setAt = (rows, n, m, i, lv) => { const out = [];
    for (const [lb, , z, st, gb, side, fu, last, note] of rows) {
      let at = st == null ? 99 : +st, via = '';
      if (at > 20 + n) { if (!side || !gb) return null; at = -1; via = gb; }   // off this run's main path: through the gate boss's portal
      for (const b of [gb, fu]) { if (!b) continue; const g = bossAt(b, n, m, i, lv); if (g < 0) return null; at = Math.max(at, g); }
      if (at < 0 || at > 20 + n) return null;
      out.push({ at, lb, z, last: +last || 0, note: note || '', via }); }
    return out; };
  /* UNTESTED (patch_dawn_armorset): route[8] = {u: [fights skipped], b: the same fight without them}; with allowU a route whose own fight
     fails is planned through b and carries unv = u (Dawn Sentinel: the three Elf Sisters without the N9 Frost Lord) */
  const nbRoute = (key, n, m, i, lv, bud, allowU) => { const r = NBI[key]; if (!r) return null;
    const gate = (gb, at) => { if (!gb || at < 0) return at; const g = bossAt(gb, n, m, i, lv); return g < 0 ? -1 : Math.max(at, g); };
    const f = (r[0] || {})[m + '|' + band(n)];
    if (f && n >= (+f[7] || 0)) { const [, mins, kd, src, step, why, gb, , fx] = f, ux = fx || {};
      if (ux.set) { const set = setAt(ux.set, n, m, i, lv);
        if (set) return { at: Math.max(0, ...set.map(x => x.at)), mins: +mins || 0, pts: 0, wp: 0, why, set: { key, rows: set } }; }
      else { let at = gate(gb, kd === 'B' && src ? ((PD.beat || {})[src + '|' + n + '|' + m] !== undefined ? bossAt(src, n, m, i, lv) : stopOf(src, n)) : +step), unv = null;
        if (allowU && ux.b && ux.u && !(at >= 0 && at <= 20 + n)) { const a2 = gate(gb, bossAt(ux.b, n, m, i, lv)); if (a2 >= 0 && a2 <= 20 + n) { at = a2; unv = ux.u; } }
        const z = src && bzone(src) ? zname(bzone(src)) : '';
        if (at >= 0 && at <= 20 + n) return Object.assign({ at, mins: +mins || 0, pts: 0, wp: 0, why: why + (z && !String(why).includes(z) ? ', ' + z : '') }, unv ? { unv } : {}); } }
    for (const [kd, src, step, pts, wp, ml, gb, why] of (r[1] || [])) {
      if ((S.ml || 1) < ml || pts > bud.pts || wp > bud.wp) continue;
      const at = gate(gb, +step); if (at < 0 || at > 20 + n) continue;
      return { at, mins: 2, pts, wp, why: `${wp ? fmt(wp) + ' World Points + ' : ''}${pts ? fmt(pts) + ' Points' : ''} at ${why}`.replace(' +  at', ' at') };
    }
    return null; };
  const nbPlan = (u, a, n, m, i, lv, rmax, bud, allowU) => { const x = u.nb, k = x[0], E2 = PD.e20 || [0, {}, 17];
    const ok = (at, o) => at >= 0 && at <= rmax ? Object.assign({ at, slot: at, mins: 0, pts: 0, wp: 0 }, o) : null;
    if (k === 's') { if (m === 'c') return null;
      return ok(svAt(n, m, i, lv, x[1]), { sw: x[1], how: `Survival wave ${x[1]} on N${n}${x[2] ? ', solo lobby' : ''}` }); }
    if (k === 'd') { if (m !== 'd' || (S.ml || 1) < x[3] || x[2] > bud.pts) return null; const b = PD.deb || 'O00K', at = bossAt(b, n, 'd', i, lv);
      return ok(at, { slot: at, mins: 3, pts: x[2], how: `Death Enhancer ${x[1]}: ${fmt(x[2])} Points (you have ${fmt(+S.pts || 0)}), the item must sit in Legacy Bag slot 1` }); }   // AUDIT minor 1, minor 4 (listed where the run stops for it)
    if (k === 'k') return x[3] ? ok(0, { bkills: x[2], how: `any boss kill on N${a[1] || n}+ with it in your Legacy Bag: ~${fmt(x[2])} boss kills (85% luck), the run's own bosses count` })   // AUDIT B2: hero-type units only
      : ok(0, { kills: x[2], how: `any kill on N${a[1] || n}+ with it in your Legacy Bag: ~${fmt(x[2])} kills (85% luck)` });
    if (k === 'e') { const mn = (E2[1] || {})[band(n)] || 0; return ok(+E2[2] || 17, { mins: mn * enhR() / gsF(n), how: `+20 with Legacy stones: ~${fmt(Math.round(E2[0] * enhR()))} Boss Souls` }); }   // VIP
    if (k !== 'b' && k !== 'q') return null;
    let at = 0, mins = 0, pts = 0, wp = 0, unv = null, set = null, fire = '', pqn = ''; const how = [];   // PREREQ GATES: fire = a bag item through the Firelands
    if (k === 'q') { for (const [b, kills, resp] of x[1]) { const s = bossAt(b, n, m, i, lv); if (s < 0) return null; at = Math.max(at, s); mins += kills * (60 + resp) / 60; }
      mins += 3; how.push(x[3]); }
    for (const [key, cnt] of (k === 'b' ? x[1] : x[2])) {
      if (POS[key]) { if (!Object.values(S.own).includes(key)) return null; continue; }   // another Legacy item: must be in your Legacy too
      const r = nbRoute(key, n, m, i, lv, { pts: bud.pts - pts, wp: bud.wp - wp }, allowU); if (!r) return null;
      at = Math.max(at, r.at); mins += r.mins; pts += r.pts; wp += r.wp; if (r.unv) unv = (unv || []).concat(r.unv); if (r.set) set = r.set;
      if (PQF.has(key)) { fire = fire || key; const c = pqChain(n, m, i, lv, true); if (c < 0) return null; at = Math.max(at, c); }   // PREREQ GATES: after Frodo's quest chain
      if (PQN[key]) pqn = pqn || key;                                    // PREREQ GATES: the bag item's route steps (I0C3 clue chain)
      if (k === 'b') how.push(`${iname(String(key).split('*')[0])}${cnt > 1 ? ' x' + cnt : ''} (${r.why})`);
    }
    let p20 = '';
    if (k === 'b' && x[2]) { at = Math.max(at, +E2[2] || 17); mins += ((E2[1] || {})[band(n)] || 0) * enhR() / gsF(n); p20 = `get it to +20 (~${fmt(Math.round(E2[0] * enhR()))} Boss Souls of Legacy stones)`; }   // VIP
    const hb = k === 'q' ? how.join(' · ') : [p20, how.length ? (p20 ? 'then bring ' : 'bring ') + how.join(', ') : ''].filter(Boolean).join(', ');   // AUDIT minor 2 (was 'bring get it to +20')
    return ok(at, Object.assign({ mins, pts, wp, how: hb }, unv ? { unv } : {}, set ? { set } : {}, fire ? { fire } : {}, pqn ? { pqn } : {})); };
  /* run minutes with the picks without a boss: their minutes, ONE Survival arena run (the highest wave), kills the run does not give */
  /* AUDIT B2 / M3: 'any boss kill' picks (nb.bkills): the run's main-quest bosses (PD.rqb up to its stop) and its boss picks count, ~1.5 min
     per extra boss kill (a respawning boss: fight + respawn wait). Per-kill chance picks (edge alt [5] kills, [6] seconds between kills,
     [7] 1 = 85% luck): kills x the hero's kill time (PD.kt, 60 s without a row) + the gaps */
  const KB_MIN = 1.5;
  const killMins = (g, n, m, i) => { const a = g.a || [], k = +a[5] || 0; if (k <= 1 || !a[0] || !a[0].length) return 0;
    const q = ((PD.kt || {})[a[0][0] + '|' + n + '|' + m] || '')[i], t = q ? B36.indexOf(q) * 10 : 60;
    return (k * t + (k - 1) * (+a[6] || 0)) / 60; };
  const killTxt = g => { const a = g.a || [], k = +a[5] || 0; return k > 1 && a[0] && a[0].length ? (+a[7] ? `~${fmt(k)} kills (85% luck)` : `${fmt(k)} kills`) : ''; };
  const nbMins = (got, base, n, stop, m, i) => { let add = 0, sw = 0, kills = 0, bk = 0;
    got.forEach(g => { if (n) add += killMins(g, n, m, i); const p = g.nb; if (!p) return; if (p.sw) sw = Math.max(sw, p.sw); else if (p.kills) kills = Math.max(kills, p.kills); else if (p.bkills) bk = Math.max(bk, p.bkills); else add += p.mins || 0; });
    const own = bk ? (PD.rqb || []).filter(x => +x[1] <= Math.min(stop == null ? 29 : stop, 20 + (n || 9))).length + got.filter(g => !g.nb && g.a && g.a[0] && g.a[0].length).length : 0;
    const t = base + add + pqRun(got, n, stop, m, i) + sw * 0.9 + Math.max(0, bk - own) * KB_MIN; return t + (kills ? Math.max(0, kills - KPM[0] * t) / KPM[1] : 0); };
  /* why an upgrade without a boss is not doable yet (short) */
  const nbWhy = u => { const x = u.nb; if (!x) return u.text; const why = [];
    if (x[0] === 'd') { if ((S.ml || 1) < x[3]) why.push(`needs Map Level ${x[3]}`); if ((+S.pts || 0) < x[2]) why.push(`needs ${fmt(x[2])} Points, you have ${fmt(+S.pts || 0)}`); }
    if (x[0] === 's') why.push('no hero of yours reaches that wave yet');
    if (x[0] === 'b' || x[0] === 'q') { const its = x[0] === 'b' ? x[1] : x[2];
      const lg = its.filter(([k]) => POS[k] && !Object.values(S.own).includes(k)).map(([k]) => iname(k));
      if (lg.length) why.push(`needs ${lg.join(', ')} in your Legacy too`);
      its.forEach(([k]) => { const r = NBI[k], nm = iname(String(k).split('*')[0]); if (POS[k] || (r && Object.keys(r[0] || {}).length)) return;
        const bs = r ? r[1] || [] : []; if (!bs.length) { why.push(`no way to get ${nm} in the model`); return; }
        if (bs.some(b => (S.ml || 1) >= b[5] && (+S.pts || 0) >= b[3] && (+S.wp || 0) >= b[4])) return;
        const b = bs[0]; why.push(`${nm} costs ${[b[3] ? fmt(b[3]) + ' Points' : '', b[4] ? fmt(b[4]) + ' World Points' : ''].filter(Boolean).join(' + ')}${b[5] ? ', Map Level ' + b[5] + '+' : ''} (you have ${fmt(+S.pts || 0)} Points${b[4] ? ', ' + fmt(+S.wp || 0) + ' World Points' : ''})`); }); }
    if (!why.length && x[0] !== 'x') why.push('no hero of yours gets there yet');
    return u.text + (why.length ? ' · ' + why.join(', ') : ''); };
  const tAt = (c, L, stop, n, m) => { const pr = ((PD.rp || {})[n + '|' + m] || {}).prof || [0.3, 0.6], last = 20 + n;
    const fr = s => s <= 12 ? s / 12 * pr[0] : s <= 20 ? pr[0] + (s - 12) / 8 * (pr[1] - pr[0]) : pr[1] + (s - 20) / Math.max(1, last - 20) * (1 - pr[1]);
    const tot = c.tot[L] != null ? c.tot[L] : c.tot.find(x => x != null) || 0;
    if (c.reach[L] >= last) return tot * fr(Math.min(stop, last));
    const fj = c.jl >= 0 && c.tot[c.jl] != null ? c.tot[c.jl] : null;   // borrow a finishing replay's pace when there is one
    return fj != null ? fj * fr(Math.min(stop, c.reach[L])) : tot * fr(Math.min(stop, c.reach[L])) / Math.max(0.05, fr(c.reach[L])); };
  const nearFin = (n, m, i, e) => { if (e.f < 0.5) return false; const c = cellOf(n, m, i, e.k), c2 = cellOf(n, m, i, e.k + 1); return !!c && c.jl < 0 && !!c2 && c2.jl >= 0; };
  const tMix = (c, L, stop, n, m, i, e) => { PQL.L = L; const t = tAt(c, L, stop, n, m), c2 = e.f ? cellOf(n, m, i, e.k + 1) : null, L2 = lvlFor(c2, stop);
    return L2 < 0 ? t : t + e.f * (tAt(c2, L2, stop, n, m) - t); };
  const finT = (c, L, n, m, i, e) => { const t = c.tot[L] != null ? c.tot[L] : c.tot[c.jl], c2 = e.f ? cellOf(n, m, i, e.k + 1) : null;
    if (!t || !c2 || c2.jl < 0) return t; const L2 = lvlFor(c2, 20 + n), t2 = L2 < 0 ? null : c2.tot[L2] != null ? c2.tot[L2] : c2.tot[c2.jl]; return t2 ? t + e.f * (t2 - t) : t; };
  const basicSet = (h, n, m) => new Set(Object.values((((W.best_items || {})[h] || {})[band(n) + '|' + MK[m]]) || {}).flat().filter(x => x[1] === 'b').map(x => x[0]));
  /* LAB WIRE (patch_lab_js): the item lists the replay REALLY farmed. PD.rpl[N|m][hero][account step][gear level] = [fix, early, mid, late]
     where the replay did not farm its own level's lists ('r' a replanned farm stop, 'e' it kept the lighter level's run): per part the gear
     level whose list it farmed. PD.rplf = the same for the rare-drop farmer rows; fix 'n..' = that farmer row is the normal run (PD.bb
     lists, not PD.bbf). Account step = eqStep (the step every goal replays) */
  const gearOf = (h, n, m, L) => { const bk = MK[m] + '|' + band(n), rk = n + '|' + m, bs = basicSet(h, n, m);
    const far = !!(G.rf && PD.bbf && PD.bbf[bk] && PD.bbf[bk][h]), pl = ((((G.rf && PD.rpf && PD.rpf[rk] ? PD.rplf : PD.rpl) || {})[rk] || {})[h] || {})[eqStep(h, n, m).k];
    const p = pl && Array.isArray(pl[L]) ? pl[L] : null, bsrc = far && !(p && String(p[0] || '').charAt(0) === 'n') ? PD.bbf : PD.bb;
    const g = (((W.best_items || {})[h] || {})[band(n) + '|' + MK[m]]) || {};
    const o = {}; ['early', 'mid', 'late'].forEach((st, i) => { const li = p && p[1 + i] != null && +p[1 + i] >= 0 ? +p[1 + i] : L, lv = ((((bsrc || {})[bk] || {})[h]) || [])[li];
      const all = tpKeep(h, n, m, L, i, lv ? (lv[i] || []) : (g[st] || []).map(x => x[0]), bk);   // TESTER PAGE FIXES: the gear the replay really held
      o[st] = all.filter(id => !bs.has(id)); o[st + '_b'] = all.filter(id => bs.has(id)); }); return o; };   // _b = starter gear (shown small)
  const LVLN = ['very light', 'light', 'medium', 'normal', 'heavy'], GLN = ['Just enough', 'A bit more', 'Overgeared'];
  const gearTxt = L => L < 0 ? '' : `${GLN[+G.gl || 0] || GLN[0]} (${LVLN[L] || 'level ' + (L + 1)} farming)`;
  /* NO MINUTES ON THE PAGE (user 2026-09-25): run times differ ~2x between players with the same hero and gear, so the page shows only what
     is the same for everyone (kills, drop %, Boss Souls, Points per kill / per run, quest steps). The model's minutes still rank and sort
     everything (Points per hour, just enough vs Safer, the tier list's 'fast' tag, Legacy run order). Run length words from the model's
     minutes: under 60 = short, 60-119 = medium, 120-179 = long, 180+ = very long. */
  const LENW = [[60, 'short'], [120, 'medium'], [180, 'long'], [Infinity, 'very long']];
  const lenW = t => t > 0 && isFinite(t) ? LENW.find(x => t < x[0])[1] : '';
  const lenI = t => t == null || !isFinite(t) ? 3 : t <= 0 ? 0 : LENW.findIndex(x => t < x[0]);   // length class 0-3 (no time known = very long, 0 min = short)
  const rkV = r => r.got.length + 0.5 * (r.chn || 0) + 0.01 * Math.min(40, r.pk || 0) - lenI(r.mins);   // CHAINS: chained steps half a line, pickups tie-break
  const lenTag = t => lenW(t) ? ` · ${lenW(t)} run` : '';
  /* CARDS UI: one part's full build: every planned slot, copies as 'x4', starter gear on a small '+ starter:' line, empty slots counted */
  const buildRow = (h, n, m, L, i) => { const g = gearOf(h, n, m, L == null || L < 0 ? 3 : L), st = ['early', 'mid', 'late'][i], main = g[st] || [], bas = g[st + '_b'] || [];
    if (!main.length && !bas.length) return ''; const free = Math.max(0, 6 - main.length - bas.length);
    const cnt = l => { const c = {}; l.forEach(x => { c[x] = (c[x] || 0) + 1; }); return Object.keys(c).map(x => tfLink(x) + (c[x] > 1 ? ` x${c[x]}` : '')).join(', '); };   // copies: 'Strength Axe x4'
    return (main.length ? cnt(main) : '') + (bas.length ? ` <span class="small">${main.length ? '+ ' : ''}starter: ${cnt(bas)}</span>` : '')
      + (free ? ` <span class="small">· ${free} free slot${free > 1 ? 's' : ''}: anything helps</span>` : '') + tpFitTxt(h, n, m, L, i); };   // TESTER PAGE FIXES: 'may not fit' without replay data
  /* ---- PREREQ GATES (patch_page_prereq 2026-09-25, user-approved Q1-Q3 'recommended'; audit findings/public/audit_math/prereq_audit.md,
     report prereq_fixes.md; data planner_data.py via scripts/pending/patch_prereq_gates.py; extract_102/war3map.j L = line).
     PD.pq[boss] = what the map needs before that boss, deepest first:
       k [g, note, walk] kill g first: Nature Guardian portal, Spider Queen, Storm Beast Gatekeeper, Evil Jaina, Dragon Turtle / Green Dragon keys
       t [src, ticket, %, kills, s between kills] arena ticket drop
       g [ticket, gold, Boss Souls] Spirit King ticket at the Challenge Display, Light Guardian Fortress (units_itemdata goldcost / lumbercost)
       p [ticket, Points, tokens] Shadow Lord: 1,000 Points + 10 Challenge Tokens, spent on purchase before the arena check; tokens = N - 3 per
                          Challenge main-quest clear on N4+, save key Itzlp
       h Frodo's Boss Hunt: the scroll I03C is the only way into the Firelands: one chain line (pqChain)
       i [key, boss, note] a key no route step before the goal names w [text, min] walk-up / combine f [creep, item, R, kills, zone] creep drop farm y [unit] Young Black Dragon on N4: its first death spawns the Adult Black Dragon
       b behind the boat: PD.bstep opens it after the route's boat step, no line. PD.pqn[bag item key] = the same steps for a bag-item
                          route ('r' boss = that boss's steps, 'd' boss drop farm): I0C3 = Naga Royal Guard ticket, Captain's Insignia,
                          the Prophet walk-up, Na Queen's staff
     PD.bstep already opens a boss after the step that kills its gates (planner_data fs_of). The route shows each step the main quest does
     not do, right before the goal line, once per route. Run length (never shown): each such step (kill time PD.kt, 60 s without a row,
     + PQW walk; ticket / drop farms at 85% luck; Spirit King gold at the model's income PD.pqr = acq GPM per band x stage / the mode's
     slow-down, scaled to N like the farm plan and by VIP; the hunt PD.pqh = acq fire_st + the scroll trip) + every goal boss the main
     quest does not kill (kill time + walk; a repeat-kill pick already counts its kills). PD.pqe[from>to] = 'item at +N or higher': the Legacy-stone step first (saves keep no enhance level). Without PD.pq the page is as before */
  const PQ = PD.pq || {}, PQE = PD.pqe || {}, PQH = PD.pqh || {}, PQR = PD.pqr || {}, PQF = new Set(PD.pqf || []), PQN = PD.pqn || {}, PQW = 2, PQA = 1.5;   // walk / arena teleport minutes
  const PQRS = {}; (PD.rqb || []).forEach(x => { if (!(x[0] in PQRS)) PQRS[x[0]] = +x[1]; });
  const pqOn = (g, n, st) => g in PQRS && PQRS[g] <= 20 + n && (st == null || PQRS[g] <= st);   // the main quest kills it by then
  const pqKt = (b, n, m, i) => { const q = ((PD.kt || {})[b + '|' + n + '|' + m] || '')[i]; return q ? B36.indexOf(q) * 10 : 60; };
  const pqPts = ids => (ids || []).reduce((t, b) => t + (PQ[b] || []).reduce((s, p) => s + (p[0] === 'p' ? +p[2] || 0 : 0), 0), 0);
  const pqKey = p => p[0] === 'k' ? 'k|' + p[1] : p.join('|');       // a gate boss once, whatever its note
  const pqT = t => K.tok ? K.tok(String(t || '')) : tmpl(t);          // {{u:}} / {{i:}} / {{z:}} tokens like the route's step lines
  const pqeOf = g => { const k = g && g.u ? g.u.from + '>' + g.u.to : '', e = PQE[k]; return e ? { id: g.u.from, lv: +e[0], souls: +e[1], mins: e[2] || {} } : null; };
  /* minutes of the steps before these goal bosses (ids), km[boss] = its kill count, stop = the run's stop, pe = +N stone steps */
  /* HUNT ONCE (coordinator 2026-09-25): the replay plays Frodo's hunt itself when its build needs the Firelands (sim_account fh_wanted:
     a build item with an acq route flag F, a Firelands source, or the Magic Ring), spread over its minutes like every step (tAt's profile).
     Then the chain adds only the part after the run's stop: hunt x (1 - share of the run's time by the stop). pqRepH = that build check on
     the page's own gear lists (gearOf = the lists the replay farmed); PQL.L = the gear level of the tMix just evaluated (nbMins' base) */
  const PQL = { L: null }, PQRH = new Map();
  const pqRepH = (h, n, m, L) => { if (!FW || L == null || L < 0) return false; const k = h + '|' + n + m + '|' + L + '|' + eqStep(h, n, m).k + (G.rf ? 'f' : ''); if (PQRH.has(k)) return PQRH.get(k);
    const T = FW.k[MK[m] + '|' + band(n)] || {}, g = gearOf(h, n, m, L); let r = false;
    for (let p = 0; p <= 2 && !r; p++) for (const id of (g[FPS[p]] || []).concat(g[FPS[p] + '_b'] || [])) { if (id === 'I03L') { r = true; break; }
      const wi = (T[id] || [])[p], w = wi != null && wi >= 0 ? FW.t[wi] : null; if (w && (w[3] === 'z10' || /F/.test(w[10] || '') || (w[0] === 'c' && tpFireI().has(id)))) { r = true; break; } }
    PQRH.set(k, r); return r; };
  const pqFr = (n, m, s) => { const pr = ((PD.rp || {})[n + '|' + m] || {}).prof || [0.3, 0.6], last = 20 + n; s = Math.min(Math.max(0, s), last);
    return s <= 12 ? s / 12 * pr[0] : s <= 20 ? pr[0] + (s - 12) / 8 * (pr[1] - pr[0]) : pr[1] + (s - 20) / Math.max(1, last - 20) * (1 - pr[1]); };
  const pqMins = (ids, km, n, m, i, stop, pe, L) => { if (!PD.pq) return 0;
    const R = PQR[m + '|' + band(n)], st = stageOf(Math.max(0, stop)), f = R ? (0.8 + 0.2 * n) / (0.8 + 0.2 * (+R[2] || n)) * gsF(n) : 1, seen = new Set(); let t = 0;
    ids.forEach(b => (PQ[b] || []).forEach(p => { const key = pqKey(p); if (seen.has(key)) return; seen.add(key); const k = p[0];
      if (k === 'k') { if (!pqOn(p[1], n, stop)) t += pqKt(p[1], n, m, i) / 60 + PQW + (+p[3] || 0); }
      else if (k === 't') { const K = Math.max(1, +p[4] || 1); t += ((W.boss || {})[p[1]] ? (K * pqKt(p[1], n, m, i) + (K - 1) * (+p[5] || 0)) / 60 : +p[6] || K / (KPM[1] || 30)) + PQW + PQA; }   // p[6] = measured creep minutes (200 Treants ~12 min)
      else if (k === 'g') { const g = R ? (+R[0][st] || 0) * f : 0, s = R ? (+R[1][st] || 0) * gsF(n) : 0;
        t += (+p[2] > 0 ? (g > 0 ? +p[2] / g : 600) : 0) + (+p[3] > 0 ? (s > 0 ? +p[3] / s : 600) : 0) + PQW + PQA; }
      else if (k === 'p') t += PQW + PQA;
      else if (k === 'h') t += (+((PQH[m + '|' + band(n)] || [])[st]) || 8) * (pqRepH(PD.heroes[i], n, m, L) ? Math.max(0, 1 - pqFr(n, m, stop)) : 1) + rwMin(PD.heroes[i], n, m, L, stop);   // MAGIC RING: + the Ringwraith // the whole chain (7 kills + walks + the scroll trip), minus what the replay already played
      else if (k === 'w') t += +p[2] || 0;
      else if (k === 'f') t += (+p[6] || (+p[4] || 0) / (KPM[1] || 30)) + PQW;
      else if (k === 'y') t += pqKt(p[1], n, m, i) / 60 + PQW; }));
    ids.forEach(b => { if (!pqOn(b, n, stop)) t += PQW + ((km || {})[b] > 1 ? 0 : pqKt(b, n, m, i) / 60); });   // off-route goal kill
    (pe || []).forEach(e => { t += 5 + Math.max(0, (+e.mins[band(n)] || 0) - 5) * enhR(e.lv) / gsF(n); });   // souls part scaled by the exact VIP table
    return t; };
  const pqRun = (got, n, stop, m, i) => { if (!PD.pq || !n) return 0; const ids = [], km = {}, pe = [];   // Legacy goal: its boss picks
    got.forEach(g => { if (g.nb || !g.a || !g.a[0] || !g.a[0].length) return; g.a[0].forEach(b => { if (!ids.includes(b)) ids.push(b); km[b] = Math.max(km[b] || 0, +g.a[5] || 1); });
      const e = pqeOf(g); if (e) pe.push(e); });
    return pqMins(ids, km, n, m, i, stop == null ? 20 + n : stop, pe, PQL.L); };
  const pqStart = (got, at, n, m, i, stop, L) => { if (!PD.pq) return 0; const ids = [], km = {};   // First Legacy: its boss starts
    got.forEach(x => { if (!(x[1] in at) || !x[2]) return; if (!ids.includes(x[2])) ids.push(x[2]); km[x[2]] = Math.max(km[x[2]] || 0, +x[8] || 1); });
    return pqMins(ids, km, n, m, i, stop, [], L); };
  /* FRODO'S QUEST CHAIN (user 2026-09-25): ONE route line 'Frodo's quest chain' with the steps in a collapsed 'Show steps' toggle. The hunt
     opens with main step 7; the 7 kills count only in order and only after step 7; back to Frodo = the scroll I03C; the Flame Lord counts after that and respawns; back to Frodo = Magic Ring I03L. The line sits at the earliest step from 7 on where the hero beats all 7 hunt bosses (bossAt0 per boss) and the Flame
     Lord when the run needs the Firelands; every Firelands goal (bossAt) and bag item through the Firelands comes after it. Its minutes:
     PD.pqh (the 7 kills + walks + the scroll trip) in pqMins */
  const PQHB = ['O000', 'H007', 'H008', 'H009', 'H00A', 'O001', 'H00B'], PQHC = new Map();
  const pqChain = (n, m, i, lv, fl) => { const k = n + m + '|' + i + '|' + lv + '|' + (fl ? 1 : 0) + '|' + ((+S.ml || 1) < (+PD.nsml || 90) ? 1 : 0) + '|' + G.gl + (G.rf ? 'f' : ''); if (PQHC.has(k)) return PQHC.get(k);
    let st = 7; for (const b of PQHB.concat(fl ? ['O003'] : [])) { if ((PD.beat || {})[b + '|' + n + '|' + m] === undefined) continue; const s = bossAt0(b, n, m, i, lv); if (s < 0) { st = -1; break; } st = Math.max(st, s); }
    const r = st >= 0 && st <= 20 + n ? st : -1; PQHC.set(k, r); return r; };
  const pqHasH = b => !!PD.pq && (PQ[b] || []).some(p => p[0] === 'h');
  const bossAt = (b, n, m, i, lv) => { const s = bossAt0(b, n, m, i, lv); if (s < 0 || !pqHasH(b)) return s; const c = pqChain(n, m, i, lv, true); return c < 0 ? -1 : Math.max(s, c); };
  const pqChainHtml = (why, notes, rw) => `<details class="zn-rules"><summary>Show steps</summary><ul class="pl-ul">`
    + `<li>Step 7 (${ilink('I02Y')} to Frodo) opens his hidden Boss Hunt: kills before it do not count.</li>`
    + `<li>Kill in this order: ${PQHB.map(b => esc(bname(b))).join(' › ')}. Each counts only after the one before, each comes back 90 s after a kill.${notes.length ? ' ' + notes.join(' ') : ''}</li>`
    + `<li>Back to ${esc(bname('n009') === 'n009' ? 'Frodo' : bname('n009'))} for the <a href="#item/I03C">${K.icon('I03C')}Firelands Transfer Scroll</a>: keep it and use it when you go (one use per game, the Firelands teleport stone stays open for your party).</li>`
    + `<li>In the Firelands kill the ${esc(bname('O003'))} (he comes back after a kill).</li>`
    + `<li>Back to Frodo: ${ilink('I03L')} for every player.</li>${rw ? '<li>' + rwTxt() + '</li>' : ''}</ul></details>`;   // MAGIC RING
  /* the chain line at its step, before that step's goal lines; not needed = the optional line at step 7 (collapsed the same way) */
  const pqHuntAt = (li, i, X, need, FPL) => { const x = X.steps[i]; if (!x) return;
    if (!X.hunt) { const why = [], add = t => { if (t && !why.includes(t)) why.push(t); };
      need.forEach(b => { if (b.id && bzone(b.id) === 'z10') add(esc(bname(b.id))); else if (b.fire) add(ilink(String(b.fire).split('*')[0])); });
      ((FPL && FPL.fire) || []).forEach(id => add(id === 'souls' ? 'the Boss Souls farm at the Flame Lord' : ilink(id)));
      const hi = HIDX[X.h], c = why.length && hi != null ? pqChain(X.n, X.m, hi, eqStep(X.h, X.n, X.m).k, true) : -1;
      const k = c < 0 ? -1 : X.steps.findIndex(y => +y.step >= c);
      const on = b => X.steps.findIndex(y => +y.step < c && String(y.do || '').includes('{{u:' + b + '}}')), notes = [];
      PQHB.forEach(b => { const j = on(b); if (j < 0) return; const sn = +X.steps[j].step; if (sn < 7) notes.push(`Your step ${sn} ${esc(bname(b))} kill does not count.`); });
      X.hunt = { why, at: c < 0 ? -1 : k < 0 ? X.steps.length - 1 : k, notes }; }
    const H = X.hunt;
    if (!H.why.length) { if (+x.step === 7) li.push(`<li class="pl-rp"><span class="small">Optional: Frodo's quest chain gives every player a ${ilink('I03L')}. Nothing on this run needs it.</span>${pqChainHtml('', [])}</li>`); return; }
    if (H.at < 0) { if (+x.step === 7) tpHunt(li, X.steps, X.stop, need, FPL); return; }   // no hero data: the old block
    if (i === H.at) li.push(`<li class="pl-rb pl-n"><b>Frodo's quest chain</b> · opens the Firelands, needed for ${andJ(H.why)}${pqChainHtml(andJ(H.why), H.notes, !!(FPL && FPL.rw && FPL.rw.i >= H.at))}</li>`);
    if (FPL && FPL.rw && FPL.rw.i >= H.at && i === FPL.rw.i) li.push(`<li class="pl-rb pl-n"><b>Absolute Ring</b> · ${rwTxt()}</li>`); };   // MAGIC RING: right after the chain (N4+) / in Late (N1-3)
  /* route lines before a goal line (b = a routeHtml need, X = the route: seen, n, steps) */
  const pqLi = (lb, t, note, warn) => `<li class="pl-rb pl-n"><b>${lb}</b> · ${t}${note ? ' <span class="small">· ' + note + '</span>' : ''}${warn ? ' <span class="small warntext">' + warn + '</span>' : ''}</li>`;
  const pqZ = u => { const z = bzone(u); return z ? ` <span class="small">(${esc(zname(z))})</span>` : ''; };
  const pqPre = (b, X) => { const out = []; if (!b || !X || (!b.id && !b.pqe && !b.pqn)) return out;
    const n = X.n, sl = +((X.steps[b.at] || {}).step || 0), says = tok => X.steps.slice(0, b.at + 1).some(x => String(x.do || '').includes(tok));
    const once = k => { if (X.seen.has(k)) return false; X.seen.add(k); return true; };
    const one = (p, gid) => { const k = p[0]; if (k === 'k' && pqOn(p[1], n, sl)) return; if (k === 'b' || k === 'h' || !once(pqKey(p))) return;
      if (k === 'k') out.push(pqLi('First', `kill ${srcA(p[1], bname(p[1]))}${pqZ(p[1])}`, [p[2] ? pqT(p[2]) : '', BOAT.has(p[1]) && BOATSTEP != null && sl < +BOATSTEP ? BOATTXT : ''].filter(Boolean).join(' · ')));
      else if (k === 't') { const K = Math.max(1, +p[4] || 1), nm = bname(p[1]);
        out.push(pqLi('Ticket', +p[3] >= 99.5 ? `kill ${srcA(p[1], nm)}${pqZ(p[1])}: it drops ${ilink(p[2])}`
          : !(W.boss || {})[p[1]] ? `kill ${esc(nm)} x${fmt(K)}${pqZ(p[1])} (all players count): the ${fmt(K)}th drops ${ilink(p[2])}`
          : `kill ${srcA(p[1], nm)}${pqZ(p[1])} until ${ilink(p[2])} drops (${pctF(+p[3])}, ~${fmt(K)} kills at 85% luck)`, 'use it with the arena empty')); }
      else if (k === 'g') out.push(pqLi('Ticket', `buy ${ilink(p[1])} at the ${srcA('n019', 'Challenge Display')} (Light Guardian Fortress): ${payF(+p[2], +p[3])}`, 'use it with the arena empty'));
      else if (k === 'p') out.push(pqLi('Ticket', `${ilink(p[1])} at the ${srcA('n019', 'Challenge Display')} (Light Guardian Fortress): using it takes ${fmt(+p[2])} Points + ${fmt(+p[3])} Challenge Tokens`,
        `you have ${fmt(+S.pts || 0)} Points${S.src === 'save' && S.tok != null ? ' and ' + fmt(+S.tok || 0) + ' tokens' : ''}. Both go the moment you buy it, even when the arena is busy: empty the arena first. Tokens: clear the main quest in Challenge mode on N4+, N - 3 per clear (N4 1 ... N9 6), kept in your save`));
      else if (k === 'i') { if (!says('{{i:' + p[1] + '}}')) out.push(pqLi('First', `take ${ilink(p[1])} from the first ${srcA(p[2], bname(p[2]))} kill`, pqT(p[3]))); }
      else if (k === 'w') out.push(pqLi('First', pqT(p[1])));
      else if (k === 'f') out.push(pqLi('First', `kill ${esc(bname(p[1]))}${p[5] ? ` <span class="small">(${esc(zname(p[5]))})</span>` : pqZ(p[1])} until ${ilink(p[2])} drops (1 in ${fmt(+p[3])}, ~${fmt(+p[4])} kills at 85% luck)`));
      else if (k === 'd') out.push(pqLi('First', `kill ${srcA(p[1], bname(p[1]))}${pqZ(p[1])} until ${ilink(p[2])} drops (${pctF(+p[3])}, ~${fmt(+p[4])} kills at 85% luck)`));
      else if (k === 'y') out.push(pqLi('First', `kill the ${srcA(p[1], bname(p[1]))}${pqZ(p[1])}`, `on N4 its first death spawns the ${esc(bname(gid))}`,
        says('{{u:' + p[1] + '}}') ? 'Kill it only here: take the other quest option before this.' : '')); };
    if (b.id) (PQ[b.id] || []).forEach(p => one(p, b.id));
    if (b.pqn) (PQN[b.pqn] || []).forEach(p => { if (p[0] === 'r') (PQ[p[1]] || []).forEach(q => one(q, p[1])); else one(p, ''); });
    if (b.pqe && once('e|' + b.pqe.id + '|' + b.pqe.lv)) out.push(pqLi('First', `get ${ilink(b.pqe.id)} to +${b.pqe.lv} with Legacy stones on your hero or pet (~${fmt(Math.round(b.pqe.souls * enhR(b.pqe.lv)))} Boss Souls, ${srcA('n00M', 'Legacy Equipment Enhancer')}, Holy Light Fortress), then back into the Legacy Bag`));
    return out; };
  /* a run that stops at step 0 still gets its route when a goal has a step first (Adult Black Dragon: the Young Black Dragon kill) */
  const pqRoute0 = r => !!PD.pq && rtNeeds(r).some(x => x.id && (PQ[x.id] || []).some(p => p[0] !== 'b' && p[0] !== 'h' && !(p[0] === 'k' && pqOn(p[1], r.n, 0))));
  /* ---- route of a run: the main-quest steps up to the stop point, with each needed boss slotted in at the step it opens or is fought at
     and the Early / Mid / Late items at the start of each part (zone order > 6 = Mid, > 18 = Late, same on every N) */
  const ZO = {}; (W.zones || []).forEach(z => { if (/^\d+$/.test(String(z.order))) ZO[z.id] = +z.order; });
  const zname = z => ((W.zones || []).find(x => x.id === z) || {}).name || '';
  const bzone = b => (W.unit_zone || {})[b] || (PD.bz || {})[b];
  const tmpl = t => esc(String(t || '')).replace(/\{\{(u|z|i):([A-Za-z0-9]{4})\}\}/g, (m, k, id) => k === 'i' ? iname(id) : k === 'z' ? zname(id) : (((W.boss || {})[id] || {}).name || (((W.mon || {})[id] || {}).name) || id));
  /* ---- FARM PLAN (2026-09-25; user: the route shows where to farm each suggested item and where to farm Boss Souls for enhancing).
     PD.fw (scripts/planner_pack.py): t = 'where' tuples [kind, source, id, zone, drop %, gold, Boss Souls, minutes (3-in-4 luck + look-up),
     kills (85% luck), extra, flags], k[mode|band][item] = tuple index per run stage (-1 none). kind b boss drop / m creep or placed drop /
     s shop / x Special Merchant / q side quest / o main quest reward / f free / c craft / h treasure bag / e evolves / k hero kit.
     Each route part lists its NEW items (not kept from the last part; starter gear and kit items left out) under the first step of the
     part in the source's zone, or the first step past that zone (farm while you pass); a zone passed before the part = under its header.
     Boss Souls at the end of each part: the items' Boss Souls prices + the guide build's + levels (PD.enh, tier_calc enhance_build; normal /
     heavy gear only) against a normal run's souls by then (PD.sby at the band's N PD.sn, x (0.8 + 0.2 N) / (0.8 + 0.2 band N)); the rest is
     farmed at the best Boss Souls farm the median hero beats in that part (PD.sf = [boss, souls per minute, zone, souls per kill]; the page
     shows kills = ceil(short / souls per kill at this N), never minutes) */
  const FW = PD.fw && PD.fw.t && PD.fw.k ? PD.fw : null, FPN = ['Early', 'Mid', 'Late'], FPS = ['early', 'mid', 'late'];
  const SHOPID = {}; (W.shops || []).forEach(s => { SHOPID[s.id] = 1; });
  const enhC = (a, b, v) => { const e = 0.05 * (v == null ? vipLv() : v); let s = 0;   // tier_calc enh_cost, +a -> +b (+15..+19: 50%, Protection Stone per fail); VIP: +5 pp per level
    for (let x = a; x < b; x++) s += x < 10 ? 10 * (x + 1) / Math.min(1, 0.8 + e) : x < 15 ? 15 * x / Math.min(1, 0.6 + e) : 20 * x / Math.min(1, 0.5 + e); return s; };
  const enhR = N => { const t = (PD.pqev || {})[String(N || 20)], j = [0, 1, 2, 4, 10].indexOf(vipLv()); return t && j >= 0 && +t[0] > 0 ? +t[j] / +t[0] : enhC(0, N || 20) / enhC(0, N || 20, 0); };   // PREREQ GATES: exact Legacy-stone VIP means (PD.pqev) // VIP: Legacy-stone +20 souls (PD.e20, VIP 0) scaled like the stone chances (approximation)
  const srcA = (id, nm) => { const t = esc(nm || id || ''); if (!id) return t;
    return (W.boss || {})[id] ? `<a href="#boss/${id}">${t}</a>` : (W.mon || {})[id] ? `<a href="#unit/${id}">${t}</a>` : SHOPID[id] ? `<a href="#shop/${id}">${t}</a>` : t; };
  const pctF = c => (c >= 10 || c === Math.round(c) ? Math.round(c) : +c.toFixed(1)) + '%';
  const killF = k => (k = Math.max(1, Math.round(+k || 1))) > 1 ? `~${fmt(k)} kills` : '1 kill';   // kills at 85% luck (planner_pack k85), no minutes
  const triesF = ch => Math.max(1, Math.ceil(Math.log(0.15) / Math.log(1 - Math.min(0.99, ch / 100)) - 1e-9));   // bags / chests opened at 85% luck (AUDIT minor 13: ceil)
  const payF = (g, s) => [g ? fmt(g) + ' gold' : '', s ? fmt(s) + ' Boss Souls' : ''].filter(Boolean).join(' + ');
  function whereTxt(w, cp) {                                         // cp = copies on this line
    const [k, nm, id, z, ch, g, sl, mn, kl, x, fl] = w, zn = z ? zname(z) : '', zt = zn && !String(nm).includes(zn) ? ` (${esc(zn)})` : '', once = /o/.test(fl || '');
    if (k === 'b' || k === 'm') return srcA(id, nm) + zt + ', ' + (/P/.test(fl || '') ? 'drops once per player per game' : once ? (ch >= 85 ? 'drops once per run' : `${pctF(ch)} drop, one try per run`)   // AUDIT minor 9: flag P (planner_pack)
      : ch >= 99.5 ? 'drops every kill' : `${pctF(ch)} drop, ${killF(kl)}`) + (x ? ', ' + esc(x) : '');
    if (k === 's') return `${payF(g, sl) || 'buy it'}${cp > 1 && (g || sl) ? ' each' : ''} at the ${srcA(id, nm)}${zt}`;
    if (k === 'x') return `${srcA(id, nm)}${zt}: ${payF(g, sl)} (one trade per run)`;
    if (k === 'f') return `free at ${srcA(id, nm)}${zt}`;
    if (k === 'o') return `main quest step ${x} reward`;
    if (k === 'q') return `quest ${esc(nm)}${zt}${x ? ', ' + esc(x) : ''}`;
    if (k === 'c') return `craft${nm ? ', parts: ' + esc(nm) : ''}${g || sl ? ', ' + payF(g, sl) : ''}`;
    if (k === 'h') { const u = /chest/i.test(nm) ? 'chest' : 'bag'; return `${esc(nm)}${zt}${ch && ch < 100 ? `, ${pctF(ch)} per ${u}, ~${fmt(triesF(ch))} ${u}s` : ''}`; }
    if (k === 'e') return `evolve ${id ? ilink(id) : esc(nm)}${x ? ': ' + esc(x) : ''}${sl ? ' (' + fmt(sl) + ' Boss Souls)' : ''}`;
    return esc(nm);
  }
  /* ---- BOSS SOULS (patch_page_souls 2026-09-25, user-approved 'spend Boss Souls before every hard boss'; findings/public/audit_math/
     tester2_souls_spending.md). BS_T85[N] = Boss Souls to take one item +0 -> +N at 85% luck (VIP 0; 100,000 rolls of the map chances
     80 / 60 / 50%, a Protection Stone per fail on +15..+19 like tier_calc enh_cost); bsC85 = the difference, VIP scaled like enhR */
  const BS_T85 = [0, 20, 50, 90, 150, 230, 320, 420, 530, 660, 800, 1120, 1470, 1835, 2225, 2635, 3395, 4190, 5020, 5880, 6780];
  const bsC85 = (a, b) => (BS_T85[b] - BS_T85[a]) * enhC(0, b) / Math.max(1, enhC(0, b, 0));
  const BS_RAR = new Set(['epic', 'legendary', 'artifact', 'hart']);
  let BS_IM = null;
  const bsItem = id => { if (!BS_IM) { BS_IM = {}; (W.items || []).forEach(x => { BS_IM[x.id] = x; }); } return BS_IM[id] || null; };
  /* sim_account enhance: flat stats per + level (10% each), main stat / all stats 1, other stats 0.15, attack 0.5, HP 1/30, armor 1.5 */
  const bsW = (id, q) => { const it = bsItem(id); if (!it || !BS_RAR.has(it.rar) || !(+it.level >= 5) || it.legacy) return 0; const s = it.st || {};
    return 0.1 * ((+s[q] || 0) + (+s.all_stats || 0) + 0.15 * ['str', 'agi', 'int'].filter(k => k !== q).reduce((a, k) => a + (+s[k] || 0), 0) + 0.5 * (+s.ad || 0) + (+s.hp || 0) / 30 + 1.5 * (+s.armor || 0)); };
  /* ---- GIANT SCYTHE CARRY (patch_page_scythe 2026-09-25, user-approved; findings/public/audit_math/carry_evolve_items.md items 9-12).
     Map 1.02: Troll Hunt 50% Giant Scythe per clear, repeats by itself, its own task apart from the Troll Boss option. Evolutions while the HERO carries it, kills by any unit you own: 15 Ogre Mage, 30 Mud Golem, 15 Rebel - Elite Warrior, the Flame Lord. Guard line eats an unevolved Giant Scythe. scNeed(id) = {s: highest scythe stage the item needs (W.recipes parts + W.evo reverse edges), g: needs a Giant Scythe
     for a Guard}; scPlan = the route lines; scFitMin = tpFit minutes (extra kills only) */
  const SC_ST = ['I0OO', 'I0ON', 'I0OP', 'I0OQ', 'I0OR'], SC_M = new Map(); let SC_LAST = null;
  const scNeed = (id, seen) => { if (SC_M.has(id)) return SC_M.get(id); const j = SC_ST.indexOf(id); if (j >= 0) return { s: j, g: false };
    seen = seen || new Set(); if (seen.has(id)) return { s: -1, g: false }; seen.add(id);
    const r = { s: -1, g: false }, mg = x => { if (x.s > r.s) r.s = x.s; if (x.g) r.g = true; };
    (W.recipes || []).forEach(rc => { const out = [(rc.result || {}).id].concat((rc.results || []).map(x => x && x.id)); if (!out.includes(id)) return;
      (rc.parts || []).filter(Boolean).forEach(p => { if (p.id === 'I0OO') r.g = true; else mg(scNeed(p.id, seen)); }); });
    Object.entries(((W.evo || {}).e) || {}).forEach(([fr, ed]) => { if (fr !== 'I0OO' && (ed || []).some(e => e && e[0] === id)) mg(scNeed(fr, seen)); });
    SC_M.set(id, r); return r; };
  const scSum = ids => { let s = -1, g = false; ids.forEach(id => { const r = scNeed(id); if (r.s > s) s = r.s; if (r.g) g = true; }); return { s, g, on: s >= 1 || g, cp: (s >= 0 ? 1 : 0) + (g ? 1 : 0) }; };
  const scMon = (u, t) => srcA(u, t);
  const scPlan = (h, n, m, L, steps, stop) => { const gl = gearOf(h, n, m, L == null || L < 0 ? 3 : L), po = []; let c = -1;
    steps.slice(0, stop + 1).forEach((x, i) => { const o = ZO[x.zone] || 0; c = Math.max(c, o > 18 ? 2 : o > 6 ? 1 : 0); po[i] = c; });
    const ids = []; [0, 1, 2].forEach(p => { if (po.includes(p)) (gl[FPS[p]] || []).concat(gl[FPS[p] + '_b'] || []).forEach(x => ids.push(x)); });
    const R = Object.assign(scSum(ids), { at: {}, fl: false });
    const no = { on: false, skip: () => false, add: () => '', place: () => {}, fire: () => '' }; if (!R.on) return no;
    const S2 = R.s, two = R.cp > 1, fi = f => { const i = steps.findIndex((x, k) => k <= stop && f(x)); return i; };
    const put = (i, k, t) => { if (i < 0) return; (R.at[i] = R.at[i] || []).push(t); if (k != null) R['k' + k] = 1; };
    const tr = fi(x => +x.step === 1);
    put(tr, 0, `<li>${ilink('I0OO')}${two ? ' x2' : ''} <span class="small">· take the Old Hunter's Troll Hunt (12 ${scMon('nftr', 'Forest Trolls')} + 12 ${scMon('nftt', 'Troll Marksmen')}, ${esc(zname('z03'))}): 50% per clear, ~${two ? 6 : 3} clears at 85% luck. The quest repeats, so this works even if you finished step 1 with the Troll Boss</span></li>`);
    if (S2 >= 1) put(fi(x => String(x.do || '').includes('{{u:nomg}}')), 1, `<li>${ilink('I0ON')} <span class="small">· kill ${scMon('nomg', 'Ogre Mages')} for this step's 15 kills with the ${ilink('I0OO')} on your hero (they count for the quest)</span></li>`);
    if (S2 >= 2) put(fi(x => x.zone === ((W.unit_zone || {}).ngrk || 'z04')), 2, `<li>${ilink('I0OP')} <span class="small">· kill 30 ${scMon('ngrk', 'Mud Golems')} here with the ${ilink('I0ON')} on your hero</span></li>`);
    const ei = S2 >= 3 ? fi(x => String(x.do || '').includes('{{u:nrog}}')) : -1;
    if (S2 >= 3) put(ei, 3, `<li>${ilink('I0OQ')} <span class="small">· pick the Elite hunt (12 ${scMon('nrog', 'Elite Warriors')} + 12 ${scMon('nass', 'Elite Spearmen')}) and kill 15 Elite Warriors with the ${ilink('I0OP')} on your hero (3 extra)</span></li>`);
    if (S2 >= 4) { const hi = HIDX[h], cs = hi != null ? pqChain(n, m, hi, eqStep(h, n, m).k, true) : -1, k = cs < 0 ? -1 : steps.findIndex(y => +y.step >= cs);
      const ci = k < 0 ? steps.length - 1 : k; R.fl = cs >= 0 && ci <= stop && !!R.k3;
      if (R.fl) { R.k4 = 1; R.fc = ci >= ei; R.fa = R.fc ? ci : ei;   // Flame Lord after Frodo's chain line, or after the Elite hunt when the chain comes first (the Firelands stay open)
        if (!R.fc) put(ei, null, `<li>${ilink('I0OR')} <span class="small">· then kill the ${srcA('O003', bname('O003'))} in the Firelands with the ${ilink('I0OQ')} on your hero (the Firelands teleport stone stays open)</span></li>`); } }
    const last = [4, 3, 2, 1].find(k => k <= S2 && R['k' + k]);
    R.skip = (id, w) => { const k = SC_ST.indexOf(id); return (k >= 1 && w[0] === 'e' && !!R['k' + k]) || (k === 0 && w[0] === 'q' && !!R.k0); };
    R.add = (id, w) => { if (w[0] !== 'c' || SC_ST.includes(id)) return ''; const r = scNeed(id), o = [];
      if (r.s >= 1) o.push(`+ your evolved scythe (${ilink(SC_ST[Math.min(r.s, last || r.s)])})`); if (r.g) o.push(`+ your unevolved ${ilink('I0OO')}`); return o.length ? ' · ' + o.join(', ') : ''; };
    R.place = (head, at) => { const t = S2 >= 1 ? `carry it on your hero from step 1${last ? ' to the ' + ilink(SC_ST[last]) : ''} (hero slots only, your pet's kills count)` : S2 === 0 ? 'wear one' : '';
      const gd = R.g ? (S2 >= 0 ? 'keep the second one off your hero: the Guard craft needs it unevolved' : 'keep it off your hero: the Guard craft needs it unevolved') : '';
      (head[0] = head[0] || []).push(`<li>${ilink('I0OO')}${two ? ' x2' : ''} <span class="small">· ${[t, gd].filter(Boolean).join('; ')}</span></li>`);
      Object.keys(R.at).forEach(i => { (at[i] = at[i] || []).push(...R.at[i]); }); };
    R.fire = () => `<li class="pl-rb pl-n"><b>${ilink('I0OR')}</b> · kill the ${srcA('O003', bname('O003'))} with the ${ilink('I0OQ')} on your hero</li>`;
    return R; };
  const scFitMin = (h, n, m, L, id, w, nw) => { const d = (+w[7] || 0) * nw, k = SC_ST.indexOf(id); if (k < 0 || !(w[0] === 'e' || (k === 0 && w[0] === 'q'))) return d;
    const gl = gearOf(h, n, m, L), ids = []; FPS.forEach(st => (gl[st] || []).concat(gl[st + '_b'] || []).forEach(x => ids.push(x)));
    const R = scSum(ids); if (!R.on) return d; const kpm = +KPM[1] || 30;
    return k === 0 ? (R.cp > 1 ? 5 : 2) * 24 / kpm : k === 1 ? 1 : k === 2 ? 30 / kpm : k === 3 ? 3 / kpm : 2; };   // extra kills beyond the route only
  function farmPlan(h, n, m, L, steps, stop) {                       // -> {head(li, part), step(li, i), end(li, part)} or null (no data)
    if (!FW) return null;
    const key = MK[m] + '|' + band(n), T = FW.k[key] || {}, g = gearOf(h, n, m, L == null || L < 0 ? 3 : L);
    const po = [], pS = [], pE = []; let c = -1;                       // part of each step (running max, like the route), first / last step
    steps.slice(0, stop + 1).forEach((x, i) => { const o = ZO[x.zone] || 0; c = Math.max(c, o > 18 ? 2 : o > 6 ? 1 : 0); po[i] = c; if (pS[c] == null) pS[c] = i; pE[c] = i; });
    const head = {}, at = {}, end = {}, kept = {}, lvDone = {}, enh = String((((PD.enh || {})[key] || {})[h]) || '').split('|');
    const SCP = scPlan(h, n, m, L, steps, stop); SC_LAST = SCP; SCP.place(head, at);   // GIANT SCYTHE CARRY: Early carry line + step lines
    const fire = [];                                                  // TESTER PAGE FIXES: what needs the Firelands (Frodo's Boss Hunt)
    const rwP = rwPlan(h, n, m, L, steps, stop), rwUp = rwP.i >= 0 || rwP.abs;   // MAGIC RING: the run upgrades the ring = no + levels on it
    const f = (0.8 + 0.2 * n) / (0.8 + 0.2 * ((PD.sn || {})[band(n)] || n)) * gsF(n), useEnh = true;   // BOSS SOULS: every gear level (only the free +30 stone line reads PD.enh now)
    let spent = 0, farmed = 0, stoneAt = ''; const bsIS = [0, 0, 0];   // BOSS SOULS: item Boss Soul prices per part // AUDIT minor 14: the run's one +30 stone (one copy of one item)
    for (let p = 0; p <= 2; p++) {
      if (pS[p] == null) continue;
      const cnt = {}, why = [], up = []; (g[FPS[p]] || []).forEach(id => { cnt[id] = (cnt[id] || 0) + 1; });
      for (const id of Object.keys(cnt)) {
        const nw = cnt[id] - (kept[id] || 0); kept[id] = Math.max(kept[id] || 0, cnt[id]);
        if (nw <= 0) continue;
        const wi = (T[id] || [])[p], w = wi != null && wi >= 0 ? FW.t[wi] : null;
        if (!w || w[0] === 'k' || SCP.skip(id, w)) continue;   // GIANT SCYTHE CARRY: the carry lines replace the stage items' evolve lines
        if (w[3] === 'z10' || /F/.test(w[10] || '') || (w[0] === 'c' && tpFireI().has(id))) fire.push(id);   // TESTER PAGE FIXES: source in (or route through) the Firelands
        if (w[6]) { spent += w[6] * nw; bsIS[p] += w[6] * nw; why.push(ilink(id)); }
        const line = `<li>${ilink(id)}${nw > 1 ? ' x' + nw : ''} <span class="small">· ${whereTxt(w, nw)}${SCP.add(id, w)}</span></li>`, zo = ZO[w[3]];
        let j = -1;
        if (w[0] === 'o') { for (let i = pS[p]; i <= pE[p]; i++) if (+steps[i].step >= +w[9]) { j = i; break; } }
        else if (w[0] === 'f' && w[3]) j = steps.findIndex((x, i) => i <= stop && x.zone === w[3]);   // free: take it the first time you are there
        else if (/L/.test(w[10] || '') && w[3]) { for (let i = pE[p]; i >= pS[p]; i--) if (steps[i].zone === w[3]) { j = i; break; } if (j < 0) j = pE[p]; }   // fortress kill: after its quests
        else if (w[3]) {
          for (let i = pS[p]; i <= pE[p]; i++) if (steps[i].zone === w[3]) { j = i; break; }
          if (j < 0 && zo != null && zo > (ZO[steps[pS[p]].zone] || 0)) { for (let i = pS[p]; i <= pE[p]; i++) if ((ZO[steps[i].zone] || 0) >= zo) { j = i; break; } if (j < 0) j = pE[p]; }
        }
        if (id === RW_A && w[0] === 'c') { if (rwP.i >= 0) continue; (j < 0 ? (head[p] = head[p] || []) : (at[j] = at[j] || [])).push(`<li>${ilink(id)} <span class="small">· ${rwTxt()}</span></li>`); continue; }   // MAGIC RING: the route's 'Absolute Ring' line
        (j < 0 ? (head[p] = head[p] || []) : (at[j] = at[j] || [])).push(line);
      }
      if (useEnh) (enh[p] || '').split(',').forEach(e => { const mt = /^(\w{4})\+(\d+)(?:x(\d+))?$/.exec(e); if (!mt || !cnt[mt[1]] || (rwUp && mt[1] === RW_R)) return;
        const id = mt[1], stone = +mt[2] >= 30 && (+S.ml || 0) >= 90 && (!stoneAt || stoneAt === id), lv = stone ? 30 : Math.min(20, +mt[2]), l0 = lvDone[id] || 0; if (lv <= l0 || (+mt[2] >= 30 && !stone)) return;   // no stone below Map Level 90 (or already used): that item stays as is
        if (stone) { stoneAt = id; lvDone[id] = 30; up.push(`+30 ${ilink(id)} (free +30 stone${+(mt[3] || 1) > 1 ? ', one copy: one stone per run' : ''})`); return; }   // Map Level 90+: the stone costs no Boss Souls; tokens (+21..+25) not in the save -> +20
        lvDone[id] = lv; });   // BOSS SOULS: + levels = the Enhance lines before the bosses (paid by the route's bosses), not farmed
      const have = (((PD.sby || {})[band(n)] || [])[p] || 0) * f, short = spent - have - farmed;
      const sf = ((PD.sf || {})[key] || [])[p], rate = sf ? sf[1] * f : 0;
      if (short >= 1 && !(rate > 0 && short / rate < 2)) {             // under 2 minutes of farming: the next bosses cover it
        const what = up.concat(why).join(', ');
        const spk = sf && +sf[3] > 0 ? sf[3] * f : 0, kn = spk ? Math.ceil(short / spk) : 0;   // PD.sf[3] = Boss Souls per kill at the band's N (older data: no kill count)
        end[p] = `<li class="pl-rp"><b>Boss Souls</b> · ${sf && rate > 0 ? `farm ${srcA(sf[0], bname(sf[0]))}${sf[2] ? ' (' + esc(zname(sf[2])) + ')' : ''}: ${kn ? killF(kn) + ' for ' : '~'}${fmt(Math.round(short))} Boss Souls` : `farm ~${fmt(Math.round(short))} more Boss Souls`}${what ? ', pays for ' + what : ''}</li>`;
        farmed += short;
        if (sf && rate > 0 && sf[2] === 'z10') fire.push('souls');     // TESTER PAGE FIXES: Boss Souls farm at the Flame Lord
      } else if (up.length) end[p] = `<li class="pl-rp"><b>Boss Souls</b> · ${up.join(', ')} <span class="small">(bosses on the way pay for it)</span></li>`;
    }
    /* ---- BOSS SOULS (patch_page_souls 2026-09-25): 'Enhance' lines at Gazlowe right before the Mid / Late required boss steps, every
       gear level. Replay events (PD.rhe + PD.rhT string 12 of this cell's held row: '23@O00G:I03F+9,~A5+7' = before that boss, '20:..'
       = after step 20's farm stop) or, without them, a plan from the Boss Souls income per quest step (route boss kills scaled to PD.sby
       per part) minus the part's and the next part's item prices, 85%-luck costs, greedy by flat stats per Boss Soul. bsPre[i] = lines
       spliced in before route step i (FPL.step); the last part's Boss Souls line goes before the last step (never after the route) */
    const bsPre = {}, bsE = {};                                       // bsE[i] = {ups: {item: level}, c: Boss Souls}: one Enhance line per step
    const bsAddE = (i, ups, c) => { const o = bsE[i] = bsE[i] || { ups: {}, c: 0 }; ups.forEach(([id, lv]) => { o.ups[id] = lv; }); o.c += c; };
    const bsLine = (ups, souls) => `<li class="pl-rp"><b>Enhance</b> · ${ups.map(([id, lv]) => `${tfLink(id)} to +${lv}`).join(', ')} <span class="small">(${srcA('n00G', 'Gazlowe')}${souls >= 1 ? ', ~' + fmt(Math.round(souls)) + ' Boss Souls' : ''})</span></li>`;
    const bsKills = x => [...String(x.do || '').matchAll(/(or kill )?\{\{u:([A-Za-z0-9]{4})\}\}/g)].filter(mm => !mm[1]).map(mm => mm[2]);
    const bsEv = (() => { if (!PD.rhe || L == null || L < 0 || !PD.rh || !PD.rhR || (G.rf && PD.rpf && PD.rpf[n + '|' + m])) return null;
      const e = (PD.rh[n + '|' + m] || {})[h]; if (typeof e !== 'string') return null;
      const w = +PD.rhw || 2, j = e.substr((eqStep(h, n, m).k * NL + L) * w, w); if (!j || j.charAt(0) === '-') return null;
      const R = (PD.rhR || [])[parseInt(j, 36)]; if (typeof R !== 'string') return null;
      const s = R.length >= 12 * w ? (PD.rhT || [])[parseInt(R.substr(11 * w, w), 36)] || '' : '';
      return s.split(';').map(gp => { const mt = /^(\d+)(?:@([A-Za-z0-9]{4}))?:(.+)$/.exec(gp); if (!mt) return null;
        return { st: +mt[1], b: mt[2] || '', ups: mt[3].split(',').map(z => { const x = /^(.+)\+(\d+)$/.exec(z); return x ? [x[1], +x[2]] : null; }).filter(Boolean) }; }).filter(Boolean); })();
    if (bsEv) {                                                       // a) the replay's own enhance events
      const lvE = {};
      bsEv.forEach(ev => { let i = -1; if (rwUp) ev = Object.assign({}, ev, { ups: ev.ups.filter(u => u[0] !== RW_R) }); if (!ev.ups.length) return;
        if (ev.b) { i = steps.findIndex((x, k) => k <= stop && +x.step === ev.st && bsKills(x).includes(ev.b)); if (i < 0) i = steps.findIndex((x, k) => k <= stop && +x.step >= ev.st); }
        else i = steps.findIndex((x, k) => k <= stop && +x.step > ev.st);
        if (i < 0 || i > stop) return;
        let c = 0; ev.ups.forEach(([id, lv]) => { c += enhC(lvE[id] || 0, lv); lvE[id] = lv; }); bsAddE(i, ev.ups, c); });
    } else {                                                          // b) plan from the Boss Souls income per quest step
      const q = ((HERO[h] || {}).main_stat || 'STR').toLowerCase(), B = W.boss || {}, RQ = new Set((PD.rqb || []).map(x => x[0]));
      const bp = []; let c2 = -1; steps.forEach((x, i) => { const o = ZO[x.zone] || 0; c2 = Math.max(c2, o > 18 ? 2 : o > 6 ? 1 : 0); bp[i] = c2; });   // part of every step (route rule)
      const raw = steps.map(x => bsKills(x).reduce((a, b) => { const u = B[b]; return a + (u && +u.souls_base > 0 ? +u.souls_base * (0.8 + 0.2 * n) : 0) + (b === 'H00J' ? 142.5 : b === 'O006' ? 150 : 0); }, 0));
      const sby = (PD.sby || {})[band(n)] || [], RP = [0, 0, 0]; raw.forEach((v, i) => { RP[bp[i]] += v; });
      const inc = []; let cum = 0, cp = [0, 0, 0];                       // inc[i] = Boss Souls earned through step i
      raw.forEach((v, i) => { const p = bp[i]; cp[p] += v;
        if (sby.length === 3) { const b0 = p > 0 ? +sby[p - 1] * f : 0, add = (+sby[p] - (p > 0 ? +sby[p - 1] : 0)) * f;
          const last = steps.findIndex((x, k) => k > i && bp[k] === p) < 0; inc[i] = b0 + (RP[p] > 0 ? add * cp[p] / RP[p] : last ? add : 0); }
        else { cum += v * gsF(n); inc[i] = cum; } });
      const got = {}, nf = {}; if (rwP.i >= 0 && rwP.abs) got[RW_A] = rwP.i;   // MAGIC RING: held from the route line on // got = route step an item's farm line sits at (not held before it)
      if (SCP.fa != null && !(got.I0OR <= SCP.fa)) got.I0OR = SCP.fa;   // GIANT SCYTHE CARRY: held after Frodo's chain line (the Flame Lord)
      Object.keys(at).forEach(j => at[j].forEach(t => { const mm = /#item\/([^"]+)"/.exec(t); if (mm) { const id = decodeURIComponent(mm[1]); got[id] = Math.min(got[id] == null ? 1e9 : got[id], +j); } }));
      const fc = [0, 0, 0]; for (let p = 0, sc = 0; p < 3; p++) { sc += bsIS[p]; fc[p] = Math.max(p ? fc[p - 1] : 0, sby.length === 3 ? sc - +sby[p] * f : 0); }   // Boss Souls farmed for item prices by the end of each part (the farm line)
      const lv = {}; let used = 0;
      for (let i = 1; i <= stop; i++) {
        const p = bp[i]; if (p < 1 || !bsKills(steps[i]).some(b => RQ.has(b))) continue;
        if (!nf[p]) nf[p] = tpFit(h, n, m, L, p);                     // 'may not fit this gear level's farm time': not planned
        const items = [...new Set((g[FPS[p]] || []).concat(g[FPS[p] + '_b'] || []))].filter(id => lvDone[id] !== 30 && !(rwUp && id === RW_R) && !(got[id] >= i) && !nf[p].has(id)).map(id => [id, bsW(id, q)]).filter(x => x[1] > 0);
        let avail = (inc[i - 1] || 0) + fc[p] - bsIS.slice(0, p + 1).reduce((a, x) => a + x, 0) - (p < 2 ? bsIS[p + 1] : 0) - used;
        const ch = {}; let c = 0;
        while (avail > 0 && items.length) { let best = null;
          for (const [id, w] of items) { const l = lv[id] || 0; if (l >= 20) continue; const k = bsC85(l, l + 1); if (k <= avail && (!best || w / k > best[0])) best = [w / k, id, k]; }
          if (!best) break; lv[best[1]] = (lv[best[1]] || 0) + 1; ch[best[1]] = lv[best[1]]; avail -= best[2]; used += best[2]; c += best[2]; }
        if (Object.keys(ch).length) bsAddE(i, Object.entries(ch), c);
      }
    }
    { const lp = po[stop]; if (lp != null && end[lp]) { (bsPre[stop] = bsPre[stop] || []).push(end[lp]); delete end[lp]; } }
    Object.keys(bsE).forEach(i => { (bsPre[i] = bsPre[i] || []).push(bsLine(Object.entries(bsE[i].ups), bsE[i].c)); });   // the last part's Boss Souls line: before the final step
    const any = p => !!head[p] || Object.keys(at).some(j => po[j] === p);
    return {
      head: (li, p, gb) => { if (any(p) || gb) li.push(`<li class="pl-rp pl-gh"><b>${FPN[p]} gear</b>${any(p) ? ' <span class="small">(farm while you pass)</span>' : ''}${gb ? `<div class="pl-gb">${gb}</div>` : ''}${head[p] ? `<ul class="pl-ul">${head[p].join('')}</ul>` : ''}</li>`); },
      step: (li, i) => { if (bsPre[i] && li.length) li.splice(li.length - 1, 0, ...bsPre[i]); if (at[i] && li.length) li[li.length - 1] = li[li.length - 1].replace(/<\/li>$/, `<ul class="pl-ul">${at[i].join('')}</ul></li>`); },
      end: (li, p) => { if (end[p]) { li.push(end[p]); delete end[p]; } }, fire, rw: rwP };
  }
  /* AUDIT minor 4: a boss behind the 4,000-gold boat (PD.boat) listed before the main-quest step that buys the boat says so */
  const BOAT = new Set(PD.boat || []), BOATSTEP = ((((W.qguide || {}).steps) || []).find(x => /Boat \(4,000 gold\)/.test(String(x.do || ''))) || {}).step;
  const BOATTXT = 'buy the boat first (4,000 gold, Goblin Shipyard in Pirate Outpost Ruins, behind the Dragon Turtle Key gate)';
  /* ---- MAGIC RING (patch_page_ring 2026-09-25, user-approved; findings/public/audit_math/magic_ring.md). Magic Ring I03L + 5 Wraith Souls
     I051 -> Absolute Ring I050 on any item pickup, a fresh +0 ring. The
     Ringwraith returns 30 s after a kill, STR / INT x1.5 each time. rwPlan -> {i: route index of the 'Absolute Ring' line
     or -1, abs: the build has the Absolute Ring}: the latest of the chain step (pqChain), the Ringwraith's first open step (fsOf), the
     hero's Ringwraith beat row (bossAt0) and the first part where PD.fw has an Absolute Ring route (acq ring_route: all 5 kills x1.5,
     median hero: N1-3 Late, N4+ Mid). rwMin = its minutes for pqMins */
  const RW_B = 'H00M', RW_R = 'I03L', RW_A = 'I050', RW_S = 'I051', RWC = new Map();
  const rwTxt = () => `Sail to Ringwraith Island (boat), kill the ${srcA(RW_B, 'Ringwraith')} 5 times, keep the 5 <a href="#item/${RW_S}">${K.icon(RW_S)}Wraith Souls</a> with the ${ilink(RW_R)}: it becomes the ${ilink(RW_A)} when you pick up any item.`;
  const rwPlan = (h, n, m, L, steps, stop) => { const hi = HIDX[h]; if (!FW || hi == null || !steps || !steps.length) return { i: -1, abs: false };
    const k = eqStep(h, n, m).k, ck = [h, n, m, L, stop, steps.length, k, +G.gl || 0, G.rf ? 1 : 0, +S.ml || 1].join('|'); if (RWC.has(ck)) return RWC.get(ck);
    const T = FW.k[MK[m] + '|' + band(n)] || {}, g = gearOf(h, n, m, L == null || L < 0 ? 3 : L);
    const abs = [0, 1, 2].some(p => (g[FPS[p]] || []).concat(g[FPS[p] + '_b'] || []).includes(RW_A)), r = { i: -1, abs };
    const c = pqChain(n, m, hi, k, true), s1 = c >= 0 ? bossAt0(RW_B, n, m, hi, k) : -1, aw = T[RW_A] || [], p0 = [0, 1, 2].find(p => aw[p] != null && aw[p] >= 0);
    if (c >= 0 && s1 >= 0 && p0 != null) {
      const at = s => { const j = steps.findIndex(x => +x.step >= s); return j < 0 ? steps.length - 1 : j; };
      const po = []; let cm = -1; steps.forEach((x, j) => { const o = ZO[x.zone] || 0; cm = Math.max(cm, o > 18 ? 2 : o > 6 ? 1 : 0); po[j] = cm; });
      const fs = fsOf(RW_B, n), pi = po.findIndex(p => p >= p0);
      if (pi >= 0) { const i = Math.max(at(c), at(fs == null ? 0 : Math.max(0, fs - 1)), at(s1), pi); if (i <= stop) r.i = i; } }
    RWC.set(ck, r); return r; };
  const rwMin = (h, n, m, L, stopStep) => { const steps = (((W.qguide || {}).steps) || []).filter(x => +x.step <= 20 + n); let si = -1;
    steps.forEach((x, j) => { if (+x.step <= stopStep) si = j; }); if (si < 0) return 0;
    const R = rwPlan(h, n, m, L, steps, si); if (R.i < 0) return 0;
    const o = ZO[steps[R.i].zone] || 0, p = Math.max(...steps.slice(0, R.i + 1).map(x => { const z = ZO[x.zone] || 0; return z > 18 ? 2 : z > 6 ? 1 : 0; }), o > 18 ? 2 : o > 6 ? 1 : 0);
    const T = FW.k[MK[m] + '|' + band(n)] || {}, wa = (T[RW_A] || [])[p], wr = (T[RW_R] || [])[p];
    const a = wa != null && wa >= 0 ? +FW.t[wa][7] || 0 : 0, b = wr != null && wr >= 0 ? +FW.t[wr][7] || 0 : 0, mn = a > b && b > 0 ? Math.min(15, Math.max(2, a - b)) : 3;
    return mn * (R.abs && pqRepH(h, n, m, L) ? Math.max(0, 1 - pqFr(n, m, stopStep)) : 1); };
  /* ---- TESTER PAGE FIXES (patch_tester_page 2026-09-25; tester feedback findings/public/audit_math/tester_feedback_0925.md, user-approved,
     no re-simulation). Per run part under its gear line: pet bag, rune, universal skills (tpPart); once per route: the hero page's skill
     priority line (tpSkill, heroes.js K.hxOrder); Frodo's hidden Boss Hunt at step 7 when the route needs the Firelands (tpHunt); the gear
     the replay really held (tpKeep: PD.rh skipped items, PD.unr unreachable placed drops) or, without replay data, a 'may not fit' note
     (tpFit). Map 1.02: Player Bonus, Beginner Bonus, Boss Hunt, books from hero level 35 / 100. */
  const TP_RANKID = ['I0XJ', 'I0XK', 'I0XL', 'I0XM', 'I0XN', 'I0XO', 'I0XP', 'I0XQ', 'I0XR', 'I0XS', 'I0XT', 'I0XU', 'I0XV', 'I0XW', 'I0XX', 'I20U'];
  const TP_GIFTS = ['I022', 'I08L', 'I09I', 'I0DZ'].concat(TP_RANKID);
  /* your free pet items: the Player Bonus gift by Map Level, the Ranking Reward (Map Level 30+, RANKR rows), Bug Hunter at Map Level 110+ */
  const tpGifts = ml => { const o = [ml <= 15 ? 'I022' : ml <= 30 ? 'I08L' : ml <= 45 ? 'I09I' : 'I0DZ'], rk = RANKR.filter(r => ml >= r[0]).length;
    if (rk) o.push(TP_RANKID[rk - 1]); if (ml >= 110 && !o.includes('I08L')) o.push('I08L'); return o; };
  const tpBeg = n => n <= 1 ? 'Level-1 artifact' : n <= 5 ? `Level-${n} item` : n <= 7 ? 'Level-6 item' : 'Level-7 item';   // Beginner Bonus by N
  /* PD.rh[N|m][hero][account step][gear level] = what that replay held: x = per part [[skipped item, copies held]], p = pet bag per part,
     r = [rune, level], b = books (planner_pack TESTER). Not for the rare-drop farmer rows */
  const rhOf = (h, n, m, L) => { if (L == null || L < 0 || !PD.rh || (G.rf && PD.rpf && PD.rpf[n + '|' + m])) return null;
    const e = (PD.rh[n + '|' + m] || {})[h], k = eqStep(h, n, m).k;
    if (typeof e === 'string') { const w = +PD.rhw || 2, j = e.substr((k * NL + L) * w, w); return j && j.charAt(0) !== '-' ? rhRow(parseInt(j, 36)) : null; }   // TIGHT / HELD: compact rows
    const r = (e || {})[k]; return (r && r[L]) || null; };
  const tpLi = (h, n, m, L, i) => { const pl = (((PD.rpl || {})[n + '|' + m] || {})[h] || {})[eqStep(h, n, m).k], p = pl && Array.isArray(pl[L]) ? pl[L] : null;
    return p && p[1 + i] != null && +p[1 + i] >= 0 ? +p[1 + i] : L; };   // the level whose lists that part farmed (as gearOf)
  const tpKeep = (h, n, m, L, i, list, bk) => { let out = list; const un = (PD.unr || {})[bk] || {};
    out = out.filter(id => !(un[id] || []).includes(i));             // only route in this part = a placed drop nobody can walk to
    const r = rhOf(h, n, m, L), x = r && r.x && r.x[i];
    if (x && x.length) { const keep = {}, seen = {}; x.forEach(([id, c]) => { keep[id] = +c || 0; });
      out = out.filter(id => { if (!(id in keep)) return true; seen[id] = (seen[id] || 0) + 1; return seen[id] <= keep[id]; }); }
    { const ex = r && r.e && r.e[i]; if (ex && ex.length) out = out.concat(ex); }   // TIGHT / HELD: what the replay held beyond the list ('~' random start items)
    return out; };
  /* no replay data for this cell: farm items past the replay's farming budget (sim_account BUDGET x mode x gear level, cumulative, fw
     minutes in list order). An approximation of run_sim farm_stop (no gold / Boss Souls farming minutes): it flags fewer items than a replay skips */
  const TP_BUD = [20, 60, 120], TP_BM = { m: 1, c: 1.5, d: 3 }, TP_FK = new Set(['b', 'm', 'h', 'q', 'e']);
  const tpFit = (h, n, m, L, i) => { const out = new Set(); if (!FW || L == null || L < 0 || rhOf(h, n, m, L)) return out;
    const T = FW.k[MK[m] + '|' + band(n)] || {}, g = gearOf(h, n, m, L), kept = {}; let used = 0;
    for (let p = 0; p <= i; p++) { const cap = TP_BUD[p] * TP_BM[m] * (+LVL[L] || 1), cnt = {};
      (g[FPS[p]] || []).forEach(id => { cnt[id] = (cnt[id] || 0) + 1; });
      for (const id of Object.keys(cnt)) { const nw = cnt[id] - (kept[id] || 0); kept[id] = Math.max(kept[id] || 0, cnt[id]); if (nw <= 0) continue;
        const wi = (T[id] || [])[p], w = wi != null && wi >= 0 ? FW.t[wi] : null; if (!w || !(TP_FK.has(w[0]) || (w[0] === 'c' && !+w[5] && !+w[6]))) continue;   // crafts count only when they cost no gold / souls (farmed parts)
        const mn = scFitMin(h, n, m, L, id, w, nw); if (used + mn > cap) { if (p === i) out.add(id); } else used += mn; } }
    return out; };
  const tpFitTxt = (h, n, m, L, i) => { const f = tpFit(h, n, m, L, i); return f.size ? ` <span class="small">· may not fit this gear level's farm time: ${[...f].map(ilink).join(', ')}</span>` : ''; };
  const andJ = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : (a[0] || '');
  const tpSrc = id => { const s = (((K.item || {})[id] || {}).sources || [])[0]; if (!s) return ''; const f = s.from || {}, ch = s.chance != null && isFinite(+s.chance) ? pctF(+s.chance) : '';
    if (s.kind === 'drop') return `${srcA(f.id, f.name)} drop${ch ? ', ' + ch + ' per kill' : ''}`;
    if (s.kind === 'quest') return `quest ${esc(String(s.note || '').split(',')[0])}${ch ? ', ' + ch : ''}`;
    return ''; };
  const tpTrainer = id => { const s = ((((K.item || {})[id] || {}).sources) || []).find(x => x.kind === 'free' && x.from && x.from.id); if (!s) return 'a Universal Skill Trainer';
    const z = (W.unit_zone || {})[s.from.id]; return srcA(s.from.id, s.from.name || 'Universal Skill Trainer') + (z ? ' in ' + esc(zname(z)) : ''); };
  /* one run part's extra lines (under its gear line): pet bag, rune, universal skills. TPS = what earlier parts already said */
  const tpPart = (h, n, m, L, p, TPS) => { const st = FPS[p], gk = band(n) + '|' + MK[m], bk = MK[m] + '|' + band(n), ml = +S.ml || 1, r = rhOf(h, n, m, L), out = [];
    const gifts = tpGifts(ml); let picks;
    if (r && Array.isArray(r.p) && Array.isArray(r.p[p])) picks = r.p[p].slice(1);   // the replay's pet bag at the end of this part, minus its own Map Level gift
    else { const li = L == null || L < 0 ? null : tpLi(h, n, m, L, p), row = li != null ? ((((PD.bbp || {})[bk] || {})[h] || [])[li] || null) : null;
      picks = row ? (row[p] || []).slice() : (((((W.best_items || {})[h] || {})[gk] || {})[st + '_pet']) || []).map(x => x[0]);
      ((PD.pgf || {})[bk] || TP_GIFTS).forEach(g => { const j = picks.indexOf(g); if (j >= 0) picks.splice(j, 1); }); }   // the reference account's free items out
    const all = gifts.concat(picks).slice(0, 6), c = {}; all.forEach(x => { c[x] = (c[x] || 0) + 1; });
    let pet = Object.keys(c).map(x => ilink(x) + (c[x] > 1 ? ' x' + c[x] : '') + (gifts.includes(x) ? ' <span class="small">free</span>' : '')).join(', ');
    if (all.length < 6 && !r) pet += ` <span class="small">· ${6 - all.length} free slot${6 - all.length > 1 ? 's' : ''}: ${ilink('I022')} (7,600 gold each) when gold is spare</span>`;
    const ex = p === 0 ? [ml >= 23 ? 'one random Level-7 item (Player Bonus, Map Level 23+)' : '', ml <= 30 ? `one random ${tpBeg(n)} (Beginner Bonus)` : ''].filter(Boolean) : [];
    if (pet !== TPS.pet || ex.length) out.push(`<b>Pet bag</b> ${pet}${ex.length ? ` <span class="small">· also free at the start: ${andJ(ex)}</span>` : ''}`);
    TPS.pet = pet;
    const ad = (((((W.addons || {})[h] || {})[gk]) || {})[st]) || [], rn = ad[0];
    if (rn && rn !== TPS.rune) { TPS.rune = rn; const s2 = tpSrc(rn);
      out.push(`<b>Rune</b> ${ilink(rn)}${s2 ? ` <span class="small">(${s2})</span>` : ''}${r && r.r && !r.r[0] ? ' <span class="small">· the replayed run never got a rune: a bonus if it drops</span>' : ''}`); }
    const lv = ((((PD.bkl || {})[bk] || {})[h] || [])[p]) || null;
    [1, 2].forEach(sl => { const b = ad[sl]; if (!b) return; const l = lv ? +lv[sl - 1] || 0 : 1, k = 'b' + sl, prev = TPS[k] || 0; if (l <= prev) return; TPS[k] = l;
      let t = prev ? `${ilink(b)} to Lv ${l}` : `learn ${ilink(b)} at hero level ${sl === 1 ? 35 : 100} <span class="small">(free at ${tpTrainer(b)})</span>${l > 1 ? ', Lv ' + l : ''}`;
      if (l > 1) t += ` <span class="small">(${sl === 1 ? `${ilink('I02I')} from Anduin's Ancient Snow Beast quest, 4 per clear` : "the Orc Warlord's Water Supplies quest, 1 level per clear"})</span>`;
      if (!prev && r && Array.isArray(r.b) && r.b[sl - 1] === null) t += ` <span class="small">· the replayed run never got to hero level ${sl === 1 ? 35 : 100}</span>`;
      out.push(`<b>Universal skill</b> ${t}`); });
    return out.map(x => `<div class="small">${x}</div>`).join(''); };
  const tpSkill = (h, n, m) => { const H = HERO[h]; if (!H || typeof K.hxOrder !== 'function') return '';
    const x = K.hxOrder(H, band(n) + '|' + MK[m]); return x ? `<p class="small">${x.replace('</b><span>', '</b> · <span>')}</p>` : ''; };
  /* Frodo's hidden Boss Hunt at route step 7: the full block when the route needs the Firelands, else one optional line */
  const TP_HUNT = ['O000', 'H007', 'H008', 'H009', 'H00A', 'O001', 'H00B'];
  /* crafts that need a Boss Hunt item (Magic Ring I03L, Firelands Transfer Scroll I03C) somewhere in their parts (Absolute Ring...):
     W.recipes closure, used only when the farm plan crafts the item (fw kind c) */
  let TP_FI = null;
  const tpFireI = () => { if (TP_FI) return TP_FI; TP_FI = new Set(['I03L', 'I03C']); let more = true;
    while (more) { more = false; for (const r of (W.recipes || [])) { const o = (r.result || {}).id;
      if (o && !TP_FI.has(o) && (r.parts || []).some(x => x && TP_FI.has(x.id))) { TP_FI.add(o); more = true; } } }
    return TP_FI; };
  const tpHunt =(li, steps, stop, need, FPL) => { const why = [], add = x => { if (x && !why.includes(x)) why.push(x); };
    need.forEach(b => { if (b.id && bzone(b.id) === 'z10') add(esc(bname(b.id))); else if (b.fire) add(ilink(String(b.fire).split('*')[0])); });   // PREREQ GATES: bag items through the Firelands
    ((FPL && FPL.fire) || []).forEach(id => add(id === 'souls' ? 'the Boss Souls farm at the Flame Lord' : ilink(id)));
    if (!why.length) { li.push(`<li class="pl-rp"><span class="small">Optional: Frodo's hidden Boss Hunt gives every player a ${ilink('I03L')} (7 bosses in a fixed order, then the Flame Lord in the Firelands). Nothing on this run needs it.</span></li>`); return; }
    const on = b => steps.findIndex((x, i) => i <= stop && String(x.do || '').includes('{{u:' + b + '}}'));
    const opt = (i, b) => String(steps[i].do || '').includes('or kill {{u:' + b + '}}');
    const pre = [], early = [], opts = [], extra = [];
    TP_HUNT.forEach((b, j) => { const i = on(b), nm = esc(bname(b));
      if (i < 0) { extra.push(`${nm} (${esc(zname(bzone(b)))})`); return; }
      const s = +steps[i].step;
      if (s < 7) { pre.push(opt(i, b) ? `a ${nm} kill at step ${s}` : `your step ${s} ${nm} kill`); return; }
      const inOrder = TP_HUNT.slice(0, j).every(pb => { const pi = on(pb); return pi >= 0 && +steps[pi].step > 7 && +steps[pi].step < s && !opt(pi, pb); });
      if (opt(i, b)) opts.push(`${nm} (step ${s})`);
      else if (!inOrder) early.push(`your step ${s} ${nm} kill comes too early: kill it again after the ${esc(bname(TP_HUNT[j - 1]))}`); });
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1), notes = [];
    if (pre.length) notes.push(cap(andJ(pre)) + ' does not count');
    early.forEach(t => notes.push(cap(t)));
    if (opts.length) notes.push(`${andJ(opts)} count${opts.length > 1 ? '' : 's'} only if you pick the boss option once the bosses before ${opts.length > 1 ? 'them' : 'it'} are dead`);
    if (extra.length) notes.push(`${andJ(extra)} ${extra.length > 1 ? 'are' : 'is'} not on your route`);
    li.push(`<li class="pl-rb pl-n"><b>Frodo's Boss Hunt</b> · opens the Firelands, needed for ${andJ(why)}`
      + `<div class="small">Kill in this order from now on: ${TP_HUNT.map(b => esc(bname(b))).join(' › ')}. Kills before this step or out of order do not count, each boss comes back 90 s after a kill.`
      + `${notes.length ? ' ' + notes.join('. ') + '.' : ''} Then back to Frodo for the <a href="#item/I03C">${K.icon('I03C')}Firelands Transfer Scroll</a>, kill the Flame Lord in the Firelands and go back to Frodo: ${ilink('I03L')} for every player.</div></li>`); };
  function routeHtml(h, n, m, bosses, stopStep, L) {                // CARDS UI: an open numbered list (quest steps + boss / upgrade steps numbered)
    const steps = (((W.qguide || {}).steps) || []).filter(x => +x.step <= 20 + n);
    const need = bosses.filter(b => b && (b.id || b.txt)).map(b => Object.assign({}, b, { zo: b.id ? ZO[bzone(b.id)] : undefined }));   // txt = a pick without a boss (bossless)
    let stop = stopStep ? steps.length - 1 : 0;
    need.forEach(b => { const fs = fsOf(b.id, n), sl = b.st != null ? +b.st : fs == null ? 20 + n : Math.max(0, fs - 1), i = steps.findIndex(x => +x.step >= sl);   // AUDIT minor 4: right after the step bossAt / the run's time and items stop at
      b.at = i < 0 ? steps.length - 1 : i; stop = Math.max(stop, b.at); });   // v52 (M4): the same step the run's time and items use
    need.forEach(b => { if (b.last) b.at = stop; }); need.sort((a, b) => (a.last || 0) - (b.last || 0));   // ARMOR FRAGMENT SET: town-unit kills, then the upgrade, last
    const PQX = { seen: new Set(), n, m, h, steps, stop };            // PREREQ GATES: each step before a goal once per route
    TGR = tgRoute(h, n, m, L);                                      // TIGHT: chips on the boss steps
    const FPL = farmPlan(h, n, m, L, steps, stop);                  // FARM PLAN (null without PD.fw: the build line alone)
    const SCR = FPL ? SC_LAST : null; if (SCR && SCR.fl && !FPL.fire.includes('I0OR')) FPL.fire.push('I0OR');   // GIANT SCYTHE CARRY
    const li = [], TPS = {}; let cur = -1;                            // TPS: what the part lines already said (TESTER PAGE FIXES)
    steps.slice(0, stop + 1).forEach((x, i) => {
      const o = ZO[x.zone] || 0, pi = o > 18 ? 2 : o > 6 ? 1 : 0;
      if (pi > cur) { if (FPL && cur >= 0) FPL.end(li, cur); cur = pi; const gb = buildRow(h, n, m, L, pi) + tpPart(h, n, m, L, pi, TPS);   // each part opens with its full build
        if (FPL) FPL.head(li, pi, gb); else if (gb) li.push(`<li class="pl-rp pl-gh"><b>${['Early', 'Mid', 'Late'][pi]} gear</b> <span class="small">(farm while you pass)</span><div class="pl-gb">${gb}</div></li>`); }
      const dT = (+S.ml || 1) > 30 ? String(x.do).replace(' and {{i:I0Y0}} (one random item, Map Level 30 or lower)', '') : x.do;   // Beginner Bonus only up to Map Level 30
      li.push(`<li class="pl-n"><span class="small">${esc(zname(x.zone))}</span> · ${K.tok ? K.tok(dT) : tmpl(dT)}${TGR.step(x.do)}</li>`);
      if (FPL) FPL.step(li, i);
      pqHuntAt(li, i, PQX, need, FPL);                                // PREREQ GATES: Frodo's quest chain line (before this step's goal lines)
      if (SCR && SCR.fc && PQX.hunt && PQX.hunt.at === i && PQX.hunt.why.length) li.push(SCR.fire());   // GIANT SCYTHE CARRY: the Flame Lord kill
      need.filter(b => b.at === i).forEach(b => li.push(...pqPre(b, PQX), `<li class="pl-rb pl-n"><b>${esc(b.label)}</b> · ${b.id ? esc(bname(b.id)) : esc(b.txt)}${b.zo !== undefined && bzone(b.id) !== x.zone ? ' <span class="small">(' + esc(zname(bzone(b.id))) + ')</span>' : ''}${b.note ? ' <span class="small">· ' + esc(b.note) + '</span>' : ''}${b.id && (PD.bnote || {})[b.id] ? ' <span class="small">· ' + esc(PD.bnote[b.id]) + '</span>' : ''}${b.id && BOAT.has(b.id) && BOATSTEP != null && +x.step < +BOATSTEP ? ' <span class="small">· ' + BOATTXT + '</span>' : ''}${b.warn ? ' <span class="small warntext">' + esc(b.warn) + '</span>' : ''}${b.id ? TGR.chip(b.id) : ''}</li>`));
    });
    if (FPL && cur >= 0) FPL.end(li, cur);
    li.push(`<li class="pl-rp pl-stop"><b>Stop here</b> <span class="small">(${stop + 1 >= steps.length ? 'run finished' : 'the rest of the run gives you nothing you planned'})</span></li>`);
    return `<h4 class="pl-rt">Route <span class="small">${stop + 1} quest step${stop ? 's' : ''}</span></h4>${tpSkill(h, n, m)}<ol class="pl-steps">${li.join('')}</ol>`;   // AUDIT minor 3: main-quest steps only
  }
  /* ---- Jarvan V farm (v52, map 1.02): after the main quest every Jarvan V kill pays 5 Points (no cap, no N / mode scaling), G.S.D pays 0,
     both come back 10 s after BOTH are dead, ~8 s walk apart. PD.jv[band|mode][hero index] = per account step 4 chars: Jarvan V and G.S.D
     kill seconds x 2 (base 36, 'zz' = the hero cannot kill him or dies; planner_data.py, late build, fixed unit stats on every N) */
  const SESS = 180, AFKH = 8, JVP = 5, JV_GAP = 8 + 10;   // session minutes, AFK Points per hour, Points per Jarvan kill, walk + revive (s)
  const jvT = (h, n, m, k) => { const s = (((PD.jv || {})[band(n) + '|' + MK[m]]) || [])[HIDX[h]]; if (!s || k < 0 || s.length < 4 * (k + 1)) return null;
    const d = j => { const c = s.substr(4 * k + 2 * j, 2); return c === 'zz' ? null : (B36.indexOf(c[0]) * 36 + B36.indexOf(c[1])) / 2; };
    const tj = d(0), tg = d(1); return tj == null || tg == null ? null : tj + tg; };
  /* Points per hour of the Jarvan V farm for this hero and account (between two ladder steps: blended like the run times); null = cannot */
  const jvRate = (h, n, m, e) => { const t = jvT(h, n, m, e.k); if (t == null) return null; const t2 = e.f ? jvT(h, n, m, e.k + 1) : null;
    return 3600 / ((t2 == null ? t : t + e.f * (t2 - t)) + JV_GAP) * jvPer(); };
  const jvPer = () => vipPts(JVP);   // VIP: 5 x (1 + 0.3 L) rounded down
  /* Points of a 3-hour session: the run (stage boss + AFK), then the Jarvan V farm for the rest; a longer run = its own rate x 3 h */
  const sessPts = (pay, mins, jv) => mins >= SESS ? (pay + mins / 60 * AFKH) * SESS / mins : pay + SESS / 60 * AFKH + (jv ? jv * (SESS - mins) / 60 : 0);
  /* Legacy goals: Points you can pick up on the side when the run finishes the main quest (never changes their ranking) */
  const sideTxt = r => { if (!r.fin) return ''; const i = HIDX[r.h], e = eqStep(r.h, r.n, r.m), jv = jvRate(r.h, r.n, r.m, e), x = [];
    if (jv) x.push(`farm Jarvan V after the quest: ${jvPer()} Points per kill (back 10 s after he and G.S.D both die)`);
    if (bossAt('O007', r.n, r.m, i, e.k) >= 0 && !(r.got || []).concat(r.ugot || []).some(g => Array.isArray(g) ? g[2] === 'O007' : !!(g.a && g.a[0] && g.a[0].includes('O007')))) x.push('Shadow Monster +' + vipPts(10));   // AUDIT minor 5: killed for a pick before the quest ends = no Points, never respawns
    return x.length ? `<p class="small">+ side: ${x.join(' · ')}</p>` : ''; };
  /* ---- Legacy goal: every run (N x mode x hero) that upgrades the most of your items (ON THE WAY: same slot type allowed). v53 conflicts: an upgrade a run
     can do but whose slot type (or Points) another pick of that run holds counts as doable, boss or not (not picked in that run) */
  function legacyRuns() {
    const ups = [];
    for (const [line, sid] of Object.entries(S.own)) for (const [to, text, alts] of (PD.edges[sid] || [])) ups.push({ line, slot: (POS[sid] || {}).slot, from: sid, to, text, alts, nb: alts.some(a => a[0].length) ? null : NBX[sid + '>' + to] || null });
    if (!ups.length) return { ups, runs: [], stuck: [] };
    const keys = new Set();
    const fitsN = (a, n) => !a[1] || (a[4] === '>' ? n >= a[1] : n === a[1]);
    ups.forEach(u => u.alts.forEach(a => { const ns = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => fitsN(a, n)), ms = a[2] ? [a[2]] : ['m', 'c', 'd']; ns.forEach(n => ms.forEach(m => keys.add(n + '|' + m))); }));
    const runs = [], can = new Set(), canU = new Set();
    for (const key of keys) {
      const [ns, m] = key.split('|'), n = +ns;
      PD.heroes.forEach((h, i) => {
        if (!unlocked(h) || (LSKIP && LSKIP(h, n, m))) return;   // GEAR LEVEL IN THE CARD
        const e = eqStep(h, n, m), lv = e.k, slots = {}, c = cellOf(n, m, i, lv), rmax = c ? Math.max(...c.reach) : -1;
        const bud = { pts: +S.pts || 0, wp: +S.wp || 0 };              // bossless: Points / World Points the picks may spend (Legacy only)
        /* ON THE WAY (patch_on_the_way 2026-09-25, user decision): several upgrades of the same slot type in one run (Bag swaps are free,
           bagPlan writes the swap between the fights). Two picks clash only when they need the Bag at the same moment: the same item line, a
           kill-chance pick of that slot type (it rides in the Bag all run), the same boss kill, the same arena / trade / quest step. Combines
           and +20 stones (nbx b / e) happen on the hero or pet and never clash. slots = picks keyed from>to */
        const kdU = u => u.nb ? u.nb[0] : 'B', inBag = k => k !== 'b' && k !== 'e';
        const hard = (u, ch) => Object.values(slots).some(p => p.u.slot === u.slot && ((p.u.line === u.line && !ch) || (inBag(kdU(u)) && inBag(kdU(p.u)) && (kdU(p.u) === 'k' || kdU(u) === 'k'))));
        const clash = (u, a, at, ch) => hard(u, ch) || Object.values(slots).some(p => p.u.slot === u.slot && p.u.line !== u.line && inBag(kdU(u)) && inBag(kdU(p.u))
          && ((((p.a || [])[0]) || []).some(b => (a[0] || []).includes(b)) || (kdU(u) !== 'B' && kdU(p.u) === kdU(u) && Math.max(0, ...p.at) === at)));
        for (const u of ups) {
          const key = u.from + '>' + u.to;
          if (can.has(key) && hard(u)) continue;   // conflicts: a clashing upgrade still counts as doable (checked once)
          for (const a of u.alts) {                 // v52: the beat row of THIS N (any-N upgrades too), at the stage the run fights the boss in
            if (!a[0].length || !fitsN(a, n) || (a[2] && a[2] !== m) || !hasBit(a[3], i)) continue;
            const at = a[0].map(b => bossAt(b, n, m, i, lv));
            const pp = pqPts(a[0]); if (pp > (+S.pts || 0)) continue;   // PREREQ GATES: the Shadow Lord ticket takes 1,000 Points: offered only with them
            if (at.every(x => x >= 0 && x <= rmax)) { can.add(key); if (!slots[key] && !clash(u, a, Math.max(...at)) && pp <= bud.pts) { slots[key] = pp ? { u, a, at, pq: pp } : { u, a, at }; bud.pts -= pp; } break; }   // conflicts: doable even when a clash keeps it out
          }
          if (u.nb && !slots[key]) for (const a of u.alts) {   // bossless: Survival / bag items / Death Enhancer / kills / Elf Sister
            if (a[0].length || !fitsN(a, n) || (a[2] && a[2] !== m) || !hasBit(a[3], i)) continue;
            const p = hard(u) ? null : nbPlan(u, a, n, m, i, lv, rmax, bud), fr = !!p && !clash(u, a, p.at);   // within what this run's other picks left
            if (!fr && !can.has(key) && !(p || nbPlan(u, a, n, m, i, lv, rmax, { pts: +S.pts || 0, wp: +S.wp || 0 }))) continue;
            can.add(key);                          // doable (the 'not doable yet' list), even when a clash / the Points keep it out
            if (fr) { slots[key] = { u, a, at: [p.at], nb: p }; bud.pts -= p.pts || 0; bud.wp -= p.wp || 0; }
            break;
          }
        }
        /* UNTESTED (patch_dawn_armorset): an upgrade without a boss whose chain passes only with a fight skipped (route flag u) is picked when
           no clash keeps it out. RANK RULE: it sits in r.ugot, never in r.got, so it never counts toward the run's upgrades (the run sort
           counts r.got) and only adds its minutes: it can never lift a run above a fully doable one */
        for (const u of ups) { if (!u.nb) continue; const key = u.from + '>' + u.to;
          for (const a of u.alts) { if (a[0].length || !fitsN(a, n) || (a[2] && a[2] !== m) || !hasBit(a[3], i)) continue;
            const free = !slots[key] && !hard(u), p = nbPlan(u, a, n, m, i, lv, rmax, free ? bud : { pts: +S.pts || 0, wp: +S.wp || 0 }, true);
            if (!p || !p.unv) continue;
            canU.add(key);
            if (free && !clash(u, a, p.at)) { slots[key] = { u, a, at: [p.at], nb: p }; bud.pts -= p.pts || 0; bud.wp -= p.wp || 0; }
            break; } }
        /* ON THE WAY: CHAINED picks. A boss pick's new item keeps evolving on the same run: its next step whose boss this run beats later
           (bossAt at or after the pick's fight, a different boss, not a repeat-kill chance) is a pick too (u.ch, same line and slot type;
           bagPlan swaps it in for that fight). They count in got / rkV; chance steps stay a bonus ('Also on the way') */
        Object.values(slots).forEach(p0 => { let p = p0;
          for (let g = 0; g < 8 && p && !p.nb; g++) { const s0 = Math.max(0, ...p.at), fb = p.a[0]; let q = null;
            for (const [to, text, alts] of (PD.edges[p.u.to] || [])) { for (const a of alts) {
                if (!a[0].length || +a[5] > 1 || !fitsN(a, n) || (a[2] && a[2] !== m) || !hasBit(a[3], i) || a[0].some(b => fb.includes(b))) continue;
                const at = a[0].map(b => bossAt(b, n, m, i, lv)), u = { line: p.u.line, slot: p.u.slot, from: p.u.to, to, text, alts, nb: null, ch: 1 };
                if (at.every(x => x >= s0 && x <= rmax) && !slots[u.from + '>' + to] && !clash(u, a, Math.max(...at), true) && !pqPts(a[0])) { q = { u, a, at }; break; } }
              if (q) break; }
            if (q) slots[q.u.from + '>' + q.u.to] = q; p = q; } });
        let all = Object.values(slots); if (!all.length) return;   // ON THE WAY: no 6-pick cap (picks swap in and out of the Bag)
        /* LEGACY BAG (patch_legacy_bag): the run plays on its WEAKEST Bag (a swap before an upgrade fight); weaker than your best 6 = the
           picks are re-checked on that account step (dropped when they no longer pass), the ranking itself is unchanged */
        let bg = bagPlan(h, n, m, all), eB = e, lvB = lv, cB = c;
        if (bg.e && bg.e.s < e.s - 1e-9) { eB = bg.e; lvB = eB.k;
          if (lvB !== lv) { cB = cellOf(n, m, i, lvB); const rmB = cB ? Math.max(...cB.reach) : -1, b2 = { pts: (+S.pts || 0) - all.reduce((t, g) => t + (+g.pq || 0), 0), wp: +S.wp || 0 };
            all = all.map(g => { if (!g.nb) { const at = g.a[0].map(b => bossAt(b, n, m, i, lvB)); return at.every(x => x >= 0 && x <= rmB) ? Object.assign({}, g, { at }) : null; }
              const p = nbPlan(g.u, g.a, n, m, i, lvB, rmB, b2, !!g.nb.unv); if (!p || !!p.unv !== !!g.nb.unv) return null;
              b2.pts -= p.pts || 0; b2.wp -= p.wp || 0; return Object.assign({}, g, { at: [p.at], nb: p }); }).filter(Boolean);
            if (!cB || !all.length) return; bg = bagPlan(h, n, m, all); } }
        for (let k = 0; k < 8; k++) { const a2 = all.filter(g => !g.u.ch || all.some(x => x.u.to === g.u.from)); if (a2.length === all.length) break; all = a2; }   // ON THE WAY: chained picks need their first step
        const got = all.filter(g => !(g.nb && g.nb.unv)), ugot = all.filter(g => g.nb && g.nb.unv);
        const stop = Math.max(0, ...all.flatMap(g => g.at)), L = lvlFor(cB, stop); if (L < 0) return;
        runs.push({ h, n, m, lv: lvB, got, ugot, bag: bg, fin: cB.jl >= 0, near: nearFin(n, m, i, eB), sc: score(h, n, m), stop, L, mins: nbMins(all, tMix(cB, L, stop, n, m, i, eB), n, stop, m, i) });   // AUDIT B2 / M3: boss kills + kills per chance roll
      });
    }
    runs.forEach(fgPost); runs.forEach(chPost);                                              // FARM GOALS: chance steps farmed on = upgrades, their minutes in the run length
    const EASE = { m: 0, c: 1, d: 2 };
    runs.sort((a, b) => rkV(b) - rkV(a) || a.mins - b.mins || a.n - b.n || EASE[a.m] - EASE[b.m] || b.sc - a.sc);   // items minus length class (user 2026-09-25)
    const cp = capRuns(runs.filter(fOK), r => r.mins), pool = cp.runs;   // CARDS UI: hero / N / mode filters, then the length cap (nothing fits: shortest first)
    /* one option per set of upgrades (its easiest difficulty + mode, best hero first), with the other heroes that can do the same run */
    const groups = new Map();
    for (const r of pool) { const k = r.got.map(g => g.u.to).concat((r.ugot || []).map(g => g.u.to + '?')).sort().join(','); const g = groups.get(k);
      if (!g) groups.set(k, Object.assign({}, r, { others: [] }));
      else if (g.n === r.n && g.m === r.m && g.others.length < 5) g.others.push(r.h); }
    const best = [];                                  /* skip an option whose upgrades are all inside a better one */
    for (const g of groups.values()) { const set = g.got.concat(g.ugot || []).map(x => x.u.to);
      if (best.some(b => set.every(t => b.got.concat(b.ugot || []).some(x => x.u.to === t)))) continue; best.push(g); if (best.length >= CARDN) break; }
    for (const g of groups.values())                 /* UNTESTED: one that no option above holds still gets its best run, listed after them */
      if (!best.includes(g) && (g.ugot || []).some(x => !best.some(b => b.got.concat(b.ugot || []).some(y => y.u.to === x.u.to)))) best.push(Object.assign(g, { ux: 1 }));
    const noboss = ups.filter(u => !u.alts.some(a => a[0].length) && !can.has(u.from + '>' + u.to) && !canU.has(u.from + '>' + u.to));   // bossless: only the ones no run can do (untested = doable)
    const stuck = ups.filter(u => !can.has(u.from + '>' + u.to) && !noboss.includes(u));   // conflicts: only the ones no run can do
    return { ups, runs: best, stuck, noboss, note: cp.note, any: runs.length, all: runs };
  }
  /* UNTESTED tag (user wording 2026-09-25): 'untested: our math says the N9 Frost Lord one-shots Alleria Windrunner - try it and tell us' */
  const unvTxt = (g, r) => g.nb && g.nb.unv && r ? `untested: our math says the N${r.n} ${g.nb.unv.map(bname).join(' / ')} one-shots ${(HERO[r.h] || {}).name || r.h} - try it and tell us` : '';
  const unvTag = (g, r) => unvTxt(g, r) ? ` <span class="small warntext">${esc(unvTxt(g, r))}</span>` : '';
  const upLine = (g, r) => { if (g.u.ch && r && r.got.some(x => x.u.to === g.u.from)) return '';   // ON THE WAY: a chained step sits on its first step's line
    const ch = []; for (let c = g, k = 0; r && k < 8 && (c = r.got.find(x => x.u.ch && x.u.from === c.u.to)); k++) ch.push(c);
    return `<li>${ilink(g.u.from)} → ${ilink(g.u.to)}${ch.map(x => ' → ' + ilink(x.u.to)).join('')} <span class="small">· ${esc((g.nb ? g.nb.how || g.u.text : g.u.text) + (killTxt(g) ? ' · ' + killTxt(g) : '') + ch.map(x => ' · then ' + x.u.text).join('') + (g.nb && g.nb.fgt ? ' · ' + g.nb.fgt : ''))}</span>${unvTag(g, r)}</li>`; };   // AUDIT M3
  /* route lines of a Legacy run: a boss pick at its boss step, a pick without a boss at its slot; an ARMOR FRAGMENT SET: one line per spot at
     the step it opens, the town-unit kills (last > 0) at the end of the route in that order, then the upgrade (routeHtml puts 'last' last) */
  const rtNeeds = r => r.got.concat(r.ugot || []).flatMap(g => { const lb = 'Upgrade ' + iname(g.u.from);
    if (g.fgs) return []; if (g.nb && g.nb.fg) return [{ txt: g.nb.how || g.u.text, label: lb, st: g.nb.slot }].concat(fgNeeds(g.nb.fg));   // FARM GOALS: farm lines at the stop
    if (!g.nb) return g.a[0].map((b, j) => ({ id: b, label: lb, st: g.at[j], note: killTxt(g), pqe: j ? null : pqeOf(g) }));   // AUDIT M3: kills per chance roll // PREREQ GATES: +N stones first
    const w = unvTxt(g, r), s = g.nb.set;
    if (!s) return [{ txt: g.nb.how || g.u.text, label: lb, st: g.nb.slot, warn: w, fire: g.nb.fire, pqn: g.nb.pqn }];   // PREREQ GATES: fire = the hunt block
    const rows = [...s.rows].sort((a, b) => a.last - b.last || a.at - b.at), nm = iname(String(s.key).split('*')[0]);
    return rows.map((x, j) => ({ txt: `${x.lb} (${zname(x.z)}${x.via ? `, via ${bname(x.via)}'s portal` : ''}), ${x.note}`, label: `${nm} ${j + 1}/${rows.length}`, st: x.at, last: x.last }))
      .concat([{ txt: g.nb.how, label: lb, st: g.nb.slot, last: 9, warn: w }]); });
  const nbSpend = r => { const all = r.got.concat(r.ugot || []), p = all.reduce((t, g) => t + ((g.nb || {}).pts || 0) + (+g.pq || 0), 0), w = all.reduce((t, g) => t + ((g.nb || {}).wp || 0), 0);
    return p || w ? `<p class="small">Spends ${[p ? `${fmt(p)} of your ${fmt(+S.pts || 0)} Points` : '', w ? `${fmt(w)} of your ${fmt(+S.wp || 0)} World Points` : ''].filter(Boolean).join(' and ')}.</p>` : ''; };
  /* LEGACY BAG (patch_legacy_bag): route line before an upgrade whose item is not in the Bag at that moment, and the Bag line of a focus view */
  const BAGW = { B: 'the kill', s: 'the arena', q: 'the fight', d: 'the trade' };
  const bagTxt = (s, g) => { const x = iname(s.x);
    if (s.hand) return `${s.hand === 'e' ? `put ${x} in slot 1 of your hero or pet for the stones` : `move ${x} to your hero or pet for this (the Bag drops materials)`}, then ${iname(g.u.to)} ${s.toBag ? 'into the Bag' : 'to storage'}`;
    return `${s.y ? `swap ${x} into the Bag for ${iname(s.y)}` : `put ${x} into the Bag`} before ${BAGW[s.kind] || 'it'}${s.back ? `, ${iname(s.y)} back after` : ''}${s.weak ? ' (weaker Bag, counted)' : ''}`; };
  const bagNeeds = (r, needs) => { const sw = (r.bag || {}).sw || {}, all = r.got.concat(r.ugot || []), done = new Set(), out = [];
    needs.forEach(x => { const g = all.find(y => x.label === 'Upgrade ' + iname(y.u.from)), key = g ? g.u.from + '>' + g.u.to : '';
      if (g && sw[key] && !done.has(key)) { done.add(key); out.push({ txt: bagTxt(sw[key], g), label: 'Legacy Bag', st: x.st, last: x.last }); }
      out.push(x); });
    return out; };
  const bagHtml = c => { if (!c || !c.h || !c.n || !MK[c.m] || !Object.keys(S.own).length) return '';
    const bg = c.r && c.r.bag, st = bg ? bg.start : pickBag(c.h, band(c.n) + '|' + MK[c.m], S.own, []), kx = new Set(bg ? bg.k : []);
    const rest = Object.values(S.own).filter(id => POS[id] && !st.includes(id)), sw = bg && Object.keys(bg.sw).length;
    const nl = id => `<a href="#item/${encodeURIComponent(id)}">${esc(iname(id))}</a>`;   // storage: plain names (compact)
    return `<p class="small pl-bag"><b>Legacy Bag</b> ${st.map(id => ilink(id) + (kx.has(id) ? ' (needed for its upgrade)' : '')).join(', ')}`
      + `${rest.length || sw ? '<br>' : ''}${rest.length ? `Leave in storage: ${rest.map(nl).join(', ')}.` : ''}${sw ? ' Swaps are free any time through slot 1 (the pet\'s Equipment Transfer).' : ''}</p>`; };
  /* ---- ON THE WAY (patch_on_the_way 2026-09-25; findings/public/audit_math/side_evolutions.md, legacy_bag_rules.md): Legacy items IN the
     Legacy Bag keep evolving along a run. otWalk = an owned item's line from its current step while the run meets each step anyway: a route
     boss (x.bs: PD.rqb main-quest bosses up to the stop + the run's boss picks) or any kill / any boss kill. It stops at the first step that needs a farm (a repeat-kill chance,
     Wyvern 1/50), materials or Points. otProb = a Markov chain over the run's kill timeline: creep kills per quest step (PD.kr = a finishing
     replay's kills at the end of Early / Mid / the run per band|mode, planner_pack patch_pack_kills; older data: KPM[0] x the run's
     minutes, spread evenly), bosses at their step, then the kills / boss kills a chance pick farms (85% luck count) */
  const OT_N = (a, n) => !a[1] || (a[4] === '>' ? n >= a[1] : n === a[1]);
  const otK = (x, s) => { const r = krOf(x) || (PD.kr || {})[band(x.n) + '|' + MK[x.m]];
    if (Array.isArray(r) && r.length >= 3) return s <= 12 ? r[0] * s / 12 : s <= 20 ? r[0] + (r[1] - r[0]) * (s - 12) / 8 : r[1] + (r[2] - r[1]) * Math.min(1, (s - 20) / Math.max(1, x.n));
    return KPM[0] * (+x.mins || 0) * Math.min(1, s / Math.max(1, x.stop)); };
  /* picks = [[boss, step, kills]]; xk / xb = kills / boss kills a chance pick of the run needs (the run farms the rest after its stop) */
  const otCtx = (h, n, m, lv, stop, mins, picks, xk, xb) => { const x = { h, n, m, i: HIDX[h], lv, stop: Math.max(0, +stop || 0), mins, bs: new Map(), ev: {}, nb: 0 }, pk = new Map();
    picks.forEach(([b, s, k]) => { const o = pk.get(b); if (!o || o[0] > +s) pk.set(b, [Math.max(0, +s || 0), Math.max(+k || 1, o ? o[1] : 1)]); });
    (PD.rqb || []).forEach(([b, s]) => { if (+s > x.stop) return; const o = pk.get(b); if (o) o[0] = Math.min(o[0], +s); else pk.set(b, [+s, 1]); });
    pk.forEach(([s, k], b) => { s = Math.min(x.stop, s); x.bs.set(b, s); for (let j = 0; j < k; j++) { (x.ev[s] = x.ev[s] || []).push(b); x.nb++; } });
    { const kb = krOf(x); if (kb) { let ad = 0; [12, 20, 20 + n].forEach((se, p) => { if (se > x.stop) return; const own = (PD.rqb || []).filter(q => +q[1] <= se).length, ex = Math.max(0, Math.round(kb[3 + p] - own) - ad);
      ad += ex; for (let j = 0; j < ex; j++) { (x.ev[se] = x.ev[se] || []).push(''); x.nb++; } }); } }   // TIGHT / HELD: the replay's other boss kills (farm stops, book quests) at each part's end
    x.xk = Math.max(0, Math.round((+xk || 0) - otK(x, x.stop))); x.xb = Math.max(0, (+xb || 0) - x.nb); return x; };
  const otWalk = (id, x) => { const st = []; let cur = id;
    for (let g = 0; g < 12; g++) { let nx = null;
      for (const [to, , alts] of (PD.edges[cur] || [])) { for (const a of alts) { if (!OT_N(a, x.n) || (a[2] && a[2] !== x.m) || !hasBit(a[3], x.i)) continue;
          if (a[0].length) { if (+a[5] > 1 || !a[0].every(b => x.bs.has(b))) continue; nx = { to, bs: a[0], last: a[0].reduce((p, b) => x.bs.get(b) >= x.bs.get(p) ? b : p) }; break; }
          const k = NBX[cur + '>' + to]; if (k && k[0] === 'k') { nx = { to, q: +k[1] || 0, bo: !!k[3] }; break; } }
        if (nx) break; }
      if (!nx) break; st.push(nx); cur = nx.to; }
    return st; };
  const otProb = (st, x) => { const n = st.length, p = new Float64Array(n + 1); p[0] = 1;
    const hit = (boss, id) => { for (let j = 0; j < n; j++) { if (!p[j]) continue; const y = st[j], q = y.bs ? (id && y.last === id ? 1 : 0) : y.bo ? (boss ? y.q : 0) : y.q;
      if (q) { const mv = p[j] * q; p[j] -= mv; p[j + 1] += mv; } } };   // j upward: a step taken on this kill rolls the next one on the same kill
    const cq = st.some(y => y.q && !y.bo); let done = 0;
    for (let s = 0; s <= x.stop; s++) { const K = Math.round(otK(x, s)); if (cq) for (let k = done; k < K; k++) hit(false, null); done = Math.max(done, K);
      (x.ev[s] || []).forEach(b => hit(true, b)); }
    if (cq) for (let k = 0; k < x.xk; k++) hit(false, null);
    for (let k = 0; k < x.xb; k++) hit(true, null);
    return p; };
  const otSum = (id, x) => { const st = otWalk(id, x); if (!st.length) return null; const p = otProb(st, x), ge = [1]; let acc = 0;
    for (let j = st.length; j >= 1; j--) { acc += p[j]; ge[j] = acc; }   // ge[j] = chance of at least j steps
    let sure = 0; while (sure < st.length && st[sure].bs && ge[sure + 1] > 0.999) sure++;
    let j85 = 0; while (j85 < st.length && ge[j85 + 1] >= 0.85) j85++;
    return { id, st, sure, j85, pn: j85 < st.length ? ge[j85 + 1] : 0, avg: ge.slice(1).reduce((t, v) => t + v, 0), ch: st.some(y => !y.bs) }; };
  /* Bag room for a chance item (it must sit in the Bag all run): the run's Bag (Legacy goal: bagPlan start, its kill-chance picks forced;
     other goals: your best 6 for this hero). Priority (user 2026-09-25): items of counted upgrades > strongest items > chance items */
  const otBag = (id, bag, forced, h, gk) => { if (bag.includes(id)) return { ok: 1 };
    const sl = (POS[id] || {}).slot, same = bag.find(y => (POS[y] || {}).slot === sl);
    if (same) return { ok: 0, t: `${iname(same)} holds the ${sl} slot` };
    const wk = bag.filter(y => !forced.includes(y)).sort((a, b) => bagVal(h, gk, a) - bagVal(h, gk, b))[0];
    return { ok: 0, t: wk ? `keeping it in the Bag all run takes ${iname(wk)}'s slot` : 'no Bag slot left' }; };
  const otwOf = c => { if (c._ow !== undefined) return c._ow; c._ow = null; const r = c.r, g0 = String(c.key || '').split('|')[0];
    if (!r || !Object.keys(S.own).length || !MK[c.m] || !c.h) return null;
    const h = c.h, gk = band(c.n) + '|' + MK[c.m], lg = g0 === 'legacy'; let x, bag, forced = [], pcOf = () => 0;
    if (g0 === 'points') { const b = r.best; x = otCtx(h, c.n, c.m, b.k, 20 + c.n, b.mins, [], 0, 0); bag = pickBag(h, gk, S.own, []); }
    else if (g0 === 'start') { x = otCtx(h, c.n, c.m, r.lv, r.stop, r.mins, r.got.filter(y => y[1] in r.at && y[2]).map(y => [y[2], r.at[y[1]], +y[8] || 1]), 0, 0); bag = pickBag(h, gk, S.own, []); }
    else if (lg) { const g = r.got || [];
      x = otCtx(h, c.n, c.m, r.lv, r.stop, r.mins, g.filter(y => !y.nb).flatMap(y => y.a[0].map((b, j) => [b, y.at[j], 1])),
        Math.max(0, ...g.map(y => +(y.nb || {}).kills || 0)), Math.max(0, ...g.map(y => +(y.nb || {}).bkills || 0)));
      forced = (r.bag || {}).k || []; bag = r.bag ? r.bag.start : pickBag(h, gk, S.own, forced); pcOf = ln => g.filter(y => y.u.line === ln).length; }
    else return null;
    const out = [];
    Object.values(S.own).forEach(id => { const ps = POS[id]; if (!ps) return; const o = otSum(id, x); if (!o || (lg && !o.ch)) return;   // Legacy goal: boss chains are picks
      o.pc = pcOf(ps.line); if (o.ch ? !(o.j85 > o.pc || o.pn >= 0.05) : o.sure <= o.pc) return;
      o.bag = o.ch ? otBag(id, bag, forced, h, gk) : { ok: bag.includes(id) }; o.x = x; out.push(o); });
    fgOtw(out, x, (ln, any) => { if (!lg || !ln) return false; const p = (r.got || []).filter(y => y.u.line === ln); return any ? p.length > 0 : p.some(y => y.fgs || (y.nb && y.nb.fg)); }, bag, forced, h, gk);   // FARM GOALS
    return (c._ow = out.length ? out : null); };
  const otPct = v => (v >= 0.995 ? 99 : Math.max(1, Math.round(v * 100))) + '%';
  const otOrd = k => ['', '1st', '2nd', '3rd'][k] || k + 'th';
  const otLi = o => { const nm = ilink(o.id); if (o.fgOnly) return `<li>${nm} <span class="small">· farm it:</span>${fgOffHtml(o)}</li>`;   // FARM GOALS
    if (!o.ch) { const bs = o.st.slice(0, o.sure).map(y => bname(y.last));
      return `<li>${nm} → ${o.st.slice(0, o.sure).map(y => ilink(y.to)).join(' → ')} <span class="small">· ${esc(andJ(bs))} on your route${o.bag.ok ? '' : ` · swap it into the Bag for ${bs.length > 1 ? 'those kills' : 'that kill'}`}</span></li>`; }
    const k = o.j85, t = [];
    if (k > 0) t.push(`${k} step${k > 1 ? 's' : ''} likely (to ${iname(o.st[k - 1].to)}${o.pc ? ', the upgrade above included' : ''})`);
    if (o.pn >= 0.05) t.push(`${k ? 'a ' + otOrd(k + 1) : 'a step'} ~${otPct(o.pn)}`);
    const s = t.join(', ') + ` · avg ${o.avg.toFixed(1)}`;
    return `<li>${nm} <span class="small">· ${o.bag.ok ? `${esc(s)} · keep it in the Legacy Bag all run` : `left out: ${esc(o.bag.t)}. In the Bag instead: ${esc(s)}`}</span>${fgOffHtml(o)}</li>`; };   // FARM GOALS: farm-on offers
  const otwHtml = c => { const L = otwOf(c); return L ? `<div class="small pl-otw"><b>Also on the way</b> <span class="small">(only Legacy items in the Legacy Bag evolve)</span><ul class="pl-ul">${L.map(otLi).join('')}</ul></div>` : ''; };
  /* one card line: the chance items that fit in the run's Bag and the sure boss chains (never ranked) */
  const otwCard = c => { const L = (otwOf(c) || []).filter(o => !o.fgOnly && (!o.ch || o.bag.ok)); if (!L.length) return '';
    return `<div class="pl-cf">+ bonus: ${esc(L.map(o => { const k = (o.ch ? o.j85 : o.sure) - o.pc; return iname(o.id) + (k > 0 ? ` +${k}${o.ch ? ' likely' : ''}` : ` ${otPct(o.pn)} for +1`); }).join(', '))}</div>`; };
  /* route lines (Points / First Legacy): each sure boss step at its boss */
  const otNeeds = c => (otwOf(c) || []).filter(o => !o.ch).flatMap(o => o.st.slice(0, o.sure).map((y, j) => ({ id: y.last, label: 'On the way', st: o.x.bs.get(y.last),
    note: `${iname(j ? o.st[j - 1].to : o.id)} → ${iname(y.to)}${o.bag.ok ? '' : ', swap it into the Legacy Bag first'}` }))).concat(fgOptNeeds(c));   // FARM GOALS: optional farm at the stop
  /* ---- CHAINS (patch_page_chains 2026-09-25, user-approved design findings/public/audit_math/tester2_chain_evolve.md). A NEW Legacy
     item keeps evolving on the same run: chWalk walks its line from the step it drops at (t0) while each next step is a boss this run beats
     at or after that step (bossAt at the run's account step, never raised for the new item; chKd: a boss the route kills earlier only if
     it respawns, the same boss twice only if it respawns), before
     the run can end (lim), no repeat-kill chance, no Points ticket, no +N stone gate (PQE / nbx 'e'). why = the reason it stops: k chance
     step (farm goal), e +N gate, p Points ticket, n another N, r not reached. First Legacy: every r.got item, sure chained steps count HALF
     a new line in rkV (user), the run plays on to the last one (stop, gear level, minutes follow). Legacy upgrades: new lines the run can
     pick up (PD.starts boss drops by its stop, free ones) + their chains, tie-break only (r.pk x 0.01). Only Bag items evolve: each new
     item gets a Bag line; -save keeps only the Bag and storage (legacy_bag_rules.md) */
  const chRes = b => +(((W.boss || {})[b]) || {}).respawn_s > 0;
  /* kd = Map boss -> the step the route kills it anyway (main quest PD.rqb, the run's own boss goals): a later step uses that kill, an
     earlier one leaves the boss dead unless it respawns (W.boss respawn_s). A boss the route does not kill waits for the item: fought at
     max(bossAt, the drop step) */
  const chKd = (r, extra) => { const kd = new Map(), put = (b, s) => { if (b && (!kd.has(b) || kd.get(b) > +s)) kd.set(b, +s); };
    (PD.rqb || []).forEach(([b, s]) => { if (+s <= 20 + r.n) put(b, s); }); (extra || []).forEach(x => put(x[0], x[1])); return kd; };
  const chWalk = (id, t0, bs0, h, n, m, lv, lim, kd) => { const i = HIDX[h], st = []; let cur = id, s0 = +t0 || 0, fb = bs0 || [], why = null;
    for (let g = 0; g < 8; g++) { let nx = null; why = null; const wk = y => { if (!why || why.k === 'n') why = y; };
      for (const [to, text, alts] of (PD.edges[cur] || [])) { for (const a of alts) { const k = NBX[cur + '>' + to], e = PQE[cur + '>' + to];
          if (!OT_N(a, n) || (a[2] && a[2] !== m)) { if (!why && a[1]) why = { k: 'n', to, n: +a[1], p: a[4] === '>' }; continue; }
          if (!hasBit(a[3], i)) continue;
          if (!a[0].length) { wk(k && k[0] === 'k' ? { k: 'k', to, text } : k && k[0] === 'e' ? { k: 'e', to, lv: 20 } : { k: 'x', to }); continue; }
          if (e) { wk({ k: 'e', to, lv: +e[0] || 15 }); continue; }
          if (+a[5] > 1) { wk({ k: 'k', to, text }); continue; }
          if (pqPts(a[0])) { wk({ k: 'p', to }); continue; }
          const at = a[0].map(b => { const x = bossAt(b, n, m, i, lv); if (x < 0 || x > lim) return -1; const k = kd ? kd.get(b) : null, gone = fb.includes(b) || (k != null && k < s0);
            if (k != null && !gone && k >= x) return k;               // the route's own kill, after the drop
            return gone && !chRes(b) ? -1 : Math.max(x, s0); });
          if (at.every(x => x >= 0 && x <= lim)) { nx = { from: cur, to, text, bs: a[0], at, s: Math.max(...at) }; break; }
          wk({ k: 'r', to }); }
        if (nx) break; }
      if (!nx) break; st.push(nx); cur = nx.to; s0 = nx.s; fb = nx.bs; }
    return { id, t0: +t0 || 0, st, why, last: cur }; };
  const chPostS = r => { const i = HIDX[r.h], n = r.n, m = r.m, c = cellOf(n, m, i, r.lv); r.ch = []; r.chn = 0; if (!c) return;
    const kd = chKd(r, r.got.filter(x => x[1] in r.at && x[2]).map(x => [x[2], r.at[x[1]]]));
    const walk = lim => r.got.map(x => chWalk(x[1], x[1] in r.at ? r.at[x[1]] : +x[10] || 0, x[2] && x[1] in r.at ? [x[2]] : [], r.h, n, m, r.lv, lim, kd));
    let L = walk(Math.max(...c.reach)), s2 = Math.max(r.stop, ...L.flatMap(w => w.st.map(y => y.s)));
    if (s2 > r.stop && lvlFor(c, s2) < 0) { L = walk(r.stop); s2 = r.stop; }
    const ids = [...new Set(L.flatMap(w => w.st.flatMap(y => y.bs)))];
    if (ids.length) { const L2 = s2 > r.stop ? lvlFor(c, s2) : r.L, e = eqStep(r.h, n, m), sb = r.got.filter(x => x[1] in r.at && x[2]).map(x => x[2]);
      r.mins += (s2 > r.stop ? tMix(c, L2, s2, n, m, i, e) - tMix(c, r.L, r.stop, n, m, i, e) : 0) + pqMins(sb.concat(ids), {}, n, m, i, s2, [], L2) - pqMins(sb, {}, n, m, i, s2, [], L2);
      r.stop = s2; r.L = L2; }
    r.ch = L; r.chn = L.reduce((t, w) => t + w.st.length, 0); };
  const pkOf = r => { if (r._pkl) return r._pkl; const i = HIDX[r.h], n = r.n, m = r.m, c = i == null ? null : cellOf(n, m, i, r.lv), out = [];
    if (!c || !(r.stop > 0)) return (r._pkl = out); const lim = Math.max(...c.reach), kd = chKd(r, (r.got || []).concat(r.ugot || []).filter(g => !g.nb && g.a).flatMap(g => g.a[0].map((b, j) => [b, g.at[j]])));
    (PD.starts || []).forEach(x => { if (S.own[x[0]] || (x[3] && x[3] !== n) || (x[4] && x[4] !== m) || (x[6] && !hasBit(x[6], i))) return; let t0 = 0;
      if (x[5] === 'boss') { if (+x[8] > 1) return; t0 = bossAt(x[2], n, m, i, r.lv); if (t0 < 0 || t0 > r.stop) return; }
      else if (x[5] === 'free') { if ((x[1] === 'I04J' && (+S.ml || 1) < 3) || r.stop < (+x[10] || 0)) return; t0 = +x[10] || 0; }
      else return;
      out.push(Object.assign(chWalk(x[1], t0, x[5] === 'boss' ? [x[2]] : [], r.h, n, m, r.lv, lim, kd), { x })); });
    return (r._pkl = out); };
  const chPostL = r => { r._pkl = null; const L = pkOf(r); r.pk = L.length + L.reduce((t, w) => t + w.st.length, 0); };
  const chPost = r => r.at ? chPostS(r) : chPostL(r);
  const chBag = (id, bag, h, gk) => { const sl = (POS[id] || {}).slot, same = bag.find(y => (POS[y] || {}).slot === sl);
    if (same) return `swap it into the Bag for ${iname(same)} before the kill`;
    if (bag.length < 6) return 'Bag it before the kill';
    const wk = bag.slice().sort((a, b) => bagVal(h, gk, a) - bagVal(h, gk, b))[0]; return `swap it into the Bag for ${iname(wk)} before the kill`; };
  const chOf = c => { if (c._ch !== undefined) return c._ch; c._ch = null; const r = c.r, g0 = String(c.key || '').split('|')[0]; if (!r || !MK[c.m] || !c.h) return null;
    const gk = band(c.n) + '|' + MK[c.m], o = { h: c.h, gk, stop: r.stop };
    if (g0 === 'start') return (c._ch = Object.assign(o, { lg: 0, L: r.ch || [], bag: pickBag(c.h, gk, S.own, []) }));
    if (g0 === 'legacy') return (c._ch = Object.assign(o, { lg: 1, L: pkOf(r), bag: r.bag ? r.bag.start : pickBag(c.h, gk, S.own, []) }));
    return null; };
  const chStep = y => `${andJ(y.bs.map(bname))}, step ${y.s}`;
  const chFarm = w => w.why && w.why.k === 'k' ? ` <span class="small">· farm on for ${ilink(w.why.to)}: ${esc(w.why.text)}</span>` : '';
  const chLi = (w, o) => { const lead = o.lg ? ` <span class="small">· ${esc(w.x[5] === 'boss' ? bname(w.x[2]) + ', step ' + w.t0 : w.x[7])}</span>` : '';
    if (!w.st.length) return `<li>${ilink(w.id)}${lead}${chFarm(w)}</li>`;
    const pl = Math.max(0, ...w.st.map(y => y.s)) - o.stop, bits = w.st.map(chStep).concat(o.bag.includes(w.id) ? [] : [chBag(w.id, o.bag, o.h, o.gk)]);
    return `<li>${ilink(w.id)}${lead} → ${w.st.map(y => ilink(y.to)).join(' → ')} <span class="small">· ${esc(bits.join(' · '))}${pl > 0 ? ` (play on ${pl} step${pl > 1 ? 's' : ''})` : ''}</span>${chFarm(w)}</li>`; };
  const chHint = L => { const nN = [], eN = [];
    L.forEach(w => { const y = w.why; if (!y || w.st.length) return;
      if (y.k === 'n') { const t = `${iname(y.to)} N${y.n}${y.p ? '+' : ''}`; if (!nN.includes(t)) nN.push(t); }
      else if (y.k === 'e') eN.push(`${iname(w.last)} needs +${y.lv}`); });
    return nN.length ? `<p class="small pl-otw">Next steps are on other N: ${esc(nN.join(', '))}.${eN.length ? ' ' + esc(eN.join('. ')) + '.' : ''}</p>` : ''; };
  const chHtml = c => { const o = chOf(c); if (!o) return '';
    if (!o.lg) { const L = o.L.filter(w => w.st.length); return L.length ? `<div class="small pl-otw"><b>Don't leave yet</b><ul class="pl-ul">${L.map(w => chLi(w, o)).join('')}</ul></div>` : chHint(o.L); }
    return o.L.length ? `<div class="small pl-otw"><b>Free pickups</b><ul class="pl-ul">${o.L.map(w => chLi(w, o)).join('')}</ul><span class="small">-save keeps only the Bag and storage: move new Legacy there first.</span></div>` : ''; };
  const chCard = c => { const o = chOf(c); if (!o) return '';
    if (!o.lg) { const t = o.L.flatMap(w => w.st.map(y => iname(y.to))); return t.length ? `<div class="pl-cf">+ then ${esc(t.join(', '))}</div>` : ''; }
    const t = o.L.map(w => [w.id].concat(w.st.map(y => y.to)).map(iname).join(' → '));
    return t.length ? `<div class="pl-cf">+ bonus: ${esc(t.slice(0, 3).join(', '))}${t.length > 3 ? ` +${t.length - 3} more` : ''}</div>` : ''; };
  /* route lines: First Legacy 'Then' at each chained boss; Legacy goal 'Pick up' at a pickup's boss and 'Then' for chains up to the stop
     (play-on steps stay in the block, the route and run length are the upgrades' own) */
  const chNeeds = c => { const o = chOf(c); if (!o) return [];
    return o.L.flatMap(w => (o.lg && w.x[5] === 'boss' ? [{ id: w.x[2], label: 'Pick up', st: w.t0, note: iname(w.id) }] : [])
      .concat(w.st.filter(y => !o.lg || y.s <= o.stop).flatMap((y, j) => y.bs.map((b, q) => ({ id: b, label: 'Then', st: y.at[q],
        note: `${iname(y.from)} → ${iname(y.to)}${!j && !q && !o.bag.includes(w.id) ? ', ' + chBag(w.id, o.bag, o.h, o.gk) : ''}` }))))); };
  /* AUDIT minor 16: a run that stops at step 0 (e.g. the Adult Black Dragon, N4 only, open from the start): no route or gear list, the bosses
     to go to straight away */
  const stop0At = r => { const bs = rtNeeds(r).filter(x => x.id).map(x => bname(x.id) + (bzone(x.id) ? ' in ' + zname(bzone(x.id)) : ''));
    return bs.length ? ': go straight to the ' + [...new Set(bs)].join(', ') : ''; };
  /* ---- TIGHT / HELD / FARM GOALS (patch_page_tight_farm 2026-09-25, user-approved; data: planner_pack patch_pack_tight_held + the
     TESTER MODEL grid, scripts/pending/patch_tester_model.py). All optional: without PD.rt / PD.bt / PD.rh / PD.krh the page is as before.
     TIGHT: a boss fight is won only if the hero lives 1.3 x the kill time; 'tight' = won with less than 1.6 x. PD.rt[N|m][hero] = the
     required bosses each replay won tight (10 account steps ',' x 5 gear levels '.', base-36 codes into PD.rtb); PD.bt[beat row] = per
     hero '1' where that row's passing fight is tight at the row's own account step */
  const TG_TXT = 'Boss fights are won with little room (you live only 30-60% longer than the kill takes). A bit more gear helps.';
  const TG_TAG = `<span class="tag warn pl-tip" title="${esc(TG_TXT)}" data-tip="${esc(TG_TXT)}" tabindex="0">tight</span>`;
  const RTC = new Map(), RQB = new Set((PD.rqb || []).map(x => x[0]));
  const rtOf = (h, n, m, k, L) => { const T = (PD.rt || {})[n + '|' + m]; if (!T || !PD.rtb || k == null || k < 0 || L == null || L < 0 || (G.rf && PD.rpf && PD.rpf[n + '|' + m])) return null;
    const key = n + m + '|' + h + '|' + k + '|' + L; if (RTC.has(key)) return RTC.get(key);
    const f = (((T[h] || '').split(',')[k] || '').split('.')[L]) || '', o = new Set([...f].map(c => PD.rtb[B36.indexOf(c)]).filter(Boolean));
    RTC.set(key, o); return o; };
  const btOf = (b, n, m, i, lv) => { const BT = PD.bt, k = b + '|' + n + '|' + m; if (!BT || i == null || bnsOf(k)) return false;   // no-stone rows (below Map Level 90) carry no flags
    const s0 = (PD.beat || {})[k]; if (s0 === undefined) return false;
    const at = (rk, s) => okAt(s[i], lv) ? (BT[rk] || '').charAt(i) === '1' && +s[i] === +lv : null;
    let r = at(k, s0); if (r !== null) return r;
    for (let j = stageOf(stopOf(b, n)); j <= 2; j++) { const s = PD.beat[k + '|' + j]; if (s !== undefined) { r = at(k + '|' + j, s); if (r !== null) return r; } }
    return false; };
  const tightAt = (b, n, m, h, lv, L) => { if (!b) return false; const r = RQB.has(b) ? rtOf(h, n, m, lv, L) : null; return r ? r.has(b) : btOf(b, n, m, HIDX[h], lv); };
  const tgCard = (h, n, m, lv, L, stop, extra) => !!(PD.rt || PD.bt) && (PD.rqb || []).filter(x => +x[1] <= stop).map(x => x[0]).concat(extra || []).some(b => tightAt(b, n, m, h, lv, L));
  let TG_LV = null, TGR = { chip: () => '', step: () => '' };
  const tgSet = lv => { TG_LV = lv; return ''; };                     // the focus views pass the run's account step to routeHtml
  const tgRoute = (h, n, m, L) => { const lv = TG_LV != null ? TG_LV : eqStep(h, n, m).k; TG_LV = null; let first = true;
    const chip = b => { if (!tightAt(b, n, m, h, lv, L)) return ''; const t = first ? ` <span class="small">${esc(TG_TXT.replace(/^tight: /, ''))}</span>` : ''; first = false; return ' ' + TG_TAG + t; };
    return { chip, step: d => { for (const x of String(d || '').matchAll(/\{\{u:([A-Za-z0-9]{4})\}\}/g)) { if (!RQB.has(x[1])) continue; const c = chip(x[1]); if (c) return c; } return ''; } }; };
  /* HELD: PD.rhR = rows of 11 fixed-width (PD.rhw) base-36 indexes into PD.rhT = [x early, mid, late, e early, mid, late, p early, mid, late,
     rune, books]: x 'I0AA:1' = a build item the replay held only 1 copy of, e = what it held beyond the build list ('~' = random start
     items), p = its pet bag at the end of the part, rune '' = it never got one, books '-' = never learned */
  const RHC = new Map();
  const rhRow = ri => { if (RHC.has(ri)) return RHC.get(ri); const R = (PD.rhR || [])[ri], T = PD.rhT || [], w = +PD.rhw || 2; let o = null;
    if (typeof R === 'string') { const f = j => T[parseInt(R.substr(j * w, w), 36)] || '', sp = s => s ? s.split(',') : [];
      o = { x: [0, 1, 2].map(j => sp(f(j)).map(z => { const q = z.split(':'); return [q[0], +q[1] || 0]; })), e: [3, 4, 5].map(j => sp(f(j))), p: [6, 7, 8].map(j => sp(f(j))),
        r: [f(9), f(9) ? 1 : 0], b: (f(10) || '-;-').split(';').map(z => z && z !== '-' ? [z] : null) }; }
    RHC.set(ri, o); return o; };
  const RND = { P7: 'random Level-7 item (Player Bonus)', A3: 'random Level-3 artifact (quest step 4)', A5: 'random Level-5 artifact (quest step 17)' };
  const tfName = id => { const c = String(id).slice(1); if (RND[c]) return RND[c]; const b = /^B(\d)$/.exec(c); return b ? `random ${tpBeg(+b[1])} (Beginner Bonus)` : 'random item'; };
  const tfLink = id => String(id).charAt(0) === '~' ? `<span class="pl-rnd">${esc(tfName(id))}</span>` : ilink(id);
  const krOf = x => { const r = ((PD.krh || {})[x.n + '|' + x.m] || {})[x.h]; return Array.isArray(r) && r.length >= 6 ? r : null; };   // the hero's own kills per part
  /* FARM GOALS (user-approved 'Yes, as farm goals'; findings/public/audit_math/side_evolutions.md). An owned Legacy item whose next steps
     roll per kill while it sits in the Legacy Bag can be farmed on. fgRoute = the run's own kills (otCtx: creeps per quest step, the route's bosses, the replay's
     other boss kills), fgPlan = the farm after it in chain order (grind creeps, boss kills, the unit), each part until 85 players in
     100 of those who got the steps before it are through (the page's '85% luck' per count: step 3 = ~28 boss kills, step 4 = ~94
     Wyverns; the route's own kills count first). A whole 4-step goal at 85% for all of it together would need ~2x the kills.
     fgTime = this hero's spots: grinding KPM[1] kills a minute; boss kills at the respawning boss with the shortest cycle the hero beats by
     the stop (PD.kt kill time + W.boss respawn_s; the Boss Souls farm PD.sf: kills a minute = souls a minute / souls a kill, only a spot
     with this hero's beat row unless no checked spot is open; else KB_MIN
     a kill on the route's bosses; never a Firelands boss: it needs Frodo's hunt; the spot is never named, any boss counts); unit kills at the
     unit's zone (PD.kt kill time + the edge's seconds between kills; a zone opening after the stop moves the stop); + FG_WALK a spot */
  const FG_WALK = 2, FG_LUCK = 0.85;
  const fgSteps = (id, n, m, i) => { const st = []; let cur = id;
    for (let g = 0; g < 12; g++) { let nx = null;
      for (const [to, text, alts] of (PD.edges[cur] || [])) { for (const a of alts) { if (!OT_N(a, n) || (a[2] && a[2] !== m) || !hasBit(a[3], i)) continue;
          if (!a[0].length) { const k = NBX[cur + '>' + to]; if (k && k[0] === 'k' && +k[1] > 0) nx = { from: cur, to, text, q: +k[1], ty: k[3] ? 'b' : 'a' }; }
          else if (a[0].length === 1 && +a[5] > 1 && +a[7]) nx = { from: cur, to, text, q: 1 - Math.pow(1 - FG_LUCK, 1 / +a[5]), ty: 'u', u: a[0][0], gap: +a[6] || 0 };
          if (nx) break; }
        if (nx) break; }
      if (!nx) break; st.push(nx); cur = nx.to; }
    return st; };
  /* cnt kills of one kind ('a' creep, 'b' boss uid, 'u' unit uid): each kill rolls every step in order (a step taken rolls the next) */
  const fgHit = (p, st, kind, uid, cnt) => { const hero = !!uid && !!(W.boss || {})[uid], nn = Math.min(st.length, p.length - 1);
    const q = st.map(y => y.ty === 'a' ? y.q : y.ty === 'b' ? (kind === 'b' || (kind === 'u' && hero) ? y.q : 0) : (kind !== 'a' && uid && uid === y.u ? y.q : 0));
    if (!cnt || !q.some(Boolean)) return;
    for (let c = 0; c < cnt; c++) for (let j = 0; j < nn; j++) { const v = p[j]; if (v && q[j]) { const mv = v * q[j]; p[j] = v - mv; p[j + 1] += mv; } } };
  const fgRoute = (st, x) => { const p = new Float64Array(st.length + 1); p[0] = 1; let done = 0;
    for (let s = 0; s <= x.stop; s++) { const K = Math.round(otK(x, s)); if (K > done) fgHit(p, st, 'a', null, K - done); done = Math.max(done, K);
      (x.ev[s] || []).forEach(b => fgHit(p, st, 'b', b || null, 1)); }
    return p; };
  const fgPlan = (st, p0, t) => { const S2 = st.slice(0, t), ph = [];
    S2.forEach((y, j) => { const k = y.ty === 'u' ? 'u:' + y.u : y.ty, l = ph[ph.length - 1];
      if (l && l.k === k) { l.end = j + 1; l.q = Math.min(l.q, y.q); return; }
      ph.push({ k, ty: y.ty, uid: y.u || null, gap: y.gap || 0, end: j + 1, q: y.q, n: 0 }); });
    const tail = (p, c) => { let s = 0; for (let j = c; j < p.length; j++) s += p[j]; return s; };
    const p = Float64Array.from(p0); let prev = 1;
    for (const f of ph) { const ch = Math.max(1, Math.round(Math.log(1 - FG_LUCK) / Math.log(1 - f.q) / 40)), goal = FG_LUCK * prev; let g = 0;
      while (tail(p, f.end) < goal - 1e-9 && g++ < 4000) { fgHit(p, S2, f.ty, f.uid, ch); f.n += ch; }
      if (tail(p, f.end) < goal - 1e-9) return null; prev = tail(p, f.end); }
    return { ph: ph.map(f => ({ ty: f.ty, uid: f.uid, gap: f.gap, n: f.n })), P: tail(p, t) }; };
  const fgKt = (b, n, m, i) => { const q = ((PD.kt || {})[b + '|' + n + '|' + m] || '')[i]; return q ? B36.indexOf(q) * 10 : null; };
  const fgOpen = (b, n, m, i, lv) => (PD.beat || {})[b + '|' + n + '|' + m] !== undefined ? bossAt(b, n, m, i, lv) : Math.max(0, fsOf(b, n) || 0);
  const fgBoss = (n, m, i, lv, stop) => { const o = [{ b: '', cyc: KB_MIN * 60, x: 0 }], seen = new Set();   // '' = the route's bosses again
    for (const k of Object.keys(PD.kt || {})) { const [b, kn, km] = k.split('|'); if (+kn !== n || km !== m || seen.has(b)) continue; const B = (W.boss || {})[b], t = fgKt(b, n, m, i);
      if (!B || !(+B.respawn_s > 0) || t == null || bzone(b) === 'z10') continue; const at = fgOpen(b, n, m, i, lv); if (at < 0 || at > stop) continue; seen.add(b);
      o.push({ b, cyc: t + +B.respawn_s, x: FG_WALK }); }
    const vk = o.length > 1;                                         // a spot with this hero's own beat row + kill time exists
    ((PD.sf || {})[MK[m] + '|' + band(n)] || []).forEach((f, p) => { if (!f || !(+f[1] > 0) || !(+f[3] > 0) || p > stageOf(Math.max(0, stop)) || seen.has(f[0]) || bzone(f[0]) === 'z10') return;
      const hr = (PD.beat || {})[f[0] + '|' + n + '|' + m] !== undefined; if (vk && !hr) return;   // Boss Souls spots without a beat row (the median hero's) only when nothing checked is open
      const at = fgOpen(f[0], n, m, i, lv); if (at < 0 || at > stop) return; seen.add(f[0]); o.push({ b: f[0], cyc: 60 * f[3] / f[1], x: FG_WALK }); });
    return o; };
  const fgTime = (pl, x) => { let fm = 0, stop2 = x.stop; const sp = [];
    for (const f of pl.ph) { if (!f.n) continue;
      if (f.ty === 'a') { fm += f.n / (KPM[1] || 30); sp.push({ ty: 'a', n: f.n }); continue; }
      if (f.ty === 'b') { const c = fgBoss(x.n, x.m, x.i, x.lv, x.stop).map(o => Object.assign({ mn: f.n * o.cyc / 60 + o.x }, o)).sort((a, b) => a.mn - b.mn)[0];
        fm += c.mn; sp.push({ ty: 'b', n: f.n, b: c.b }); continue; }
      const t = fgKt(f.uid, x.n, x.m, x.i), at = fgOpen(f.uid, x.n, x.m, x.i, x.lv); if (at < 0) return null;
      fm += f.n * ((t == null ? 60 : t) + f.gap) / 60 + FG_WALK + pqFarmGate(f.uid, x, Math.max(stop2, at)); stop2 = Math.max(stop2, at); sp.push({ ty: 'u', n: f.n, u: f.uid }); }
    return { fm, stop2, sp }; };
  /* FARM GATES (patch_farm_gates_live 2026-09-25): the gate steps a unit farm spot needs (PD.pq: Wyvern = Storm Beast Gatekeeper + Evil
     Jaina on N1-6), minus what the run's own boss goals already count; the farm's own walk is FG_WALK, so the unit's off-route walk goes */
  const pqFarmGate = (u, x, st) => { if (!PD.pq || !(PQ[u] || []).length) return 0; const ids = [...x.bs.keys()].filter(b => b && b !== u), km = { [u]: 2 };
    return Math.max(0, pqMins(ids.concat([u]), km, x.n, x.m, x.i, st, [], PQL.L) - pqMins(ids, {}, x.n, x.m, x.i, st, [], PQL.L) - (pqOn(u, x.n, st) ? 0 : PQW)); };
  const FGP = new Map();
  /* farm options of an owned item on this run (x = otCtx): per target t (from tmin) {t, to, st, sp: farm parts, fm: minutes, stop2} */
  const fgOf = (id, x, tmin) => { const st = fgSteps(id, x.n, x.m, x.i); if (!st.length) return [];
    const p0 = fgRoute(st, x), out = [];
    for (let t = Math.max(1, tmin || 1); t <= st.length; t++) {
      const key = st.map(y => y.to).join(',') + '|' + x.n + x.m + '|' + t + '|' + Array.from(p0, v => Math.round(v * 200)).join(',');
      let pl = FGP.get(key); if (pl === undefined) { pl = fgPlan(st, p0, t); FGP.set(key, pl); if (FGP.size > 4000) FGP.delete(FGP.keys().next().value); }
      if (!pl) break; const tm = fgTime(pl, x); if (!tm) break;
      out.push(Object.assign({ id, t, st: st.slice(0, t), to: st[t - 1].to }, tm)); }
    return out; };
  const fgMin = v => v < 20 ? Math.max(1, Math.round(v)) : 5 * Math.round(v / 5);
  /* USER RULE: no spot named for 'any kill' / 'any boss' steps; a unit the code requires is named (with its zone) */
  const fgPart = s => s.ty === 'a' ? `~${fmt(s.n)} more monsters (any monster)` : s.ty === 'b' ? `~${fmt(s.n)} more bosses (any boss)`
    : `~${fmt(s.n)} ${bname(s.u)}${/s$/.test(bname(s.u)) ? '' : 's'}${bzone(s.u) ? ' (' + zname(bzone(s.u)) + ')' : ''}`;
  const fgTxt = o => o.sp.length ? 'kill ' + o.sp.map(fgPart).join(' + ') + `, about ${fgMin(o.fm)} min` : 'the run\'s own kills do it, no extra time';   // plain text: callers escape
  /* route lines of a farm pick (Legacy goal): one per farm part, at the stop */
  const fgNeeds = o => o.sp.map((s, j) => { const lb = 'Farm ' + iname(o.id), last = 8 + j / 10;
    if (s.ty === 'a') return { txt: `kill ~${fmt(s.n)} more monsters (any monster)`, label: lb, st: o.stop2, last };
    if (s.ty === 'b') return { txt: `kill ~${fmt(s.n)} more bosses (any boss; the route's bosses already count)`, label: lb, st: o.stop2, last };
    return { id: s.u, label: lb, st: o.stop2, last, note: `kill ~${fmt(s.n)}` }; });
  /* Legacy goal (fgPost, run on every Legacy run before the sort): each kill-chance pick ('k') becomes a farm goal; per pick the target
     with the best rank value (upgrades minus length class, ties = shorter), its chained steps count as upgrades (fgs picks), its farm
     minutes join the run length. Minutes by differences: the run's own minutes minus the old kill-count cost of its chance picks, plus
     the longer route when a farm spot opens later, plus the farm */
  const fgPost = r => { const h = r.h, n = r.n, m = r.m, i = HIDX[h], ks = (r.got || []).filter(g => g.nb && g.u && g.u.nb && g.u.nb[0] === 'k' && !g.u.ch); if (!ks.length) return;
    const e0 = eqStep(h, n, m), e = r.bag && r.bag.e && r.bag.e.s < e0.s - 1e-9 ? r.bag.e : e0, c = cellOf(n, m, i, r.lv); if (!c) return;
    const all = r.got.concat(r.ugot || []), T = (s2, L2) => tMix(c, L2, s2, n, m, i, e), T0 = T(r.stop, r.L);
    let a2 = all.map(g => ks.includes(g) ? Object.assign({}, g, { nb: Object.assign({}, g.nb, { kills: 0, bkills: 0 }) }) : g);
    const z0 = nbMins(a2, T0, n, r.stop, m, i), m0 = r.mins - (nbMins(all, T0, n, r.stop, m, i) - z0);
    const base = (s2, L2) => s2 === r.stop && L2 === r.L ? m0 : m0 + nbMins(a2, T(s2, L2), n, s2, m, i) - z0;
    const rmax = Math.max(...c.reach), boss = all.filter(g => !g.nb).flatMap(g => g.a[0].map((b, j) => [b, g.at[j], 1])), add = [];
    let s2 = r.stop, L2 = r.L, far = 0, n2 = r.got.length;
    for (const g of ks) { const x = otCtx(h, n, m, r.lv, s2, base(s2, L2), boss, 0, 0); let best = null;
      fgOf(g.u.from, x, 1).forEach(o => { const ss = Math.max(s2, o.stop2); if (ss > rmax) return; const LL = ss === s2 ? L2 : lvlFor(c, ss); if (LL < 0) return;
        const tot = base(ss, LL) + far + o.fm, sc = n2 + o.t - 1 - lenI(tot);
        if (!best || sc > best.sc || (sc === best.sc && tot < best.tot)) best = { o, ss, LL, sc, tot }; });
      if (!best) { a2 = a2.map(y => y.u === g.u ? g : y); continue; }   // no farm plan: the old kill count stays
      const o = best.o; s2 = best.ss; L2 = best.LL; far += o.fm; n2 += o.t - 1;
      a2 = a2.map(y => y.u === g.u ? Object.assign({}, y, { nb: Object.assign({}, y.nb, { fg: o, fgt: 'farm to ' + iname(o.to) + ': ' + fgTxt(o), how: g.u.text + ', keep it in your Legacy Bag all run' }) }) : y);
      for (let j = 1; j < o.t; j++) { const y = o.st[j]; add.push({ u: { line: g.u.line, slot: g.u.slot, from: y.from, to: y.to, text: y.text, alts: [], nb: null, ch: 1 }, a: [[]], at: [s2], fgs: 1 }); } }
    const nm = base(s2, L2) + far;
    r.got = a2.filter(y => r.got.some(z => z.u === y.u)).concat(add); r.stop = s2; r.L = L2; r.mins = nm; };
  /* 'Also on the way': farm-on offers for chance items (beyond the steps the run makes likely) and for items whose next step is a unit
     farm (Wyvern); Legacy goal: lines with a pick are left to the pick */
  const fgOtw = (out, x, skip, bag, forced, h, gk) => {
    for (let j = out.length - 1; j >= 0; j--) if (skip((POS[out[j].id] || {}).line, 0)) out.splice(j, 1);
    Object.values(S.own).forEach(id => { const ps = POS[id]; if (!ps || skip(ps.line, 1)) return; const o0 = out.find(o => o.id === id); if (o0 && !o0.ch) return;
      const fg = fgOf(id, x, o0 ? o0.j85 + 1 : 1); if (!fg.length) return;
      if (o0) o0.fg = fg; else out.push({ id, fgOnly: 1, ch: 1, st: [], fg, x, bag: otBag(id, bag, forced, h, gk) }); }); };
  const fgOffHtml = o => !o.fg || !o.fg.length ? '' : `<div class="small">${o.fgOnly ? '' : 'Farm it on: '}${o.fg.map(f => `to ${ilink(f.to)}: ${esc(fgTxt(f))}${f.stop2 > o.x.stop ? ` (play on to quest step ${f.stop2} first)` : ''}`).join(' · ')}${o.bag && !o.bag.ok ? ' · keep it in the Legacy Bag while you farm' : ''}</div>`;
  const fgOptNeeds = c => (otwOf(c) || []).filter(o => o.fg && o.fg.length).map(o => { const f = o.fg[o.fg.length - 1]; if (f.stop2 > o.x.stop) return null;
    return { txt: `${iname(o.id)} → ${iname(f.to)}: ${fgTxt(f)}`, label: 'Optional farm', st: o.x.stop, last: 8 }; }).filter(Boolean);
  /* ---- CARDS UI (patch_cards_ui 2026-09-25, user-approved presentation rework): each goal ranks its runs exactly as before (Legacy /
     First Legacy: rkV then minutes; Points: Points of a 3-hour session) and the page shows the top CARDN as ranked cards side by side, a
     filter bar (hero, N, mode, max run length: the model's minutes decide, never shown) and, on a tap, that run alone as a numbered step
     list. State: page memory (FO = focused run) + the ap_plan save (filters S.cf, gear level S.gl, rare drops S.rf); no URL parameters */
  let CARDN = 8; const LENMAX = { 0: Infinity, 5: 300, 3: 180 };
  let FO = null, FOY = 0;
  const CF = () => { const f = S.cf && typeof S.cf === 'object' ? S.cf : (S.cf = {}); if (!Array.isArray(f.ns)) f.ns = [];
    if (!f.h || !HERO[f.h]) f.h = ''; if (!MN[f.m]) f.m = ''; f.len = +f.len === 5 || +f.len === 3 ? +f.len : 0; return f; };
  const fOK = r => { const f = CF(); return (!f.h || r.h === f.h) && (!f.ns.length || f.ns.includes(r.n)) && (!f.m || r.m === f.m); };
  /* max length: runs over it drop out; if none is left, the shortest runs anyway (with a note) */
  const capRuns = (runs, t) => { const f = CF(), mx = LENMAX[f.len] || Infinity; if (mx === Infinity) return { runs, note: '' };
    const ok = runs.filter(r => t(r) <= mx); if (ok.length || !runs.length) return { runs: ok, note: '' };
    return { runs: runs.slice().sort((a, b) => t(a) - t(b)), note: `No run fits in ${f.len} h: the shortest ones instead.` }; };
  const hName = h => (HERO[h] || {}).name || h, stOf = h => String((HERO[h] || {}).main_stat || '').toLowerCase();
  const tagH = (t, c, tip) => `<span class="tag${c ? ' ' + c : ''}${tip ? ' pl-tip' : ''}"${tip ? ` title="${esc(tip)}" data-tip="${esc(tip)}" tabindex="0"` : ''}>${esc(t)}</span>`;
  /* PLANNER TAGS (2026-09-26): plain names + one-line tips (tap on phones, hover on desktop); TAGS_KEY = the folded key under the filters */
  const finTag = n => tagH('Full clear OK', 'ok', `Beats the N${n} final boss (step ${20 + n}) if you keep playing after your goal.`);
  const newTag = () => tagH('Beginner-friendly', 'ok', 'Also finishes when played slowly by a new player.');
  const f10H = (v, reach) => { const x = f10(v); return `<span class="pl-cf pl-tip" title="Replayed 10 times with random drops: ${x} ${reach ? 'got there' : 'finished'}." data-tip="Replayed 10 times with random drops: ${x} ${reach ? 'got there' : 'finished'}." tabindex="0">${x}/10 test runs ${reach ? 'reached it' : 'finished'}</span>`; };
  const TAGS_KEY = () => `<details class="pl-d pl-tagkey small"><summary>What the tags mean</summary><ul class="pl-ul">`
    + [['X/10 test runs finished', 'the run was replayed 10 times with random drops, X of them finished'], ['Full clear OK', 'beats the final boss of that N if you keep playing after your goal'],
       ['Beginner-friendly', 'also finishes when played slowly by a new player'], ['tight', 'boss fights are won with little room: a bit more gear helps'],
       ['needs: ...', 'the gear level this run needs'], ['needs rare drops', 'only works if you farm rare drops'], ['untested', 'upgrades the replays could not confirm'],
       ['no quest steps', 'the goal needs no main quest steps'], ['spends Points', 'the run buys something with Points']]
      .map(([a, b]) => `<li><b>${esc(a)}</b> <span class="small">· ${esc(b)}</span></li>`).join('') + `</ul></details>`;
  const f10 = v => Math.max(0, Math.min(10, Math.round(v * 10)));
  const namesH = ids => { const nm = ids.map(iname); return esc(nm.slice(0, 2).join(', ')) + (nm.length > 2 ? ` <span class="small">+${nm.length - 2} more</span>` : ''); };
  const gearP = L => L >= 0 ? `<p class="small">Gear: ${esc(gearTxt(L))}.</p>` : '';
  const stLi = x => `<li>${ilink(x[1])} <span class="small">· ${esc(x[7])}</span></li>`;
  /* ---- Legacy goal cards (legacyRuns: every run (N x mode x hero) that upgrades the most of your items, chained steps included) */
  const lgCard = r => { const i = HIDX[r.h], all = r.got.concat(r.ugot || []), full = r.stop >= 20 + r.n, tags = [];
    if ((r.ugot || []).length) tags.push(tagH(r.ugot.length + ' untested', 'warn', 'Upgrades the replays could not confirm.'));
    if (!(r.stop > 0)) tags.push(tagH('no quest steps', 'acc', 'This goal needs no main quest steps.')); else if (r.fin && !full) tags.push(finTag(r.n));
    if (nbSpend(r)) tags.push(tagH('spends Points', '', 'The run buys something with Points.'));
    if (tgCard(r.h, r.n, r.m, r.lv, r.L, r.stop, r.got.filter(g => !g.nb).flatMap(g => g.a[0]))) tags.push(TG_TAG);   // TIGHT
    if (r.stop > 0 && paceOk(r.n, r.m, i, r.lv, r.L, r.stop)) tags.push(newTag());   // LAB WIRE: same gear level
    return { key: 'legacy|' + r.h + '|' + r.n + '|' + r.m + '|' + all.map(g => g.u.to).sort().join(','), r, h: r.h, n: r.n, m: r.m, mins: r.mins, tags,
      ids: all.map(g => g.u.to), unit: 'upgrade', fc: full ? fcAt(r.n, r.m, i, r.lv, r.L) : null, fr: !full && r.stop > 0 ? fcsAt(r.n, r.m, i, r.lv, r.L, r.stop) : null }; };
  const lgFocus = c => { const r = c.r, full = r.stop >= 20 + r.n, fw = !full && r.stop > 0 ? fcAt(r.n, r.m, HIDX[r.h], r.lv, r.L) : null;
    return `<ul class="pl-ul">${r.got.concat(r.ugot || []).map(g => upLine(g, r)).join('')}</ul>`
      + (r.others.length ? `<p class="small">Also works with: ${r.others.map(heroLink).join(', ')}</p>` : '')
      + (r.stop > 0 || pqRoute0(r) ? `<p class="small">${r.fin ? 'Can also finish the whole run.' : r.near ? 'Stop after your last upgrade boss. The whole run is borderline for your account.' : 'Stop after your last upgrade boss: not expected to finish this run.'}${fw != null ? ` The whole run: ${f10(fw)}/10 test runs finished.` : ''}</p>`
          + sideTxt(r) + nbSpend(r) + gearP(r.L) + tgSet(r.lv) + routeHtml(r.h, r.n, r.m, bagNeeds(r, rtNeeds(r)).concat(chNeeds(c)), false, r.L)
        : `<p class="small">No quest steps needed: start a game on N${r.n} ${MN[r.m]} and do ${r.got.length + (r.ugot || []).length > 1 ? 'them' : 'it'} right away${stop0At(r)}.</p>` + nbSpend(r)); };   // AUDIT minor 16
  function legacyList() {
    if (!Object.keys(S.own).length) return { msg: '<p class="small">Load your save or pick your Legacy items above to see which run upgrades the most of them.</p>' };
    const { ups, runs, stuck, noboss, note, any, all } = legacyRuns();
    if (!ups.length) return { msg: '<p class="small">No upgrade found for the items you picked (they may be the last step of their line).</p>' };
    return { cards: runs.map(lgCard), note, focus: c => dclRoute(lgFocus(c)), has: (h, n, m) => (all || []).some(x => x.h === h && x.n === n && x.m === m), find: (h, n, m) => { const r = (all || []).find(x => x.h === h && x.n === n && x.m === m); return r ? lgCard(Object.assign({ others: [] }, r)) : null; }, none: any ? '' : 'None of your next upgrades can be done by any hero with your current Legacy yet. Push other lines first.',
      extra: (noboss.length ? `<details class="pl-d"><summary>Upgrades without a boss not doable yet (${noboss.length})</summary><ul class="pl-ul">${noboss.slice(0, 40).map(u => `<li>${ilink(u.from)} → ${ilink(u.to)} <span class="small">· ${esc(nbWhy(u))}</span></li>`).join('')}</ul></details>` : '')
        + (stuck.length ? `<details class="pl-d"><summary>Not doable yet with your Legacy (${stuck.length})</summary><ul class="pl-ul">${stuck.slice(0, 40).map(u => `<li>${ilink(u.from)} → ${ilink(u.to)} <span class="small">· ${esc(u.text)}</span></li>`).join('')}</ul></details>` : '') };
  }
  /* ---- First Legacy items (user 2026-09-25): the run that STARTS the most Legacy lines you do not have yet (PD.starts = how each line
     starts: free ticket, drop, craft, Points buy), the Points buys you can afford, and the long farms */
  const stCard = r => { const i = HIDX[r.h], full = r.stop >= 20 + r.n, tags = [];
    if (r.fin && !full) tags.push(finTag(r.n));
    if (tgCard(r.h, r.n, r.m, r.lv, r.L, r.stop, r.got.map(x => x[2]).filter(Boolean))) tags.push(TG_TAG);   // TIGHT
    if (r.stop > 0 && paceOk(r.n, r.m, i, r.lv, r.L, r.stop)) tags.push(newTag());   // LAB WIRE: same gear level
    return { key: 'start|' + r.h + '|' + r.n + '|' + r.m + '|' + r.got.map(x => x[1]).sort().join(','), r, h: r.h, n: r.n, m: r.m, mins: r.mins, tags,
      ids: r.got.map(x => x[1]), unit: 'Legacy line', fc: full ? fcAt(r.n, r.m, i, r.lv, r.L) : null, fr: !full && r.stop > 0 ? fcsAt(r.n, r.m, i, r.lv, r.L, r.stop) : null }; };
  const stFocus = c => { const r = c.r, full = r.stop >= 20 + r.n, fw = !full ? fcAt(r.n, r.m, HIDX[r.h], r.lv, r.L) : null;
    return `<ul class="pl-ul">${r.got.map(stLi).join('')}</ul>` + (r.others.length ? `<p class="small">Also works with: ${r.others.map(heroLink).join(', ')}</p>` : '')
      + `<p class="small">${r.fin ? 'Can also finish the whole run.' : r.near ? 'Stop after the last boss you need. The whole run is borderline for your account.' : 'Stop after the last boss you need: not expected to finish this run.'}${fw != null ? ` The whole run: ${f10(fw)}/10 test runs finished.` : ''}</p>`
      + sideTxt(r) + gearP(r.L)
      + tgSet(r.lv) + routeHtml(r.h, r.n, r.m, r.got.filter(x => x[1] in r.at).map(x => ({ id: x[2], label: 'Get ' + iname(x[1]), st: r.at[x[1]] })).concat(chNeeds(c), otNeeds(c)), false, r.L); };   // ON THE WAY
  function startList() {
    const ST = (PD.starts || []).filter(x => !S.own[x[0]]);
    if (!ST.length) return { msg: '<p class="small">You already hold an item of every Legacy line.</p>' };
    const fitsS = (x, n, m) => (!x[3] || x[3] === n) && (!x[4] || x[4] === m);
    const runs = [];
    for (let n = 1; n <= 9; n++) for (const m of ['m', 'c', 'd']) PD.heroes.forEach((h, i) => {
      if (!unlocked(h) || (LSKIP && LSKIP(h, n, m))) return;   // GEAR LEVEL IN THE CARD
      const e = eqStep(h, n, m), lv = e.k, c = cellOf(n, m, i, lv), rmax = c ? Math.max(...c.reach) : -1;
      const at = {};                                  // v52: boss starts at the step the run fights the boss (bossAt), then the free ones it passes
      ST.forEach(x => { if (x[5] !== 'boss' || !fitsS(x, n, m) || (x[6] && !hasBit(x[6], i))) return; const s = bossAt(x[2], n, m, i, lv); if (s >= 0 && s <= rmax) at[x[1]] = s; });
      if (!Object.keys(at).length) return;
      const stop = Math.max(0, ...Object.values(at)), L = lvlFor(c, stop); if (L < 0) return;
      const got = ST.filter(x => x[1] in at || (x[5] === 'free' && (x[1] !== 'I04J' || (S.ml || 1) >= 3) && stop >= (+x[10] || 0)));   // Intelligence Treasure: step 9, Steel Fortress
      /* a start that needs several kills (Legacy Arrow: 15 Flame Lord kills, 30 s respawn): kills x kill time (PD.kt) + the respawn waits */
      const more = got.reduce((t, x) => { const k = +x[8] || 1; if (k <= 1) return t; const q = ((PD.kt || {})[x[2] + '|' + n + '|' + m] || '')[i];
        return t + (k * (q ? B36.indexOf(q) * 10 : 60) + (k - 1) * (+x[9] || 0)) / 60; }, 0);
      runs.push({ h, n, m, lv, got, at, fin: c.jl >= 0, near: nearFin(n, m, i, e), sc: score(h, n, m), stop, L, mins: tMix(c, L, stop, n, m, i, e) + more + pqStart(got, at, n, m, i, stop, L) });
    });
    runs.forEach(chPost);                                              // CHAINS: evolutions of the new items on the same run
    const EASE = { m: 0, c: 1, d: 2 };
    runs.sort((a, b) => rkV(b) - rkV(a) || a.mins - b.mins || a.n - b.n || EASE[a.m] - EASE[b.m] || b.sc - a.sc);   // items minus length class (user 2026-09-25)
    const cp = capRuns(runs.filter(fOK), r => r.mins), groups = new Map();   // CARDS UI: filters + length cap
    for (const r of cp.runs) { const k = r.got.map(x => x[1]).sort().join(','); const g = groups.get(k);
      if (!g) groups.set(k, Object.assign({}, r, { others: [] })); else if (g.n === r.n && g.m === r.m && g.others.length < 5) g.others.push(r.h); }
    const best = [];
    for (const g of groups.values()) { if (best.some(b => g.got.every(x => b.got.includes(x)))) continue; best.push(g); if (best.length >= CARDN) break; }
    const pts = ST.filter(x => /^points:/.test(x[5])).map(x => ({ x, cost: +x[5].split(':')[1] })).sort((a, b) => a.cost - b.cost);
    const slow = ST.filter(x => x[5] === 'farm' || x[5] === 'survival');
    return { cards: best.map(stCard), note: cp.note, focus: c => dclRoute(stFocus(c)), has: (h, n, m) => runs.some(x => x.h === h && x.n === n && x.m === m), find: (h, n, m) => { const r = runs.find(x => x.h === h && x.n === n && x.m === m); return r ? stCard(Object.assign({ others: [] }, r)) : null; }, none: runs.length ? '' : 'No boss start fits your account yet: take the free ones below and play Main N1-N2.',
      extra: (pts.length ? `<div class="card"><b>Buy with Points</b> <span class="small">(you have ${fmt(S.pts || 0)})</span><ul class="pl-ul">${pts.map(({ x, cost }) => `<li>${ilink(x[1])} <span class="small">· ${esc(x[7])}${(S.pts || 0) >= cost ? ' · you can afford it' : ''}</span></li>`).join('')}</ul></div>` : '')
        + (slow.length ? `<details class="pl-d"><summary>Long farms (${slow.length})</summary><ul class="pl-ul">${slow.map(stLi).join('')}</ul></details>` : '') };
  }
  /* ---- Points goal (v52): every run you finish = finish it (stage boss + AFK Points), then farm Jarvan V for the rest of a 3-hour
     session. Ranked by the Points of that session (a run over 3 h: its own rate x 3 h, no farm). Optional extras, not ranked: Shadow
     Monster 10 once (killed after the main quest), the first Archangel / Frost Lord kill (N^2 x 0.15 x mode + 10, W.calc.points arch) */
  /* AUDIT minor 6: the main-quest reward adds +10 (+15 on N9) below Map Level 5 and +2 x N when your Map Level
     is 5 or lower */
  const lowPts = n => ((S.ml || 1) < 5 ? (n === 9 ? 15 : 10) : 0) + ((S.ml || 1) <= 5 ? 2 * n : 0);
  const ptCard = r => { const b = r.best, i = HIDX[b.h], tags = [];
    if (b.jv) tags.push(tagH('Jarvan V farm', 'acc', 'Farm Jarvan V after the main quest for Points.'));
    if (tgCard(b.h, r.n, r.m, b.k, b.L, 20 + r.n, [])) tags.push(TG_TAG);   // TIGHT
    if (paceOk(r.n, r.m, i, b.k, b.L)) tags.push(newTag());   // LAB WIRE: same gear level, whole run
    return { key: 'points|' + b.h + '|' + r.n + '|' + r.m, r, h: b.h, n: r.n, m: r.m, mins: b.mins, tags, fc: fcAt(r.n, r.m, i, b.k, b.L),
      what: `<b>${fmt(r.pay)}</b> Point${r.pay === 1 ? '' : 's'} stage boss${r.low ? ` <span class="small">+${fmt(r.low)} low Map Level bonus</span>` : ''}` }; };
  const ptFocus = c => { const r = c.r, b = r.best, jvMost = b.jv && b.mins < SESS && b.jv * (SESS - b.mins) / 60 > b.sess / 2;   // the Jarvan V farm is over half of the ranked Points: say why a short run wins
    return (r.low ? `<p class="small">+${fmt(r.low)} Points for Map Level 5 or lower.</p>` : '')
      + `<p class="small">${b.jv && b.mins < SESS ? `Finish the run (stage boss + AFK Points), then farm Jarvan V.${jvMost ? ' Jarvan V pays most of the Points, so shorter runs rank higher.' : ''}` : `Finish the run (stage boss + AFK Points).${b.jv ? '' : ' This hero cannot farm Jarvan V.'}`}</p>`
      + (b.ex.length ? `<p class="small">Optional: ${b.ex.map(x => `${x[0]} +${x[2]} (${x[3]})`).join(', ')}.</p>` : '')
      + `<p class="small">Jarvan V: ${jvPer()} Points per kill after the main quest (1.02, confirmed in game), back 10 s after he and G.S.D both die. Likely fixed in a later map patch.</p>`
      + (r.who.length > 1 ? `<p class="small">Also works with: ${r.who.slice(1).map(heroLink).join(', ')}</p>` : '')
      + gearP(b.L) + tgSet(b.k) + routeHtml(b.h, r.n, r.m, otNeeds(c), true, b.L); };   // ON THE WAY
  function pointsList() {
    const all = [], R = (W.calc || {}).points || [], MI = { m: 0, c: 1, d: 2 }, f = CF();
    for (let n = 1; n <= 9; n++) for (const m of ['m', 'c', 'd']) {
      const pr = R.find(r => r.n === n); if (!pr || !(PD.rp || {})[n + '|' + m]) continue;
      if ((f.ns.length && !f.ns.includes(n)) || (f.m && f.m !== m)) continue;   // CARDS UI filters
      const pay = vipPay(n, m, Number(pr[MCALC[m]]) || 0), arch = vipArch(n, m, Number((pr.arch || [])[MI[m]]) || 0), fin = [], low = lowPts(n);   // VIP
      PD.heroes.forEach((h, i) => { if (!unlocked(h) || (f.h && h !== f.h) || (LSKIP && LSKIP(h, n, m))) return; const e = eqStep(h, n, m), c = cellOf(n, m, i, e.k); if (!c || c.jl < 0) return;
        const L = lvlFor(c, 20 + n), mins = finT(c, L, n, m, i, e); if (!mins) return;
        const jv = jvRate(h, n, m, e), ex = [['Shadow Monster', 'O007', vipPts(10), 'after the main quest'], ['Archangel', 'H02D', arch, 'first kill'], ['Frost Lord', 'O01Q', arch, 'first kill']]
          .filter(x => x[2] && bossAt(x[1], n, m, i, e.k) >= 0);
        fin.push({ h, k: e.k, L, mins, per: (pay + low + mins / 60 * AFKH) / (mins / 60), jv, sess: sessPts(pay + low, mins, jv), ex }); });
      if (!fin.length) continue;
      fin.sort((a, b) => b.sess - a.sess || b.per - a.per);
      all.push({ n, m, pay, low, fin });
    }
    const mx = LENMAX[f.len] || Infinity; let note = '';
    let rows = all.map(r => Object.assign({}, r, { fin: r.fin.filter(x => x.mins <= mx) })).filter(r => r.fin.length);
    if (!rows.length && all.length) { note = `No run fits in ${f.len} h: the shortest ones instead.`;
      rows = all.map(r => Object.assign({}, r, { fin: r.fin.slice().sort((a, b) => a.mins - b.mins) })).sort((a, b) => a.fin[0].mins - b.fin[0].mins); }
    else rows.sort((a, b) => b.fin[0].sess - a.fin[0].sess);
    rows.forEach(r => { r.best = r.fin[0]; r.who = r.fin.slice(0, 4).map(x => x.h); });
    const anyRun = all.length || f.h || f.ns.length || f.m;
    return { cards: rows.slice(0, CARDN).map(ptCard), note, focus: c => dclRoute(ptFocus(c)), has: (h, n, m) => all.some(r => r.n === n && r.m === m && r.fin.some(y => y.h === h)), find: (h, n, m) => { const r = all.find(x => x.n === n && x.m === m), x = r && r.fin.find(y => y.h === h); return x ? ptCard(Object.assign({}, r, { fin: [x], best: x, who: [h] })) : null; }, none: anyRun ? '' : 'No run a normal player finishes with your account yet. Try Main N1.' };
  }
  /* ---- cards, focus view, filter bar */
  const chip = (k, v, t, on) => `<button type="button" class="pl-chip${on ? ' on' : ''}" data-cf="${k}" data-v="${esc(v)}" aria-pressed="${on ? 'true' : 'false'}">${esc(t)}</button>`;
  const cardHtml = (c, k) => { const t = tierOf(c.h, c.n, c.m), st = stOf(c.h);
    return `<div class="pl-card${k ? '' : ' pl-c1'}" role="button" tabindex="0" data-run="${esc(c.key)}"${st ? ` data-st="${st}"` : ''}>`
      + `<div class="pl-ch"><span class="pl-rk">${k + 1}</span>${K.icon(c.h)}<span class="pl-hn">${esc(hName(c.h))}</span>${t ? `<span class="pl-tl t-${t}" title="Tier ${t}">${t}</span>` : ''}${st ? `<span class="pl-sb ${st}">${st.toUpperCase()}</span>` : ''}</div>`
      + `<div class="pl-cr"><b>N${c.n} ${MN[c.m]}</b>${lenW(c.mins) ? `<span>${lenW(c.mins)} run</span>` : ''}</div>`
      + `<div class="pl-cg">${c.what}</div>` + otwCard(c) + chCard(c)   // ON THE WAY
      + (c.fc != null ? `<div>${f10H(c.fc)}</div>` : c.fr != null ? `<div>${f10H(c.fr, 1)}</div>` : '')
      + (dclTags(c.tags).length ? `<div class="pl-ct">${dclTags(c.tags).join('')}</div>` : '') + `</div>`; };
  /* ---- DECLUTTER (patch_page_declutter 2026-09-25, user: "make the planner clearer, more compact and simpler"). The open run card is
     rebuilt from the SAME html the planner wrote (nothing is recomputed here and no fact is dropped: long text moves behind a small '?'
     or a 'show all'): header + one tag; 'Before you start' (gear switch, Legacy Bag, skills, Boss Souls total, after-run / -save rule);
     the goal list; ONE 'Bonus on this run' list (Don't leave yet + Free pickups + Also on the way + side farm + optional farms, 3 shown);
     then the route: same-zone quest steps on one line, Enhance lines as sub-lines of the step before (Boss Souls only as one total),
     gear rows with the pet / rune / skill lines behind a tap. dclRoute also runs inside R.focus, so the route checker sees this route.
     Without a DOM (no document) the html is returned unchanged. */
  const DCL_ON = typeof document !== 'undefined';
  const DCL = { box: h => { const d = document.createElement('div'); d.innerHTML = h; return d; },
    txt: e => String(e ? e.textContent : '').replace(/\s+/g, ' ').trim(),
    tn: (root, re, to) => { const w = document.createTreeWalker(root, 4), ns = []; while (w.nextNode()) ns.push(w.currentNode);
      ns.forEach(n => { const v = n.nodeValue.replace(re, to); if (v !== n.nodeValue) n.nodeValue = v; }); },
    q: (more, lab) => more ? `<details class="pl-q"><summary title="more">${lab || '?'}</summary><div>${more}</div></details>` : '',
    head: li => { const b = li.querySelector(':scope > b'); return b ? DCL.txt(b) : ''; } };
  /* one tag at most: warnings first; 'needs: A bit more' (every run's floor) and 'Jarvan V farm' (every Points run) say nothing */
  const dclTags = tags => { const pr = t0 => { const t = String(t0).replace(/ (?:title|data-tip)="[^"]*"/g, ''); return /needs: A bit more/.test(t) || /Jarvan V farm/i.test(t) ? -1 : /rare drops|needs: /.test(t) ? 0 : /tight/i.test(t) ? 1
      : /Beginner-friendly/i.test(t) ? 2 : /no quest steps/i.test(t) ? 3 : /Full clear OK/i.test(t) ? 4 : 5; };
    return (tags || []).filter(t => pr(t) >= 0).sort((a, b) => pr(a) - pr(b)).slice(0, 1); };
  const dclRoute = html => { if (!DCL_ON || !html || html.indexOf('pl-steps') < 0 || /class="pl-steps pl-dc/.test(html)) return html;
    const box = DCL.box(html), ol = box.querySelector('ol.pl-steps'); if (!ol) return html;
    ol.classList.add('pl-dc');
    const lis = () => [...ol.children].filter(e => e.tagName === 'LI'), bon = []; let souls = 0;
    /* optional farms -> the Bonus list */
    lis().forEach(li => { if (DCL.head(li) !== 'Optional farm') return; const c = li.cloneNode(true); c.querySelector(':scope > b').remove();
      bon.push('<b>Farm</b> ' + c.innerHTML.replace(/^\s*·\s*/, '')); li.remove(); });
    /* gear rows: the items in one row; pet bag / rune / universal skill behind a tap */
    lis().filter(li => li.classList.contains('pl-gh')).forEach(li => {
      const s = li.querySelector(':scope > span.small'); if (s && /farm while you pass/.test(s.textContent)) s.remove();
      const gb = li.querySelector(':scope > .pl-gb'); if (!gb) return;
      DCL.tn(gb, /may not fit this gear level's farm time/g, 'may take too long to farm');
      const ex = [...gb.querySelectorAll(':scope > div.small')]; if (!ex.length) return;
      const lab = [...new Set(ex.map(x => DCL.txt(x.querySelector('b')).toLowerCase().replace('universal skill', 'skill')).filter(Boolean))];
      const d = document.createElement('details'); d.className = 'pl-more pl-gx';
      d.innerHTML = `<summary>+ ${esc(lab.join(', '))}</summary>`; ex.forEach(x => d.appendChild(x)); gb.appendChild(d); });
    /* Enhance -> a sub-line of the step before; Boss Souls summed once */
    lis().forEach(li => { if (DCL.head(li) !== 'Enhance') return;
      const sm = [...li.querySelectorAll(':scope > span.small')].pop();
      if (sm) { const m = /~([\d,]+) Boss Souls/.exec(sm.textContent); if (m) { souls += +m[1].replace(/,/g, ''); const g = sm.querySelector('a'); sm.innerHTML = g ? 'at ' + g.outerHTML : ''; } }
      const p = li.previousElementSibling, c = li.cloneNode(true); c.querySelector(':scope > b').remove();
      const body = '⚒ Enhance ' + c.innerHTML.replace(/^\s*·\s*/, '');
      if (p && p.tagName === 'LI' && p.classList.contains('pl-n')) { const d = document.createElement('div'); d.className = 'pl-sub'; d.innerHTML = body; p.appendChild(d); li.remove(); }
      else { li.innerHTML = body; li.classList.add('pl-enh'); } });
    /* same-zone quest steps on one line (4 at most); a step with sub-lines ends its line */
    const plain = li => li.classList.contains('pl-n') && !li.classList.contains('pl-rb') && !!li.firstElementChild && li.firstElementChild.matches('span.small');
    const clean = li => !li.querySelector(':scope > ul, :scope > .pl-sub, :scope > details, :scope > .tag, :scope > .pl-q');
    let prev = null;
    lis().forEach(li => { if (!plain(li)) { prev = null; return; }
      if (prev && DCL.txt(prev.firstElementChild) === DCL.txt(li.firstElementChild) && clean(prev) && (+prev.dataset.k || 1) < 4) {
        const c = li.cloneNode(true); c.firstElementChild.remove(); c.innerHTML = c.innerHTML.replace(/^\s*·\s*/, '');
        const sp = document.createElement('span'); sp.className = 'pl-sep'; sp.textContent = ' › '; prev.appendChild(sp);
        while (c.firstChild) prev.appendChild(c.firstChild);
        prev.dataset.k = (+prev.dataset.k || 1) + 1; li.remove(); return; }
      prev = li; });
    /* item pickups at a step (and under a gear row): inline 'get:' names on the step's own line, where / price / chance behind '?' */
    lis().forEach(li => li.querySelectorAll(':scope > ul.pl-ul, :scope > .pl-gb > ul.pl-ul').forEach(ul => { ul.classList.add('pl-gets');
      ul.querySelectorAll(':scope > li').forEach(x => { const w = [...x.querySelectorAll(':scope > span.small')]; if (!w.length) return;
        const more = w.map(y => y.innerHTML.replace(/^\s*·\s*/, '')).join(' '); w.forEach(y => y.remove()); x.insertAdjacentHTML('beforeend', DCL.q(more)); }); }));
    /* step numbers (a joined line shows its range), shorter fixed lines, the tight tip behind '?' */
    let k = 0; lis().forEach(li => { if (!li.classList.contains('pl-n')) return; const a = k + 1; k += +li.dataset.k || 1; li.dataset.n = a === k ? String(a) : a + '-' + k; });
    lis().forEach(li => { if (li.classList.contains('pl-stop')) DCL.tn(li, /the rest of the run gives you nothing you planned/, 'nothing else planned after this');
      DCL.tn(li, /^Optional: Frodo's (quest chain|hidden Boss Hunt) gives every player an? $/, "Optional: Frodo's $1 → ");
      DCL.tn(li, /^\. Nothing on this run needs it\.$/, ' (this run does not need it)');
      DCL.tn(li, /^ \((7 bosses in a fixed order, then the Flame Lord in the Firelands)\)\. Nothing on this run needs it\.$/, ' (this run does not need it; $1)');
      li.querySelectorAll('span.small').forEach(s => { const t = DCL.txt(s); if (/^survive only/.test(t)) s.outerHTML = DCL.q(esc(t.replace(/ - Safer \/ A bit more helps$/, ', more gear helps'))); }); });
    /* ---- FOLD (patch_page_fold 2026-09-25, user: "show only the steps where the player does something for THIS plan"): 1+ lines in a
       row that are plain main-quest steps (plain + clean above: zone + quest text, no pickup / Enhance / tight chip; never a gate, goal, gear,
       Boss Souls, Frodo or Stop line) fold into ONE line 'Steps 12-19 · follow the main quest' + show. The step lines move inside it
       unchanged, so the route checker still reads every quest step in order. */
    const fold = li => plain(li) && clean(li) && !li.querySelector('.warntext');
    const fruns = []; let frun = [];
    lis().forEach(li => { if (fold(li)) frun.push(li); else { if (frun.length) fruns.push(frun); frun = []; } });
    if (frun.length) fruns.push(frun);
    fruns.forEach(r => { const a = String(r[0].dataset.n).split('-')[0], z = String(r[r.length - 1].dataset.n).split('-').pop(), f = document.createElement('li');
      const rg = a === z ? a : a + '-' + z; f.className = 'pl-fold'; f.dataset.n = rg; f.dataset.k = r.reduce((t, x) => t + (+x.dataset.k || 1), 0);
      f.innerHTML = `<details class="pl-fd"><summary><span class="pl-fdh">Step${a === z ? '' : 's'} ${rg} · follow the main quest</span><span class="pl-fds"></span></summary><div class="pl-fdb"></div></details>`;
      const b = f.querySelector('.pl-fdb'); ol.insertBefore(f, r[0]);
      r.forEach(x => { const d = document.createElement('div'); d.className = 'pl-fdl'; d.dataset.n = x.dataset.n;
        while (x.firstChild) d.appendChild(x.firstChild); b.appendChild(d); b.appendChild(document.createTextNode(' ')); x.remove(); }); });
    if (souls) ol.dataset.souls = souls;
    if (bon.length) { const d = document.createElement('div'); d.className = 'pl-dcb'; d.hidden = true; d.innerHTML = bon.map(b => `<div>${b}</div>`).join(''); ol.parentNode.insertBefore(d, ol); }
    return box.innerHTML; };
  const dclCard = html => { if (!DCL_ON || !html) return html;
    const box = DCL.box(dclRoute(html)), f = box.querySelector('.pl-focus'); if (!f || f.classList.contains('pl-dcf')) return html;
    f.classList.add('pl-dcf'); const T = DCL.txt, one = s => f.querySelector(':scope > ' + s);
    const fw = one('.pl-fw'), fh = one('.pl-fh'), gsw = one('.pl-gsw'), bag = one('.pl-bag'), ol = one('ol.pl-steps'), rt = one('h4.pl-rt');
    const pre = [], bon = [], after = [], top = {}; let aw = '', fin = '', goalUl = null;
    const s = ol ? +ol.dataset.souls || 0 : 0, sr = s >= 1000 ? Math.round(s / 100) * 100 : s >= 100 ? Math.round(s / 50) * 50 : Math.max(10, Math.round(s / 10) * 10);
    [...f.children].forEach(e => { const t = T(e); let m;
      if (e === fw || e === fh || e === gsw || e === bag || e === ol || e === rt || e.matches('.pl-fbar, .pl-bk2')) return;
      if (e.matches('.pl-dcb')) { [...e.children].forEach(x => bon.push(x.innerHTML)); e.remove(); return; }
      if (e.matches('div.pl-otw')) { const items = [...e.querySelectorAll(':scope > ul > li')];
        items.forEach(li => { DCL.tn(li, / · Bag it before the kill$/, ''); DCL.tn(li, /, step \d+(?= · |$)/, ''); DCL.tn(li, / · avg [\d.]+/, ''); DCL.tn(li, / · keep it in the Legacy Bag all run/, ' (keep it in the Bag)');
          li.querySelectorAll('span, div').forEach(x => { if (li.contains(x) && /^Farm it on:/.test(T(x)) && !x.closest('.pl-q')) x.outerHTML = DCL.q(x.innerHTML.replace(/^\s*Farm it on:\s*/, ''), 'farm'); });
          bon.push(li.innerHTML); });
        e.querySelectorAll(':scope > span.small').forEach(x => { if (/^-save keeps only/.test(T(x))) pre.push('<b>Before -save</b> move new Legacy into the Bag or a storage (-save keeps only those)');
          else if (T(x) && !/^\(only Legacy items/.test(T(x))) after.push(x.outerHTML); });
        e.remove(); return; }
      if (e.matches('p.pl-otw') && /^Next steps are on other N:/.test(t)) { bon.push('<b>Next</b> on other N: ' + esc(t.replace(/^Next steps are on other N:\s*/, ''))); e.remove(); return; }
      if (e.matches('ul.pl-ul')) { goalUl = e; e.querySelectorAll(':scope > li').forEach(li => { DCL.tn(li, /, keep it in your Legacy Bag all run/, '');
          li.querySelectorAll(':scope > span.small').forEach(x => { const mm = /^([\s\S]*?) · (farm to [\s\S]*)$/.exec(x.innerHTML); if (mm) x.innerHTML = mm[1] + ' ' + DCL.q(mm[2], 'farm'); }); }); return; }
      if ((m = /^Can also finish the whole run\.(?: The whole run: (\d+)\/10 test runs finished\.)?$/.exec(t))) { fin = m[1] ? `full run: ${m[1]}/10 test runs finished` : 'Full clear OK'; e.remove(); return; }
      if (e.matches('p') && /^Gear: /.test(t)) { e.remove(); return; }   // the gear switch shows it
      if (/^No quest steps needed/.test(t) && fw) { fw.querySelectorAll('.tag').forEach(x => { if (/no quest steps/i.test(T(x))) x.remove(); }); return; }
      if (/^\+\d+ Points for Map Level \d+ or lower\.$/.test(t) && fw && /low Map Level bonus/.test(T(fw))) { const tg = fw.querySelector('.tag'), d = DCL.box(DCL.q(esc(t))).firstChild; if (tg) fw.insertBefore(d, tg); else fw.appendChild(d); e.remove(); return; }
      if (/^\+ side: /.test(t)) { const x = t.replace(/^\+ side:\s*/, '').replace(/^farm Jarvan V after the quest: /, 'Jarvan V after the quest, ');
        const mm = /^(.*?) \((back 10 s[^)]*)\)(.*)$/.exec(x); bon.push('<b>Side farm</b> ' + (mm ? esc(mm[1]) + DCL.q(esc(mm[2])) + esc(mm[3]) : esc(x))); e.remove(); return; }
      if (/^Also works with: /.test(t)) { aw = e.innerHTML; e.remove(); return; }
      if (/^Finish the run \(stage boss/.test(t)) { top.fin = e.innerHTML; e.remove(); return; }
      if (/^Jarvan V: \d+ Points per kill/.test(t)) { top.jv = t; top.jvH = e.innerHTML; e.remove(); return; }
      if (/^Skill priority/.test(t)) { pre.unshift(e.innerHTML.replace(/<b>Skill priority<\/b>\s*·\s*/, '<b>Skills</b> ')); e.remove(); return; }
    });
    /* header: what you get + the finish line + one tag */
    if (fw && fin) fw.querySelectorAll('.tag').forEach(x => { if (/Full clear OK/i.test(T(x))) x.remove(); });
    if (fw && fin && !/\d+\/10 test runs finished/.test(T(fw))) { const tg = fw.querySelector('.tag'), sp = document.createElement('span'); sp.className = 'pl-cf'; sp.textContent = ' · ' + fin; if (tg) fw.insertBefore(sp, tg); else fw.appendChild(sp); }
    /* Before you start: 3-5 lines */
    const b0 = [];
    if (gsw) { const h = gsw.querySelector('.pl-ghint'), ht = h ? h.innerHTML : ''; if (h) h.remove(); const fl = gsw.querySelector('.pl-fl'); if (fl) fl.remove();
      b0.push('<b>Gear</b> ' + gsw.outerHTML + DCL.q(ht)); gsw.remove(); }
    if (bag) { const c = bag.cloneNode(true), bb = c.querySelector(':scope > b'); if (bb) bb.remove(); DCL.tn(c, /\(needed for its upgrade\)/g, '(keep it there all run)');
      b0.push('<b>Legacy Bag</b> ' + c.innerHTML.trim()); bag.remove(); }
    b0.push(...pre.filter(x => /^<b>Skills/.test(x)));
    if (s) b0.push(`<b>Boss Souls</b> ~${fmt(sr)} for the enhances on the way (at Gazlowe)`);
    if (top.fin || top.jv) { const mm = top.jv ? /^Jarvan V: (\d+ Points per kill)/.exec(top.jv) : null;
      b0.push('<b>After the run</b> farm Jarvan V' + (mm ? ', ' + mm[1] : '') + DCL.q([top.fin || '', top.jvH || ''].filter(Boolean).join('<br>'))); }
    b0.push(...pre.filter(x => !/^<b>Skills/.test(x)));
    const bys = b0.length ? `<div class="pl-bys"><b class="pl-bt">Before you start</b><ul class="pl-ul">${b0.map(x => `<li>${x}</li>`).join('')}</ul></div>` : '';
    const awH = aw ? `<div class="pl-aw">${aw}</div>` : '';
    const bonH = bon.length ? `<div class="pl-bon"><b class="pl-bt">Bonus on this run</b>${DCL.q('Extras you can grab on the way. Only Legacy items in the Legacy Bag evolve. The route says when.')}<ul class="pl-ul">${bon.slice(0, 3).map(x => `<li>${x}</li>`).join('')}</ul>`
      + (bon.length > 3 ? `<details class="pl-more"><summary>show all (${bon.length})</summary><ul class="pl-ul">${bon.slice(3).map(x => `<li>${x}</li>`).join('')}</ul></details>` : '') + `</div>` : '';
    if (goalUl) { goalUl.classList.add('pl-goal'); goalUl.insertAdjacentHTML('beforebegin', '<div class="pl-gl"><b class="pl-bt">Your goal</b></div>'); }
    if (rt) { const sm = rt.querySelector('.small'); if (sm) sm.textContent = sm.textContent.replace(/ quest steps?$/, ' steps'); }
    const ins = (h, before) => { if (!h) return; const t = document.createElement('template'); t.innerHTML = h; f.insertBefore(t.content, before || null); };
    const after0 = fw || fh;
    ins(awH + bys, after0 ? after0.nextSibling : f.firstChild);
    const rest = bonH + after.join('');
    if (goalUl) ins(rest, goalUl.nextSibling); else ins(rest, rt || ol || one('.pl-bk2'));
    return box.innerHTML; };
  const focusHtml = (c, k, tot, body) => dclCard(focusHtml0(c, k, tot, body));
  const focusHtml0 = (c, k, tot, body) => { const t = tierOf(c.h, c.n, c.m), st = stOf(c.h);
    return `<div class="card pl-focus"${st ? ` data-st="${st}"` : ''}><div class="pl-fbar"><button type="button" class="pl-bk">← Back to all runs</button><span class="small">${k < 0 ? 'Not in the top runs' : `Run ${k + 1} of ${tot}`}</span></div>` + (FO ? gearSw() : '')   // GEAR LEVEL IN THE CARD
      + `<div class="pl-fh">${k < 0 ? '' : `<span class="pl-rk">${k + 1}</span>`}${heroLink(c.h)}${t ? `<span class="pl-tl t-${t}" title="Tier ${t}">${t}</span>` : ''}${st ? `<span class="pl-sb ${st}">${st.toUpperCase()}</span>` : ''}<b>N${c.n} ${MN[c.m]}</b>${lenW(c.mins) ? `<span class="small">${lenW(c.mins)} run</span>` : ''}</div>`
      + `<div class="pl-fw">${c.what}${c.fc != null ? ` · ${f10H(c.fc)}` : c.fr != null ? ` · ${f10H(c.fr, 1)}` : ''}${dclTags(c.tags).length ? ' ' + dclTags(c.tags).join('') : ''}</div>`
      + bagHtml(c) + chHtml(c) + otwHtml(c) + body + `<button type="button" class="pl-bk pl-bk2">← Back to all runs</button></div>`; };
  const filtHtml = () => { const f = CF(), hs = PD.heroes.filter(unlocked).map(h => hName(h)).sort((a, b) => a.localeCompare(b));
    return `<div class="pl-fb">`
      + `<div class="pl-fg"><span class="pl-fl">Hero</span><input id="pl-fhero" class="pl-hin" list="pl-hl" placeholder="Any hero" autocomplete="off" value="${f.h ? esc(hName(f.h)) : ''}">${f.h ? chip('h', '', '✕', false) : ''}<datalist id="pl-hl">${hs.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>`
      + `<div class="pl-fg"><span class="pl-fl">N</span>${chip('n', 0, 'Any', !f.ns.length)}${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => chip('n', n, 'N' + n, f.ns.includes(n))).join('')}</div>`
      + `<div class="pl-fg"><span class="pl-fl">Mode</span>${[['', 'Any'], ['m', 'Main'], ['c', 'Challenge'], ['d', 'Death']].map(([v, t]) => chip('m', v, t, f.m === v)).join('')}</div>`
      + `<div class="pl-fg"><span class="pl-fl">Length</span>${[[0, 'Any'], [5, 'Up to 5 h'], [3, 'Up to 3 h']].map(([v, t]) => chip('len', v, t, f.len === v)).join('')}</div>`
      + (f.h || f.ns.length || f.m || f.len ? chip('clr', '', 'Clear filters', false) : '') + `</div>`; };
  const ctlHtml = () => `<div class="pl-ctl"><span class="pl-fl">Gear</span>${GLN.map((t, j) => chip('gl', j, t, (+S.gl || 0) === j)).join('')}`
    + (PD.bbf || PD.rpf ? `<label class="pl-chk"><input type="checkbox" id="pl-rf" ${S.rf ? 'checked' : ''}> I'll farm rare drops</label>` : '') + `</div>`;
  /* ---- GEAR LEVEL IN THE CARD (patch_page_gearlevel): the list = the lightest-level list (GL_MIN) + the runs that only work at a
     heavier level (or only with rare drops), each card computed at its own level, ranked by the goal's own order; the open run is
     computed at FO.gl / FO.rf (switch in the card) */
  const LISTF = { points: () => pointsList(), start: () => startList(), legacy: () => legacyList() };
  const GLV = []; for (let j = GL_MIN; j < GLN.length; j++) GLV.push(j);
  /* one list per goal x gear level x rare drops, cached for your account + filters (the Legacy list takes ~1 s per level); callers get
     fresh card copies (tags / what / gl are written on them) */
  /* skip(h, n, m) = runs a lighter list already has: a heavier list for the page's list only builds the other runs (speed) */
  const LSTC = new Map();
  const listAt0 = (goal, gl, rf, deep, skip) => withG({ gl, rf }, () => { const cn = CARDN, sk = LSKIP; if (deep) CARDN = 60; LSKIP = skip || null;
    try { return LISTF[goal](); } finally { CARDN = cn; LSKIP = sk; } });
  const listAt = (goal, gl, rf, deep, skip) => { const k = JSON.stringify([goal, +gl || 0, !!rf, !!deep, !!skip, S.own, +S.ml || 1, +S.rank || 0, +S.pts || 0, +S.wp || 0, vipLv(), S.tok == null ? null : +S.tok, CF()]);
    let R = LSTC.get(k); if (!R) { R = listAt0(goal, gl, rf, deep, skip); LSTC.set(k, R); if (LSTC.size > 24) LSTC.delete(LSTC.keys().next().value); }
    return R.msg ? R : Object.assign({}, R, { cards: (R.cards || []).map(c => Object.assign({}, c, { tags: (c.tags || []).slice() })),
      find: R.find ? (h, n, m) => { const c = R.find(h, n, m); return c ? Object.assign({}, c, { tags: (c.tags || []).slice() }) : c; } : R.find }); };
  const hnmOf = key => String(key || '').split('|').slice(0, 4).join('|');
  const EASE2 = { m: 0, c: 1, d: 2 };
  const cardCmp = (goal, byLen) => byLen ? (a, b) => a.mins - b.mins : goal === 'points' ? (a, b) => b.r.best.sess - a.r.best.sess
    : (a, b) => rkV(b.r) - rkV(a.r) || a.r.mins - b.r.mins || a.n - b.n || EASE2[a.m] - EASE2[b.m] || (b.r.sc || 0) - (a.r.sc || 0);
  const needRk = c => c.rf ? 9 : c.gl;
  const needTag = c => c.rf ? tagH('needs rare drops', 'warn', 'Only works if you farm rare drops.') : tagH('needs: ' + GLN[c.gl], c.gl >= 2 ? 'warn' : '', 'Gear level this run needs: ' + GLN[c.gl] + '.');
  function mergedList(goal) {
    const base = listAt(goal, GL_MIN, false, false); if (base.msg) return base;
    const hasR = (R, h, n, m) => !!(R && !R.msg && R.has && R.has(h, n, m)), Rs = { [GL_MIN]: base };
    const skipB = lw => (h, n, m) => lw.some(g => hasR(Rs[g], h, n, m));
    const SK = {}; GLV.slice(1).forEach(g => { Rs[g] = listAt(goal, g, false, true, SK[g] = skipB(GLV.filter(x => x < g))); });
    const out = (base.cards || []).map(c => Object.assign(c, { gl: GL_MIN, rf: false })), seen = new Set(out.map(c => hnmOf(c.key)));
    const add = (R, gl, rf, lower) => { if (!R || R.msg) return; (R.cards || []).forEach(c => { const id = hnmOf(c.key); if (seen.has(id) || (c.r && c.r.ux)) return;
      if (lower.some(g => hasR(Rs[g], c.h, c.n, c.m))) return; seen.add(id); out.push(Object.assign(c, { gl, rf, ex: 1 })); }); };
    GLV.slice(1).forEach(g => add(Rs[g], g, false, GLV.filter(x => x < g)));
    if (RF_LIST && (PD.bbf || PD.rpf)) add(Rs.rf = listAt(goal, GL_MIN, true, true, SK.rf = skipB(GLV)), GL_MIN, true, GLV);
    const ux = out.filter(c => c.r && c.r.ux), main = out.filter(c => !(c.r && c.r.ux)).sort(cardCmp(goal, !!base.note)), fin = [];
    for (const c of main) { if (fin.length >= CARDN) break;   // a heavier-level run whose items a lighter (or equal) card above already gets: left out
      if (c.ex && c.ids && fin.some(d => needRk(d) <= needRk(c) && d.ids && c.ids.every(x => d.ids.includes(x)))) continue; fin.push(c); }
    const cards = fin.concat(ux); cards.forEach(c => c.tags.unshift(needTag(c)));
    return Object.assign({}, base, { cards, Rs, SK });
  }
  const GHINT = 'Gear level = how much you farm. Rare drops = also chase low-chance drops you can farm again and again (85% luck counts).';
  const gearSw = () => { const rfOn = !!(PD.bbf || PD.rpf);
    return `<div class="pl-ctl pl-gsw"><span class="pl-fl">Gear</span>` + GLV.map(j => { const off = j < FO.need, on = j === FO.gl;
      return `<button type="button" class="pl-chip${on ? ' on' : ''}" data-fg="${j}" aria-pressed="${on ? 'true' : 'false'}"${off ? ` aria-disabled="true" title="won't finish" style="opacity:.4;cursor:not-allowed"` : ''}>${esc(GLN[j])}</button>`; }).join('')
      + (rfOn ? `<label class="pl-chk"${FO.nrf ? ` title="won't finish"` : ''}><input type="checkbox" id="pl-frf" ${FO.rf ? 'checked' : ''}${FO.nrf ? ' disabled' : ''}> I'll farm rare drops</label>` : '')
      + `<div class="small pl-ghint" style="flex-basis:100%;margin:1px 0 0">${esc(rfOn ? GHINT : GHINT.split('. ')[0] + '.')}</div></div>`; };
  function focusOut(goal, R) {
    const hnm = hnmOf(FO.k), [, h, n, m] = hnm.split('|');
    let k = R.cards.findIndex(c => c.key === FO.k); if (k < 0) k = R.cards.findIndex(c => hnmOf(c.key) === hnm);
    const mc = k >= 0 ? R.cards[k] : null;
    if (FO.need == null) {
      if (mc) { FO.need = mc.gl; FO.nrf = !!mc.rf; }
      else { const R0 = (R.Rs || {}), hs = x => { const Rg = R0[x]; return !!(Rg && !Rg.msg && Rg.has && Rg.has(h, +n, m)); };
        const g = GLV.find(hs); if (g != null) { FO.need = g; FO.nrf = false; } else if (hs('rf')) { FO.need = GL_MIN; FO.nrf = true; } else return ''; } }
    if (FO.gl == null) { FO.gl = Math.max(GL_MIN, +S.gl || 0, FO.need); FO.rf = !!S.rf || !!FO.nrf; }   // your comfort pick, never below what the run needs
    FO.gl = Math.min(GLN.length - 1, Math.max(+FO.gl || 0, FO.need, GL_MIN)); if (FO.nrf) FO.rf = true;
    const pick = RL => (RL.cards || []).find(x => x.key === FO.k) || (RL.cards || []).find(x => hnmOf(x.key) === hnm) || (RL.find ? RL.find(h, +n, m) : null);
    return withG({ gl: FO.gl, rf: FO.rf }, () => { let RL = null, c = null;
      if (FO.gl === FO.need && !!FO.rf === !!FO.nrf && FO.need !== GL_MIN) { const R0 = (R.Rs || {})[FO.nrf ? 'rf' : FO.gl]; if (R0 && !R0.msg && R0.has && R0.has(h, +n, m)) { RL = listAt(goal, FO.gl, FO.rf, true, (R.SK || {})[FO.nrf ? 'rf' : FO.gl]); c = pick(RL); } }   // the list's own heavier list
      if (!c) { RL = listAt(goal, FO.gl, FO.rf, FO.gl !== GL_MIN || !!FO.rf); if (RL.msg) return ''; c = pick(RL); }
      if (!c) return mc ? focusHtml(mc, k, R.cards.length, `<p class="small pl-note">This run does not finish with this gear level.</p>`) : '';
      if (c.ids) c.what = `<b>${c.ids.length}</b> ${c.unit}${c.ids.length > 1 ? 's' : ''} · ${namesH(c.ids)}`;
      c.tags.unshift(needTag({ gl: FO.need, rf: FO.nrf }));
      return focusHtml(c, k, R.cards.length, RL.focus(c)); }); }
  function plannerOut(goal) {
    const R = mergedList(goal);
    if (R.msg) { FO = null; return R.msg; }
    /* what you get: the count + the first 2 names, the names the other cards do not share first (so similar cards stay tellable apart) */
    const fq = {}; R.cards.forEach(c => (c.ids || []).forEach(id => { fq[id] = (fq[id] || 0) + 1; }));
    R.cards.forEach(c => { if (c.ids) c.what = `<b>${c.ids.length}</b> ${c.unit}${c.ids.length > 1 ? 's' : ''} · ${namesH(c.ids.slice().sort((a, b) => fq[a] - fq[b]))}`; });
    if (FO && FO.g === goal) { const fh = focusOut(goal, R); if (fh) return fh; }
    const lost = !!(FO && FO.g === goal); FO = null;
    if (lost) R.note = (R.note ? R.note + ' ' : '') + 'The run you had open is not on the list any more.';
    const f = CF(), filt = f.h || f.ns.length || f.m || f.len;
    return filtHtml() + TAGS_KEY() + (R.note ? `<p class="small pl-note">${esc(R.note)}</p>` : '')
      + (R.cards.length ? `<div class="pl-cards">${R.cards.map((c, k) => withG({ gl: c.gl, rf: c.rf }, () => cardHtml(c, k))).join('')}</div>`
        : `<p class="small">${R.none ? esc(R.none) : filt ? 'No run matches these filters.' : 'No run found.'}</p>`)
      + (R.extra || '');
  }
  /* ---- VIP NEXT BUY (patch_planner_vip): the next VIP step vs the next title (W.calc.titles; Duke needs Map Level 15, Emperor 18,
     systems_guide titles.json), each tried as your account AFTER the buy (Points held minus the cost: a lost Ranking Reward bracket is
     counted) -> Points of a 3-hour session of your best Points run (unfiltered, as the Points farm ranks them) and the Map Level your account
     plays like. One line; a buy that drops you below a Points-held bracket always says so */
  const TGATE = { 5: 15, 8: 18 };
  const topSess = () => { const R = (W.calc || {}).points || []; let best = 0;
    for (let n = 1; n <= 9; n++) for (const m of ['m', 'c', 'd']) { const pr = R.find(r => r.n === n); if (!pr || !(PD.rp || {})[n + '|' + m]) continue;
      const pay = vipPay(n, m, Number(pr[MCALC[m]]) || 0) + lowPts(n);
      PD.heroes.forEach((h, i) => { if (!unlocked(h)) return; const e = eqStep(h, n, m), c = cellOf(n, m, i, e.k); if (!c || c.jl < 0) return;
        const mins = finT(c, lvlFor(c, 20 + n), n, m, i, e); if (!mins) return; const v = sessPts(pay, mins, jvRate(h, n, m, e)); if (v > best) best = v; }); }
    return best; };
  const mlEq = () => Math.round(['STR', 'AGI', 'INT'].reduce((t, p) => { const e = pStep(p); return t + (topStep(e) ? 190 : mlOf(e.s)); }, 0) / 3);
  const withS = (o, fn) => { const old = {}; for (const k in o) { old[k] = S[k]; S[k] = o[k]; } try { return fn(); } finally { Object.assign(S, old); } };
  const phOf = p => PTSH.find(x => (p || 0) >= x[0]), phPct = p => { const x = phOf(p); return x ? x[1].stat_amp_pct : 0; };
  let TIPK = '', TIPV = '';
  function buyTip() {
    const V = vipLv(), P = +S.pts || 0, ml = +S.ml || 1, rk = +S.rank || 0;
    const key = [V, P, ml, rk, +S.wp || 0, +G.gl || 0, G.rf ? 1 : 0, JSON.stringify(S.own)].join('|'); if (key === TIPK) return TIPV;
    let txt = '';
    try {
      const vs = VIPSTEP.find(x => x[0] === V), tl = ((W.calc || {}).titles || []).find(t => +t.tier === rk + 1), opts = [];
      if (vs) opts.push({ nm: `VIP ${vs[1]}`, cost: vs[2], set: { vip: vs[1] }, gate: 0, vip: 1 });
      if (tl) opts.push({ nm: `the ${tl.name} title`, cost: +tl.points || 0, set: { rank: rk + 1 }, gate: TGATE[rk + 1] || 0 });
      const base = topSess(), bml = mlEq();
      opts.forEach(o => { o.ok = P >= o.cost && ml >= o.gate; if (!o.ok) return;
        const r = withS(Object.assign({ pts: P - o.cost }, o.set), () => [topSess(), mlEq()]);
        o.gain = r[0] - base; o.ml = r[1]; o.lose = phPct(P) > phPct(P - o.cost) ? phOf(P)[0] : 0; });
      const warn = o => o.lose ? ` Careful: you drop below ${fmt(o.lose)} Points held (Ranking Reward +${phPct(P)}% → +${phPct(P - o.cost)}% amps), already counted.` : '';
      const mlT = o => o.ml > bml ? `, your account plays like Map Level ~${bml} → ~${o.ml}` : '';
      const PAYMAX = 30;   // sessions: a buy that takes longer to pay back is not recommended
      const payAll = opts.filter(o => o.ok && o.gain >= 1).sort((a, b) => a.cost / a.gain - b.cost / b.gain), pay = payAll.filter(o => o.cost / o.gain <= PAYMAX), slow = payAll.filter(o => o.cost / o.gain > PAYMAX);
      const stat = opts.filter(o => o.ok && !(o.gain >= 1) && o.gain > -1 && o.ml > bml);
      if (pay.length) { const o = pay[0];
        txt = `${o.nm} (${fmt(o.cost)} Points): +${fmt(Math.round(o.gain))} Points per 3-hour session, pays back in ~${fmt(Math.ceil(o.cost / o.gain))} session${Math.ceil(o.cost / o.gain) > 1 ? 's' : ''}${mlT(o)}${o.vip ? '. VIP starts next game: buy, -save, rehost' : ''}.${warn(o)}`; }
      else if (stat.length) { const o = stat[0];
        txt = `${o.nm} (${fmt(o.cost)} Points): ${o.vip ? `+${o.set.vip} Str/Agi/Int per hero level` : '+60 Str/Agi/Int'}${mlT(o)}; no extra Points per session.${warn(o)}`; }
      else if (slow.length) { const o = slow[0];
        txt = `keep your Points for now: the best buy, ${o.nm} (${fmt(o.cost)} Points), takes ~${fmt(Math.ceil(o.cost / o.gain))} sessions of 3 hours to pay back.${warn(o)}`; }
      else { const lost = opts.find(o => o.ok && o.lose);
        if (lost) txt = `keep your Points. ${lost.nm} (${fmt(lost.cost)}) drops you below ${fmt(lost.lose)} Points held (Ranking Reward +${phPct(P)}% → +${phPct(P - lost.cost)}% amps) and that costs more than it gives: buy it at ${fmt(lost.lose + lost.cost)} Points.`;
        else { const up = opts.map(o => !o.ok ? (ml < o.gate ? `${o.nm} needs Map Level ${o.gate}` : `${o.nm} costs ${fmt(o.cost)} (${fmt(o.cost - P)} to go)`) : '').filter(Boolean);
          const nb = PTSH.map(x => x[0]).filter(x => x > P).pop();
          txt = up.length || nb ? `save up. ${up.concat(nb ? [`${fmt(nb - P)} more Points held lifts the Ranking Reward to +${phPct(nb)}% amps`] : []).join(', ')}.` : ''; } }
    } catch (e) { txt = ''; }
    TIPK = key; TIPV = txt ? `<p class="small pl-tip"><b>Next buy:</b> ${txt}</p>` : '';
    return TIPV; }
  const vipTxt = () => { const V = vipLv(); return V ? ` VIP ${V} counted: +${V} Str/Agi/Int per hero level, kill and quest gold / Boss Souls x(0.8 + 0.2N + ${0.5 * V}) instead of x(0.8 + 0.2N), Points x${+(1 + 0.3 * V).toFixed(1)}, stone chances +${5 * V}%. The replays are VIP 0 players, so every run shown only gets easier for you; a full VIP-aware simulation comes on a lab night.` : ''; };
  /* ---- page */
  function legacyPicker() {
    return `<div class="pl-lg">` + LINES.map(l => `<label class="pl-l"><span>${esc(l.name)} <span class="small">${esc(l.slot || '')}</span></span><select data-line="${esc(l.name)}"><option value="">-</option>`
      + (l.steps || []).map(s => `<option value="${esc(s.id)}" ${S.own[l.name] === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('') + `</select></label>`).join('') + `</div>`;
  }
  const GLD = ["just enough to reach the run's last boss", 'a bit more than just enough', 'the heaviest replayed gear that gets there'];
  P.planner = (_, f) => {
    const goal = ['points', 'legacy', 'start'].includes(f.goal) ? f.goal : (S.goal || (Object.keys(S.own).length ? 'legacy' : 'start'));
    if (goal !== S.goal) { S.goal = goal; save(); }
    const nOwn = Object.keys(S.own).length;
    return `<h2>Run planner <span class="tag warn">beta</span></h2><p class="small">Numbers are still being tuned with player tests. If a run plays out differently in game, the game wins. </p><p><a class="hlbtn" href="report.html" target="_blank" rel="noopener">Played a run? Send a test report (2 min)</a></p>`
      + `<div class="card pl-in"><div class="pl-top"><b>Your Legacy</b> <span class="small">${nOwn ? nOwn + (nOwn > 1 ? ' lines' : ' line') + ' set' + (S.src ? ' from your save' : '') : 'nothing set yet'}</span>`
      + `<label class="btn pl-file hlbtn">${S.src === 'save' ? 'Load another save' : 'Load save file'}<input type="file" id="pl-save" accept=".pld,.txt" multiple hidden></label>`
      + (nOwn ? `<button class="btn" id="pl-clear" type="button">Clear</button>` : '') + `</div>`
      + (S.src === 'save' ? '' : `<div class="pl-cta small"><b>Best: load your save file.</b> Your Map Level, title, Points, VIP and every Legacy item are read from it, so every plan fits your account.</div>`)
      + `<p class="small">Save file: Documents\\Warcraft III\\CustomMapData\\TheAdventurersPathRPG\\ (the .pld file, plus its _P0, _P1 ... files if it has them). It stays in your browser. Or pick your Legacy items by hand:</p>`
      + (S.err ? `<p class="small pl-err">${esc(S.err)}</p>` : '')
      + `<div class="pl-acc"><label class="cl-f"><span>Map Level</span><input type="number" id="pl-ml" min="1" max="999" value="${esc(S.ml || 1)}"></label>`
      + `<label class="cl-f"><span>World Points</span><input type="number" id="pl-wp" min="0" max="99999" value="${esc(S.wp || 0)}"></label>`
      + `<label class="cl-f"><span>Points</span><input type="number" id="pl-pts" min="0" max="99999999" value="${esc(S.pts || 0)}"></label>`
      + `<label class="cl-f"><span>VIP</span><select id="pl-vip">${[0, 1, 2].concat(vipLv() === 3 ? [3] : [], [4, 10]).map(v => `<option value="${v}" ${vipLv() === v ? 'selected' : ''}>${v ? 'VIP ' + v : 'No VIP'}</option>`).join('')}</select></label>`
      + `<label class="cl-f"><span>Title</span><select id="pl-rank">${TITLES.map(([k, n]) => `<option value="${k}" ${+S.rank === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`
      + (S.src === 'save' ? `<span class="small">from your save · ${fmt(S.pts)} Points${vipLv() ? ' · VIP ' + vipLv() : ''}</span>` : '') + `</div>`
      + buyTip()
      + `<details class="pl-d" ${nOwn ? '' : 'open'}><summary>Legacy items by line</summary>${legacyPicker()}</details></div>`
      + subtabs('planner', 'goal', [['start', 'First Legacy items'], ['legacy', 'Legacy upgrades'], ['points', 'Points farm']], goal)
      + `<div class="pl-out">${plannerOut(goal)}</div>`
      + `<details class="pl-d pl-how small"><summary>How runs are ranked</summary><p class="small">Your account plays like a normal ${esc(accTxt())} (your bonuses, title and Legacy weighed by what each hero needs).${vipTxt()} Every run is a full replay of a normal player (walking, reading, creeps, farming, every boss; a death resets the fight) with your Map Level bonuses, title and Legacy (at +0: enhancing resets every run). Gear: ${SHOW_JUST_ENOUGH ? 'each run is ranked with the lightest gear that finishes it' : 'each run is ranked with a bit more gear than the bare minimum'} (more when its tag says so); pick yours inside the run card. Kill counts = 85% luck. Only heroes your Map Level and World Points unlock.</p></details>`;
  };
  const plBack = () => { FO = null; K.route(); window.scrollTo(0, FOY); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && FO && document.body.dataset.page === 'planner' && document.querySelector('.pl-focus')) plBack(); });
  K.hooks.push((page, out) => {
    if (page !== 'planner') return;
    if (!out._plTip) { out._plTip = 1;   /* PLANNER TAGS: a tap on a tag shows its tip under the line (phones have no hover), the card stays shut */
      out.addEventListener('click', e => { const t = e.target.closest && e.target.closest('.pl-tip'); if (!t || document.body.dataset.page !== 'planner') return; e.preventDefault(); e.stopPropagation();
        const nx = t.nextElementSibling; if (nx && nx.classList.contains('pl-tipx')) { nx.remove(); return; }
        const d = document.createElement('span'); d.className = 'small pl-tipx'; d.style.display = 'block'; d.textContent = t.dataset.tip || t.title || ''; t.after(d); }, true); }
    const fi = out.querySelector('#pl-save');
    if (fi) fi.addEventListener('change', e => { const fs = [...e.target.files]; if (!fs.length) return;
      Promise.all(fs.map(f => f.text().then(text => ({ name: f.name, text })))).then(files => { const r = readSave(files);
        if (!r.valid) { S.err = 'That is not an Adventurer’s Path save. Pick P..._SaveChar_TheAdventurersPathRPG.pld (and its _P0, _P1 ... files if it has them).'; K.route(); return; }
        S.own = r.own; S.pts = r.pts; S.ml = r.ml; S.rank = r.rank; S.wp = r.wp; S.vip = r.vip || 0; S.src = 'save'; S.tok = r.tok;   // PREREQ GATES: Challenge Tokens (save key Itzlp)
        S.err = r.n ? '' : r.saved ? 'Save loaded: no Legacy items in your Legacy Bag or storages yet.' : 'Save loaded, but it is still empty (new account): the game writes Legacy, Points and Map Level when you type -save in game.';
        save(); K.route(); }); });
    const mi = out.querySelector('#pl-ml'); if (mi) mi.addEventListener('change', () => { S.ml = Math.max(1, parseInt(mi.value, 10) || 1); save(); K.route(); });
    const pi = out.querySelector('#pl-pts'); if (pi) pi.addEventListener('change', () => { S.pts = Math.max(0, parseInt(pi.value, 10) || 0); save(); K.route(); });
    const wi = out.querySelector('#pl-wp'); if (wi) wi.addEventListener('change', () => { S.wp = Math.max(0, parseInt(wi.value, 10) || 0); save(); K.route(); });
    const vi = out.querySelector('#pl-vip'); if (vi) vi.addEventListener('change', () => { S.vip = parseInt(vi.value, 10) || 0; save(); K.route(); });
    const ri = out.querySelector('#pl-rank'); if (ri) ri.addEventListener('change', () => { S.rank = parseInt(ri.value, 10) || 0; save(); K.route(); });
    const rf = out.querySelector('#pl-rf'); if (rf) rf.addEventListener('change', () => { S.rf = rf.checked; for (const x in FCUT) delete FCUT[x]; save(); K.route(); });
    const cb = out.querySelector('#pl-clear'); if (cb) cb.addEventListener('click', () => { S.own = {}; S.src = ''; save(); K.route(); });
    out.querySelectorAll('select[data-line]').forEach(sel => sel.addEventListener('change', () => { if (sel.value) S.own[sel.dataset.line] = sel.value; else delete S.own[sel.dataset.line]; S.src = ''; save(); K.route(); }));
    /* CARDS UI: chips (gear level, filters), hero search, cards, back */
    out.querySelectorAll('.pl-chip[data-cf]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.cf, v = b.dataset.v, f = CF();
      if (k === 'gl') S.gl = +v || 0;
      else if (k === 'n') { const n = +v; f.ns = !n ? [] : f.ns.includes(n) ? f.ns.filter(x => x !== n) : f.ns.concat(n).sort((a, b) => a - b); }
      else if (k === 'm') f.m = v; else if (k === 'len') f.len = +v || 0; else if (k === 'h') f.h = ''; else if (k === 'clr') S.cf = {};
      save(); K.route(); }));
    const hi = out.querySelector('#pl-fhero');
    if (hi) hi.addEventListener('change', () => { const q = hi.value.trim().toLowerCase(), hs = PD.heroes.filter(unlocked);
      let h = hs.find(x => hName(x).toLowerCase() === q); if (!h && q) { const c = hs.filter(x => hName(x).toLowerCase().includes(q)); if (c.length === 1) h = c[0]; }
      if (q && !h) { hi.classList.add('pl-bad'); return; }
      CF().h = h || ''; save(); K.route(); });
    const open = el => { FOY = window.scrollY; FO = { g: S.goal, k: el.dataset.run }; K.route(); const fe = document.querySelector('.pl-focus'); if (fe) fe.scrollIntoView({ block: 'start' }); };
    out.querySelectorAll('.pl-card[data-run]').forEach(el => { el.addEventListener('click', e => { if (!e.target.closest('a')) open(el); });
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); } }); });
    out.querySelectorAll('.pl-bk').forEach(b => b.addEventListener('click', plBack));
    /* GEAR LEVEL IN THE CARD: the open run's switch (greyed levels do nothing); the pick is remembered as your comfort level */
    out.querySelectorAll('.pl-gsw [data-fg]').forEach(b => b.addEventListener('click', () => { if (!FO || b.getAttribute('aria-disabled') === 'true') return;
      const v = +b.dataset.fg; FO.gl = v; S.gl = v; save(); K.route(); }));
    const frf = out.querySelector('#pl-frf'); if (frf) frf.addEventListener('change', () => { if (!FO) return; if (FO.nrf) { frf.checked = true; return; }
      FO.rf = frf.checked; S.rf = frf.checked; save(); K.route(); });
  });
  /* tier list hooks: finishes at your account (replay), and 'fast' = light gear finishes at the tier list's own account (Main: ML 15 / 35 / 70;
     Challenge / Death: the veteran accounts) */
  const TYP = { m: [1, 3, 6], c: [3, 5, 7], d: [5, 7, 8] };
  const fin = (h, n, m) => { const i = HIDX[h]; if (i === undefined) return true; if (!unlocked(h)) return false; const c = cellOf(n, m, i, eqStep(h, n, m).k); return !!c && c.jl >= 0; };
  const lightT = (h, n, m, mine) => { const i = HIDX[h]; if (i === undefined) return null; const c = cellOf(n, m, i, mine ? eqStep(h, n, m).k : TYP[m][n <= 3 ? 0 : n <= 6 ? 1 : 2]); return c && c.jl >= 0 && c.jl <= 1 && c.tot[c.jl] ? c.tot[c.jl] : null; };
  const FCUT = {};   /* 'fast' = finishes with light gear AND among the quickest ~15% of those runs (same N, mode, account view) */
  const fast = (h, n, m, mine) => { const t = lightT(h, n, m, mine); if (t == null) return null; const k = n + m + (mine ? 'y' + (S.ml || 1) + '_' + (S.rank || 0) + '_' + (S.wp || 0) + '_' + vipLv() + '_' + (+S.pts || 0) + '_' + Object.values(S.own).join('') : 't');
    if (FCUT[k] === undefined) { const ts = PD.heroes.map(x => lightT(x, n, m, mine)).filter(x => x != null).sort((a, b) => a - b); FCUT[k] = ts.length ? ts[Math.max(0, Math.ceil(ts.length * 0.15) - 1)] : 0; }
    return t <= FCUT[k] ? t : null; };
  const near = (h, n, m) => { const i = HIDX[h]; return i !== undefined && unlocked(h) && nearFin(n, m, i, eqStep(h, n, m)); };
  K.plan = { saved: () => S.src === 'save', has: () => Object.keys(S.own).length > 0 || (S.ml || 1) > 1 || (S.rank || 0) > 0 || vipLv() > 0, step: (p, h, n, m) => h ? eqStep(h, n || 5, m || 'm').k : pStep(p).k,
             PD, stepTxt, fin, fast, near, eq: eqStep, best6 };   // LEGACY BAG: hero pages
  INDEX.push({ k: 'planner', id: '', t: 'Run planner', s: 'planner run legacy upgrade points farm save file best hero', w: 5 });
})(window.AP);
