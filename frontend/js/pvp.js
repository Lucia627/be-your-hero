const PvP = {
  socket: null,
  roomCode: null,
  isHost: false,
  myTeam: [],
  isReady: false,
  opponentReady: false,
  battleState: null,
  _processing: false,

  // ===== 大厅 =====
  async createRoom() {
    showLoading('创建房间中...');
    try {
      const res = await API.createPvPRoom();
      hideLoading();
      this.enterRoom(res.roomCode, res.isHost);
    } catch (err) {
      hideLoading();
      showToast(err.message || '创建房间失败', 'error');
    }
  },

  async joinRoom(code) {
    if (!code || !/^\d{6}$/.test(code)) {
      showToast('请输入6位数字房间号', 'warning');
      return;
    }
    showLoading('加入房间中...');
    try {
      const res = await API.joinPvPRoom(code);
      hideLoading();
      this.enterRoom(res.roomCode, res.isHost);
    } catch (err) {
      hideLoading();
      showToast(err.message || '加入房间失败', 'error');
    }
  },

  // ===== 房间 =====
  async enterRoom(code, isHost) {
    this.roomCode = code;
    this.isHost = isHost;
    this.myTeam = [];
    this.isReady = false;
    this.opponentReady = false;
    document.getElementById('pvp-room-code-display').textContent = '#' + code;
    document.getElementById('pvp-host-start-wrap').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-pvp-ready').textContent = '准备就绪';
    document.getElementById('btn-pvp-ready').className = 'btn btn-success btn-large';
    document.getElementById('btn-pvp-ready').disabled = false;
    document.getElementById('btn-pvp-start-battle').disabled = true;
    this.updatePvPTeamSlots();
    await this.renderPvPCollection();
    showScreen('screen-pvp-room');
    this.connectSocket();
  },

  async renderPvPCollection() {
    await Cards.loadCollection();
    const pool = document.getElementById('pvp-collection');
    pool.innerHTML = '';
    const self = this;
    Cards.collection.forEach(function(card) {
      const inTeam = self.myTeam.find(t => t.id === card.id);
      const el = createGameCard(card, { clickable: true, selected: !!inTeam, onClick: function(cd) {
        if (self.isReady) { showToast('已准备，无法调整队伍', 'warning'); return; }
        if (inTeam) {
          self.myTeam = self.myTeam.filter(t => t.id !== cd.id);
        } else {
          if (self.myTeam.length >= 5) { showToast('队伍已满', 'warning'); return; }
          self.myTeam.push(cd);
        }
        self.updatePvPTeamSlots();
        self.renderPvPCollection();
      }});
      pool.appendChild(el);
    });
  },

  connectSocket() {
    if (this.socket) { this.socket.disconnect(); }
    this.socket = API.connectPvPSocket();

    this.socket.on('connect', () => {
      console.log('[PvP] Socket connected');
      this.socket.emit('join_room', { roomCode: this.roomCode });
    });

    this.socket.on('room_update', (data) => {
      this.handleRoomUpdate(data);
    });

    this.socket.on('battle_start', (data) => {
      showToast('战斗开始！', 'success');
      this.startPvPBattle(data);
    });

    this.socket.on('battle_state', (data) => {
      this.handleBattleState(data);
    });

    this.socket.on('battle_end', (data) => {
      this.handleBattleEnd(data);
    });

    this.socket.on('player_disconnected', (data) => {
      showToast(data.nickname + ' 断开了连接', 'warning');
    });

    this.socket.on('error_msg', (data) => {
      showToast(data.message, 'error');
    });

    this.socket.on('disconnect', () => {
      console.log('[PvP] Socket disconnected');
    });
  },

  handleRoomUpdate(data) {
    const opponentName = data.guest && !data.youAreHost ? data.guest.nickname :
                         data.host && data.youAreHost && data.guest ? data.guest.nickname :
                         '等待加入...';
    document.getElementById('pvp-opponent-name').textContent = opponentName;

    // 更新对手准备状态
    if (data.youAreHost && data.guest) {
      this.opponentReady = data.guest.teamSet;
      document.getElementById('pvp-opponent-ready').textContent = this.opponentReady ? '已准备 ✅' : '未准备';
      document.getElementById('pvp-opponent-ready').style.color = this.opponentReady ? 'var(--accent-green)' : 'var(--text-muted)';
    } else if (!data.youAreHost && data.host) {
      this.opponentReady = data.host.teamSet;
      document.getElementById('pvp-opponent-ready').textContent = this.opponentReady ? '已准备 ✅' : '未准备';
      document.getElementById('pvp-opponent-ready').style.color = this.opponentReady ? 'var(--accent-green)' : 'var(--text-muted)';
    }

    // 房主检查是否可以开始
    if (data.youAreHost) {
      const canStart = this.isReady && this.opponentReady && data.guest;
      document.getElementById('btn-pvp-start-battle').disabled = !canStart;
    }
  },

  updatePvPTeamSlots() {
    const slots = document.querySelectorAll('#pvp-team-slots .team-slot');
    slots.forEach((slot, i) => {
      const cleanSlot = document.createElement('div');
      cleanSlot.className = 'team-slot';
      cleanSlot.dataset.index = i;
      slot.replaceWith(cleanSlot);
      const card = this.myTeam[i];
      if (card) {
        cleanSlot.classList.add('filled');
        const img = document.createElement('img');
        img.src = card.image || card.sourceImage || '';
        img.alt = card.name;
        cleanSlot.appendChild(img);
      } else {
        cleanSlot.classList.add('locked');
        cleanSlot.innerHTML = '<div class="slot-lock-icon">🔒</div><div class="slot-lock-text">未解锁</div>';
      }
    });

    const hp = this.myTeam.reduce((s, c) => s + (c.hp || c.maxHp || 0), 0);
    const atk = this.myTeam.reduce((s, c) => s + (c.atk || 0), 0);
    document.getElementById('pvp-team-hp-text').textContent = hp;
    document.getElementById('pvp-team-atk-text').textContent = atk;
  },

  toggleReady() {
    if (this.myTeam.length === 0) {
      showToast('请至少选择一张卡牌', 'warning');
      return;
    }
    this.isReady = !this.isReady;
    const btn = document.getElementById('btn-pvp-ready');
    if (this.isReady) {
      btn.textContent = '取消准备';
      btn.className = 'btn btn-secondary btn-large';
      // 发送队伍到服务端
      this.socket.emit('set_team', { team: this.myTeam });
    } else {
      btn.textContent = '准备就绪';
      btn.className = 'btn btn-success btn-large';
      this.socket.emit('set_team', { team: [] });
    }
  },

  startBattle() {
    if (this.socket) {
      this.socket.emit('start_battle');
    }
  },

  async leaveRoom() {
    if (this.roomCode) {
      try { await API.leavePvPRoom(this.roomCode); } catch {}
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomCode = null;
    this.isHost = false;
    this.myTeam = [];
    this.isReady = false;
    showScreen('screen-pvp-lobby');
  },

  // ===== PvP 战斗 =====
  startPvPBattle(data) {
    this.battleState = null;
    this._processing = false;
    showScreen('screen-pvp-battle');
  },

  handleBattleState(data) {
    this.battleState = data;
    this._processing = false; // 收到服务器状态后解除锁定
    this.renderPvPBattle();
  },

  renderPvPBattle() {
    const s = this.battleState;
    if (!s) return;

    document.getElementById('pvp-battle-round').textContent = '回合 ' + s.turn;
    const turnEl = document.getElementById('pvp-turn-indicator');
    turnEl.textContent = s.isMyTurn ? '你的回合' : '对手回合';
    turnEl.className = 'turn-indicator ' + (s.isMyTurn ? 'player-turn' : 'boss-turn');

    // 我方队伍（可翻转查看技能）
    const myTeamEl = document.getElementById('pvp-my-team');
    myTeamEl.innerHTML = '';
    const self = this;
    s.me.team.forEach(function(card) {
      const flipCard = document.createElement('div');
      flipCard.className = 'battle-flip-card';
      if (card.isDead) flipCard.classList.add('is-dead');
      if (card.isSleeping) flipCard.classList.add('is-sleeping');
      flipCard.dataset.cardId = card.id;

      const inner = document.createElement('div');
      inner.className = 'battle-flip-inner';

      const front = document.createElement('div');
      front.className = 'battle-flip-front';
      const img = document.createElement('img');
      img.className = 'card-image';
      img.src = card.image || card.sourceImage || '';
      img.alt = card.name || '';
      front.appendChild(img);
      const info = document.createElement('div');
      info.className = 'card-info';
      const name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = card.name || '';
      info.appendChild(name);
      const stats = document.createElement('div');
      stats.className = 'card-stats';
      stats.innerHTML = '<span>' + (card.currentHp || card.hp || card.maxHp || 0) + 'HP</span>';
      info.appendChild(stats);
      front.appendChild(info);

      front.addEventListener('click', function() {
        if (!card.isDead && !card.isSleeping && s.isMyTurn && !s.gameEnded) {
          myTeamEl.querySelectorAll('.battle-flip-card.flipped').forEach(function(c) {
            if (c !== flipCard) c.classList.remove('flipped');
          });
          flipCard.classList.add('flipped');
        }
      });

      const back = document.createElement('div');
      back.className = 'battle-flip-back';
      (card.skills || []).forEach(function(skill) {
        var usedTurn = s.me.skillsUsedThisTurn.indexOf(skill.id) >= 0;
        var usedGame = skill.limit === 'per_game' && skill.usedThisGame;
        var canAfford = s.me.mp >= skill.cost;
        var disabled = !canAfford || usedTurn || usedGame || !s.isMyTurn || s.gameEnded;

        var btn = document.createElement('button');
        btn.className = 'battle-skill-btn skill-type-' + (skill.type || 'physical');
        if (usedTurn || usedGame) btn.classList.add('used');
        btn.disabled = disabled;
        btn.innerHTML = '<span class="skill-icon type-' + (skill.type || 'physical') + '"></span>' +
          '<div class="bs-info"><span class="bs-name">' + skill.name + '</span>' +
          '<span class="bs-desc">' + (skill.description || '') + '</span>' +
          '<span class="bs-cost">' + skill.cost + '💎</span></div>';

        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (!disabled) {
            self.usePvPSkill(skill.id, card.id, flipCard);
          }
        });
        back.appendChild(btn);
      });

      back.addEventListener('click', function(e) {
        if (e.target === back) flipCard.classList.remove('flipped');
      });

      inner.appendChild(front);
      inner.appendChild(back);
      flipCard.appendChild(inner);
      myTeamEl.appendChild(flipCard);
    });

    // 对手队伍（只显示正面）
    const oppTeamEl = document.getElementById('pvp-opponent-team');
    oppTeamEl.innerHTML = '';
    s.opponent.team.forEach(function(card) {
      var el = document.createElement('div');
      el.className = 'game-card';
      if (card.isDead) el.style.opacity = '0.4';
      var img = document.createElement('img');
      img.className = 'card-image';
      img.src = card.image || card.sourceImage || '';
      img.alt = card.name || '';
      el.appendChild(img);
      var info = document.createElement('div');
      info.className = 'card-info';
      var name = document.createElement('div');
      name.className = 'card-name';
      name.textContent = card.name || '';
      info.appendChild(name);
      el.appendChild(info);
      oppTeamEl.appendChild(el);
    });

    // HP/MP
    var myHpPct = s.me.teamMaxHp > 0 ? Math.max(0, (s.me.teamHp / s.me.teamMaxHp) * 100) : 0;
    document.getElementById('pvp-my-hp-fill').style.width = myHpPct + '%';
    document.getElementById('pvp-my-hp-fill').classList.toggle('low-hp', myHpPct > 0 && myHpPct <= 25);
    document.getElementById('pvp-my-hp-text').textContent = s.me.teamHp + ' / ' + s.me.teamMaxHp;

    var oppHpPct = s.opponent.teamMaxHp > 0 ? Math.max(0, (s.opponent.teamHp / s.opponent.teamMaxHp) * 100) : 0;
    document.getElementById('pvp-opponent-hp-fill').style.width = oppHpPct + '%';
    document.getElementById('pvp-opponent-hp-text').textContent = s.opponent.teamHp + ' / ' + s.opponent.teamMaxHp;

    document.getElementById('pvp-my-mp-text').textContent = s.me.mp + ' / ' + s.me.maxMp;
    document.querySelectorAll('#screen-pvp-battle .mp-orb').forEach(function(orb) {
      var orbVal = parseInt(orb.dataset.mp, 10);
      orb.classList.toggle('active', orbVal <= s.me.mp);
    });
    document.getElementById('pvp-defense-count').textContent = s.me.defenseLayers;

    // 状态效果
    var myStatus = document.getElementById('pvp-my-status');
    myStatus.innerHTML = '';
    (s.me.statusEffects || []).forEach(function(e) {
      var badge = document.createElement('span');
      badge.className = 'status-badge status-' + e.type;
      var names = { poison: '☠️毒', weak: '💔虚', fear: '😰惧', sleep: '💤睡' };
      badge.textContent = (names[e.type] || e.type) + (e.duration > 0 ? ' ' + e.duration : '');
      myStatus.appendChild(badge);
    });

    var oppStatus = document.getElementById('pvp-opponent-status');
    oppStatus.innerHTML = '';
    (s.opponent.statusEffects || []).forEach(function(e) {
      var badge = document.createElement('span');
      badge.className = 'status-badge status-' + e.type;
      var names = { poison: '☠️毒', weak: '💔虚', fear: '😰惧', sleep: '💤睡' };
      badge.textContent = (names[e.type] || e.type) + (e.duration > 0 ? ' ' + e.duration : '');
      oppStatus.appendChild(badge);
    });

    // 战斗日志
    var log = document.getElementById('pvp-battle-log');
    log.innerHTML = s.battleLog.slice(-30).map(function(entry) {
      var cls = 'log-entry';
      if (entry.indexOf('伤害') >= 0 || entry.indexOf('击败') >= 0) cls += ' log-damage';
      else if (entry.indexOf('恢复') >= 0 || entry.indexOf('治疗') >= 0 || entry.indexOf('HP') >= 0) cls += ' log-heal';
      else if (entry.indexOf('防御') >= 0) cls += ' log-buff';
      else if (entry.indexOf('中毒') >= 0 || entry.indexOf('虚弱') >= 0 || entry.indexOf('恐惧') >= 0 || entry.indexOf('睡眠') >= 0) cls += ' log-debuff';
      else if (entry.indexOf('回合') >= 0 || entry.indexOf('战斗') >= 0) cls += ' log-system';
      return '<div class="' + cls + '">' + entry + '</div>';
    }).join('');
    log.scrollTop = log.scrollHeight;

    // 按钮状态
    document.getElementById('btn-pvp-defend').disabled = !s.isMyTurn || s.gameEnded;
    document.getElementById('btn-pvp-end-turn').disabled = !s.isMyTurn || s.gameEnded;
    document.getElementById('pvp-skill-buttons').classList.toggle('disabled', !s.isMyTurn || s.gameEnded);
  },

  usePvPSkill(skillId, cardId, flipCardEl) {
    if (this._processing || !this.socket) return;
    this._processing = true;
    if (flipCardEl) flipCardEl.classList.remove('flipped');
    this.socket.emit('use_skill', { skillId, cardId });
  },

  handleDefense() {
    if (!this.socket || this._processing) return;
    this._processing = true;
    this.socket.emit('defend');
  },

  endTurn() {
    if (!this.socket || this._processing) return;
    this._processing = true;
    document.querySelectorAll('#pvp-my-team .battle-flip-card.flipped').forEach(function(c) { c.classList.remove('flipped'); });
    this.socket.emit('end_turn');
  },

  surrender() {
    document.getElementById('modal-pvp-surrender').classList.add('active');
  },

  confirmSurrender() {
    document.getElementById('modal-pvp-surrender').classList.remove('active');
    if (this.socket) this.socket.emit('surrender');
  },

  cancelSurrender() {
    document.getElementById('modal-pvp-surrender').classList.remove('active');
  },

  handleBattleEnd(data) {
    Game.lastMode = 'pvp';
    const user = API.getUser();
    const isWinner = data.winnerId === (user ? user.id : null);
    document.getElementById('result-icon').textContent = isWinner ? '🏆' : '💀';
    document.getElementById('result-title').textContent = isWinner ? '胜利！' : '失败';
    document.getElementById('result-title').className = 'result-title ' + (isWinner ? 'victory' : 'defeat');
    document.getElementById('result-desc').textContent = isWinner ? '你在对战中击败了对手！' : '你的队伍被全灭了...';
    document.getElementById('result-stats').innerHTML = '<div class="stat-row"><span>对战模式</span><span>玩家对战</span></div>';

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomCode = null;
    showScreen('screen-result');
  }
};

