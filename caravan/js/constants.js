const CARAVAN_MIN = 21;
const CARAVAN_MAX = 26;
const DECK_MIN = 30;
const FACE = new Set(['J', 'Q', 'K', 'JK']);
const FACE_VERB = { J: 'JACKED', Q: 'QUEENED', K: 'KINGED', JK: 'JOKERED' };
const FLASH_MS = 1300;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUE = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10 };
const STARTING_CAPS = 500;
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_GLYPH = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣', joker: '★' };
const SUIT_RED = { spades: false, hearts: true, diamonds: true, clubs: false, joker: false };

const CPU_BIDS = { easy: { min: 50, max: 75 }, medium: { min: 100, max: 250 }, hard: { min: 250, max: 500 }, };

const CPU_NAMES = {
  easy: ['RINGO'],
  medium: ['CLIFF BRISCOE', 'DALE BARTON', 'ISAAC', 'JAKE ERWIN', 'JED MASTERSON', 'JULES', 'KIETH', 'LACEY', 'LITTLE BUSTER', 'CARL MAYES'],
  hard: ['DENNIS CROCKER', 'JOHNSON NASH', 'MARTY VULTURE', 'NO-BARK NOONAN'],
};

const PALETTES = [
  { id: 'amber', label: 'AMBER', className: '' },
  { id: 'blue', label: 'BLUE', className: 'palette-blue' },
  { id: 'green', label: 'GREEN', className: 'palette-green' },
  { id: 'rasp', label: 'RASPBERRY', className: 'palette-rasp' },
  { id: 'white', label: 'WHITE', className: 'palette-white' },
];

const SETTLEMENTS = {
  california: ['Boneyard', 'Redding', 'Shady Sands', 'Dayglow', 'New Reno', 'The Hub'],
  capital: ['Arefu', 'Big Town', 'Canterbury Commons', 'Evergreen Mills', 'Girdershade', 'Grayditch',
    'Little Lamplight', 'Megaton', 'Oasis', 'Paradise Falls', 'Raven Rock', 'Republic of Dave',
    'Rivet City', 'Temple of the Union', 'Tenpenny Tower', 'The Citadel', 'Underworld', 'Vault 101'],
  common: ['Abernathy Farm', 'Atom Cats Garage', 'Boston Airport', 'Bunker Hill', 'Combat Zone', 'County Crossing',
    'Covenant', 'Diamond City', 'Finch Farm', 'Goodneighbor', 'Graygarden', 'Greentop Nursery',
    'Gunners Plaza', 'Libertalia', 'Nordhagen Beach', 'Oberland Station', 'Quincy', 'Somerville Place',
    'Tenpines Bluff', 'The Castle', 'The Institute', 'The Slog', 'Vault 81', 'Warwick Homestead'],
  mojave: ['188 Trading Post', 'Bitter Springs', 'Camp Forlorn Hope', 'Camp McCarran', 'Cottonwood Cove', 'Freeside',
    'Goodsprings', 'Helios One', 'Hidden Valley', 'Hoover Dam', 'Jacobstown', 'Mojave Outpost',
    'Nellis Air Force Base', 'Novac', 'Primm', 'Sloan', 'The Strip', 'Westside',],
};

const SETTLEMENT_OPTIONS = [
  { id: 'california', label: 'CALIFORNIA' },
  { id: 'capital', label: 'CAPITAL WASTELAND' },
  { id: 'common', label: 'COMMONWEALTH' },
  { id: 'mojave', label: 'MOJAVE WASTELAND' },
];

function isValidTotal(total) { return total >= CARAVAN_MIN && total <= CARAVAN_MAX; }
function isBust(total) { return total > CARAVAN_MAX; }

let nextCardId = 1;
function makeCard(rank, suit, deckId = 0) {
  return {
    id: nextCardId++,
    rank, suit, deckId,
    isFace: FACE.has(rank),
    isNumber: !FACE.has(rank),
    value: RANK_VALUE[rank] || 0,
    isRed: SUIT_RED[suit],
  };
}

function buildDeckFromDescriptors(descriptors, deckId = 0) {
  return descriptors.map(d => makeCard(d.rank, d.suit, deckId));
}

function buildStandardDeck(deckId = 0) {
  const cards = [];
  for (const s of SUITS) for (const r of RANKS) cards.push(makeCard(r, s, deckId));
  for (let i = 0; i < 2; i++) cards.push(makeCard('JK', 'joker', deckId));
  return cards;
}

function cardLabel(c) { return `${c.rank}${SUIT_GLYPH[c.suit]}`; }

function cpuBidRange(diff) { return CPU_BIDS[diff] || CPU_BIDS.medium; }

function descriptorsEqual(a, b) {
  return a.rank === b.rank && a.suit === b.suit && (a.slot || null) === (b.slot || null);
}

function fullPoolDescriptors() {
  const out = [];
  for (const suit of SUITS) { for (const rank of RANKS) out.push({ rank, suit }); }
  out.push({ rank: 'JK', suit: 'joker', slot: 1 });
  out.push({ rank: 'JK', suit: 'joker', slot: 2 });
  return out;
}

function pickCpuName(difficulty) {
  const pool = CPU_NAMES[difficulty] || CPU_NAMES.medium;
  return pool[Math.floor(Math.random() * pool.length)];
}

function poss(targetName, actorName) {
  if (targetName === actorName) { return actorName === 'YOU' ? 'your' : 'their'; }
  return targetName === 'YOU' ? 'your' : targetName + "'s";
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomDeckDescriptors() {
  const pool = fullPoolDescriptors();
  const maxSize = pool.length;
  const size = DECK_MIN + Math.floor(Math.random() * (maxSize - DECK_MIN + 1));
  return shuffle(pool).slice(0, size);
}
