import { settings } from '../../core/settings-store.js';

export class PomodoroSection {
  id = 'pomodoro';
  icon = 'timer';
  label = 'Pomodoro';

  render(content) {
    const times = settings.pomodoroTimes;

    content.innerHTML = `
      <h3>Duração dos ciclos</h3>
      <div class="settings-times">
        <label>Foco<input type="number" data-time="focus" min="1" max="120" value="${times.focus}"></label>
        <label>Pausa curta<input type="number" data-time="shortBreak" min="1" max="60" value="${times.shortBreak}"></label>
        <label>Pausa longa<input type="number" data-time="longBreak" min="1" max="60" value="${times.longBreak}"></label>
      </div>
      <p class="settings-hint">O ciclo em andamento não muda; o próximo já usa o valor novo.</p>
    `;

    for (const input of content.querySelectorAll('[data-time]')) {
      input.addEventListener('change', () => {
        settings.pomodoroTimes = { ...settings.pomodoroTimes, [input.dataset.time]: input.value };
      });
    }
  }
}
