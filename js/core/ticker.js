// core/ticker.js — PHASE 4: continuous horizontal scrolling marquee.
// Uses TWO text objects that swap positions for a seamless infinite scroll.
// Rotates through R-adjacent sensual inside jokes, sassy commentary, and diva callouts.

const TICKER_LINES = [
  "Vedhika's watching. She always is.",
  "Kallie brought the chaos. Again. We're not fixing it.",
  "The Ex tried to crash. We bounced her. Twice.",
  "Sunita's lehenga count: 47 and rising.",
  "Late night texters anonymous. Meeting at the Den.",
  "Ann knows the bouncer. Don't ask how.",
  "Group chat unread: 412. All of them fire.",
  "Dwiza saw your luck. It's hers now. And your outfit.",
  "Momos > men. Always.",
  "Pinky's section has a rope. The rope has a name.",
  "Nitz mirror selfie incoming. Brace yourself.",
  "Garima ordered bottle service. For two. Guess who.",
  "Shalini's been on the floor since soundcheck.",
  "Riddhima clashing tonight. Pink, gold, leopard. On purpose.",
  "The Den is open. The girls are restless.",
  "Soumya's red-dot-dot-dot. Always center.",
  "Priyanka has the math. You don't.",
  "Sarita's laugh audible from the parking lot. Bring earplugs.",
  "Kanchan brought the whole squad. Obviously.",
  "Shreya just posted this. Already viral.",
  "Tara's PhD in window shopping continues.",
  "Babita auntie-networked her way backstage. Again.",
  "Elisha hugs like a final boss. Don't let go.",
  "Kritika's bikini payback is loading. Patience.",
  "Laxmi is ringside at every drama. Front row.",
  "Manisha is the group admin. Absolute power.",
  "Meera's eyeliner sharp enough to cut. Don't blink.",
  "Nandini runs the bridal jhamela. Don't question.",
  "Rekha prime-time heroine energy. Daily.",
  "Sunila is the cardi B of the mela.",
  "Trishna streaks: 400 and counting.",
  "The Ex left you on read. We don't.",
  "Kamala smells like fresh momos. We don't ask whose.",
  "Karishma parallel-parked on the first try. We clapped.",
  "Kavya wrote a caption. We felt it.",
  "Kiran glows harder than the lights. Suspicious.",
  "Bhawana cried at a proposal video. Hers.",
  "Bipana has three lip shades minimum. Daily.",
  "Bijuli = human lightning bolt. Approach with caution.",
  "Damini argues like a supreme court. She wins.",
  "Dipti dramatic gasp champion. Three years running.",
  "Esha speaks fluent sarcasm. Conversations optional.",
  "Fulmati village legend. City attitude.",
  "Gauri grandma's favourite. She knows it.",
  "Hasana has a shrine for her scooty. Seriously.",
  "Indira eldest daughter energy. Unstoppable.",
  "Ishita one more episode syndrome. It's 4am.",
  "Jamuna remembers everyone's business. Everyone's.",
  "Jharana dances like the floor owes rent.",
  "Jyoti's laugh heard three streets away. We measured.",
  "Kabita's credit card sees her coming. It trembles.",
  "Khusi is marigold in human form. We're softer for it.",
  "Luna sleeps 14h. Still radiant. Infuriating.",
  "Maya writes poetry without the performance. We listen anyway.",
  "Melina camera eats first. Always. Move.",
  "Mohini enchantress of the last bus. Don't miss it.",
  "Nabanita zero chill since birth. None.",
  "Nirmala tidy desk, chaotic soul. Iconic.",
  "Nisha the responsible one (allegedly). Allegedly.",
  "Ojaswi manifests front-row seats. The universe complies.",
  "Oshin soft heart, steel spine. Don't test.",
  "Prerana cheers louder than the DJ. The DJ noticed.",
  "Puja pays in exact change. Wins in style.",
  "Ragini could sell ice to Kathmandu. We bought some.",
  "Rojina catches feelings and flights. Same speed.",
  "Sangita sings only in the shower. Loudly.",
  "Shefali sunflower in sneaker form. We smile.",
  "Smriti third espresso and a dream. Same.",
  "Sujata sunrise summit crusher. We're tired watching.",
  "Ujjwala sunscreen is her religion. Convert.",
  "The Den: where every diva shows up. As she should."
];

