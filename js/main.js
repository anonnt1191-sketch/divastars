// main.js — entry point. Bootstraps PixiJS app, registers screens, starts the app.
import { app } from "./core/app.js";
import { store } from "./core/store.js";
import { sfx } from "./core/sfx.js";
import { GAMES } from "./data/games-registry.js";
import { loadLang } from "./core/i18n.js";

// register screens
import { render as ageGateRender } from "./screens/ageGate.js";
import { render as onboardingRender } from "./screens/onboarding.js";
import { render as lobbyRender } from "./screens/lobby.js";
import { render as memoryBookRender } from "./screens/memoryBook.js";
import { render as guideRender } from "./screens/guide.js";
import { render as gameHostRender } from "./screens/gameHost.js";

app.register("ageGate",     { render: ageGateRender });
app.register("onboarding",  { render: onboardingRender });
app.register("lobby",       { render: lobbyRender });
app.register("memoryBook",  { render: memoryBookRender });
app.register("guide",       { render: guideRender });
app.register("game",        { render: gameHostRender });

// boot
(async () => {
  try {
    await app.boot();
  } catch (e) {
    console.error("boot failed", e);
    document.body.innerHTML = `<div style="color:#ff5d5d;font-family:sans-serif;text-align:center;padding:40vh 20px">Boot failed: ${e.message}</div>`;
  }
})();
