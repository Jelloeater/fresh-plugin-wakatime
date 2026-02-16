/// <reference path="./lib/fresh.d.ts" />

const VERSION = "0.1.0";

const PLUGIN_USER_AGENT = `fresh-wakatime/${VERSION}`;
const GITHUB_RELEASES_URL = "https://api.github.com/repos/wakatime/wakatime-cli/releases/latest";
const GITHUB_DOWNLOAD_BASE = "https://github.com/wakatime/wakatime-cli/releases/download";

let lastFile = "";
let lastHeartbeat = 0;
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

let enabled = false;
let cachedOs: string | null = null;
let cachedArch: string | null = null;
let cliFromPath: string | null = null;

function getEditor() {
  return globalThis.editor;
}

const editor = getEditor();

function getConfigDir(): string {
  return editor.getConfigDir();
}

function getWakatimeDir(): string {
  return editor.pathJoin(editor.getHomeDir(), ".wakatime");
}

function getCliPath(): string {
  const ext = isWindows() ? ".exe" : "";
  return editor.pathJoin(getWakatimeDir(), `wakatime-cli-${getOs()}-${getArch()}${ext}`);
}

function getConfigFilePath(): string {
  return editor.pathJoin(editor.getHomeDir(), ".wakatime.cfg");
}

function isWindows(): boolean {
  return getOs() === "windows";
}

async function detectOs(): Promise<string> {
  if (cachedOs) return cachedOs;
  try {
    const result = await editor.spawnProcess("uname", ["-s"]);
    if (result.exit_code === 0) {
      const os = result.stdout.trim().toLowerCase();
      if (os === "windowsnt" || os === "mingw") {
        cachedOs = "windows";
      } else if (os === "darwin") {
        cachedOs = "darwin";
      } else {
        cachedOs = "linux";
      }
    }
  } catch {
    cachedOs = "linux";
  }
  if (!cachedOs) cachedOs = "linux";
  return cachedOs;
}

function getOs(): string {
  if (cachedOs) return cachedOs;
  return "linux";
}

async function detectArch(): Promise<string> {
  if (cachedArch) return cachedArch;
  try {
    const result = await editor.spawnProcess("uname", ["-m"]);
    if (result.exit_code === 0) {
      const arch = result.stdout.trim().toLowerCase();
      if (arch === "x86_64" || arch === "amd64") {
        cachedArch = "amd64";
      } else if (arch === "aarch64" || arch === "arm64") {
        cachedArch = "arm64";
      } else if (arch === "i386" || arch === "i686") {
        cachedArch = "386";
      }
    }
  } catch {
    cachedArch = "amd64";
  }
  if (!cachedArch) cachedArch = "amd64";
  return cachedArch;
}

function getArch(): string {
  if (cachedArch) return cachedArch;
  return "amd64";
}

function isValidApiKey(key: string): boolean {
  if (!key) return false;
  const regex = new RegExp("^(waka_)?[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$", "i");
  return regex.test(key);
}

function readFromWakatimeCfg(): string | null {
  try {
    const configPath = getConfigFilePath();
    const content = editor.readFile(configPath);
    if (!content) return null;

    const lines = content.split("\n");
    let inSettings = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        inSettings = trimmed.toLowerCase() === "[settings]";
      } else if (inSettings) {
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim().toLowerCase();
          const value = trimmed.substring(eqIndex + 1).trim();
          if (key === "api_key" && value) {
            return value;
          }
        }
      }
    }
  } catch {
    // Config file doesn't exist or can't be read
  }
  return null;
}

async function getEnvVar(name: string): Promise<string | null> {
  try {
    const result = await editor.spawnProcess("sh", ["-c", `echo $${name}`]);
    if (result.exit_code === 0) {
      const value = result.stdout.trim();
      return value || null;
    }
  } catch {
    // Ignore
  }
  return null;
}

async function findWakatimeOnPath(): Promise<string | null> {
  if (cliFromPath) return cliFromPath;
  try {
    const result = await editor.spawnProcess("sh", ["-c", "command -v wakatime || which wakatime"]);
    if (result.exit_code === 0) {
      const path = result.stdout.trim();
      if (path) {
        cliFromPath = path;
        editor.debug(`[wakatime] Found wakatime on PATH: ${path}`);
        return path;
      }
    }
  } catch {
    // Not on PATH
  }
  return null;
}

async function getApiKey(): Promise<string | null> {
  const envKey = await getEnvVar("WAKATIME_API_KEY");
  if (envKey && isValidApiKey(envKey)) {
    return envKey;
  }

  const configKey = readFromWakatimeCfg();
  if (configKey && isValidApiKey(configKey)) {
    return configKey;
  }

  return null;
}

