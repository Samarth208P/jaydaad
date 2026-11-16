import { api, connectQorex, disconnectQorex, walletState, fundVault, openWindow, closeWindow, deployVault,
  executeProof, toNative, explorerTx, explorerAddress, WALLET_URL, FAUCET_URL } from './wallet.js';
import { compactInformation } from './info.js';
import { startCoverMotion, mountPageMotion, mountMapMotion, refreshScrollPositions } from './motion.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const short = a => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'Not connected';
const number = n => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 6 });
const date = t => t ? new Date(t * 1000).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not started';
const duration = sec => sec >= 86400 ? `${number(sec / 86400)} days` : sec >= 3600 ? `${number(sec / 3600)} hours` : `${number(sec / 60)} minutes`;
const countdown = sec => {
  const [unit, seconds] = sec >= 86400 ? ['day', 86400] : sec >= 3600 ? ['hour', 3600] : ['minute', 60];
  const count = Math.ceil(sec / seconds);
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
};
function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
const S = { mode: 'testnet', route: location.hash.slice(1) || 'overview', vault: null,
  wallet: null, network: null, networkError: '', busy: false, drawer: false, drill: null, receiptResult: '',
  liveEvents: stored('jaydaad.transactions', []), chainEvents: [], metadata: stored('jaydaad.vault', null) };
const paths = {
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  vault: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="12" r="4"/><path d="m12 8 0 2m4 2h-2m-2 4v-2m-4-2h2M19 8h2m-2 8h2"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m2-15a3 3 0 0 1 0 6m2 9v-3a5 5 0 0 0-3-4"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  up: '<path d="m7 17 10-10M7 7h10v10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  wallet: '<path d="M20 8V5H5a2 2 0 0 0-2 2v12h18V8H5a2 2 0 0 1 0-4"/><path d="M21 11h-6v5h6"/><path d="M17 13.5h.01"/>',
  settings: '<path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-3Z"/><circle cx="12" cy="11" r="3"/>',
  book: '<path d="M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 3-2-3-5-4-9-3Z"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3Zm4 12h4"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  leaf: '<path d="M20 3C9 2 3 8 5 15s15 8 15-12ZM4 21 15 10"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  refresh: '<path d="M20 8a9 9 0 0 0-15-3L3 8m0-5v5h5m-4 8a9 9 0 0 0 15 3l2-3m0 5v-5h-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M9 3H3v18h6m5-14 5 5-5 5m-6-5h13"/>',
  flask: '<path d="M8 3h8m-6 0v6l-6 10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L14 9V3M7 15h10"/>',
  heart: '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 8 16 8 16S25 10 20 5Z"/>'
};
function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`; }
const button = (label, action, cls = '', ico = '', disabled = false) => `<button type="button" class="btn ${cls}" data-action="${action}" ${disabled ? 'disabled' : ''}>${ico ? icon(ico) : ''}${label}</button>`;
const tag = (text, cls = '') => `<span class="tag ${cls}">${text}</span>`;
const link = (label, href, cls = '') => `<a class="${cls}" href="${escape(href)}" target="_blank" rel="noopener noreferrer">${label}${icon('up')}</a>`;

const events = () => {

  const unique = new Map([...S.chainEvents, ...S.liveEvents].map(e => [e.hash || e.title + e.time, e]));
  return [...unique.values()].sort((a, b) => new Date(b.time) - new Date(a.time));
};
const phaseLabel = phase => ({ Enrollment: 'Awaiting check-in', Active: 'Active', Grace: 'Grace period', Claimable: 'Ready to claim', Closed: 'Settled' }[phase] || 'Not created');
const nav = [['overview', 'grid', 'Overview'], ['vault', 'vault', 'My vault'], ['beneficiaries', 'people', 'Beneficiary'], ['activity', 'activity', 'Activity'], ['security', 'shield', 'Security center']];

const sections = [...nav, ['guide', 'book', 'Getting started'], ['settings', 'settings', 'Preferences']];

function navigation() {
  return sections.map(([route, glyph, label]) => `<a href="#${route}" class="nav-link" ${S.route === route ? 'aria-current="page"' : ''}>${icon(glyph)}${label}</a>`).join('');
}

function workspaceMenu() {
  return `<aside class="workspace-menu"><div class="rail-heading">${icon('vault')} Workspace</div><nav aria-label="Workspace">${navigation()}</nav>
    <button class="network-switch" data-action="refresh" title="Refresh Diana state"><span class="status-dot"></span>${('Diana testnet')} ${icon('chevron')}</button></aside>`;
}

function masthead() {
  return `<header class="masthead"><div class="mast-strip">
    <a class="brand" href="#overview" aria-label="Jaydaad overview">Jaydaad</a>
    <img class="mast-mark" src="/favicon.svg" width="32" height="19" alt="">
    <div class="mast-actions"><button class="index-toggle" data-action="menu" aria-label="Toggle navigation" aria-expanded="${S.drawer}" aria-controls="page-index">Index ${icon('chevron')}</button>
    ${button(S.wallet ? short(S.wallet.address) : 'Connect QoreX', S.wallet ? 'wallet' : 'connect', S.wallet ? 'wallet-connected' : 'mast-wallet')}</div></div>
    <nav id="page-index" aria-label="Page index" ${S.drawer ? '' : 'hidden'}>${navigation()}<button class="network-switch" data-action="refresh">${icon('settings')} Refresh Diana state</button></nav></header>`;
}

let pageMotion, mapMotion;
function render() {
  if (!sections.some(([route]) => route === S.route)) S.route = 'overview';
  mapMotion?.revert();
  pageMotion?.revert();
  const pages = { vault: vaultPage, beneficiaries, activity: activityPage, security: securityPage, guide: guidePage, settings: settingsPage };
  const notices = `${('')}
    ${S.networkError ? `<div class="error-banner">${icon('info')}<span>${escape(S.networkError)}</span><button data-action="refresh">Retry</button></div>` : ''}`;
  $('#app').innerHTML = `<div class="binder">${masthead()}<main class="sheet" id="main" tabindex="-1"><div class="binding left" aria-hidden="true"></div><div class="binding right" aria-hidden="true"></div>
    <div class="sheet-content">${S.route === 'overview' ? overview(notices) : `<div class="workspace-page">${workspaceMenu()}<div class="route-body">${notices}${pages[S.route]()}</div></div>`}
    <footer class="page-footer"><a href="#overview">Jaydaad</a><span>QoreChain Diana · Testnet prototype</span><a href="#guide">Getting started ↗</a></footer></div></main></div>`;
  compactInformation($('#app'), { phase: S.vault?.phase });
  pageMotion = mountPageMotion($('#app'));
  mapMotion = mountMapMotion($('.map-column'));
  if (S.busy) document.querySelectorAll('button[data-action]').forEach(el => { el.disabled = true; });
}

function heading(title, desc, action = '') {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`;
}

