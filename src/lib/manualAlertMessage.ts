import { MANUAL_NOTES_DELIMITER } from '../constants/manualSignal';

export type ManualMessageParts = {
  label: string;
  pasteSection: string | null;
  notesSection: string | null;
};

/** Split stored manual `message` into label, optional paste, optional user notes. */
export function splitManualMessage(full: string): ManualMessageParts {
  const lines = full.split(/\r?\n/);
  const first = (lines[0] ?? '').trim();
  if (!first.startsWith('Manual signal')) {
    return { label: full.trim() || 'Manual signal', pasteSection: null, notesSection: null };
  }
  const rest = lines.slice(1).join('\n');
  const trimmed = rest.trim();
  if (!trimmed) return { label: first, pasteSection: null, notesSection: null };

  const idx = rest.indexOf(MANUAL_NOTES_DELIMITER);
  if (idx === -1) {
    return { label: first, pasteSection: trimmed, notesSection: null };
  }
  const before = rest.slice(0, idx).trim();
  const after = rest.slice(idx + MANUAL_NOTES_DELIMITER.length).trim();
  return {
    label: first,
    pasteSection: before || null,
    notesSection: after || null,
  };
}

/** Serialize parts back into the `message` column (same rules as ManualSignalForm). */
export function buildManualStoredMessage(
  label: string,
  pasteSection: string | null,
  notesSection: string | null
): string {
  const headline = label.trim() || 'Manual signal';
  const paste = (pasteSection ?? '').trim();
  const notes = (notesSection ?? '').trim();
  if (!paste && !notes) return headline;
  if (paste && notes) return `${headline}\n\n${paste}${MANUAL_NOTES_DELIMITER}${notes}`;
  if (paste) return `${headline}\n\n${paste}`;
  return `${headline}\n${MANUAL_NOTES_DELIMITER}\n${notes}`;
}
