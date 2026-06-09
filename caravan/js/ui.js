const App = {
  aiThinking: false,
  builderDeck: fullPoolDescriptors(),
  caps: STARTING_CAPS,
  customDeck: null,
  difficulty: 'medium',
  discardCaravanMode: false,
  highScore: STARTING_CAPS,
  lastRenderedEffect: null,
  logExpanded: false,
  modal: null,
  onlineRole: null,
  palette: 'amber',
  pendingBet: 100,
  pendingDiscardCaravanIdx: null,
  pendingMode: 'singleplayer',
  pendingRoomCode: '',
  selected: null,
  settled: false,
  settlements: 'california',
  state: null,
  toastTimer: null,
  view: 'title',
  viewerIdx: 0,
  waitingForHost: false,
  wins: { w: 0, l: 0, streak: 0, streakKind: null },

  async init() {
    this.caps = await Storage.getCaps();
    this.customDeck = await Storage.getCustomDeck();
    this.highScore = await Storage.getHighScore();
    this.palette = await Storage.getStr('palette', this.palette);
    this.settlements = await Storage.getStr('settlements', this.settlements);
    this.wins = await Storage.getWins();
    this.applyPalette();
    this.render();
  },

  applyPalette() {
    const html = document.documentElement;
    for (const cls of [...html.classList]) {
      if (cls.startsWith('palette-')) html.classList.remove(cls);
    }
    const p = PALETTES.find(x => x.id === this.palette);
    if (p && p.className) html.classList.add(p.className);
  },

  renderStreak() {
    if (!this.wins.streak || !this.wins.streakKind) return '<span>—</span>';
    const letter = this.wins.streakKind.toUpperCase();
    return `<span>${this.wins.streak}${letter}</span>`;
  },

  render() {
    const app = document.getElementById('app');
    if (this.view === 'title') app.innerHTML = this.renderTitle();
    else if (this.view === 'deckbuilder') app.innerHTML = this.renderDeckBuilder();
    else if (this.view === 'game') app.innerHTML = this.renderGame();
    this.attachHandlers();
    if (this.modal) this.renderModal();
    this.playLastEffectAnimation();
    this.pinCaravanScroll();
  },

  pinCaravanScroll() {
    document.querySelectorAll('.caravan-stack').forEach(stack => {
      const caravan = stack.closest('.caravan');
      if (!caravan) return;
      if (caravan.classList.contains('opponent')) {
        stack.scrollTop = 0;
      } else {
        stack.scrollTop = stack.scrollHeight;
      }
    });
  },

  renderTitle() {
    return `
      <div class="corner-stamp">RASPBYTE.GITHUB.IO</div>
      <div class="cap-display">
        <span class="label">CAPS</span><span> ${this.caps}</span> <span class="label">BEST</span><span> ${this.highScore}</span>
        <div>
          <span class="label">W</span> ${this.wins.w} <span class="label">| L</span> ${this.wins.l} <span class="label">| S</span> ${this.renderStreak()}
        </div>
      </div>
      <div class="screen">
        <div class="title-block">
          <h1>CARAVAN</h1>
          <div class="deco">
            <h2><span class="deco-1">♠</span><span class="deco-2">♥</span><span class="deco-1">♦</span><span class="deco-2">♣</span></h2>
          </div>
        </div>
        <div class="menu">
          <button class="btn" data-action="new-singleplayer">SINGLE PLAYER</button>
          <button class="btn" data-action="new-hotseat">HOTSEAT</button>
          <button class="btn" data-action="new-multiplayer">MULTIPLAYER</button>
          <button class="btn btn-small" data-action="show-rules">HOW TO PLAY</button>
          <button class="btn btn-small" data-action="open-settings">SETTINGS</button>
        </div>
      </div>
    `;
  },

  renderDeckBuilder() {
    const deck = this.builderDeck;
    const pool = fullPoolDescriptors().filter(p => !deck.some(d => descriptorsEqual(d, p)));
    const sortKey = (d) => {
      const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3, joker: 4 };
      const rankOrder = RANKS.indexOf(d.rank);
      return suitOrder[d.suit] * 100 + rankOrder;
    };
    const sortedDeck = [...deck].sort((a, b) => sortKey(a) - sortKey(b));
    const sortedPool = [...pool].sort((a, b) => sortKey(a) - sortKey(b));
    const meetsMin = deck.length >= DECK_MIN;
    return `
      <div class="builder">
        <div class="builder-header">
          <h2>BUILD YOUR DECK</h2>
          <div class="builder-status">
            <span class="${meetsMin ? 'ok' : 'warn'}">${deck.length}</span> / ${DECK_MIN} cards
            ${meetsMin ? '<span class="ok">READY</span>' : `<span class="warn">NEED ${DECK_MIN - deck.length} MORE</span>`}
          </div>
        </div>

        <div class="builder-section">
          <div class="builder-section-label">YOUR DECK — click to remove</div>
          <div class="builder-row">
            ${sortedDeck.length > 0
        ? sortedDeck.map(d => this.renderBuilderCard(d, true)).join('')
        : '<div class="builder-empty">Deck is empty. Add cards from the pool below, or hit RANDOMIZE.</div>'}
          </div>
        </div>

        <div class="builder-section">
          <div class="builder-section-label">CARD POOL — click to add</div>
          <div class="builder-row">
            ${sortedPool.length > 0
        ? sortedPool.map(d => this.renderBuilderCard(d, false)).join('')
        : '<div class="builder-empty">Every card is in your deck.</div>'}
          </div>
        </div>

        <div class="builder-controls">
          <button class="btn btn-small" data-action="deck-fill-all">ADD ALL</button>
          <button class="btn btn-small" data-action="deck-randomize">RANDOMIZE</button>
          <button class="btn btn-small btn-danger" data-action="deck-clear">CLEAR</button>
          <span class="builder-spacer"></span>
          <button class="btn btn-small" data-action="deck-cancel">CANCEL</button>
          <button class="btn" data-action="deck-start-game" ${meetsMin ? '' : 'disabled'}>PLAY CARAVAN</button>
        </div>
      </div>
    `;
  },

  renderBuilderCard(descriptor, inDeck) {
    const slotAttr = descriptor.slot ? ` data-slot="${descriptor.slot}"` : '';
    return this.cardHTML(descriptor, {
      extra: 'small builder-card',
      attrs: `data-action="${inDeck ? 'deck-remove-card' : 'deck-add-card'}" ` +
        `data-rank="${descriptor.rank}" data-suit="${descriptor.suit}"${slotAttr}`,
    });
  },

  enterDeckBuilder() {
    this.builderDeck = this.customDeck ? [...this.customDeck] : [];
    this.view = 'deckbuilder';
    this.closeModal();
    this.render();
  },

  builderAddCard(rank, suit, slot) {
    const slotKey = slot ? parseInt(slot, 10) : null;
    const desc = slotKey ? { rank, suit, slot: slotKey } : { rank, suit };
    if (this.builderDeck.some(d => descriptorsEqual(d, desc))) return;
    this.builderDeck.push(desc);
    this.render();
  },

  builderRemoveCard(rank, suit, slot) {
    const slotKey = slot ? parseInt(slot, 10) : null;
    const desc = slotKey ? { rank, suit, slot: slotKey } : { rank, suit };
    this.builderDeck = this.builderDeck.filter(d => !descriptorsEqual(d, desc));
    this.render();
  },

  builderAddAll() {
    this.builderDeck = fullPoolDescriptors();
    this.render();
  },

  builderRandomize() {
    this.builderDeck = randomDeckDescriptors();
    this.render();
  },

  builderClear() {
    this.builderDeck = [];
    this.render();
  },

  async builderStartGame() {
    if (this.builderDeck.length < DECK_MIN) {
      this.toast(`Need at least ${DECK_MIN} cards`);
      return;
    }
    this.customDeck = [...this.builderDeck];
    await Storage.setCustomDeck(this.customDeck);
    this.state = makeInitialState({
      aiDifficulty: this.difficulty,
      mode: 'singleplayer',
      bet: this.pendingBet,
      settlements: this.settlements,
      playerDeckDescriptors: this.customDeck,
    });
    this.selected = null;
    this.viewerIdx = 0;
    this.view = 'game';
    this.render();
  },

  getViewerIdx() {
    if (!this.state) return 0;
    if (this.state.mode === 'singleplayer') return 0;
    if (this.state.mode === 'online') return this.onlineRole === 'joiner' ? 1 : 0;
    return this.viewerIdx;
  },

  isViewerActive() {
    if (!this.state || this.state.phase === 'ended') return false;
    if (this.aiThinking || this.waitingForHost) return false;
    return this.state.turn === this.getViewerIdx();
  },

  renderGame() {
    const s = this.state;
    const v = this.getViewerIdx();
    const o = 1 - v;
    const me = s.players[v];
    const them = s.players[o];
    const active = this.isViewerActive();
    const turnText = active ? 'YOUR MOVE'
      : (this.aiThinking ? 'PROCESSING…'
        : (s.mode === 'singleplayer' ? 'CPU TURN' : `${s.players[s.turn].name}'S TURN`));

    return `
      <div class="board">
        <div class="board-header">
          <div class="player-info">
            <span class="name">${them.name}</span>
            <span class="deck-count">DECK:${them.deck.length}</span>
          </div>
          <div class="turn-indicator ${active ? '' : 'theirs'}">${turnText}</div>
          <div class="player-info you-info">
            <span class="name">${me.name}</span>
            <span class="deck-count">DECK:${me.deck.length}</span>
            ${s.bet > 0 ? `<span>POT:${s.bet * 2}</span>` : ''}
            <button class="btn btn-small" data-action="quit-game">QUIT</button>
          </div>
        </div>

        ${this.renderCaravanRow(o, true)}
        ${this.renderTotalsSpacer()}
        ${this.renderCaravanRow(v, false)}

        <div class="hand-zone">
          <div class="action-hint">${this.renderHint()}</div>
          <div class="hand">
            ${active
        ? me.hand.map(c => this.renderHandCard(c)).join('')
        : me.hand.map(() => '<div class="card back"></div>').join('')}
          </div>
          <div class="action-bar">
            ${this.renderGameLog()}
            <button class="btn btn-small" data-action="discard-card" ${this.canDiscardSelected() ? '' : 'disabled'}>DISCARD CARD</button>
            <button class="btn btn-small btn-danger" data-action="toggle-discard-caravan" ${s.phase === 'play' && active && this.playerHasNonEmptyCaravan() ? '' : 'disabled'}>${this.discardCaravanMode ? 'CANCEL DISCARD' : 'DISCARD CARAVAN'}</button>
            <button class="btn btn-small" data-action="cancel-select" ${this.selected || this.discardCaravanMode ? '' : 'disabled'}>CANCEL</button>
          </div>
        </div>
      </div>
    `;
  },

  renderGameLog() {
    const log = (this.state && this.state.log) || [];
    const expanded = this.logExpanded;
    const countable = log.filter(l => !l.startsWith('└─')).length;
    const displayName = this.state && this.state.mode === 'singleplayer' ? this.state.players[1].name : null;
    const recent = log.slice().reverse();
    const latestIdx = recent.findIndex(l => !l.startsWith('└─'));
    const entries = recent.length
      ? recent.map((line, i) => {
        const text = displayName ? line.split(displayName).join('CPU') : line;
        return `<div class="game-log-entry ${i === latestIdx ? 'latest' : ''}">${text}</div>`;
      }).join('')
      : `<div class="game-log-entry game-log-empty">No moves yet.</div>`;
    return `
      <div class="game-log ${expanded ? 'expanded' : ''}">
        <div class="game-log-entries">${entries}</div>
        <div class="game-log-title" data-action="toggle-log">
          <span>GAME LOG${countable ? ` (${countable})` : ''}</span>
        </div>
      </div>
    `;
  },

  renderCaravanRow(playerIdx, isOpponent) {
    const cards = [0, 1, 2].map(i => this.renderCaravan(playerIdx, i, isOpponent)).join('');
    return `<div class="caravan-zone ${isOpponent ? 'opp-zone' : ''}">${cards}</div>`;
  },

  renderCaravan(playerIdx, caravanIdx, isOpponent) {
    const caravan = this.state.players[playerIdx].caravans[caravanIdx];

    const owner = Engine.caravanOwnership(this.state, caravanIdx);
    const v = this.getViewerIdx();
    let ownClass = '';
    if (owner === playerIdx) {
      ownClass = (owner === v) ? 'won-mine' : 'won-theirs';
    }

    const targetable = this.isTargetable({ playerIdx, caravanIdx });
    const targetableClass = targetable ? 'targetable' : '';

    const discardCaravanTargetable = this.discardCaravanMode
      && !isOpponent
      && this.isViewerActive()
      && this.state.phase === 'play'
      && caravan.rows.length > 0;
    const discardCaravanTargetClass = discardCaravanTargetable ? 'discard-target' : '';

    let rowHtmls = caravan.rows.map((row, ri) => this.renderRow(row, playerIdx, caravanIdx, ri, caravan.rows.length));
    if (isOpponent) rowHtmls = rowHtmls.reverse();
    const rows = rowHtmls.join('');
    const empty = `<div class="caravan-empty">EMPTY</div>`;

    return `
      <div class="caravan ${isOpponent ? 'opponent' : ''} ${ownClass} ${targetableClass} ${discardCaravanTargetClass}"
           data-caravan-target='${JSON.stringify({ playerIdx, caravanIdx })}'
           data-caravan-id="${playerIdx}-${caravanIdx}">
        <div class="caravan-stack">
          ${rows || empty}
        </div>
      </div>
    `;
  },

  renderTotalsSpacer() {
    const v = this.getViewerIdx();
    const o = 1 - v;
    const cols = [0, 1, 2].map(i => {
      const oppTotal = caravanTotal(this.state.players[o].caravans[i]);
      const myTotal = caravanTotal(this.state.players[v].caravans[i]);
      const owner = Engine.caravanOwnership(this.state, i);

      const oppDir = computeDirection(this.state.players[o].caravans[i]);
      const myDir = computeDirection(this.state.players[v].caravans[i]);
      const oppArrow = oppDir === 'up' ? '↑' : (oppDir === 'down' ? '↓' : '');
      const myArrow = myDir === 'up' ? '↑' : (myDir === 'down' ? '↓' : '');
      const oppSuit = caravanLastEffectiveSuit(this.state.players[o].caravans[i]);
      const mySuit = caravanLastEffectiveSuit(this.state.players[v].caravans[i]);

      const oppMarks = `${oppSuit ? SUIT_GLYPH[oppSuit] : ''}${oppArrow ? ' ' + oppArrow : ''}`;
      const myMarks = `${mySuit ? SUIT_GLYPH[mySuit] : ''}${myArrow ? ' ' + myArrow : ''}`;

      const oppOwned = owner === o ? 'owned' : '';
      const myOwned = owner === v ? 'owned' : '';

      const oppName = (this.state.players[o].caravanNames && this.state.players[o].caravanNames[i]) || ('OPP ' + (i + 1));
      const myName = (this.state.players[v].caravanNames && this.state.players[v].caravanNames[i]) || ('YOUR ' + (i + 1));

      return `
        <div class="totals-col">
          <span class="total-line ${this.totalClass(oppTotal)} ${oppOwned}">
            <span class="marks">${oppMarks}</span>
            <span class="value">${oppTotal || '—'}</span>
            <span class="name">${oppName}</span>
          </span>
          <span class="total-line ${this.totalClass(myTotal)} ${myOwned}">
            <span class="marks">${myMarks}</span>
            <span class="value">${myTotal || '—'}</span>
            <span class="name">${myName}</span>
          </span>
        </div>
      `;
    }).join('');
    return `<div class="caravan-spacer">${cols}</div>`;
  },

  totalClass(total) {
    if (total === 0) return '';
    if (isBust(total)) return 'bust';
    if (isValidTotal(total)) return 'valid';
    return '';
  },

  renderRow(row, playerIdx, caravanIdx, rowIdx, totalRows) {
    const rowTargetable = this.isTargetable({ playerIdx, caravanIdx, rowIdx });
    let targetableClass = '';
    if (rowTargetable) {
      targetableClass = 'targetable-card';
      const v = this.getViewerIdx();
      const selectedCard = this.selected && this.state.players[v].hand.find(c => c.id === this.selected.cardId);
      if (selectedCard && selectedCard.rank === 'J') {
        targetableClass += ' jack-target-preview';
      }
    }
    const attached = row.attached.map(c => this.renderCardHTML(c, { attached: true })).join('');
    const z = rowIdx + 1;
    return `
      <div class="stack-row ${targetableClass}" style="z-index: ${z}" data-row-target='${JSON.stringify({ playerIdx, caravanIdx, rowIdx })}' data-row-id="${playerIdx}-${caravanIdx}-${rowIdx}">
        ${this.renderCardHTML(row.number, { small: true })}
        ${attached ? `<div class="attached-cards">${attached}</div>` : ''}
      </div>
    `;
  },

  cardHTML(c, { extra = '', attrs = '' } = {}) {
    const glyph = SUIT_GLYPH[c.suit] || '';
    return `
      <div class="card ${this.cardClasses(c)} ${extra}" ${attrs}>
        ${this.cardFaceInner(c.rank, glyph)}
      </div>
    `;
  },

  cardClasses(c) {
    const red = (c.isRed ?? SUIT_RED[c.suit]) ? 'red' : '';
    return `${red} ${c.rank === 'JK' ? 'joker' : ''}`;
  },

  cardFaceInner(rank, glyph) {
    return `<div class="rank-tl"><span>${rank}</span><span class="suit-symbol">${glyph}</span></div>
        <div class="center-pip">${glyph}</div>
        <div class="rank-br"><span>${rank}</span><span class="suit-symbol">${glyph}</span></div>`;
  },

  renderCardHTML(card, opts = {}) {
    const size = opts.attached ? 'attached' : (opts.small ? 'small' : '');
    return this.cardHTML(card, { extra: size, attrs: `data-card-id="${card.id}"` });
  },

  renderHandCard(card) {
    const sel = this.selected && this.selected.cardId === card.id;
    const valid = this.cardHasAnyValidPlay(card);
    return this.cardHTML(card, {
      extra: `${sel ? 'selected' : ''} ${valid ? '' : 'invalid'}`,
      attrs: `data-card-id="${card.id}" data-hand-card="1"`,
    });
  },

  renderHint() {
    const s = this.state;
    if (s.phase === 'ended') return `GAME OVER`;
    if (!this.isViewerActive()) {
      return this.aiThinking ? 'CPU IS THINKING…' : `WAITING FOR ${s.players[s.turn].name}…`;
    }
    if (this.discardCaravanMode) {
      return `SELECT A CARAVAN TO DISCARD IT (USES YOUR TURN)`;
    }
    if (s.phase === 'opening') {
      const v = this.getViewerIdx();
      const need = 3 - s.openingPlaced[v];
      const hasNumber = s.players[v].hand.some(c => c.isNumber);
      if (!hasNumber) {
        return `OPENING — NO NUMBER CARDS LEFT, DISCARD A CARD TO DRAW A NEW ONE`;
      }
      return `OPENING — PLACE ${need} MORE NUMBER CARD${need === 1 ? '' : 'S'} ON YOUR CARAVANS`;
    }
    if (this.selected) {
      const v = this.getViewerIdx();
      const c = s.players[v].hand.find(x => x.id === this.selected.cardId);
      if (!c) return '';
      if (c.isNumber) return `SELECT A CARAVAN TO EXTEND, OR DISCARD`;
      if (c.rank === 'J') return `JACK — PLAY ON A NUMBER CARD TO REMOVE IT`;
      if (c.rank === 'Q') return `QUEEN — PLAY ON THE TOP CARD OF A CARAVAN TO CHANGE ITS DIRECTION & SUIT`;
      if (c.rank === 'K') return `KING — PLAY ON A NUMBER CARD TO DOUBLE ITS VALUE`;
      if (c.rank === 'JK') return `JOKER — PLAY ON A CARD TO REMOVE OTHERS OF THE SAME NUMBER (OR SUIT, IF ON AN ACE)`;
    }
    return `SELECT A CARD FROM YOUR HAND`;
  },

  isTargetable(target) {
    if (!this.selected || !this.isViewerActive()) return false;
    const v = this.getViewerIdx();
    const card = this.state.players[v].hand.find(c => c.id === this.selected.cardId);
    if (!card) return false;
    if (card.isFace !== (target.rowIdx !== undefined)) return false;
    return Engine.isValidPlay(this.state, v, card, target).ok;
  },

  cardHasAnyValidPlay(card) {
    const s = this.state;
    if (!this.isViewerActive()) return true;
    const v = this.getViewerIdx();
    if (s.phase === 'opening' && !s.players[v].hand.some(c => c.isNumber)) return true;
    if (card.isNumber) {
      for (let ci = 0; ci < 3; ci++) {
        if (Engine.isValidPlay(s, v, card, { playerIdx: v, caravanIdx: ci }).ok) return true;
      }
      return false;
    }
    return Engine.faceTargets(s, v, card).length > 0;
  },

  attachHandlers() {
    const app = document.getElementById('app');
    if (!app._delegated) {
      app.addEventListener('click', this.handleAppClick.bind(this));
      app.addEventListener('mouseover', this.handleAppMouseOver.bind(this));
      app.addEventListener('mouseout', this.handleAppMouseOut.bind(this));
      app._delegated = true;
    }
  },

  handleAppMouseOver(e) {
    if (!this.selected) return;
    const v = this.getViewerIdx();
    const selectedCard = this.state && this.state.players[v].hand.find(c => c.id === this.selected.cardId);
    if (!selectedCard || selectedCard.rank !== 'JK') return;
    let el = e.target;
    while (el && el !== e.currentTarget) {
      if (el.classList && el.classList.contains('stack-row')) break;
      el = el.parentElement;
    }
    if (!el || !el.getAttribute('data-row-target')) return;
    const target = JSON.parse(el.getAttribute('data-row-target'));
    const row = this.state.players[target.playerIdx].caravans[target.caravanIdx].rows[target.rowIdx];
    if (!row || row.number.isFace) return;
    this.showJokerPreview(row.number);
  },

  handleAppMouseOut(e) {
    let el = e.target;
    while (el && el !== e.currentTarget) {
      if (el.classList && el.classList.contains('stack-row')) {
        this.clearJokerPreview();
        return;
      }
      el = el.parentElement;
    }
  },

  showJokerPreview(targetCard) {
    this.clearJokerPreview();
    const isAce = targetCard.rank === 'A';
    const matchSuit = isAce ? targetCard.suit : null;
    const matchValue = isAce ? null : targetCard.value;
    document.querySelectorAll('.stack-row').forEach(el => {
      const t = JSON.parse(el.getAttribute('data-row-target'));
      const row = this.state.players[t.playerIdx].caravans[t.caravanIdx].rows[t.rowIdx];
      if (!row) return;
      if (row.number.id === targetCard.id) return;
      if (row.number.isFace) return;
      const matches = isAce
        ? (row.number.suit === matchSuit)
        : (row.number.value === matchValue);
      if (matches) {
        el.querySelectorAll('.card').forEach(c => c.classList.add('joker-target-preview'));
      }
    });
  },

  clearJokerPreview() {
    document.querySelectorAll('.joker-target-preview').forEach(el => el.classList.remove('joker-target-preview'));
  },

  handleAppClick(e) {
    let el = e.target;
    while (el && el !== e.currentTarget) {
      if (el.getAttribute) {
        const action = el.getAttribute('data-action');
        if (action) { this.onAction(action, el); return; }
        if (el.getAttribute('data-hand-card')) {
          const id = parseInt(el.getAttribute('data-card-id'), 10);
          this.onHandCardClick(id);
          return;
        }
        if (el.getAttribute('data-row-target') && el.classList.contains('targetable-card')) {
          this.onPlayTarget(JSON.parse(el.getAttribute('data-row-target')));
          return;
        }
        if (el.getAttribute('data-caravan-target') && el.classList.contains('discard-target')) {
          const target = JSON.parse(el.getAttribute('data-caravan-target'));
          this.confirmDiscardCaravan(target.caravanIdx);
          return;
        }
        if (el.getAttribute('data-caravan-target') && el.classList.contains('targetable')) {
          this.onPlayTarget(JSON.parse(el.getAttribute('data-caravan-target')));
          return;
        }
      }
      el = el.parentElement;
    }
  },

  onAction(action, el) {
    switch (action) {
      case 'toggle-log':
        this.logExpanded = !this.logExpanded;
        this.render();
        break;
      case 'new-singleplayer': this.showNewGameModal('singleplayer'); break;
      case 'new-hotseat': this.showNewGameModal('hotseat'); break;
      case 'new-multiplayer': this.showMultiplayerModal(); break;
      case 'host-game': this.startHosting(); break;
      case 'join-game': this.showJoinModal(); break;
      case 'do-join': this.startJoining(); break;
      case 'cancel-online': this.cancelOnline(); break;
      case 'copy-room-code': this.copyRoomCode(); break;
      case 'show-rules': this.showRulesModal(); break;
      case 'reset-caps': this.confirmResetCaps(); break;
      case 'do-reset': this.doReset(); break;
      case 'quit-game': this.quitFromGame(); break;
      case 'do-forfeit': this.doForfeit(); break;
      case 'discard-card': this.discardSelected(); break;
      case 'cancel-select':
        this.selected = null;
        this.discardCaravanMode = false;
        this.render();
        break;
      case 'close-modal': this.closeModal(); break;
      case 'set-difficulty':
        this.persistBetInput();
        this.difficulty = el.getAttribute('data-diff');
        this.renderModal();
        break;
      case 'set-settlement-pool':
        this.settlements = el.getAttribute('data-pool');
        Storage.setStr('settlements', this.settlements);
        this.renderModal();
        break;
      case 'set-palette':
        this.palette = el.getAttribute('data-palette');
        Storage.setStr('palette', this.palette);
        this.applyPalette();
        this.render();
        break;
      case 'open-settings':
        this.showSettingsModal();
        break;
      case 'start-game': this.startGameFromModal(); break;
      case 'deck-add-card':
        this.builderAddCard(el.getAttribute('data-rank'), el.getAttribute('data-suit'), el.getAttribute('data-slot'));
        break;
      case 'deck-remove-card':
        this.builderRemoveCard(el.getAttribute('data-rank'), el.getAttribute('data-suit'), el.getAttribute('data-slot'));
        break;
      case 'deck-randomize': this.builderRandomize(); break;
      case 'deck-fill-all': this.builderAddAll(); break;
      case 'deck-clear': this.builderClear(); break;
      case 'deck-start-game': this.builderStartGame(); break;
      case 'deck-cancel':
        this.view = 'title';
        this.builderDeck = fullPoolDescriptors();
        this.render();
        break;
      case 'go-title':
        this.resetToTitle();
        break;
      case 'play-again': {
        const mode = this.state ? this.state.mode : 'singleplayer';
        this.resetToTitle();
        this.showNewGameModal(mode);
        break;
      }
      case 'show-board':
        this.closeModal();
        break;
      case 'hotseat-continue':
        this.viewerIdx = this.state.turn;
        this.closeModal();
        this.render();
        break;
      case 'toggle-discard-caravan':
        if (this.discardCaravanMode) {
          this.discardCaravanMode = false;
        } else {
          this.discardCaravanMode = true;
          this.selected = null;
        }
        this.render();
        break;
      case 'do-discard-caravan':
        this.doDiscardCaravan();
        break;
    }
  },

  persistBetInput() {
    const inp = document.getElementById('bet-input');
    if (inp) this.pendingBet = parseInt(inp.value, 10) || 0;
  },

  resetToTitle() {
    this.state = null;
    this.selected = null;
    this.viewerIdx = 0;
    this.discardCaravanMode = false;
    this.settled = false;
    this.view = 'title';
    this.closeModal();
    this.render();
  },

  executeMove(move) {
    if (this.state.mode === 'online' && this.onlineRole === 'joiner') {
      if (this.waitingForHost) return;
      this.waitingForHost = true;
      this.selected = null;
      this.discardCaravanMode = false;
      const sent = Transport.send({ type: 'move', move });
      if (!sent) {
        this.waitingForHost = false;
        this.toast("Lost connection to opponent");
      }
      this.render();
      return;
    }
    const v = this.getViewerIdx();
    try { Engine.applyMove(this.state, v, move); }
    catch (e) {
      this.toast(e.message);
      return;
    }
    this.selected = null;
    this.discardCaravanMode = false;
    this.render();
    if (this.state.mode === 'online' && this.onlineRole === 'host') {
      this.broadcastState();
    }
    this.afterMove();
  },

  onHandCardClick(cardId) {
    if (!this.isViewerActive()) return;
    const v = this.getViewerIdx();
    const card = this.state.players[v].hand.find(c => c.id === cardId);
    if (!card) return;
    if (!this.cardHasAnyValidPlay(card) && this.state.phase === 'opening') {
      this.toast("Opening — cannot play face cards");
      return;
    }
    if (this.selected && this.selected.cardId === cardId) {
      this.selected = null;
    } else {
      this.selected = { cardId };
    }
    this.render();
  },

  onPlayTarget(target) {
    if (!this.selected || !this.isViewerActive()) return;
    this.executeMove({ type: 'play', cardId: this.selected.cardId, target });
  },

  discardSelected() {
    if (!this.selected || !this.isViewerActive()) return;
    this.executeMove({ type: 'discardCard', cardId: this.selected.cardId });
  },

  afterMove() {
    if (this.state.phase === 'ended') {
      this.handleGameOver();
      return;
    }
    const hadGhosts = this.state.lastEffect
      && this.state.lastEffect.removedRows
      && this.state.lastEffect.removedRows.length > 0;
    const followupDelay = hadGhosts ? FLASH_MS : 0;

    if (this.state.mode === 'singleplayer' && this.state.turn === 1) {
      setTimeout(() => {
        this.aiThinking = true;
        this.render();
        setTimeout(() => this.runAITurn(), 700 + Math.random() * 500);
      }, followupDelay);
    } else if (this.state.mode === 'hotseat' && this.state.turn !== this.viewerIdx) {
      setTimeout(() => this.showPassDeviceModal(), followupDelay);
    }
  },

  runAITurn() {
    if (this.state.phase === 'ended') { this.aiThinking = false; this.render(); return; }
    const move = AI.chooseMove(this.state, 1, this.state.aiDifficulty);
    if (!move) { this.aiThinking = false; this.render(); return; }
    try { Engine.applyMove(this.state, 1, move); }
    catch (e) { console.error("AI error", e); }
    this.aiThinking = false;
    this.render();
    this.notifyOpponentEffect();
    if (this.state.phase === 'ended') {
      setTimeout(() => this.handleGameOver(), 600);
      return;
    }
    if (this.state.turn === 1) {
      this.aiThinking = true;
      this.render();
      setTimeout(() => this.runAITurn(), 700 + Math.random() * 500);
    }
  },

  notifyOpponentEffect() {
    const fx = this.state.lastEffect;
    if (!fx || fx.byPlayer === this.getViewerIdx()) return;
    const oppName = this.state.players[fx.byPlayer].name;
    const target = (fx.targetPlayer === this.getViewerIdx()) ? 'YOUR' : 'their';
    const lane = fx.caravanIdx + 1;
    const EFFECTS = {
      jack: { verb: FACE_VERB.J, prep: 'out of' },
      queen: { verb: FACE_VERB.Q, prep: 'on' },
      king: { verb: FACE_VERB.K, prep: 'on' },
      joker: { verb: FACE_VERB.JK, prep: 'on' },
    };
    let msg = '';
    if (EFFECTS[fx.kind]) {
      const { verb, prep } = EFFECTS[fx.kind];
      msg = `${oppName} ${verb} a card ${prep} ${target} caravan ${lane}`;
    } else if (fx.kind === 'discardCaravan') {
      msg = `${oppName} discarded their caravan ${lane}`;
    } else if (fx.kind === 'discardCard') {
      msg = `${oppName} discarded a card`;
    }
    if (msg) this.toast(msg, 'notice');
  },

  flash(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    if (ms) setTimeout(() => el.classList.remove(cls), ms);
  },

  playLastEffectAnimation() {
    const fx = this.state && this.state.lastEffect;
    if (!fx) { this.lastRenderedEffect = null; return; }
    const sig = JSON.stringify(fx);
    if (this.lastRenderedEffect === sig) return;
    this.lastRenderedEffect = sig;

    if (fx.targetPlayer === undefined || fx.caravanIdx === undefined) return;

    const carvEl = document.querySelector(`[data-caravan-id="${fx.targetPlayer}-${fx.caravanIdx}"]`);
    this.flash(carvEl, 'caravan-flash');

    if (fx.kind === 'king' || fx.kind === 'queen' || fx.kind === 'joker') {
      if (fx.rowIdx !== undefined) {
        const rowEl = document.querySelector(`[data-row-id="${fx.targetPlayer}-${fx.caravanIdx}-${fx.rowIdx}"] .card`);
        this.flash(rowEl, 'attach-flash', FLASH_MS);
      }
      if (fx.kind === 'joker') {
        for (const key of (fx.affectedCaravans || [])) {
          this.flash(document.querySelector(`[data-caravan-id="${key}"]`), 'jack-flash', FLASH_MS);
        }
      }
    }

    if (fx.removedRows && fx.removedRows.length > 0) {
      this.showRemovedGhosts(fx.removedRows);
    }
  },

  showRemovedGhosts(removedRows) {
    const byCaravan = new Map();
    for (const rr of removedRows) {
      const key = `${rr.playerIdx}-${rr.caravanIdx}`;
      if (!byCaravan.has(key)) byCaravan.set(key, []);
      byCaravan.get(key).push(rr);
    }
    for (const [key, rrs] of byCaravan) {
      const carvEl = document.querySelector(`[data-caravan-id="${key}"]`);
      if (!carvEl) continue;
      const stackEl = carvEl.querySelector('.caravan-stack');
      if (!stackEl) continue;
      const isOpponent = carvEl.classList.contains('opponent');
      const totalOriginal = stackEl.children.length + rrs.length;
      const placements = rrs.map(rr => ({
        rr,
        domIdx: isOpponent ? (totalOriginal - 1 - rr.rowIdx) : rr.rowIdx,
      }));
      placements.sort((a, b) => a.domIdx - b.domIdx);
      for (const { rr, domIdx } of placements) {
        const ghost = this.makeGhostRowElement(rr.row, rr.rowIdx, isOpponent);
        const ref = stackEl.children[domIdx];
        if (ref) stackEl.insertBefore(ghost, ref);
        else stackEl.appendChild(ghost);
        setTimeout(() => ghost.remove(), FLASH_MS);
      }
      stackEl.dataset.ghosting = '1';
      setTimeout(() => delete stackEl.dataset.ghosting, FLASH_MS);
    }
  },

  makeGhostRowElement(row, rowIdx, isOpponent) {
    const z = 2 * rowIdx + 1;
    const div = document.createElement('div');
    div.className = 'stack-row ghost-removing';
    div.style.zIndex = z;
    const attached = row.attached.map(c => this.renderCardHTML(c, { attached: true })).join('');
    div.innerHTML = `
      ${this.renderCardHTML(row.number, { small: true })}
      ${attached ? `<div class="attached-cards">${attached}</div>` : ''}
    `;
    return div;
  },

  showPassDeviceModal() {
    this.setModal({
      type: 'pass',
      title: `PASS TO ${this.state.players[this.state.turn].name}`,
      body: `<p>Give the controls to the other player, then hit CONTINUE.</p>`,
      buttons: [{ label: 'CONTINUE', action: 'hotseat-continue' }],
    });
  },

  recordResult(kind) {
    this.wins[kind]++;
    this.wins.streak = this.wins.streakKind === kind ? this.wins.streak + 1 : 1;
    this.wins.streakKind = kind;
  },

  async handleGameOver() {
    const s = this.state;
    const w = s.winner;
    const v = this.getViewerIdx();
    const won = w === v;
    const tie = w === null;
    const bet = s.bet;
    let delta = 0;
    if (s.mode === 'singleplayer' && bet > 0 && !this.settled) {
      this.settled = true;
      if (won) delta = +bet;
      else if (!tie) delta = -bet;
      this.caps += delta;
      if (this.caps < 0) this.caps = 0;
      if (this.caps > this.highScore) this.highScore = this.caps;
      if (won) {
        this.recordResult('w');
      } else if (!tie) {
        this.recordResult('l');
      }
      await Storage.setCaps(this.caps);
      await Storage.setHighScore(this.highScore);
      await Storage.setWins(this.wins);
    }
    const owners = [0, 1, 2].map(i => Engine.caravanOwnership(s, i));
    const scoreLine = owners.map((o, i) => {
      const t0 = caravanTotal(s.players[0].caravans[i]);
      const t1 = caravanTotal(s.players[1].caravans[i]);
      const winnerName = o === null ? 'NONE' : (s.mode === 'singleplayer' && o === 1 ? 'CPU' : s.players[o].name);
      return `Caravan ${i + 1}: ${t0} vs ${t1} — ${winnerName}`;
    }).join('<br/>');

    const winnerColor = tie ? 'var(--text-2)' : (won ? 'var(--primary)' : 'var(--danger)');
    const headline = tie ? 'STALEMATE'
      : (s.mode === 'singleplayer'
        ? (won ? 'VICTORY' : 'DEFEAT')
        : `${s.players[w].name} WINS`);
    const subheadline = tie
      ? "Nobody walks away with the pot."
      : (s.mode === 'singleplayer'
        ? (won ? `You take ${bet ? bet + ' caps' : 'the win'}.` : `${s.players[1].name} takes ${bet ? bet + ' caps' : 'the win'}.`)
        : `${s.players[w].name} wins the match.`);

    this.setModal({
      type: 'gameover',
      title: headline,
      body: `
        <p style="color:${winnerColor};">${subheadline}</p>
        <p>${scoreLine}</p>
        ${s.mode === 'singleplayer' ? `<p style="color:var(--text);">CAPS:<span class="key">${this.caps}</span> BEST:<span class="key">${this.highScore}</span></p>` : ''}
      `,
      buttons: s.mode === 'online' ? [
        { label: 'SHOW BOARD', action: 'show-board' },
        { label: 'LEAVE GAME', action: 'cancel-online' },
      ] : [
        { label: 'SHOW BOARD', action: 'show-board' },
        { label: 'PLAY AGAIN', action: 'play-again' },
        { label: 'LEAVE GAME', action: 'go-title' },
      ],
    });
  },

  showNewGameModal(mode) {
    this.pendingMode = mode;
    const range = cpuBidRange(this.difficulty);
    const playerMax = Math.min(range.max, this.caps);
    this.pendingBet = Math.min(Math.max(this.pendingBet || range.min, range.min), playerMax);
    this.setModal({
      type: 'newgame',
      title: mode === 'hotseat' ? 'HOTSEAT MATCH' : 'NEW MATCH',
      body: () => this.renderNewGameBody(),
      buttons: [
        { label: 'PLAY CARAVAN', action: 'start-game' },
        { label: 'CANCEL', action: 'close-modal' },
      ],
    });
  },

  renderNewGameBody() {
    if (this.pendingMode !== 'singleplayer') {
      return `<p>Local multiplayer. Take turns on the same device.</p>
        <p class="small">Hotseat matches don't affect your caps or stats.</p>`;
    }
    const diffs = [
      { id: 'easy', label: 'EASY' },
      { id: 'medium', label: 'MEDIUM' },
      { id: 'hard', label: 'HARD' },
    ];
    const diffButtons = diffs.map(d => {
      const r = cpuBidRange(d.id);
      const active = this.difficulty === d.id;
      return `<button type="button"
        class="btn btn-small ${active ? 'active' : ''}"
        data-action="set-difficulty" data-diff="${d.id}">
          ${d.label} <span style="opacity:0.7;">(${r.min})</span>
      </button>`;
    }).join('');

    const range = cpuBidRange(this.difficulty);
    const playerMax = Math.min(range.max, this.caps);
    const canAfford = this.caps >= range.min;
    const inputValue = Math.min(Math.max(this.pendingBet || 0, 0), Math.max(playerMax, 0));

    const stakeLine = canAfford
      ? `Opponent bids <span class="key">${range.min}</span> caps and matches up to <span class="key">${range.max}</span>.`
      : `Opponent bids <span class="key">${range.min}</span> caps — more than you have. Bid 0 for free play.`;

    const helpLine = canAfford
      ? `Match ${range.min}, raise up to ${playerMax}, or bid 0 for free play.`
      : `Bid 0 to play without stakes — caps and streak are unaffected.`;

    const bidSection = `
      <p>${stakeLine}</p>
      <div class="form-row">
        <label>YOUR BID:</label>
        <input class="bet-input" id="bet-input" type="number" min="0" max="${Math.max(playerMax, 0)}" value="${inputValue}" />
        <label>/ ${this.caps}</label>
      </div>
      <p class="small">${helpLine}</p>
    `;

    return `
      <p>Choose difficulty:</p>
      <div class="btn-row">${diffButtons}</div>
      ${bidSection}
    `;
  },

  startGameFromModal() {
    let bet = 0;
    if (this.pendingMode === 'singleplayer') {
      const range = cpuBidRange(this.difficulty);
      const playerMax = Math.min(range.max, this.caps);
      const inp = document.getElementById('bet-input');
      const raw = inp ? inp.value.trim() : '';
      if (raw === '') {
        this.toast(`Bid at least ${range.min} caps to match, or 0 for free play`);
        return;
      }
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed) || !/^-?\d+$/.test(raw)) {
        this.toast("Bid must be a whole number");
        return;
      }
      if (parsed < 0) {
        this.toast("Bid cannot be negative");
        return;
      }
      if (parsed > 0) {
        if (this.caps < range.min) {
          this.toast(`Need ${range.min} caps for ${this.difficulty.toUpperCase()}; you have ${this.caps}`);
          return;
        }
        if (parsed < range.min) {
          this.toast(`Bid ${range.min}-${range.max} for ${this.difficulty.toUpperCase()} or 0 for free play`);
          return;
        }
        if (parsed > playerMax) {
          if (parsed > this.caps) this.toast(`Bid cannot exceed your ${this.caps} caps`);
          else this.toast(`CPU won't match more than ${range.max}`);
          return;
        }
      }
      bet = parsed;
      this.pendingBet = bet;
    }

    if (this.pendingMode === 'singleplayer') {
      this.enterDeckBuilder();
      return;
    }

    this.state = makeInitialState({
      aiDifficulty: this.difficulty,
      mode: this.pendingMode,
      bet,
      settlements: this.settlements,
    });
    this.selected = null;
    this.viewerIdx = 0;
    this.view = 'game';
    this.closeModal();
    this.render();
  },

  toggleButtonRow(items, action, dataKey, activeId) {
    return items.map(it =>
      `<button type="button" class="btn btn-small ${activeId === it.id ? 'active' : ''}" data-action="${action}" data-${dataKey}="${it.id}">${it.label}</button>`
    ).join('');
  },

  showSettingsModal() {
    this.setModal({
      type: 'settings',
      title: 'SETTINGS',
      body: () => `
        <p>Color palette:</p>
        <div class="btn-row">
          ${this.toggleButtonRow(PALETTES, 'set-palette', 'palette', this.palette)}
        </div>
        <p>Caravan name region:</p>
        <div class="btn-row">
          ${this.toggleButtonRow(SETTLEMENT_OPTIONS, 'set-settlement-pool', 'pool', this.settlements)}
        </div>
        <p class="small">Both your caravans and your opponent's draw settlement names from this region.</p>
        <p>Stats:</p>
        <div class="btn-row">
          <button type="button" class="btn btn-small btn-danger" data-action="reset-caps">RESET CAPS &amp; STREAK</button>
        </div>
        <p class="small">Sets you back to ${STARTING_CAPS} caps and clears your win/loss record.</p>
      `,
      buttons: [{ label: 'CLOSE', action: 'close-modal' }],
    });
  },

  showMultiplayerModal() {
    this.setModal({
      type: 'multiplayer',
      title: 'MULTIPLAYER',
      body: `
        <p>Play with a friend over the internet.</p>
        <p class="small">Online matches don't affect your caps or stats.</p>
      `,
      buttons: [
        { label: 'HOST GAME', action: 'host-game' },
        { label: 'JOIN GAME', action: 'join-game' },
        { label: 'CANCEL', action: 'close-modal' },
      ],
    });
  },

  startHosting() {
    this.setModal({
      type: 'hosting',
      title: 'HOSTING',
      body: () => this.renderHostingBody(),
      buttons: [{ label: 'CANCEL', action: 'cancel-online' }],
    });
    Transport.initHost({
      onRoomReady: (id) => { this.renderModal(); },
      onConnected: () => { this.startOnlineGameAsHost(); },
      onMessage: (msg) => this.handleOnlineMessage(msg),
      onDisconnect: () => this.handleOnlineDisconnect(),
      onError: (e) => this.handleOnlineError(e),
    }).catch(e => {
      this.toast("Couldn't start hosting: " + (e.message || e));
      this.cancelOnline();
    });
  },

  renderHostingBody() {
    if (Transport.status === 'waiting' && Transport.roomCode) {
      return `
        <p>Share this room code with your opponent:</p>
        <div class="room-code">${Transport.roomCode}</div>
        <div class="form-row">
          <button class="btn btn-small" data-action="copy-room-code">COPY CODE</button>
        </div>
        <p class="small">Waiting for them to join...</p>
      `;
    }
    if (Transport.status === 'error') {
      return `<p class="error">Couldn't reach the matchmaking server. Check your connection.</p>`;
    }
    return `<p>Setting up your room...</p>`;
  },

  showJoinModal() {
    this.pendingRoomCode = '';
    this.setModal({
      type: 'joining',
      title: 'JOIN GAME',
      body: () => this.renderJoinBody(),
      buttons: [
        { label: 'JOIN', action: 'do-join' },
        { label: 'CANCEL', action: 'close-modal' },
      ],
    });
  },

  renderJoinBody() {
    if (Transport.status === 'connecting' || Transport.status === 'waiting') {
      return `
        <p>Connecting to <span class="key">${Transport.roomCode || ''}</span>...</p>
      `;
    }
    if (Transport.status === 'error') {
      return `
        <p class="error">Couldn't connect. Check the code and try again.</p>
        <div class="form-row">
          <label>CODE:</label>
          <input class="bet-input" id="room-code-input" type="text" value="${this.pendingRoomCode}" placeholder="XXXXXX" autocomplete="off" />
        </div>
      `;
    }
    return `
      <p>Enter the room code your opponent shared with you:</p>
      <div class="form-row">
        <label>CODE:</label>
        <input class="bet-input" id="room-code-input" type="text" value="${this.pendingRoomCode}" placeholder="XXXXXX" autocomplete="off" />
      </div>
    `;
  },

  startJoining() {
    const inp = document.getElementById('room-code-input');
    const code = inp ? inp.value.trim() : '';
    if (!code) { this.toast("Enter a room code"); return; }
    this.pendingRoomCode = code;
    Transport.initJoiner(code, {
      onConnected: () => this.renderModal(),
      onMessage: (msg) => this.handleOnlineMessage(msg),
      onDisconnect: () => this.handleOnlineDisconnect(),
      onError: (e) => {
        this.renderModal();
      },
    }).catch(e => {
      this.toast("Couldn't connect: " + (e.message || e));
      this.cancelOnline();
    });
    this.renderModal();
  },

  cancelOnline() {
    Transport.disconnect();
    this.onlineRole = null;
    this.waitingForHost = false;
    this.pendingRoomCode = '';
    this.resetToTitle();
  },

  copyRoomCode() {
    if (!Transport.roomCode) return;
    const code = Transport.roomCode;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(
        () => this.toast("Room code copied", 'notice'),
        () => this.toast("Couldn't copy room code")
      );
    } else {
      this.toast("Select the code to copy");
    }
  },

  startOnlineGameAsHost() {
    this.onlineRole = 'host';
    this.state = makeInitialState({
      mode: 'online',
      settlements: this.settlements,
    });
    this.view = 'game';
    this.selected = null;
    this.discardCaravanMode = false;
    this.waitingForHost = false;
    this.closeModal();
    this.broadcastState();
    this.render();
  },

  handleOnlineMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'state') {
      this.onlineRole = 'joiner';
      this.state = msg.state;
      this.view = 'game';
      this.selected = null;
      this.discardCaravanMode = false;
      this.waitingForHost = false;
      this.closeModal();
      this.render();
      this.notifyOpponentEffect();
      if (this.state.phase === 'ended') {
        this.handleGameOver();
      }
      return;
    }
    if (msg.type === 'move') {
      if (this.onlineRole !== 'host' || !this.state) return;
      const move = msg.move;
      try { Engine.applyMove(this.state, 1, move); }
      catch (e) { Transport.send({ type: 'rejected', reason: e.message }); return; }
      this.broadcastState();
      this.render();
      this.notifyOpponentEffect();
      if (this.state.phase === 'ended') this.handleGameOver();
      return;
    }
    if (msg.type === 'rejected') {
      this.waitingForHost = false;
      this.toast("Move rejected: " + (msg.reason || 'unknown'));
      this.render();
      return;
    }
    if (msg.type === 'forfeit') {
      this.toast("Opponent forfeited");
      this.cancelOnline();
      return;
    }
  },

  broadcastState() {
    Transport.send({ type: 'state', state: redactStateForJoiner(this.state) });
  },

  handleOnlineDisconnect() {
    if (this.view !== 'game') {
      this.cancelOnline();
      return;
    }
    this.setModal({
      type: 'disconnected',
      title: 'CONNECTION LOST',
      body: `<p>Opponent disconnected.</p>`,
      buttons: [{ label: 'LEAVE GAME', action: 'cancel-online' }],
    });
  },

  handleOnlineError(e) {
    console.error('Transport error', e);
  },

  showRulesModal() {
    this.setModal({
      type: 'rules',
      title: 'HOW TO PLAY',
      body: `<div class="rules-text">
        <h3>GAMEPLAY</h3>
        <p>Caravan is played with two players building three opposing piles (or "caravans") of numbered cards. The goal is to outbid your opponent's caravan with the highest value of numbered cards without being too light (under 21) or overburdened (over 26).</p>

        <p>The game begins with each player taking eight cards from their deck and placing either one numerical card or ace on each caravan. Players may not discard during this initial round.</p>

        <p>Once both players have started their three caravans, each player may do one of the following on their turn:</p>

        <ul>
          <li>Play one card and draw a new card from their deck to their hand</li>
          <li>Discard one card from their hand and draw a new card from their deck, or</li>
          <li>Discard one of their caravans by removing all cards from that pile</li>
        </ul>

        <p>Caravans have a direction, either ascending or descending numerically, and a suit. The suit is determined with the first card placed on a caravan, the direction by the second. All subsequent cards must continue the numerical direction or match the suit of the previous card. Cards of the same numerical value cannot be played in sequence, regardless of suit. Face cards can be attached to numeric cards in any caravan and will affect them in various ways.</p>
        <br>
        <h3>CARD VALUES</h3>
        <ul>
          <li><b>Joker</b> — Played against Ace, 2-10. Effects change based on whether it is an ace or numbered card (see below). Multiple jokers may be played on the same card.</li>
          <li><b>Ace</b> — Value of 1. Jokers played on aces remove all other non-face cards of the ace's suit from the table. E.g. a joker played on an A♠ removes all spades (except face cards and that card, specifically) from the table.</li>
          <li><b>2-10</b> — Listed value. Jokers played on these remove all other cards of this value from the table. E.g. a joker player on a 4♥ removes all 4s (other than that card, specifically) from the table.</li>
          <li><b>Jack</b> — Played against Ace, 2-10. Removes that card, along with any face cards attached to it.</li>
          <li><b>Queen</b> — Played against Ace, 2-10. Reverses the current direction of the hand, changes the current suit of the hand. Multiple queens may be played on the same card.</li>
          <li><b>King</b> — Played against Ace, 2-10. Adds the value of that card again. E.g. a king played on a 9 adds 9 to that hand. Multiple kings may be played on the same card for multiplicative effects. E.g. 4 + king = 8. 4 + two kings = 16.</li>
        </ul>
        <br>
        <h3>WINNING</h3>
        <p>A player's caravan is considered sold when the value of its cards is over 20 and under 27. The other player may still outbid by increasing the value of their opposing pile while still staying within the 21-26 range. When each of the three competing caravans has sold, the game is over. In the event that one of the three caravan values are tied between players, the game continues until all three caravans have sold. The player with two or more sales wins the pot.</p>
      </div>`,
      buttons: [{ label: 'CLOSE', action: 'close-modal' }],
    });
  },

  confirmDiscardCaravan(caravanIdx) {
    const v = this.getViewerIdx();
    const caravan = this.state.players[v].caravans[caravanIdx];
    if (!caravan || caravan.rows.length === 0) return;
    this.pendingDiscardCaravanIdx = caravanIdx;
    this.setModal({
      type: 'confirm',
      title: 'DISCARD CARAVAN?',
      body: `<p>Clear caravan ${caravanIdx + 1} entirely? This uses your turn.</p>`,
      buttons: [
        { label: 'DISCARD IT', action: 'do-discard-caravan', danger: true },
        { label: 'CANCEL', action: 'close-modal' },
      ],
    });
  },

  doDiscardCaravan() {
    const idx = this.pendingDiscardCaravanIdx;
    this.closeModal();
    this.executeMove({ type: 'discardCaravan', caravanIdx: idx });
  },

  playerHasNonEmptyCaravan() {
    if (!this.state) return false;
    const v = this.getViewerIdx();
    return this.state.players[v].caravans.some(c => c.rows.length > 0);
  },

  canDiscardSelected() {
    if (!this.selected || !this.isViewerActive() || this.discardCaravanMode) return false;
    const s = this.state;
    if (s.phase !== 'opening') return true;
    const v = this.getViewerIdx();
    const hasNumber = s.players[v].hand.some(c => c.isNumber);
    return !hasNumber;
  },

  confirmResetCaps() {
    this.setModal({
      type: 'confirm',
      title: 'RESET STATS?',
      body: `<p>This resets your caps, high score, and win/loss record!</p>`,
      buttons: [
        { label: 'YES, RESET', action: 'do-reset', danger: true },
        { label: 'CANCEL', action: 'open-settings' },
      ],
    });
  },

  async doReset() {
    this.caps = STARTING_CAPS;
    this.highScore = STARTING_CAPS;
    this.wins = { w: 0, l: 0, streak: 0, streakKind: null };
    await Storage.setCaps(this.caps);
    await Storage.setHighScore(this.highScore);
    await Storage.setWins(this.wins);
    this.closeModal();
    this.render();
  },

  quitFromGame() {
    if (!this.state || this.state.phase === 'ended') {
      if (this.state && this.state.mode === 'online') { this.cancelOnline(); return; }
      this.resetToTitle();
      return;
    }
    this.setModal({
      type: 'confirm',
      title: 'FORFEIT MATCH?',
      body: `<p>${this.state.mode === 'singleplayer' && this.state.bet > 0
        ? `You'll lose your ${this.state.bet}-cap wager.`
        : (this.state.mode === 'online' ? 'Forfeiting will disconnect you from your opponent.' : 'Return to the title screen?')
        }</p>`,
      buttons: [
        { label: 'FORFEIT', action: 'do-forfeit', danger: true },
        { label: 'KEEP PLAYING', action: 'close-modal' },
      ],
    });
  },

  async doForfeit() {
    if (this.state && this.state.mode === 'online') {
      Transport.send({ type: 'forfeit' });
      this.cancelOnline();
      return;
    }
    if (this.state && this.state.mode === 'singleplayer' && this.state.bet > 0) {
      this.caps = Math.max(0, this.caps - this.state.bet);
      this.recordResult('l');
      await Storage.setCaps(this.caps);
      await Storage.setWins(this.wins);
    }
    this.resetToTitle();
  },

  setModal(config) {
    this.modal = config;
    this.renderModal();
  },

  renderModal() {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', this.handleModalClick.bind(this));
    }
    if (!this.modal) { overlay.remove(); return; }
    const bodyHTML = typeof this.modal.body === 'function' ? this.modal.body() : this.modal.body;
    overlay.innerHTML = `
      <div class="modal" data-modal="${this.modal.type || ''}">
        <h2>${this.modal.title}</h2>
        ${bodyHTML}
        <div class="modal-buttons">
          ${this.modal.buttons.map(b => `<button class="btn btn-small ${b.danger ? 'btn-danger' : ''}" data-action="${b.action}">${b.label}</button>`).join('')}
        </div>
      </div>
    `;
  },

  handleModalClick(e) {
    let el = e.target;
    while (el && el !== e.currentTarget) {
      const a = el.getAttribute && el.getAttribute('data-action');
      if (a) { this.onAction(a, el); return; }
      el = el.parentElement;
    }
  },

  closeModal() {
    this.modal = null;
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.remove();
  },

  toast(msg, kind) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    document.body.appendChild(el);
    this.toastTimer = setTimeout(() => el.remove(), (3 * FLASH_MS));
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
