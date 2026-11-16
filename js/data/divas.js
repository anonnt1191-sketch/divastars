// data/divas.js — 17 inner-circle divas (Vedhika's actual friends, fixed identities)
// Each diva: id, name, title, hue colors, base score, shop price, special rule, flavor,
// plus voice bible (lines used by voice.js for greetings, wins, losses, bonus triggers).

export const DIVAS = {
  ann: {
    id: "ann", name: "Ann", title: "knows the bouncer",
    base: 5, price: 5, hue: "#c8cfdd", hue2: "#f1f4ff", special: false,
    rule: "Always scores +3 extra. The bouncer just waves her through.",
    flavor: "Same silver dress. Same club. Different night. It works every time.",
    accent: "nepali",
    voice: {
      greet: ["You're back. I told the bouncer to expect you.", "VIP list? Please. I am the VIP list."],
      winSmall: ["Easy. Like walking past the line.", "Told you. The dress opens doors."],
      winBig: ["Now we're getting into the right section.", "Bottle service just showed up. You're welcome."],
      winMega: ["I called ahead. The whole floor is yours tonight.", "Even the DJ just said my name."],
      jackpot: ["They shut the club down for us. Just us.", "The bouncer cried. Real tears."],
      lose: ["Wrong door tonight, sweetheart.", "Even I have off nights. Rarely."],
      bonus: ["Come. I have a table with our name on it.", "Skip the line. You're with me."],
      idle: ["The dress works. Every. Single. Time."]
    }
  },
  dwiza: {
    id: "dwiza", name: "Dwiza", title: "outfit thief",
    base: 4, price: 5, hue: "#dc2626", hue2: "#fca5a5", special: false,
    rule: "Scores as much as the STRONGEST friend on the reels. Absorbs their look.",
    flavor: "Saw your fit. It is hers now. The rose was a warning.",
    accent: "indian",
    voice: {
      greet: ["Cute outfit. Mine now.", "I saw it first. Always do."],
      winSmall: ["Stole the look, stole the win.", "Looks better on me. So does this."],
      winBig: ["Your whole style is funding my night.", "I'm wearing your luck. It fits."],
      winMega: ["Everything you brought tonight is mine. Including this.", "I don't borrow. I take."],
      jackpot: ["The rose was the warning. You should have listened.", "Your wardrobe funded a jackpot. You're welcome."],
      lose: ["Borrowed your luck too. Sorry not sorry.", "Wrong fit to steal tonight."],
      bonus: ["Hand it over, darling. The bonus, the outfit, the moment.", "I'm taking this. And that. And you."],
      idle: ["That colour would look better on me. So would that one."]
    }
  },
  garima: {
    id: "garima", name: "Garima", title: "lounge royalty",
    base: 4, price: 5, hue: "#f59e0b", hue2: "#fde68a", special: false,
    rule: "+5 chips whenever a Pair lands. Bottle service for two.",
    flavor: "Reclines like the sofa is rented. Honestly, it might be.",
    accent: "indian",
    voice: {
      greet: ["Pull up a sofa. Stay a while.", "I don't sit. I recline."],
      winSmall: ["Comfortable little win. Just how I like it.", "Pour one. Pour two."],
      winBig: ["Now the bottle service makes sense.", "Two glasses, darling. Always two."],
      winMega: ["The whole lounge just tilted toward me.", "Rent the sofa. Buy the building."],
      jackpot: ["I'm buying the lounge. You can stay.", "Royalty doesn't split the bill. Ever."],
      lose: ["Even queens slump sometimes.", "Wrong sofa tonight."],
      bonus: ["Pair up, darling. Bonus for two.", "Bottle service just doubled. You're with me."],
      idle: ["This sofa is mine. That one too. Actually all of them."]
    }
  },
  kajal: {
    id: "kajal", name: "Kajal", title: "that red dress",
    base: 3, price: 5, hue: "#e11d48", hue2: "#fda4af", special: false,
    rule: "+3 for every other friend on the reels. The dress starts movements.",
    flavor: "One signature look. Zero notes. Infinite confidence.",
    accent: "indian",
    voice: {
      greet: ["You noticed the dress. Good.", "Red was always my colour."],
      winSmall: ["The dress did the heavy lifting.", "Just a flash of red. That's all."],
      winBig: ["Now everyone's looking. As they should.", "The dress pays for itself tonight."],
      winMega: ["Red works. It always works.", "The whole floor just went quieter. I love that."],
      jackpot: ["They'll talk about this dress for years.", "Iconic. As promised."],
      lose: ["Even the dress has off nights.", "Wrong shade tonight."],
      bonus: ["The bonus matches the dress. Obviously.", "Red on red on red. You're welcome."],
      idle: ["I have one look. It's the only one I need."]
    }
  },
  kallie: {
    id: "kallie", name: "Kallie", title: "registered menace",
    base: 10, price: 7, hue: "#f97316", hue2: "#fed7aa", special: false,
    rule: "40% chance to not score at all. Chaos is a lifestyle.",
    flavor: "Latex in every weather. The Grand Canyon was just a backdrop.",
    accent: "latina",
    voice: {
      greet: ["Brace yourself. I'm here.", "Latex, no context, you're welcome."],
      winSmall: ["Chaos paid off. As it does.", "Lucky shot. Next one's worse."],
      winBig: ["I told you the latex was lucky.", "Menace mode: activated."],
      winMega: ["This is what registered looks like.", "Chaos, but make it profitable."],
      jackpot: ["Even I didn't see that coming. And I see everything.", "Menace of the year, every year."],
      lose: ["Whoops. Or not whoops.", "I did that on purpose. Probably."],
      bonus: ["Surprise! You earned this. Maybe.", "Bonus incoming. Or not. Roll the dice."],
      idle: ["The Grand Canyon was just a backdrop. So is this lobby."]
    }
  },
  kanchan: {
    id: "kanchan", name: "Kanchan", title: "beach is a state of mind",
    base: 4, price: 6, hue: "#38bdf8", hue2: "#bae6fd", special: false,
    rule: "If all 3 reels show DIFFERENT friends: +8. She brought the whole squad.",
    flavor: "Golden hour finds her. Even indoors. Even in winter.",
    accent: "nepali",
    voice: {
      greet: ["Golden hour, every hour.", "Beach is wherever I am."],
      winSmall: ["Salty little win. Refreshing.", "Just enough for a beach day."],
      winBig: ["The squad pulled through.", "Three different friends, three times the fun."],
      winMega: ["The whole beach is on the reels.", "Golden hour, golden win."],
      jackpot: ["I packed the entire coast into this spin.", "Every diva, every wave, every chip."],
      lose: ["Even the tide turns sometimes.", "Wrong hour for golden."],
      bonus: ["Squad's here. Bonus is here. Stay.", "Beach rules apply: relax and win."],
      idle: ["Salt in my hair, gold on the reels."]
    }
  },
  nikki: {
    id: "nikki", name: "Nikki", title: "one iconic fit",
    base: 4, price: 6, hue: "#b45309", hue2: "#fde68a", special: false,
    rule: "Boss debuffs CANNOT zero her. The outfit is too consistent.",
    flavor: "Wore it once. Wore it best. Never wore anything else since.",
    accent: "indian",
    voice: {
      greet: ["Same fit. Same energy. Always.", "You know what I'm wearing. Always."],
      winSmall: ["The fit delivers. As always.", "Consistency pays, darling."],
      winBig: ["Same outfit, bigger win. As intended.", "I told you never to doubt the fit."],
      winMega: ["The fit can't be debuffed. Neither can I.", "Iconic in, iconic out."],
      jackpot: ["Same outfit, lifetime payout. Worth it.", "They'll photograph this look forever."],
      lose: ["Even the iconic fit takes a break.", "Wrong spin for the fit tonight."],
      bonus: ["Boss tried to zero me. The fit said no.", "Bonus immune to debuffs. Like me."],
      idle: ["One fit. Forever. You're welcome."]
    }
  },
  nitz: {
    id: "nitz", name: "Nitz", title: "24-karat everything",
    base: 3, price: 5, hue: "#eab308", hue2: "#fef08a", special: false,
    rule: "+2 coins whenever a TRIPLE lands. Gold rush rules apply.",
    flavor: "Mirror selfies because the gold deserves a witness.",
    accent: "nepali",
    voice: {
      greet: ["All gold everything. As usual.", "The mirror missed me."],
      winSmall: ["A little sparkle for you.", "Just enough to polish."],
      winBig: ["Triple gold. Triple everything.", "The mirror is going to love this."],
      winMega: ["Gold rush, baby.", "24-karat kind of night."],
      jackpot: ["They'll write this in gold.", "The whole vault is mine."],
      lose: ["Even gold tarnishes one night.", "Wrong karat tonight."],
      bonus: ["Triple the gold, triple the bonus.", "Shine theory applies here."],
      idle: ["If it isn't gold, I'm not wearing it."]
    }
  },
  pinky: {
    id: "pinky", name: "Pinky", title: "table service only",
    base: 3, price: 5, hue: "#2dd4bf", hue2: "#99f6e4", special: false,
    rule: "+2 per different friend on the reels. Her guest list is DEEP.",
    flavor: "Has a section. The section has a rope. The rope has a name.",
    accent: "indian",
    voice: {
      greet: ["Section's open. You're on the list.", "Table service only, sweetheart."],
      winSmall: ["Drinks on me. Just one round.", "Small section, small win."],
      winBig: ["The guest list delivered tonight.", "Everyone showed up. They always do."],
      winMega: ["Whole section is popping.", "The rope came off. We're all VIP tonight."],
      jackpot: ["I bought the club. The rope is decorative now.", "Everyone I ever put on a list just won."],
      lose: ["Even the section empties sometimes.", "Wrong list tonight."],
      bonus: ["More names on the list, more chips in the bucket.", "Bonus table. Pull up a chair."],
      idle: ["If there's no rope, am I even here?"]
    }
  },
  priyanka: {
    id: "priyanka", name: "Priyanka", title: "overthinks beautifully",
    base: 3, price: 5, hue: "#fb923c", hue2: "#fdba74", special: false,
    rule: "+3 for each friend in your pool NOT on the reels. Counts the absentees.",
    flavor: "Hand on chin. Mind on the group chat. Caption: none needed.",
    accent: "indian",
    voice: {
      greet: ["I was just thinking about you.", "Give me a second. Almost figured it out."],
      winSmall: ["Calculated. Obviously.", "I knew it. I always know."],
      winBig: ["The math is beautiful tonight.", "Counted every chip before it landed."],
      winMega: ["The overthinking paid off.", "I ran the numbers. The numbers won."],
      jackpot: ["I have a spreadsheet for this moment.", "Every scenario modelled. This was the best one."],
      lose: ["Even I get the math wrong sometimes.", "Wrong variable tonight."],
      bonus: ["The absentees count. Always count the absentees.", "Bonus calculated, accounted, delivered."],
      idle: ["Hand on chin. Mind on the group chat. Always."]
    }
  },
  riddhima: {
    id: "riddhima", name: "Riddhima", title: "pattern clash certified",
    base: 5, price: 5, hue: "#ec4899", hue2: "#f9a8d4", special: false,
    rule: "Friends next to Riddhima score +2 each. Her prints radiate.",
    flavor: "Pink AND gold AND animal print. On purpose. Always.",
    accent: "indian",
    voice: {
      greet: ["Yes, the patterns clash. On purpose.", "Pink, gold, leopard. As one does."],
      winSmall: ["A little clash, a little cash.", "Pattern pays, darling."],
      winBig: ["The prints pulled through tonight.", "Clash certified, win verified."],
      winMega: ["Whole outfit is a multiplier.", "Pattern radiates. So does this win."],
      jackpot: ["They'll study this fit in fashion school.", "Maximum clash, maximum payout."],
      lose: ["Even clashing fails sometimes.", "Wrong print combo tonight."],
      bonus: ["The clash is the bonus. Always.", "Radiate, multiply, deliver."],
      idle: ["Three patterns minimum or I'm not leaving the house."]
    }
  },
  sarita: {
    id: "sarita", name: "Sarita", title: "human sunshine",
    base: 2, price: 4, hue: "#d97706", hue2: "#fcd34d", special: false,
    rule: "Every scoring friend gets +1 per Sarita on the reels. Smile physics.",
    flavor: "That laugh is audible from the parking lot. Bring earplugs.",
    accent: "nepali",
    voice: {
      greet: ["There she is! There you are!", "Smile first, win second. Always."],
      winSmall: ["A little sunshine for you.", "Smiled at the reels. They paid."],
      winBig: ["Whole squad's glowing tonight.", "Smile physics, baby."],
      winMega: ["Sunshine mode: maximum.", "Everyone scores brighter around me."],
      jackpot: ["I laughed and the reels cried happy tears.", "The whole casino just smiled."],
      lose: ["Even sunshine clouds over sometimes.", "Wrong hour to glow."],
      bonus: ["Smile bonus for everyone. You're welcome.", "Bonus radiates. Like me."],
      idle: ["If you can hear me from the parking lot, you're welcome."]
    }
  },
  shalini: {
    id: "shalini", name: "Shalini", title: "first on the dancefloor",
    base: 5, price: 5, hue: "#a855f7", hue2: "#d8b4fe", special: false,
    rule: "x2 chips on the FIRST spin of each floor. Opens the night.",
    flavor: "Was on the floor before the DJ finished soundcheck.",
    accent: "indian",
    voice: {
      greet: ["I've been here for hours. Where were you?", "Floor's already warm. You're welcome."],
      winSmall: ["First spin, first win. As intended.", "I opened the night right."],
      winBig: ["The floor is mine tonight.", "First spin energy pays double."],
      winMega: ["I haven't left the floor. I never do.", "Whole club caught my rhythm."],
      jackpot: ["The DJ plays my song. Always.", "Open the night, close the night, win the night."],
      lose: ["Even I sit down sometimes.", "Wrong beat tonight."],
      bonus: ["First spin bonus. Because I said so.", "Double chips for the opener. Always me."],
      idle: ["The DJ isn't even ready and I'm already on the floor."]
    }
  },
  shreya: {
    id: "shreya", name: "Shreya", title: "posts everything",
    base: 3, price: 4, hue: "#a21caf", hue2: "#e9d5ff", special: false,
    rule: "+1 coin every time she lands. The brand deals pay out.",
    flavor: "Cafe found. Fit planned. Content secured. Repeat.",
    accent: "indian",
    voice: {
      greet: ["Smile, you're on my story.", "Cafe found, content secured."],
      winSmall: ["Posted the win. Likes incoming.", "Just a little content for the feed."],
      winBig: ["This is going viral tonight.", "Brand deal incoming after that spin."],
      winMega: ["Whole feed is glowing.", "Engagement spike detected."],
      jackpot: ["I'm making this my pinned post.", "The algorithm favours me. Always."],
      lose: ["Even I post a flop sometimes.", "Wrong angle tonight."],
      bonus: ["Bonus landed. Posting immediately.", "Sponsored content energy."],
      idle: ["If it isn't posted, did it even happen?"]
    }
  },
  soumya: {
    id: "soumya", name: "Soumya", title: "red is a personality",
    base: 6, price: 5, hue: "#dc2626", hue2: "#f87171", special: false,
    rule: "+5 when she lands on the MIDDLE reel. Center of attention. Always.",
    flavor: "The red backdrop was her idea. The lipstick was negotiable. It was not.",
    accent: "indian",
    voice: {
      greet: ["Center reel, center attention. Always.", "The red was my idea. Obviously."],
      winSmall: ["Center of the win, as usual.", "Red pulls focus. Pay attention."],
      winBig: ["The middle is mine tonight.", "Center stage, center payout."],
      winMega: ["Red on red on red on win.", "You can't look away. You shouldn't."],
      jackpot: ["The whole reel revolves around me now.", "Red wasn't negotiable. Neither is this."],
      lose: ["Even the center dims sometimes.", "Wrong shade of red tonight."],
      bonus: ["Middle reel bonus. Center cut.", "Lands in the middle, pays in the middle."],
      idle: ["If it isn't red, I'm not wearing it. If it isn't center, I'm not standing there."]
    }
  },
  sunita: {
    id: "sunita", name: "Sunita", title: "wedding-season MVP",
    base: 4, price: 6, hue: "#facc15", hue2: "#fef9c3", special: false,
    rule: "+8 on floors with a Boss. She dresses for the occasion.",
    flavor: "Owns a lehenga for every possible emergency. This qualifies.",
    accent: "nepali",
    voice: {
      greet: ["Is there a wedding? I have a lehenga.", "Emergency? I have a lehenga for that."],
      winSmall: ["Small wedding, small win.", "Just enough for a new lehenga."],
      winBig: ["Wedding season pays out tonight.", "Boss in the house? Sunita dressed up."],
      winMega: ["Every lehenga I own just earned its keep.", "Wedding-season MVP, every season."],
      jackpot: ["I'm buying lehengas for the whole squad.", "The trousseau just got funded."],
      lose: ["Even the MVP sits out a wedding.", "Wrong lehenga tonight."],
      bonus: ["Boss bonus activated. I dressed up.", "+8 because I came correct."],
      idle: ["There's always another wedding. I have the lehenga ready."]
    }
  },
  vedhika: {
    id: "vedhika", name: "Vedhika", title: "THE EDITOR. final cut authority.",
    base: 14, price: 8, hue: "#d946ef", hue2: "#f5d0fe", special: true,
    rule: "Massive chips. But she calls the final cut: your NEXT spin scores half.",
    flavor: "Red carpet posture. Holographic fit. Approves the squad photo. Or does not.",
    accent: "indian",
    voice: {
      greet: ["I'm Vedhika. I'll be editing your night.", "Welcome to my Den. The girls are waiting."],
      winSmall: ["Approved. Barely.", "Cute. The cut stays."],
      winBig: ["The squad delivered. I signed off.", "Big enough to keep the final cut."],
      winMega: ["This makes the edit. Obviously.", "Main character energy. Approved."],
      jackpot: ["This is the final cut of the night.", "I'm pinning this to the top of the Den."],
      lose: ["Cut. We don't keep that one.", "Wrong take. Try again."],
      bonus: ["Bonus approved. Your next spin is mine.", "I take half the next cut. House rules."],
      idle: ["I made this for them. Every photo. Every line. Every spin."]
    }
  }
};

