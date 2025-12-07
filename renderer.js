const { ipcRenderer } = require('electron');

window.ipcRenderer = ipcRenderer;
window.flatpickr = require('flatpickr');
window.echarts = require('echarts');
const { createPopper } = require('@popperjs/core');
const tippy = require('tippy.js').default; 
window.tippy = tippy;

function initializeApp() {
    if (window.isAppInitialized) {
        console.warn("App is already initialized. Skipping re-init.");
        return;
    }

    const preFlightCheck = () => {
        const errors = [];
        if (!window.flatpickr) errors.push('Flatpickr (calendar) failed to load.');
        if (!window.echarts) errors.push('ECharts (charts) failed to load.');
        if (!window.tippy) errors.push('Tippy.js (tooltips) failed to load.');
        
        if (errors.length > 0) {
            throw new Error('Fatal: Core libraries failed to load:\n- ' + errors.join('\n- '));
        }
    };

    try {
        preFlightCheck(); 

        const state = require('./js/state');
        const refs = require('./js/uiRefs');
        
        // *** DIAGNOSTIC: CHECK FOR MISSING HTML ELEMENTS ***
        let missingRefs = [];
        for (const [key, element] of Object.entries(refs)) {
            if (element === null) {
                const inferredId = key.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
                missingRefs.push(`${key} (Expected ID: ${inferredId}?)`);
            }
        }
        if (missingRefs.length > 0) {
            console.error("CRITICAL UI ERROR: The following elements are missing from index.html:", missingRefs);
        }
        // ***************************************************

        const dataManager = require('./js/dataManager');
        const charts = require('./js/charts');
        const timers = require('./js/timers');
        const modals = require('./js/modals');
        const views = require('./js/views');
        const listeners = require('./js/listeners');
        const tools = require('./js/tools'); // New Tools Module

        const updateAllDisplays = () => {
            views.populateCourses(); 
            views.updateLogDisplay(); 
            views.updateCalendar(); 
            charts.updateTimeChart(); 
            charts.updateScoreChart(); 
            views.updateTaskDashboard(); 
            views.updateCourseEditorList();
            
            if(timers && timers.updatePomodoroDisplay) {
                timers.updatePomodoroDisplay();
            }
        };

        dataManager.init(state, refs);
        charts.init(state, refs); 
        
        charts.initializeCharts(); 
        charts.setPieMode(state.pieChartMode);

        timers.init(state, refs, dataManager.logSession, modals.playAlarm, updateAllDisplays, dataManager.saveData, dataManager.saveTimerProgress);
        views.init(state, refs, modals.showEventModal, dataManager.logSession);
        modals.init(state, refs, dataManager, updateAllDisplays, charts.getTimeChartOptions, charts.getScoreChartOptions, charts.getCharts, charts.getTrendChartOptions);
        
        listeners.init(state, refs, timers, modals, charts, views, dataManager, updateAllDisplays);       
        // Initialize new tools logic (Audio/Breathing)
        tools.initToolsListeners(); 

        dataManager.loadData();
        dataManager.checkForRecoveredSession();
        views.populateCourses();
        views.initializeCalendar();
        views.initializeEventModalPicker();
        views.initializeGlobalTooltips();
        
        updateAllDisplays(); 
        
        window.isAppInitialized = true;

        setTimeout(() => {
            if (charts.getCharts().timeChart) charts.getCharts().timeChart.resize();
            if (charts.getCharts().scoreChart) charts.getCharts().scoreChart.resize();
        }, 50);

    } catch (error) {
        document.body.innerHTML = `
            <div style="padding: 20px; font-family: 'Georgia', serif; background: #fff1f2; color: #9f1239;">
                <h1>Application Failed to Start</h1>
                <p>A critical error occurred during initialization.</p>
                <p><strong>If you just updated HTML:</strong> You might be missing an ID. Check the Console (Ctrl+Shift+I) for "CRITICAL UI ERROR".</p>
                <pre style="background-color: #fff; padding: 10px; border: 1px solid #fecaca;">${error.stack}</pre>
            </div>
        `;
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);