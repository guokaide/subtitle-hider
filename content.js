// 状态管理
let isEnabled = false;
let maskElement = null;
let iframeMaskElements = []; // iframe 内部的遮罩
let subtitleHiderEffect = 'blur'; // blur | mask

// 检测是否为 Bilibili
const isBilibili = () => {
  return window.location.hostname.includes('bilibili.com');
};

// 检测 Bilibili 是否处于全屏/影院模式
const isBilibiliFullscreen = () => {
  if (!isBilibili()) return false;

  const playerContainer = document.querySelector('.bpx-player-container') ||
                         document.querySelector('.player-container');

  if (playerContainer) {
    const screenAttr = playerContainer.getAttribute('data-screen');
    if (screenAttr === 'full' || screenAttr === 'web') {
      return true;
    }
  }

  return false;
};

// 检测浏览器原生全屏
const isNativeFullscreen = () => {
  return document.fullscreenElement !== null;
};

// 综合检测是否处于全屏状态（包括浏览器全屏和网页内全屏）
const isAnyFullscreen = () => {
  return isNativeFullscreen() || isBilibiliFullscreen();
};

// 初始化
function init() {
  chrome.storage.sync.get(['maskPosition', 'subtitleHiderEffect'], (result) => {
    subtitleHiderEffect = result.subtitleHiderEffect || 'blur';
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggle') {
      toggleSubtitle();
      sendResponse({ success: true, enabled: isEnabled });
    } else if (request.action === 'getStatus') {
      sendResponse({ enabled: isEnabled, effect: subtitleHiderEffect });
    } else if (request.action === 'setSettings') {
      if (request.effect) {
        subtitleHiderEffect = request.effect;
        applyMaskEffect(maskElement);
        iframeMaskElements.forEach(el => applyMaskEffect(el));
      }
      sendResponse({ success: true });
    }
    return true;
  });
}

// 切换字幕显示/隐藏
function toggleSubtitle() {
  isEnabled = !isEnabled;

  if (isEnabled) {
    createMask();
    // 确保在 iframe 中也创建遮罩
    setTimeout(createMaskInIframes, 300);
  } else {
    removeMask();
    removeIframeMask();
  }
}

// 创建黑色遮罩层
function createMask(savedPosition = null) {
  if (maskElement) return;

  maskElement = document.createElement('div');
  maskElement.id = 'subtitle-hider-mask';

  // 默认位置或保存的位置
  const position = savedPosition || {
    top: window.innerHeight - 150,
    left: (window.innerWidth - 600) / 2,
    width: 600,
    height: 100
  };

  maskElement.style.cssText = `
    position: fixed !important;
    top: ${position.top}px;
    left: ${position.left}px;
    width: ${position.width}px;
    height: ${position.height}px;
    z-index: 2147483647 !important;
    border-radius: 12px;
    cursor: move;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    user-select: none;
    border: 1px solid rgba(255, 255, 255, 0.08);
    pointer-events: auto !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
  `;
  applyMaskEffect(maskElement);

  // 添加调整大小手柄（右下角）
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'subtitle-resize-handle';
  resizeHandle.style.cssText = `
    position: absolute;
    bottom: 0;
    right: 0;
    width: 24px;
    height: 24px;
    cursor: se-resize;
    background: linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.12) 45%);
    border-radius: 0 0 12px 0;
    transition: background 0.2s ease;
  `;

  maskElement.appendChild(resizeHandle);

  // 添加拖动位置功能
  makeDraggable(maskElement);

  // 添加调整大小功能
  makeResizable(maskElement, resizeHandle);

  // 添加滚轮调整功能
  addWheelResize(maskElement);

  document.body.appendChild(maskElement);
  observeMaskStyles();

  setTimeout(createMaskInIframes, 200);
  setTimeout(updateMaskPosition, 100);
}

// 在所有 iframe 中创建遮罩
function createMaskInIframes() {
  const iframes = document.querySelectorAll('iframe');

  iframeMaskElements = [];

  iframes.forEach((iframe) => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      if (iframeDoc) {
        let existingMask = iframeDoc.getElementById('subtitle-hider-iframe-mask');
        if (existingMask) {
          existingMask.remove();
        }

        const mask = iframeDoc.createElement('div');
        mask.id = 'subtitle-hider-iframe-mask';

        chrome.storage.sync.get(['maskPosition'], (result) => {
          const position = result.maskPosition || {
            top: window.innerHeight - 150,
            left: (window.innerWidth - 600) / 2,
            width: 600,
            height: 100
          };

          mask.style.cssText = `
            position: fixed !important;
            top: ${position.top}px !important;
            left: ${position.left}px !important;
            width: ${position.width}px !important;
            height: ${position.height}px !important;
            z-index: 2147483647 !important;
            border-radius: 12px !important;
            cursor: move !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
            user-select: none !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            pointer-events: auto !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            overflow: visible !important;
          `;
          applyMaskEffect(mask);

          iframeDoc.body.appendChild(mask);
        });

        iframeMaskElements.push(mask);
      }
    } catch (e) {
      // 跨域 iframe，忽略
    }
  });
}

