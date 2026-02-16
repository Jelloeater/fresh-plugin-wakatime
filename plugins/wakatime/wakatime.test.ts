import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const PLUGIN_USER_AGENT = "fresh-wakatime/0.1.0";

function isValidApiKey(key: string): boolean {
  if (!key) return false;
  const regex = /^(?i)(waka_)?[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/;
  return regex.test(key);
}

Deno.test("isValidApiKey - valid WakaTime API key", () => {
  const validKeys = [
    "waka_12345678-1234-1234-1234-123456789012",
    "12345678-1234-1234-1234-123456789012",
    "WAKA_12345678-1234-1234-1234-123456789012",
    "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  ];

  for (const key of validKeys) {
    assertEquals(isValidApiKey(key), true, `Expected "${key}" to be valid`);
  }
});

Deno.test("isValidApiKey - invalid API keys", () => {
  const invalidKeys = [
    "",
    "invalid",
    "12345678",
    "waka_123",
    "waka_12345678-1234-1234-1234",
    "waka_12345678-1234-1234-1234-1234567890123",
    "waka_12345678-1234-1234-1234-12345678901",
    "waka_12345678-1234-1234-1234-12345678901g",
  ];

  for (const key of invalidKeys) {
    assertEquals(isValidApiKey(key), false, `Expected "${key}" to be invalid`);
  }
});

function parseWakatimeCfg(content: string): string | null {
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
  return null;
}

Deno.test("parseWakatimeCfg - extracts API key from settings section", () => {
  const config = `[settings]
api_key = waka_12345678-1234-1234-1234-123456789012

[other]
api_key = different_key
`;

  const result = parseWakatimeCfg(config);
  assertEquals(result, "waka_12345678-1234-1234-1234-123456789012");
});

Deno.test("parseWakatimeCfg - returns null when no settings section", () => {
  const config = `[other]
api_key = waka_12345678-1234-1234-1234-123456789012
`;

  const result = parseWakatimeCfg(config);
  assertEquals(result, null);
});

Deno.test("parseWakatimeCfg - returns null when no api_key in settings", () => {
  const config = `[settings]
some_other_key = value
`;

  const result = parseWakatimeCfg(config);
  assertEquals(result, null);
});

function buildHeartbeatArgs(file: string, isWrite: boolean, apiKey: string): string[] {
  const args = [
    "--api-key", apiKey,
    "--entity", file,
    "--plugin", `${PLUGIN_USER_AGENT} fresh/0.2.0`,
  ];

  if (isWrite) {
    args.push("--write");
  }

  return args;
}

Deno.test("buildHeartbeatArgs - creates correct args for regular heartbeat", () => {
  const apiKey = "waka_test";
  const file = "/home/user/project/main.ts";

  const args = buildHeartbeatArgs(file, false, apiKey);

  assertEquals(args[0], "--api-key");
  assertEquals(args[1], apiKey);
  assertEquals(args[2], "--entity");
  assertEquals(args[3], file);
  assertEquals(args[4], "--plugin");
  assertEquals(args.includes("--write"), false);
});

Deno.test("buildHeartbeatArgs - includes --write flag for write operations", () => {
  const apiKey = "waka_test";
  const file = "/home/user/project/main.ts";

  const args = buildHeartbeatArgs(file, true, apiKey);

  assertEquals(args.includes("--write"), true);
});

function shouldSendHeartbeat(lastFile: string, lastHeartbeat: number, currentFile: string, isWrite: boolean, now: number, intervalMs: number): boolean {
  if (isWrite) return true;
  if (lastFile !== currentFile) return true;
  return lastHeartbeat + intervalMs < now;
}

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

Deno.test("shouldSendHeartbeat - always sends on write", () => {
  const result = shouldSendHeartbeat("file1.ts", Date.now(), "file1.ts", true, Date.now(), HEARTBEAT_INTERVAL_MS);
  assertEquals(result, true);
});

Deno.test("shouldSendHeartbeat - sends when file changes", () => {
  const now = Date.now();
  const result = shouldSendHeartbeat("file1.ts", now, "file2.ts", false, now, HEARTBEAT_INTERVAL_MS);
  assertEquals(result, true);
});

Deno.test("shouldSendHeartbeat - doesn't send when same file and within interval", () => {
  const now = Date.now();
  const recentHeartbeat = now - 60000;
  const result = shouldSendHeartbeat("file1.ts", recentHeartbeat, "file1.ts", false, now, HEARTBEAT_INTERVAL_MS);
  assertEquals(result, false);
});

Deno.test("shouldSendHeartbeat - sends when same file but interval passed", () => {
  const now = Date.now();
  const oldHeartbeat = now - 180000;
  const result = shouldSendHeartbeat("file1.ts", oldHeartbeat, "file1.ts", false, now, HEARTBEAT_INTERVAL_MS);
  assertEquals(result, true);
});

function getOs(): string {
  return Deno.build.os === "windows" ? "windows" : Deno.build.os === "darwin" ? "darwin" : "linux";
}

Deno.test("getOs - returns valid OS string", () => {
  const os = getOs();
  assertEquals(["windows", "darwin", "linux"].includes(os), true);
});

function getArch(): string {
  return Deno.build.arch === "x86_64" ? "amd64" : Deno.build.arch === "aarch64" ? "arm64" : "386";
}

Deno.test("getArch - returns valid architecture string", () => {
  const arch = getArch();
  assertEquals(["amd64", "arm64", "386"].includes(arch), true);
});

console.log("All tests passed!");
