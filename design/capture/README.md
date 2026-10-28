# Screen capture for design work

Captures every reachable screen of the four demo apps as terminal cells (text, colors,
bold) and builds one HTML board of them. The board is imported into Figma as editable
text layers, one per terminal row, for design reviews.

Figma file: [Shellcraft – terminal UI](https://www.figma.com/design/oykSSRdp0xDbaot7ZkLFQc),
page *01 As-is (blessed)*.

```bash
./design/capture/capture-all.sh      # ~1 min; writes design/capture/out/board.html
```

- `capture.mjs` runs an app's real router and UI code against a fake SSH stream (no
  network, no SSH server) and reads blessed's own cell buffer after each scripted key
  sequence. The scenarios per app are in `SCENARIOS`.
- Admin-dashboard data (hostname, processes, services, addresses, home directory) is
  replaced with invented demo data, so the board shows nothing of the machine it ran on.
  The adventure game's LLM call is replaced with a fixed reply; no Ollama is needed.
- `board.mjs` renders the captures with the VS Code Dark+ terminal palette, lists the
  color pairs in use, and adds the issues from `issues.json`.
- Importing into Figma: the Figma MCP tool `html_to_figma` with `cssSelector: .board`,
  then POST `out/board.html` to the URL it returns. Each `.board` becomes a frame.

The capture hooks `blessed.screen`. After the move to Ink it needs a different hook (Ink
renders to a stream as well; `ink-testing-library` reads the last frame).
