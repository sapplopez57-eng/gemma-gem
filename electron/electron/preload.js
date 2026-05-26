const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  readFile: (path) => ipcRenderer.invoke('readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('writeFile', path, content),
  listDirectory: (path) => ipcRenderer.invoke('listDirectory', path),
  runCommand: (command) => ipcRenderer.invoke('runCommand', command),
})
