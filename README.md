# Meiro Better Workflow

Production-ready Tampermonkey/Greasemonkey userscript that enhances the Meiro.io platform workflow with automatic sorting, form filling, and UI improvements.

## Features

- **Auto-sort lists** - Automatically sorts lists by "Modified" date (newest first)
- **Form auto-fill** - Pre-fills email and Profile ID in campaign forms
- **Content size monitor** - Displays HTML content size in real-time
- **UI enhancements** - Responsive layout improvements and wider content areas
- **Delete button focus** - Auto-focuses delete button in confirmation modals (press Enter to confirm)

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge/Firefox) or [Greasemonkey](https://www.greasespot.net/) (Firefox)
2. Click on the Tampermonkey icon → Create new script
3. Copy the entire script content and paste it
4. Save (Ctrl+S / Cmd+S)
5. Navigate to any `*.meiro.io` page

## Configuration

All settings are in the `CONFIG` object at the top of the script:

```javascript
const CONFIG = {
    logging: {
        enabled: true,
        level: 'INFO' // DEBUG, INFO, WARN, ERROR
    },
    form: {
        profileId: '00059461-1b48-f552-3d8c-9f0422f5aef8' // Change to your Profile ID
    },
    // ... more options
}
```

## How it works

### Auto-sort
- Searches for "Modified" sort button on list pages
- Clicks twice to sort by newest first
- Max 20 attempts over 10 seconds

### Form filling (Campaigns only)
- Retrieves your email from user menu
- Auto-fills "Send to" email field
- Pre-fills Profile ID for testing
- Runs every second until form is filled

### Content size monitor (Campaigns only)
- Monitors Ace Editor content
- Displays size in KB (bottom-right corner)
- Updates every 3 seconds

### UI improvements
- Wider content areas for better workspace
- Responsive adjustments for different screen sizes
- Applied automatically via CSS injection

## Debug console

Access the application in browser console:

```javascript
// View resource stats
window.MeiroBetterWorkflow.app.resourceManager.getStats()

// Enable debug logging
window.MeiroBetterWorkflow.config.logging.level = 'DEBUG'

// Access configuration
window.MeiroBetterWorkflow.config
```

## Architecture

Built with enterprise-grade patterns:
- **Modular design** - Each feature is a separate class
- **Centralized logging** - Comprehensive debug information
- **Resource management** - Automatic cleanup, no memory leaks
- **Error handling** - Try-catch blocks on all operations
- **MutationObservers** - Reactive to DOM changes

## Requirements

- Meiro.io account
- Modern browser (Chrome, Firefox, Edge, Safari)
- Tampermonkey or Greasemonkey extension

## Browser compatibility

- ✅ Chrome/Edge (Tampermonkey)
- ✅ Firefox (Tampermonkey/Greasemonkey)
- ✅ Safari (Tampermonkey)
- ✅ Opera (Tampermonkey)

## License

MIT

## Author

Vojta Florian

## Version

2025-09-29 - Production Ready
