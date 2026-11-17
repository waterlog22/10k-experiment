/* The 10K Experiment — site script. Reads window.TENK (data.js) and renders every view. */
(function () {
'use strict';
const D = window.TENK;
const $ = id => document.getElementById(id);
if (!D || !Array.isArray(D.portfolios)) {
  $('hero-lede').textContent = 'The data file did not load. Refresh the page to try again.';
  return;
}

// ───────── helpers ─────────
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd = (n, d = 2) => (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
const usdS = n => (n > 0.004 ? '+' : '') + usd(n);
const sgn = (x, d = 2) => (x > 0.004 ? '+' : x < -0.004 ? '−' : '') + Math.abs(x).toFixed(d);
const pct = (x, d = 2) => sgn(x, d) + '%';
const cls = x => x > 0.004 ? 'gain' : x < -0.004 ? 'loss' : '';
const dateTxt = s => new Date(s + 'T12:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
const WORDS = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'];
const word = n => WORDS[n] || String(n);
const START = 10000, INCEPTION = '2026-06-18';

const FAM = {long:'Long-term', congress:'Congress mirror', climate:'Climate & tech', trump:'Trump mirror', dividend:'Dividend', bonds:'Bonds', short:'Short-term', discount:'Discount', infra:'AI infrastructure'};
const FAMC = {long:'#6f9bff', congress:'#b693ff', climate:'#2fc9c0', trump:'#ff9d5c', dividend:'#ff86a8', bonds:'#a9bccb', short:'#c3e36a', discount:'#d8b48a', infra:'#5fd0ff'};
const FAM_ORDER = ['long','congress','climate','trump','dividend','bonds','short','discount','infra'];
const STRAT = {
  long: {h:'30+ years', t:'Very low turnover', x:'The foundational bet: buy quality businesses and hold them for decades. The portfolios try different flavors, from a broad index core to a dividend-weighted value tilt to a concentrated book of quality compounders. The thesis is that time in the market beats timing the market.'},
  congress: {h:'Medium term', t:'Moderate turnover', x:'Members of Congress must disclose their stock trades. These portfolios mirror them in different ways: a consensus book that buys what several members are buying, and books that follow one member’s filings. The question is whether Washington actually knows something.'},
  climate: {h:'Long term', t:'Low turnover', x:'Clean energy, nuclear, electric vehicles and the grid. The thesis is that the energy transition is real and will outperform over the long run, and that the ride will be rough.'},
  trump: {h:'Medium term', t:'Low turnover', x:'A replication of trades from Trump-associated financial disclosures. This is not about politics. It asks whether politically connected money produces better returns.'},
  dividend: {h:'Long term', t:'Very low turnover', x:'Stocks chosen purely for income: yields of 5% or more, payouts covered by cash flow, and a long record of paying. The bet is that the income stream does the work, not the share price.'},
  bonds: {h:'Indefinite', t:'Very low turnover', x:'The anti-stock portfolio. A ladder of bond funds from short Treasuries to high-yield and emerging-market debt. It exists for income, and to show what happens when stocks sell off.'},
  short: {h:'Months to two years', t:'Higher turnover', x:'Positions built around a catalyst, held for a few months up to two years, then sold for profit. Names that had already run before the start date are off limits.'},
  discount: {h:'Medium term', t:'Moderate turnover', x:'Classic value investing as a screen: low price-to-earnings, strong free cash flow, reasonable debt. The thesis is that the market overreacts and patience gets paid.'},
  infra: {h:'Long term', t:'Low turnover', x:'The picks-and-shovels bet on the AI boom. Instead of the AI companies, this buys the physical buildout behind them: power, networking, components, cooling and construction.'}
};

// ───────── compute ─────────
const VOO = D.voo || {};
const P = D.portfolios.map(p => {
  const h = p.h.map(x => {
    const val = x.sh * x.mk, cost = x.sh * x.px;
    return {t: x.t, sh: x.sh, px: x.px, mk: x.mk, inc: x.inc || 0, note: x.note || '', val, cost, gain: val - cost, gp: (x.mk / x.px - 1) * 100};
  }).sort((a, b) => b.val - a.val);
  const hv = h.reduce((s, x) => s + x.val, 0);
  const value = hv + p.cash + (p.income || 0);
  const bench = (VOO.now / (VOO[p.start] || VOO[INCEPTION]) - 1) * 100;
  const ret = (value / START - 1) * 100;
  h.forEach(x => x.w = x.val / value * 100);
  return {id: p.id, fam: p.fam, name: p.name, method: p.method || '', start: p.start, cash: p.cash, income: p.income || 0, realized: p.realized || 0,
          h, hv, value, ret, bench, alpha: ret - bench, c: FAMC[p.fam] || '#a9bccb'};
});
const byRet = [...P].sort((a, b) => b.ret - a.ret);
byRet.forEach((p, i) => p.rank = i + 1);
const byId = Object.fromEntries(P.map(p => [p.id, p]));
const N = P.length;
const ASOF = dateTxt(D.asof);
const days = Math.round((new Date(D.asof + 'T12:00:00') - new Date(INCEPTION + 'T12:00:00')) / 864e5);
const spInc = START * VOO.now / VOO[INCEPTION];
const fams = FAM_ORDER.filter(f => P.some(p => p.fam === f));

// ticker index
const TK = {};
P.forEach(p => p.h.forEach(x => (TK[x.t] = TK[x.t] || []).push({p, x})));
const tkAgg = Object.entries(TK).map(([t, a]) => {
  const val = a.reduce((s, e) => s + e.x.val, 0), cost = a.reduce((s, e) => s + e.x.cost, 0);
  return {t, n: a.length, val, cost, gp: (val / cost - 1) * 100};
}).sort((a, b) => b.val - a.val);

const state = {sort: 'ret', fam: 'all', a: byRet[0].id, b: (byRet[1] || byRet[0]).id};
const sw = c => `<i class="swatch" style="--c:${c}"></i>`;
const shade = (c, i, n) => `color-mix(in srgb, ${c} ${Math.round(100 - (n > 1 ? i / (n - 1) : 0) * 62)}%, #14262f)`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = x => Math.min(1, Math.max(0, x));
const ease = t => 1 - Math.pow(1 - t, 3);
const ramp = (p, a, b) => clamp01((p - a) / (b - a));
function countUp(el, from, to, ms, fmt) {
  if (reduced) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  (function f(t) { const k = clamp01((t - t0) / ms); el.textContent = fmt(from + (to - from) * ease(k)); if (k < 1) requestAnimationFrame(f); })(t0);
}

// ───────── home: hero + field ─────────
const beatN = P.filter(p => p.alpha > 0).length;
$('hero-line').textContent = `One AI is running ${word(N).toLowerCase()} portfolios side by side, each with its own strategy and the same starting money, to find out.`;
$('hero-lede').textContent = 'Real closing prices. No real money.';
$('cap-b').textContent = `Day ${days}. Same money, very different results.`;
$('top3').innerHTML = byRet.slice(0, 3).map(p => `<li><button class="t3" data-open="${p.id}">
    <span class="rk num${p.rank === 1 ? ' first' : ''}">${p.rank}</span>
    <span style="min-width:0"><b>${esc(p.name)}</b><small>${sw(p.c)}${FAM[p.fam]}</small></span>
    <span class="v num">${usd(p.value, 0)}<span class="${cls(p.ret)}">${pct(p.ret)}</span></span></button></li>`).join('');
(function facts() {
  const best = byRet[0], worst = byRet[N - 1];
  $('hfacts').innerHTML = `<div><dd><small>Day</small><span id="day-num">0</span></dd><dt>Running since ${dateTxt(INCEPTION)}</dt></div>
    <div><dd>${beatN}<small style="margin:0 0 0 .3em">of ${N}</small></dd><dt>Portfolios ahead of the S&amp;P 500</dt></div>
    <div><dd class="${cls(best.ret)}">${pct(best.ret, 1)}</dd><dt>Best so far: ${esc(best.name)}</dt></div>
    <div><dd class="${cls(worst.ret)}">${pct(worst.ret, 1)}</dd><dt>Worst so far: ${esc(worst.name)}</dt></div>`;
  countUp($('day-num'), 0, days, 1300, v => Math.round(v));
})();
$('tape').innerHTML = (h => `<div class="tape-run">${h}${h}</div>`)(tkAgg.map(t => `<button data-tk="${t.t}" tabindex="-1">${t.t}<span class="num ${cls(t.gp)}">${pct(t.gp, 1)}</span></button>`).join(''));
(function recap() {
  const up = P.filter(p => p.value > START).length, beat = P.filter(p => p.alpha > 0).length;
  const first = byRet[0], last = byRet[N - 1];
  $('recap').innerHTML = `After ${days} days, <b>${up} of ${N}</b> portfolios are worth more than they started with and <b>${beat}</b> ${beat === 1 ? 'is' : 'are'} beating the S&amp;P 500. ` +
    `<button class="linkish" data-open="${first.id}">${esc(first.name)}</button> leads at <b>${usd(first.value, 0)}</b>. ` +
    `<button class="linkish" data-open="${last.id}">${esc(last.name)}</button> is last at <b>${usd(last.value, 0)}</b>.`;
})();

// The field: every portfolio on a dollar axis. Scrolling through the pinned section moves each from the start line to today's value.
let raceP = reduced ? 1 : 0, fieldXs = 0;
const race = $('race');
function drawField() {
  const svg = $('field');
  const W = svg.clientWidth || svg.parentNode.clientWidth;
  if (!W) return;
  const small = W < 560, R = small ? 10 : 13, ML = R + 6, MR = R + 6, TOP = 46;
  const vals = P.map(p => p.value).concat([START, spInc]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const padv = (hi - lo) * 0.05; lo -= padv; hi += padv;
  const X = v => ML + (v - lo) / (hi - lo) * (W - ML - MR);
  const gap = 2 * R + 4, placed = [];
  [...P].sort((a, b) => a.value - b.value).forEach(p => {
    const x = X(p.value);
    for (let k = 0; k < 40; k++) {
      const y = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (gap * 0.9);
      if (!placed.some(q => Math.hypot(q.x - x, q.y - y) < gap)) { placed.push({p, x, y}); break; }
    }
  });
  const maxY = Math.max(...placed.map(q => Math.abs(q.y)));
  const cy = TOP + maxY + R + 6, base = cy + maxY + R + 12, H = base + 26;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.height = H + 'px';
  const step = [100, 250, 500, 1000, 2000, 5000].find(s => (hi - lo) / s <= (small ? 5 : 9)) || 5000;
  let g = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    g += `<line x1="${X(v)}" x2="${X(v)}" y1="${TOP}" y2="${base}" stroke="#27434f"/><text x="${X(v)}" y="${base + 18}" text-anchor="middle">${usd(v, 0)}</text>`;
  }
  const xs = X(START), xp = X(spInc);
  fieldXs = xs;
  const spLeft = xp < xs;       // labels sit on the outer side of each line so they never collide
  g += `<line x1="${xs}" x2="${xs}" y1="${TOP - 26}" y2="${base}" stroke="#eef2ec" stroke-width="2"/>` +
       `<text x="${xs + (spLeft ? 8 : -8)}" y="${TOP - 14}" text-anchor="${spLeft ? 'start' : 'end'}" style="fill:#eef2ec;font-weight:700">Start: $10,000</text>`;
  g += `<line x1="${xp}" x2="${xp}" y1="${TOP - 26}" y2="${base}" stroke="#ffe45c" stroke-width="2" stroke-dasharray="5 5"/>` +
       `<text x="${xp + (spLeft ? -8 : 8)}" y="${TOP - 14}" text-anchor="${spLeft ? 'end' : 'start'}" style="fill:#ffe45c;font-weight:600">S&amp;P 500: ${usd(spInc, 0)}</text>`;
  placed.forEach(({p, x, y}) => {
    const beat = p.alpha > 0;
    g += `<g class="dot${beat ? '' : ' hollow'}" tabindex="0" role="button" data-open="${p.id}" data-x="${x}" data-y="${y}" data-cy="${cy}" ` +
         `aria-label="${esc(p.name)}, ${usd(p.value, 0)}, rank ${p.rank}" data-tip="${esc(p.name)}|${usd(p.value)}, ${pct(p.ret)}, ${sgn(p.alpha)} pts vs S&amp;P">` +
         `<circle r="${R}" fill="${beat ? p.c : '#14262f'}" stroke="${p.c}"/><text text-anchor="middle" dy="4">${p.rank}</text></g>`;
  });
  svg.innerHTML = g;
  applyRace();
}
function applyRace() {
  const e = ease(ramp(raceP, .1, .8));
  $('field').querySelectorAll('.dot').forEach(d => {
    d.style.transform = `translate(${fieldXs + (d.dataset.x - fieldXs) * e}px,${+d.dataset.cy + d.dataset.y * e}px)`;
  });
  const out = ramp(raceP, .3, .44), inn = ramp(raceP, .42, .58);
  $('cap-a').style.cssText = `opacity:${1 - out};transform:translateY(${-18 * out}px)`;
  $('cap-b').style.cssText = `opacity:${inn};transform:translateY(${18 * (1 - inn)}px)`;
  $('recap').style.opacity = ramp(raceP, .74, .9);
}
function autoRace() {            // used when the section cannot be pinned
  const t0 = performance.now();
  (function f(t) { raceP = clamp01((t - t0) / 2600); applyRace(); if (raceP < 1) requestAnimationFrame(f); })(t0);
}
function setPinMode() {
  const canPin = !reduced && innerHeight < 1500;
  race.classList.toggle('nopin', !canPin);
  if (reduced) raceP = 1;
  else if (!canPin && !race._auto) { race._auto = 1; new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); autoRace(); } }, {threshold: .4}).observe($('field')); }
}
let ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    if ($('v-home').hidden) return;
    if (!race.classList.contains('nopin')) {
      const r = race.getBoundingClientRect(), total = r.height - innerHeight;
      raceP = total > 0 ? clamp01(-r.top / total) : 1; applyRace();
    }
  });
}
addEventListener('scroll', onScroll, {passive: true});
function hot(id) {
  $('field').classList.toggle('dim', !!id);
  document.querySelectorAll('#field .dot, #board .row').forEach(e => e.classList.toggle('hot', e.dataset.open === id));
}

