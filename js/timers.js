let state, refs, logSession, playAlarm, updateAllDisplays, saveData, saveTimerProgress;
const modals = require('./modals'); 

function init(appState, uiRefs, logSessionFn, playAlarmFn, updateAllDisplaysFn, saveDataFn, saveTimerProgressFn) {
    state = appState;
    refs = uiRefs;
    logSession = logSessionFn;
    playAlarm = playAlarmFn;
    updateAllDisplays = updateAllDisplaysFn;
    saveData = saveDataFn;
    saveTimerProgress = saveTimerProgressFn;

    if (state.pomodoroState !== 'idle') {
        refs.pomodoroStartControls.classList.add('hidden');
        refs.pomodoroRunningControls.classList.remove('hidden');
        refs.pomodoroPauseResumeBtn.disabled = false;
        refs.pomodoroStopBtn.disabled = false;
        if(refs.pomodoroSkipBtn) refs.pomodoroSkipBtn.disabled = false;
        refs.pomodoroPauseResumeBtn.textContent = state.isPomodoroPaused ? "Resume" : "Pause";
        
        if(state.pomodoroState === 'studying') {
             refs.pomodoroStatus.textContent = "PHASE: FOCUS";
             refs.pomodoroStatus.classList.remove('break-mode');
        } else {
             refs.pomodoroStatus.textContent = "PHASE: BREAK";
             refs.pomodoroStatus.classList.add('break-mode');
        }
    } else {
        refs.pomodoroStartControls.classList.remove('hidden');
        refs.pomodoroRunningControls.classList.add('hidden');
    }
}

function updateTimerTabIndicators() {
    refs.btnTimerStopwatch.classList.toggle('running', state.isStopwatchRunning || state.isStopwatchPaused);
    refs.btnTimerPomodoro.classList.toggle('running', state.pomodoroState !== 'idle');
    refs.btnTimerCountdown.classList.toggle('running', state.isCountdownRunning || state.isCountdownPaused);
}

// *** NEW: Updates the display immediately when settings change (if idle) ***
function updatePomodoroDisplay() {
    if (state.pomodoroState === 'idle') {
        state.pomodoroSecondsLeft = state.pomodoroFocusDuration * 60;
        refs.pomodoroTimerDisplay.textContent = formatCountdown(state.pomodoroSecondsLeft);
    }
}

function stopAndLogRunningTimers(excludeTimerType) {
    if (excludeTimerType !== 'stopwatch' && (state.isStopwatchRunning || state.isStopwatchPaused)) stopTimer();
    if (excludeTimerType !== 'pomodoro' && state.pomodoroState !== 'idle') stopPomodoro();
    if (excludeTimerType !== 'countdown' && (state.isCountdownRunning || state.isCountdownPaused)) stopCountdownTimer();
}

// --- Stopwatch ---
function startTimer() { 
    stopAndLogRunningTimers('stopwatch');
    if (state.isStopwatchRunning) return; 
    state.isStopwatchRunning = true; state.isStopwatchPaused = false;
    refs.startButton.textContent = "Pause"; refs.stopButton.disabled = false; refs.courseSelect.disabled = true; 
    if (state.stopwatchStartTime === null) { state.stopwatchStartTime = Date.now(); state.stopwatchSeconds = 0; } 
    else { state.stopwatchStartTime = Date.now() - (state.stopwatchSeconds * 1000); }
    state.stopwatchTimer = setInterval(() => { 
        state.stopwatchSeconds = Math.floor((Date.now() - state.stopwatchStartTime) / 1000);
        refs.timerDisplay.textContent = formatTime(state.stopwatchSeconds); saveTimerProgress(); 
    }, 1000);
    updateTimerTabIndicators(); saveTimerProgress(); 
}

function pauseTimer() {
    clearInterval(state.stopwatchTimer);
    state.isStopwatchRunning = false; state.isStopwatchPaused = true;
    refs.startButton.textContent = "Resume"; updateTimerTabIndicators(); saveTimerProgress(); 
}
    
