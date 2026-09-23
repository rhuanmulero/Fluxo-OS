import { workspaceApi } from '../api/workspace-api.js';
import { focusTimer } from './focus-timer.js';

const MANUAL_KEY = 'fluxo.presence.manual';

export class PresenceService {
  #current = null;

  get manual() {
    return localStorage.getItem(MANUAL_KEY);
  }

  start(currentStatus) {
    this.#current = currentStatus;
    focusTimer.onStateChange(() => void this.#sync().catch(() => undefined));
  }

  choose(status) {
    if (status === 'AUTO') {
      localStorage.removeItem(MANUAL_KEY);
    } else {
      localStorage.setItem(MANUAL_KEY, status);
    }

    return this.#sync();
  }

  async #sync() {
    const target = this.manual ?? (focusTimer.isFocusing ? 'DEEP_WORK' : 'ONLINE');

    if (target === this.#current) {
      return;
    }

    await workspaceApi.updateProfile({ status: target });
    this.#current = target;
  }
}

export const presence = new PresenceService();