// ───────── leaderboard ─────────
function chips(el, onPick) {
  const draw = () => {
    el.innerHTML = `<button class="chip" aria-pressed="${state.fam === 'all'}" data-fam="all">All ${N}</button>` +
      fams.map(f => `<button class="chip" aria-pressed="${state.fam === f}" data-fam="${f}">${sw(FAMC[f])}${FAM[f]}</button>`).join('');
  };
  el.addEventListener('click', e => { const b = e.target.closest('[data-fam]'); if (b) { state.fam = b.dataset.fam; onPick(); } });
  return draw;
}
const drawChips1 = chips($('fam-chips'), () => { drawChips1(); drawChips2(); drawBoard(); drawCards(); });
const drawChips2 = chips($('fam-chips-2'), () => { drawChips1(); drawChips2(); drawBoard(); drawCards(); });

function trackHTML(v, mark, lo, hi, color) {
  const pos = x => (x - lo) / (hi - lo) * 100, z = pos(0);
  const bar = `<i class="bar${v < 0 ? ' neg' : ''}" style="--c:${color};left:${Math.min(z, pos(v))}%;width:${Math.abs(pos(v) - z)}%"></i>`;
  return `<span class="track"><i class="zero" style="left:${z}%"></i>${bar}${mark == null ? '' : `<i class="sp" style="left:${pos(mark)}%"></i>`}</span>`;
}
function drawBoard() {
  const key = state.sort;
  const order = [...P].sort((a, b) => b[key] - a[key]);
  order.forEach((p, i) => p._r = i + 1);
  const all = P.flatMap(p => [p.ret, p.bench]).concat(0);
  const lo = Math.min(...all) * 1.08, hi = Math.max(...all) * 1.08;
  $('board').dataset.sort = $('board-head').dataset.sort = key;
  const rows = order.filter(p => state.fam === 'all' || p.fam === state.fam);
  $('board').innerHTML = rows.map((p, i) => `<li style="--i:${i}"><button class="row" data-open="${p.id}">
      <span class="rk num${p._r === 1 ? ' first' : ''}">${p._r}</span>
      <span class="nm"><b>${esc(p.name)}</b><small>${sw(p.c)}${FAM[p.fam]}</small></span>
      ${trackHTML(p.ret, p.bench, lo, hi, p.ret >= 0 ? 'var(--gain)' : 'var(--loss)')}
      <span class="r v num">${usd(p.value)}</span>
      <span class="r rt num ${cls(p.ret)}">${pct(p.ret)}</span>
      <span class="r a num ${cls(p.alpha)}">${sgn(p.alpha)} pts</span>
      <span class="cv" aria-hidden="true">›</span>
    </button></li>`).join('');
}
$('sort').addEventListener('click', e => {
  const b = e.target.closest('[data-sort]'); if (!b) return;
  state.sort = b.dataset.sort;
  $('sort').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  drawBoard();
});
['pointerover', 'focusin'].forEach(ev => document.addEventListener(ev, e => {
  const t = e.target.closest && e.target.closest('#field .dot, #board .row'); if (t) hot(t.dataset.open);
}));
['pointerout', 'focusout'].forEach(ev => document.addEventListener(ev, e => {
  if (e.target.closest && e.target.closest('#field .dot, #board .row')) hot(null);
}));

