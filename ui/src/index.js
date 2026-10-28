// Pins Ink's chalk to the 16 ANSI colors, whatever the server's TTY says.
import './color.js';

export { theme, glyphs, tones, meterTones, textProps, borderProps, borderTextProps, DIM } from './theme.js';
export { useTerminalSize, useScreenSize } from './size.js';
export { Screen, TitleBar, StatusBar, hintsWidth } from './components/screen.js';
export { KeyHint } from './components/key-hint.js';
export { Message, Spinner, toMessageElement } from './components/message.js';
export { Panel } from './components/panel.js';
export { SelectList, ListItem } from './components/select-list.js';
export { Table, TableRow } from './components/table.js';
export { TextField } from './components/text-field.js';
export { Button } from './components/button.js';
export { Meter, meterCells, METER_WIDTH } from './components/meter.js';
export { EmptyState } from './components/empty-state.js';
export { InfoRow, infoRows, BlankRow } from './components/info-row.js';
export { ScrollView, MoreIndicator, wrappedRowCount, layoutLines } from './components/scroll-view.js';
export { maxScrollOffset, scrollLayout } from './selection.js';
export { useInterval, useData } from './hooks.js';
export { wrapText, wrapSegments, textWidth, truncateToWidth } from './text.js';
export { serve, toCrlf } from './ssh.js';
export { renderLocal } from './local.js';
export { colorLevel } from './color.js';

// Re-exported so apps can import everything from one place (SSH
// authentication is separate: '@shellcraft/ui/auth').
export { Box, Text, useApp, useInput, useAnimation } from 'ink';
