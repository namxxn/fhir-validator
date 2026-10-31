/* global document, localStorage */
try {
  if (localStorage.getItem('fhir-validator-theme') === 'dark') {
    document.documentElement.classList.add('dark');
    document.getElementById('theme-color')?.setAttribute('content', '#1b1918');
  }
} catch {
  // Storage can be blocked by the browser; the page then simply stays in its light default.
}