function inheritanceMap() {
  return `<figure class="inheritance-map"><figcaption>${icon('people')} Inheritance map</figcaption>
    <svg viewBox="0 0 400 228" role="img" aria-label="Owner and witness approve the vault. The beneficiary may claim after the grace period.">
      <defs><pattern id="map-dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".75" fill="#c6d4ca"/></pattern></defs>
      <rect width="400" height="228" fill="url(#map-dots)"/>
      <g fill="none" stroke="#49885a"><path id="owner-approval" d="M60 62H100C145 62 140 116 185 116H206" pathLength="1"/><path id="witness-approval" d="M60 174H100C145 174 140 116 185 116H206" pathLength="1"/>
      <g class="approval-trace" stroke="#125e2e" stroke-width="2" stroke-dasharray="1 1"><use href="#owner-approval"/><use href="#witness-approval"/></g>
      <path d="M206 116H338" stroke-dasharray="3 4"/><circle cx="206" cy="116" r="40" stroke-dasharray="1 5"/><circle cx="206" cy="116" r="29" stroke="#b7cbbd"/></g>
      <g fill="#fff" stroke="#176d35"><circle cx="60" cy="62" r="7"/><circle cx="60" cy="174" r="7"/><circle cx="338" cy="116" r="7"/></g>
      <circle cx="206" cy="116" r="17" fill="#18733b"/><g fill="none" stroke="white"><rect x="199" y="114" width="14" height="10" rx="2"/><path d="M202 114v-3a4 4 0 0 1 8 0v3"/></g>
      <g text-anchor="middle"><text x="60" y="46">Owner</text><text x="60" y="198">Witness</text><text x="206" y="174">Vault</text><text x="338" y="99">Beneficiary</text></g>
    </svg></figure>`;
}

const plotNames = ['Inheritance map', 'Check-in schedule', 'Key enrollment'];
let plotIndex = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let plotPaused = reducedMotion.matches;
reducedMotion.addEventListener('change', event => {
  if (event.matches) {
    plotPaused = true;
    updatePlot();
  }
});

function plotContent(index) {
  const v = S.vault;
  if (index === 0) return inheritanceMap() + '<div class="plot-key"><i></i> Approval <i></i> Timed handover</div>';
  const schedule = index === 1;
  const entries = schedule
    ? [['Last check-in', date(v?.lastCheckIn)], ['Next check-in', v?.due ? date(v.due) : 'Not scheduled'], ['Claim opens', v?.release ? date(v.release) : 'Not scheduled']]
    : ['Owner', 'Beneficiary', 'Witness'].map((role, i) => {
        const key = v?.keys?.[i];
        return [role, key?.proven && key?.pinned ? 'Verified' : key ? 'Review key' : 'Not enrolled'];
      });
  return `<figure class="inheritance-map"><figcaption>${icon(schedule ? 'clock' : 'shield')}${plotNames[index]}</figcaption>
    <dl class="plot-rows">${entries.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></figure>`;
}

function plotControls() {
  return `<div class="plot-controls" role="group" aria-label="Workspace diagram controls">
    <button type="button" data-plot="playback" aria-label="${plotPaused ? 'Play' : 'Pause'} diagrams">${plotPaused ? '▶' : 'Ⅱ'}</button>
    ${plotNames.map((name, index) => `<button type="button" data-plot="${index}" aria-label="${name}" aria-pressed="${index === plotIndex}"><span></span></button>`).join('')}</div>`;
}

function updatePlot() {
  const column = $('.map-column');
  if (!column) return;
  mapMotion?.revert();
  column.innerHTML = plotContent(plotIndex);
  mapMotion = mountMapMotion(column);
  refreshScrollPositions();
  document.querySelectorAll('[data-plot]').forEach(control => {
    if (control.dataset.plot === 'playback') {
      control.textContent = plotPaused ? '▶' : 'Ⅱ';
      control.setAttribute('aria-label', plotPaused ? 'Play diagrams' : 'Pause diagrams');
    } else control.setAttribute('aria-pressed', String(Number(control.dataset.plot) === plotIndex));
  });
}

setInterval(() => {
  const plate = $('.workspace-plate');
  if (!plate || plotPaused || document.hidden || $('#modal').open || plate.matches(':hover, :focus-within')) return;
  const bounds = plate.getBoundingClientRect();
  if (bounds.bottom <= 0 || bounds.top >= innerHeight) return;
  plotIndex = (plotIndex + 1) % plotNames.length;
  updatePlot();
}, 8000);

function vaultSeal() {
  const petals = Array.from({ length: 7 }, (_, i) =>
    `<ellipse cx="80" cy="80" rx="29" ry="64" transform="rotate(${i * 180 / 7} 80 80)"/>`).join('');
  return `<svg class="hero-seal" viewBox="0 0 160 160" fill="none" aria-hidden="true">
    <g class="seal-petals" stroke="currentColor" stroke-width=".65">${petals}</g>
    <circle class="seal-halo" cx="80" cy="80" r="72" stroke="currentColor" stroke-width=".65" stroke-dasharray="1 4"/>
    <circle cx="80" cy="80" r="29" fill="var(--paper)" stroke="currentColor"/>
    <image href="/favicon.svg" x="64" y="70" width="32" height="20"/>
  </svg>`;
}

