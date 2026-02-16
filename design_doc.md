# Fresh WakaTime Plugin - Design Doc

## Project Overview

Create a Fresh editor plugin that sends heartbeat data to WakaTime for automatic time tracking, similar to existing plugins for VS Code and Micro.

## Architecture

### Option Selected: Use wakatime-cli
- Downloads and uses the official `wakatime-cli` binary
- Leverages all WakaTime features (offline caching, entity detection, etc.)
- Follows the established micro-wakatime pattern

## References

- **Inspiration**: https://github.com/wakatime/micro-wakatime
- **Fresh Plugin Docs**: https://getfresh.dev/docs/plugins/development/
- **WakaTime API**: https://wakatime.com/developers/
- **Fresh Editor**: https://github.com/sinelaw/fresh
- **Fresh Plugins**: https://github.com/sinelaw/fresh-plugins

## Implementation

### API Key Detection (Priority Order)
1. `WAKATIME_API_KEY` environment variable
2. Read from `~/.wakatime.cfg` (standard WakaTime config)
3. Prompt user for API key

### CLI Management
- Check for existing CLI in `~/.wakatime/`
- Auto-download from GitHub releases if missing
- Detect OS/arch for correct binary

### Events Subscribed
- `buffer_save` - Write heartbeat
- `after_file_open` - Activity heartbeat
- `after_insert` / `after_delete` - Activity heartbeat
- `buffer_activated` - Activity heartbeat
- `cursor_moved` - Activity heartbeat

### Throttling
- 2-minute interval between heartbeats for same file
- Always send on write operations

## Files

```
fresh-plugin-wakatime/
├── README.md                    # Installation & usage
├── design_doc.md                # This file
├── plugins/
│   └── wakatime/
│       ├── wakatime.ts         # Main plugin (~250 lines)
│       ├── wakatime.test.ts   # Unit tests
│       └── repo.json           # Package metadata
```

## Testing

Run tests with Deno:
```bash
deno test plugins/wakatime/wakatime.test.ts
```

Tests cover:
- API key validation
- Config file parsing
- Heartbeat argument building
- Throttling logic
- Platform detection
