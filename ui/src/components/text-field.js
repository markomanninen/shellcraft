import React, { useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme, glyphs } from '../theme.js';

const h = React.createElement;

// Control characters (C0, DEL, C1) never become part of a value.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

const chars = (s) => Array.from(s ?? '');

/**
 * Label column (11 cells) + value (30 cells, underlined). Focus turns the
 * label and underline accent; while editing the field shows the cursor `█`
 * and takes keys. An error turns label and underline red and adds one line
 * under the value: `✗ message`, indented to the value column.
 *
 * editing defaults to focused. A form that has a "move between fields"
 * mode passes focused with editing={false} for the highlighted field.
 *
 * Keys while editing (only when onChange is given): printable text is
 * appended, backspace/delete removes the last character, ⏎ calls
 * onSubmit(value), esc calls onCancel().
 */
export function TextField({
  label,
  value = '',
  focused = false,
  editing = focused,
  error,
  placeholder = '',
  onChange,
  onSubmit,
  onCancel,
  labelWidth = 11,
  valueWidth = 30
}) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const change = (next) => {
    valueRef.current = next;
    onChange(next);
  };

  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit?.(valueRef.current);
        return;
      }
      if (key.escape) {
        onCancel?.();
        return;
      }
      if (key.backspace || key.delete) {
        const c = chars(valueRef.current);
        if (c.length > 0) change(c.slice(0, -1).join(''));
        return;
      }
      if (key.ctrl || key.meta || key.tab || key.upArrow || key.downArrow ||
          key.leftArrow || key.rightArrow || key.pageUp || key.pageDown ||
          key.home || key.end) {
        return;
      }
      const text = String(input ?? '').replace(CONTROL, '');
      if (text) change(valueRef.current + text);
    },
    { isActive: Boolean(editing && focused && onChange) }
  );

  const hasError = Boolean(error);
  const showCursor = Boolean(focused && editing);
  const labelColor = hasError ? theme.text.danger : focused ? theme.text.accent : theme.text.muted;
  const lineColor = hasError ? theme.border.danger : focused ? theme.border.focus : theme.border.default;

  // Value cells: text, optional cursor, then underlined spaces up to the width.
  const room = Math.max(valueWidth - (showCursor ? 1 : 0), 0);
  const valueChars = chars(value);
  let shown;
  let shownColor = theme.text.default;
  if (valueChars.length === 0) {
    shown = showCursor ? '' : chars(placeholder).slice(0, room).join('');
    shownColor = theme.text.muted;
  } else if (valueChars.length <= room) {
    shown = value;
  } else if (showCursor) {
    // Editing: keep the end of the value (where the cursor is) in view.
    shown = '…' + valueChars.slice(valueChars.length - room + 1).join('');
  } else {
    shown = valueChars.slice(0, room - 1).join('') + '…';
  }
  const fill = Math.max(valueWidth - chars(shown).length - (showCursor ? 1 : 0), 0);

  return h(
    Box,
    { flexDirection: 'column', flexShrink: 0 },
    h(
      Box,
      { height: 1 },
      h(
        Box,
        { width: labelWidth, flexShrink: 0, overflow: 'hidden' },
        h(Text, { color: labelColor, bold: focused || hasError, wrap: 'truncate-end' }, label)
      ),
      h(
        Box,
        { width: valueWidth, flexShrink: 0, overflow: 'hidden' },
        h(
          Text,
          { wrap: 'truncate-end' },
          shown ? h(Text, { color: shownColor, underline: true }, shown) : null,
          showCursor ? h(Text, { color: theme.text.accent }, glyphs.cursor) : null,
          fill > 0 ? h(Text, { color: lineColor, underline: true }, ' '.repeat(fill)) : null
        )
      )
    ),
    hasError
      ? h(
          Box,
          { height: 1, paddingLeft: labelWidth },
          h(Text, { color: theme.text.danger, wrap: 'truncate-end' }, `${glyphs.error} ${error}`)
        )
      : null
  );
}
