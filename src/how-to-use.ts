// Marks the section being read in "On this page". The links themselves work without this script.
const READING_LINE_PX = 48;
const JUMP_TOLERANCE_PX = 4;

const entries = [...document.querySelectorAll<HTMLAnchorElement>('.toc a')].flatMap((link) => {
  const section = document.getElementById(link.hash.slice(1));
  return section ? [{ link, section }] : [];
});

// A short section near the end can't scroll up to the reading line, so a clicked link stays
// marked until the reader scrolls away from where the jump landed.
let jumpedToY: number | null = null;

function mark(section: HTMLElement | undefined): void {
  for (const entry of entries) {
    if (entry.section === section) entry.link.setAttribute('aria-current', 'location');
    else entry.link.removeAttribute('aria-current');
  }
}

function sectionInView(): HTMLElement | undefined {
  const root = document.documentElement;
  if (window.scrollY > 0 && window.scrollY + window.innerHeight >= root.scrollHeight - 1) {
    return entries.at(-1)?.section;
  }
  const passed = entries.filter((e) => e.section.getBoundingClientRect().top <= READING_LINE_PX);
  return (passed.at(-1) ?? entries[0])?.section;
}

function markFromHash(): void {
  const section = entries.find((e) => e.link.hash === window.location.hash)?.section;
  if (!section) return;
  jumpedToY = window.scrollY;
  mark(section);
}

window.addEventListener('hashchange', markFromHash);
// The browser jumps to a link's section during page load, after this script first runs.
window.addEventListener('load', markFromHash);
window.addEventListener(
  'scroll',
  () => {
    if (jumpedToY !== null && Math.abs(window.scrollY - jumpedToY) <= JUMP_TOLERANCE_PX) return;
    jumpedToY = null;
    mark(sectionInView());
  },
  { passive: true },
);

mark(sectionInView());