// retired
if (D.retired && D.retired.length) {
  $('retired').innerHTML = D.retired.map(r => `<div><b>${esc(r.name)}</b>Finished at <span class="num">${usd(r.value)}</span> <span class="num ${cls(r.value - START)}">(${pct((r.value / START - 1) * 100)})</span></div>`).join('');
} else $('retired-band').hidden = true;

// ───────── portfolio cards ─────────
const allocHTML = (p, big) => {
  const n = p.h.length, rest = 100 - p.h.reduce((s, x) => s + x.w, 0);
  if (!big) return `<span class="alloc">${p.h.map((x, i) => `<i style="--c:${shade(p.c, i, n)};width:${x.w}%"></i>`).join('')}${rest > 0.5 ? `<i class="cash" style="width:${rest}%"></i>` : ''}</span>`;
  return `<div class="alloc big">${p.h.map((x, i) => `<button data-tk="${x.t}" style="--c:${shade(p.c, i, n)};width:${x.w}%;${i > n * 0.6 ? 'color:var(--ink)' : ''}" data-tip="${x.t}|${x.w.toFixed(1)}% of the portfolio, ${usd(x.val)}" aria-label="${x.t}, ${x.w.toFixed(1)} percent">${x.w > 7 ? x.t : ''}</button>`).join('')}${rest > 0.5 ? `<button class="cash" tabindex="-1" style="width:${rest}%" data-tip="Cash and income|${rest.toFixed(1)}% of the portfolio">${rest > 9 ? 'Cash' : ''}</button>` : ''}</div>`;
};
function drawCards() {
  const list = byRet.filter(p => state.fam === 'all' || p.fam === state.fam);
  $('cards').innerHTML = list.map(p => `<button class="pcard" style="--c:${p.c}" data-go="${p.id}">
      <span class="top"><span><span class="h3" style="display:block">${esc(p.name)}</span><span class="fam">${FAM[p.fam]}</span></span><span class="rk">#${p.rank} of ${N}</span></span>
      <span><span class="big num">${usd(p.value, 0)}</span><span class="line2 num"><span class="${cls(p.ret)}">${pct(p.ret)}</span><span class="${cls(p.alpha)}">${sgn(p.alpha)} pts vs S&amp;P</span></span></span>
      ${allocHTML(p)}
      <span class="tks">${p.h.map(x => x.t).join(', ')}</span>
    </button>`).join('');
}

