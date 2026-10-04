/**
 * Design tokens, shared by every component.
 *
 * Custom properties inherit *through* shadow boundaries where ordinary styles do
 * not, so a page restyles the whole surface by setting these once — no ::part,
 * no !important.
 *
 * Cascade order is load-bearing: light on bare :host, then the dark media block
 * guarded against an explicit light choice, then explicit dark *after* it so a
 * page forcing dark wins in a light OS.
 */
const LIGHT = `
    --mcs-fg: #1a1a1a;
    --mcs-muted: #646464;
    --mcs-bg: #ffffff;
    --mcs-surface: #f6f7f9;
    --mcs-user-bg: #e8f0fe;
    --mcs-assistant-bg: #f3f4f6;
    --mcs-border: #e2e4e8;
    --mcs-accent: #1565c0;
    --mcs-accent-fg: #ffffff;
    --mcs-danger: #a4161a;
    --mcs-radius: 12px;
    --mcs-font: system-ui, -apple-system, sans-serif;
    --mcs-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
`;

const DARK = `
    --mcs-fg: #e8eaed;
    --mcs-muted: #a6acb3;
    --mcs-bg: #1f2125;
    --mcs-surface: #282b30;
    --mcs-user-bg: #1e3a5f;
    --mcs-assistant-bg: #2b2f36;
    --mcs-border: #3c4046;
    --mcs-accent: #5b9bf8;
    --mcs-accent-fg: #0b1220;
    --mcs-danger: #ff9d97;
`;

export const THEME_CSS = `
  :host {
    color-scheme: light dark;
${LIGHT}  }
  @media (prefers-color-scheme: dark) {
    :host(:not([theme="light"])) {
${DARK}    }
  }
  :host([theme="dark"]) {
${DARK}  }
  :host([theme="light"]) {
    color-scheme: light;
${LIGHT}  }
`;

/**
 * Controls do not inherit colour, so every one needs it set explicitly or the
 * UA supplies a per-theme default — which is how you end up with white text on
 * a white button.
 */
export const CONTROL_CSS = `
  button, input, textarea, select {
    font: inherit;
    color: var(--mcs-fg);
    background: var(--mcs-bg);
    border: 1px solid var(--mcs-border);
    border-radius: 8px;
  }
`;
