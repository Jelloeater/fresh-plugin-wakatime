# Fresh WakaTime Plugin

Automatic time tracking for your coding activity in the [Fresh](https://getfresh.dev) editor.

## Features

- Automatic time tracking while you code
- Sends heartbeats to WakaTime on file open, save, edit, and cursor movement
- Project and file-level time tracking
- Works with WakaTime dashboard

## Installation

### Option 1: Install from Git URL

1. Open Fresh command palette (`Ctrl+P` or `Cmd+P`)
2. Search for `pkg: Install from URL`
3. Enter: `https://github.com/yourusername/fresh-plugin-wakatime`
4. Restart Fresh

### Option 2: Manual Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/fresh-plugin-wakatime.git
   ```

2. Copy the `wakatime` folder to your Fresh plugins directory:
   ```bash
   # For Linux/macOS:
   cp -r fresh-plugin-wakatime/plugins/wakatime ~/.config/fresh/plugins/
   
   # Or create a symlink:
   ln -s /path/to/fresh-plugin-wakatime/plugins/wakatime ~/.config/fresh/plugins/wakatime
   ```

3. Restart Fresh

## Setup

### API Key Configuration

The plugin needs your WakaTime API key. You can provide it in three ways:

**Option 1: Environment Variable (Recommended)**
```bash
export WAKATIME_API_KEY="your-api-key-here"
```
Add this to your `.bashrc`, `.zshrc`, or profile.

**Option 2: Existing WakaTime Config**
If you already use WakaTime with another editor, the plugin will automatically read your API key from `~/.wakatime.cfg`.

**Option 3: Set via Fresh Command**
1. Open Fresh
2. Press `Ctrl+P` to open command palette
3. Search for `wakatime.setApiKey`
4. Enter your API key (get it from https://wakatime.com/settings/api-key)

## First Run

On first run, the plugin will:
1. Check for your API key
2. Download the WakaTime CLI binary to `~/.wakatime/`
3. Start sending heartbeats when you edit files

## Commands

| Command | Description |
|---------|-------------|
| `wakatime.toggle` | Enable/disable time tracking |
| `wakatime.setApiKey` | Set your WakaTime API key |
| `wakatime.status` | Show tracking status |

## Troubleshooting

### Enable Debug Mode

Run Fresh with debug logging:
```bash
fresh --debug
```

Check the debug output for `[wakatime]` prefixed messages.

### Check Status

Run `:wakatime.status` in Fresh to see:
- Whether tracking is enabled
- If CLI is installed
- If API key is configured

### Verify Heartbeats

Visit https://wakatime.com/plugin-status to see when heartbeats were last received.

## Requirements

- Fresh editor (https://getfresh.dev)
- WakaTime account (https://wakatime.com)
- Internet connection to send heartbeats

## How It Works

The plugin uses the official [wakatime-cli](https://github.com/wakatime/wakatime-cli) binary to send heartbeats. This provides:

- Offline support (heartbeats are queued and sent when online)
- Automatic project detection
- Entity tracking (files, branches, etc.)

## License

MIT License - see LICENSE file for details.
