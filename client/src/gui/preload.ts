import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Link account with code
  linkAccount: async (code: string) => {
    const result = await ipcRenderer.invoke('link-account', code);
    if (!result.success) {
      throw new Error(result.error || 'Failed to link account');
    }
    return result;
  },

  // Listen for user data
  onUserData: (callback: (userData: any) => void) => {
    ipcRenderer.on('user-data', (event, userData) => {
      callback(userData);
    });
  },

  // Close window
  closeWindow: () => {
    ipcRenderer.send('close-window');
  }
});
