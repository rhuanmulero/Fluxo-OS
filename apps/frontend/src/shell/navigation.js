import { settings } from '../core/settings-store.js';
import { NavigationTooltip } from './navigation-tooltip.js';

const EDGE_KEY = 'fluxo.nav.edge';
const LEFT_KEY = 'fluxo.nav.left';
const TOP_KEY = 'fluxo.nav.top';
const DOCK_THRESHOLD = 80;
const EDGE_PADDING = 10;
const CLICK_MOVEMENT_THRESHOLD = 4;

export class Navigation {
  #routes;
  #onSelect;
  #container = null;
  #element = null;
  #dropZone = null;
  #tooltip = new NavigationTooltip();
  #dragging = false;
  #offsetX = 0;
  #offsetY = 0;
  #pointerStartX = 0;
  #pointerStartY = 0;
  #move = null;
  #release = null;
  #placementListeners = [];

  constructor(routes, onSelect) {
    this.#routes = routes;
    this.#onSelect = onSelect;
  }

  get routes() {
    return this.#routes;
  }

  get element() {
    return this.#element;
  }

  mount(container) {
    this.#container = container;

    this.#dropZone = document.createElement('div');
    this.#dropZone.className = 'dock-drop-zone';
    container.appendChild(this.#dropZone);

    this.#element = document.createElement('nav');
    this.#element.className = 'floating-nav';
    this.#element.innerHTML = this.#template();
    container.appendChild(this.#element);

    this.#tooltip.mount(container);
    this.#bindButtons();
    this.#bindHandle();
    this.applyMode();

    return this.#element;
  }

  append(node) {
    this.#element.appendChild(node);
    this.#bindTooltips(node);
    this.#syncTitles();
  }

  onPlacement(listener) {
    this.#placementListeners.push(listener);
    listener(this.#placement());
  }

  setActive(routeId) {
    for (const button of this.#element.querySelectorAll('[data-route]')) {
      button.classList.toggle('active', button.dataset.route === routeId);
    }
  }

  applyMode() {
    const mode = settings.navigationMode;

    this.#container.dataset.nav = mode;
    this.#container.dataset.navSide = settings.sidebarSide;
    this.#container.dataset.collapsed = String(mode === 'sidebar' && settings.sidebarCollapsed);
    this.#element.dataset.mode = mode;
    this.#syncTitles();

    if (mode === 'sidebar') {
      this.#element.removeAttribute('data-dock');
      this.#element.removeAttribute('style');
      this.#tooltip.hide();
      this.#notifyPlacement();
      return;
    }

    this.#restorePosition();
    this.#notifyPlacement();
  }

  toggleMode() {
    settings.navigationMode = settings.navigationMode === 'sidebar' ? 'floating' : 'sidebar';
    this.applyMode();
  }

  #placement() {
    return {
      mode: settings.navigationMode,
      dock: this.#element.getAttribute('data-dock'),
    };
  }

  #notifyPlacement() {
    const placement = this.#placement();

    for (const listener of this.#placementListeners) {
      listener(placement);
    }
  }

  #template() {
    const items = this.#routes
      .map((route) => (route.dividerBefore ? this.#divider() : '') + this.#button(route))
      .join('');

    return `
      <div class="drag-handle" data-label="Arraste para mover ou duplo clique para fixar">
        <i data-lucide="grip-vertical"></i>
      </div>
      ${items}
    `;
  }

  #divider() {
    return '<div class="nav-divider"></div>';
  }

  #button(route) {
    return `
      <button class="icon-btn" data-route="${route.id}"
              data-label="${route.label}" data-shortcut="${route.shortcut}">
        <i data-lucide="${route.icon}"></i>
        <span class="nav-label">${route.label}</span>
        <kbd class="nav-shortcut">${route.shortcut}</kbd>
      </button>
    `;
  }

  #bindButtons() {
    for (const button of this.#element.querySelectorAll('[data-route]')) {
      button.addEventListener('click', () => this.#onSelect(button.dataset.route));
    }

    this.#bindTooltips(this.#element);
  }

  #bindTooltips(root) {
    const targets = root.querySelectorAll('[data-label]');
    const withRoot = root.matches?.('[data-label]') ? [root, ...targets] : [...targets];

    for (const target of withRoot) {
      target.addEventListener('mouseenter', () => {
        if (settings.navigationMode === 'floating') this.#tooltip.show(target, this.#edge());
      });
      target.addEventListener('mouseleave', () => this.#tooltip.hide());
    }
  }

  #syncTitles() {
    const sidebar = settings.navigationMode === 'sidebar';

