import { api } from '../core/api-client.js';

export class PomodoroApi {
  constructor(client = api) {
    this.client = client;
  }

  record(session) {
    return this.client.post('/pomodoro/sessions', session);
  }

  list(filter = {}) {
    return this.client.get(`/pomodoro/sessions${this.#query(filter)}`);
  }

  summary(filter = {}) {
    return this.client.get(`/pomodoro/summary${this.#query(filter)}`);
  }

  #query(filter) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, value);
      }
    }

    return query.toString() === '' ? '' : `?${query.toString()}`;
  }
}

export const pomodoroApi = new PomodoroApi();
