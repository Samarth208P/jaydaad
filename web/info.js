// Explicit disclosures keep supporting copy available without burying actions.
// Native popovers provide Escape/outside-click dismissal and focus restoration.
let sequence = 0;
function disclosure(elements, title, { summary, host } = {}) {
  const items = Array.from(elements).filter(el => el && !el.closest('.info-popover') && !el.dataset.disclosed);
  if (!items.length) return;
  const id = `context-info-${++sequence}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'info-button';
  button.setAttribute('popovertarget', id);
  button.setAttribute('aria-label', `About ${title}`);
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></svg>';
  const popover = document.createElement('div');
  popover.id = id;
  popover.className = 'info-popover';
  popover.setAttribute('popover', 'auto');
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-labelledby', id + '-title');
  const header = document.createElement('div');
  header.className = 'info-popover-header';
  const heading = document.createElement('h3');
  heading.id = id + '-title';
  heading.textContent = title.charAt(0).toUpperCase() + title.slice(1);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'info-close';
  close.setAttribute('popovertarget', id);
  close.setAttribute('popovertargetaction', 'hide');
  close.setAttribute('aria-label', 'Close information');
  close.setAttribute('autofocus', '');
  close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  header.append(heading, close);
  const body = document.createElement('div');
  body.className = 'info-popover-body';
  for (const el of items) {
    el.dataset.disclosed = 'true';
    const paragraph = document.createElement('p');
    // Preserve links/code and escaped dynamic values, never reparse text as HTML.
    paragraph.append(...el.childNodes);
    paragraph.querySelector(':scope > svg:first-child')?.remove();
    body.append(paragraph);
  }
  popover.append(header, body);
  const help = document.createElement('span');
  help.className = 'context-help';
  if (summary) {
    const label = document.createElement('span');
    label.textContent = summary;
    help.append(label);
  }
  help.append(button);
  // Keep popover headings outside the invoker's heading/label/table cell.
  // This also prevents surrounding section styles leaking into the disclosure.
  const container = items[0].closest('dialog')?.querySelector('#modal-content') || document.querySelector('#app');
  container.append(popover);
  if (host) {
    host.classList.add('has-context-info');
    host.append(help);
    items.forEach(el => el.remove());
  } else {
    items[0].replaceWith(help);
    items.slice(1).forEach(el => el.remove());
  }
}
const one = (root, selector, title, options) => disclosure(root.querySelectorAll(selector), title, options);

export function compactInformation(root, { phase } = {}) {
  // The overview keeps its headline and a one-line introduction.
  one(root, '.hero-intro > p', 'how inheritance works', { summary: 'Set aside test QOR for someone you choose.' });
  root.querySelectorAll('.vault-footnote').forEach(el => disclosure([el], 'vault rules', { summary: 'Testnet vault' }));
  const timelineIntro = root.querySelector('.timeline-intro');
  if (timelineIntro) one(timelineIntro, ':scope > p', 'the inheritance timeline', { host: timelineIntro.querySelector('h2') });
  root.querySelectorAll('.timeline li').forEach(el => one(el, ':scope > p', el.querySelector('h3')?.textContent.trim() || 'this stage', { host: el.querySelector('h3') }));
  root.querySelectorAll('.checkin-panel').forEach(panel => {
    const hint = panel.querySelector(':scope > p');
    if (!hint) return;
    panel.querySelector('.panel-header > svg')?.remove();
    const text = hint.textContent;
    disclosure([hint], 'check-ins', { host: panel.querySelector('.panel-header h2') });
    // The actionable state stays visible. Grace always keeps the exact deadline.
    if (phase && phase !== 'Active') {
      const status = document.createElement('p');
      status.className = 'checkin-state-hint';
      status.textContent = phase === 'Grace' ? text : phase === 'Enrollment' ? 'First check-in required before funding.' : phase === 'Claimable' ? 'Beneficiary and witness approval required.' : 'Create a new plan to begin again.';
      panel.querySelector(':scope > h3')?.after(status);
    }
  });
  root.querySelectorAll('.event-cell').forEach(cell => one(cell, 'p', 'this transaction', { host: cell.querySelector('strong') }));
  root.querySelectorAll('.drill-check').forEach(row => one(row, 'p', 'this security check', { host: row.querySelector('strong') }));

  // Group each panel's supporting copy into one contextual button.
  root.querySelectorAll('section.panel').forEach(panel => {
    const heading = panel.querySelector(':scope > .panel-header h2');
    if (!heading) return;
    const title = heading.textContent.trim();
    if (title === 'The details that make this yours') {
      one(panel, ':scope > .inline-note', 'fixed vault settings', { summary: 'Roles and timers are fixed after deployment.' });
    } else if (title === 'Your beneficiary') {
      one(panel, ':scope > .inline-note', 'beneficiary claims', { host: heading });
    } else if (title === 'Your independent witness') {
      disclosure(panel.querySelectorAll(':scope > .body-copy, :scope > .inline-note'), 'witness responsibilities', { host: heading });
      const note = document.createElement('p');
      note.className = 'compact-caption';
      note.textContent = 'Their key and cooperation are required.';
      panel.append(note);
    } else if (title === 'Enrolled keys') {
      one(panel, ':scope > .body-copy', 'registered keys', { host: heading });
    } else if (title === 'QoreX authorization window') {
      disclosure(panel.querySelectorAll(':scope > .body-copy, :scope > .small-copy'), 'authorization windows', { host: heading });
    } else if (title === 'Wallet & local data') {
      one(panel, ':scope > .body-copy', 'browser storage', { summary: 'Labels and wallet receipts stay on this device.' });
    } else if (title.includes('receipts')) {
      one(panel, ':scope > .table-note', 'activity records', { host: heading });
    }
  });
  one(root, '.security-intro p', 'post-quantum approvals', { summary: 'The participant and witness must both approve.' });
  root.querySelectorAll('.risk-grid > div').forEach(el => one(el, ':scope > p', el.querySelector('h3').textContent, { host: el.querySelector('h3') }));
  const guideSummaries = [
    'Choose Diana testnet in QoreX, then connect.',
    'Get free test QOR from the official faucet.',
    'Choose three distinct, PQ-enrolled accounts.',
    'Activate your vault, then add funds through QoreX.',
    'Check in before your deadline to keep the plan active.'
  ];
  root.querySelectorAll('.guide-step').forEach((step, i) => {
    one(step, ':scope > div > p', step.querySelector('h2').textContent, { summary: guideSummaries[i] });
    one(step, '.inline-note', 'current QoreX support', { summary: 'EVM contract actions currently require the CLI.' });
  });

  // Dialogs keep amounts, recipients, fees, and irreversible effects in view.
  one(root, '#create-form > .inline-note', 'vault enrollment', { summary: 'Deploy via CLI. Roles and timers lock at creation.' });
  one(root, '#attach-form > .inline-note', 'contract verification', { summary: 'Contract and participant keys are verified.' });
  one(root, '#fund-form > .inline-note', 'native QOR funding', { summary: 'Review the recipient and fee in QoreX.' });
  one(root, '#proof-form > .body-copy', 'approval packages', { summary: 'Generate fresh approvals with the CLI.' });
  one(root, '#proof-form > .inline-note', 'wallet compatibility', { summary: 'EVM actions require the CLI. Never paste secret keys.' });
  if (root.querySelector('#modal-title')?.textContent === 'Your QoreX connection') one(root, ':scope > .small-copy', 'native and EVM accounts', { summary: 'Native and EVM accounts may differ.' });
}

function positionPopover(popover) {
  const invoker = document.querySelector(`button[popovertarget="${popover.id}"]`);
  if (!invoker || !popover.matches(':popover-open')) return;
  const rect = invoker.getBoundingClientRect();
  const bounds = popover.getBoundingClientRect();
  const padding = 12;
  const left = Math.max(padding, Math.min(rect.left, innerWidth - bounds.width - padding));
  const top = rect.bottom + 8 + bounds.height <= innerHeight - padding ? rect.bottom + 8 : Math.max(padding, rect.top - bounds.height - 8);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}
document.addEventListener('toggle', event => {
  if (!event.target.matches?.('.info-popover')) return;
  document.querySelector(`button[popovertarget="${event.target.id}"]`)?.setAttribute('aria-expanded', String(event.newState === 'open'));
  if (event.newState === 'open') positionPopover(event.target);
}, true);
document.addEventListener('close', event => {
  if (event.target instanceof HTMLDialogElement) event.target.querySelectorAll('.info-popover:popover-open').forEach(el => el.hidePopover());
}, true);
window.addEventListener('resize', () => document.querySelectorAll('.info-popover:popover-open').forEach(positionPopover));
// Scrolling the page should dismiss, rather than detach, a contextual panel.
document.addEventListener('scroll', event => {
  if (event.target instanceof Element && event.target.closest('.info-popover')) return;
  document.querySelectorAll('.info-popover:popover-open').forEach(el => el.hidePopover());
}, true);
