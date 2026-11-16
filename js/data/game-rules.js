// data/game-rules.js — PHASE 6: Rules + payouts + R-adjacent flavor text for all 50 games.
// Used by the Central Guide screen. Each entry: {id, name, category, rules[], payouts, flavor}.

export const GAME_RULES = {
  // === WAVE 1 — FOUNDATION ===
  "cash-me": {
    category: "Crash",
    rules: [
      "Place your bet to start the cash printer.",
      "Multiplier auto-ticks up: +0.15x per second (baseline).",
      "Tap CRANK to boost +0.1x per crank — but each crank has a 5% jam chance.",
      "Tap CASH OUT anytime to bank bet × current multiplier.",
      "If the machine jams (auto or via crank), you lose your bet."
    ],
    payouts: "1.00x → ~50x (typical jam point: 1.5x–8x). CRANK bonus: +0.1x per tap.",
    flavor: "Vedhika's cashier runs the printer. She's been at this all night. Don't keep her waiting — but don't cash out too early either. She judges."
  },
  "floor-slots": {
    category: "Slot · Roguelike",
    rules: [
      "Spin the 3-reel slot to score chips toward each floor's target.",
      "12 spins per floor. Hit the target before spins run out.",
      "Between floors: hire divas in the shop (each has her own rule), buy vibes, or skip.",
      "Bosses crash floors with quirks: The Flaker (reels flake), Noise Complaint (respins cost double), The Ex (strongest friend storms off), Rent Day (spins cost 2).",
      "Clear all 5 floors → DEN CONQUERED + 5000 chip bonus.",
      "Every chip earned converts to Den chips at run end."
    ],
    payouts: "Per diva: base score + special rule bonus. Pairs +4, Triples +10. Floor bonus = floor_score chips.",
    flavor: "The original. The reason the Den exists. Vedhika wrote this one herself — every floor is a memory, every boss is someone she's survived."
  },
  "plinko": {
    category: "Instant",
    rules: [
      "Pick risk level: LOW (x0.4–x9), MED (x0.3–x22), HIGH (x0.2–x170).",
      "Tap DROP to release a chip through 10 peg rows.",
      "Chip bounces 50/50 left/right at each peg.",
      "Lands in one of 11 photo buckets — each bucket has a multiplier.",
      "Edges pay the dreams. Middle quietly eats your chips."
    ],
    payouts: "Bet × bucket multiplier (LOW: 0.4x–9x · MED: 0.3x–22x · HIGH: 0.2x–170x).",
    flavor: "The divas at the edges are the rare ones. They know they're rare. They're not making it easy."
  },
  "wheel": {
    category: "Game Show",
    rules: [
      "24-segment photo wheel. Each segment has a diva photo + multiplier (x1 to x25).",
      "Pick your bet, tap SPIN.",
      "Wheel spins for 5 seconds with cubic ease-out deceleration.",
      "Pointer lands on a segment → win = bet × that segment's multiplier.",
      "After spin, the winning diva's photo enlarges in the center hub with a gold ring."
    ],
    payouts: "Bet × landed multiplier (x1, x1.5, x2, x2.5, x3, x4, x5, x6, x8, x10, x15, x20, x25).",
    flavor: "24 divas, 24 chances. The wheel knows who you're hoping for. It rarely lands on her. That's the joke."
  },
  "mines": {
    category: "Instant",
    rules: [
      "5×5 grid of photo tiles. Pick 3, 5, or 10 Exes hidden underneath.",
      "Tap tiles to reveal divas. Each safe reveal raises your multiplier.",
      "Cash out anytime — bank bet × current multiplier.",
      "Hit The Ex → round ends, lose your bet.",
      "With 5 Exes: first reveal already pays x1.14."
    ],
    payouts: "Multiplier = (25 ÷ (25 - exCount))^revealed × 0.97 (house edge). Cash out anytime.",
    flavor: "The Ex is buried under every grid. She always wins eventually. The question is whether you cash out before she finds you."
  },
  "archery": {
    category: "Arcade",
    rules: [
      "A diva photo is the target. A power meter sweeps left-right at the bottom.",
      "Tap RELEASE when the meter is in the pink bullseye zone (center).",
      "Bullseye = x8, inner ring = x2, outer ring = x0.6, miss = 0.",
      "New diva target every shot."
    ],
    payouts: "Bet × ring multiplier (0x / 0.6x / 2x / 8x).",
    flavor: "Steady hands, steady nerves. The diva is watching your aim. She's judging. She always is."
  },
  "reel-rush": {
    category: "Slot",
    rules: [
      "5×3 photo slot, 10 fixed paylines (left-to-right).",
      "Dwiza = WILD (substitutes any symbol, ~4% spawn).",
      "Riddhima = MULT (random x2 to x1000 when she lands, ~2% spawn).",
      "Vedhika = SCATTER (3+ on middle reels → 10 free spins, 4+ → 12 free spins, all wins x2).",
      "Bonus buy: 19× bet buys 10 free spins instantly.",
      "Other 14 symbols = rotating divas (faces reshuffle each session, pays never change)."
    ],
    payouts: "3 matches = x3, 4 = x10, 5 = x50 (× bet per payline). Mult symbol can multiply wins up to x1000.",
    flavor: "Dwiza takes. Riddhika multiplies. Vedhika approves. The other 14 are just here for the photo op."
  },

  // === WAVE 2 — CRASH ===
  "jetx": {
    category: "Crash",
    rules: [
      "Place bet, tap to start.",
      "Multiplier rises exponentially. Photo pilot flies upward.",
      "Tap CASH OUT before the pilot bails.",
      "If pilot bails → lose bet.",
      "Classic orange-themed crash."
    ],
    payouts: "Bet × multiplier at cash-out (1.00x → ~100x).",
    flavor: "She's flying. You're hoping. She bails when she bails. The house always knows when."
  },
  "spaceman": {
    category: "Originals · Dating",
    rules: [
      "10 divas appear one at a time with photo + flirty one-liner.",
      "65% are 'feeling it' (will match). 35% aren't (will fumble you).",
      "MATCH (♥): if she's feeling it → combo++ (x1 → x1.5 → x2 → x2.5 → x3 → x4 → x5 → x7 → x10 → x15). If not → streak resets + lose 0.5× bet.",
      "PASS (✕): safe, no gain no loss.",
      "CASH OUT: bank the streak anytime before the 10th diva.",
      "Round ends after 10 divas (auto cash out)."
    ],
    payouts: "Bet × combo multiplier at cash-out (1x to 15x). Wrong match costs 0.5× bet.",
    flavor: "Tinder but the divas have opinions. Some are feeling it. Some aren't. You have to read the vibe. The vibe knows."
  },
  "diva-jet": {
    category: "Originals · Dare",
    rules: [
      "4 divas sit at the table, each with hidden stats (chaos, drama, flirt, loyalty).",
      "A dare card appears (e.g., 'Who calls their ex at 2am?', 'Who would gatecrash a wedding?').",
      "Each diva has live odds (1.5x favorite to 8x longshot) based on how well her stats match the dare.",
      "Tap a diva to pick, then RESOLVE DARE.",
      "Winner is weighted-random based on stats. Gold ring highlights the winner.",
      "5 dares per round. Win = bet × your diva's odds if she accepts."
    ],
    payouts: "Bet × picked diva's odds (1.5x to 8x) if she accepts the dare. Otherwise lose bet.",
    flavor: "Truth or dare but the truth is already known. The dare is whether you can guess who's chaotic enough to do it."
  },

  // === WAVE 2 — TABLE & CARDS ===
  "roulette": {
    category: "Table · Wheel",
    rules: [
      "European roulette, 37 pockets (0-36).",
      "Green zero = The Ex. Other 36 pockets wear diva faces (reshuffle each session).",
      "Bets: RED/BLACK (x2), ODD/EVEN (x2), LOW (1-18) / HIGH (19-36) (x2), DOZENS 1-12/13-24/25-36 (x3), COLUMNS (x3), STRAIGHT UP single number (x35).",
      "Tap any cell to add bet. CLEAR refunds all placed bets.",
      "Wheel spins clockwise, ball orbits counter-clockwise."
    ],
    payouts: "Straight up: x35. Dozens/Columns: x3. Red/Black/Odd/Even/Low/High: x2.",
    flavor: "The Ex owns the green zero. She always wins. The other 36 divas take turns. Re-read the board when you sit down."
  },
  "blackjack": {
    category: "Table · Cards",
    rules: [
      "Standard 3:2 blackjack. Dealer stands on 17.",
      "HIT, STAND, or DOUBLE (doubles stake for exactly one more card).",
      "Blackjack (A + 10/J/Q/K on first 2 cards) pays 3:2.",
      "Push returns bet.",
      "Side bet — Squad Perfect: first 2 cards paired pays x10, suited pair pays x20.",
      "J=Shreya, Q=Kajal, K=Soumya, A=Vedhika (court cards). Number cards reshuffle each session."
    ],
    payouts: "Win: 1:1. Blackjack: 3:2. Squad Perfect: x10 (pair) / x20 (suited pair).",
    flavor: "Different diva deals every hand. Some are merciful. Some aren't. The deck knows the difference."
  },
  "teen-patti": {
    category: "Table · Cards · Indian",
    rules: [
      "Indian 3-card poker. Boot (ante) is the bet.",
      "Both player and dealer get 3 cards.",
      "SEE: pay 2× boot to see cards before deciding (otherwise play blind at 1×).",
      "PLAY (call equal to boot) or FOLD.",
      "Showdown: compare 3-card hands.",
      "Side bet — Pair Plus: pair x1, flush x3, sequence x6, pure sequence x12, trio x30, trio of aces x50."
    ],
    payouts: "Trio > Pure Sequence > Sequence > Color > Pair > High Card. Win returns boot + call + equal. Tie returns boot.",
    flavor: "The Indian classic. The dealer is a diva. She knows your hand before you do. She's polite about it."
  },
  "call-break": {
    category: "Table · Cards · Nepali",
    rules: [
      "4 players (you + 3 AI divas). 5 cards each. Spades are trump.",
      "Before play: each player calls how many tricks they'll win (1-5).",
      "Player to left of dealer leads. Must follow suit if possible; if void, anything goes.",
      "Highest card of led suit wins, unless trumped — then highest trump wins.",
      "Trick winner leads next.",
      "Scoring: exact call = +call. Overtrick = +call + 0.1 each. Undertrick = -call.",
      "Payout: outright win → bet×3. Tie → bet×1.5. Lose → forfeit bet."
    ],
    payouts: "Outright win: 3x. Tie: 1.5x. Lose: 0x.",
    flavor: "The Nepali classic. Three diva AI opponents, each with her own personality. Kallie bluffs. Ann plays value. Priyanka overthinks. Read them."
  },
  "andar-bahar": {
    category: "Table · Cards · Indian",
    rules: [
      "A joker card is dealt face up.",
      "Bet ANDAR (inside) or BAHAR (outside).",
      "Cards dealt alternately to andar/bahar.",
      "First side to match the joker's rank wins.",
      "Pure luck — no skill, no decisions after the bet."
    ],
    payouts: "Winning side: x1.9. Losing side: 0.",
    flavor: "No skill, no strategy, no mercy. The joker decides. You just pick a side and pray."
  },
  "dragon-tiger": {
    category: "Table · Cards",
    rules: [
      "One card to Dragon, one to Tiger. Higher card wins.",
      "Tie pays x8.",
      "Pick Dragon or Tiger before the deal.",
      "No decisions after — pure comparison."
    ],
    payouts: "Dragon/Tiger win: x2. Tie: x8.",
    flavor: "Two cards. One decision. The divas chose their sides long before you arrived."
  },
  "baccarat": {
    category: "Table · Cards",
    rules: [
      "Bet on PLAYER, BANKER, or TIE.",
      "2 cards each. Card values: A=1, 2-9 face value, 10/J/Q/K=0.",
      "Hand value = sum mod 10.",
      "Natural 8 or 9 = immediate win.",
      "Full Punto Banco drawing rules for non-naturals.",
      "PLAYER wins 1:1. BANKER wins 0.95:1 (5% commission). TIE pays 8:1."
    ],
    payouts: "Player: 1:1. Banker: 0.95:1. Tie: 8:1.",
    flavor: "The high-roller table. The dealer wears gold. The cards know more than they should."
  },
  "sic-bo": {
    category: "Table · Dice",
    rules: [
      "3 dice rolled. Each die wears a diva photo face.",
      "Bets: SMALL (4-10, x1), BIG (11-17, x1), ODD (x1), EVEN (x1), ANY TRIPLE (x8), SPECIFIC TRIPLE (x24), SINGLE DIE (x1-x3).",
      "Triples lose all non-triple bets (house edge)."
    ],
    payouts: "Small/Big/Odd/Even: x1. Any Triple: x8. Specific Triple: x24. Single Die: x1/x2/x3.",
    flavor: "Three dice, three divas, three chances. The Ex is the triple. She shows up when you don't want her."
  },
  "casino-holdem": {
    category: "Table · Poker",
    rules: [
      "Bet ANTE. Get 2 hole cards. Dealer gets 2 face down.",
      "Flop (3 community cards) dealt.",
      "CALL (equal to ANTE) or FOLD.",
      "Turn + River dealt.",
      "Dealer needs pair of 4s or better to qualify.",
      "If dealer doesn't qualify: ANTE pays 1:1, CALL pushes.",
      "Ante Bonus: Straight x1, Trips/SF x4 (or 4K), Royal Flush x100."
    ],
    payouts: "Ante Bonus: Straight x1, SF x4, RF x100. CALL pays 1:1 if player wins.",
    flavor: "Texas Hold'em vs the house. The flop is where hope lives. The river is where it dies."
  },
  "poker-draw": {
    category: "Table · Poker",
    rules: [
      "5-card draw. DEAL five cards face up.",
      "Tap cards to HOLD (highlighted).",
      "DRAW replaces unheld cards.",
      "Paytable (Jacks or Better):",
      "Royal Flush x250, Straight Flush x50, 4 of a Kind x25, Full House x9, Flush x6, Straight x4, 3 of a Kind x3, Two Pair x2, Jacks or Better x1."
    ],
    payouts: "Royal Flush: x250. Straight Flush: x50. 4K: x25. Full House: x9. Flush: x6. Straight: x4. 3K: x3. Two Pair: x2. JoB: x1.",
    flavor: "Hold the right ones. Draw the rest. The divas on the court cards are watching your strategy. They have opinions."
  },
  "war": {
    category: "Table · Cards",
    rules: [
      "Deal 1 card to player, 1 to dealer. Higher card wins.",
      "Tie → WAR: 3 cards burned face down, 1 face up each. Higher wins.",
      "War win pays 3:1. Double tie pays 2:1 (house mercy)."
    ],
    payouts: "Win: 1:1. War win: 3:1. Double tie: 2:1.",
    flavor: "The simplest card game. The divas drew their cards hours ago. You're just finding out now."
  },
  "three-card": {
    category: "Table · Poker",
    rules: [
      "Bet ANTE. Optional PAIR PLUS side bet.",
      "Player gets 3 face up. Dealer gets 3 face down.",
      "PLAY (equal to ANTE) or FOLD.",
      "Dealer needs Q-high or better to qualify.",
      "If dealer doesn't qualify: ANTE pays 1:1, PLAY pushes.",
      "Pair Plus pays regardless: Pair x1, Flush x4, Straight x6, Trips x30, Straight Flush x40, Mini Royal (QKA suited) x50."
    ],
    payouts: "Pair Plus: Pair x1, Flush x4, Straight x6, Trips x30, SF x40, Mini Royal x50.",
    flavor: "Three cards, three chances, three regrets. The dealer qualifies when she feels like it."
  },
  "video-poker": {
    category: "Table · Poker",
    rules: [
      "Same as Squad Poker (5-card draw, Jacks or Better paytable).",
      "Slot-styled with golden marquee.",
      "After any win: DOUBLE OR NOTHING mini-game.",
      "Pick RED or BLACK for the next card. Win = double winnings. Lose = 0.",
      "Up to 5 double-or-nothing rounds."
    ],
    payouts: "Same as Squad Poker. Double-or-Nothing: x2 per correct guess (max 5 rounds = x32).",
    flavor: "Vegas-style. The diva on the screen watches you gamble your winnings. She's seen this end badly before."
  },

  // === WAVE 3 — INSTANT ===
  "hilo": {
    category: "Instant",
    rules: [
      "A photo card is shown. Predict if the next card is HIGHER or LOWER.",
      "Correct: streak++, multiplier × 1.45 per correct call.",
      "Tie: streak alive for free.",
      "Wrong: round ends, lose bet.",
      "Cash out anytime — bank bet × current streak multiplier."
    ],
    payouts: "Bet × (1.45^streak). Cash out anytime.",
    flavor: "Higher or lower. The diva knows. You don't. That's the game."
  },
  "dice": {
    category: "Instant",
    rules: [
      "Slider picks target (1-100).",
      "Roll: random 1-100.",
      "Roll OVER target = win. Roll ≤ target = lose.",
      "Higher target = higher chance, lower payout. Lower target = lower chance, higher payout.",
      "Payout = 100 / (100 - target)."
    ],
    payouts: "Bet × (100 / (100 - target)). Target 50 → x2. Target 95 → x20.",
    flavor: "The dice wear a diva face. She rolls for you. She doesn't always roll well."
  },
  "limbo": {
    category: "Instant",
    rules: [
      "Pick a target multiplier (1.01x to 100x).",
      "A random multiplier is generated.",
      "If result ≥ target: win = bet × target.",
      "If result < target: lose.",
      "Win chance = 0.99 / target (1% house edge)."
    ],
    payouts: "Bet × target multiplier if result ≥ target.",
    flavor: "How low can you go? The lower the target, the safer the bet. The diva knows when to push her luck."
  },
  "keno": {
    category: "Instant",
    rules: [
      "Pick 10 numbers from 1-40.",
      "10 diva photo balls drawn randomly.",
      "Match count pays: 0-2 = 0, 3 = x1, 4 = x2, 5 = x5, 6 = x10, 7 = x25, 8 = x50, 9 = x100, 10 = x500."
    ],
    payouts: "3 matches: x1. 5: x5. 7: x25. 9: x100. 10 (all): x500.",
    flavor: "Pick your numbers. Hope the divas agree. They rarely do. That's why it pays."
  },
  "scratch": {
    category: "Instant",
    rules: [
      "3×3 gold foil grid. Tap cells to scratch.",
      "Match 3 of the same diva to win her printed prize.",
      "35% of cards have a winning combo.",
      "REVEAL ALL button for the impatient.",
      "Prizes: x1.5 to x100."
    ],
    payouts: "Match 3 divas: bet × her prize (x1.5 to x100).",
    flavor: "Gold foil. Hidden divas. The thrill of the scratch. Most cards are duds. The ones that aren't change your night."
  },
  "coin-flip": {
    category: "Instant",
    rules: [
      "Two divas, one coin. Pick HEADS or TAILS.",
      "Coin flips (animated). Lands on one side.",
      "Correct = x1.9. Wrong = 0."
    ],
    payouts: "Win: x1.9. Lose: 0.",
    flavor: "Two divas. One coin. You pick a side. The coin doesn't care about your feelings."
  },

  // === WAVE 3 — GAME SHOWS ===
  "bingo": {
    category: "Game Show",
    rules: [
      "4×4 photo bingo card. 16 unique diva photos.",
      "30 diva balls drawn. Auto-daubing — card marks itself.",
      "Match 1 full row, column, or diagonal to win.",
      "Multiple lines stack: 1 line = x2, 2 = x5, 3 = x10, full card (blackout) = x50."
    ],
    payouts: "1 line: x2. 2 lines: x5. 3 lines: x10. Blackout: x50.",
    flavor: "The aunties' favorite. The divas are the numbers. The caller is chaos. Good luck."
  },
  "crazy-time": {
    category: "Game Show",
    rules: [
      "16-segment wheel: 12 cash segments (x1, x2, x5, x10) + 4 bonus segments.",
      "Bet on a segment value (1, 2, 5, or BONUS).",
      "Wheel spins. Cash land = bet × value (if you bet that value).",
      "Bonus land (BONUS bet only): triggers a mini-game.",
      "4 bonus mini-games: Cash Hunt (pick 1 of 5 photos, x5-x50), Coin Flip (heads/tails, x10), Pachinko (drop ball, x2-x25), Diva Show (pick a diva, x5-x15).",
      "Bonus multiplier × base x2."
    ],
    payouts: "Cash: bet × segment. Bonus: bet × 2 × mini-game multiplier (up to x100).",
    flavor: "The big show. Four bonus rounds. The divas are the prizes. The wheel decides everything."
  },
  "cash-hunt": {
    category: "Game Show",
    rules: [
      "5×4 grid of 20 face-down tiles.",
      "30% are diva photos (rare, x1-x50). 70% are multipliers (x1-x100).",
      "Pick one tile. Reveals its content.",
      "All tiles reveal after your pick.",
      "Bet charged on tile tap."
    ],
    payouts: "Bet × picked tile's value (x1 to x100, or diva rarity x1-x50).",
    flavor: "Twenty tiles. One pick. The divas are hiding. So are the multipliers. So is the nothing."
  },
  "pachinko": {
    category: "Game Show",
    rules: [
      "Drop a ball through 8 peg rows into 9 photo buckets.",
      "Each bucket has a multiplier (x1 center, x25 edges).",
      "Pascal-triangle distribution: edges are rare, center is common.",
      "Multiple balls can be in flight simultaneously.",
      "Winning bucket lights up + winning diva photo enlarges in center display."
    ],
    payouts: "Bet × bucket multiplier (x1, x2, x5, x10, x25).",
    flavor: "The divas at the edges are waiting. They know they're rare. They're patient."
  },

  // === WAVE 3 — SLOT VARIANTS ===
  "megaways": {
    category: "Slot · Megaways",
    rules: [
      "6 reels, each with random height 2-7 per spin.",
      "Total ways = product of reel heights (max 117,649 ways).",
      "Vedhika = WILD (~4% spawn, substitutes any).",
      "3+ matching divas on adjacent reels starting from left = win.",
      "Cascades: winning symbols disappear, new ones fall in, can re-win.",
      "Anticipation: if first 3 reels match, reel 4 slows down."
    ],
    payouts: "3 matches: x1. 4: x5. 5: x25. 6: x100. (× bet × ways factor)",
    flavor: "117,649 ways to win. Most of them don't. The ones that do, pay big. Vedhika is the wild card."
  },
  "cluster": {
    category: "Slot · Cluster Pays",
    rules: [
      "5×5 grid of diva photos.",
      "5+ same divas connected (touching horizontally/vertically) = cluster win.",
      "Winning clusters disappear. Survivors fall down. New ones fill from top.",
      "Cascade chains within one paid spin.",
      "5-cluster: x2, 6: x5, 7: x10, 8: x25, 9+: x50."
    ],
    payouts: "5 cluster: x2. 6: x5. 7: x10. 8: x25. 9+: x50.",
    flavor: "No paylines. Just connections. The divas cluster like gossip at a party."
  },
  "hold-spin": {
    category: "Slot · Hold & Spin",
    rules: [
      "3×3 grid. Spin costs bet.",
      "3+ same diva in a row (any of 3 horizontal rows) → HOLD & SPIN bonus.",
      "Matching divas lock. 3 free respins. Locked cells stay, others reroll.",
      "New matching diva → locks + respins reset to 3.",
      "Ends when respins = 0 OR all 9 cells locked.",
      "Payout = locked_count² × bet / 10. Full grid = +bet×100 bonus."
    ],
    payouts: "locked² × bet / 10. Full grid: +bet×100.",
    flavor: "Lock them in. They don't escape. The respins are your last chance. Use them."
  },
  "drops-wins": {
    category: "Slot · Drops",
    rules: [
      "5×3 slot, 10 paylines (reel-rush style).",
      "0-3 random cells get a gold-star 'drop' overlay per spin.",
      "Drop bonus = drop_count × bet × 0.5.",
      "Line wins: 3 matches = x2, 4 = x5, 5 = x10.",
      "Random 'Win Drop' event (5% chance per spin): pays bet×10 instantly."
    ],
    payouts: "Line wins: x2/x5/x10. Drop bonus: drop_count × bet × 0.5. Win Drop: bet×10.",
    flavor: "The drops fall randomly. The divas catch what they can. The Win Drop is the dream."
  },
  "ex-revenge": {
    category: "Slot · High Volatility",
    rules: [
      "5×3 slot, 10 paylines. 8 divas + WILD (Vedhika) + SCATTER (The Ex).",
      "Line wins: 3 matches = x2, 4 = x5, 5 = x25.",
      "3+ SCATTER (Ex) → REVENGE FEATURE:",
      "She 'steals' your last line win. Awards 5 free spins at x5 multiplier.",
      "During free spins, 3+ more Exes → pays back 2× what she stole + x10 multiplier on that spin.",
      "High volatility: rarer payouts, bigger when they hit."
    ],
    payouts: "Lines: x2/x5/x25. Revenge trigger: 5 free spins at x5. Payback: 2× stolen + x10.",
    flavor: "The Ex steals. The Ex pays back double. The Ex is the whole game. She knows it."
  },

  // === WAVE 4 — ARCADE & SKILL ===
  "pinball": {
    category: "Arcade",
    rules: [
      "Real pinball table. Tap left half = left flipper, right half = right flipper (or Z/M keys).",
      "5 bumpers wear diva photos. Each slap = 100 points.",
      "2 slingshots = 50 points each.",
      "3 balls per round. Payout = points / 5000 × bet.",
      "Bumper photos reshuffle each ball."
    ],
    payouts: "Bet × (points / 5000).",
    flavor: "Real physics. Real divas. Real frustration. The bumpers don't care about your strategy."
  },
  "whack": {
    category: "Arcade",
    rules: [
      "9 holes. Divas pop up randomly. 45-second round.",
      "Tap to whack. +0.3× per diva. Combo chains raise payout (+10% per combo, max x10).",
      "Vedhika (gold) = +2×. The Ex (red) = -1×.",
      "Score × bet = payout."
    ],
    payouts: "Bet × score (sum of whacks with combo multiplier).",
    flavor: "Hammer time. The divas pop up. The Ex pops up too. Whack wisely."
  },
  "shoot": {
    category: "Arcade",
    rules: [
      "12 bullets. Divas pop up from carnival ledges.",
      "Tap to shoot at that location.",
      "Regular diva: +0.15×. Gold-crowned diva: +2.5×.",
      "10+ hits = SHARPSHOOTER +2× bonus.",
      "Score × bet = payout."
    ],
    payouts: "Bet × (score + sharpshooter bonus).",
    flavor: "Carnival shooting gallery. The divas are the targets. The crowns are the dream."
  },
  "fishing": {
    category: "Arcade",
    rules: [
      "Divas swim across the screen as fish.",
      "Tap to shoot a bullet at that location. Each shot costs 1/10 of bet.",
      "Small fast fish: x5. Medium: x2. Large slow: x1. Mermaid (gold): x25.",
      "30-second round."
    ],
    payouts: "Per hit: shot_cost × fish multiplier. Mermaid: shot_cost × 25.",
    flavor: "The divas are swimming. You're hunting. The mermaid is the legend. She's rare."
  },
  "memory": {
    category: "Arcade",
    rules: [
      "4×4 grid of face-down cards. 8 diva pairs.",
      "Tap to flip. Find matching pairs.",
      "Each pair: +15% bet. Combo step (consecutive match): +5%.",
      "Clear the whole board: +60% bonus.",
      "Miss = combo reset."
    ],
    payouts: "Per pair: 15% bet (+5% per combo). Board clear: +60% bonus.",
    flavor: "Memory match. The divas hide in pairs. Your memory is the only skill that matters."
  },
  "quiz": {
    category: "Arcade",
    rules: [
      "Extreme close-up of a diva photo (zoomed to a random quadrant).",
      "4 name options shown.",
      "8-second timer per question.",
      "Correct: x2 + streak bonus (+0.5 per consecutive, max x5).",
      "Wrong or timeout: streak resets.",
      "Auto-advances to next diva."
    ],
    payouts: "Bet × (2 + 0.5 × streak), max x5.",
    flavor: "How well do you know the divas? The close-up makes it harder than you think."
  },

  // === WAVE 4 — ORIGINALS ===
  "karaoke": {
    category: "Originals · Rhythm",
    rules: [
      "3-lane rhythm game. Notes fall from top.",
      "Tap the hit zone (bottom) when a note reaches it.",
      "Perfect hit: 100 pts. Good: 50 pts. Miss: 0.",
      "Combo: 5 perfects in a row = x2, 10+ = x3.",
      "30-second song. ~70 notes.",
      "Payout = score / 1000 × bet."
    ],
    payouts: "Bet × (score / 1000). Combo multiplier applies to score.",
    flavor: "Vedhika is singing. You're keeping the beat. Don't fumble. She'll know."
  },
  "scooty-race": {
    category: "Originals · Race",
    rules: [
      "5 divas race scooties across the screen.",
      "Each diva has odds (1.5x to 10x) based on past performance.",
      "Pick a diva, bet, watch the race.",
      "Skill correlates with odds (favorites usually win, but variance).",
      "Kallie: 20% chance to wheelie — either boosts massively (x2.4 speed) or crashes (DNF).",
      "1st place: bet × odds. 2nd: bet/2. 3rd+: lose."
    ],
    payouts: "1st: bet × odds (1.5x-10x). 2nd: bet/2. Else: 0.",
    flavor: "Five divas. Five scooties. One chaos agent (Kallie). Bet on who crosses first."
  },
  "group-selfie": {
    category: "Originals · Squad",
    rules: [
      "8 diva photo cards shown. Tap to select 3-5.",
      "Chemistry web shows pairwise chemistry scores (gold=high, gray=low).",
      "TAKE SELFIE: payout = sum of pairwise chemistry × bet / 100.",
      "Perfect Squad (all 5 selected, every pair > 50 chemistry): x10 multiplier."
    ],
    payouts: "Sum of chemistry × bet / 100. Perfect Squad: ×10.",
    flavor: "Pick your squad. The chemistry decides. The perfect squad is rare. The selfie is forever."
  },
  "momos": {
    category: "Originals · Sim",
    rules: [
      "60-second restaurant sim. Diva customers arrive and order momos (1-5).",
      "Tap an order ticket to fulfill it. Pays bet × order_size / 5.",
      "Failed orders (10s timeout) cost bet × 0.2.",
      "Special: Vedhika orders 10 momos = x5 bonus if fulfilled.",
      "Max 4 concurrent orders."
    ],
    payouts: "Per order: bet × size / 5. Vedhika 10x: bet × 10. Failed: -bet × 0.2.",
    flavor: "The momo cart. The divas are hungry. Vedhika is hungrier. Don't burn the dumplings."
  },
  "group-chat": {
    category: "Originals · Slot",
    rules: [
      "5×5 grid of chat-bubble-shaped cells with diva photos.",
      "5+ same diva connected = cluster win (same as Cluster Pays).",
      "Cascades: winning bubbles 'send messages' (disappear with animation), new ones drop.",
      "Vedhika bubble in any win = Viral Message = x2 bonus.",
      "Group Chat Pings (10% chance per spin): free reshuffle + 1 guaranteed 5-cluster."
    ],
    payouts: "5 cluster: x2. 6: x5. 7: x10. 8: x25. 9+: x50. Viral Message: ×2.",
    flavor: "The group chat never sleeps. The divas ping each other constantly. The Viral Message is the dream."
  },
  "vibe-check": {
    category: "Originals · Meta",
    rules: [
      "12-segment wheel of vibes (Vibe Check, Chaos Gremlin, Coupon Clipper, etc.).",
      "Each segment has a multiplier (x1 to x5).",
      "Spin the wheel. Win = bet × multiplier.",
      "LANDING A VIBE GRANTS IT SESSION-LONG — stacks across OTHER games.",
      "Active vibes shown in lobby. Cross-game meta."
    ],
    payouts: "Bet × segment multiplier (x1 to x5). Plus: vibe activated for the session.",
    flavor: "Spin the vibe wheel. Get a vibe. It follows you to other games. The Den remembers."
  },
  "aunty-net": {
    category: "Originals · Sportsbook",
    rules: [
      "4 gossip scenario cards. Each has a question (e.g., 'Who showed up 40 min late?').",
      "3-4 diva options per scenario, with decimal odds (1.5x to 8x).",
      "Pick one diva per scenario. Stake = bet × 4 (one per scenario).",
      "RESOLVE: winner weighted by inverse-odds (favorite usually wins).",
      "Per scenario: correct = bet × odds, wrong = lose bet."
    ],
    payouts: "Per correct pick: bet × odds (1.5x-8x). 4/4 correct: mega tier.",
    flavor: "The auntie sportsbook. Bet on who did what. The drama resolves itself."
  },
  "tika": {
    category: "Originals · Ceremony",
    rules: [
      "3×3 grid of diva photos. SPIN rolls 0-6 tikas (red forehead dots).",
      "Each tika lands on a random cell. Pays bet × 0.5 per tika.",
      "3+ tikas on the same diva: bonus = bet × 5 × (count - 2).",
      "6+ tikas total: FULL CEREMONY bonus = bet × 10."
    ],
    payouts: "Per tika: bet × 0.5. Same-diva 3+ bonus: bet × 5 × (count-2). Ceremony (6+): +bet × 10.",
    flavor: "The blessing ceremony. The tikas land where they land. The divas receive them gracefully."
  },
  "late-night": {
    category: "Originals · Cards",
    rules: [
      "Teen Patti vs 3 AI divas. Pick 3 opponents from a roster of 6.",
      "Each AI has personality: Kallie (chaos bluffer, 30% raise with anything), Ann (calm value, raises pair+), Priyanka (overthinker, calls everything), Vedhika (folds marginal, raises strong), Sunita (calm caller), Kajal (aggressive).",
      "Standard Teen Patti rules: boot, chaal, blind/seen, show.",
      "Pot = sum of all bets. Winner takes pot.",
      "1 raise round max (stake caps at 4×)."
    ],
    payouts: "Win the pot (up to ~14× bet with raises).",
    flavor: "Late night. Three diva opponents. Each has her tells. Read them or lose."
  },
  "photo-drop": {
    category: "Originals · Match",
    rules: [
      "A target composition is shown (Red Dress, Golden Hour, Iconic Fit, Red Carpet, etc.).",
      "3 diva cards displayed. Pick one.",
      "She 'drops a photo from her camera roll' — a random photo of her appears.",
      "If her personality matches the target composition: win = bet × target multiplier (x4 to x10).",
      "Otherwise: lose."
    ],
    payouts: "Match: bet × target multiplier (x4 to x10).",
    flavor: "Pick the right diva for the vibe. She drops a photo. You hope it fits."
  },

  // === REUNION MODE ===
  "reunion": {
    category: "Originals · Christmas Exclusive",
    rules: [
      "🎄 Christmas Day exclusive (Dec 24-26).",
      "5×3 slot featuring all 17 inner-circle divas.",
      "Vedhika pays x100 for 5-in-a-row (special Christmas payout).",
      "Other divas pay x2-x50 based on their shop price.",
      "Snow particles, gold border, Christmas tagline.",
      "Staggered reel reveal with tick sounds."
    ],
    payouts: "3 matches: diva_price × 2. 4: × 4. 5: × 20. Vedhika 5: × 100.",
    flavor: "Merry Christmas, Vedhika. The girls are home. All 17 of them. On one slot. This one's for the memory book."
  }
};