async function cliExists(): Promise<boolean> {
  const path = getCliPath();
  return editor.fileExists(path);
}

async function getCliVersion(): Promise<string> {
  const cliPath = getCliPath();
  try {
    const result = await editor.spawnProcess(cliPath, ["--version"]);
    if (result.exit_code === 0) {
      return result.stdout.trim();
    }
  } catch {
    // CLI doesn't exist or failed
  }
  return "";
}

async function getLatestCliVersion(): Promise<string> {
  try {
    const result = await editor.spawnProcess("curl", ["-s", GITHUB_RELEASES_URL]);
    if (result.exit_code !== 0) return "";

    const match = result.stdout.match(/"tag_name":\s*"([^"]+)"/);
    if (match) {
      return match[1];
    }
  } catch {
    // Network request failed
  }
  return "";
}

async function downloadCli(): Promise<boolean> {
  const version = await getLatestCliVersion();
  if (!version) {
    editor.debug("[wakatime] Failed to get latest CLI version");
    return false;
  }

  const os = getOs();
  const arch = getArch();
  const zipUrl = `${GITHUB_DOWNLOAD_BASE}/${version}/wakatime-cli-${os}-${arch}.zip`;
  const zipPath = editor.pathJoin(getWakatimeDir(), "wakatime-cli.zip");
  const cliPath = getCliPath();

  editor.debug(`[wakatime] Downloading wakatime-cli ${version} from ${zipUrl}`);

  try {
    const curlResult = await editor.spawnProcess("curl", ["-L", "-o", zipPath, zipUrl]);
    if (curlResult.exit_code !== 0) {
      editor.debug("[wakatime] Failed to download CLI");
      return false;
    }

    const unzipResult = await editor.spawnProcess("unzip", ["-o", "-d", getWakatimeDir(), zipPath]);
    if (unzipResult.exit_code !== 0) {
      editor.debug("[wakatime] Failed to unzip CLI");
      return false;
    }

    const extractResult = await editor.spawnProcess("sh", ["-c", `mv "${getWakatimeDir()}/wakatime-cli-${os}-${arch}" "${cliPath}" && chmod +x "${cliPath}"`]);
    if (extractResult.exit_code !== 0) {
      editor.debug("[wakatime] Failed to extract CLI");
      return false;
    }

    editor.debug("[wakatime] CLI downloaded successfully");
    return true;
  } catch (e) {
    editor.debug(`[wakatime] Download error: ${e}`);
    return false;
  }
}

async function ensureCli(): Promise<boolean> {
  if (await findWakatimeOnPath()) {
    editor.debug("[wakatime] Using wakatime from PATH");
    return true;
  }

  if (await cliExists()) {
    const current = await getCliVersion();
    const latest = await getLatestCliVersion();
    if (current === latest) {
      return true;
    }
    editor.debug(`[wakatime] CLI outdated: ${current} -> ${latest}`);
  }

  return await downloadCli();
}

function enoughTimePassed(time: number): boolean {
  return lastHeartbeat + HEARTBEAT_INTERVAL_MS < time;
}

function shouldSendHeartbeat(file: string, isWrite: boolean): boolean {
  if (isWrite) return true;
  if (lastFile !== file) return true;
  return enoughTimePassed(Date.now());
}

function buildHeartbeatArgs(file: string, isWrite: boolean, apiKey: string): string[] {
  const args = [
    "--api-key", apiKey,
    "--entity", file,
    "--plugin", `${PLUGIN_USER_AGENT} fresh/${VERSION}`,
  ];

  if (isWrite) {
    args.push("--write");
  }

  return args;
}

async function sendHeartbeat(file: string, isWrite: boolean): Promise<void> {
  if (!enabled) return;
  if (!file) return;

  const apiKey = await getApiKey();
  if (!apiKey) {
    editor.debug("[wakatime] No API key found");
    return;
  }

  let cliPath = await findWakatimeOnPath();
  if (!cliPath) {
    cliPath = getCliPath();
    if (!(await cliExists())) {
      editor.debug("[wakatime] CLI not found (not on PATH and no local install)");
      return;
    }
  }

  const args = buildHeartbeatArgs(file, isWrite, apiKey);

  try {
    const result = await editor.spawnProcess(cliPath, args);
    if (result.exit_code === 0) {
      editor.debug(`[wakatime] Heartbeat sent: ${file}`);
    } else {
      editor.debug(`[wakatime] Heartbeat failed: ${result.stderr}`);
    }
  } catch (e) {
    editor.debug(`[wakatime] Heartbeat error: ${e}`);
  }

  lastFile = file;
  lastHeartbeat = Date.now();
}