// ───────── one portfolio (full view) ─────────
function drawDetail(p) {
  const prev = byRet[p.rank - 2], next = byRet[p.rank];
  const spVal = START * (1 + p.bench / 100);
  const lo = Math.min(p.value - START, spVal - START, 0) * 1.1, hi = Math.max(p.value - START, spVal - START, 0) * 1.1 || 1;
  const hasInc = p.h.some(x => x.inc > 0);
  const facts = [
    ['Return', `<span class="${cls(p.ret)}">${pct(p.ret)}</span>`, `${usdS(p.value - START)} on $10,000`],
    ['Against the S&P 500', `<span class="${cls(p.alpha)}">${sgn(p.alpha)} pts</span>`, `S&P 500 ${pct(p.bench)} over the same days`],
    ['Rank', `#${p.rank} of ${N}`, p.rank === 1 ? 'Currently leading' : `${usd(byRet[0].value - p.value, 0)} behind the leader`],
    ['Cash on hand', usd(p.cash), `${(p.cash / p.value * 100).toFixed(1)}% of the portfolio`]
  ];
  if (p.income > 0) facts.push(['Income collected', `<span class="gain">${usd(p.income)}</span>`, 'Dividends and interest']);
  if (Math.abs(p.realized) > 0.004) facts.push(['Closed trades', `<span class="${cls(p.realized)}">${usdS(p.realized)}</span>`, 'Realized on positions already sold']);
  $('detail').innerHTML = `
    <div class="crumbs"><a href="#portfolios">‹ All portfolios</a>
      <span class="pn">${prev ? `<button data-go="${prev.id}">‹ #${prev.rank} ${esc(prev.name)}</button>` : ''}${next ? `<button data-go="${next.id}">#${next.rank} ${esc(next.name)} ›</button>` : ''}</span></div>
    <div class="phead">
      <div><span class="fam">${sw(p.c)}${FAM[p.fam]}, started ${dateTxt(p.start)}</span><h1 class="h1">${esc(p.name)}</h1></div>
      <div class="val"><b class="num" id="pval">${usd(p.value)}</b><span>from $10,000, as of ${ASOF}</span></div>
    </div>
    ${p.method ? `<div class="plan" style="--c:${p.c}"><small>The plan</small><p>${esc(p.method)}</p></div>` : ''}
    <dl class="facts">${facts.map(f => `<div><dt>${f[0]}</dt><dd class="num">${f[1]}<small>${f[2]}</small></dd></div>`).join('')}</dl>

    <div class="band" style="padding-top:56px">
      <h2 class="h2">The $10,000 over time</h2>
      <div class="chart-box"><div class="chart-key"><span><i style="--c:${p.c}"></i>This portfolio</span><span><i class="dash"></i>Same $10,000 in an S&amp;P 500 fund</span></div><svg id="pchart" role="img" aria-label="Value of this portfolio over time against the S&amp;P 500"></svg></div>
      <p class="note" id="pchart-note"></p>
    </div>

    <div class="band" style="padding-top:56px">
      <h2 class="h2">This portfolio or just the index?</h2>
      <p class="sub" style="margin-top:10px">What $10,000 gained or lost here, next to the same $10,000 in an S&amp;P 500 fund since ${dateTxt(p.start)}.</p>
      <div class="duel in" data-grow>
        <div class="d"><span>This portfolio</span>${trackHTML(p.value - START, null, lo, hi, p.c)}<span class="num ${cls(p.value - START)}">${usdS(p.value - START)}</span></div>
        <div class="d"><span>S&amp;P 500 fund</span>${trackHTML(spVal - START, null, lo, hi, 'var(--mark)')}<span class="num ${cls(spVal - START)}">${usdS(spVal - START)}</span></div>
      </div>
    </div>

    <div class="band" style="padding-top:56px">
      <h2 class="h2">What it holds, and why</h2>
      <p class="sub" style="margin:10px 0 18px">${p.h.length} position${p.h.length === 1 ? '' : 's'}. Pick any stock to see which other portfolios own it.</p>
      ${allocHTML(p, true)}
      <div class="tbl-wrap"><table>
        <thead><tr><th>Stock</th><th>Shares</th><th>Paid</th><th>Price now</th><th>Value</th><th>Share of portfolio</th><th>Gain or loss</th><th>%</th>${hasInc ? '<th>Income</th>' : ''}</tr></thead>
        <tbody>${p.h.map((x, i) => `<tr>
          <td><button class="tk" data-tk="${x.t}">${sw(shade(p.c, i, p.h.length))}${x.t}${TK[x.t].length > 1 ? `<small>in ${TK[x.t].length - 1} other${TK[x.t].length > 2 ? 's' : ''}</small>` : ''}</button>${x.note ? `<span class="why">${esc(x.note)}</span>` : ''}</td>
          <td class="num">${x.sh.toLocaleString('en-US', {maximumFractionDigits: 3})}</td><td class="num">${usd(x.px)}</td><td class="num">${usd(x.mk)}</td>
          <td class="num">${usd(x.val)}</td><td class="num">${x.w.toFixed(1)}%<span class="wbar"><i style="--c:${p.c};width:${Math.min(100, x.w / Math.max(...p.h.map(y => y.w)) * 100)}%"></i></span></td>
          <td class="num ${cls(x.gain)}">${usdS(x.gain)}</td><td class="num ${cls(x.gp)}">${pct(x.gp, 1)}</td>${hasInc ? `<td class="num">${x.inc ? usd(x.inc) : ''}</td>` : ''}</tr>`).join('')}
          <tr class="cashrow"><td>Cash</td><td></td><td></td><td></td><td class="num">${usd(p.cash)}</td><td class="num">${(p.cash / p.value * 100).toFixed(1)}%</td><td></td><td></td>${hasInc ? '<td></td>' : ''}</tr>
          ${p.income > 0 ? `<tr class="cashrow"><td>Income collected</td><td></td><td></td><td></td><td class="num">${usd(p.income)}</td><td class="num">${(p.income / p.value * 100).toFixed(1)}%</td><td></td><td></td><td></td></tr>` : ''}
        </tbody></table></div>
      <p class="note">“Paid” is the average purchase price. Prices are end-of-day closes as of ${ASOF}.</p>
      <p style="margin-top:22px"><button class="cta ghost" data-compare="${p.id}">Compare with another portfolio</button></p>
    </div>`;
  countUp($('pval'), START, p.value, 1100, v => usd(v));
  drawChart(p);
}

// value over time: recorded snapshots for the portfolio, VOO closes for the index
const HIST = Array.isArray(D.hist) ? D.hist : [];
let chartP = null;
function drawChart(p) {
  chartP = p;
  const svg = $('pchart'); if (!svg) return;
  const W = svg.clientWidth; if (!W) return;
  const H = W < 560 ? 220 : 300, L = 58, R = 12, T = 16, B = 26;
  const a = [{d: p.start, v: START}];
  HIST.forEach(h => { if (h.d > p.start && h.d < D.asof && h.v && h.v[p.id] != null) a.push({d: h.d, v: h.v[p.id]}); });
  a.push({d: D.asof, v: p.value});
  const base = VOO[p.start] || VOO[INCEPTION];
  const b = Object.keys(VOO).filter(k => k !== 'now' && k >= p.start && k < D.asof).sort().map(d => ({d, v: START * VOO[d] / base}));
  b.push({d: D.asof, v: START * VOO.now / base});
  const tm = d => new Date(d + 'T12:00:00').getTime(), t0 = tm(p.start), t1 = tm(D.asof);
  const vs = a.concat(b).map(o => o.v); let lo = Math.min(...vs), hi = Math.max(...vs); const pad = (hi - lo) * .12 || 100; lo -= pad; hi += pad;
  const X = d => L + (tm(d) - t0) / (t1 - t0 || 1) * (W - L - R), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const step = [100, 250, 500, 1000, 2000, 5000].find(s => (hi - lo) / s <= 5) || 5000;
  let g = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step)
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === START ? '#5d767c' : '#27434f'}"/><text x="0" y="${Y(v) + 4}">${usd(v, 0)}</text>`;
  const m = new Date(t0); m.setDate(1); m.setMonth(m.getMonth() + 1);
  for (; m.getTime() < t1; m.setMonth(m.getMonth() + 1)) { const x = L + (m.getTime() - t0) / (t1 - t0) * (W - L - R); g += `<text x="${x}" y="${H - 6}" text-anchor="middle">${m.toLocaleDateString('en-US', {month: 'short'})}</text>`; }
  const path = s => s.map((o, i) => (i ? 'L' : 'M') + X(o.d).toFixed(1) + ' ' + Y(o.v).toFixed(1)).join('');
  g += `<path class="sl" d="${path(b)}"/><path class="pl" pathLength="1" stroke="${p.c}" d="${path(a)}"/>`;
  a.forEach((o, i) => { g += `<circle class="pt" style="--i:${i}" cx="${X(o.d)}" cy="${Y(o.v)}" r="${i === a.length - 1 ? 6 : 4.5}" fill="${i === a.length - 1 ? p.c : '#14262f'}" stroke="${p.c}" stroke-width="2.5" data-tip="${dateTxt(o.d)}|${usd(o.v)}"/>`; });
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.style.height = H + 'px'; svg.innerHTML = g;
  $('pchart-note').textContent = `Each point is a date this site has the portfolio's value on record (${a.length} so far, counting the start). The S&P line uses every recorded close.`;
}

