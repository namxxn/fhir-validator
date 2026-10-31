const MAX_VALUE_SHOWN = 80;
const MAX_ITEMS_SHOWN = 8;

/** A rejected attachment can be megabytes long, and quoting it whole would bury the message. */
export function abbreviate(value: string): string {
  return value.length > MAX_VALUE_SHOWN ? `${value.slice(0, MAX_VALUE_SHOWN)}…` : value;
}

export function summarizeList(items: string[]): string {
  const shown = items.slice(0, MAX_ITEMS_SHOWN).join(', ');
  const remaining = items.length - MAX_ITEMS_SHOWN;
  return remaining > 0 ? `${shown} and ${remaining} more` : shown;
}