function stopTimer() { 
    clearInterval(state.stopwatchTimer); 
    if (state.stopwatchStartTime && state.stopwatchSeconds >= 1) {
        refs.timerError.textContent = ""; 
        logSession(refs.courseSelect.value, state.stopwatchSeconds, refs.sessionNotes.value, new Date(state.stopwatchStartTime).toISOString()); 
        updateAllDisplays();
    }
    state.isStopwatchRunning = false; state.isStopwatchPaused = false;
    refs.startButton.textContent = "Start"; refs.startButton.disabled = false; refs.stopButton.disabled = true; refs.courseSelect.disabled = false; 
    state.stopwatchSeconds = 0; state.stopwatchStartTime = null;
    refs.timerDisplay.textContent = formatTime(0);
    updateTimerTabIndicators(); saveData(); 
}

// --- Pomodoro ---
function beginNewPomodoroPhase(durationInSeconds, stateName) {
    stopAndLogRunningTimers('pomodoro');
    
    state.pomodoroOriginalDuration = durationInSeconds;
    if (stateName === 'studying') {
        state.pomodoroStartTime = Date.now();
        refs.pomodoroStatus.textContent = "PHASE: FOCUS";
        refs.pomodoroStatus.classList.remove('break-mode');
    } else {
        refs.pomodoroStatus.textContent = "PHASE: BREAK";
        refs.pomodoroStatus.classList.add('break-mode');
    }
    
    refs.pomodoroStartControls.classList.add('hidden');
    refs.pomodoroRunningControls.classList.remove('hidden');
    
    state.isPomodoroPaused = false;
    startPomodoroCountdown(durationInSeconds, stateName);
}

function handlePomodoroCompletion(isSkipped = false) {
    clearInterval(state.pomodoroTimer);
    if(!isSkipped) playAlarm(); 

    if (state.pomodoroState === 'studying') {
        const elapsed = isSkipped ? (state.pomodoroOriginalDuration - state.pomodoroSecondsLeft) : state.pomodoroOriginalDuration;
        
        if (elapsed > 0) {
            logSession(refs.pomodoroCourseSelect.value, elapsed, refs.pomodoroNotes.value.trim(), new Date(state.pomodoroStartTime).toISOString());
            updateAllDisplays();
        }
        
        refs.pomodoroNotes.value = '';
        state.pomodoroCycle += 1;

        let nextBreakDuration, nextBreakName;
        if (state.pomodoroCycle >= 4) { 
            nextBreakDuration = state.pomodoroLongBreakDuration * 60; nextBreakName = 'longBreak'; 
        } else { 
            nextBreakDuration = state.pomodoroShortBreakDuration * 60; nextBreakName = 'shortBreak'; 
        }
        
        beginNewPomodoroPhase(nextBreakDuration, nextBreakName);

    } else {
        if(!isSkipped) setTimeout(() => playAlarm(true), 15000); 

        state.nextPomodoroPhase = { duration: state.pomodoroFocusDuration * 60, name: 'studying' };
        
        modals.showPomodoroPrompt('studying', state.pomodoroFocusDuration * 60);
        
        state.pomodoroState = 'idle';
        refs.pomodoroStatus.textContent = "COMPLETED";
        updateTimerTabIndicators();
    }
}

function skipPomodoroPhase() {
    handlePomodoroCompletion(true);
}

function startPomodoroCountdown(durationInSeconds, stateName) {
    clearInterval(state.pomodoroTimer); 
    state.pomodoroState = stateName;
    state.pomodoroSecondsLeft = durationInSeconds;

    refs.pomodoroPauseResumeBtn.disabled = false;
    refs.pomodoroStopBtn.disabled = false;
    if(refs.pomodoroSkipBtn) refs.pomodoroSkipBtn.disabled = false; 
    refs.pomodoroPauseResumeBtn.textContent = "Pause";

    let pomodoroStartTimeForInterval = Date.now();
    state.pomodoroTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - pomodoroStartTimeForInterval) / 1000);
        state.pomodoroSecondsLeft = durationInSeconds - elapsed;
        
        if (state.pomodoroSecondsLeft < 0) state.pomodoroSecondsLeft = 0;
        refs.pomodoroTimerDisplay.textContent = formatCountdown(state.pomodoroSecondsLeft);
        saveTimerProgress();

        if (state.pomodoroSecondsLeft <= 0) {
            handlePomodoroCompletion(false);
        }
    }, 1000);
    updateTimerTabIndicators(); saveTimerProgress(); 
}

