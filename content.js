// 脚本加载调试日志
console.log('[Subtitle Hider] ========== 脚本已加载 ==========');
console.log('[Subtitle Hider] 当前页面:', window.location.href);
console.log('[Subtitle Hider] document.readyState:', document.readyState);

// 状态管理
let isEnabled = false;
let maskElement = null;
let iframeMaskElement = null; // iframe 内部的遮罩
let subtitleHiderEffect = 'blur'; // blur | mask

// 检测是否为 Bilibili
const isBilibili = () => {
  return window.location.hostname.includes('bilibili.com');
};

// 检测 Bilibili 是否处于全屏/影院模式
const isBilibiliFullscreen = () => {
  if (!isBilibili()) {
    console.log('[Subtitle Hider] 非 Bilibili 网站');
    return false;
  }

  // 检查播放器容器的 data-screen 属性
  const playerContainer = document.querySelector('.bpx-player-container') ||
                         document.querySelector('.player-container');

  console.log('[Subtitle Hider] 查找播放器容器，结果:', playerContainer);

  if (playerContainer) {
    const screenAttr = playerContainer.getAttribute('data-screen');
    console.log('[Subtitle Hider] 播放器 data-screen 属性:', screenAttr);
    // data-screen="full" 表示全屏模式
    // data-screen="web" 表示网页全屏模式
    if (screenAttr === 'full' || screenAttr === 'web') {
      console.log('[Subtitle Hider] Bilibili 处于全屏模式');
      return true;
    }
  }

  console.log('[Subtitle Hider] Bilibili 未处于全屏模式');
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
  console.log('[Subtitle Hider] init() 函数被调用');

  // 从storage读取状态
  chrome.storage.sync.get(['subtitleHiderEnabled', 'maskPosition', 'subtitleHiderEffect'], (result) => {
    console.log('[Subtitle Hider] 从 storage 读取配置:', result);
    isEnabled = result.subtitleHiderEnabled || false;
    subtitleHiderEffect = result.subtitleHiderEffect || 'blur';
    console.log('[Subtitle Hider] isEnabled:', isEnabled);
    if (isEnabled) {
      createMask(result.maskPosition);
    }
  });

  // 监听来自popup或background的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Subtitle Hider] 收到消息:', request);
    if (request.action === 'toggle') {
      toggleSubtitle();
      sendResponse({ success: true, enabled: isEnabled });
    } else if (request.action === 'getStatus') {
      sendResponse({ enabled: isEnabled, effect: subtitleHiderEffect });
    } else if (request.action === 'setSettings') {
      if (request.effect) {
        subtitleHiderEffect = request.effect;
        applyMaskEffect(maskElement);
        applyMaskEffect(iframeMaskElement);
      }
      sendResponse({ success: true });
    }
    return true;
  });
}

// 切换字幕显示/隐藏
function toggleSubtitle() {
  isEnabled = !isEnabled;
  chrome.storage.sync.set({ subtitleHiderEnabled: isEnabled });

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

  // 先添加到 body
  document.body.appendChild(maskElement);
  console.log('[Subtitle Hider] 遮罩已创建并添加到 body');

  // 尝试在 iframe 内部也创建遮罩
  setTimeout(createMaskInIframes, 200);

  // 立即检查是否需要调整位置
  setTimeout(updateMaskPosition, 100);
}

