/* Interactive map (Map tab, mini maps on zone / boss pages and in zone cards): terrain image rendered from war3map.w3e + landmarks from the
   map script (build.py map block), SVG with pan / zoom. Every portal, path, gate and boat shows where it leads when tapped.
   W.map = {world:{minX,minY,maxX,maxY}, img:{w,h,src}, zones:[{id,name,b:[minX,minY,maxX,maxY],c:[x,y] label spot}],
            pts:[{k,n,x,y,zone,also,tz,tzs,to,ti,fi,twin,needs,who,id,ids,qg,href}]}
   k = boss / portal / exit (arrival spot) / door (walk path between zones) / gate / stone / circle / quest / npc / dock.
   ti = index of the point this one leads to, fi = indexes of the points that lead here, tz / tzs = zone(s) a path, gate or boat leads to,
   twin = index of the boss marker a quest giver stands on (not drawn twice).
   For other tabs: K.miniMap(el, zoneId, {boss}) draws a compact map of one zone into el (false if the zone has no map box);
   any page or card html holding <div class="mp-slot" data-zone="z06" data-boss="O00K"></div> gets one automatically. */
(function (K) {
  const { W, P, esc, hooks, INDEX } = K; const M = W.map; if (!M) return;
  const { minX, minY, maxX, maxY } = M.world, IW = M.img.w, IH = M.img.h, PTS = M.pts;
  const px = x => (x - minX) / (maxX - minX) * IW, py = y => (maxY - y) / (maxY - minY) * IH;
  const ZB = {}; for (const z of M.zones) ZB[z.id] = z;
  /* UX pass 2: SHN = shop names (a shop merged into a neighbour's marker is found by its name), ZO = which zone name wins when two collide:
     towns first, then main-quest zones, then side zones, each in run order (was: biggest box first, which hid Start Camp, Windmill Village
     and Steel Fortress on the opening view of the Map tab) */
  const SHN = Object.fromEntries((W.shops || []).map(s => [s.id, s.name])), ZO = {};
  (W.zones || []).forEach(z => { ZO[z.id] = ((z.shops || []).some(x => SHN[x]) ? 0 : z.optional ? 200 : 100) + (+z.order || 0); });
  const DK = '#0b0f14';   /* marker colours are fixed, not theme colours: they sit on the terrain picture, which is the same in both themes */
  const KINDS = { boss: ['Bosses', '#ff5a52'], portal: ['Portals', '#c490ff'], door: ['Paths', '#3fe0c5'], gate: ['Gates', '#ffae2b'], stone: ['Teleport Stones', '#62c9ff'],
                  circle: ['Energy Circles', '#86e27a'], quest: ['Quest givers', '#ffd83a'], npc: ['Shops and NPCs', '#eef1f0'], dock: ['Boats', '#e3a86a'] };
  const KL = { boss: 'Boss', portal: 'Portal', exit: 'Arrival', door: 'Path', gate: 'Gate', stone: 'Teleport Stone', circle: 'Energy Circle', quest: 'Quest giver', npc: 'Shop / NPC', dock: 'Boat' };
  const LAY = k => k === 'exit' ? 'portal' : KINDS[k] ? k : 'npc';
  const MINOR = new Set(['npc', 'quest', 'circle', 'dock']), PRI = { boss: 0, portal: 1, exit: 1, door: 2, gate: 2, stone: 3, dock: 4 };
  const LINK = { portal: 'p', door: 'w', quest: 'i', npc: 'i' };
  const zc = z => ZB[z] ? [px(ZB[z].c[0]), py(ZB[z].c[1])] : null;
  const f1 = v => (+v).toFixed(1);
  /* the way a path or gate points: toward its other end, else from its zone's label spot out through it (screen degrees) */
  const ang = p => { if (p.x == null) return 0; const t = p.ti != null ? PTS[p.ti] : (p.fi || []).length ? PTS[p.fi[0]] : null, c = zc(p.zone), me = [px(p.x), py(p.y)];
    const a = t ? me : c || [me[0], me[1] + 1], b = t ? [px(t.x), py(t.y)] : me; return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; };
  const shape = p => { const c = KINDS[LAY(p.k)][1], o = `stroke="${DK}"`;
    if (p.k === 'boss') return `<circle r="5.6" fill="${c}" ${o} stroke-width="1.6"/><circle r="1.9" fill="#fff"/>` + (p.ids || p.xn ? `<circle r="8.8" fill="none" stroke="${c}" stroke-width="1.7" stroke-dasharray="2.4 1.8"/>` : '')
      + (p.qg ? `<circle cx="5.2" cy="-5.2" r="2.8" fill="${KINDS.quest[1]}" ${o} stroke-width="1"/>` : '');
    if (p.k === 'portal') return `<circle r="5.2" fill="none" ${o} stroke-width="4.8"/><circle r="5.2" fill="none" stroke="${c}" stroke-width="2.6"/><circle r="1.9" fill="${c}"/>`;
    if (p.k === 'exit') return `<circle r="5" fill="rgba(11,15,20,.45)" ${o} stroke-width="4.2"/><circle r="5" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="2.6 1.7"/>`;
    if (p.k === 'door') return `<g transform="rotate(${ang(p).toFixed(0)})"><path d="M-4.6 -5.4L6.2 0L-4.6 5.4L-1.6 0Z" fill="${c}" ${o} stroke-width="1.5" stroke-linejoin="round"/></g>`;
    if (p.k === 'gate') return `<rect x="-5" y="-5" width="10" height="10" rx="1.5" fill="${c}" ${o} stroke-width="1.5"/><path d="M-1.8 -4.2v8.4M1.8 -4.2v8.4" ${o} stroke-width="1.3"/>`;
    if (p.k === 'stone') return `<rect x="-4.4" y="-4.4" width="8.8" height="8.8" transform="rotate(45)" fill="${c}" ${o} stroke-width="1.5"/>`;
    if (p.k === 'circle') return `<circle r="4.6" fill="none" ${o} stroke-width="4.4"/><circle r="4.6" fill="none" stroke="${c}" stroke-width="2.3"/>`;
    if (p.k === 'quest') return `<circle r="5.8" fill="${c}" ${o} stroke-width="1.4"/><path d="M0 -3v3.2M0 2.3v.6" ${o} stroke-width="1.9" stroke-linecap="round"/>`;
    if (p.k === 'dock') return `<path d="M-6.2 -1h12.4l-2.8 5.4h-6.8zM-.5 -1.2v-5.6l4.4 3.8z" fill="${c}" ${o} stroke-width="1.2" stroke-linejoin="round"/>`;
    return `<circle r="3.3" fill="${c}" ${o} stroke-width="1.3"/>`; };
  /* one marker; cls: L-<layer> for map markers, sel / end / zm / me for the highlight copies drawn on top */
  const mk = (p, i, cls, lab, lx) => { const x = f1(px(p.x)), y = f1(py(p.y)), ring = /\b(sel|end|me)\b/.test(cls);
    return `<g class="mp-mk ${cls}" data-i="${i}" data-x="${x}" data-y="${y}" transform="translate(${x},${y})">${cls.includes('L-') ? `<title>${esc(p.n)}</title>` : ''}<g class="sh">${ring ? '<circle class="mp-ring" r="9.5"/>' : ''}${shape(p)}</g>${lab ? `<text class="mp-ml" x="${lx || 9}" y="3.6">${esc(lab)}</text>` : ''}</g>`; };
  const zbox = (z, ar) => { const b = ZB[z].b; let x0 = px(b[0]), x1 = px(b[2]), y0 = py(b[3]), y1 = py(b[1]); const pad = Math.max(x1 - x0, y1 - y0) * 0.16 + 24;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad; const w = x1 - x0, h = y1 - y0, s = Math.max(w, h * ar); return [x0 + (w - s) / 2, y0 + (h - s / ar) / 2, s, s / ar]; };
  /* o: focus = zone id (view box around it), hl = set of point indexes to label, mark = point index ringed in gold, mini = compact, sel = point to open */
  function svg(o) {
    o = o || {}; let vb = o.focus && ZB[o.focus] ? zbox(o.focus, 1.6) : [0, 0, IW, IH]; const hl = new Set(o.hl || []);
    const SP = (o.spots || []).filter(q => q && isFinite(q[0]) && isFinite(q[1]));
    if (SP.length && o.mark == null) { const xs = SP.map(q => px(q[0])), ys = SP.map(q => py(q[1])); let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const w = Math.max(x1 - x0 + 130, 260), h = Math.max(y1 - y0 + 90, w / 1.6), W_ = Math.max(w, h * 1.6); vb = [(x0 + x1) / 2 - W_ / 2, (y0 + y1) / 2 - W_ / 1.6 / 2, W_, W_ / 1.6]; }   // frame the spawn spots
    if (o.focus && o.mark != null && PTS[o.mark]) { const p = PTS[o.mark], w = Math.max(vb[2] * 0.85, 230), h = w / 1.6; vb = [px(p.x) - w / 2, py(p.y) - h / 2, w, h]; }   // zoom in on the target
    const zhi = z => { if (!ZB[z]) return ''; const b = ZB[z].b, x0 = f1(px(b[0])), x1 = f1(px(b[2])), y0 = f1(py(b[3])), y1 = f1(py(b[1]));
      return `<path class="mp-dim" fill-rule="evenodd" d="M-9999 -9999H${IW + 9999}V${IH + 9999}H-9999Z M${x0} ${y0}H${x1}V${y1}H${x0}Z"/><rect class="mp-zhi" x="${x0}" y="${y0}" width="${f1(x1 - x0)}" height="${f1(y1 - y0)}" rx="5"/>`; };
    for (const i of [...hl]) if (PTS[i] && PTS[i].twin != null) hl.add(PTS[i].twin);   // a quest giver standing on its own boss marker is drawn as that marker
    const zl = M.zones.map(z => `<text class="mp-zl${o.focus === z.id ? ' hz' : ''}" data-z="${z.id}" data-o="${ZO[z.id] != null ? ZO[z.id] : 999}" x="${f1(px(z.c[0]))}" y="${f1(py(z.c[1]))}" dy="-.9em">${esc(z.name)}</text>`).join('');
    const ln = PTS.map(p => p.ti != null && LINK[p.k] ? `<line class="mp-ln l-${LINK[p.k]} L-${LAY(p.k)}" x1="${f1(px(p.x))}" y1="${f1(py(p.y))}" x2="${f1(px(PTS[p.ti].x))}" y2="${f1(py(PTS[p.ti].y))}"/>` : '').join('');
    const fz = o.focus && ZB[o.focus] ? ZB[o.focus].name + ' ' : '', lab = (p, n) => { n = n || p.n; return fz && p.zone === o.focus && n.startsWith(fz) ? cap(n.slice(fz.length)) : n; };   // in a zone's map its own name is dropped
    /* the target (o.mark) is drawn last so no marker covers it, and named after what the card is about (o.markName: one arena boss, a merged shop) */
    const one = (p, i) => mk(p, i, `L-${LAY(p.k)}${MINOR.has(p.k) ? ' mn' : ''}${hl.has(i) ? ' hl' : ''}${o.mark === i ? ' me' : ''}`, o.mark === i ? lab(p, o.markName) : hl.has(i) ? lab(p) : '');
    const mks = PTS.map((p, i) => p.twin != null || i === o.mark ? '' : one(p, i)).join('') + (o.mark != null && PTS[o.mark] ? one(PTS[o.mark], o.mark) : '');
    return `<div class="mp-box${o.mini ? ' mini' : ''}"${o.focus ? ` data-focus="${o.focus}"` : ''}${o.sel ? ` data-sel="${esc(o.sel)}"` : ''}>`
      + `<svg class="mp-svg" viewBox="${vb.map(f1).join(' ')}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map${o.focus ? ' of ' + esc(ZB[o.focus].name) : ''}"><image href="${M.img.src}" x="0" y="0" width="${IW}" height="${IH}" preserveAspectRatio="none"/>${o.focus ? zhi(o.focus) : ''}${SP.map(q => `<circle class="mp-spot" cx="${f1(px(q[0]))}" cy="${f1(py(q[1]))}" r="${Math.min(14, 6 + (q[2] || 1) / 4)}"/>`).join('')}`
      + `<g class="mp-zls">${zl}</g><g class="mp-lines">${ln}</g><g class="mp-marks">${mks}</g><g class="mp-top"></g></svg>`
      + `<div class="mp-btn"><button type="button" data-z="1.6" title="Zoom in" aria-label="Zoom in">+</button><button type="button" data-z="0.625" title="Zoom out" aria-label="Zoom out">−</button><button type="button" data-z="0" title="Reset view" aria-label="Reset view">⟲</button></div>`
      + (o.mini ? (o.focus ? `<a class="mp-full" href="#map/${o.mark != null && PTS[o.mark] ? 'p' + o.mark : o.focus}">Full map</a>` : '') : '<div class="mp-hint">Tap a marker or a zone name</div>') + '<div class="mp-panel" hidden></div></div>';
  }

  /* ---------- the small info panel (opens inside the map box, never leaves the page) ---------- */
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : '';
  const opens = n => !n ? 'Always open' : /^always/i.test(n) ? 'Always open' + n.slice(6) : /^opens? /i.test(n) ? cap(n) : /^when /i.test(n) ? 'Opens ' + n : /^key /i.test(n) ? 'Needs the ' + n.slice(4) : 'Needs: ' + n;
  const head = (t, sub) => `<div class="mph"><b>${t}</b><a href="#" class="mpx" title="Close">×</a></div>${sub ? `<div class="small">${sub}</div>` : ''}`;
  const zlk = z => ZB[z] ? `<a href="#zones/${z}" class="mp-z" data-z="${z}">${esc(ZB[z].name)}</a>` : '';
  const ptl = (j, own) => { const q = PTS[j]; return `<a href="#map" class="mp-p" data-i="${j}">${esc(q.n)}</a>${!own && q.k !== 'exit' && ZB[q.zone] ? ` <span class="small">· ${esc(ZB[q.zone].name)}</span>` : ''}`; };
  const endLab = (q, p, nm) => (nm || q.n) + (q.k === 'circle' ? ' Energy Circle' : '') + (q.k !== 'exit' && ZB[q.zone] && q.zone !== p.zone ? ' · ' + ZB[q.zone].name : '');
  const rule = q => [q.k === 'portal' || q.k === 'gate' ? opens(q.needs) : q.needs ? 'Needs: ' + q.needs : '', q.who].filter(Boolean).join(' · ');
  const dest = p => p.ti != null ? PTS[p.ti].zone : p.tz;
  /* bosses and shops reuse the site's quick-look card (same numbers as everywhere else), zone links inside it stay on the map */
  const inMap = h => h.replace(/<a href="#zones\/(z\d+)">/g, '<a href="#zones/$1" class="mp-z" data-z="$1">');
  const peek = (pg, id) => { try { return id && K.peekCard ? inMap(K.peekCard(pg, id) || '').replace(/<div class="mp-slot[^"]*"[^>]*><\/div>/g, '') : ''; } catch (e) { return ''; } };   // no mini map inside the map's own panel
  function info(p) {
    const qs = ((W.quests || {}).side || []).filter(q => q.npc && q.npc.id === p.id), card = p.k === 'boss' ? peek('boss', p.id) : p.k === 'quest' || p.k === 'npc' ? peek('shop', p.id) : '';
    let x = '';   // what this tab adds: where it leads, what it needs, what leads here
    if (p.k === 'boss' && (p.ids || p.xn)) { const all = [...p.ids.filter(b => W.boss[b]).map(b => K.link('boss', b, W.boss[b].name)), ...(p.xn || []).map(esc)];
      x += `<div class="small">${all.length} bosses spawn here:</div><div class="small mp-scroll">${all.join(', ')}</div>`; }
    else if (p.k === 'portal') x += (dest(p) ? `<div class="mp-to">→ ${zlk(dest(p))}</div>` : '') + `<div class="small">${esc(rule(p))}</div>`;
    else if (p.k === 'door') { const j = p.ti != null ? p.ti : (p.fi || [])[0];
      x += (j != null ? `<div class="mp-to">↔ ${ptl(j)}</div>` : p.tz ? `<div class="mp-to">→ ${zlk(p.tz)}</div>` : '') + '<div class="small">On foot</div>'; }
    else if (p.k === 'gate') x += (p.tz ? `<div class="mp-to">→ ${zlk(p.tz)}</div>` : '') + `<div class="small">${esc(opens(p.needs))}</div>`;
    else if (p.k === 'stone' || p.k === 'circle') x += `<div class="small">${p.needs ? esc(cap(p.needs)) + ', then' : 'Walk onto it once to light it, then'} Teleport (P) here from anywhere.</div>`;
    else if (p.k === 'dock') x += '<div class="small">Buy a boat here (4,000 gold, carries 10 units).</div>' + ((p.tzs || []).length ? `<div class="mp-to">Sail to ${p.tzs.map(zlk).join(', ')}</div>` : '');
    if (!card && qs.length) x += `<div class="small">Quests: ${qs.map(q => esc(q.name.replace(/^Hidden Quest - /, ''))).join(', ')}</div>`;
    if (p.k === 'boss' && card && qs.length) x += `<div class="small">Quests: ${qs.map(q => esc(q.name.replace(/^Hidden Quest - /, ''))).join(', ')}</div>`;
    if ((p.k === 'quest' || p.k === 'npc') && p.ti != null) x += `<div class="mp-to">→ ${zlk(dest(p))}</div>${p.needs ? `<div class="small">Needs: ${esc(p.needs)}</div>` : ''}`;
    const fiW = p.k === 'door' ? [] : (p.fi || []).filter(j => PTS[j].k === 'door'), fiP = p.k === 'door' ? [] : (p.fi || []).filter(j => PTS[j].k !== 'door');
    if (fiW.length) x += fiW.map(j => `<div class="mp-to">↔ ${ptl(j)}</div>`).join('') + '<div class="small">On foot</div>';
    if (fiP.length) x += '<div class="small">Arrive here from:</div>' + fiP.map(j => `<div class="mp-to">← ${ptl(j)}${rule(PTS[j]) ? `<div class="small">${esc(rule(PTS[j]))}</div>` : ''}</div>`).join('');
    if (card) { const k = card.lastIndexOf('<div class="pk-open">'); return k >= 0 ? card.slice(0, k) + x + card.slice(k) : card + x; }
    return head(esc(p.n), [esc(KL[p.k] || ''), p.zone && ZB[p.zone] ? zlk(p.zone) : ''].filter(Boolean).join(' · ')) + x
      + (p.href ? `<div class="mp-open"><a href="${p.href}" class="pk-go">Open page →</a></div>` : '');
  }
  function zoneInfo(z) {
    const zd = (W.zones || []).find(x => x.id === z) || {}, R = (W.reach || {})[z], ins = [], outs = [], walk = new Set(), boat = new Set();
    PTS.forEach((p, i) => { if (p.k === 'exit') return; const t = dest(p), ts = t ? [t] : p.tzs || []; if (!ts.length) return;
      const side = p.k === 'dock' ? boat : p.k === 'door' || p.k === 'gate' ? walk : null;
      if (side) { if (p.zone === z) ts.forEach(x => { if (x !== z) side.add(x); }); else if (ts.includes(z) && p.zone) side.add(p.zone); return; }
      if (p.zone === z && t && t !== z) outs.push(i); else if (p.zone !== z && ts.includes(z)) ins.push(i); });
    const bl = (zd.bosses || []).filter(b => W.boss[b]);
    return head(esc(ZB[z].name), zd.optional ? 'Side zone' : (K.znum || {})[z] ? 'Zone ' + K.znum[z] : 'Zone')
      + (R ? `<div class="small">How to get there: ${esc(R)}</div>` : '')
      + (ins.length ? `<div>Ways in: ${ins.map(i => ptl(i)).join(', ')}</div>` : '') + (outs.length ? `<div>Ways out: ${outs.map(i => ptl(i, 1)).join(', ')}</div>` : '')
      + (walk.size ? `<div>On foot: ${[...walk].map(zlk).join(', ')}</div>` : '') + (boat.size ? `<div>Boat: ${[...boat].map(zlk).join(', ')}</div>` : '')
      + (bl.length ? `<div class="small">Bosses: ${bl.slice(0, 4).map(b => K.link('boss', b, W.boss[b].name)).join(', ')}${bl.length > 4 ? ` +${bl.length - 4}` : ''}</div>` : '')
      + `<div class="mp-open"><a href="#zones/${z}" class="pk-go">Open page →</a></div>`;
  }

  /* ---------- pan / zoom / tap, wired once per map box ---------- */
  const OFF = new Set(['npc']);
  let reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* old browser */ }
  const FS = () => window.innerWidth < 600 ? 11 : 12.5;   // zone label size on screen, px
  /* a layer switched off never hides a card's own target or the markers it names (shop pages and shop cards ring an NPC; the Shops layer is off) */
  const layers = s => { for (const k of Object.keys(KINDS)) s.querySelectorAll('.L-' + k).forEach(n => { n.style.display = OFF.has(k) && !n.matches('.hl, .me') ? 'none' : ''; }); };
  function wire(root) {
    root.querySelectorAll('.mp-box:not([data-w])').forEach(box => {
      box.dataset.w = '1';
      const s = box.querySelector('svg'), top = s.querySelector('.mp-top'), panel = box.querySelector('.mp-panel'), mini = box.classList.contains('mini');
      const vbA = s.getAttribute('viewBox').split(' ').map(Number); let vb = vbA.slice(), vb0 = vbA.slice(), raf = 0, lastU = 0, active = !mini, padB = 0;   // padB: share of the box under the open panel
      const R = () => s.getBoundingClientRect();
      const clampV = v => { for (const [o, d, L, b] of [[0, 2, IW, 0], [1, 3, IH, padB]]) v[o] = v[d] * (1 - b) >= L ? (L - v[d] * (1 - b)) / 2 : Math.min(Math.max(v[o], 0), L - v[d] * (1 - b)); return v; };
      const shapeFit = v => { const r = R(); v = v.slice(); if (!r.width || !r.height) return v; const ar = r.width / r.height;   /* widen or heighten the view to the box's shape */
        if (v[2] / v[3] < ar) { const nw = v[3] * ar; v[0] -= (nw - v[2]) / 2; v[2] = nw; } else { const nh = v[2] / ar; v[1] -= (nh - v[3]) / 2; v[3] = nh; } return clampV(v); };
      const upx = () => { const r = R(); return r.width ? Math.max(vb[2] / r.width, vb[3] / r.height) : vb[2] / 600; };   // map units per screen px
      const pt = (cx, cy) => { const r = R(); return [vb[0] + (cx - r.left) / r.width * vb[2], vb[1] + (cy - r.top) / r.height * vb[3]]; };
      /* labels that would overlap an earlier one are hidden: selection first, then gold zone names, landmarks, the other zone names by size */
      /* where a landmark's name sits, in map units (the name is drawn inside the marker's scaled group) */
      const mlb = (g, t) => { const k = +g.dataset.k || 1, x = +g.dataset.x, y = +g.dataset.y, lx = +(t.getAttribute('x') || 9), n = t.textContent.length, a = t.getAttribute('text-anchor');
        if (g.classList.contains('mp-arw')) return [x + lx * k - n * 3 * k, y + (+t.getAttribute('y') - 9) * k, x + lx * k + n * 3 * k, y + (+t.getAttribute('y') + 3) * k];
        return a === 'end' ? [x + (lx - n * 5.9) * k, y - 7.5 * k, x + lx * k, y + 5 * k] : [x + lx * k, y - 7.5 * k, x + (lx + n * 5.9) * k, y + 5 * k]; };
      /* a name sits right of its marker; it flips left when it would run off the right edge (or when told to) */
      const side = (g, t, left) => { const lx = +(t.dataset.lx || (t.dataset.lx = t.getAttribute('x') || 9));
        if (left) { t.setAttribute('text-anchor', 'end'); t.setAttribute('x', -lx); } else { t.removeAttribute('text-anchor'); t.setAttribute('x', lx); } return mlb(g, t); };
      const offR = b => b[2] > vb[0] + vb[2] - 4 * upx(), offL = b => b[0] < vb[0] + 4 * upx();
      const cull = fs => { const boxes = [], hit = b => boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
        const put = (el, b, force) => { const ok = force || !hit(b); if (ok) boxes.push(b); el.classList.toggle('cull', !ok); };
        const zb = t => { const w = t.textContent.length * fs * 0.6, x = +t.getAttribute('x') + +(t.getAttribute('dx') || 0), y = +t.getAttribute('y') - fs * 0.9; return [x - w / 2, y - fs * 0.62, x + w / 2, y + fs * 0.62]; };
        const shown = g => g.style.display !== 'none';
        top.querySelectorAll('.mp-mk:not(.zm)').forEach(g => { const t = g.querySelector('.mp-ml'); if (!t) return; if (g.classList.contains('mp-arw')) return put(t, mlb(g, t), 1);
          const L0 = g.dataset.left === '1'; let b = side(g, t, L0); if (L0 ? b[0] < vb[0] + 4 * upx() : offR(b)) { const c = side(g, t, !L0); if (L0 ? !offR(c) : c[0] > vb[0] + 4 * upx()) b = c; else b = side(g, t, L0); } put(t, b, 1); });
        const zls = [...s.querySelectorAll('.mp-zl')];
        const hzs = zls.filter(t => t.classList.contains('hz')).sort((a, b) => (a.dataset.p || 0) - (b.dataset.p || 0)), late = t => mini && !+(t.dataset.p || 0);
        hzs.filter(t => !late(t)).forEach(t => put(t, zb(t), !+(t.dataset.p || 0)));   // gold names: the zone a link leads to first (a mini map's own zone name comes after its landmarks)
        const own = [...top.querySelectorAll('.mp-mk.zm'), ...[...s.querySelectorAll('.mp-marks .mp-mk.hl, .mp-marks .mp-mk.me')].filter(g => shown(g) && !g.classList.contains('on'))];
        own.sort((a, b) => (b.classList.contains('me') - a.classList.contains('me')) || (PRI[PTS[a.dataset.i].k] ?? 5) - (PRI[PTS[b.dataset.i].k] ?? 5)).forEach(g => { const t = g.querySelector('.mp-ml'); if (!t) return;   // a name goes right of its marker, else left, else it hides
          const first = offR(side(g, t, 0)) ? 1 : 0; for (const l of [first, 1 - first]) { const b = side(g, t, l); if (!hit(b) && !(l ? offL(b) : offR(b))) return put(t, b); } side(g, t, first); t.classList.add('cull'); });
        hzs.filter(late).forEach(t => put(t, zb(t)));
        zls.filter(t => !t.classList.contains('hz')).sort((a, b) => a.dataset.o - b.dataset.o).forEach(t => put(t, zb(t))); };
      const paint = () => { const u = upx(), far = vb[2] > IW * 0.45, k = u * (far ? (R().width < 520 ? 0.78 : 0.95) : 1.1); s.classList.toggle('far', far);
        for (const g of s.querySelectorAll('.mp-mk')) { const kk = k * (far && g.classList.contains('mn') && !g.classList.contains('on') ? 0.62 : 1); g.dataset.k = kk;
          g.setAttribute('transform', `translate(${g.dataset.x},${g.dataset.y}) scale(${kk.toFixed(3)})`); }
        const fs = FS() * u; s.style.setProperty('--zl', fs.toFixed(2) + 'px');
        for (const t of s.querySelectorAll('.mp-zl')) { const w = t.textContent.length * fs * 0.3, x = +t.getAttribute('x'), l = vb[0] + 4 * u, r = vb[0] + vb[2] - 4 * u;
          t.setAttribute('dx', x + w > l && x - w < r ? Math.max(0, l - (x - w)) + Math.min(0, r - (x + w)) : 0); }
        if (!lastU || Math.abs(u - lastU) > lastU * 0.03) { lastU = u; cull(fs); } };
      const set = () => { if (vb.some(v => !isFinite(v))) vb = vb0.slice(); clampV(vb); s.setAttribute('viewBox', vb.map(v => v.toFixed(2)).join(' ')); paint(); };
      const go = t => { t = clampV(t.slice()); cancelAnimationFrame(raf); if (reduce) { vb = t; return set(); }
        const f = vb.slice(), t0 = performance.now(); const step = ts => { const a = Math.min(1, (ts - t0) / 260), q = 1 - (1 - a) * (1 - a); vb = f.map((v, j) => v + (t[j] - v) * q); set(); if (a < 1) raf = requestAnimationFrame(step); else { lastU = 0; paint(); } };
        raf = requestAnimationFrame(step); };
      const zoom = (f, cx, cy, anim) => { if (!f) return go(vb0.slice());
        const w = Math.min(IW * 1.25, Math.max(IW / 40, vb[2] / f)), h = w * vb[3] / vb[2]; cx = cx == null ? vb[0] + vb[2] / 2 : cx; cy = cy == null ? vb[1] + vb[3] / 2 : cy;
        const t = [cx - (cx - vb[0]) * w / vb[2], cy - (cy - vb[1]) * h / vb[3], w, h]; if (anim) go(t); else { vb = t; set(); } };
      /* bring spots into view above the panel. A landmark tap never zooms in (it only pans, or zooms out to fit both ends);
         a zone-name tap may zoom in on that zone. Nothing moves when the spots are already in view. */
      const show = (L, mode) => { const zoomIn = mode === 'zone', pan = mode === 'pan'; const r = R(); L = L.filter(Boolean); if (!r.width || !r.height || !L.length) return;
        const ph = mini || panel.hidden ? 0 : Math.min(panel.offsetHeight + 16, r.height * 0.6), vis = (r.height - ph) / r.height; padB = 1 - vis;
        const xs = L.map(q => q[0]), ys = L.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), u0 = vb[2] / r.width;
        const uf = x1 - x0 > 1 || y1 - y0 > 1 ? Math.max((x1 - x0) / Math.max(60, r.width - Math.min(r.width * 0.55, 230)), (y1 - y0) / Math.max(40, r.height * vis - Math.min(r.height * vis * 0.5, 90))) : u0;
        const inV = q => q[0] > vb[0] + vb[2] * 0.05 && q[0] < vb[0] + vb[2] * 0.95 && q[1] > vb[1] + vb[3] * 0.05 && q[1] < vb[1] + vb[3] * (vis - 0.04);
        if (L.every(inV) && !(zoomIn && uf < u0 * 0.6)) return;
        const u = pan ? u0 : Math.min(zoomIn ? Math.max(uf, IW / 8 / r.width) : Math.max(uf, u0), IW * 1.25 / r.width), w = u * r.width, h = u * r.height;   // 'pan': arrow + names are screen-sized, zooming cannot fit them
        go([(x0 + x1) / 2 + (L.length > 1 && !pan ? Math.min(60, r.width * 0.1) * u : 0) - w / 2, (y0 + y1) / 2 - h * vis / 2, w, h]); };
      const hz = (z, pr) => { const t = z && s.querySelector(`.mp-zl[data-z="${z}"]`); if (t && !t.classList.contains('hz')) { t.classList.add('hz'); t.dataset.p = pr || 0; } };
      const on = i => { const g = s.querySelector(`.mp-marks .mp-mk[data-i="${i}"]`); if (g) g.classList.add('on'); };
      const line = (a, b, t) => top.insertAdjacentHTML('afterbegin', `<line class="mp-hc" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"/><line class="mp-hl${t === 'i' ? ' sea' : ''}" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"/>`);
      const arrow = (p, name) => { const a = ang(p) * Math.PI / 180, c = Math.cos(a), d = Math.sin(a), e = (r, q) => `${f1(r * c - q * d)} ${f1(r * d + q * c)}`;
        top.insertAdjacentHTML('beforeend', `<g class="mp-mk mp-arw" data-x="${f1(px(p.x))}" data-y="${f1(py(p.y))}"><path class="mp-ahc" d="M${e(11, 0)}L${e(40, 0)}"/><path class="mp-ah" d="M${e(11, 0)}L${e(40, 0)}"/><path class="mp-ahh" d="M${e(47, 0)}L${e(37, 5.5)}L${e(37, -5.5)}Z"/>`
          + `<text class="mp-ml" x="${f1(55 * c)}" y="${f1(55 * d + 3.6 + (d > 0.5 ? 6 : d < -0.5 ? -4 : 0))}" text-anchor="${c < -0.35 ? 'end' : c > 0.35 ? 'start' : 'middle'}">${esc(name)}</text></g>`); };
      const clear = keep => { s.classList.remove('iso'); top.innerHTML = ''; s.querySelectorAll('.mp-marks .on').forEach(g => g.classList.remove('on'));
        s.querySelectorAll('.mp-zl.hz').forEach(t => { if (t.dataset.z !== box.dataset.focus) { t.classList.remove('hz'); delete t.dataset.p; } }); if (!keep) { panel.hidden = true; panel.innerHTML = ''; if (padB) { padB = 0; go(vb); } } lastU = 0; paint(); };
      const fz = mini && ZB[box.dataset.focus] ? ZB[box.dataset.focus].name + ' ' : '', labF = q => fz && q.zone === box.dataset.focus && q.n.startsWith(fz) ? cap(q.n.slice(fz.length)) : q.n;
      const openPanel = html => { panel.innerHTML = html; panel.hidden = false; panel.scrollTop = 0; box.classList.add('used'); };
      /* tap a landmark: it and everything it links to are ringed and labelled, the links drawn, the view widened to show both ends */
      const pick = i => { const p = PTS[i]; if (!p) return; clear(1);
        const ends = [...new Set([p.ti, ...(p.fi || [])].filter(j => j != null && PTS[j]))], L = [[px(p.x), py(p.y)]];
        for (const j of ends) { const q = PTS[j], a = p.ti === j ? p : q, b = p.ti === j ? q : p; line([px(a.x), py(a.y)], [px(b.x), py(b.y)], LINK[a.k]); L.push([px(q.x), py(q.y)]); }
        const tzs = p.tz ? [p.tz] : p.tzs || [];
        if (!ends.length && p.k === 'dock') tzs.forEach(z => { const c = zc(z); if (c) { line([px(p.x), py(p.y)], c, 'i'); L.push(c); } });
        let ext = null;   // a path / gate with no exit spot: an arrow toward the zone it leads to, its own name on the other side
        if (!ends.length && p.k !== 'dock' && tzs.length && ZB[tzs[0]]) { const nm = '→ ' + ZB[tzs[0]].name, a = ang(p) * Math.PI / 180, c = Math.cos(a), k = upx() * 1.1, n = labF(p).length * 5.9 + 14;
          arrow(p, nm); const r = (58 + nm.length * 5.9 * Math.max(0, c)) * k, l = (c > 0.3 ? n : 10) * k; const ty = py(p.y) + Math.sin(a) * 72 * k; ext = [px(p.x) - l, px(p.x) + Math.max(r, c > 0.3 ? 0 : n * k), Math.min(py(p.y), ty), Math.max(py(p.y), ty)]; }
        top.insertAdjacentHTML('beforeend', ends.map(j => mk(PTS[j], j, 'end', endLab(PTS[j], p, labF(PTS[j])), 12)).join('') + mk(p, i, 'sel', labF(p), 14));
        if (ext && Math.cos(ang(p) * Math.PI / 180) > 0.3) top.lastElementChild.dataset.left = '1';
        [...tzs, ...ends.map(j => PTS[j].zone)].forEach(z => hz(z, 1)); hz(p.zone, 2); s.classList.add('iso'); on(i); ends.forEach(on);
        openPanel(info(p)); lastU = 0; paint(); if (ext) show([[ext[0], ext[2]], [ext[1], ext[3]]], 'pan'); else show(L); };
      /* tap a zone name: its landmarks are labelled and the panel shows the ways in and out */
      const pickZone = (z, stay) => { if (!ZB[z]) return; clear(1); hz(z); s.classList.add('iso'); const own = [];
        PTS.forEach((p, i) => { if (p.zone === z || (p.also || []).includes(z)) { on(i); if (!MINOR.has(p.k)) own.push(i); } });
        top.insertAdjacentHTML('beforeend', own.map(i => mk(PTS[i], i, 'zm', PTS[i].n, 10)).join(''));
        openPanel(zoneInfo(z)); lastU = 0; paint(); if (!stay) show(own.length > 1 ? own.map(i => [px(PTS[i].x), py(PTS[i].y)]) : [zc(z)], 'zone'); };
      /* a tap picks: a marker right under it, else a landmark name or zone name under it, else the nearest marker within a finger's reach */
      const hitAt = (cx, cy, touch) => { const [mx, my] = pt(cx, cy), u = upx(); let best = null, bd = 1e9;
        const vis = [...s.querySelectorAll('.mp-marks .mp-mk')].filter(g => g.style.display !== 'none');
        for (const g of vis) { const d = Math.hypot(g.dataset.x - mx, g.dataset.y - my); if (d < bd) { bd = d; best = g; } }
        if (best && bd < 9 * u) return ['p', +best.dataset.i];   // right on a marker
        for (const g of [...top.querySelectorAll('.mp-mk[data-i]'), ...vis.filter(g => (g.classList.contains('hl') || g.classList.contains('me')) && !g.classList.contains('on'))]) {
          const t = g.querySelector('.mp-ml'); if (!t || t.classList.contains('cull')) continue; const b = mlb(g, t);   // on a landmark's name
          if (mx > b[0] && mx < b[2] && my > b[1] - 3 * u && my < b[3] + 3 * u) return ['p', +g.dataset.i]; }
        const fs = FS() * u; for (const t of s.querySelectorAll('.mp-zl:not(.cull)')) { const w = t.textContent.length * fs * 0.32 + 4 * u, x = +t.getAttribute('x') + +(t.getAttribute('dx') || 0), y = +t.getAttribute('y') - fs * 0.9;
          if (Math.abs(mx - x) < w && Math.abs(my - y) < fs * 0.75) return ['z', t.dataset.z]; }
        return best && bd < (touch ? 22 : 12) * u ? ['p', +best.dataset.i] : null; };   // near a marker, within a finger's reach
      const tap = (cx, cy, touch) => { const h = hitAt(cx, cy, touch); if (!h) clear(); else if (h[0] === 'p') pick(h[1]); else pickZone(h[1]); };
      panel.addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return;
        if (a.classList.contains('mpx')) { e.preventDefault(); clear(); }
        else if (a.classList.contains('mp-z')) { e.preventDefault(); pickZone(a.dataset.z); }
        else if (a.classList.contains('mp-p')) { e.preventDefault(); pick(+a.dataset.i); } });
      box.querySelectorAll('.mp-btn button').forEach(b => b.addEventListener('click', () => { active = true; zoom(+b.dataset.z, null, null, true); }));
      s.addEventListener('wheel', e => { if (!active && !e.ctrlKey) return; e.preventDefault(); const [x, y] = pt(e.clientX, e.clientY); zoom(e.deltaY < 0 ? 1.25 : 0.8, x, y); }, { passive: false });
      s.addEventListener('dblclick', e => { const [x, y] = pt(e.clientX, e.clientY); zoom(1.8, x, y, true); });
      const ptrs = new Map(); let d0 = 0, moved = false, sx = 0, sy = 0;
      s.addEventListener('pointerdown', e => { if (e.button > 0) return; cancelAnimationFrame(raf); try { s.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 1) { moved = false; sx = e.clientX; sy = e.clientY; } else { moved = true; const [a, b] = [...ptrs.values()]; d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
      s.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; const r = R(); let [ox, oy] = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        if (ptrs.size === 1) { if (!moved) { if (Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return; moved = true; active = true; ox = sx; oy = sy; }
          vb[0] -= (e.clientX - ox) / r.width * vb[2]; vb[1] -= (e.clientY - oy) / r.height * vb[3]; set(); }
        else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d0) { const c = pt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); zoom(d / d0, c[0], c[1]); } d0 = d; } });
      const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) d0 = 0; };
      s.addEventListener('pointerup', e => { const was = ptrs.has(e.pointerId); up(e); if (was && moved && !ptrs.size) { lastU = 0; paint(); } if (!was || moved || ptrs.size) return; active = true; tap(e.clientX, e.clientY, e.pointerType !== 'mouse'); });
      s.addEventListener('pointercancel', e => { up(e); moved = true; });
      s._repaint = () => { lastU = 0; paint(); };
      layers(s); vb = shapeFit(vbA); vb0 = vb.slice(); set();
      if (window.ResizeObserver) { let w0 = R().width; new ResizeObserver(() => { const r = R(); if (!r.width || Math.abs(r.width - w0) < 2) return; w0 = r.width; vb = shapeFit(vb); vb0 = shapeFit(vbA); lastU = 0; set(); }).observe(s); }
      if (!mini && box.dataset.focus) pickZone(box.dataset.focus, 1);
      const sel = box.dataset.sel; if (sel) { const i = /^p\d+$/.test(sel) ? +sel.slice(1) : PTS.findIndex(p => p.id === sel || (p.ids || []).includes(sel)); if (PTS[i]) pick(i); }
    });
  }
  /* layer chips above the big map: the icon is the marker itself */
  const legend = () => `<div class="mp-legend" role="group" aria-label="Map layers">${Object.keys(KINDS).filter(k => PTS.some(p => LAY(p.k) === k)).map(k => `<button type="button" data-layer="${k}" class="${OFF.has(k) ? '' : 'on'}" aria-pressed="${!OFF.has(k)}"><svg viewBox="-8 -8 16 16" aria-hidden="true">${shape({ k })}</svg>${esc(KINDS[k][0])}</button>`).join('')}</div>`;
  const wireLegend = root => root.querySelectorAll('.mp-legend button[data-layer]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.layer; if (OFF.has(k)) OFF.delete(k); else OFF.add(k);
    b.classList.toggle('on', !OFF.has(k)); b.setAttribute('aria-pressed', String(!OFF.has(k))); root.querySelectorAll('.mp-svg').forEach(s => { layers(s); if (s._repaint) s._repaint(); }); }));
  P.map = id => `<h2>Map</h2>${legend()}` + svg({ focus: ZB[id] ? id : '', sel: id && !ZB[id] ? id : '' });
  INDEX.push({ k: 'map', id: '', t: 'Map', s: 'interactive map: zones, portals and where they lead, paths, gates, bosses', w: 6 });
  PTS.forEach((p, i) => { if (['portal', 'door', 'gate', 'stone', 'dock'].includes(p.k)) INDEX.push({ k: 'map', id: 'p' + i, t: p.n, s: 'map · ' + (KL[p.k] + (ZB[p.zone] ? ' · ' + ZB[p.zone].name : '')).toLowerCase(), w: 1 }); });
  K.mapPts = PTS; K.mapSvg = o => svg(Object.assign({ mini: 1 }, o || {}));   // older callers (shop pages): html only, wired by the route hook

  /* ---------- mini maps: zone and boss pages, zone cards, any <div class="mp-slot" data-zone=".."> ---------- */
  const near = z => new Set(PTS.map((p, i) => (p.zone === z || p.tz === z || (p.also || []).includes(z)) && !MINOR.has(p.k) ? i : -1).filter(i => i >= 0));
  const bossAt = id => PTS.findIndex(p => p.k === 'boss' && (p.id === id || (p.ids || []).includes(id)));
  /* a shop / NPC point: its own marker in zone z first, then anywhere, then (merged into a neighbour's marker by the build) the marker of the same name in z */
  const ptAt = (id, z) => { const ok = p => p.id === id || (p.ids || []).includes(id); let i = z ? PTS.findIndex(p => ok(p) && p.zone === z) : -1; if (i < 0) i = PTS.findIndex(ok);
    if ((i < 0 || (z && PTS[i].zone !== z)) && SHN[id]) { const j = PTS.findIndex(p => p.n === SHN[id] && (!z || p.zone === z)); if (j >= 0) i = j; } return i; };
  const miniHtml = (z, o) => { o = o || {}; let m = o.boss ? bossAt(o.boss) : o.pt ? ptAt(o.pt, z) : -1; if (m >= 0 && PTS[m].twin != null) m = PTS[m].twin;   // a quest giver on its boss marker = that marker
    return svg({ focus: z, hl: near(z), mini: 1, mark: m >= 0 ? m : null, markName: o.boss ? (W.boss[o.boss] || {}).name : o.pt ? SHN[o.pt] : '', spots: o.spots }); };
  K.ptZone = id => { const i = ptAt(id); return i >= 0 ? PTS[i].zone : ''; };
  K.miniMapHtml = (z, o) => ZB[z] ? miniHtml(z, o) : '';
  K.miniMap = (el, z, o) => { if (!el || !ZB[z]) return false; el.innerHTML = miniHtml(z, o); wire(el); return true; };
  const slots = root => root.querySelectorAll('.mp-slot[data-zone]:not([data-w]):not([data-filled])').forEach(el => { el.dataset.w = '1'; el.dataset.filled = '1'; K.miniMap(el, el.dataset.zone, { boss: el.dataset.boss || undefined, pt: el.dataset.pt || undefined, spots: el.dataset.mon ? (W.mon_spawn || {})[el.dataset.mon] : undefined }); });
  const Z0 = P.zones; P.zones = (id, f) => { const h = Z0(id, f); if (!id || !ZB[id] || h.includes('mp-slot') || h.includes('mp-box')) return h;
    const m = '<h4>Map</h4>' + miniHtml(id); const i = h.indexOf('<b>How to get there:</b>'); const j = i >= 0 ? h.indexOf('</p>', i) + 4 : -1; return j > 3 ? h.slice(0, j) + m + h.slice(j) : h + m; };
  const B0 = P.boss; P.boss = id => { const h = B0(id), bi = bossAt(id); if (bi < 0 || !ZB[PTS[bi].zone] || h.includes('mp-slot') || h.includes('mp-box')) return h;
    const m = '<h4>Map</h4>' + miniHtml(PTS[bi].zone, { boss: id }); const i = h.indexOf('<h4>'); return i >= 0 ? h.slice(0, i) + m + h.slice(i) : h + m; };
  hooks.push((page, out) => { slots(out); wire(out); wireLegend(out); });
  if (K.xhooks) K.xhooks.push((pg, id, el) => slots(el));
})(AP);
