// Named for this tool because storage is shared with every other page on medblocks.com.
const STORAGE_KEY = 'fhir-validator-theme';
const THEME_COLORS = { light: '#ffffff', dark: '#1b1918' };

function saveChoice(isDark: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
  } catch {
    // Storage can be blocked by the browser; the choice then lasts only until the page reloads.
  }
}

export function setUpThemeToggle(button: HTMLElement, themeColor: HTMLElement): void {
  const root = document.documentElement;

  function render(isDark: boolean): void {
    const label = `Switch to ${isDark ? 'light' : 'dark'} mode`;
    button.setAttribute('aria-label', label);
    button.dataset.tip = label;
    themeColor.setAttribute('content', isDark ? THEME_COLORS.dark : THEME_COLORS.light);
  }

  button.addEventListener('click', () => {
    const isDark = root.classList.toggle('dark');
    saveChoice(isDark);
    render(isDark);
  });
  render(root.classList.contains('dark'));
  button.hidden = false;
}
