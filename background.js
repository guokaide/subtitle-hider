// Background script - 处理快捷键命令
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-subtitle') {
    // 获取当前活动的标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // 发送消息到content script
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle' }, (response) => {
          if (chrome.runtime.lastError) {
            // 如果content script还没加载，忽略错误
            console.log('Content script not ready:', chrome.runtime.lastError.message);
          }
        });
      }
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
