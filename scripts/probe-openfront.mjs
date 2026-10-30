import fs from "node:fs/promises";
import { chromium } from "playwright";

const SITE = "https://openfront.io";
const WAIT_MS = 45000;
const report = {
  testedAt: new Date().toISOString(),
  site: SITE,
  authenticated: false,
  page: null,
  title: null,
  lobbyEvents: [],
  lobbyWebSockets: [],
  relevantResponses: [],
  pageErrors: [],
  conclusion: "inconclusive"
};

const isRelevant = (value) => /lobb(y|ies)|public.?game|api\/game/i.test(String(value || ""));

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    const save = (event) => {
      try {
        const detail = event?.detail;
        const safe = detail == null ? null : JSON.parse(JSON.stringify(detail));
        window.__galOpenfrontLobbyEvents ||= [];
        window.__galOpenfrontLobbyEvents.push({
          at: Date.now(),
          type: event?.type || "public-lobbies-update",
          detail: safe
        });
      } catch (error) {
        window.__galOpenfrontLobbyEvents ||= [];
        window.__galOpenfrontLobbyEvents.push({
          at: Date.now(),
          type: "capture-error",
          error: String(error?.message || error)
        });
      }
    };
    window.addEventListener("public-lobbies-update", save, true);
    document.addEventListener("public-lobbies-update", save, true);
  });

  page.on("websocket", (socket) => {
    if (!isRelevant(socket.url())) return;
    const item = { url: socket.url(), opened: true, frames: [], closed: false };
    report.lobbyWebSockets.push(item);
    socket.on("framereceived", (data) => {
      if (item.frames.length >= 20) return;
      const value = typeof data === "string"
        ? data.slice(0, 4000)
        : "[trame binaire " + (data?.byteLength ?? 0) + " octets]";
      item.frames.push({ at: new Date().toISOString(), data: value });
    });
    socket.on("close", () => { item.closed = true; });
  });

  page.on("response", async (response) => {
    if (!isRelevant(response.url())) return;
    if (report.relevantResponses.length >= 60) return;
    report.relevantResponses.push({
      url: response.url(),
      status: response.status(),
      contentType: response.headers()["content-type"] || ""
    });
  });

  page.on("pageerror", (error) => {
    if (report.pageErrors.length < 20) report.pageErrors.push(String(error?.message || error));
  });

  try {
    const response = await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 30000 });
    report.page = { status: response?.status() ?? null, url: page.url() };
    report.title = await page.title().catch(() => null);
    await page.waitForTimeout(WAIT_MS);
    report.lobbyEvents = await page.evaluate(() => window.__galOpenfrontLobbyEvents || []);
  } catch (error) {
    report.pageErrors.push("Navigation: " + String(error?.message || error));
  }

  const eventWithLobbies = report.lobbyEvents.some((entry) => {
    const d = entry.detail;
    return d && (Array.isArray(d) || Array.isArray(d.games) || Array.isArray(d.lobbies) ||
      (d.games && typeof d.games === "object") || (d.lobbies && typeof d.lobbies === "object"));
  });
  const socketWithFrames = report.lobbyWebSockets.some((socket) => socket.frames.length > 0);
  const pageLoaded = report.page?.status >= 200 && report.page?.status < 400;

  if (eventWithLobbies) {
    report.conclusion = "public_lobby_event_received_without_player_login";
  } else if (socketWithFrames) {
    report.conclusion = "lobby_websocket_frames_seen_but_event_not_confirmed";
  } else if (!pageLoaded) {
    report.conclusion = "openfront_page_not_reached";
  } else {
    report.conclusion = "no_public_lobby_data_observed_without_player_login";
  }
} finally {
  await browser.close();
}

await fs.writeFile("diagnostic-openfront.json", JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({
  conclusion: report.conclusion,
  page: report.page,
  title: report.title,
  lobbyEvents: report.lobbyEvents.length,
  lobbyWebSockets: report.lobbyWebSockets.length,
  relevantResponses: report.relevantResponses.length,
  pageErrors: report.pageErrors.slice(0, 5)
}, null, 2));

if (report.conclusion === "openfront_page_not_reached") {
  process.exitCode = 2;
}