// ───────── analytics ─────────
$('an-lede').textContent = `${tkAgg.length} stocks and funds across ${N} portfolios, as of ${ASOF}.`;
function drawH2H() {
  const opt = sel => byRet.map(p => `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>#${p.rank} ${esc(p.name)}</option>`).join('');
  const a = byId[state.a], b = byId[state.b];
  const side = (p, o, k) => `<div class="side" style="--c:${p.c}">
      <select aria-label="Portfolio ${k}" data-side="${k}">${opt(p.id)}</select>
      <div class="big num">${usd(p.value, 0)}${p !== o && p.value > o.value ? '<span class="win">Ahead</span>' : ''}</div>
      <dl>
        <dt>Return</dt><dd class="num ${cls(p.ret)}">${pct(p.ret)}</dd>
        <dt>Against the S&amp;P 500</dt><dd class="num ${cls(p.alpha)}">${sgn(p.alpha)} pts</dd>
        <dt>Strategy</dt><dd>${FAM[p.fam]}</dd>
        <dt>Positions</dt><dd class="num">${p.h.length}</dd>
        <dt>Largest position</dt><dd class="num">${p.h[0] ? `${p.h[0].t}, ${p.h[0].w.toFixed(0)}%` : 'None'}</dd>
        <dt>Cash</dt><dd class="num">${(p.cash / p.value * 100).toFixed(1)}%</dd>
        <dt>Income collected</dt><dd class="num">${usd(p.income)}</dd>
        <dt>Started</dt><dd>${dateTxt(p.start)}</dd>
      </dl>
      <p style="margin-top:18px"><button class="cta ghost" data-go="${p.id}">Open this portfolio</button></p>
    </div>`;
  $('h2h').innerHTML = side(a, b, 'a') + side(b, a, 'b');
  const both = a === b ? [] : a.h.filter(x => b.h.some(y => y.t === x.t)).map(x => x.t);
  $('h2h-shared').innerHTML = a === b ? 'Pick two different portfolios to compare them.' :
    both.length ? `Both hold <span class="tklist">${both.map(t => `<button class="tkpill" data-tk="${t}">${t}</button>`).join('')}</span>` : 'These two have no stocks in common.';
}
$('h2h').addEventListener('change', e => { const s = e.target.closest('select'); if (s) { state[s.dataset.side] = s.value; drawH2H(); } });

