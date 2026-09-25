/* Home (CWG layout): two one-line pointers, last wiki update + the map's Discord, then one compact card per tab with live counts
   (same order as the tab bar; 2 cards per row on a phone). */
(function (K) {
  const { W, P, esc, link, fmt } = K;
  const n = x => `<b class="hm-n">${fmt(x || 0)}</b>`;
  const card = (h, t, d) => `<a class="card home hm-c" href="#${h}"><h3>${esc(t)}</h3><p class="small">${d}</p></a>`;
  P.home = () => {
    const items = (W.items || []).filter(i => !i.legacy).length, mons = Object.keys(W.mon || {}).length, boss = Object.keys(W.boss || {}).length;
    const L = (W.legacy || {}).lines || [], steps = L.reduce((a, l) => a + (l.steps || []).length, 0);
    const pts = (W.map || {}).pts || [], mk = k => pts.filter(p => p.k === k).length;
    const disc = (W.mapinfo || {}).discord, last = (K.changes || [])[0];
    return `<div class="hm-top"><div class="card hi one"><p><b>New?</b> Follow the ${link('quests', '', 'Main quest')} and read ${link('systems', 'runs_saving', 'Runs and saving')} before your first -save. New words: ${link('systems', 'terms', 'Terms')}.</p></div>
    <div class="card hi one"><p><b>Past the start?</b> ${link('planner', '', 'Run planner')}: load your save, get your next run. ${link('calc', '', 'Points per run')}: what each difficulty pays.</p></div></div>
    ${last || disc ? `<p class="hm-meta small">${last ? `Wiki updated <a href="#changelog">${esc(last[0])}</a>` : ''}${disc ? `<a class="discord" href="${esc(disc)}" target="_blank" rel="noopener">Join the map's Discord</a>` : ''}</p>` : ''}
    <div class="hm-grid">
      ${card('heroes', 'Heroes', `${n((W.heroes || []).length)} heroes: skills, builds, unlocks`)}
      ${card('tier', 'Tier list', 'S to C per mode, for N1-3 / N4-6 / N7-9')}
      ${card('planner', 'Run planner', 'Load your save: the best next run for Legacy or Points')}
      ${card('zones', 'Zones', `${n((W.zones || []).length)} zones in quest order, with routes`)}
      ${card('map', 'Map', `${n(mk('stone'))} Teleport Stones, portals, gates, bosses`)}
      ${card('monsters', 'Monsters', `${n(mons)} monsters, ${n(boss)} bosses: HP, drops`)}
      ${card('items', 'Items', `${n(items)} items: stats and sources`)}
      ${card('recipes', 'Recipes', `${n((W.recipes || []).length)} crafts and their parts`)}
      ${card('legacy', 'Legacy', `${n(L.length)} saved gear lines, ${n(steps)} steps`)}
      ${card('quests', 'Quests', `${n(((W.qguide || {}).steps || (W.quests || {}).main || []).length)} main quest steps, ${n(((W.quests || {}).side || []).length)} side quests`)}
      ${card('systems', 'Game systems', `${n((W.sys || []).length)} pages + ${n((W.commands || []).length)} chat commands: difficulty, Points, enhancing`)}
      ${card('calc', 'Calculators', 'Points per run, runs to a title, enhancing cost')}
    </div>`;
  };
})(window.AP);