export const DIVA_IDS = Object.keys(DIVAS);
export const PHOTO_COUNTS = {
  ann:5, dwiza:6, garima:6, kajal:6, kallie:6, kanchan:6, nikki:6, nitz:6,
  pinky:6, priyanka:6, riddhima:6, sarita:6, shalini:6, shreya:6, soumya:6,
  sunita:6, vedhika:6
};

// Fixed court card assignments (req from original)
export const COURT_FACES = { J:"shreya", Q:"kajal", K:"soumya", A:"vedhika" };

// Bosses — keep original 4, they're good
export const BOSSES = {
  flaker: { name:"The Flaker", photo:"assets/ui/boss-flaker.jpg",
    quirk:"Each spin, 50% chance one random reel flakes (scores 0).",
    flavor:'"Leaving now." (has not moved since 2019)' },
  noise: { name:"Noise Complaint", photo:"assets/ui/boss-noise.jpg",
    quirk:"Holding reels for respins costs DOUBLE coins.",
    flavor:"The neighbors called. Twice. In German." },
  ex: { name:"The Ex", photo:"assets/ui/boss-ex.jpg",
    quirk:"25% chance the strongest friend storms off (scores 0).",
    flavor:'Came "just to return your stuff". Stayed 4 hours.' },
  rent: { name:"Rent Day", photo:"assets/ui/boss-rent.jpg",
    quirk:"Every spin after the first costs 2 coins, or scores half.",
    flavor:"The Landlord of Vibes has arrived. He wants his money." }
};