function squarify(items, x, y, w, h) {
  const total = items.reduce((s, i) => s + i.v, 0), out = [], sum = r => r.reduce((s, n) => s + n.a, 0);
  let nodes = items.map(i => ({i, a: i.v * w * h / total})), row = [];
  const worst = (r, side) => { const s = sum(r), mx = Math.max(...r.map(n => n.a)), mn = Math.min(...r.map(n => n.a)); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
  const lay = r => {
    const s = sum(r);
    if (w >= h) { const cw = s / h; let cy = y; r.forEach(n => { out.push({i: n.i, x, y: cy, w: cw, h: n.a / cw}); cy += n.a / cw; }); x += cw; w -= cw; }
    else { const rh = s / w; let cx = x; r.forEach(n => { out.push({i: n.i, x: cx, y, w: n.a / rh, h: rh}); cx += n.a / rh; }); y += rh; h -= rh; }
  };
  while (nodes.length) {
    const side = Math.min(w, h), n = nodes[0];
    if (!row.length || worst(row.concat(n), side) <= worst(row, side)) { row.push(n); nodes.shift(); } else { lay(row); row = []; }
  }
  if (row.length) lay(row);
  return out;
}
const mix = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
const heat = gp => { const t = Math.min(1, Math.abs(gp) / 25); return gp >= 0 ? mix([38, 67, 79], [32, 158, 98], t) : mix([38, 67, 79], [205, 58, 46], t); };
function drawTreemap() {
  const el = $('treemap'), W = el.clientWidth, H = el.clientHeight; if (!W) return;
  el.innerHTML = squarify(tkAgg.map(t => ({v: t.val, t})), 0, 0, W, H).map((r, i) => {
    const t = r.i.t, showPct = r.w > 56 && r.h > 40, showT = r.w > 46 && r.h > 24;
    return `<button data-tk="${t.t}" style="--i:${i};left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;background:${heat(t.gp)};color:#fff" aria-label="${t.t}, ${pct(t.gp, 1)}, held by ${t.n}" data-tip="${t.t}|${usd(t.val, 0)} in ${t.n} portfolio${t.n > 1 ? 's' : ''}, ${pct(t.gp, 1)}">${showT ? t.t : ''}${showPct ? `<small class="num">${pct(t.gp, 1)}</small>` : ''}</button>`;
  }).join('');
}
function drawPicks() {
  const all = P.flatMap(p => p.h.map(x => ({p, x}))).sort((a, b) => b.x.gp - a.x.gp);
  const li = e => `<li><button class="tk" data-tk="${e.x.t}">${e.x.t}</button><button class="pf" data-open="${e.p.id}">${esc(e.p.name)}</button><span class="num ${cls(e.x.gp)}">${pct(e.x.gp, 1)}</span></li>`;
  const uniq = list => { const seen = new Set(); return list.filter(e => !seen.has(e.x.t) && seen.add(e.x.t)).slice(0, 6); };
  $('best').innerHTML = uniq(all).map(li).join('');
  $('worst').innerHTML = uniq([...all].reverse()).map(li).join('');
}
function drawFams() {
  const rows = fams.map(f => { const ps = P.filter(p => p.fam === f); return {f, n: ps.length, r: ps.reduce((s, p) => s + p.ret, 0) / ps.length}; }).sort((a, b) => b.r - a.r);
  const lo = Math.min(0, ...rows.map(r => r.r)) * 1.1, hi = Math.max(0, ...rows.map(r => r.r)) * 1.1 || 1;
  $('fams').innerHTML = rows.map(r => `<li><span>${sw(FAMC[r.f])}<span>${FAM[r.f]} <small>${r.n > 1 ? '× ' + r.n : ''}</small></span></span>${trackHTML(r.r, null, lo, hi, FAMC[r.f])}<span class="num ${cls(r.r)}">${pct(r.r, 1)}</span></li>`).join('');
  const inc = P.flatMap(p => p.h.filter(x => x.inc > 0).map(x => ({p, x}))).sort((a, b) => b.x.inc - a.x.inc);
  const mx = Math.max(1, ...inc.map(e => e.x.inc));
  $('income').innerHTML = inc.length ? inc.map(e => `<li><span><button class="tk" data-tk="${e.x.t}">${sw(e.p.c)}${e.x.t}</button></span>${trackHTML(e.x.inc, null, 0, mx, e.p.c)}<span class="num">${usd(e.x.inc)}</span></li>`).join('') : '<li>No income has been paid yet.</li>';
}

// ───────── method ─────────
$('method-lede').textContent = `${word(fams.length)} strategies, ${word(N).toLowerCase()} active portfolios, and a set of rules meant to keep the experiment honest.`;
$('strats').innerHTML = fams.map(f => {
  const ps = byRet.filter(p => p.fam === f), s = STRAT[f] || {h: '', t: '', x: ''};
  const tks = [...new Set(ps.flatMap(p => p.h.map(x => x.t)))];
  return `<div class="strat"><div class="side"><h3 class="h3">${sw(FAMC[f])}${FAM[f]}</h3><small>${s.h}<br>${s.t}</small></div>
    <div><p>${s.x}</p>
      <div class="books">${ps.map(p => `<button class="bookbtn" data-open="${p.id}">${esc(p.name)} <span class="num ${cls(p.ret)}">${pct(p.ret, 1)}</span></button>`).join('')}</div>
      <div class="books tklist">${tks.map(t => `<button class="tkpill" data-tk="${t}">${t}</button>`).join('')}</div></div></div>`;
}).join('');

// ───────── drawer ─────────
const drawer = $('drawer'), scrim = $('scrim');
let lastFocus = null;
function openDrawer(html, label) {
  if (!drawer.classList.contains('on')) lastFocus = document.activeElement;
  drawer.innerHTML = `<button class="x" data-close aria-label="Close">×</button>` + html;
  drawer.setAttribute('aria-label', label);
  [...drawer.children].forEach((c, i) => c.style.setProperty('--k', i));
  drawer.classList.add('on'); scrim.classList.add('on');
  drawer.scrollTop = 0; drawer.focus();
}
function closeDrawer() {
  if (!drawer.classList.contains('on')) return;
  drawer.classList.remove('on'); scrim.classList.remove('on');
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({preventScroll: true});
}
function openPortfolio(p) {
  openDrawer(`<span class="fam">${sw(p.c)}${FAM[p.fam]}, #${p.rank} of ${N}</span>
    <h2>${esc(p.name)}</h2>
    <div class="big num">${usd(p.value)}</div>
    <div class="line2 num"><span class="${cls(p.ret)}">${pct(p.ret)}</span><span class="${cls(p.alpha)}">${sgn(p.alpha)} pts vs S&amp;P 500</span></div>
    ${p.method ? `<p class="dplan">${esc(p.method)}</p>` : ''}
    ${allocHTML(p)}
    <ul class="hl"><li class="th"><span>Holding</span><span>Share</span><span>Value</span><span>Gain</span></li>
      ${p.h.map((x, i) => `<li><button class="tk" data-tk="${x.t}">${sw(shade(p.c, i, p.h.length))}${x.t}</button><span class="w num">${x.w.toFixed(0)}%</span><span class="num">${usd(x.val, 0)}</span><span class="num ${cls(x.gp)}">${pct(x.gp, 1)}</span></li>`).join('')}
      <li><span style="color:var(--mute)">Cash${p.income > 0 ? ' and income' : ''}</span><span class="w num">${((p.cash + p.income) / p.value * 100).toFixed(0)}%</span><span class="num">${usd(p.cash + p.income, 0)}</span><span></span></li></ul>
    <div><a class="cta" href="#${p.id}">Open full portfolio</a><button class="cta ghost" data-compare="${p.id}">Compare</button></div>`, p.name);
}
function openTicker(t) {
  const a = (TK[t] || []).slice().sort((m, n) => n.x.val - m.x.val); if (!a.length) return;
  const g = tkAgg.find(z => z.t === t);
  openDrawer(`<span class="fam">Held in ${a.length} of ${N} portfolios</span>
    <h2>${t}</h2>
    <div class="big num">${usd(g.val, 0)}</div>
    <div class="line2 num"><span class="${cls(g.gp)}">${pct(g.gp, 1)} since purchase</span><span style="color:var(--mute)">last close ${usd(a[0].x.mk)}</span></div>
    <ul class="hl"><li class="th"><span>Portfolio</span><span>Share</span><span>Value</span><span>Gain</span></li>
      ${a.map(e => `<li><button class="tk" data-go="${e.p.id}" style="font-weight:600;min-width:0"><span style="display:contents">${sw(e.p.c)}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.p.name)}</span></button><span class="w num">${e.x.w.toFixed(0)}%</span><span class="num">${usd(e.x.val, 0)}</span><span class="num ${cls(e.x.gp)}">${pct(e.x.gp, 1)}</span></li>`).join('')}</ul>
    <p class="note">“Share” is how much of that portfolio this stock makes up. Gains differ when portfolios bought at different prices.</p>`, t);
}
scrim.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('#field .dot')) { e.preventDefault(); openPortfolio(byId[e.target.dataset.open]); }
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-close],[data-tk],[data-open],[data-go],[data-compare],[data-scroll]'); if (!t) return;
  if (t.dataset.scroll) return $(t.dataset.scroll).scrollIntoView({behavior: reduced ? 'auto' : 'smooth'});
  if (t.hasAttribute('data-close')) return closeDrawer();
  if (t.dataset.tk) return openTicker(t.dataset.tk);
  if (t.dataset.open) return openPortfolio(byId[t.dataset.open]);
  if (t.dataset.go) { location.hash = t.dataset.go; return; }
  if (t.dataset.compare) {
    state.a = t.dataset.compare; if (state.b === state.a) state.b = (byRet.find(p => p.id !== state.a) || byRet[0]).id;
    drawH2H(); location.hash = 'analytics';
  }
});

