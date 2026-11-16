// games/spaceman.js — REDESIGNED Phase 3: Swipe Right (Tinder dating game).
// Diva photo + flirty one-liner appears. Swipe right = MATCH, swipe left = PASS.
// Each correct match builds combo streak (x1 → x1.5 → x2 → x3 → x5...).
// Swipe right on a diva who's "not feeling it" = streak resets + lose 0.5x bet.
// 10 divas per round. Cash out the streak anytime.

import { t } from "../core/i18n.js";
import { store } from "../core/store.js";
import { sfx } from "../core/sfx.js";
import { SESSION } from "../core/session.js";
import { CAST_LIST } from "../core/app.js";
import { castPick, castToPhotoURL } from "../core/photos.js";

const FLIRTY_LINES = [
  "You look like trouble. I'm into trouble.",
  "I'd share my momos with you. That's huge.",
  "Swipe right and I'll let you buy me a drink.",
  "My ex hated this dress. That's why I wear it.",
  "I'm not saying I'm your type, but I'm everyone's type.",
  "If you make me laugh, I'll make you blush.",
  "Late night texter. Questionable decisions. Worth it.",
  "I'd ditch the group chat for you. Maybe.",
  "My toxic trait? I'd ghost you and feel nothing. But for you? Maybe I'd text back.",
  "I'm not here for a long time. I'm here for a good time. And snacks.",
  "Swipe right if you can keep up. I'm a lot.",
  "I'd let you pick the restaurant. Once. Don't get used to it.",
  "My red flags are designer. Want to see the collection?",
  "I'd crash a wedding for you. Not my own. Yet.",
  "I'm the kind of trouble you write songs about.",
  "I'd call you at 2am. You'd answer. We both know it."
];

const PASS_LINES = [
  "I'm happily taken. By chaos. Sorry.",
  "You're cute but I'm in my villain era.",
  "I don't date. I collect stories. You'd be a short one.",
  "My standards are unreasonable and I'm keeping them that way.",
  "I'd swipe right but I have a policy against good decisions.",
  "Hard pass. Nothing personal. Just vibes.",
  "I'm not feeling it. The vibes are off. The vibes know.",
  "You seem nice. I'm not into nice. Good luck out there."
];

const COMBO_MULTS = [1, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 15];

