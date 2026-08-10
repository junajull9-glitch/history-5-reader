const { app, BrowserWindow } = require("electron");
const path = require("path");

// Важно: этот параметр задаётся до app.whenReady().
app.commandLine.appendSwitch("force-device-scale-factor", "1");

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            zoomFactor: 1
        }
    });

    win.loadFile("index.html");

    win.webContents.once("did-finish-load", () => {
        win.webContents.setZoomFactor(1);
    });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});