    for (const target of this.#element.querySelectorAll('[data-label]')) {
      if (sidebar) {
        const shortcut = target.dataset.shortcut;

        target.title = shortcut ? `${target.dataset.label} (${shortcut})` : target.dataset.label;
      } else {
        target.removeAttribute('title');
      }
    }
  }

  #bindHandle() {
    const handle = this.#element.querySelector('.drag-handle');

    handle.addEventListener('mousedown', (event) => this.#startDrag(event));
    handle.addEventListener('dblclick', () => this.toggleMode());
  }

  #edge() {
    return this.#element.getAttribute('data-dock') ?? 'top';
  }

  #restorePosition() {
    const edge = localStorage.getItem(EDGE_KEY);

    if (edge) {
      this.#element.setAttribute('data-dock', edge);
      this.#element.removeAttribute('style');
      return;
    }

    const left = localStorage.getItem(LEFT_KEY);
    const top = localStorage.getItem(TOP_KEY);

    if (!left || !top || this.#offscreen(left, top)) {
      localStorage.removeItem(LEFT_KEY);
      localStorage.removeItem(TOP_KEY);
      return;
    }

    this.#element.style.position = 'fixed';
    this.#element.style.left = left;
    this.#element.style.top = top;
    this.#element.style.transform = 'none';
  }

  #offscreen(left, top) {
    const x = Number.parseFloat(left);
    const y = Number.parseFloat(top);

    return x < -50 || x > window.innerWidth || y < -50 || y > window.innerHeight;
  }

  #startDrag(event) {
    if (settings.navigationMode === 'sidebar') {
      return;
    }

    this.#pointerStartX = event.clientX;
    this.#pointerStartY = event.clientY;

    const wasDocked = this.#element.hasAttribute('data-dock');
    const rect = this.#element.getBoundingClientRect();

    if (wasDocked) {
      this.#offsetX = 18;
      this.#offsetY = 18;
    } else {
      this.#offsetX = event.clientX - rect.left;
      this.#offsetY = event.clientY - rect.top;
    }

    this.#move = (moveEvent) => this.#onMove(moveEvent);
    this.#release = () => this.#onRelease();

    document.addEventListener('mousemove', this.#move);
    document.addEventListener('mouseup', this.#release);
  }

  #beginDrag() {
    this.#dragging = true;
    this.#tooltip.hide();
    this.#element.classList.add('is-dragging');
    this.#element.removeAttribute('data-dock');
    this.#element.style.position = 'fixed';
    this.#element.style.transform = 'none';
    this.#element.style.left = `${this.#pointerStartX - this.#offsetX}px`;
    this.#element.style.top = `${this.#pointerStartY - this.#offsetY}px`;
  }

  #onMove(event) {
    if (!this.#dragging) {
      const movement = Math.hypot(
        event.clientX - this.#pointerStartX,
        event.clientY - this.#pointerStartY,
      );

      if (movement < CLICK_MOVEMENT_THRESHOLD) {
        return;
      }

      this.#beginDrag();
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const maxX = width - this.#element.offsetWidth - EDGE_PADDING;
    const maxY = height - this.#element.offsetHeight - EDGE_PADDING;

    const x = Math.max(EDGE_PADDING, Math.min(event.clientX - this.#offsetX, maxX));
    const y = Math.max(EDGE_PADDING, Math.min(event.clientY - this.#offsetY, maxY));

    const zone = this.#zoneOf(event, width, height);

    if (zone) {
      this.#dropZone.setAttribute('data-zone', zone);
    } else {
      this.#dropZone.removeAttribute('data-zone');
    }

    this.#element.style.left = `${x}px`;
    this.#element.style.top = `${y}px`;
  }

  #zoneOf(event, width, height) {
    if (event.clientY < DOCK_THRESHOLD) return 'top';
    if (event.clientY > height - DOCK_THRESHOLD) return 'bottom';
    if (event.clientX < DOCK_THRESHOLD) return 'left';
    if (event.clientX > width - DOCK_THRESHOLD) return 'right';

    return null;
  }

  #onRelease() {
    document.removeEventListener('mousemove', this.#move);
    document.removeEventListener('mouseup', this.#release);

    if (!this.#dragging) {
      return;
    }

    this.#dragging = false;
    this.#element.classList.remove('is-dragging');

    const zone = this.#dropZone.getAttribute('data-zone');
    this.#dropZone.removeAttribute('data-zone');

    if (zone) {
      this.#element.setAttribute('data-dock', zone);
      this.#element.style.left = '';
      this.#element.style.top = '';
      localStorage.setItem(EDGE_KEY, zone);
      localStorage.removeItem(LEFT_KEY);
      localStorage.removeItem(TOP_KEY);
      this.#notifyPlacement();
      return;
    }

    localStorage.removeItem(EDGE_KEY);
    localStorage.setItem(LEFT_KEY, this.#element.style.left);
    localStorage.setItem(TOP_KEY, this.#element.style.top);
    this.#notifyPlacement();
  }
}
