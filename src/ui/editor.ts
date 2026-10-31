import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { EditorState, Prec, StateEffect, StateField } from '@codemirror/state';
import type { ChangeDesc, Text } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { Issue } from '../validator';

interface EditorHandlers {
  onValidate: () => void;
  onChange: (changes: ChangeDesc) => void;
  onCursor: (line: number, column: number) => void;
  onFile: (file: File) => void;
}

interface Editor {
  getText: () => string;
  setText: (text: string) => void;
  showIssues: (issues: Issue[]) => number[];
  clearIssues: () => void;
  lineAt: (position: number) => number;
  jumpTo: (position: number) => void;
  focus: () => void;
}

const setJumpLine = StateEffect.define<number | null>();
const jumpLineDecoration = Decoration.line({ class: 'cm-jump-line' });

const jumpLine = StateField.define({
  create: () => Decoration.none,
  update(lines, transaction) {
    let next = lines.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setJumpLine)) {
        next =
          effect.value === null
            ? Decoration.none
            : Decoration.set(
                jumpLineDecoration.range(transaction.state.doc.lineAt(effect.value).from),
              );
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'hsl(var(--surface))',
    color: 'hsl(var(--text))',
    fontSize: '14px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '22px' },
  '.cm-content': { padding: '8px 0', caretColor: 'hsl(var(--text))' },
  '.cm-line': { padding: '0' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '42px', padding: '0', textAlign: 'right' },
  '.cm-gutter-lint': { width: '26px' },
  '.cm-gutter-lint .cm-gutterElement': { padding: '0 0 0 6px' },
  '.cm-lint-marker': { marginTop: '4px' },
  '.cm-cursor': { borderLeftColor: 'hsl(var(--text))' },
  '.cm-gutters': {
    backgroundColor: 'hsl(var(--surface))',
    color: 'hsl(var(--text-muted))',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: 'hsl(var(--surface-raised))' },
  '.cm-activeLineGutter': {
    backgroundColor: 'hsl(var(--surface-raised))',
    color: 'hsl(var(--accent))',
  },
  '.cm-jump-line': { backgroundColor: 'hsl(var(--accent-soft))' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'hsl(var(--accent-soft))' },
  '.cm-placeholder': { color: 'hsl(var(--text-muted))' },
  '.cm-tooltip': {
    backgroundColor: 'hsl(var(--surface))',
    border: '1px solid hsl(var(--border))',
    color: 'hsl(var(--text))',
  },
});

const highlighting = HighlightStyle.define([
  { tag: tags.propertyName, color: 'hsl(var(--syn-key))' },
  { tag: tags.string, color: 'hsl(var(--syn-string))' },
  { tag: tags.number, color: 'hsl(var(--syn-number))' },
  { tag: [tags.bool, tags.null], color: 'hsl(var(--syn-keyword))' },
  { tag: [tags.separator, tags.brace, tags.squareBracket], color: 'hsl(var(--syn-separator))' },
]);

function positionOf(doc: Text, issue: Issue): number {
  const line = doc.line(Math.min(issue.line, doc.lines));
  return Math.min(line.from + Math.max(issue.column - 1, 0), line.to);
}

function toDiagnostic(doc: Text, issue: Issue, from: number): Diagnostic {
  const line = doc.lineAt(from);
  const to = line.from + line.text.trimEnd().length;
  return { from, to: Math.max(from, to), severity: issue.severity, message: issue.message };
}

function droppedFile(event: DragEvent): File | undefined {
  return event.dataTransfer?.files[0];
}

export function createEditor(parent: HTMLElement, handlers: EditorHandlers): Editor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      extensions: [
        lineNumbers(),
        lintGutter(),
        history(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        json(),
        syntaxHighlighting(highlighting),
        theme,
        jumpLine,
        placeholder('Paste an R4 resource here'),
        EditorView.contentAttributes.of({ 'aria-label': 'Resource JSON' }),
        Prec.high(
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                handlers.onValidate();
                return true;
              },
            },
          ]),
        ),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.domEventHandlers({
          dragover: (event) => {
            event.preventDefault();
            return true;
          },
          drop: (event) => {
            const file = droppedFile(event);
            if (!file) return false;
            event.preventDefault();
            handlers.onFile(file);
            return true;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) handlers.onChange(update.changes);
          if (update.docChanged || update.selectionSet) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            handlers.onCursor(line.number, head - line.from + 1);
          }
        }),
      ],
    }),
  });

  return {
    getText: () => view.state.doc.toString(),
    setText: (text) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: 0 },
        effects: setJumpLine.of(null),
        scrollIntoView: true,
      });
    },
    showIssues: (issues) => {
      const { doc } = view.state;
      const positions = issues.map((issue) => positionOf(doc, issue));
      const diagnostics = issues.map((issue, index) =>
        toDiagnostic(doc, issue, positions[index] ?? 0),
      );
      view.dispatch(setDiagnostics(view.state, diagnostics), {
        effects: setJumpLine.of(null),
      });
      return positions;
    },
    clearIssues: () => {
      view.dispatch(setDiagnostics(view.state, []), { effects: setJumpLine.of(null) });
    },
    lineAt: (position) => view.state.doc.lineAt(position).number,
    jumpTo: (position) => {
      view.dispatch({
        selection: { anchor: position },
        effects: [setJumpLine.of(position), EditorView.scrollIntoView(position, { y: 'center' })],
      });
      view.focus();
      view.dom.scrollIntoView({ block: 'nearest' });
    },
    focus: () => view.focus(),
  };
}
