import { EXAMPLE_RESOURCE } from './ui/example';
import { createEditor } from './ui/editor';
import { createResults } from './ui/results';
import { setUpThemeToggle } from './ui/theme';
import { declaredResourceType, formatJson, validate } from './validator';

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

/** The tips are drawn by CSS, which screen readers do not reliably announce. */
function describeTips(): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-tip]')) {
    element.setAttribute('aria-description', element.dataset.tip ?? '');
  }
}

function start(): void {
  const cursor = requireElement('cursor');
  const fileInput = requireElement<HTMLInputElement>('file');
  let issuePositions: number[] = [];
  let hasResults = false;

  const results = createResults(requireElement('results'), (index) => {
    const position = issuePositions[index];
    if (position !== undefined) editor.jumpTo(position);
  });

  const editor = createEditor(requireElement('editor'), {
    onValidate: runValidation,
    onChange: (changes) => {
      if (!hasResults) return;
      issuePositions = issuePositions.map((position) => changes.mapPos(position));
      results.updateLines(issuePositions.map(editor.lineAt));
      results.markEdited();
    },
    onCursor: (line, column) => {
      cursor.textContent = `Ln ${line}, Col ${column}`;
    },
    onFile: openFile,
  });

  function resetResults(): void {
    issuePositions = [];
    hasResults = false;
    editor.clearIssues();
    results.showEmpty();
  }

  function setDocument(text: string): void {
    hasResults = false;
    editor.setText(text);
  }

  function runValidation(): void {
    const text = editor.getText();
    if (!text.trim()) {
      resetResults();
      return;
    }
    const issues = validate(text);
    const hasErrors = issues.some((issue) => issue.severity === 'error');
    issuePositions = editor.showIssues(issues);
    hasResults = true;
    results.showIssues(issues, hasErrors ? undefined : declaredResourceType(text));
  }

  function openFile(file: File): void {
    void file.text().then((text) => {
      setDocument(text);
      resetResults();
    });
  }

  requireElement('open').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) openFile(file);
    fileInput.value = '';
  });
  requireElement('example').addEventListener('click', () => {
    setDocument(EXAMPLE_RESOURCE);
    resetResults();
  });
  requireElement('format').addEventListener('click', () => {
    const hadResults = hasResults;
    const formatted = formatJson(editor.getText());
    if (formatted !== null) setDocument(formatted);
    // Reformatting moves every line, so results already on screen have to be refreshed. Broken JSON
    // cannot be formatted, and the syntax error is what explains why nothing happened.
    if (hadResults || formatted === null) runValidation();
  });
  requireElement('clear').addEventListener('click', () => {
    setDocument('');
    resetResults();
    editor.focus();
  });
  requireElement('validate').addEventListener('click', runValidation);

  setUpThemeToggle(requireElement('theme'), requireElement('theme-color'));
  describeTips();
  results.showEmpty();
  requireElement('boot').remove();
  requireElement('tool').hidden = false;
  requireElement('statusbar').hidden = false;
}

start();
