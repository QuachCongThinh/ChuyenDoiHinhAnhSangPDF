const { app, BrowserWindow } = require("electron");
const path = require("path");
const isDev = !app.isPackaged; // Kiểm tra xem ứng dụng đã được đóng gói hay chưa

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.maximize();
  const startUrl = isDev
    ? "http://localhost:3000"
    : "https://chuyendoihinhanh.vercel.app/";

  mainWindow.loadURL(startUrl);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
