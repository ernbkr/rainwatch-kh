import type { IControl, Map as MapLibreMap } from 'maplibre-gl';

// Tabler `IconRotate360` path data (v3.44.0, outline). Inlined so the
// control can render with vanilla DOM — IControl instances live outside
// React's render tree.
const HOVER_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 16h4v4" />
  <path d="M19.458 11.042c.86 -2.366 .722 -4.58 -.6 -5.9c-2.272 -2.274 -7.185 -1.045 -10.973 2.743c-3.788 3.788 -5.017 8.701 -2.744 10.974c2.227 2.226 6.987 1.093 10.74 -2.515" />
</svg>
`.trim();

export interface HoverControlOptions {
  onToggle: () => void;
}

/**
 * MapLibre control that renders a single "hover mode" button. Added at
 * `'top-right'` immediately after the NavigationControl so MapLibre's own
 * control stacking places it flush below — no manual offset calculations.
 *
 * Visual styling reuses MapLibre's built-in `.maplibregl-ctrl` classes so
 * the button matches NavigationControl's chrome; the active-state colour
 * comes from `renderer/src/index.css`.
 */
export class HoverControl implements IControl {
  private container: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;

  constructor(private readonly options: HoverControlOptions) {}

  onAdd(_map: MapLibreMap): HTMLElement {
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'maplibregl-ctrl-hover';
    button.setAttribute('aria-label', 'Hover mode');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = HOVER_ICON_SVG;
    button.addEventListener('click', this.handleClick);

    container.appendChild(button);
    this.container = container;
    this.button = button;
    return container;
  }

  onRemove(_map: MapLibreMap): void {
    this.button?.removeEventListener('click', this.handleClick);
    this.container?.remove();
    this.container = null;
    this.button = null;
  }

  /** Reflect external hover state on the button (active class + aria-pressed). */
  setActive(active: boolean): void {
    if (!this.button) return;
    this.button.classList.toggle('maplibregl-ctrl-hover-active', active);
    this.button.setAttribute('aria-pressed', String(active));
    this.button.setAttribute('aria-label', active ? 'Stop hover mode' : 'Hover mode');
  }

  private handleClick = (): void => {
    this.options.onToggle();
  };
}
