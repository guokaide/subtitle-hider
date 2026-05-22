// Background script - 处理快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-subtitle') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const tab = tabs[0];

      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') ||
          tab.url?.startsWith('edge://') || tab.url?.startsWith('about:')) {
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'toggle' }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
            }, 100);
          });
        }
      });
    });
  }
});

// 当插件安装时打开欢迎页面
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: 'https://github.com' // 可以改为你的GitHub页面或说明页面
    });
  }
});