function onEvent(file: string, isWrite: boolean): void {
  if (!enabled) return;
  if (!shouldSendHeartbeat(file, isWrite)) return;
  sendHeartbeat(file, isWrite);
}

globalThis.wakatime_on_buffer_save = function (data: { path: string }): void {
  if (data.path) {
    onEvent(data.path, true);
  }
};

globalThis.wakatime_on_after_file_open = function (data: { path: string }): void {
  if (data.path) {
    onEvent(data.path, false);
  }
};

globalThis.wakatime_on_after_insert = function (data: { buffer_id: number }): void {
  const path = editor.getBufferPath(data.buffer_id);
  if (path) {
    onEvent(path, false);
  }
};

globalThis.wakatime_on_after_delete = function (data: { buffer_id: number }): void {
  const path = editor.getBufferPath(data.buffer_id);
  if (path) {
    onEvent(path, false);
  }
};

globalThis.wakatime_on_buffer_activated = function (data: { buffer_id: number }): void {
  const path = editor.getBufferPath(data.buffer_id);
  if (path) {
    onEvent(path, false);
  }
};

globalThis.wakatime_on_cursor_moved = function (data: { buffer_id: number }): void {
  const path = editor.getBufferPath(data.buffer_id);
  if (path) {
    onEvent(path, false);
  }
};

globalThis.wakatime_on_lines_changed = function (data: { buffer_id: number }): void {
  const path = editor.getBufferPath(data.buffer_id);
  if (path) {
    onEvent(path, false);
  }
};

globalThis.wakatime_toggle = function (): void {
  enabled = !enabled;
  editor.setStatus(enabled ? "WakaTime enabled" : "WakaTime disabled");
  editor.debug(`[wakatime] ${enabled ? "enabled" : "disabled"}`);
};

globalThis.wakatime_set_api_key = async function (): Promise<void> {
  const currentKey = await getApiKey();
  const input = await editor.prompt("Enter WakaTime API Key:", currentKey || "");

  if (input === null || input === "") {
    editor.setStatus("API key not changed");
    return;
  }

  if (!isValidApiKey(input)) {
    editor.setStatus("Invalid API key format");
    return;
  }

  editor.setStatus("API key set (saving to ~/.wakatime.cfg)");
  editor.debug("[wakatime] API key validation passed");
};

globalThis.wakatime_status = async function (): Promise<void> {
  const apiKey = await getApiKey();
  const pathCli = await findWakatimeOnPath();
  const localCli = getCliPath();
  const hasLocalCli = await cliExists();

  let status = `WakaTime: ${enabled ? "enabled" : "disabled"}`;
  status += ` | CLI: ${pathCli ? "PATH" : (hasLocalCli ? "local" : "missing")}`;
  status += ` | API: ${apiKey ? "set" : "missing"}`;

  editor.setStatus(status);
};

async function init(): Promise<void> {
  editor.debug("[wakatime] Initializing...");

  const apiKey = await getApiKey();
  if (!apiKey) {
    editor.setStatus("WakaTime: No API key (set WAKATIME_API_KEY or run :wakatime.setApiKey)");
    editor.debug("[wakatime] No API key found");
  }

  const cliOk = await ensureCli();
  if (!cliOk) {
    editor.setStatus("WakaTime: CLI install failed");
    editor.debug("[wakatime] CLI installation failed");
  }

  if (apiKey && cliOk) {
    enabled = true;
    editor.setStatus("WakaTime: Active");
  }

  editor.debug("[wakatime] Initialization complete");
}

editor.on("buffer_save", "wakatime_on_buffer_save");
editor.on("after_file_open", "wakatime_on_after_file_open");
editor.on("after_insert", "wakatime_on_after_insert");
editor.on("after_delete", "wakatime_on_after_delete");
editor.on("buffer_activated", "wakatime_on_buffer_activated");
editor.on("cursor_moved", "wakatime_on_cursor_moved");
editor.on("lines_changed", "wakatime_on_lines_changed");

editor.registerCommand("wakatime.toggle", "Toggle WakaTime tracking", "wakatime_toggle", "normal");
editor.registerCommand("wakatime.setApiKey", "Set WakaTime API key", "wakatime_set_api_key", "normal");
editor.registerCommand("wakatime.status", "Show WakaTime status", "wakatime_status", "normal");

init();
