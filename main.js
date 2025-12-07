const { app, BrowserWindow, ipcMain, dialog } = require('electron'); // <-- FIX
const path = require('path'); // <--- ADD THIS

// Add the require statement for the package
try {
  require('electron-reloader')(module);
} catch (_) {}

app.commandLine.appendSwitch('force-device-scale-factor', '0.9');

// This function handles the "Choose File" button click
async function handleFileOpen() {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
        ]
    });
    if (!canceled) {
        return filePaths[0];
    }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 1300,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    
    // Reverting to the 'show' method that was causing the "green screen"
    // because it was the most recent stable version you had.
    // If this causes the "refresh" bug again, we must remove it.
    show: false,
    backgroundColor: '#f4f7f9',

    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: "MedChronos"
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // This is correctly commented out
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    // This tells the main process to listen for the renderer's request
    ipcMain.handle('dialog:openFile', handleFileOpen);
    
    createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });