const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('radar', {
  fetchFrames(domain) {
    return ipcRenderer.invoke('radar:fetchFrames', domain);
  },
  fetchImageDataUrl(imageUrl) {
    return ipcRenderer.invoke('radar:fetchImageDataUrl', imageUrl);
  },
  getRuntimeConfig() {
    return ipcRenderer.invoke('app:getRuntimeConfig');
  },
  quit() {
    return ipcRenderer.invoke('app:quit');
  }
});
