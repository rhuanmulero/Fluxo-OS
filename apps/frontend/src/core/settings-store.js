const KEYS = {
  clock: 'fluxo.clock.twelveHour',
  weather: 'fluxo.weather.fahrenheit',
  pomodoro: 'fluxo.pomodoro.times',
  navigationMode: 'fluxo.nav.mode',
  sidebarSide: 'fluxo.nav.side',
  sidebarCollapsed: 'fluxo.nav.collapsed',
  notesSort: 'fluxo.notes.sort',
  notesView: 'fluxo.notes.view',
};

const DEFAULT_TIMES = { focus: 25, shortBreak: 5, longBreak: 15 };

export class SettingsStore {
  #listeners = new Set();

  onChange(listener) {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  #write(key, value) {
    localStorage.setItem(key, value);

    for (const listener of this.#listeners) {
      listener(key);
    }
  }

  get clock12h() {
    return localStorage.getItem(KEYS.clock) === 'true';
  }

  set clock12h(enabled) {
    this.#write(KEYS.clock, String(enabled));
  }

  get fahrenheit() {
    return localStorage.getItem(KEYS.weather) === 'true';
  }

  set fahrenheit(enabled) {
    this.#write(KEYS.weather, String(enabled));
  }

  get navigationMode() {
    return localStorage.getItem(KEYS.navigationMode) === 'sidebar' ? 'sidebar' : 'floating';
  }

  set navigationMode(mode) {
    this.#write(KEYS.navigationMode, mode);
  }

  get sidebarSide() {
    return localStorage.getItem(KEYS.sidebarSide) === 'right' ? 'right' : 'left';
  }

  set sidebarSide(side) {
    this.#write(KEYS.sidebarSide, side);
  }

  get sidebarCollapsed() {
    return localStorage.getItem(KEYS.sidebarCollapsed) === 'true';
  }

  set sidebarCollapsed(enabled) {
    this.#write(KEYS.sidebarCollapsed, String(enabled));
  }

  get pomodoroTimes() {
    const raw = localStorage.getItem(KEYS.pomodoro);

    if (raw === null) {
      return { ...DEFAULT_TIMES };
    }

    const saved = JSON.parse(raw);

    return {
      focus: Number.parseInt(saved.focus, 10) || DEFAULT_TIMES.focus,
      shortBreak: Number.parseInt(saved.shortBreak, 10) || DEFAULT_TIMES.shortBreak,
      longBreak: Number.parseInt(saved.longBreak, 10) || DEFAULT_TIMES.longBreak,
    };
  }

  set pomodoroTimes(times) {
    this.#write(KEYS.pomodoro, JSON.stringify(times));
  }

  get notesSort() {
    return localStorage.getItem(KEYS.notesSort) === 'title' ? 'title' : 'recent';
  }

  set notesSort(sort) {
    this.#write(KEYS.notesSort, sort);
  }

  get notesView() {
    return localStorage.getItem(KEYS.notesView) === 'list' ? 'list' : 'grid';
  }

  set notesView(view) {
    this.#write(KEYS.notesView, view);
  }
}

export const settings = new SettingsStore();