// ───────── tooltip ─────────
const tip = $('tip');
document.addEventListener('pointermove', e => {
  const t = e.pointerType === 'touch' ? null : e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tip.hidden = true; return; }
  const [a, b] = t.dataset.tip.split('|');
  tip.innerHTML = `<b>${esc(a)}</b>${b ? `<span>${esc(b)}</span>` : ''}`;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, e.clientX + 14)) + 'px';
  tip.style.top = (e.clientY + r.height + 24 > innerHeight ? e.clientY - r.height - 12 : e.clientY + 16) + 'px';
});
document.addEventListener('scroll', () => { tip.hidden = true; }, {passive: true});

// ───────── motion: reveal on scroll ─────────
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {threshold: .06});
document.querySelectorAll('[data-rise],[data-grow]').forEach(el => io.observe(el));

// ───────── routing ─────────
const VIEWS = ['home', 'portfolios', 'analytics', 'method'];
function route() {
  const h = decodeURIComponent(location.hash.slice(1)) || 'home';
  const p = byId[h], view = p ? 'portfolio' : VIEWS.includes(h) ? h : 'home';
  closeDrawer(); tip.hidden = true;
  ['home', 'portfolios', 'portfolio', 'analytics', 'method'].forEach(v => $('v-' + v).hidden = v !== view);
  document.querySelectorAll('[data-nav]').forEach(a => {
    const on = a.dataset.nav === (view === 'portfolio' ? 'portfolios' : view);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (p) drawDetail(p);
  document.title = (p ? p.name + ' · ' : view === 'home' ? '' : view[0].toUpperCase() + view.slice(1) + ' · ') + 'The 10K Experiment';
  scrollTo(0, 0);
  if (view === 'home') { setPinMode(); drawField(); onScroll(); }
  if (view === 'analytics') drawTreemap();
}
addEventListener('hashchange', route);
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!$('v-home').hidden) { setPinMode(); drawField(); onScroll(); } if (!$('v-analytics').hidden) drawTreemap(); if (!$('v-portfolio').hidden && chartP) drawChart(chartP); }, 150); });

// ───────── footer ─────────
(function () {
  const el = $('updated'), a = new Date(D.asof + 'T12:00:00');
  const lines = ['Prices as of ' + ASOF + ' close'];
  if (D.published) lines.push('Published ' + new Date(D.published).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short'}));
  if ((Date.now() - a) / 864e5 > 5) lines.push('Data may be out of date');
  el.textContent = '';
  lines.forEach(t => { const s = document.createElement('div'); s.textContent = t; el.appendChild(s); });
})();

drawChips1(); drawChips2(); drawBoard(); drawCards(); drawH2H(); drawPicks(); drawFams();
route();
})();