// 在所有 iframe 中创建遮罩
function createMaskInIframes() {
  const iframes = document.querySelectorAll('iframe');

  iframes.forEach((iframe, index) => {
    try {
      // 检查是否可以访问 iframe 内容（同源）
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      if (iframeDoc) {
        console.log('[Subtitle Hider] 在 iframe', index, '中创建遮罩');

        // 避免重复创建
        let existingMask = iframeDoc.getElementById('subtitle-hider-iframe-mask');
        if (existingMask) {
          existingMask.remove();
        }

        iframeMaskElement = iframeDoc.createElement('div');
        iframeMaskElement.id = 'subtitle-hider-iframe-mask';

        // 获取保存的位置
        chrome.storage.sync.get(['maskPosition'], (result) => {
          const position = result.maskPosition || {
            top: window.innerHeight - 150,
            left: (window.innerWidth - 600) / 2,
            width: 600,
            height: 100
          };

          iframeMaskElement.style.cssText = `
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
          applyMaskEffect(iframeMaskElement);

          iframeDoc.body.appendChild(iframeMaskElement);
          console.log('[Subtitle Hider] ✓ iframe 遮罩已创建');
        });
      }
    } catch (e) {
      // 跨域 iframe 无法访问，忽略
      console.log('[Subtitle Hider] iframe', index, '跨域限制，无法访问');
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
        console.log('[Subtitle Hider] iframe 遮罩已移除');
      }
    } catch (e) {
      // 跨域 iframe，忽略
    }
  });

  iframeMaskElement = null;
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

  console.log('[Subtitle Hider] ===== updateMaskPosition =====');

  const fsElement = document.fullscreenElement;
  console.log('[Subtitle Hider] 浏览器全屏元素:', fsElement);

  // 检查是否有 iframe 进入全屏（iframe 全屏时，fullscreenElement 可能是 iframe 元素本身）
  const iframes = document.querySelectorAll('iframe');
  let fullscreenIframe = null;

  iframes.forEach(iframe => {
    // 检查 iframe 是否占据整个视口（可能是全屏状态）
    const rect = iframe.getBoundingClientRect();
    if (rect.width === window.innerWidth && rect.height === window.innerHeight) {
      fullscreenIframe = iframe;
      console.log('[Subtitle Hider] 检测到全屏 iframe:', iframe.src);
    }
  });

  if (fsElement) {
    // 浏览器原生全屏：移动遮罩到全屏元素内部
    console.log('[Subtitle Hider] 浏览器全屏模式，移动遮罩到全屏元素');

    if (maskElement.parentNode !== fsElement) {
      try {
        fsElement.appendChild(maskElement);

        // 设置全屏模式下的位置和样式
        maskElement.style.setProperty('position', 'fixed', 'important');
        maskElement.style.setProperty('top', (window.innerHeight - 150) + 'px', 'important');
        maskElement.style.setProperty('left', ((window.innerWidth - 600) / 2) + 'px', 'important');
        maskElement.style.setProperty('z-index', '2147483647', 'important');
        maskElement.style.setProperty('display', 'block', 'important');
        maskElement.style.setProperty('visibility', 'visible', 'important');
        maskElement.style.setProperty('opacity', '1', 'important');
        maskElement.style.setProperty('overflow', 'visible', 'important');

        console.log('[Subtitle Hider] ✓ 遮罩已移动到全屏元素');
      } catch (e) {
        console.error('[Subtitle Hider] ✗ 移动失败:', e);
      }
    }
  } else if (fullscreenIframe) {
    // iframe 全屏：确保遮罩在 body 中且 z-index 最高
    console.log('[Subtitle Hider] iframe 全屏模式，确保遮罩在 body 中');

    if (maskElement.parentNode !== document.body) {
      console.log('[Subtitle Hider] 将遮罩移回 body');
      document.body.appendChild(maskElement);
    }

    // 使用绝对最高的 z-index
    maskElement.style.setProperty('position', 'fixed', 'important');
    maskElement.style.setProperty('top', (window.innerHeight - 150) + 'px', 'important');
    maskElement.style.setProperty('left', ((window.innerWidth - 600) / 2) + 'px', 'important');
    maskElement.style.setProperty('z-index', '2147483647', 'important');
    maskElement.style.setProperty('display', 'block', 'important');
    maskElement.style.setProperty('visibility', 'visible', 'important');
    maskElement.style.setProperty('opacity', '1', 'important');
    maskElement.style.setProperty('overflow', 'visible', 'important');
  } else {
    // 非全屏：遮罩应该在 body 中
    console.log('[Subtitle Hider] 非全屏模式');

    if (maskElement.parentNode !== document.body) {
      console.log('[Subtitle Hider] 遮罩不在 body 中，移回');
      document.body.appendChild(maskElement);
      maskElement.style.setProperty('position', 'fixed', 'important');
      maskElement.style.setProperty('top', (window.innerHeight - 150) + 'px', 'important');
      maskElement.style.setProperty('left', ((window.innerWidth - 600) / 2) + 'px', 'important');
    }
  }

  // 确保 z-index 和可见性
  maskElement.style.setProperty('z-index', '2147483647', 'important');
  maskElement.style.setProperty('display', 'block', 'important');
  maskElement.style.setProperty('visibility', 'visible', 'important');
  maskElement.style.setProperty('opacity', '1', 'important');
}

// 处理全屏变化（简化版）
function handleFullscreenChange() {
  console.log('[Subtitle Hider] ========== 全屏状态变化 ==========');
  console.log('[Subtitle Hider] 浏览器全屏元素:', document.fullscreenElement);

  // 多次延迟执行，确保 DOM 更新完成和样式生效
  const delays = [100, 300, 600];
  delays.forEach(delay => {
    setTimeout(() => {
      updateMaskPosition();
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

          console.log('[Subtitle Hider] 检测到 data-screen 变化:', screenValue);

          // data-screen="full" 或 "web" 表示全屏模式
          if (screenValue === 'full' || screenValue === 'web') {
            console.log('[Subtitle Hider] Bilibili 进入全屏模式');
            setTimeout(updateMaskPosition, 100);
          } else if (screenValue === 'normal') {
            console.log('[Subtitle Hider] Bilibili 退出全屏模式');
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

  console.log('[Subtitle Hider] MutationObserver 已启动');
}

// 定期检查遮罩状态（每秒检查一次）
function setupPeriodicCheck() {
  setInterval(() => {
    if (isEnabled && maskElement) {
      const fsElement = document.fullscreenElement;

      // 检查是否有 iframe 进入全屏
      const iframes = document.querySelectorAll('iframe');
      let fullscreenIframe = null;

      iframes.forEach(iframe => {
        const rect = iframe.getBoundingClientRect();
        if (rect.width === window.innerWidth && rect.height === window.innerHeight) {
          fullscreenIframe = iframe;
        }
      });

      // 根据全屏状态确保遮罩在正确的容器中
      if (fsElement) {
        // 全屏模式：遮罩应该在全屏元素中
        if (maskElement.parentNode !== fsElement) {
          console.log('[Subtitle Hider] 定期检查：遮罩需要移动到全屏元素');
          updateMaskPosition();
        }

        // 强制确保全屏模式下的样式不被覆盖
        enforceMaskStyles(true);
      } else if (fullscreenIframe) {
        // iframe 全屏模式：确保遮罩在 body 中
        if (maskElement.parentNode !== document.body) {
          console.log('[Subtitle Hider] 定期检查：iframe 全屏，遮罩需要移回 body');
          updateMaskPosition();
        }

        // 强制确保样式
        enforceMaskStyles(true);
      } else {
        // 非全屏模式：遮罩应该在 body 中
        if (maskElement.parentNode !== document.body) {
          console.log('[Subtitle Hider] 定期检查：遮罩需要移回 body');
          updateMaskPosition();
        }

        // 确保非全屏模式下的样式
        enforceMaskStyles(false);
      }
    }
  }, 1000);

  console.log('[Subtitle Hider] 定期检查已启动');
}

// 强制执行遮罩样式（防止被网站CSS覆盖）
function enforceMaskStyles(isFullscreen) {
  if (!maskElement) return;

  const computedStyle = window.getComputedStyle(maskElement);

  // 检查关键样式是否被覆盖
  const zIndex = parseInt(computedStyle.zIndex) || 0;
  const display = computedStyle.display;
  const visibility = computedStyle.visibility;
  const opacity = computedStyle.opacity;
  const position = computedStyle.position;

  // 如果样式被覆盖，强制重新设置
  if (zIndex < 2147483647 ||
      display === 'none' ||
      visibility === 'hidden' ||
      parseFloat(opacity) < 0.5 ||
      position === 'static') {

    console.log('[Subtitle Hider] 检测到样式被覆盖，强制重新设置');
    console.log('[Subtitle Hider] zIndex:', zIndex, 'display:', display, 'visibility:', visibility, 'opacity:', opacity, 'position:', position);

    // 只修改必要的样式属性，不覆盖整个 cssText
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

    // 重新添加调整大小手柄（如果被删除了）
    let resizeHandle = maskElement.querySelector('.subtitle-resize-handle');
    if (!resizeHandle) {
      console.log('[Subtitle Hider] 重新添加调整大小手柄');
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

// 启动
console.log('[Subtitle Hider] 准备启动，document.readyState =', document.readyState);
if (document.readyState === 'loading') {
  console.log('[Subtitle Hider] 等待 DOMContentLoaded 事件');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Subtitle Hider] DOMContentLoaded 事件触发');
    init();
    setupMutationObserver();
    setupPeriodicCheck();
  });
} else {
  console.log('[Subtitle Hider] 立即执行初始化');
  init();
  setupMutationObserver();
  setupPeriodicCheck();
}