// 事件绑定
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-pvp-create').addEventListener('click', function() { PvP.createRoom(); });
  document.getElementById('btn-pvp-join').addEventListener('click', function() {
    PvP.joinRoom(document.getElementById('pvp-room-code').value.trim());
  });
  document.getElementById('pvp-room-code').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') PvP.joinRoom(e.target.value.trim());
  });
  document.getElementById('btn-pvp-back').addEventListener('click', function() { showScreen('screen-start'); });
  document.getElementById('btn-pvp-room-back').addEventListener('click', function() { PvP.leaveRoom(); });
  document.getElementById('btn-pvp-ready').addEventListener('click', function() { PvP.toggleReady(); });
  document.getElementById('btn-pvp-start-battle').addEventListener('click', function() { PvP.startBattle(); });
  document.getElementById('btn-pvp-defend').addEventListener('click', function() { PvP.handleDefense(); });
  document.getElementById('btn-pvp-end-turn').addEventListener('click', function() { PvP.endTurn(); });
  document.getElementById('btn-pvp-surrender').addEventListener('click', function() { PvP.surrender(); });
  document.getElementById('btn-pvp-surrender-confirm').addEventListener('click', function() { PvP.confirmSurrender(); });
  document.getElementById('btn-pvp-surrender-cancel').addEventListener('click', function() { PvP.cancelSurrender(); });
});
