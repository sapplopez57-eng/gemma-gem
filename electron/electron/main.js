const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs').promises

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handlers for file system operations
ipcMain.handle('readFile', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  } catch (e) {
    console.error('Read file error:', e)
    throw e
  }
})

ipcMain.handle('writeFile', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8')
  } catch (e) {
    console.error('Write file error:', e)
    throw e
  }
})

ipcMain.handle('listDirectory', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath)
    return entries
  } catch (e) {
    console.error('List directory error:', e)
    throw e
  }
})

ipcMain.handle('runCommand', async (event, command) => {
  // Note: For security, consider using a restricted shell or sandboxing
  const { exec } = require('child_process')
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout || stderr)
    })
  })
})