export const EX = { name:"The Ex", photo:"assets/ui/boss-ex.jpg", title:"green zero. every mine. she always wins." };

// Floors for Floor Slots
export const FLOORS = [
  { name:"The Pre-Game", target:30, boss:null },
  { name:"Someone's Birthday (Whose?)", target:50, boss:"flaker" },
  { name:"The House Party", target:75, boss:"noise" },
  { name:"The Club (List Closed)", target:100, boss:"ex" },
  { name:"The Wedding (Open Bar Closed)", target:115, boss:"rent" }
];

// Vibes (season-long power-ups)
export const VIBES = {
  vibeCheck:  { id:"vibeCheck",  name:"Vibe Check",        price:7, rule:"Pairs score +4 extra chips.", flavor:"Passed. Barely." },
  gremlin:    { id:"gremlin",    name:"Chaos Gremlin",     price:8, rule:"1 in 6 chance a spin scores x3. Untameable.", flavor:"Adopted from the group chat. Cannot be returned." },
  coupons:    { id:"coupons",    name:"Coupon Clipper",    price:6, rule:"+1 coin every spin, no strings.", flavor:"Has opinions about the loyalty program." },
  loyalty:    { id:"loyalty",    name:"Loyalty Card",      price:6, rule:"Friends you own 2+ copies of score +3 each appearance.", flavor:"Punched 9 of 10 holes. Reward: nothing." },
  thirdWheel: { id:"thirdWheel", name:"Third Wheel",       price:5, rule:"The middle reel scores +5. Wedged in permanently.", flavor:"Was not invited. Is having the best time." },
  hype:       { id:"hype",       name:"Hype Man",          price:7, rule:"The best-scoring friend this spin gets +6.", flavor:'"LET HIM COOK" (he is burning it).' },
  dietCoke:   { id:"dietCoke",   name:"Diet Coke Zero Sugar", price:8, rule:"Holding reels for a respin is FREE.", flavor:"The order is non-negotiable. Extra ice." },
  groupChat:  { id:"groupChat",  name:"Alive Group Chat",  price:7, rule:"Each DIFFERENT friend on the reels scores +2.", flavor:"412 unread messages. All of them fire." }
};

// UI background pools
export const UI_BG = {
  title:    ["assets/ui/bg-title-1.jpg","assets/ui/bg-title-2.jpg","assets/ui/bg-title-3.jpg","assets/ui/bg-title-4.jpg","assets/ui/bg-title-5.jpg"],
  gameOver: ["assets/ui/bg-gameover-1.jpg","assets/ui/bg-gameover-2.jpg","assets/ui/bg-gameover-3.jpg","assets/ui/bg-gameover-4.jpg"],
  victory:  ["assets/ui/bg-victory-1.jpg","assets/ui/bg-victory-2.jpg","assets/ui/bg-victory-3.jpg","assets/ui/bg-victory-4.jpg"]
};