export function createTicker(app, parent, opts = {}) {
  const W = app.screen.width;
  const h = opts.height ?? 30;
  const y = opts.y ?? 0;
  const speed = opts.speed ?? 0.6;
  const fontSize = opts.fontSize ?? 13;
  const bgColor = opts.bgColor ?? 0x160b20;
  const textColor = opts.textColor ?? 0xff2e88;
  const accentColor = opts.accentColor ?? 0xf2c76e;

  const container = new PIXI.Container();
  container.x = 0;
  container.y = y;
  parent.addChild(container);

  // bg strip
  const bg = new PIXI.Graphics();
  bg.beginFill(bgColor).drawRect(0, 0, W, h).endFill();
  bg.beginFill(accentColor, 0.5).drawRect(0, 0, W, 1).endFill();
  bg.beginFill(accentColor, 0.5).drawRect(0, h-1, W, 1).endFill();
  container.addChild(bg);

  // joined text (single copy, not duplicated — keeps width manageable)
  const joined = TICKER_LINES.join("   ◆   ");

  // "VEDHIKA'S DEN" prefix badge (static, on the left)
  const prefixW = 130;
  const prefixBg = new PIXI.Graphics();
  prefixBg.beginFill(accentColor).drawRoundedRect(0, 2, prefixW, h-4, 6).endFill();
  container.addChild(prefixBg);
  const prefixTx = new PIXI.Text("✦ VEDHIKA'S DEN", {
    fontFamily: "Outfit, sans-serif",
    fontSize: fontSize - 1,
    fontWeight: "900",
    fill: 0x160b20
  });
  prefixTx.x = 8;
  prefixTx.y = (h - prefixTx.height) / 2;
  container.addChild(prefixTx);

  // scroll area starts after the prefix badge
  const scrollStart = prefixW + 8;
  const scrollW = W - scrollStart;

  // PHASE 4: use a clipping container with MANY small Text objects (one per line)
  // instead of one giant text. Browsers cap canvas width at ~8192px, so a single
  // 22000px-wide Text renders blank. Splitting per-line keeps each Text < 1000px.
  const scrollClip = new PIXI.Container();
  scrollClip.x = scrollStart;
  scrollClip.y = 0;
  const clipMask = new PIXI.Graphics();
  clipMask.beginFill(0xffffff).drawRect(0, 0, scrollW, h).endFill();
  scrollClip.addChild(clipMask);
  scrollClip.mask = clipMask;
  container.addChild(scrollClip);

  // Build per-line text objects with diamond separators between them
  const textStyle = {
    fontFamily: "Outfit, sans-serif",
    fontSize: fontSize,
    fontWeight: "600",
    fontStyle: "italic",
    fill: textColor,
    align: "left"
  };
  const sepStyle = { ...textStyle, fill: accentColor };

  // Build a sequence: line1, "◆", line2, "◆", ... lineN, "◆" (loop back to line1)
  // Two copies for seamless infinite scroll.
  const segments1 = [];  // array of {text, width, x}
  const segments2 = [];
  let cursor1 = 0, cursor2 = 0;

  function buildSegments(target) {
    const segs = [];
    let x = 0;
    for (let i = 0; i < TICKER_LINES.length; i++) {
      const t = new PIXI.Text(TICKER_LINES[i], textStyle);
      t.y = (h - t.height) / 2;
      t.x = x;
      target.addChild(t);
      segs.push({ text: t, x });
      x += t.width + 12;
      // separator
      const sep = new PIXI.Text("◆", sepStyle);
      sep.y = (h - sep.height) / 2;
      sep.x = x;
      target.addChild(sep);
      segs.push({ text: sep, x });
      x += sep.width + 12;
    }
    return { segs, totalW: x };
  }

  const group1 = new PIXI.Container();
  scrollClip.addChild(group1);
  const r1 = buildSegments(group1);

  const group2 = new PIXI.Container();
  group2.x = r1.totalW;
  scrollClip.addChild(group2);
  const r2 = buildSegments(group2);

  const gap = 0;  // already accounted for in segment spacing

  const tickerFn = (dt) => {
    group1.x -= speed * dt;
    group2.x -= speed * dt;
    if (group1.x + r1.totalW < 0) {
      group1.x = group2.x + r2.totalW;
    }
    if (group2.x + r2.totalW < 0) {
      group2.x = group1.x + r1.totalW;
    }
  };
  app.ticker.add(tickerFn);

  return {
    container,
    destroy: () => {
      app.ticker.remove(tickerFn);
      if (container.parent) container.parent.removeChild(container);
      container.destroy({ children: true });
    }
  };
}
