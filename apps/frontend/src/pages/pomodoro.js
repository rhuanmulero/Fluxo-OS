import { createIcons, icons } from 'lucide';
import '../styles/pages/pomodoro.css';
import { pomodoroApi } from '../api/pomodoro-api.js';
import { taskApi } from '../api/task-api.js';
import { workspaceContext } from '../core/workspace-context.js';
import { session } from '../core/session-store.js';
import { workspaceApi } from '../api/workspace-api.js';
import { focusTimer } from '../core/focus-timer.js';
import { settings } from '../core/settings-store.js';
import { regionLoader } from '../components/region-loader.js';
import { Dropdown } from '../components/dropdown.js';
import { FormFields } from '../components/form-field.js';
import { confirmDialog } from '../components/confirm-dialog.js';
import { pageFeedback } from '../core/page-feedback.js';

// MOTOR DE ÁUDIO AMBIENTE (Fontes MP3 Oficiais e Seguras hospedadas no GitHub)
if (!window.FluxoAmbient) {
    window.FluxoAmbient = {
        audioInstance: null, currentTrackId: null, volume: 0.5,
        play(url, trackId, onStateChange) {
            if (this.audioInstance) { this.audioInstance.pause(); }
            if (this.currentTrackId === trackId) { this.currentTrackId = null; onStateChange(null); return; }

            this.audioInstance = new Audio(url);
            this.audioInstance.loop = true;
            this.audioInstance.volume = this.volume;
            this.audioInstance.play().catch(e => console.warn("Audio bloqueado:", e));
            this.currentTrackId = trackId;
            onStateChange(trackId);
        },
        setVolume(val) { this.volume = val; if (this.audioInstance) this.audioInstance.volume = val; }
    };
}

