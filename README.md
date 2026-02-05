# Subtitle Hider 🎬

A Chrome browser extension that hides video subtitles to help you practice English listening skills by forcing you to rely on audio comprehension.

## Features

- **Auto-detection**: Automatically detects and hides subtitles on popular video platforms
- **Universal masking**: Falls back to a black mask for unsupported sites
- **Easy toggle**: Enable/disable with a single click or keyboard shortcut
- **Multi-site support**: Works with YouTube, Netflix, Bilibili, Coursera, and more
- **Persistent settings**: Your preference is saved across browser sessions

## Supported Websites

- YouTube
- Netflix
- Bilibili
- 优酷 (Youku)
- 爱奇艺 (iQiyi)
- 腾讯视频 (Tencent Video)
- Coursera
- Udemy
- Khan Academy
- And more...

## Installation

### Method 1: Load Unpacked Extension (Recommended for Development)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select the `subtitle-hider` folder
6. The extension is now installed!

### Method 2: Install from Chrome Web Store

Coming soon! The extension will be published to the Chrome Web Store for easy installation.

## How to Use

### Toggle Subtitle Hiding

There are two ways to toggle subtitle hiding:

1. **Click the extension icon**: Click the Subtitle Hider icon in your browser toolbar, then click the "Enable/Disable" button
2. **Keyboard shortcut**: Press `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac)

### Status Indicator

The popup window shows the current status:
- 🟢 Green dot = Subtitles are hidden
- ⚪ Gray dot = Subtitles are visible

## How It Works

The extension uses a three-layer approach:

1. **CSS Selector Targeting**: Identifies subtitle elements using site-specific CSS selectors
2. **Universal CSS Rules**: Injects broad CSS rules to hide common subtitle patterns
3. **Visual Mask**: Creates a black overlay at the bottom of the video as a fallback

This multi-pronged approach ensures maximum compatibility across different video platforms.

## Project Structure

```
subtitle-hider/
├── manifest.json       # Extension configuration
├── content.js          # Core subtitle hiding logic
├── popup.html          # Popup window UI
├── popup.js            # Popup window logic
├── popup.css           # Popup window styles
├── styles.css          # Content script styles
├── icons/              # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # This file
```

## Development

### Modifying Supported Sites

To add support for a new video site, edit the `subtitleSelectors` object in `content.js`:

```javascript
const subtitleSelectors = {
  'example.com': [
    '.subtitle-element',
    '[class*="caption"]'
  ],
  // ... more sites
};
```

### Building from Source

No build process required! The extension uses vanilla JavaScript and CSS, so you can simply load the unpacked extension after making changes.

### Testing

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Subtitle Hider extension card
4. Test on your target video sites

## Troubleshooting

**Q: Subtitles are still visible on some sites**
A: The extension may not have the correct CSS selector for that site. Please open an issue with the site URL and we'll add support!

**Q: The black mask covers too much of the video**
A: You can adjust the mask size in `content.js` by modifying the `createMask()` function.

**Q: Keyboard shortcut doesn't work**
A: Make sure no other extensions are using the same shortcut. You can change it in `chrome://extensions/shortcuts`.

## Contributing

Contributions are welcome! Feel free to:
- Add support for more video sites
- Improve subtitle detection algorithms
- Enhance the UI/UX
- Fix bugs
- Improve documentation

## License

MIT License - feel free to use this extension for personal or commercial purposes.

## Acknowledgments

Created for English learners who want to improve their listening comprehension through active practice.

---

Happy learning! 📚🎧
