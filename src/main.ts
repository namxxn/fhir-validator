import './styles.css';
import { EXAMPLE_RESOURCE } from './ui/example';
import { createEditor } from './ui/editor';
import { createResults } from './ui/results';
import { formatJson, validate } from './validator';

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

function declaredResourceType(text: string): string | undefined {
  const parsed = JSON.parse(text) as { resourceType?: string };
  return parsed.resourceType;
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
    runValidation();
  });
  requireElement('format').addEventListener('click', () => {
    const formatted = formatJson(editor.getText());
    if (formatted !== null) setDocument(formatted);
    runValidation();
  });
  requireElement('clear').addEventListener('click', () => {
    setDocument('');
    resetResults();
    editor.focus();
  });
  requireElement('validate').addEventListener('click', runValidation);

  results.showEmpty();
  requireElement('boot').remove();
  requireElement('tool').hidden = false;
  requireElement('statusbar').hidden = false;
}

start();
