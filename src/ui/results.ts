import type { Issue } from '../validator';

const ERROR_ICON =
  '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>';
const WARNING_ICON =
  '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>';
const VALID_ICON = '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>';

interface Results {
  showEmpty: () => void;
  showIssues: (issues: Issue[], resourceType: string | undefined) => void;
  updateLines: (lines: number[]) => void;
  markEdited: () => void;
}

function createIcon(paths: string): SVGSVGElement {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = paths;
  return icon;
}

function createElement(tag: string, className: string, text?: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function summaryText(errors: number, warnings: number, resourceType: string | undefined): string {
  const warningText = countLabel(warnings, 'warning');
  if (errors > 0) {
    const errorText = countLabel(errors, 'error');
    return warnings > 0 ? `${errorText}, ${warningText}` : errorText;
  }
  const validText = `Valid R4 ${resourceType ?? 'resource'}`;
  return warnings > 0 ? `${validText}, ${warningText}` : validText;
}

function createSummary(issues: Issue[], resourceType: string | undefined): HTMLElement {
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  const summary = createElement(
    'div',
    `summary ${errors > 0 ? 'summary-invalid' : 'summary-valid'}`,
  );
  summary.append(
    createIcon(errors > 0 ? ERROR_ICON : VALID_ICON),
    createElement('span', '', summaryText(errors, warnings, resourceType)),
  );
  return summary;
}

function lineLabel(line: number): string {
  return `Line ${line}`;
}

export function createResults(container: HTMLElement, onSelect: (index: number) => void): Results {
  let rows: HTMLButtonElement[] = [];
  let lineLabels: HTMLElement[] = [];

  function select(index: number): void {
    rows.forEach((row, rowIndex) => {
      row.setAttribute('aria-current', String(rowIndex === index));
    });
    onSelect(index);
  }

  function createRow(issue: Issue, index: number): HTMLLIElement {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `issue issue-${issue.severity}`;
    row.addEventListener('click', () => select(index));

    const label = createElement('span', 'issue-line', lineLabel(issue.line));
    const meta = createElement('span', 'issue-meta');
    meta.append(createElement('span', 'issue-severity', issue.severity));
    if (issue.path) meta.append(createElement('span', 'issue-path', issue.path));
    meta.append(label);

    const body = createElement('span', 'issue-body');
    body.append(createElement('span', 'issue-message', issue.message), meta);
    row.append(createIcon(issue.severity === 'error' ? ERROR_ICON : WARNING_ICON), body);

    rows.push(row);
    lineLabels.push(label);
    const item = document.createElement('li');
    item.append(row);
    return item;
  }

  return {
    showEmpty: () => {
      rows = [];
      lineLabels = [];
      const empty = createElement('div', 'results-empty');
      empty.append(
        createElement(
          'p',
          '',
          'Paste a resource into the editor, open a .json file or load the example.',
        ),
        createElement('p', '', 'Then choose Validate.'),
      );
      container.replaceChildren(empty);
    },
    showIssues: (issues, resourceType) => {
      rows = [];
      lineLabels = [];
      const list = createElement('ul', 'issues');
      list.append(...issues.map(createRow));
      container.replaceChildren(createSummary(issues, resourceType), list);
      container.scrollTop = 0;
    },
    updateLines: (lines) => {
      lines.forEach((line, index) => {
        const label = lineLabels[index];
        if (label) label.textContent = lineLabel(line);
      });
    },
    markEdited: () => {
      const summary = container.querySelector('.summary');
      if (summary && !summary.querySelector('.summary-note')) {
        summary.append(createElement('span', 'summary-note', 'Edited, validate again'));
      }
    },
  };
}