// ==========================================
// 2. COMPONENTE DA TELA
// ==========================================
export default function PomodoroPage() {
    const container = document.createElement('div');
    container.className = 'pomodoro-wrapper';

    const timerEngine = focusTimer;
    const ambientEngine = window.FluxoAmbient;

    const SPOTIFY_PLAYLISTS = {
        lofi: "37i9dQZF1DWWQRwui0ExPn",
        coding: "37i9dQZF1DX5trt9i14X7j",
        synthwave: "37i9dQZF1DXdLEN7aqioJC"
    };

    // MP3s de alta fidelidade e permanentes via GitHub Raw
    const AMBIENT_TRACKS = {
        rain: "https://raw.githubusercontent.com/GundogCodes/Odoro/main/rain.mp3",
        white_noise: "https://raw.githubusercontent.com/GundogCodes/Odoro/main/whitenoise.mp3",
        coffee: "https://raw.githubusercontent.com/GundogCodes/Odoro/main/coffeeshop.mp3",
        fire: "https://raw.githubusercontent.com/johanvts/emacs-fireplace/master/fireplace.mp3"
    };

    let currentSpotify = localStorage.getItem('fluxo_pomo_spotify') || 'lofi';
    let customPlaylists = JSON.parse(localStorage.getItem('fluxo_custom_playlists')) || [];

    if (isNaN(timerEngine.timeLeft)) timerEngine.reset();

    let myTasks = [];
    let summaryData = { focusMinutes: 0, breakMinutes: 0, completedCycles: 0, byTask: {} };
    function formatHours(mins) { return `${Math.floor(mins/60)}h ${mins%60}m`; }

    function formatClock(seconds) {
        const minutes = Math.floor(seconds / 60);

        return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    }

    async function loadRemoteState() {
        const projectId = workspaceContext.projectId;

        await regionLoader.during(container, async () => {
            const [tasks, summary] = await Promise.all([
                projectId
                    ? taskApi.list(projectId, { assigneeId: session.user?.id })
                    : Promise.resolve([]),
                pomodoroApi.summary(),
            ]);

            myTasks = tasks.filter((task) => task.status !== 'DONE');
            summaryData = summary;
            render();
        });
    }

    function render() {
        container.innerHTML = `
            <div class="pomodoro-content">
                <!-- COLUNA ESQUERDA: TIMER -->
                <div class="pomo-center">
                    <div class="pomo-glass-panel" id="timer-panel">
                        <div class="pomo-header">
                            <h1>Deep Work</h1>
                            <p id="stat-summary">${summaryData.completedCycles} ciclos | ${formatHours(summaryData.focusMinutes)} Foco | ${formatHours(summaryData.breakMinutes)} Pausa</p>
                        </div>

                        <div class="pomo-session">
                            <div class="pomo-session-item">
                                <strong id="session-focus-count">${timerEngine.sessionStats.focusCount}</strong>
                                <span>entradas em foco</span>
                            </div>
                            <div class="pomo-session-item">
                                <strong id="session-focus-time">${formatClock(timerEngine.sessionStats.focusSeconds)}</strong>
                                <span>de foco nesta sessão</span>
                            </div>
                            <div class="pomo-session-item">
                                <strong id="session-break-count">${timerEngine.sessionStats.breakCount}</strong>
                                <span>entradas em pausa</span>
                            </div>
                            <div class="pomo-session-item">
                                <strong id="session-break-time">${formatClock(timerEngine.sessionStats.breakSeconds)}</strong>
                                <span>de pausa nesta sessão</span>
                            </div>
                            <button class="btn-pomo-icon" id="btn-clear-session" title="Zerar as contagens desta sessão">
                                <i data-lucide="eraser" style="width:18px;"></i>
                            </button>
                        </div>

                        <div class="pomo-modes">
                            <button class="pomo-mode-btn ${timerEngine.mode === 'focus' ? 'active' : ''}" data-mode="focus">Foco</button>
                            <button class="pomo-mode-btn ${timerEngine.mode === 'shortBreak' ? 'active' : ''}" data-mode="shortBreak">Pausa Curta</button>
                            <button class="pomo-mode-btn ${timerEngine.mode === 'longBreak' ? 'active' : ''}" data-mode="longBreak">Pausa Longa</button>
                        </div>

                        <div class="pomo-ring-wrap">
                            <svg class="pomo-ring" viewBox="0 0 240 240" aria-hidden="true">
                                <circle class="pomo-ring-track" cx="120" cy="120" r="108"></circle>
                                <circle class="pomo-ring-fill" id="ring-fill" cx="120" cy="120" r="108"></circle>
                            </svg>
                            <button type="button" class="pomo-ring-handle" id="ring-handle"
                                    role="slider" aria-label="Duração do ciclo em minutos"
                                    aria-valuemin="1" aria-valuemax="120" aria-valuenow="25"></button>
                            <div class="pomo-timer-display" id="time-display">00:00</div>
                        </div>

                        <div class="pomo-controls">
                            <button class="btn-pomo-main ${timerEngine.isRunning ? 'running' : ''}" id="btn-toggle-timer">
                                ${timerEngine.isRunning ? '<i data-lucide="pause" style="width:22px;"></i> Pausar' : '<i data-lucide="play" style="width:22px;"></i> Iniciar'}
                            </button>
                            <button class="btn-pomo-icon" id="btn-reset-timer" title="Zerar Timer">
                                <i data-lucide="rotate-ccw" style="width:24px;"></i>
                            </button>
                        </div>

                        <div class="pomo-task-box">
                            <label><i data-lucide="link" style="width:14px;"></i> Vincular Tempo à Demanda</label>
                            <div id="task-select"></div>
                        </div>
                    </div>
                </div>

                <!-- COLUNA DIREITA: SETTINGS E MÍDIA -->
                <div class="pomo-side">
                    <!-- Configurações de Tempo -->
                    <div class="pomo-side-panel">
                        <div class="pomo-settings-group">
                            <h3><i data-lucide="clock" style="width:16px;"></i> Customizar Tempos (Min)</h3>
                            <div class="time-inputs">
                                <div class="time-input-box">
                                    <label>Foco</label>
                                    <div class="stepper">
                                        <button class="stepper-btn" data-step="-1" data-target="focus">
                                            <i data-lucide="minus"></i>
                                        </button>
                                        <input type="number" id="input-time-focus" value="${settings.pomodoroTimes.focus}" min="1" max="120">
                                        <button class="stepper-btn" data-step="1" data-target="focus">
                                            <i data-lucide="plus"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="time-input-box">
                                    <label>Pausa Curta</label>
                                    <div class="stepper">
                                        <button class="stepper-btn" data-step="-1" data-target="short">
                                            <i data-lucide="minus"></i>
                                        </button>
                                        <input type="number" id="input-time-short" value="${settings.pomodoroTimes.shortBreak}" min="1" max="60">
                                        <button class="stepper-btn" data-step="1" data-target="short">
                                            <i data-lucide="plus"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="time-input-box">
                                    <label>Pausa Longa</label>
                                    <div class="stepper">
                                        <button class="stepper-btn" data-step="-1" data-target="long">
                                            <i data-lucide="minus"></i>
                                        </button>
                                        <input type="number" id="input-time-long" value="${settings.pomodoroTimes.longBreak}" min="1" max="60">
                                        <button class="stepper-btn" data-step="1" data-target="long">
                                            <i data-lucide="plus"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="pomo-side-panel">
                        <div class="pomo-settings-group">
                            <h3><i data-lucide="bar-chart-3" style="width:16px;"></i> Tempo por demanda</h3>
                            <div class="pomo-task-times">${renderTaskTimes()}</div>
                        </div>
                    </div>

                    <!-- Ambiência em Áudio e Spotify -->
                    <div class="pomo-side-panel" style="flex:1;">

                        <div class="pomo-settings-group">
                            <h3><i data-lucide="headphones" style="width:16px;"></i> Ruído Branco & Ambiência</h3>
                            <div class="ambient-controls">
                                <button class="btn-ambient ${ambientEngine.currentTrackId === 'rain' ? 'active' : ''}" data-track="rain"><i data-lucide="cloud-rain" style="width:14px;"></i> Chuva</button>
                                <button class="btn-ambient ${ambientEngine.currentTrackId === 'white_noise' ? 'active' : ''}" data-track="white_noise"><i data-lucide="radio" style="width:14px;"></i> Estática (TV)</button>
                                <button class="btn-ambient ${ambientEngine.currentTrackId === 'coffee' ? 'active' : ''}" data-track="coffee"><i data-lucide="coffee" style="width:14px;"></i> Cafeteria</button>
                                <button class="btn-ambient ${ambientEngine.currentTrackId === 'fire' ? 'active' : ''}" data-track="fire"><i data-lucide="flame" style="width:14px;"></i> Lareira</button>
                            </div>
                            <input type="range" id="ambient-volume" class="ambient-volume" min="0" max="1" step="0.05" value="${ambientEngine.volume}">
                        </div>

                        <div class="pomo-settings-group" style="margin-top: 32px;">
                            <h3><i data-lucide="music" style="width:16px;"></i> Trilha Sonora (Spotify)</h3>

                            <div style="display:flex; gap: 8px;">
                                <div class="pomo-select" id="spotify-select" style="flex:1;"></div>
                                <button id="btn-delete-playlist" class="btn-ambient" style="padding: 0 16px; margin: 0; display: ${currentSpotify.startsWith('custom_') ? 'flex' : 'none'};" title="Remover Playlist"><i data-lucide="trash-2" style="width:16px; color: #ef4444;"></i></button>
                            </div>

                            <!-- Formulário para Adicionar Playlist -->
                            <div id="add-playlist-box" style="display: none; background: var(--subtle-bg); padding: 16px; border-radius: 12px; margin-top: 12px; border: 1px solid var(--surface-border);">
                                <div class="form-group" data-field="name" style="margin-bottom:8px;">
                                    <label>Nome</label>
                                    <input type="text" id="new-playlist-name" class="pomo-input-text" style="margin-top:0;" placeholder="Nome da Playlist...">
                                </div>
                                <div class="form-group" data-field="url" style="margin-bottom:12px;">
                                    <label>Link do Spotify</label>
                                    <input type="text" id="new-playlist-url" class="pomo-input-text" style="margin-top:0;" placeholder="Cole o link do Spotify aqui...">
                                </div>
                                <div style="display:flex; gap:8px;">
                                    <button class="pomo-mode-btn" id="btn-cancel-playlist" style="flex:1;">Cancelar</button>
                                    <button class="pomo-mode-btn active" id="btn-save-playlist" style="flex:1; border:none;">Salvar</button>
                                </div>
                            </div>

                            <div class="spotify-container" id="spotify-wrapper">
                                <iframe id="spotify-iframe" src="" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        attachEvents();
        updateIframe();
        updateDOMTimer(timerEngine.timeLeft);
        updateRing();
        createIcons({ icons });
    }

    // --- LÓGICA DE UI E CALLBACKS ---
    function updateDOMTimer(time) {
        const display = container.querySelector('#time-display');
        if (!display) return;
        const m = Math.floor(time / 60); const s = time % 60;
        display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        document.title = `${display.textContent} - Fluxo`;
    }

    const RING_RADIUS = 108;
    const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
    const MODE_LIMITS = {
        focus: { min: 1, max: 120 },
        shortBreak: { min: 1, max: 60 },
        longBreak: { min: 1, max: 60 },
    };

    function limits() {
        return MODE_LIMITS[timerEngine.mode];
    }

    function currentMinutes() {
        return settings.pomodoroTimes[timerEngine.mode];
    }

    function ringFraction() {
        const total = currentMinutes() * 60;

        if (total === 0) return 0;

        return timerEngine.isRunning ? timerEngine.timeLeft / total : 1;
    }

    function updateRing() {
        const fill = container.querySelector('#ring-fill');
        const handle = container.querySelector('#ring-handle');

        if (!fill || !handle) return;

        const fraction = ringFraction();

        fill.style.strokeDasharray = String(RING_LENGTH);
        fill.style.strokeDashoffset = String(RING_LENGTH * (1 - fraction));

        const { min, max } = limits();
        const ratio = (currentMinutes() - min) / (max - min);
        const angle = -Math.PI / 2 + ratio * 2 * Math.PI;

        handle.style.left = `${50 + 45 * Math.cos(angle)}%`;
        handle.style.top = `${50 + 45 * Math.sin(angle)}%`;
        handle.setAttribute('aria-valuenow', String(currentMinutes()));
        handle.setAttribute('aria-valuemin', String(min));
        handle.setAttribute('aria-valuemax', String(max));
        handle.setAttribute('aria-disabled', String(timerEngine.isRunning));
    }

    function setMinutes(minutes) {
        if (timerEngine.isRunning) {
            return;
        }

        const { min, max } = limits();
        const clamped = Math.min(max, Math.max(min, Math.round(minutes)));

        settings.pomodoroTimes = { ...settings.pomodoroTimes, [timerEngine.mode]: clamped };
        timerEngine.timeLeft = clamped * 60;

        const inputId = { focus: 'focus', shortBreak: 'short', longBreak: 'long' }[timerEngine.mode];
        const input = container.querySelector(`#input-time-${inputId}`);

        if (input) input.value = String(clamped);

        updateDOMTimer(timerEngine.timeLeft);
        updateRing();
    }

    function renderTaskTimes() {
        const entries = Object.entries(summaryData.byTask ?? {})
            .map(([taskId, minutes]) => ({
                minutes,
                title: myTasks.find((task) => task.id === taskId)?.title ?? 'Demanda arquivada',
            }))
            .sort((a, b) => b.minutes - a.minutes);

        if (entries.length === 0) {
            return '<p class="settings-hint">Vincule uma demanda ao timer para medir o tempo dela.</p>';
        }

        const longest = entries[0].minutes;

        return entries
            .map(
                (entry) => `
                <div class="pomo-task-time-row">
                    <span class="pomo-task-time-name">${entry.title}</span>
                    <span class="pomo-task-time-bar">
                        <span class="pomo-task-time-fill" style="width: ${Math.round((entry.minutes / longest) * 100)}%"></span>
                    </span>
                    <span class="pomo-task-time-value">${formatHours(entry.minutes)}</span>
                </div>`,
            )
            .join('');
    }

    function getSpotifyUri(link) {
        if (!link) return "";
        const match = link.match(/(playlist|album|track|show|episode)\/([a-zA-Z0-9]+)/);
        return match ? `${match[1]}/${match[2]}` : "";
    }

    function updateIframe() {
        const iframe = container.querySelector('#spotify-iframe');
        if (!iframe) return;
        if (SPOTIFY_PLAYLISTS[currentSpotify]) {
            iframe.src = `https://open.spotify.com/embed/playlist/${SPOTIFY_PLAYLISTS[currentSpotify]}?utm_source=generator&theme=0`;
        } else {
            const custom = customPlaylists.find(p => p.id === currentSpotify);
            if (custom) {
                const uri = getSpotifyUri(custom.url);
                iframe.src = uri ? `https://open.spotify.com/embed/${uri}?utm_source=generator&theme=0` : '';
            } else { iframe.src = ''; }
        }
    }

    function syncProfileStatus(isWorking) {
        void workspaceApi
            .updateProfile({
                vibe: isWorking
                    ? (timerEngine.mode === 'focus' ? 'Em Foco' : 'Em Pausa')
                    : 'Explorando Fluxo',
            })
            .catch(() => undefined);
    }

    timerEngine.onTick = (time) => {
        updateDOMTimer(time);
        updateRing();
    };
    timerEngine.onSummary = (newSummary) => {
        summaryData = newSummary;
        const summary = container.querySelector('#stat-summary');
        if (summary) {
            summary.textContent = `${newSummary.completedCycles} ciclos | ${formatHours(newSummary.focusMinutes)} Foco | ${formatHours(newSummary.breakMinutes)} Pausa`;
        }
    };
    timerEngine.onRecordError = () => {
        pageFeedback.error('Não foi possível registrar essa sessão de pomodoro. Tente novamente.');
    };
    timerEngine.onSessionChange = (stats) => {
        const focusCount = container.querySelector('#session-focus-count');

        if (!focusCount) return;

        focusCount.textContent = String(stats.focusCount);
        container.querySelector('#session-focus-time').textContent = formatClock(stats.focusSeconds);
        container.querySelector('#session-break-count').textContent = String(stats.breakCount);
        container.querySelector('#session-break-time').textContent = formatClock(stats.breakSeconds);
    };
    timerEngine.onEnd = () => {
        new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play().catch(()=>{});
        syncProfileStatus(false);
        const btn = container.querySelector('#btn-toggle-timer');
        if (btn) {
            btn.innerHTML = '<i data-lucide="play" style="width:22px;"></i> Concluído';
            btn.classList.remove('running');
            createIcons({ icons });
        }
    };

    function taskOptions() {
        return [
            { value: '', label: 'Foco Livre (Sem demanda vinculada)' },
            ...myTasks.map((task) => ({
                value: task.id,
                label: `${task.folder ? `[${task.folder}] ` : ''}${task.title}`,
            })),
        ];
    }

    function playlistOptions() {
        return [
            { value: 'lofi', label: 'Lo-Fi Beats' },
            { value: 'coding', label: 'Coding Mode' },
            { value: 'synthwave', label: 'Synthwave' },
            ...customPlaylists.map((playlist) => ({ value: playlist.id, label: playlist.name })),
            { value: 'add_new', label: 'Adicionar Playlist...' },
        ];
    }

    function attachEvents() {
        const btnMain = container.querySelector('#btn-toggle-timer');

        const handle = container.querySelector('#ring-handle');
        const wrap = container.querySelector('.pomo-ring-wrap');

        function minutesFromPointer(event) {
            const rect = wrap.getBoundingClientRect();
            const x = event.clientX - (rect.left + rect.width / 2);
            const y = event.clientY - (rect.top + rect.height / 2);
            const angle = Math.atan2(y, x) + Math.PI / 2;
            const ratio = ((angle + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI);
            const { min, max } = limits();

            return min + ratio * (max - min);
        }

        handle.addEventListener('pointerdown', (event) => {
            if (timerEngine.isRunning) return;

            event.preventDefault();
            handle.setPointerCapture(event.pointerId);

            const move = (moveEvent) => setMinutes(minutesFromPointer(moveEvent));
            const release = () => {
                handle.releasePointerCapture(event.pointerId);
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', release);
            };

            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', release);
        });

        handle.addEventListener('keydown', (event) => {
            const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key];

            if (step === undefined) return;

            event.preventDefault();
            setMinutes(currentMinutes() + step);
        });

        new Dropdown(container.querySelector('#task-select'), {
            options: taskOptions(),
            value: timerEngine.selectedTaskId ?? '',
            onChange: (taskId) => {
                timerEngine.selectedTaskId = taskId;
                syncProfileStatus(timerEngine.isRunning);
            },
        });

        btnMain.addEventListener('click', () => {
            if (timerEngine.isRunning) {
                timerEngine.stop();
                btnMain.innerHTML = '<i data-lucide="play" style="width:22px;"></i> Retomar';
                btnMain.classList.remove('running');
                syncProfileStatus(false);
            } else {
                timerEngine.start();
                btnMain.innerHTML = '<i data-lucide="pause" style="width:22px;"></i> Pausar';
                btnMain.classList.add('running');
                syncProfileStatus(true);
            }
        });

        container.querySelector('#btn-reset-timer').addEventListener('click', () => {
            timerEngine.reset(); syncProfileStatus(false);
            btnMain.innerHTML = '<i data-lucide="play" style="width:22px;"></i> Iniciar';
            btnMain.classList.remove('running');
        });

        container.querySelector('#btn-clear-session').addEventListener('click', () => {
            timerEngine.clearSession();
        });

        container.querySelectorAll('.pomo-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                container.querySelectorAll('.pomo-mode-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                timerEngine.setMode(e.currentTarget.dataset.mode);
                syncProfileStatus(false);
                btnMain.innerHTML = '<i data-lucide="play" style="width:22px;"></i> Iniciar';
                btnMain.classList.remove('running');
            });
        });

        // Áudio Ambiente
        container.querySelectorAll('.btn-ambient').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const trackId = e.currentTarget.dataset.track;
                ambientEngine.play(AMBIENT_TRACKS[trackId], trackId, (activeTrack) => {
                    container.querySelectorAll('.btn-ambient').forEach(b => b.classList.remove('active'));
                    if (activeTrack) { e.currentTarget.classList.add('active'); }
                });
            });
        });

        container.querySelector('#ambient-volume').addEventListener('input', (e) => {
            ambientEngine.setVolume(e.target.value);
        });

        // Configurações de tempo
        ['focus', 'short', 'long'].forEach(id => {
            const modeMap = { 'focus': 'focus', 'short': 'shortBreak', 'long': 'longBreak' };
            const mode = modeMap[id];

            container.querySelector(`#input-time-${id}`).addEventListener('change', (e) => {
                const input = e.target;
                const clamped = Math.min(
                    Number(input.max),
                    Math.max(Number(input.min), Number.parseInt(input.value, 10) || Number(input.min)),
                );

                input.value = String(clamped);
                settings.pomodoroTimes = { ...settings.pomodoroTimes, [mode]: clamped };

                if (timerEngine.mode !== mode) {
                    return;
                }

                if (timerEngine.isRunning) {
                    pageFeedback.error('O ciclo em andamento não muda; o próximo já usa o valor novo.');
                    return;
                }

                timerEngine.timeLeft = clamped * 60;
                updateDOMTimer(timerEngine.timeLeft);
                updateRing();
            });
        });

        container.querySelectorAll('.stepper-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const input = container.querySelector(`#input-time-${button.dataset.target}`);
                const next = Number(input.value) + Number(button.dataset.step);
                const clamped = Math.min(Number(input.max), Math.max(Number(input.min), next));

                input.value = String(clamped);
                input.dispatchEvent(new Event('change'));
            });
        });

        // Lógica de Playlists Customizadas (Com injeção dinâmica segura no DOM)
        const addBox = container.querySelector('#add-playlist-box');
        const playlistForm = new FormFields(addBox, [
            { name: 'name', required: true, message: 'Informe o nome da playlist.' },
            { name: 'url', required: true, message: 'Cole o link da playlist.' },
        ]);
        const spotWrapper = container.querySelector('#spotify-wrapper');
        const btnDelete = container.querySelector('#btn-delete-playlist');

        const spotPicker = new Dropdown(container.querySelector('#spotify-select'), {
            options: playlistOptions(),
            value: currentSpotify,
            onChange: (value) => {
                if (value === 'add_new') {
                    addBox.style.display = 'block';
                    spotWrapper.style.display = 'none';
                    btnDelete.style.display = 'none';
                    return;
                }

                addBox.style.display = 'none';
                spotWrapper.style.display = 'block';
                currentSpotify = value;
                localStorage.setItem('fluxo_pomo_spotify', currentSpotify);
                btnDelete.style.display = currentSpotify.startsWith('custom_') ? 'flex' : 'none';
                updateIframe();
            },
        });

        container.querySelector('#btn-cancel-playlist').addEventListener('click', () => {
            playlistForm.clear();
            addBox.style.display = 'none'; spotWrapper.style.display = 'block';
            spotPicker.setOptions(playlistOptions(), currentSpotify);
            btnDelete.style.display = currentSpotify.startsWith('custom_') ? 'flex' : 'none';
        });

        container.querySelector('#btn-save-playlist').addEventListener('click', () => {
            if (!playlistForm.validate()) {
                return;
            }

            const { name, url } = playlistForm.values();

            if (!getSpotifyUri(url)) {
                playlistForm.showError(
                    'url',
                    'Link inválido. Copie o link de uma playlist ou álbum do Spotify.',
                );
                return;
            }

            const newId = 'custom_' + Date.now();
            customPlaylists.push({ id: newId, name, url });
            localStorage.setItem('fluxo_custom_playlists', JSON.stringify(customPlaylists));

            currentSpotify = newId;
            localStorage.setItem('fluxo_pomo_spotify', currentSpotify);

            spotPicker.setOptions(playlistOptions(), newId);

            playlistForm.clear();
            addBox.style.display = 'none'; spotWrapper.style.display = 'block'; btnDelete.style.display = 'flex';
            container.querySelector('#new-playlist-name').value = ''; container.querySelector('#new-playlist-url').value = '';

            updateIframe();
        });

        btnDelete.addEventListener('click', () => {
            void confirmDialog
                .ask({
                    title: 'Remover playlist',
                    message: 'A playlist sai das suas favoritas. O link original continua valendo.',
                    confirmLabel: 'Remover',
                    danger: true,
                })
                .then((confirmed) => {
                    if (!confirmed) {
                        return;
                    }

                    customPlaylists = customPlaylists.filter(p => p.id !== currentSpotify);
                    localStorage.setItem('fluxo_custom_playlists', JSON.stringify(customPlaylists));

                    currentSpotify = 'lofi';
                    localStorage.setItem('fluxo_pomo_spotify', currentSpotify);
                    spotPicker.setOptions(playlistOptions(), 'lofi');
                    btnDelete.style.display = 'none';

                    updateIframe();
                });
        });
    }

    render();

    settings.onChange((key) => {
        if (key !== 'fluxo.pomodoro.times' || timerEngine.isRunning) {
            return;
        }

        timerEngine.timeLeft = settings.pomodoroTimes[timerEngine.mode] * 60;
        updateDOMTimer(timerEngine.timeLeft);
        render();
    });

    workspaceContext.onChange(() => void loadRemoteState().catch(() => undefined));
    void loadRemoteState().catch(() => undefined);

    return container;
}