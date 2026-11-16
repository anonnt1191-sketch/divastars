// core/app.js — PixiJS stage setup, screen routing, app shell.
// Mobile-first: portrait orientation, responsive canvas, adaptive quality.

import { store } from "./store.js";
import { sfx } from "./sfx.js";
import { initFX, toast } from "./fx.js";
import { sessionInit, SESSION } from "./session.js";
import { buildPool, buildCastList, preloadTextures } from "./photos.js";
import { DIVAS } from "../data/divas.js";
import { PACK_NAMES, WORLD_CAST } from "../data/world-cast-names.js";
import { GAMES } from "../data/games-registry.js";
import { loadLang, t, getLang, setLang, AVAILABLE_LANGS, LANG_LABELS } from "./i18n.js";
import { marqueeLine, vedhikaNote, divaOfTheDay } from "./voice.js";

export const POOL = buildPool(DIVAS, PACK_NAMES, WORLD_CAST);
export const CAST_LIST = buildCastList(DIVAS, PACK_NAMES, WORLD_CAST);

export class App {
  constructor() {
    this.pixiApp = null;
    this.screen = null;          // current screen name
    this.currentGame = null;     // current game id
    this.currentGameInstance = null;
    this.cleanup = null;
    this.router = {};
    this.lobby = null;
    this.booted = false;
  }

  async boot() {
    if (this.booted) return;

    // i18n
    await loadLang("en");

    // store init
    store.init(GAMES);

    // session randomization
    window.DD = { POOL, CAST_LIST, SESSION, store };
    sessionInit(CAST_LIST);
    window.DD.SESSION = SESSION;

    // PixiJS app — PHASE 1: aggressive mobile perf optimization
    const deviceTier = detectDeviceTier();
    window.DD_DEVICE_TIER = deviceTier;  // expose for fx.js / games
    const isMobile = deviceTier !== "desktop";
    // Resolution cap: low-end=1, mid=1.5, high=2, desktop=3
    const resCap = deviceTier === "low" ? 1 : deviceTier === "mid" ? 1.5 : deviceTier === "high" ? 2 : 3;
    this.pixiApp = new PIXI.Application({
      view: document.getElementById("stage"),
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x160b20,
      antialias: !isMobile,  // disable AA on mobile for perf
      resolution: Math.min(window.devicePixelRatio || 1, resCap),
      autoDensity: true,
      powerPreference: "high-performance"
    });
    console.info(`[App] Device tier: ${deviceTier} | Resolution cap: ${resCap}`);
    window.addEventListener("resize", () => this._resize());

    // init FX layer
    initFX(this.pixiApp);

    // first pointer resumes audio
    const resumeAudio = () => { sfx.init(); window.removeEventListener("pointerdown", resumeAudio); };
    window.addEventListener("pointerdown", resumeAudio);

    // mute pill state
    sfx.muted = store.state.muted;

    this.booted = true;

    // route to first screen
    if (!store.state.ageVerified) {
      this.go("ageGate");
    } else if (!store.state.seenOnboarding) {
      this.go("onboarding");
    } else {
      this.go("lobby");
    }
  }

  _resize() {
    if (!this.pixiApp) return;
    this.pixiApp.renderer.resize(window.innerWidth, window.innerHeight);
    if (this.screen && this.router[this.screen]?.onResize) {
      this.router[this.screen].onResize();
    }
  }

  register(name, screen) {
    this.router[name] = screen;
  }

  async go(name, opts = {}) {
    // cleanup current
    if (this.cleanup) { try { this.cleanup(); } catch(e){} this.cleanup = null; }
    if (this.currentGameInstance) {
      try { this.currentGameInstance.destroy?.(); } catch(e){}
      this.currentGameInstance = null;
      this.currentGame = null;
    }
    this.screen = name;
    const sc = this.router[name];
    if (!sc) { console.warn("no screen:", name); return; }
    // clear stage
    this.pixiApp.stage.removeChildren();
    // re-add FX layer so it stays on top
    initFX(this.pixiApp);
    // render new screen
    await sc.render(this.pixiApp, this, opts);
    if (sc.cleanup) this.cleanup = sc.cleanup;
  }

  async openGame(id) {
    const game = GAMES.find(g => g.id === id);
    if (!game) return;
    if (game.wave > 1 && !store.state.unlockedGames.includes(id)) {
      toast(this.pixiApp, t("toast.gameLocked", { n: game.wave }));
      return;
    }
    if (game.wave === 1 && !store.state.unlockedGames.includes(id)) {
      store.unlockGame(id);
    }
    // dynamic import the game module
    try {
      const mod = await import(`../games/${id}.js`);
      this.currentGame = id;
      this.currentGameInstance = mod;
      await this.go("game", { gameId:id, module:mod });
    } catch (e) {
      console.error("failed to load game", id, e);
      toast(this.pixiApp, "Game failed to load. The Den is sorry.");
    }
  }

  backToLobby() {
    this.go("lobby");
  }
}

export const app = new App();

// PHASE 1: device tier detection — Pixel 7 Pro = high, Galaxy A26 = mid, old phones = low
function detectDeviceTier() {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  if (!isMobile) return "desktop";

  // Hardware concurrency (CPU cores)
  const cores = navigator.hardwareConcurrency || 4;
  // Device memory (GB) — Chrome-only, but covers Android
  const memory = navigator.deviceMemory || 4;

  // High-end: Pixel 7 Pro, iPhone 13+, recent Galaxy S — 8+ cores, 6+ GB
  // Mid: Galaxy A26, Pixel 5a, iPhone 11 — 6-8 cores, 4-6 GB
  // Low: older devices — <6 cores or <4 GB
  if (cores >= 8 && memory >= 6) return "high";
  if (cores >= 6 && memory >= 4) return "mid";
  return "low";
}

// PHASE 1: test WebGL support — if software-rendered (SwiftShader), Canvas2D is often faster
function testWebGLSupport() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return false;
    // Get renderer string — if it mentions "SwiftShader" or "software", WebGL is software-rendered
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
      if (/swiftshader|software|llvmpipe/i.test(renderer)) {
        console.info("[App] WebGL is software-rendered, using Canvas2D fallback");
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

