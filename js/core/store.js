// core/store.js — bank/state with Supabase anonymous auth + cloud sync + localStorage fallback.
// Mobile-first: written for slow networks. Always writes to localStorage first, syncs to cloud async.

const STORAGE_KEY = "divas-den-v2";
const SUPABASE_URL = "";  // set after Vedhika creates project; falls back to local-only if empty
const SUPABASE_KEY = "";

const DEFAULT_STATE = {
  bank: 5000,             // starting bank — bumped from 1000 for the 50-game revamp
  compsUsed: 0,
  lastRunDeposit: 0,
  muted: false,
  unlockedGames: ["cash-me","floor-slots","plinko","wheel","mines","archery","reel-rush",
                   "diva-jet","jetx","spaceman","roulette","blackjack","teen-patti","call-break",
                   "andar-bahar","dragon-tiger","baccarat","sic-bo","casino-holdem","poker-draw",
                   "war","three-card","video-poker",
                   // wave-3
                   "hilo","dice","limbo","keno","scratch","bingo","crazy-time","coin-flip",
                   "cash-hunt","pachinko","megaways","cluster","hold-spin","drops-wins","ex-revenge",
                   // wave-4
                   "pinball","whack","shoot","fishing","memory","quiz","karaoke","scooty-race",
                   "group-selfie","momos","group-chat","vibe-check","aunty-net","tika","late-night","photo-drop"],  // all 50 games playable
  unlockedPhotos: 1000,   // photo-unlock progression: set high so all are visible from start
  seenOnboarding: false,
  ageVerified: false,
  dailyStreak: 0,
  lastDailyClaim: 0,      // epoch ms
  vipTier: "Bronze",
  lifetimeWagered: 0,
  stats: {}               // per-game {plays, wagered, won, best}
};

// Build default stats for every game
function defaultStats(games) {
  const out = {};
  for (const g of games) out[g.id] = { plays:0, wagered:0, won:0, best:0 };
  return out;
}

class Store {
  constructor() {
    this.state = structuredClone(DEFAULT_STATE);
    this.listeners = [];
    this.supabase = null;
    this.userId = null;
    this.initialized = false;
  }

  init(games) {
    if (this.initialized) return;
    this.state.stats = defaultStats(games);
    this._loadLocal();
    if (SUPABASE_URL && SUPABASE_KEY && window.supabase) {
      this._initSupabase().catch(e=>console.warn("Supabase init failed, running local-only:", e));
    } else {
      console.info("[Store] No Supabase configured — running local-only. Cloud sync disabled.");
    }
    this.initialized = true;
    this._emit();
  }

  _loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      // merge top-level keys
      for (const k of Object.keys(DEFAULT_STATE)) {
        if (typeof saved[k] !== "undefined" && typeof saved[k] === typeof DEFAULT_STATE[k]) {
          this.state[k] = saved[k];
        }
      }
      // merge stats (preserve defaults for new games)
      if (saved.stats) {
        for (const id of Object.keys(this.state.stats)) {
          if (saved.stats[id]) Object.assign(this.state.stats[id], saved.stats[id]);
        }
      }
      this.state.muted = localStorage.getItem("dd_mute") === "1" || !!saved.muted;
    } catch (e) {
      console.warn("local load failed", e);
    }
  }

  _saveLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch(e){}
  }

  async _initSupabase() {
    const { createClient } = window.supabase;
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    // anonymous sign-in
    const { data, error } = await this.supabase.auth.signInAnonymously();
    if (error) throw error;
    this.userId = data.user?.id;
    // try to load cloud save
    const { data: row, error: e2 } = await this.supabase
      .from("saves")
      .select("state")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (row?.state) {
      // cloud is authoritative if bank is higher (player played elsewhere)
      const cloud = JSON.parse(row.state);
      if (typeof cloud.bank === "number" && cloud.bank > this.state.bank) {
        this.state = Object.assign(this.state, cloud);
      }
    }
    this._saveLocal();
    this._emit();
  }

  async _syncCloud() {
    if (!this.supabase || !this.userId) return;
    try {
      await this.supabase.from("saves")
        .upsert({ user_id:this.userId, state:JSON.stringify(this.state), updated_at:new Date().toISOString() });
    } catch(e) { console.warn("cloud sync failed", e); }
  }

  sub(fn) { this.listeners.push(fn); }
  _emit() { for (const f of this.listeners) try{f();}catch(e){console.warn(e);} }

  save() { this._saveLocal(); this._syncCloud(); this._emit(); }

  bet(amount) {
    if (amount <= 0 || this.state.bank < amount) return false;
    this.state.bank -= amount;
    this.state.lifetimeWagered += amount;
    this._recalcVip();
    this.save();
    return true;
  }

  pay(amount) {
    if (amount <= 0) return;
    this.state.bank = Math.round(this.state.bank + amount);
    this.save();
  }

  deposit(amount) {
    if (amount <= 0) return;
    this.state.bank = Math.round(this.state.bank + amount);
    this.state.lastRunDeposit = amount;
    this.save();
  }

  comp() {
    if (this.state.bank >= 500) return false;  // comp threshold raised
    this.state.bank += 2000;
    this.state.compsUsed++;
    this.save();
    return true;
  }

  record(gameId, wagered, won) {
    const s = this.state.stats[gameId] || { plays:0, wagered:0, won:0, best:0 };
    s.plays++; s.wagered += wagered; s.won += won;
    s.best = Math.max(s.best, won - wagered);
    this.state.stats[gameId] = s;
    this.save();
  }

  unlockGame(id) {
    if (this.state.unlockedGames.includes(id)) return false;
    this.state.unlockedGames.push(id);
    this.save();
    return true;
  }

  unlockPhoto() {
    this.state.unlockedPhotos++;
    this.save();
  }

  setMuted(m) {
    this.state.muted = !!m;
    localStorage.setItem("dd_mute", m ? "1" : "0");
    this.save();
  }

  setAgeVerified() { this.state.ageVerified = true; this.save(); }
  setOnboardingSeen() { this.state.seenOnboarding = true; this.save(); }

  claimDaily() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (now - this.state.lastDailyClaim < dayMs) return 0;
    // streak logic: same streak if within 2 days, else reset
    if (now - this.state.lastDailyClaim < 2 * dayMs) this.state.dailyStreak++;
    else this.state.dailyStreak = 1;
    this.state.lastDailyClaim = now;
    const reward = 500 + Math.min(this.state.dailyStreak, 7) * 250;  // 750 → 2250
    this.pay(reward);
    return reward;
  }

  _recalcVip() {
    const w = this.state.lifetimeWagered;
    if (w > 500000) this.state.vipTier = "Vedhika";
    else if (w > 200000) this.state.vipTier = "Diva";
    else if (w > 75000) this.state.vipTier = "Gold";
    else if (w > 20000) this.state.vipTier = "Silver";
    else this.state.vipTier = "Bronze";
  }

  reset() {
    this.state = structuredClone(DEFAULT_STATE);
    this._saveLocal();
    this._syncCloud();
    this._emit();
  }
}

export const store = new Store();