function togglePomodoroPause() {
    if (state.isPomodoroPaused) {
        state.isPomodoroPaused = false; refs.pomodoroPauseResumeBtn.textContent = "Pause";
        startPomodoroCountdown(state.pomodoroPausedTime, state.pomodoroState);
    } else {
        state.isPomodoroPaused = true; clearInterval(state.pomodoroTimer);
        state.pomodoroPausedTime = state.pomodoroSecondsLeft; refs.pomodoroPauseResumeBtn.textContent = "Resume";
    }
    saveTimerProgress();
}

function stopPomodoro() {
    clearInterval(state.pomodoroTimer);
    playAlarm(true);

    if (state.pomodoroState === 'studying') {
        const elapsedSeconds = state.pomodoroOriginalDuration - state.pomodoroSecondsLeft;
        if (elapsedSeconds >= 1) { 
            logSession(refs.pomodoroCourseSelect.value, elapsedSeconds, refs.pomodoroNotes.value.trim(), new Date(state.pomodoroStartTime).toISOString());
            updateAllDisplays();
            refs.pomodoroNotes.value = '';
        }
    }

    state.pomodoroState = 'idle';
    state.isPomodoroPaused = false;
    state.pomodoroSecondsLeft = state.pomodoroFocusDuration * 60; // Reset to new focus duration
    state.pomodoroStartTime = null;
    refs.pomodoroTimerDisplay.textContent = formatCountdown(state.pomodoroFocusDuration * 60);
    refs.pomodoroStatus.textContent = "";
    
    refs.pomodoroStartControls.classList.remove('hidden');
    refs.pomodoroRunningControls.classList.add('hidden');
    
    refs.pomodoroPauseResumeBtn.disabled = true;
    refs.pomodoroStopBtn.disabled = true;
    if(refs.pomodoroSkipBtn) refs.pomodoroSkipBtn.disabled = true; 
    refs.pomodoroPauseResumeBtn.textContent = "Pause";
    updateTimerTabIndicators(); saveData(); 
}

// --- Countdown ---
function startCountdownTimer(durationInSeconds) {
    stopAndLogRunningTimers('countdown');
    if (!state.isCountdownPaused) {
        const h = parseInt(refs.countdownHours.value) || 0; const m = parseInt(refs.countdownMinutes.value) || 0; const s = parseInt(refs.countdownSeconds.value) || 0;
        localStorage.setItem('countdownValues', JSON.stringify({ h, m, s }));
        state.countdownStartTime = Date.now(); state.countdownOriginalDuration = durationInSeconds;
    }
    clearInterval(state.countdownTimer); 
    state.isCountdownRunning = true; state.isCountdownPaused = false;
    refs.countdownStartPauseBtn.textContent = "Pause"; refs.countdownStopBtn.disabled = false; state.countdownSecondsLeft = durationInSeconds;
    
    let countdownStartTimeForInterval = Date.now();
    state.countdownTimer = setInterval(() => {
        if(state.isCountdownPaused) return;
        const elapsed = Math.floor((Date.now() - countdownStartTimeForInterval) / 1000);
        state.countdownSecondsLeft = durationInSeconds - elapsed;
        
        if (state.countdownSecondsLeft < 0) state.countdownSecondsLeft = 0;
        refs.countdownTimerDisplay.textContent = formatTime(state.countdownSecondsLeft);
        saveTimerProgress();

        if (state.countdownSecondsLeft <= 0) {
            clearInterval(state.countdownTimer); playAlarm();
            logSession(refs.countdownCourseSelect.value, state.countdownOriginalDuration, refs.countdownNotes.value.trim(), new Date(state.countdownStartTime).toISOString());
            updateAllDisplays(); refs.countdownNotes.value = '';
            setTimeout(() => {
                playAlarm(true); state.isCountdownRunning = false;
                refs.countdownStartPauseBtn.textContent = "Start"; refs.countdownStopBtn.disabled = true;
                updateTimerTabIndicators();
            }, 10000);
        }
    }, 1000);
    updateTimerTabIndicators(); saveTimerProgress();
}

