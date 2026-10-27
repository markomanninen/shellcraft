import React from 'react';
import { Box, Text } from 'ink';
import { textProps, borderProps, borderTextProps } from '../theme.js';
import { useScreenSize } from '../size.js';

const h = React.createElement;

/**
 * The top edge with the title drawn into it: `╭─ Title ─────╮`.
 * Ink has no border titles, so the panel's box is drawn with
 * borderTop={false} and this row sits on top of it. The run of `─` is
 * longer than any panel and clipped by its box, so no measuring is needed.
 */
function PanelTop({ title, focused, borderToken }) {
  const { columns } = useScreenSize();
  const edge = borderTextProps(borderToken);
  return h(
    Box,
    { height: 1, flexShrink: 0, width: '100%', overflow: 'hidden' },
    h(Box, { flexShrink: 0 }, h(Text, edge, title ? '╭─ ' : '╭─')),
    title
      ? h(
          Box,
          { flexShrink: 1, overflow: 'hidden' },
          h(
            Text,
            { bold: true, ...textProps(focused ? 'accent' : 'default'), wrap: 'truncate-end' },
            title
          )
        )
      : null,
    title ? h(Box, { flexShrink: 0 }, h(Text, edge, ' ')) : null,
    h(
      Box,
      { flexGrow: 1, flexShrink: 1, flexBasis: 0, height: 1, overflow: 'hidden' },
      h(Text, { ...edge, wrap: 'hard' }, '─'.repeat(Math.max(columns, 1) + 2))
    ),
    h(Box, { flexShrink: 0 }, h(Text, edge, '╮'))
  );
}

/**
 * Round border, dim, or cyan when focused (one focused panel at a time).
 * The title sits in the top border. Content is one cell inside the border
 * (padding, default 1); lists and tables pass padding={0} because their
 * rows carry their own one-cell padding and the selection bar should reach
 * the border.
 *
 * Without width or height the panel takes the space left in its parent's
 * main axis (two such panels split it evenly).
 */
export function Panel({
  title,
  focused = false,
  width,
  height,
  flexGrow,
  flexShrink,
  padding = 1,
  paddingX,
  paddingY,
  children
}) {
  const borderToken = focused ? 'focus' : 'default';
  const px = paddingX ?? padding;
  const py = paddingY ?? padding;
  // A panel without a size takes exactly the space left over, whatever its
  // content is (basis 0); a sized panel keeps its size.
  const flexible = width === undefined && height === undefined;
  return h(
    Box,
    {
      flexDirection: 'column',
      width,
      height,
      flexGrow: flexGrow ?? (flexible ? 1 : 0),
      flexShrink: flexShrink ?? (flexible ? 1 : 0),
      flexBasis: flexible ? 0 : undefined
    },
    h(PanelTop, { title, focused, borderToken }),
    h(
      Box,
      {
        flexDirection: 'column',
        flexGrow: 1,
        flexShrink: 1,
        borderStyle: 'round',
        borderTop: false,
        ...borderProps(borderToken),
        paddingX: px,
        paddingTop: py,
        paddingBottom: py,
        overflow: 'hidden'
      },
      children
    )
  );
}