// 移除 iframe 中的遮罩
function removeIframeMask() {
  const iframes = document.querySelectorAll('iframe');

  iframes.forEach((iframe) => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const existingMask = iframeDoc.getElementById('subtitle-hider-iframe-mask');
      if (existingMask) {
        existingMask.remove();
      }
    } catch (e) {
      // 跨域 iframe，忽略
    }
  });

  iframeMaskElements = [];
}

// 使元素可拖动（移动位置）
function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  element.addEventListener('mousedown', (e) => {
    // 如果点击的是调整大小手柄，不处理拖动
    if (e.target.classList.contains('subtitle-resize-handle')) {
      return;
    }

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = element.offsetLeft;
    initialTop = element.offsetTop;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    element.style.left = (initialLeft + dx) + 'px';
    element.style.top = (initialTop + dy) + 'px';
  });

  document.addEventListener('mouseup', (e) => {
    if (isDragging) {
      isDragging = false;
      saveMaskPosition();
    }
  });
}

// 使元素可调整大小
function makeResizable(element, handle) {
  let isResizing = false;
  let startX, startY, initialWidth, initialHeight;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    initialWidth = element.offsetWidth;
    initialHeight = element.offsetHeight;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // 最小尺寸限制
    const minWidth = 100;
    const minHeight = 30;

    const newWidth = Math.max(minWidth, initialWidth + dx);
    const newHeight = Math.max(minHeight, initialHeight + dy);

    element.style.width = newWidth + 'px';
    element.style.height = newHeight + 'px';
  });

  document.addEventListener('mouseup', (e) => {
    if (isResizing) {
      isResizing = false;
      saveMaskPosition();
    }
  });
}

// 添加滚轮调整大小功能
function addWheelResize(element) {
  element.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY > 0 ? -10 : 10; // 每次调整10px
    const currentWidth = element.offsetWidth;
    const currentHeight = element.offsetHeight;

    // 最小尺寸限制
    const minWidth = 100;
    const minHeight = 30;

    if (e.shiftKey) {
      // Shift + 滚轮：调整宽度
      const newWidth = Math.max(minWidth, currentWidth + delta);
      element.style.width = newWidth + 'px';
    } else if (e.altKey || e.metaKey) {
      // Alt/Command + 滚轮：调整高度
      const newHeight = Math.max(minHeight, currentHeight + delta);
      element.style.height = newHeight + 'px';
    } else {
      // 普通滚轮：同时调整宽高（保持比例）
      const newWidth = Math.max(minWidth, currentWidth + delta);
      const newHeight = Math.max(minHeight, currentHeight + delta * 0.6);
      element.style.width = newWidth + 'px';
      element.style.height = newHeight + 'px';
    }

    // 保存位置
    saveMaskPosition();
  }, { passive: false });
}

// 保存遮罩位置和大小
function saveMaskPosition() {
  if (!maskElement) return;

  const position = {
    top: parseInt(maskElement.style.top),
    left: parseInt(maskElement.style.left),
    width: parseInt(maskElement.style.width),
    height: parseInt(maskElement.style.height)
  };

  chrome.storage.sync.set({ maskPosition: position });
}

function applyMaskEffect(target) {
  if (!target) return;
  if (subtitleHiderEffect === 'blur') {
    target.style.setProperty('background', 'rgba(0, 0, 0, 0.15)', 'important');
    target.style.setProperty('backdrop-filter', 'blur(12px) saturate(1.1)', 'important');
    target.style.setProperty('-webkit-backdrop-filter', 'blur(12px) saturate(1.1)', 'important');
  } else {
    target.style.setProperty('background', 'rgba(0, 0, 0, 0.85)', 'important');
    target.style.setProperty('backdrop-filter', 'blur(6px)', 'important');
    target.style.setProperty('-webkit-backdrop-filter', 'blur(6px)', 'important');
  }
}

// 移除遮罩层
function removeMask() {
  if (maskElement && maskElement.parentNode) {
    maskElement.parentNode.removeChild(maskElement);
    maskElement = null;
  }

  // 同时移除 iframe 中的遮罩
  removeIframeMask();
}

