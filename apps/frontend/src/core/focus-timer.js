import { pomodoroApi } from '../api/pomodoro-api.js';
import { settings } from './settings-store.js';
import { workspaceContext } from './workspace-context.js';

const MODE_NAMES = {
  focus: 'FOCUS',
  shortBreak: 'SHORT_BREAK',
  longBreak: 'LONG_BREAK',
};

export class FocusTimer {
  #intervalId = null;
  #startedAt = null;
  #listeners = new Set();

  isRunning = false;
  mode = 'focus';
  timeLeft = settings.pomodoroTimes.focus * 60;
  secondsElapsed = 0;
  selectedTaskId = '';
  pendingSeconds = { focus: 0, shortBreak: 0, longBreak: 0 };
  sessionStats = { focusCount: 0, focusSeconds: 0, breakCount: 0, breakSeconds: 0 };
  onTick = null;
  onEnd = null;
  onSummary = null;
  onRecordError = null;
  onSessionChange = null;

  get isFocusing() {
    return this.isRunning && this.mode === 'focus';
  }

  onStateChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  start() {
    this.#clear();
    this.isRunning = true;
    this.#startedAt = this.#startedAt ?? new Date();

    if (this.mode === 'focus') {
      this.sessionStats.focusCount += 1;
    } else {
      this.sessionStats.breakCount += 1;
    }

    this.#emitSession();
    this.#notify();

    this.#intervalId = setInterval(() => this.#tick(), 1000);
  }

  clearSession() {
    this.sessionStats = { focusCount: 0, focusSeconds: 0, breakCount: 0, breakSeconds: 0 };
    this.#emitSession();
  }

  stop() {
    this.#clear();
    this.isRunning = false;

    void this.finish();

    this.#notify();
  }

  setMode(mode) {
    this.stop();
    this.mode = mode;
    this.timeLeft = (settings.pomodoroTimes[mode] ?? 25) * 60;
    this.secondsElapsed = 0;
    this.#emitTick();
  }

  reset() {
    this.stop();
    this.pendingSeconds[this.mode] = 0;
    this.timeLeft = (settings.pomodoroTimes[this.mode] ?? 25) * 60;
    this.secondsElapsed = 0;
    this.#emitTick();
  }

  async finish() {
    const startedAt = this.#startedAt;
    this.#startedAt = null;

    if (!startedAt) {
      return;
    }

    const endedAt = new Date();
    const elapsedSeconds = Math.round((endedAt - startedAt) / 1000);

    if (elapsedSeconds <= 0) {
      return;
    }

    const total = this.pendingSeconds[this.mode] + elapsedSeconds;
    const durationMinutes = Math.floor(total / 60);

    if (durationMinutes < 1) {
      this.pendingSeconds[this.mode] = total;
      return;
    }

    const payload = {
      mode: MODE_NAMES[this.mode],
      startedAt: new Date(endedAt.getTime() - durationMinutes * 60_000).toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes,
    };

    if (workspaceContext.projectId) payload.projectId = workspaceContext.projectId;
    if (this.selectedTaskId) payload.taskId = this.selectedTaskId;

    try {
      await pomodoroApi.record(payload);
    } catch (error) {
      this.pendingSeconds[this.mode] = total;
      if (this.onRecordError) this.onRecordError(error);
      return;
    }

    this.pendingSeconds[this.mode] = total % 60;

    if (this.onSummary) this.onSummary(await pomodoroApi.summary());
  }

  #tick() {
    if (this.timeLeft > 0) {
      this.timeLeft -= 1;
      this.secondsElapsed += 1;

      if (this.mode === 'focus') {
        this.sessionStats.focusSeconds += 1;
      } else {
        this.sessionStats.breakSeconds += 1;
      }

      this.#emitTick();
      this.#emitSession();
      return;
    }

    this.stop();
    if (this.onEnd) this.onEnd();
  }

  #emitTick() {
    if (this.onTick) this.onTick(this.timeLeft);
  }

  #emitSession() {
    if (this.onSessionChange) this.onSessionChange(this.sessionStats);
  }

  #clear() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  #notify() {
    for (const listener of this.#listeners) {
      listener(this);
    }
  }
}

export const focusTimer = new FocusTimer();