function overview(notices) {
  const v = S.vault;
  return `<section class="hero" aria-labelledby="hero-heading"><div class="hero-title"><h1 id="hero-heading">An inheritance vault for the people you love.</h1></div>
    <div class="hero-intro"><p>Set aside test QOR for someone you choose. A check-in signed by you and your witness keeps the vault active. If you miss the deadline and the grace period passes, your beneficiary can claim the balance.</p>
    <div class="hero-actions">${button(v ? 'View my vault' : 'Create a vault', v ? 'view-vault' : 'create', 'primary')}<a class="text-link" href="#guide">How it works ${icon('arrow')}</a></div></div>${vaultSeal()}</section>
    ${notices}
    <section class="workspace-plate axis" aria-label="Vault workspace"><div class="instrument"><div class="instrument-inner">${workspaceMenu()}<div class="map-column">${plotContent(plotIndex)}</div></div></div>
    <div class="summary-slip"><div class="panel-header"><h2>${icon('vault')} Your inheritance vault</h2>${tag(phaseLabel(v?.phase))}</div>${vaultSummary()}</div>${plotControls()}</section>
    <div class="section-heading"><h2>Estate overview</h2><span>[ ${(S.network ? 'Diana testnet' : S.networkError ? 'Network unavailable' : 'Connecting to Diana')} ]</span></div>
    <section class="stats-grid" aria-label="Estate summary"><article class="stat-card"><span class="stat-label">${icon('vault')}Vault balance</span><strong>${number(v?.balance)} <small>${('QOR')}</small></strong><span class="stat-meta">${('Native Diana testnet QOR')}</span></article>
    <article class="stat-card"><span class="stat-label">${icon('people')}Your beneficiary</span><strong>${v ? '1' : '0'} <small>${v ? 'person' : 'people'}</small></strong><span class="stat-meta">${v ? 'Receives 100% of your vault' : 'Someone to leave it to'}</span></article>
    <article class="stat-card"><span class="stat-label">${icon('clock')}Next check-in</span><strong class="stat-date">${v?.due ? date(v.due) : 'Not scheduled'}</strong><span class="stat-meta">${v?.interval ? `Every ${duration(v.interval)}` : 'Set a rhythm that suits you'}</span></article>
    <article class="stat-card"><span class="stat-label">${icon('shield')}Vault protection</span><strong class="stat-date">${v?.keys?.length === 3 && v.keys.every(k => k.proven && k.pinned) ? '3 keys verified' : 'Not enrolled'}</strong><span class="stat-meta">${v ? 'Owner + beneficiary + witness' : 'ML-DSA-87 approval checks'}</span></article></section>
    <section class="timeline-section"><div class="timeline-intro axis"><h2>The inheritance timeline</h2><p>Your check-in sets the clock for each stage of the plan.</p><a href="#guide" class="text-link">Read the guide ↗</a></div>
    <ol class="timeline"><li><h3>Check in</h3><p>You and your witness sign to start or renew your plan.</p></li><li><h3>Grace period</h3><p>After a missed check-in, you can still renew before grace ends.</p></li><li><h3>Handover</h3><p>Your beneficiary and witness can approve a claim after grace expires.</p></li></ol>
    <div class="panel checkin-panel">${checkinCard()}</div></section>
    <section class="panel activity-panel"><div class="panel-header"><h2>Recent activity</h2><a href="#activity" class="text-link">View all activity ${icon('arrow')}</a></div>${activityTable(events().slice(0, 3))}</section>`;
}
function vaultSummary() {
  const v = S.vault;
  return `<div class="vault-title-row"><span class="vault-avatar">${icon('home')}</span><div><h3>${escape(v?.name || 'Your family vault')}</h3><p>${v ? `${short(v.estate)} · ${('Diana testnet')}` : 'A place for the things you leave behind'}</p></div></div><div class="vault-amount">${number(v?.balance)} <span>${('QOR')}</span></div><div class="vault-details"><div><span>Beneficiary</span><strong>${escape(v ? (v.heirName || short(v.heir)) : 'Not added yet')}</strong></div><div><span>Allocation</span><strong>${v ? '100%' : '—'}</strong></div><div><span>Grace period</span><strong>${v ? duration(v.grace) : 'You choose'}</strong></div></div><div class="vault-actions">${button(v ? 'Add funds' : 'Create your vault', v ? 'fund' : 'create', 'primary', 'plus', v && v.phase !== 'Active')}${v && S.route === 'vault' ? button('Rename vault', 'rename-vault', 'secondary') : button(v ? 'Vault details' : 'Attach a Diana vault', v ? 'view-vault' : 'attach', 'secondary', v ? '' : 'flask')}</div><div class="vault-footnote">${icon('lock')}${v ? 'No administrator. No upgrade key. Your rules, on chain.' : 'Your funds stay yours. Only testnet assets in this prototype.'}</div>`;
}
function checkinCard() {
  const v = S.vault;
  const remaining = v?.due ? Math.max(0, v.due - v.now) : 0;
  const fraction = v?.phase === 'Active' ? Math.min(1, remaining / v.interval) : 0;
  const text = { Enrollment: 'Start your plan', Active: 'You’re all checked in', Grace: 'There’s still time to return', Claimable: 'Your beneficiary can claim', Closed: 'This chapter is complete' }[v?.phase] || 'A small check-in. A big reassurance.';
  const hint = { Enrollment: 'A witnessed check-in starts the clock. Funding opens after approval.', Active: 'Your plan is active. A witnessed check-in resets your next deadline.', Grace: `Check in before ${date(v?.release)} to restart your inheritance clock.`, Claimable: 'The owner window has ended. The beneficiary and witness can approve a claim.', Closed: 'The vault balance was released. Create a new plan to begin again.' }[v?.phase] || 'Let your plan know you’re here. Your witness co-signs every check-in.';
  return `<div class="panel-header"><h2>Your check-in</h2>${icon('info', 'muted')}</div><div class="checkin-graphic"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" fill="none" stroke="#dfebe2" stroke-width="5"/><circle cx="50" cy="50" r="43" fill="none" stroke="#187536" stroke-width="5" stroke-linecap="round" stroke-dasharray="${Math.max(4, fraction * 270)} 270" transform="rotate(-90 50 50)"/></svg><span>${icon(v?.phase === 'Active' ? 'check' : 'heart')}</span></div><h3>${text}</h3><p>${hint}</p>${button(v?.phase === 'Claimable' ? 'Claim inheritance' : v?.phase === 'Closed' ? 'Create another vault' : v?.phase === 'Enrollment' ? 'Make first check-in' : 'Check in now', v?.phase === 'Claimable' ? 'claim' : v?.phase === 'Closed' ? 'create' : 'checkin', 'secondary full', v?.phase === 'Claimable' ? 'leaf' : 'check', !v)}<span class="checkin-caption">${v?.phase === 'Active' ? `${countdown(remaining)} until your next check-in` : 'Participant + independent witness approval'}</span>`;
}
function vaultPage() {
  const v = S.vault;
  return `${heading('Your vault. Your wishes.', 'A clear plan, with every important detail in one place.', button((v ? 'Refresh vault' : 'Create a vault'), (v ? 'refresh' : 'create'), 'primary', (v ? 'refresh' : 'plus')))}<div class="dashboard-grid"><section class="panel vault-panel"><div class="panel-header"><h2>Vault overview</h2>${tag(phaseLabel(v?.phase), v?.phase === 'Active' ? 'green' : '')}</div>${vaultSummary()}</section><section class="panel checkin-panel">${checkinCard()}</section></div>${v ? `<section class="panel"><div class="panel-header"><h2>The details that make this yours</h2>${(link('View on explorer', explorerAddress(v.estate), 'text-link'))}</div><dl class="detail-list"><div><dt>Contract address</dt><dd class="address-wrap">${escape(v.estate)} <button class="icon-btn" data-copy="${escape(v.estate)}" aria-label="Copy contract address">${icon('copy')}</button></dd></div><div><dt>Native QOR receiving address</dt><dd class="address-wrap">${escape(toNative(v.estate))}</dd></div><div><dt>Owner</dt><dd class="address-wrap">${escape(v.owner)}</dd></div><div><dt>Check-in interval</dt><dd>${duration(v.interval)}</dd></div><div><dt>Grace period</dt><dd>${duration(v.grace)}</dd></div><div><dt>Claim window opens</dt><dd>${date(v.release)}</dd></div><div><dt>Last confirmed block</dt><dd>${number(v.block)}</dd></div><div><dt>Approval nonce</dt><dd>${v.nonce}</dd></div></dl><div class="inline-note">${icon('info')}This vault holds native ${('testnet QOR')}. One beneficiary receives the entire remaining balance. Timers and enrolled roles cannot be edited after deployment.</div><div class="button-row">${button('Cancel & return funds', 'cancel', 'danger-outline', '', ['Claimable', 'Closed'].includes(v.phase))}${button('Export vault record', 'export', 'secondary', 'download')}${(button('Attach another vault', 'attach', 'secondary'))}</div></section>` : emptyState('vault', 'A plan begins with a vault', 'Choose your beneficiary, an independent witness, and the check-in rhythm that works for you.', 'Create a vault', 'create')}`;
}
function beneficiaries() {
  const v = S.vault;
  return `${heading('The people in your plan.', 'Clear roles. Independent approvals. No surprises.')}${v ? `<section class="panel beneficiary-panel"><div class="panel-header"><h2>Your beneficiary</h2>${tag('Single-beneficiary vault')}</div><div class="person-row"><span class="person-avatar heir">${icon('people')}</span><div><h3>${escape(v.heirName || 'Your beneficiary')}</h3><p class="address-wrap">${escape(v.heir)}</p>${button(v.heirName ? 'Edit beneficiary name' : 'Add beneficiary name', 'name-beneficiary', 'small secondary')}</div><div class="allocation"><strong>100<span>%</span></strong><small>of the vault balance</small></div></div><div class="inline-note">${icon('leaf')}Your beneficiary can claim only after your check-in interval and grace period expire, with a separate witness approval.</div></section><section class="panel"><div class="panel-header"><h2>Your independent witness</h2>${tag(v.keys?.[2]?.proven && v.keys?.[2]?.pinned ? 'Key verified' : 'Key needs attention', v.keys?.[2]?.pinned ? 'green' : 'peach')}</div><div class="person-row"><span class="person-avatar witness">${icon('shield')}</span><div><h3>${escape(v.witnessName || 'Independent witness')}</h3><p class="address-wrap">${escape(v.witness)}</p></div></div><p class="body-copy">The witness verifies the intended person before co-signing a check-in, cancellation, or claim. The contract checks their signature. It does not verify liveness or a legal death certificate.</p><div class="inline-note">${icon('info')}Choose someone independent. Losing their key or their cooperation can prevent a payout. Witness succession is not implemented in this prototype.</div></section>` : emptyState('people', 'Leave a little peace of mind', 'Your plan has one beneficiary and one independent witness. Add their registered addresses when you create a vault.', 'Create a vault', 'create')}`;
}
function activityTable(list) {
  if (!list.length) return `<div class="empty-activity"><span class="empty-icon">${icon('activity')}</span><div><strong>A clear record starts here</strong><p>Check-ins, funding, and claims will appear as you use your vault.</p></div></div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Event</th><th>When</th><th>Record</th></tr></thead><tbody>${list.map(ev => `<tr><td><div class="event-cell"><span class="event-icon ${ev.type === 'notice' ? 'peach' : 'sage'}">${icon(ev.title?.toLowerCase().includes('fund') ? 'plus' : ev.type === 'notice' ? 'clock' : 'check')}</span><div><strong>${escape(ev.title)}</strong><p>${escape(ev.detail)}</p></div></div></td><td>${new Date(ev.time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td>${ev.hash ? link(ev.verified ? ev.shield === 'shielded' ? 'Hybrid verified' : 'Included' : 'Pending', explorerTx(ev.hash), 'receipt-link') : tag('Not broadcast')}</td></tr>`).join('')}</tbody></table></div>`;
}
function activityPage() { return `${heading('Every step, accounted for.', 'Your vault’s check-ins, contributions, and handovers.', button('Export records', 'export', 'secondary', 'download'))}<section class="panel"><div class="panel-header"><h2>${('This browser’s testnet receipts')}</h2>${button('Refresh', 'refresh', 'small secondary', 'refresh')}</div>${activityTable(events())}<p class="table-note">${('Wallet receipts are saved on this device. Confirm a transaction hash on Diana to independently check inclusion.')}</p></section>${(`<section class="panel"><div class="panel-header"><h2>Verify a Diana transaction</h2></div><form id="receipt-form" class="inline-form"><label class="sr-only" for="tx-hash">Transaction hash</label><input id="tx-hash" name="hash" placeholder="Paste a 64-character transaction hash" required pattern="(0x)?[a-fA-F0-9]{64}" maxlength="66"><button class="btn secondary" type="submit">Verify receipt</button></form><div id="receipt-result" role="status">${S.receiptResult}</div></section>`)}`; }
function securityPage() {
  const v = S.vault;
  const scoped = S.wallet?.window?.window || S.wallet?.window;
  const scope = scoped?.allowed_targets || [];
  return `${heading('Care deserves a second signature.', 'Review who can act, what they can do, and where the boundaries are.')}<section class="security-intro"><span class="security-emblem">${icon('shield')}</span><div><h2>Two approvals. One very personal plan.</h2><p>A sensitive vault action requires the participant’s transaction, their ML-DSA-87 signature, and a separate witness signature. A stolen classical key alone cannot supply these approvals.</p></div>${tag('ML-DSA-87', 'violet')}</section>
    <div class="two-column"><section class="panel"><div class="panel-header"><h2>Enrolled keys</h2>${tag(v ? '3 participants' : 'Not enrolled')}</div>${['Owner', 'Beneficiary', 'Witness'].map((role, i) => { const k = v?.keys?.[i]; return `<div class="key-row"><span class="key-role">${icon(i === 2 ? 'shield' : 'people')}${role}</span><div><strong>${k ? short(k.address) : 'Not added'}</strong><small>${k?.proven && k?.pinned ? 'Possession proven · pinned key matches' : k ? 'Registry key no longer matches' : 'Create or attach a vault first'}</small></div>${k?.proven && k?.pinned ? icon('check', 'green-text') : icon('lock', 'muted')}</div>`; }).join('')}<p class="body-copy small-copy">The contract checks the live registry on every approval. Rotated or revoked pinned keys cannot approve new actions.</p></section>
    <section class="panel"><div class="panel-header"><h2>QoreX authorization window</h2>${tag(scoped?.live || S.wallet?.window?.live ? 'Open' : 'Closed', scoped?.live ? 'green' : '')}</div><p class="body-copy">Authorize a short EVM session for this vault only. Opening and closing are hybrid-signed QoreX native transactions.</p><dl class="window-limits"><div><dt>Target</dt><dd>${v ? short(v.estate) : 'Attach a Diana vault'}</dd></div><div><dt>Maximum transactions</dt><dd>3</dd></div><div><dt>Maximum value + fees</dt><dd>1 test QOR</dd></div><div><dt>Expires after</dt><dd>100 blocks</dd></div></dl>${scope.length ? `<p class="small-copy address-wrap">Current scope: ${scope.map(escape).join(', ')}</p>` : ''}<div class="button-row">${button('Open scoped window', 'open-window', 'primary', 'lock', (!v) || !S.wallet)}${button('Close window', 'close-window', 'secondary', '', (!S.wallet))}</div><p class="small-copy muted">A native funding transfer does not need an EVM window. The window above applies to your connected native account’s matching 0x address.</p></section></div>
    <section class="panel"><div class="panel-header"><h2>What this prototype still depends on</h2></div><div class="risk-grid"><div>${icon('people')}<h3>A trustworthy witness</h3><p>Liveness checks happen outside the contract. This app does not detect death, impersonation, or AI-generated identity.</p></div><div>${icon('lock')}<h3>Long-term key access</h3><p>Key recovery, witness succession, and cryptographic migration need a reviewed recovery design before real use.</p></div><div>${icon('book')}<h3>Independent review</h3><p>Official QCAI audit reports are pending.</p></div></div></section>`;
}
function guidePage() {
  return `${heading('A little guidance goes a long way.', 'A practical path from your first connection to a working inheritance plan.')}<section class="panel guide-panel"><div class="guide-step"><span>1</span><div><h2>Connect QoreX on Diana</h2><p>Install QoreX, choose the Diana testnet inside the wallet, and connect. Jaydaad uses the native provider’s hybrid <code>signAndBroadcast</code> path. Private keys stay in the wallet.</p><div class="button-row">${button(S.wallet ? 'View connected wallet' : 'Connect QoreX', S.wallet ? 'wallet' : 'connect', 'primary', 'wallet')}${link('Install QoreX', WALLET_URL, 'text-link')}</div></div></div><div class="guide-step"><span>2</span><div><h2>Get a little test QOR</h2><p>The official faucet supplies valueless Diana QOR. Native transfers use <code>uqor</code> (6 decimals); EVM contract balances use 18 decimals. Jaydaad converts amounts before building the message.</p>${link('Open the official faucet', FAUCET_URL, 'text-link')}</div></div><div class="guide-step"><span>3</span><div><h2>Deploy and attach your vault</h2><p>Choose distinct owner, beneficiary, and witness addresses with possession-proven ML-DSA-87 keys. Choose your check-in interval and grace period. Deploy the compiled contract on chain 9800, then attach its address here.</p><div class="inline-note">${icon('info')}Current QoreX releases support native payments and window transactions but do not yet support EVM sends or arbitrary PQ message signing. Use the documented deployment and approval CLI for contract actions. The app never substitutes a simulated success.</div><div class="button-row">${button('Attach a Diana vault', 'attach', 'secondary', 'vault')}${button('Deployment instructions', 'deployment-help', 'secondary', 'book')}</div></div></div><div class="guide-step"><span>4</span><div><h2>Start the clock, then fund with QoreX</h2><p>Complete a participant-and-witness check-in to activate the vault. Then send test QOR from QoreX to the vault’s native address. Jaydaad checks the receipt and refreshes the actual contract balance.</p></div></div><div class="guide-step"><span>5</span><div><h2>Check in, return during grace, or hand over</h2><p>A witnessed check-in restarts the clock. A missed check-in opens grace. After grace, only the beneficiary with witness approval can claim. These boundaries use block time, without a keeper.</p></div></div></section><section class="guide-links">${link('Developer Fest rules', 'https://build.qorechain.io/rules', 'text-link')}${link('QoreX integration guide', 'https://docs.qorechain.io/developer-tools/qorex-integrations', 'text-link')}${link('Diana EVM windows', 'https://docs.qorechain.io/developer-guide/evm-window-reference', 'text-link')}</section>`;
}
function settingsPage() { return `${heading('Your workspace, at a glance.', 'Connection details and local records for this device.')}<section class="panel"><div class="panel-header"><h2>Network</h2>${tag('Diana only', 'violet')}</div><dl class="detail-list"><div><dt>Native chain</dt><dd>qorechain-diana</dd></div><div><dt>EVM chain ID</dt><dd>9800</dd></div><div><dt>Currency</dt><dd>Testnet QOR (no monetary value)</dd></div><div><dt>RPC</dt><dd class="address-wrap">https://evm-testnet.qore.host</dd></div><div><dt>Latest observed block</dt><dd>${S.network ? number(S.network.block) : 'Unavailable'}</dd></div><div><dt>Workspace mode</dt><dd>${('Public Diana testnet')}</dd></div></dl>${button('Refresh Diana state', 'refresh', 'secondary')}</section><section class="panel"><div class="panel-header"><h2>Wallet & local data</h2></div><p class="body-copy">Vault labels and this browser’s transaction receipts are saved on this device. No secret keys are stored in the app. Clearing local records does not delete a vault or move any funds.</p><div class="button-row">${button(S.wallet ? 'Disconnect QoreX' : 'Connect QoreX', S.wallet ? 'disconnect' : 'connect', 'secondary', 'wallet')}${button('Export public records', 'export', 'secondary', 'download')}${button('Clear browser records', 'clear', 'danger-outline')}</div></section>`; }
function emptyState(i, title, text, label, action) { return `<section class="panel empty-state"><span class="empty-state-icon">${icon(i)}</span><h2>${title}</h2><p>${text}</p>${button(label, action, 'primary', 'plus')}</section>`; }

function modal(title, subtitle, content) {
  $('#modal-content').innerHTML = `<div class="modal-heading"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div>${content}<p id="modal-error" class="form-error" role="alert"></p>`;
  compactInformation($('#modal-content'), { phase: S.vault?.phase });
  if (!$('#modal').open) $('#modal').showModal();
}
function closeModal() { $('#modal').close(); }
function toast(message, error = false) {
  $('#toast').textContent = message; $('#toast').className = `toast ${error ? 'error' : ''}`; $('#toast').hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { $('#toast').hidden = true; }, error ? 10000 : 5500);
}
function errorText(error) {
  if (/not yet supported|QOREX_NOT_SUPPORTED_YET/.test(error.message || '')) return 'This QoreX release cannot perform this method yet. Native QOR funding is supported. For EVM deployment or contract approvals, use the CLI instructions in Getting started.';
  return error.shortMessage || error.message || 'The action failed. Please try again.';
}
async function run(fn) {
  if (S.busy) return;
  S.busy = true;
  document.querySelectorAll('button').forEach(b => { b.disabled = true; });
  $('#app').setAttribute('aria-busy', 'true');
  try { await fn(); }
  catch (err) { const msg = errorText(err); if ($('#modal').open) $('#modal-error').textContent = msg; else toast(msg, true); }
  finally { S.busy = false; $('#app').removeAttribute('aria-busy'); render(); document.querySelectorAll('#modal button').forEach(b => { b.disabled = false; }); }
}
async function refresh() {
  try { S.network = await api('/network'); S.networkError = ''; } catch (err) { S.network = null; S.networkError = err.message; }
  const saved = await api('/deployment');
  S.chainEvents = saved?.events || [];
  if (saved?.deployment && (!S.metadata?.address || ['0xa3a1e281c4cf7fd73b922a074f9e59e666503b10','0xc2cd7ac4fac9f921749e9428200adb5ef5feeb1a'].includes(S.metadata.address.toLowerCase()))) {
    S.metadata = saved.deployment;
    S.mode = 'testnet';
    save('jaydaad.mode', S.mode);
    save('jaydaad.vault', S.metadata);
  }
  if (S.metadata?.address) S.vault = { ...S.metadata, ...await api('/vault/' + S.metadata.address) };
  else S.vault = null;
  if (S.wallet) {
    try { S.wallet = { ...S.wallet, ...await walletState() }; } catch (err) { S.wallet = null; toast(err.message, true); }
  }
}
function record(result, title, detail) {
  S.liveEvents.unshift({ title, detail, time: new Date().toISOString(), hash: result.txHash, height: result.height,
    verified: result.verified, shield: result.shield, mode: 'testnet' });
  S.liveEvents = S.liveEvents.slice(0, 100); save('jaydaad.transactions', S.liveEvents);
  if (result.shield === 'downgraded') toast('Transaction included without a detected hybrid extension. Review the receipt before proceeding.', true);
  else toast(result.verified ? `${title}. Confirmed in block ${number(result.height)}.` : 'Broadcast submitted. Inclusion is pending; check the transaction receipt before retrying.');
}
function creationDialog() {

  modal(('Make room for your legacy'), ('A single beneficiary. An independent witness. Your own rhythm.'),
    `<form id="create-form" class="stack-form"><label>Vault name<input name="name" value="My family vault" maxlength="80" required></label><div class="form-grid"><label>Beneficiary name<input name="heirName" placeholder="e.g. My sister" maxlength="80" required></label><label>Witness label<input name="witnessName" placeholder="e.g. Family adviser" maxlength="80" required></label></div>${('<label>Beneficiary EVM address<input name="heir" placeholder="0x…" pattern="0x[a-fA-F0-9]{40}" required></label><label>Witness EVM address<input name="witness" placeholder="0x…" pattern="0x[a-fA-F0-9]{40}" required></label>')}<div class="form-grid"><label>Check in every<select name="interval">${(([[86400, '1 day'], [604800, '7 days'], [2592000, '30 days'], [3600, '1 hour (test)']])).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label><label>Grace period<select name="grace">${(([[86400, '1 day'], [604800, '7 days'], [1800, '30 minutes (test)']])).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label></div><div class="inline-note">${icon('info')}${('Deploying needs possession-proven PQ keys for all three participants and an unscoped deployment window. Current QoreX EVM sends are not yet available; the CLI is the supported deployment path today.')}</div><button class="btn primary full" type="submit">${('Request deployment in QoreX')}${icon('arrow')}</button></form>${('<div class="modal-bottom">Already deployed? <button class="text-link" data-action="attach">Attach your vault</button> · <button class="text-link" data-action="deployment-help">CLI instructions</button></div>')}`);
}
function nameDialog(field) {
  const v = S.vault;
  const label = field === 'name' ? 'Vault name' : 'Beneficiary name';
  const title = field === 'name' ? 'Rename vault' : v.heirName ? 'Edit beneficiary name' : 'Add beneficiary name';
  modal(title, ('This display name is saved in this browser.'),
    `<form id="name-form" class="stack-form" data-mode="${escape(S.mode)}" data-estate="${escape(v.estate)}">
      <label>${label}<input name="${field}" value="${escape(v[field])}" maxlength="80" required autofocus></label>
      ${field === 'heirName' ? `<p class="small-copy address-wrap">Beneficiary address<br>${escape(v.heir)}</p>` : ''}
      <div class="button-row"><button class="btn primary" type="submit">Save name</button>${button('Cancel', 'close-modal', 'secondary')}</div></form>`);
}
function attachDialog() { modal('Bring your vault into view', 'Attach a deployed Jaydaad contract on Diana, chain 9800.', `<form id="attach-form" class="stack-form"><label>Contract EVM address<input name="address" pattern="0x[a-fA-F0-9]{40}" placeholder="0x…" required></label><label>Vault name<input name="name" value="My family vault" maxlength="80" required></label><label>Beneficiary name<input name="heirName" placeholder="e.g. My sister" maxlength="80"></label><label>Witness label<input name="witnessName" placeholder="e.g. Family adviser" maxlength="80"></label><div class="inline-note">${icon('shield')}Jaydaad checks the deployed bytecode, reads the roles and timers, and verifies all three pinned registry keys. Labels stay on this device.</div><button class="btn primary full">Verify & attach vault</button></form>`); }
function fundDialog() {
  if (!S.vault || S.vault.phase !== 'Active') throw Error('Activate your vault with a witnessed check-in before adding funds.');
  modal('A little more for their future', ('Send native testnet QOR from QoreX to your verified Diana vault.'), `<form id="fund-form" class="stack-form"><label>Amount (${('test QOR')})<div class="amount-input"><input name="amount" type="number" min="0.000001" max="${('99999999')}" step="0.000001" value="1" required><span>${('QOR')}</span></div></label>${(`<p class="small-copy">Wallet balance: ${number(S.wallet?.balance)} test QOR. Leave some for fees.</p><label>Receiving vault<input readonly value="${escape(toNative(S.vault.estate))}"></label>`)}<div class="inline-note">${icon('info')}${('QoreX will show the exact native transfer and network fee before signing. A bank send bypasses Solidity fund(); the actual on-chain QOR balance still backs the inheritance claim.')}</div><button class="btn primary full">${('Review transfer in QoreX')}${icon('wallet')}</button></form>`);
}
function proofDialog(action) {
  if (!S.vault) throw Error('Create or attach a vault first.');
  const label = ['Check in', 'Cancel & return funds', 'Claim inheritance'][action];
  modal(label, 'Supply fresh participant and independent witness approvals.', `<form id="proof-form" class="stack-form"><input type="hidden" name="action" value="${action}"><p class="body-copy">Generate the approval package with the CLI. It binds the vault, action, signer, nonce, chain, and expiry. The browser verifies both PQ signatures before requesting an EVM transaction.</p><label>Approval package JSON<textarea name="packet" rows="7" placeholder='{"chainId":9800,"estate":"0x…","action":${action},…}' required maxlength="100000"></textarea></label><div class="inline-note">${icon('info')}Current QoreX builds cannot send EVM transactions or sign this application payload. The CLI can execute the package with your independently managed participant and witness keys. Never paste secret keys here.</div><button class="btn primary full">Verify approvals & request QoreX</button></form><button class="text-link" data-action="deployment-help">View CLI instructions ${icon('arrow')}</button>`);
}
function deploymentHelp() { modal('The supported contract path', 'QoreX native payments work today. Contract execution needs the CLI until QoreX ships EVM sends.', `<div class="help-content"><p>Use three fresh Diana accounts, each with a registered, possession-proven ML-DSA-87 key. Keep all key files outside the public repository.</p><pre>npm run diana:check
npm run deploy:diana -- --config .local/diana.json
npm run estate -- --config ${S.vault?.estate?.toLowerCase() === '0xf98a128cc7764836c8e8c6c3efbe5283ccea630d' ? '.local/qday-2026/diana.json' : '.local/diana.json'} \
  --vault ${escape(S.vault?.estate || '0xF98A128cc7764836c8E8c6c3EFBE5283cCea630D')} --action checkin
</pre><p>The CLI registers independent PQ keys only when requested, opens a tightly bounded deployment window, deploys, closes it, and uses vault-scoped windows for later actions. It writes public receipts to <code>deployments/</code>.</p><p>Read <code>docs/TESTNET.md</code> for the exact private configuration format and enrollment steps. Then attach the deployed address and use QoreX to add real test QOR.</p><div class="button-row">${button('Attach a deployed vault', 'attach', 'primary')}${link('QoreX documentation', 'https://docs.qorechain.io/developer-tools/qorex-integrations', 'text-link')}</div></div>`); }
const actions = {
  menu: () => { setIndexOpen(!S.drawer); },
  'close-modal': closeModal, create: creationDialog, attach: attachDialog,
  'rename-vault': () => nameDialog('name'), 'name-beneficiary': () => nameDialog('heirName'),
  'deployment-help': deploymentHelp, fund: fundDialog, checkin: () => proofDialog(0), cancel: () => proofDialog(1), claim: () => proofDialog(2),
  'view-vault': () => { location.hash = 'vault'; },
  connect: () => run(async () => {
    try { S.wallet = await connectQorex(); closeModal(); toast('QoreX connected to Diana. Your keys stay in your wallet.'); }
    catch (err) { if (err.installWallet) modal('A familiar wallet. A safer future.', 'Connect through the official QoreX browser extension.', `<div class="wallet-install"><img class="wallet-install-mark" src="/qorex-icon.png" width="48" height="48" alt=""><h3>QoreX for QoreChain</h3><p>Install QoreX, create a wallet, and choose Diana testnet. Then return to connect Jaydaad.</p>${link('Install QoreX extension', WALLET_URL, 'btn primary full')}${button('I have QoreX · reconnect', 'connect', 'secondary full')}<p class="small-copy">The app never asks for your seed phrase or wallet secret keys.</p></div>`); else throw err; }
  }),
  disconnect: () => { disconnectQorex(); S.wallet = null; closeModal(); render(); toast('Wallet disconnected from this workspace.'); },
  wallet: () => modal('Your QoreX connection', 'Diana testnet · native hybrid signing', `<div class="wallet-balance"><span>Available test QOR</span><strong>${number(S.wallet?.balance)} <small>QOR</small></strong></div><dl class="detail-list"><div><dt>Native account</dt><dd class="address-wrap">${escape(S.wallet?.address)}</dd></div><div><dt>Matching 0x address</dt><dd class="address-wrap">${escape(S.wallet?.evmAddress)}</dd></div><div><dt>PQ registry key</dt><dd>${S.wallet?.key?.proven ? 'Possession proven' : 'Not yet possession-proven'}</dd></div></dl><p class="small-copy">The QoreX EVM account may be derived separately from its native account. Funding uses your native account. A scoped window authorizes that same native address.</p><div class="button-row">${link('Get test QOR', FAUCET_URL, 'btn primary')}${button('Refresh balance', 'refresh-wallet', 'secondary', 'refresh')}${button('Disconnect', 'disconnect', 'secondary')}</div>`),
  'refresh-wallet': () => run(async () => { S.wallet = { ...S.wallet, ...await walletState() }; actions.wallet(); }),
  notifications: () => { location.hash = 'activity'; },
  testnet: () => run(async () => { S.mode = 'testnet'; save('jaydaad.mode', S.mode); S.vault = null; closeModal(); await refresh(); }),
  refresh: () => run(async () => { await refresh(); toast('Workspace refreshed from chain state.'); }),
  'open-window': () => modal('Authorize this vault only', 'QoreX will ask you to approve a bounded EVM session.', `<dl class="detail-list"><div><dt>Allowed target</dt><dd class="address-wrap">${escape(S.vault?.estate)}</dd></div><div><dt>Expiry</dt><dd>100 blocks</dd></div><div><dt>Transaction limit</dt><dd>3</dd></div><div><dt>Value + maximum fees</dt><dd>1 test QOR</dd></div></dl><p class="small-copy">This replaces any open window for your connected native account. Its matching 0x address is ${escape(S.wallet?.evmAddress)}.</p>${button('Review window in QoreX', 'confirm-window', 'primary full', 'wallet')}`),
  'confirm-window': () => run(async () => { const r = await openWindow(S.vault); record(r, 'Scoped window opened', '100 blocks · 3 transactions · 1 QOR cap · this vault only'); closeModal(); await refresh(); }),
  'close-window': () => run(async () => { const r = await closeWindow(); record(r, 'Authorization window closed', 'EVM access withdrawn with a hybrid-signed native transaction.'); await refresh(); }),
  export: () => download('jaydaad-public-record.json', { exportedAt: new Date().toISOString(), mode: S.mode, network: S.network, vault: S.vault, events: events() }),
  clear: () => modal('Clear this browser’s records?', 'This removes labels and receipt history from this device.', `<p class="body-copy">Your on-chain vault and funds stay in place. Save an export first if you need a copy.</p><div class="button-row">${button('Export records', 'export', 'secondary', 'download')}${button('Clear local records', 'confirm-clear', 'danger-outline')}</div>`),
  'confirm-clear': () => { ['jaydaad.transactions', 'jaydaad.vault'].forEach(k => localStorage.removeItem(k)); S.liveEvents = []; S.metadata = null; S.vault = null; closeModal(); render(); toast('Browser records cleared.'); }
};
function download(name, data) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

function setIndexOpen(open) {
  S.drawer = open;
  $('#page-index').hidden = !open;
  $('.index-toggle').setAttribute('aria-expanded', String(open));
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && S.drawer) {
    setIndexOpen(false);
    $('.index-toggle').focus();
  }
});
document.addEventListener('click', event => {
  if (S.drawer && (!event.target.closest('.masthead') || event.target.closest('#page-index a, #page-index button'))) setIndexOpen(false);
  if (event.target.closest('.skip-link')) {
    event.preventDefault();
    $('#main').focus();
    return;
  }
  const plotControl = event.target.closest('[data-plot]');
  if (plotControl) {
    if (plotControl.dataset.plot === 'playback') plotPaused = !plotPaused;
    else {
      plotIndex = Number(plotControl.dataset.plot);
      plotPaused = true;
    }
    updatePlot();
    return;
  }
  const copy = event.target.closest('[data-copy]');
  if (copy) { navigator.clipboard.writeText(copy.dataset.copy).then(() => toast('Address copied.')).catch(() => toast('Clipboard access unavailable.', true)); return; }
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  try { const result = actions[el.dataset.action]?.(); if (result?.catch) result.catch(e => toast(errorText(e), true)); } catch (e) { toast(errorText(e), true); }
});
document.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target, data = Object.fromEntries(new FormData(form));
  run(async () => {
    if (form.id === 'name-form') {
      if (form.dataset.mode !== S.mode || form.dataset.estate !== S.vault?.estate) throw Error('The vault changed. Reopen the name editor.');
      const field = Object.hasOwn(data, 'heirName') ? 'heirName' : 'name';
      const value = data[field].trim();
      if (!value || value.length > 80) throw Error('Enter a name between 1 and 80 characters.');
      {
        const metadata = { ...S.metadata, [field]: value };
        save('jaydaad.vault', metadata);
        S.metadata = metadata;
        S.vault = { ...S.vault, [field]: value };
      }
      closeModal();
      toast(field === 'name' ? 'Vault name saved.' : 'Beneficiary name saved.');
    }
    if (form.id === 'create-form') {
      {
        if (!S.wallet) throw Error('Connect QoreX before requesting deployment.');
        const result = await deployVault({ ...data, interval: Number(data.interval), grace: Number(data.grace) });
        S.metadata = { address: result.address, name: data.name, heirName: data.heirName, witnessName: data.witnessName }; save('jaydaad.vault', S.metadata); await refresh();
      }
      closeModal(); location.hash = 'vault'; toast('Vault created. Complete a witnessed check-in to activate it.');
    }
    if (form.id === 'attach-form') { const vault = await api('/vault/' + data.address); S.metadata = data; save('jaydaad.vault', data); S.mode = 'testnet'; save('jaydaad.mode', S.mode); S.vault = { ...vault, ...data }; closeModal(); location.hash = 'vault'; toast('Diana vault verified and attached.'); }
    if (form.id === 'fund-form') {
      { const r = await fundVault(S.vault, data.amount); record(r, 'Vault funded', `${data.amount} test QOR sent through QoreX native hybrid signing.`); await refresh(); }
      closeModal();
    }
    if (form.id === 'proof-form') { let packet; try { packet = JSON.parse(data.packet); } catch { throw Error('Enter a valid JSON approval package.'); } const result = await executeProof(S.vault, packet, Number(data.action)); record(result, ['Check-in approved', 'Vault cancelled', 'Inheritance claimed'][Number(data.action)], 'Participant and witness ML-DSA approvals verified by the contract.'); closeModal(); await refresh(); }
    if (form.id === 'receipt-form') { const r = await api('/receipt/' + data.hash); const tx = r.tx_response; S.receiptResult = `<div class="inline-note">${icon(Number(tx.code) === 0 ? 'check' : 'info')}<span>${Number(tx.code) === 0 ? 'Included successfully' : 'Transaction failed'} in Diana block ${escape(tx.height)}. ${link('Open receipt', explorerTx(data.hash), 'text-link')}</span></div>`; }
  });
});
window.addEventListener('hashchange', () => { S.route = location.hash.slice(1) || 'overview'; S.drawer = false; render(); window.scrollTo(0, 0); });
window.addEventListener('focus', () => { if (S.wallet && !S.busy) run(refresh); });
$('#modal').addEventListener('click', e => { if (e.target === $('#modal') && !S.busy) closeModal(); });
startCoverMotion();
render();
run(refresh);
