const DELAY = 400;
const GAP = 10;

export class NavigationTooltip {
  #element = null;
  #timer = null;

  mount(container) {
    this.#element = document.createElement('div');
    this.#element.className = 'nav-tooltip';
    container.appendChild(this.#element);
  }

  show(target, edge) {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#render(target, edge), DELAY);
  }

  hide() {
    clearTimeout(this.#timer);
    this.#element.classList.remove('visible');
  }

  #render(target, edge) {
    if (!target.isConnected || !target.getClientRects().length || !target.dataset.label) return;
    const shortcut = target.dataset.shortcut;

    const label = document.createElement('span');
    label.textContent = target.dataset.label;
    this.#element.replaceChildren(label);
    if (shortcut) {
      const key = document.createElement('kbd');
      key.textContent = shortcut;
      this.#element.append(key);
    }

    this.#element.classList.add('visible');
    this.#place(target.getBoundingClientRect(), edge);
  }

  #place(anchor, edge) {
    const size = this.#element.getBoundingClientRect();
    const centerX = anchor.left + (anchor.width - size.width) / 2;
    const centerY = anchor.top + (anchor.height - size.height) / 2;

    if (edge === 'right') {
      this.#move(anchor.left - size.width - GAP, centerY);
    } else if (edge === 'bottom') {
      this.#move(centerX, anchor.top - size.height - GAP);
    } else if (edge === 'top') {
      this.#move(centerX, anchor.bottom + GAP);
    } else {
      this.#move(anchor.right + GAP, centerY);
    }
  }

  #move(left, top) {
    this.#element.style.left = `${Math.max(GAP, Math.min(left, window.innerWidth - this.#element.offsetWidth - GAP))}px`;
    this.#element.style.top = `${Math.max(GAP, Math.min(top, window.innerHeight - this.#element.offsetHeight - GAP))}px`;
  }
}
