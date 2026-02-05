// 获取DOM元素
const toggleBtn = document.getElementById('toggleBtn');
const toggleIndicator = document.getElementById('toggleIcon');
const statusText = document.getElementById('statusText');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  updateStatus();
});

// 检查是否是受限制的页面
function isRestrictedUrl(url) {
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') ||
         url.startsWith('about:');
}

// 切换按钮点击事件
toggleBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (isRestrictedUrl(tab.url)) {
      showRestrictedMessage();
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'toggle' }, (response) => {
      if (chrome.runtime.lastError) {
        injectContentScript(tab.id);
      } else if (response && response.success) {
        updateUI(response.enabled);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
});

function showRestrictedMessage() {
  alert('Please open a regular website to use this extension.\n\n请在普通网站上使用此扩展');
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    setTimeout(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (isRestrictedUrl(tab.url)) {
        showRestrictedMessage();
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'toggle' }, (response) => {
        if (response && response.success) {
          updateUI(response.enabled);
        }
      });
    }, 100);
  } catch (error) {
    console.error('Failed to inject:', error);
  }
}

async function updateStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (isRestrictedUrl(tab.url)) {
      updateUI(false, true);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        updateUI(false);
      } else {
        updateUI(response.enabled);
      }
    });
  } catch (error) {
    updateUI(false);
  }
}

function updateUI(enabled, restricted = false) {
  if (restricted) {
    statusText.textContent = 'Restricted';
    statusText.classList.remove('active');
    toggleBtn.classList.remove('active');
    toggleBtn.disabled = true;
  } else if (enabled) {
    statusText.textContent = 'On';
    statusText.classList.add('active');
    toggleBtn.classList.add('active');
    toggleBtn.disabled = false;
  } else {
    statusText.textContent = 'Off';
    statusText.classList.remove('active');
    toggleBtn.classList.remove('active');
    toggleBtn.disabled = false;
  }
}