// 更新遮罩位置（根据全屏状态）
function updateMaskPosition() {
  if (!maskElement) return;

  const fsElement = document.fullscreenElement;

  const iframes = document.querySelectorAll('iframe');
  let fullscreenIframe = null;

  iframes.forEach(iframe => {
    const rect = iframe.getBoundingClientRect();
    if (rect.width === window.innerWidth && rect.height === window.innerHeight) {
      fullscreenIframe = iframe;
    }
  });

  if (fsElement) {
    if (maskElement.parentNode !== fsElement) {
      try {
        fsElement.appendChild(maskElement);

        maskElement.style.setProperty('position', 'fixed', 'important');
        maskElement.style.setProperty('top', (window.innerHeight - 150) + 'px', 'important');
        maskElement.style.setProperty('left', ((window.innerWidth - 600) / 2) + 'px', 'important');
        maskElement.style.setProperty('z-index', '2147483647', 'important');
        maskElement.style.setProperty('display', 'block', 'important');
        maskElement.style.setProperty('visibility', 'visible', 'important');
        maskElement.style.setProperty('opacity', '1', 'important');
        maskElement.style.setProperty('overflow', 'visible', 'important');
      } catch (e) {
        // 移动失败，忽略
      }
    }
  } else if (fullscreenIframe) {
    if (maskElement.parentNode !== document.body) {
      document.body.appendChild(maskElement);
    }

    maskElement.style.setProperty('position', 'fixed', 'important');
    maskElement.style.setProperty('top', (window.innerHeight - 150) + 'px', 'important');
    maskElement.style.setProperty('left', ((window.innerWidth - 600) / 2) + 'px', 'important');
    maskElement.style.setProperty('z-index', '2147483647', 'important');
    maskElement.style.setProperty('display', 'block', 'important');
    maskElement.style.setProperty('visibility', 'visible', 'important');
    maskElement.style.setProperty('opacity', '1', 'important');
    maskElement.style.setProperty('overflow', 'visible', 'important');
  } else {
    if (maskElement.parentNode !== document.body) {
      document.body.appendChild(maskElement);
      maskElement.style.setProperty('position', 'fixed', 'important');
      maskElement.style.setProperty('top', (window.innerHeight - 150) + 'px', 'important');
      maskElement.style.setProperty('left', ((window.innerWidth - 600) / 2) + 'px', 'important');
    }
  }

  maskElement.style.setProperty('z-index', '2147483647', 'important');
  maskElement.style.setProperty('display', 'block', 'important');
  maskElement.style.setProperty('visibility', 'visible', 'important');
  maskElement.style.setProperty('opacity', '1', 'important');
}

// 处理全屏变化（简化版）
function handleFullscreenChange() {
  const delays = [100, 300, 600, 1000];
  delays.forEach(delay => {
    setTimeout(() => {
      updateMaskPosition();
      enforceMaskStyles(isAnyFullscreen());
    }, delay);
  });
}

// 监听浏览器原生全屏事件
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

// 使用 MutationObserver 监听 DOM 变化（检测 Bilibili 的网页内全屏）
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    if (!isEnabled || !maskElement) return;

    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-screen') {
        const target = mutation.target;
        const screenValue = target.getAttribute('data-screen');

        // 只关注 Bilibili 播放器容器的 data-screen 变化
        if (target.classList?.contains('bpx-player-container') ||
            target.classList?.contains('player-container')) {
          if (screenValue === 'full' || screenValue === 'web' || screenValue === 'normal') {
            setTimeout(updateMaskPosition, 100);
          }
        }
      }
    }
  });

  // 观察整个文档的 data-screen 属性变化
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-screen'],
    subtree: true
  });
}

let styleObserver = null;

function observeMaskStyles() {
  if (styleObserver) styleObserver.disconnect();
  if (!maskElement) return;

  styleObserver = new MutationObserver(() => {
    if (!isEnabled || !maskElement) return;
    enforceMaskStyles(isAnyFullscreen());
  });

  styleObserver.observe(maskElement, {
    attributes: true,
    attributeFilter: ['style', 'class']
  });
}

// 强制执行遮罩样式（防止被网站CSS覆盖）
function enforceMaskStyles(isFullscreen) {
  if (!maskElement) return;

  const computedStyle = window.getComputedStyle(maskElement);

  const zIndex = parseInt(computedStyle.zIndex) || 0;
  const display = computedStyle.display;
  const visibility = computedStyle.visibility;
  const opacity = computedStyle.opacity;
  const position = computedStyle.position;

  if (zIndex < 2147483647 ||
      display === 'none' ||
      visibility === 'hidden' ||
      parseFloat(opacity) < 0.5 ||
      position === 'static') {
    maskElement.style.setProperty('position', 'fixed', 'important');
    maskElement.style.setProperty('z-index', '2147483647', 'important');
    maskElement.style.setProperty('display', 'block', 'important');
    maskElement.style.setProperty('visibility', 'visible', 'important');
    maskElement.style.setProperty('opacity', '1', 'important');
    maskElement.style.setProperty('overflow', 'visible', 'important');
    maskElement.style.setProperty('clip', 'auto', 'important');
    maskElement.style.setProperty('clip-path', 'none', 'important');
    maskElement.style.setProperty('transform', 'none', 'important');
    maskElement.style.setProperty('filter', 'none', 'important');
    maskElement.style.setProperty('max-width', 'none', 'important');
    maskElement.style.setProperty('max-height', 'none', 'important');

    let resizeHandle = maskElement.querySelector('.subtitle-resize-handle');
    if (!resizeHandle) {
      resizeHandle = document.createElement('div');
      resizeHandle.className = 'subtitle-resize-handle';
      resizeHandle.style.cssText = `
        position: absolute;
        bottom: 0;
        right: 0;
        width: 24px;
        height: 24px;
        cursor: se-resize;
        background: linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.12) 45%);
        border-radius: 0 0 12px 0;
        transition: background 0.2s ease;
      `;
      maskElement.appendChild(resizeHandle);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setupMutationObserver();
    observeMaskStyles();
  });
} else {
  init();
  setupMutationObserver();
  observeMaskStyles();
}
