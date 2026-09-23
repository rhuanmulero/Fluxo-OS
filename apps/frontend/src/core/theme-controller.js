const TYPE_KEY = 'fluxo.theme.type';
const VALUE_KEY = 'fluxo.theme.value';
const LIGHT_VALUE = '#F8F9FA';

export class ThemeController {
  #background = null;
  #lightQuery = window.matchMedia('(prefers-color-scheme: light)');

  get type() {
    return localStorage.getItem(TYPE_KEY) ?? 'color';
  }

  get value() {
    return localStorage.getItem(VALUE_KEY) ?? '#000000';
  }

  attach(backgroundElement) {
    this.#background = backgroundElement;
    this.apply(this.type, this.value);

    this.#lightQuery.addEventListener('change', (event) => {
      if (this.type === 'image') {
        this.#toggleLight(event.matches);
      }
    });
  }

  apply(type, value) {
    if (!this.#background) {
      return;
    }

    this.#background.className = 'dynamic-bg';
    document.body.classList.remove('light-theme', 'aurora-theme');

    if (type === 'css' && value === 'aurora') {
      this.#background.style.background = '';
      this.#background.classList.add('bg-aurora');
      document.body.classList.add('aurora-theme');
    } else if (type === 'image') {
      this.#background.style.background = `${value} no-repeat center center / cover`;
      this.#toggleLight(this.#lightQuery.matches);
    } else {
      this.#background.style.background = value;
      this.#toggleLight(value === LIGHT_VALUE);
    }

    localStorage.setItem(TYPE_KEY, type);
    localStorage.setItem(VALUE_KEY, value);
  }

  #toggleLight(enabled) {
    document.body.classList.toggle('light-theme', enabled);
  }
}

export const theme = new ThemeController();