export async function mount(host) {
  const { pixiApp, stage, width: W, height: stageH, game } = host;
  const H = stageH;
  const c = new PIXI.Container();
  stage.addChild(c);

  // bg — soft pink/purple gradient (dating app vibes)
  const bg = new PIXI.Graphics();
  bg.beginFill(0x1a0a1a, 0.75).drawRect(0, 0, W, H).endFill();
  for (let i = 0; i < H; i += 4) {
    const t = i / H;
    const r = Math.round(0x1a + (0x3a - 0x1a) * t);
    const g = Math.round(0x0a + (0x1a - 0x0a) * t);
    const b = Math.round(0x1a + (0x3a - 0x1a) * t);
    bg.beginFill((r<<16)|(g<<8)|b).drawRect(0, i, W, 4).endFill();
  }
  c.addChild(bg);

  const tagline = new PIXI.Text("Swipe right to match. Build the streak. Cash out before you fumble.", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontStyle: "italic", fill: 0xff2e88, align: "center",
    wordWrap: true, wordWrapWidth: W - 16
  });
  tagline.anchor.set(0.5, 0); tagline.x = W/2; tagline.y = 6;
  c.addChild(tagline);

  // diva card (Tinder-style)
  const cardW = W - 32;
  const cardH = Math.min(H - 280, 380);
  const cardX = 16;
  const cardY = 40;
  const cardContainer = new PIXI.Container();
  cardContainer.x = cardX; cardContainer.y = cardY;
  c.addChild(cardContainer);

  // combo display
  const comboText = new PIXI.Text("Streak: 0 · Mult: 1.00x", {
    fontFamily: "Outfit, sans-serif", fontSize: 18, fontWeight: "900", fill: 0xff2e88,
    stroke: 0x160b20, strokeThickness: 3, align: "center"
  });
  comboText.anchor.set(0.5, 0); comboText.x = W/2; comboText.y = cardY + cardH + 12;
  c.addChild(comboText);

  // counter (divas remaining)
  const counterText = new PIXI.Text("0 / 10", {
    fontFamily: "Outfit, sans-serif", fontSize: 13, fontWeight: "600", fill: 0xffe9b8
  });
  counterText.x = 12; counterText.y = cardY + cardH + 38;
  c.addChild(counterText);

  // result text (transient)
  const resultText = new PIXI.Text("", {
    fontFamily: "Outfit, sans-serif", fontSize: 14, fontWeight: "900", fill: 0xffe9b8,
    stroke: 0x160b20, strokeThickness: 3, align: "center"
  });
  resultText.anchor.set(1, 0); resultText.x = W - 12; resultText.y = cardY + cardH + 38;
  c.addChild(resultText);

  // swipe buttons
  const btnW = (W - 32) / 3;
  const btnY = H - 60;

  const passBtn = new PIXI.Container();
  passBtn.x = 8; passBtn.y = btnY;
  const passBg = new PIXI.Graphics();
  passBg.beginFill(0xff5d5d).drawRoundedRect(0, 0, btnW, 50, 25).endFill();
  passBtn.addChild(passBg);
  const passTx = new PIXI.Text("✕ PASS", {fontFamily:"Outfit",fontSize:18,fontWeight:"900",fill:0xffffff});
  passTx.anchor.set(0.5); passTx.x = btnW/2; passTx.y = 25;
  passBtn.addChild(passTx);
  passBtn.interactive = true; passBtn.buttonMode = true;
  c.addChild(passBtn);

  const cashOutBtn = new PIXI.Container();
  cashOutBtn.x = 8 + btnW + 8; cashOutBtn.y = btnY;
  const coBg = new PIXI.Graphics();
  coBg.beginFill(0x9d4edd).drawRoundedRect(0, 0, btnW, 50, 25).endFill();
  cashOutBtn.addChild(coBg);
  const coTx = new PIXI.Text("CASH OUT", {fontFamily:"Outfit",fontSize:14,fontWeight:"900",fill:0xffffff});
  coTx.anchor.set(0.5); coTx.x = btnW/2; coTx.y = 25;
  cashOutBtn.addChild(coTx);
  cashOutBtn.interactive = true; cashOutBtn.buttonMode = true;
  c.addChild(cashOutBtn);

  const matchBtn = new PIXI.Container();
  matchBtn.x = 8 + (btnW + 8)*2; matchBtn.y = btnY;
  const matchBg = new PIXI.Graphics();
  matchBg.beginFill(0x57d38f).drawRoundedRect(0, 0, btnW, 50, 25).endFill();
  matchBtn.addChild(matchBg);
  const matchTx = new PIXI.Text("♥ MATCH", {fontFamily:"Outfit",fontSize:18,fontWeight:"900",fill:0xffffff});
  matchTx.anchor.set(0.5); matchTx.x = btnW/2; matchTx.y = 25;
  matchBtn.addChild(matchTx);
  matchBtn.interactive = true; matchBtn.buttonMode = true;
  c.addChild(matchBtn);

  // state
  let curBet = 25;
  let active = false;
  let divas = [];  // {cast, line, feelingIt}
  let curIdx = 0;
  let streak = 0;
  let streakMult = 1.0;
  let matchCount = 0;

  function buildRound() {
    const used = new Set();
    divas = [];
    for (let i = 0; i < 10; i++) {
      const cast = castPick(CAST_LIST, used);
      used.add(cast.key);
      const feelingIt = Math.random() < 0.65;  // 65% are feeling it
      const line = feelingIt
        ? FLIRTY_LINES[Math.floor(Math.random() * FLIRTY_LINES.length)]
        : PASS_LINES[Math.floor(Math.random() * PASS_LINES.length)];
      divas.push({ cast, line, feelingIt });
    }
  }

  async function showCard(idx) {
    cardContainer.removeChildren();
    if (idx >= divas.length) {
      // round end — auto cash out
      finishRound(true);
      return;
    }
    const d = divas[idx];
    // card bg
    const cardBg = new PIXI.Graphics();
    cardBg.lineStyle(2, 0xff2e88, 0.4).beginFill(0x2a1a2a).drawRoundedRect(0, 0, cardW, cardH, 16).endFill();
    cardContainer.addChild(cardBg);
    // diva photo (contain-fit with backdrop)
    const photoH = cardH - 80;
    const url = castToPhotoURL(d.cast);
    try {
      const tex = await PIXI.Assets.load(url);
      if (tex && !cardContainer.destroyed) {
        // backdrop
        const backdrop = new PIXI.Sprite(tex);
        const bgScale = Math.max(cardW/tex.width, photoH/tex.height);
        backdrop.scale.set(bgScale);
        backdrop.x = (cardW - tex.width*bgScale)/2;
        backdrop.y = (photoH - tex.height*bgScale)/2;
        backdrop.alpha = 0.3;
        const bgMask = new PIXI.Graphics();
        bgMask.beginFill(0xffffff).drawRoundedRect(0, 0, cardW, photoH, 16).endFill();
        cardContainer.addChild(bgMask);
        backdrop.mask = bgMask;
        cardContainer.addChild(backdrop);
        // foreground contain
        const sp = new PIXI.Sprite(tex);
        const scale = Math.min(cardW/tex.width, photoH/tex.height);
        sp.scale.set(scale);
        sp.x = (cardW - tex.width*scale)/2;
        sp.y = (photoH - tex.height*scale)/2;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff).drawRoundedRect(0, 0, cardW, photoH, 16).endFill();
        cardContainer.addChild(mask);
        sp.mask = mask;
        cardContainer.addChild(sp);
      }
    } catch(e) {}
    // diva name
    const nameTx = new PIXI.Text(d.cast.name, {
      fontFamily: "Playfair Display, Georgia, serif",
      fontSize: 22, fontStyle: "italic", fontWeight: "700", fill: 0xffe9b8, align: "center"
    });
    nameTx.anchor.set(0.5, 0); nameTx.x = cardW/2; nameTx.y = photoH + 6;
    cardContainer.addChild(nameTx);
    // flirty line
    const lineTx = new PIXI.Text(`"${d.line}"`, {
      fontFamily: "Outfit, sans-serif", fontSize: 13, fontStyle: "italic", fill: 0xff2e88, align: "center",
      wordWrap: true, wordWrapWidth: cardW - 16
    });
    lineTx.anchor.set(0.5, 0); lineTx.x = cardW/2; lineTx.y = photoH + 32;
    cardContainer.addChild(lineTx);

    counterText.text = `${idx + 1} / 10`;
  }

  function startRound() {
    if (!store.bet(curBet)) { host.toast(t("toast.betTooHigh")); return; }
    active = true;
    streak = 0;
    streakMult = 1.0;
    matchCount = 0;
    curIdx = 0;
    buildRound();
    comboText.text = "Streak: 0 · Mult: 1.00x";
    resultText.text = "";
    showCard(0);
    sfx.whoosh();
  }

  function swipe(matched) {
    if (!active || curIdx >= divas.length) return;
    sfx.click();
    const d = divas[curIdx];
    if (matched) {
      if (d.feelingIt) {
        // correct match
        streak++;
        matchCount++;
        streakMult = COMBO_MULTS[Math.min(streak, COMBO_MULTS.length - 1)];
        sfx.pop();
        resultText.text = `MATCH! streak ${streak} · ${streakMult}x`;
        resultText.style.fill = 0x57d38f;
      } else {
        // wrong match — she wasn't feeling it
        streak = 0;
        streakMult = 1.0;
        sfx.lose();
        resultText.text = "FUMBLED · streak reset";
        resultText.style.fill = 0xff5d5d;
        // lose 0.5x bet
        const loss = Math.floor(curBet * 0.5);
        store.bet(loss);
      }
    } else {
      // pass — always safe
      sfx.tick();
      resultText.text = "passed";
      resultText.style.fill = 0xb0b0b0;
    }
    comboText.text = `Streak: ${streak} · Mult: ${streakMult.toFixed(2)}x`;
    curIdx++;
    setTimeout(() => showCard(curIdx), 600);
  }

  function cashOut() {
    if (!active || streak === 0) return;
    finishRound(false);
  }

  function finishRound(autoCash) {
    if (!active) return;
    active = false;
    const win = Math.floor(curBet * streakMult);
    if (win > 0) {
      store.pay(win);
      store.record(game.id, curBet, win);
      sfx.win();
      const tier = streakMult >= 10 ? "mega" : streakMult >= 5 ? "big" : "win";
      host.onWin(tier, win, {
        title: streakMult.toFixed(2) + "x · " + streak + " matches",
        line: autoCash ? "Round complete." : "Cashed out before the fumble."
      });
      resultText.text = `+${win} chips`;
      resultText.style.fill = 0xffe9b8;
    } else {
      store.record(game.id, curBet, 0);
      sfx.lose();
      resultText.text = "No streak. Lost bet.";
      resultText.style.fill = 0xff5d5d;
    }
    // offer new round
    setTimeout(() => {
      cardContainer.removeChildren();
      const newRoundTx = new PIXI.Text("Tap MATCH to start a new round", {
        fontFamily: "Outfit, sans-serif", fontSize: 14, fontStyle: "italic", fill: 0xb0b0b0, align: "center"
      });
      newRoundTx.anchor.set(0.5, 0.5); newRoundTx.x = cardW/2; newRoundTx.y = cardH/2;
      cardContainer.addChild(newRoundTx);
    }, 2000);
  }

  // bet row
  const betRow = host.betRow(curBet);
  betRow.x = 8; betRow.y = H - 110;
  c.addChild(betRow);
  betRow.children.forEach((p, i) => p.on("pointertap", () => { curBet = [10, 25, 50, 100, 250][i]; }));

  passBtn.on("pointertap", () => swipe(false));
  matchBtn.on("pointertap", () => {
    if (!active) startRound();
    else swipe(true);
  });
  cashOutBtn.on("pointertap", cashOut);

  // initial state — show "tap to start"
  showCard(0);
  active = false;
  curIdx = 0;

  const tickerFn = () => {};
  pixiApp.ticker.add(tickerFn);
  return () => pixiApp.ticker.remove(tickerFn);
}
