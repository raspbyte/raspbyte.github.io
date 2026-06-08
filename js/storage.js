const Storage = {
  _load(key, parse, fallback) {
    try {
      const v = localStorage.getItem('caravan:' + key);
      if (v !== null) return parse(v);
    } catch (e) { }
    return fallback;
  },
  _save(key, value) {
    try { localStorage.setItem('caravan:' + key, String(value)); } catch (e) { }
  },
  async getCaps() { return this._load('caps', v => parseInt(v, 10), STARTING_CAPS); },
  async setCaps(n) { this._save('caps', n); },
  async getCustomDeck() { return this._load('customDeck', v => JSON.parse(v), null); },
  async setCustomDeck(d) { this._save('customDeck', JSON.stringify(d)); },
  async getHighScore() { return this._load('highscore', v => parseInt(v, 10), STARTING_CAPS); },
  async setHighScore(n) { this._save('highscore', n); },
  async getStr(key, fb) { return this._load(key, v => v, fb); },
  async setStr(key, v) { this._save(key, v); },
  async getWins() {
    return this._load('wins', v => {
      const p = JSON.parse(v);
      return { w: p.w || 0, l: p.l || 0, streak: p.streak || 0, streakKind: p.streakKind || null };
    }, { w: 0, l: 0, streak: 0, streakKind: null });
  },
  async setWins(rec) { this._save('wins', JSON.stringify(rec)); },
};
