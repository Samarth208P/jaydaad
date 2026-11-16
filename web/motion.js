import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const motionAllowed = '(prefers-reduced-motion: no-preference)';

export function refreshScrollPositions() {
  ScrollTrigger.refresh();
}

export function startCoverMotion() {
  const cover = document.querySelector('.cover-pattern');
  const pitch = 40;
  const period = 224;
  const phases = [36, 116, 180, 60, 148, 20];
  const tileWidth = phases.length * pitch;
  const lanes = phases.map((y, index) => ({
    x: (index + 0.5) * pitch + 0.5, // A 1px rail lands on a full pixel at 1×.
    y, upward: index % 2 === 1
  }));
  const rails = lanes.map(({ x }) => `<path d="M${x} 0v${period}"/>`).join('');
  const tile = (id, artwork) => `<svg class="cover-layer" focusable="false">
    <defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${tileWidth}" height="${period}">${artwork}</pattern></defs>
    <rect width="100%" height="100%" fill="url(#${id})"/>
  </svg>`;
  const atomTile = upward => tile(upward ? 'atoms-up' : 'atoms-down',
    lanes.filter(lane => lane.upward === upward).map(({ x, y }) => `
      <g transform="translate(${x} ${y})">
        <circle r="5" fill="var(--cover)" stroke="#94b59c"/>
        <circle r="1.5" fill="#dfedc8"/>
      </g>`).join(''));
  cover.style.setProperty('--cover-period', period + 'px');
  cover.innerHTML = tile('cover-rails', `<g stroke="#578367" stroke-dasharray="1 3">${rails}</g>`)
    + atomTile(false) + atomTile(true);
  const [, down, up] = cover.children;
  gsap.matchMedia().add(motionAllowed, () => {
    // Both layers start one tile above the cover. Their endpoints are identical tiles.
    const drift = gsap.timeline({ repeat: -1, defaults: { duration: 32, ease: 'none' } })
      .fromTo(down, { y: 0 }, { y: period }, 0)
      .fromTo(up, { y: period }, { y: 0 }, 0);
    const syncVisibility = () => drift.paused(document.hidden);
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  });
  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

export function mountPageMotion(root) {
  const media = gsap.matchMedia();
  media.add(motionAllowed, () => {
    const hero = root.querySelector('.hero');
    if (hero) {
      const cover = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: hero, start: 'top 35%', end: 'bottom top', scrub: true }
      });
      cover.to('.hero-title h1', { y: -18 }, 0);
    }

    // Keep native scroll and focus available while each printed row settles into place.
    for (const row of root.querySelectorAll('.stat-card, .timeline li, .guide-step')) {
      gsap.from(row.children, {
        y: 16, stagger: 0.08, ease: 'power2.out',
        scrollTrigger: { trigger: row, start: 'clamp(top bottom)', end: 'clamp(top 68%)', scrub: true }
      });
    }
  }, root);
  return media;
}

export function mountMapMotion(column) {
  const trace = column?.querySelector('.approval-trace');
  if (!trace) return;
  const media = gsap.matchMedia();
  media.add(motionAllowed, () => {
    gsap.from(trace, {
      strokeDashoffset: 1, ease: 'none',
      scrollTrigger: { trigger: trace.closest('svg'), start: 'clamp(top 95%)', end: 'clamp(center 55%)', scrub: true }
    });
  });
  return media;
}