function pauseCountdownTimer() {
    clearInterval(state.countdownTimer); state.isCountdownRunning = false; state.isCountdownPaused = true; state.countdownPausedTime = state.countdownSecondsLeft;
    refs.countdownStartPauseBtn.textContent = "Resume"; updateTimerTabIndicators(); saveTimerProgress(); 
}

function stopCountdownTimer() {
    clearInterval(state.countdownTimer); playAlarm(true); 
    const elapsedSeconds = state.countdownOriginalDuration - state.countdownSecondsLeft;
    if (elapsedSeconds >= 2) {
        logSession(refs.countdownCourseSelect.value, elapsedSeconds, refs.countdownNotes.value.trim(), new Date(state.countdownStartTime).toISOString());
        updateAllDisplays(); refs.countdownNotes.value = '';
    }
    state.isCountdownRunning = false; state.isCountdownPaused = false; state.countdownStartTime = null;
    refs.countdownStartPauseBtn.textContent = "Start"; refs.countdownStopBtn.disabled = true;
    resetCountdownTimer(); updateTimerTabIndicators(); saveData(); 
}

function resetCountdownTimer() {
    clearInterval(state.countdownTimer); playAlarm(true); state.isCountdownRunning = false; state.isCountdownPaused = false; state.countdownSecondsLeft = 0; state.countdownStartTime = null;
    refs.countdownTimerDisplay.textContent = "00:00:00";
    const savedCountdown = JSON.parse(localStorage.getItem('countdownValues'));
    if (savedCountdown) { refs.countdownHours.value = savedCountdown.h; refs.countdownMinutes.value = savedCountdown.m; refs.countdownSeconds.value = savedCountdown.s; }
    refs.countdownStartPauseBtn.textContent = "Start"; refs.countdownStopBtn.disabled = true; updateTimerTabIndicators();
}

function setTimerMode(mode) {
    refs.stopwatchPanel.classList.add('hidden'); refs.pomodoroPanel.classList.add('hidden'); refs.countdownPanel.classList.add('hidden');
    refs.btnTimerStopwatch.classList.remove('active'); refs.btnTimerPomodoro.classList.remove('active'); refs.btnTimerCountdown.classList.remove('active');
    if (mode === 'pomodoro') { refs.pomodoroPanel.classList.remove('hidden'); refs.btnTimerPomodoro.classList.add('active'); } 
    else if (mode === 'countdown') { refs.countdownPanel.classList.remove('hidden'); refs.btnTimerCountdown.classList.add('active'); } 
    else { refs.stopwatchPanel.classList.remove('hidden'); refs.btnTimerStopwatch.classList.add('active'); }
}

function formatTime(sec) { 
    const h=Math.floor(sec/3600).toString().padStart(2,'0'); const m=Math.floor((sec%3600)/60).toString().padStart(2,'0'); const s=(sec%60).toString().padStart(2,'0'); 
    return `${h}:${m}:${s}`; 
}

function formatCountdown(sec) {
    const m=Math.floor(sec / 60).toString().padStart(2, '0'); const s=(sec % 60).toString().padStart(2, '0'); 
    return `${m}:${s}`;
}

module.exports = {
    init, startTimer, pauseTimer, stopTimer,
    beginNewPomodoroPhase, startPomodoroCountdown, togglePomodoroPause, stopPomodoro,
    skipPomodoroPhase, updatePomodoroDisplay, // Exported new function
    startCountdownTimer, pauseCountdownTimer, stopCountdownTimer, resetCountdownTimer,
    setTimerMode
};