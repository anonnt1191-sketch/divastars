// data/games-registry.js — all 50 games, with wave/build status, category, and metadata.
// Wave 1 = playable today. Wave 2/3/4 = coming in subsequent sessions.

export const GAME_CATEGORIES = {
  featured:  { label:"Featured",       icon:"★" },
  slots:     { label:"Slots",          icon:"▦" },
  table:     { label:"Tables & Cards", icon:"♣" },
  crash:     { label:"Crash Games",    icon:"↑" },
  instant:   { label:"Instant Wins",   icon:"⚡" },
  shows:     { label:"Game Shows",     icon:"◯" },
  arcade:    { label:"Arcade",         icon:"@" },
  originals: { label:"Diva Originals", icon:"♡" }
};

// id, name, blurb (short lobby tagline), category, wave (1=playable today), isNew, sortKey
export const GAMES = [
  // ===== FEATURED / WAVE 1 =====
  { id:"cash-me",       name:"Cash Me",            blurb:"Idle cash machine. Crank the printer. Cash out before it jams.",  cat:"crash",     wave:1, isNew:true,  featured:true,  minBet:10, celebrationStyle:"gold_rain" },
  { id:"floor-slots",   name:"Floor Slots",        blurb:"5 floors · bosses · roguelike shop.",       cat:"originals", wave:1, isNew:false, featured:true,  minBet:10, celebrationStyle:"photo_burst" },
  { id:"plinko",        name:"Plinko",             blurb:"Drop a chip. Chase the edges.",             cat:"instant",   wave:1, isNew:false, featured:true,  minBet:10, celebrationStyle:"sparkles" },
  { id:"wheel",         name:"Diva Wheel",         blurb:"24 segments. Every face a photo.",          cat:"shows",     wave:1, isNew:false, featured:true,  minBet:10, celebrationStyle:"kaleidoscope" },
  { id:"mines",         name:"Mines",              blurb:"Reveal divas. Dodge The Ex.",               cat:"instant",   wave:1, isNew:false, featured:true,  minBet:10, celebrationStyle:"sparkles" },
  { id:"archery",       name:"Diva Archer",        blurb:"One bow, one shot. Nail the face.",         cat:"arcade",    wave:1, isNew:false, featured:true,  minBet:10, celebrationStyle:"confetti" },
  { id:"reel-rush",     name:"Reel Rush",          blurb:"5x3 photo slot. x1000. Free spins.",        cat:"slots",     wave:1, isNew:false, featured:true,  minBet:10, celebrationStyle:"photo_burst" },

  // ===== WAVE 2 — coming next session =====
  { id:"diva-jet",      name:"Diva Dare",          blurb:"Truth or dare. Bet on who accepts the dare.",cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"jetx",          name:"JetX",               blurb:"Classic crash. Photo pilot.",               cat:"crash",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"gold_rain" },
  { id:"spaceman",      name:"Swipe Right",        blurb:"Tinder for divas. Match. Build the streak.", cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"hearts" },
  { id:"roulette",      name:"Den Roulette",       blurb:"37 pockets. Every pocket a face.",          cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"kaleidoscope" },
  { id:"blackjack",     name:"Blackjack",          blurb:"3:2. Dealer stands on 17.",                 cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"teen-patti",    name:"Teen Patti (Farash)",blurb:"Boot, chaal, blind, seen, show.",           cat:"table",     wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"call-break",    name:"Call Break",         blurb:"Nepali trick-taker. Spades trump.",         cat:"table",     wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"andar-bahar",   name:"Andar Bahar",        blurb:"Inside or outside. Pure luck.",             cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"dragon-tiger",  name:"Dragon Tiger",       blurb:"One card each. Higher wins.",               cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"baccarat",      name:"Baccarat",           blurb:"Player or Banker. Photo court cards.",      cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"sic-bo",        name:"Sic Bo",             blurb:"Three dice. Photo faces.",                  cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"casino-holdem", name:"Casino Hold'em",     blurb:"Beat the dealer. Photo flop.",              cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"poker-draw",    name:"Squad Poker",        blurb:"5-card draw. Hold, redraw.",                cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"war",           name:"Casino War",         blurb:"Higher card wins. Simple.",                 cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"three-card",    name:"Three Card Poker",   blurb:"Ante, play, pair plus.",                    cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"video-poker",   name:"Video Poker",        blurb:"Jacks or Better. Photo court.",             cat:"table",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },

  // ===== WAVE 3 =====
  { id:"hilo",          name:"Hi-Lo",              blurb:"Higher or lower. Streak the mult.",         cat:"instant",   wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"dice",          name:"Dice",               blurb:"Roll over. Photo faces.",                   cat:"instant",   wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"limbo",         name:"Limbo",              blurb:"How low can the multiplier go?",            cat:"instant",   wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"keno",          name:"Keno",               blurb:"Pick 10. Photo draws.",                     cat:"instant",   wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"scratch",       name:"Scratch Cards",      blurb:"Gold foil. Match three faces.",             cat:"instant",   wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"bingo",         name:"Diva Bingo",         blurb:"Photo balls. Match the card.",              cat:"instant",   wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"crazy-time",    name:"Diva Time",          blurb:"4 bonus rounds. Crazy-style.",              cat:"shows",     wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"fireworks" },
  { id:"coin-flip",     name:"Coin Flip",          blurb:"Heads or tails. Photo coins.",              cat:"shows",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"cash-hunt",     name:"Cash Hunt",          blurb:"Pick a box. Find the multiplier.",          cat:"shows",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"pachinko",      name:"Pachinko Bonus",     blurb:"Drop the chip. Photo buckets.",             cat:"shows",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"megaways",      name:"Megaways Divas",     blurb:"117,649 ways. Photo symbols.",              cat:"slots",     wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"photo_burst" },
  { id:"cluster",       name:"Cluster Pays",       blurb:"5+ connects. Photo clusters.",              cat:"slots",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"photo_burst" },
  { id:"hold-spin",     name:"Hold & Spin",        blurb:"Land 6+. Lock the reels.",                  cat:"slots",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"photo_burst" },
  { id:"drops-wins",    name:"Drops & Wins",       blurb:"Random drops. Photo prizes.",               cat:"slots",     wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"photo_burst" },
  { id:"ex-revenge",    name:"The Ex's Revenge",   blurb:"High-volatility boss slot.",                cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"fireworks" },

  // ===== WAVE 4 — final batch =====
  { id:"pinball",       name:"Photo Pinball",      blurb:"Flippers. Photo bumpers. 3 balls.",         cat:"arcade",    wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"whack",         name:"Whack a Diva",       blurb:"Hammer time. 45 seconds of chaos.",         cat:"arcade",    wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"shoot",         name:"Carnival Shoot",     blurb:"12 bullets. Pop every diva.",               cat:"arcade",    wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"fishing",       name:"Diva Fishing",       blurb:"Shoot fish, win chips. Photo fish.",        cat:"arcade",    wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"memory",        name:"Memory Match",       blurb:"Flip, match, chain the combos.",            cat:"arcade",    wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"quiz",          name:"Who's That?",        blurb:"Close-up. Name the diva. 8s timer.",        cat:"arcade",    wave:1, isNew:false, featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"karaoke",       name:"Karaoke Night",      blurb:"Tap the beat. Diva sings.",                 cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"scooty-race",   name:"Scooty Race",        blurb:"Pick a diva. Race for the pot.",            cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"group-selfie",  name:"Group Selfie",       blurb:"Pick 3-5. Chemistry pays.",                 cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"hearts" },
  { id:"momos",         name:"Momo Cartel",        blurb:"Fulfill orders. Photo customers.",          cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"gold_rain" },
  { id:"group-chat",    name:"The Group Chat",     blurb:"Cluster slot. Chat bubbles.",               cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"photo_burst" },
  { id:"vibe-check",    name:"Vibe Check",         blurb:"Wheel of vibes. Cross-game meta.",          cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"kaleidoscope" },
  { id:"aunty-net",     name:"Aunty Network",      blurb:"Bet on gossip outcomes.",                   cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"tika",          name:"Tika Ceremony",      blurb:"Blessing/scatter. Chain bonuses.",          cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"sparkles" },
  { id:"late-night",    name:"Late Night Didi",    blurb:"Teen Patti with squad AI.",                 cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"confetti" },
  { id:"photo-drop",    name:"Photo Drop",         blurb:"Pick a diva. Drop a photo. Match.",         cat:"originals", wave:1, isNew:true,  featured:false, minBet:10, celebrationStyle:"photo_burst" },
];

// sanity: count
export const TOTAL_GAMES = GAMES.length; // should be 57; trim if needed

// helper: get by id
export function getGame(id){ return GAMES.find(g=>g.id===id); }

// helper: games in a wave
export function gamesByWave(n){ return GAMES.filter(g=>g.wave===n); }

// Reunion Mode game — only visible Dec 24-26 (Christmas get-together)
export const REUNION_GAME = {
  id: "reunion", name: "The Get-Together",
  blurb: "🎄 Christmas Day exclusive · all 17 divas · x100 max",
  cat: "originals", wave: 1, isNew: true, featured: true, minBet: 10,
  seasonal: true
};

// helper: games in a category
export function gamesByCategory(cat){ return GAMES.filter(g=>g.cat===cat); }
