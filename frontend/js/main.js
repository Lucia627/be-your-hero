const Game = {
  state: 'start',
  currentRun: null,
  currentRound: 0,
  buffs: [],
  tempCard: null,
  tempBoss: null,
  tempPhoto: null,
  selectedReward: null,

  async init() {
    await Cards.loadCollection();
    try {
      const progress = await API.getGameState();
      if (progress && progress.currentRun) {
        this.currentRun = progress.currentRun;
        this.currentRound = progress.currentRun.currentRound || 0;
        this.buffs = progress.currentRun.buffs || [];
      }
    } catch (err) {
      console.warn('Failed to load game state:', err);
    }
    this.bindEvents();
    showScreen('screen-start');
  },

  bindEvents() {
    document.getElementById('btn-start-game').addEventListener('click', () => this.startNewGame());
    document.getElementById('btn-collection').addEventListener('click', () => this.openCollection());
    document.getElementById('btn-reveal-continue').addEventListener('click', () => this.confirmCard());
    document.getElementById('btn-reveal-collection').addEventListener('click', () => this.openCollection());
    document.getElementById('btn-setup-back').addEventListener('click', () => showScreen('screen-start'));
    document.getElementById('btn-start-battle').addEventListener('click', () => this.startBattlePhase());
    document.getElementById('btn-collection-back').addEventListener('click', () => showScreen('screen-start'));
    document.getElementById('btn-empty-camera').addEventListener('click', () => { showScreen('screen-start'); this.startNewGame(); });
    document.getElementById('btn-result-continue').addEventListener('click', () => this.nextAfterResult());
    document.getElementById('btn-result-home').addEventListener('click', () => showScreen('screen-start'));
  },

  async startNewGame() {
    this.currentRun = null;
    this.currentRound = 0;
    this.buffs = [];
    Cards.clearTeam();
    try {
      await API.resetRun();
    } catch (err) {
      console.warn('Reset run failed:', err);
    }
    this.state = 'camera_initial';
    Camera.setOnConfirm((a, photo) => this.handleInitialPhoto(a, photo));
    Camera.retake();
    showScreen('screen-camera');
  },

  async handleInitialPhoto(analysis, photo) {
    showLoading('生成卡牌中...');
    try {
      const card = await API.generateCard(analysis);
      if (photo) {
        card.sourceImage = photo;
        card.image = photo;
      }
      this.tempCard = card;
      await Cards.saveToCollection(card);
      hideLoading();
      this.showCardReveal(card);
    } catch (err) {
      hideLoading();
      showModal('生成失败: ' + (err.message || '未知错误'));
    }
  },

  showCardReveal(card) {
    const container = document.getElementById('revealed-card');
    container.innerHTML = '';
    const el = createGameCard(card, { clickable: false });
    el.classList.add('card-flip-reveal');
    container.appendChild(el);
    showScreen('screen-card-reveal');
  },

  async confirmCard() {
    if (!this.tempCard) return;

    if (!this.currentRun) {
      try {
        this.currentRun = await API.startRun(this.tempCard);
        this.currentRun.team = [this.tempCard];
      } catch (err) {
        console.warn('Start run via API failed, using local fallback:', err);
        this.currentRun = {
          id: Date.now().toString(),
          team: [this.tempCard],
          currentRound: 0,
          maxRounds: 5,
          buffs: [],
          battleHistory: [],
          status: 'active',
          startedAt: new Date().toISOString()
        };
      }
      this.currentRound = 0;
      this.buffs = [];
    }
    this.tempCard = null;
    this.goToTeamSetup();
  },

  goToTeamSetup() {
    this.state = 'team_select';
    Cards.currentTeam = this.currentRun ? [...this.currentRun.team] : [];
    Cards.updateTeamSlots();
    const pool = document.getElementById('setup-collection');
    if (pool) {
      pool.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">击败Boss后，新伙伴会自动加入队伍</p>';
    }
    showScreen('screen-team-setup');
  },

  async startBattlePhase() {
    if (Cards.currentTeam.length === 0) {
      showToast('请至少选择一名角色', 'warning');
      return;
    }
    if (this.currentRun) {
      this.currentRun.team = [...Cards.currentTeam];
      try {
        const progress = await API.getGameState();
        progress.currentRun = this.currentRun;
        await API.saveGameState(progress);
      } catch (err) {
        console.warn('Save game state failed:', err);
      }
    }
    this.state = 'camera_boss';
    Camera.setOnConfirm((a, photo) => this.handleBossPhoto(a, photo));
    Camera.retake();
    showScreen('screen-camera');
  },

  async handleBossPhoto(analysis, photo) {
    showLoading('生成Boss中...');
    try {
      const boss = await API.generateBoss(analysis, this.currentRound);
      if (photo) {
        boss.sourceImage = photo;
        boss.image = photo;
      }
      this.tempBoss = boss;
      this.tempPhoto = photo;
      hideLoading();
      const team = this.currentRun ? [...this.currentRun.team] : [...Cards.currentTeam];
      await Battle.start(team, boss, this.buffs, this.currentRound + 1);
    } catch (err) {
      hideLoading();
      showModal('生成Boss失败: ' + (err.message || '未知错误'));
    }
  },

  async handleBattleWin(boss) {
    this.currentRound++;
    const weakened = {
      ...boss,
      id: boss.id + '_card',
      hp: Math.round((boss.hp || boss.maxHp) / (boss.bossMultiplier || 1)),
      maxHp: Math.round(boss.maxHp / (boss.bossMultiplier || 1)),
      atk: Math.round(boss.atk / (boss.bossMultiplier || 1)),
      skills: (boss.skills || []).slice(0, 2),
      isBoss: false,
      obtainedAt: new Date().toISOString()
    };
    if (this.tempPhoto && !weakened.image) {
      weakened.sourceImage = this.tempPhoto;
      weakened.image = this.tempPhoto;
    }
    await Cards.saveToCollection(weakened);

    if (this.currentRun) {
      this.currentRun.currentRound = this.currentRound;
      this.currentRun.team.push(weakened);
      try {
        await API.addBoss(this.currentRun);
      } catch (err) {
        console.warn('Add boss to run failed:', err);
      }
    }
    this.tempBoss = null;
    this.tempPhoto = null;

    if (this.currentRound >= 5) {
      this.showVictoryScreen();
    } else {
      this.showRewardScreen();
    }
  },

  handleBattleLoss(retreated) {
    const title = retreated ? '撤退了' : '战斗失败';
    document.getElementById('result-icon').textContent = '💀';
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-title').className = 'result-title defeat';
    document.getElementById('result-desc').textContent = '你的队伍全军覆没...';
    document.getElementById('result-stats').innerHTML =
      '<div class="stat-row"><span>到达层数</span><span>' + (this.currentRound + 1) + '</span></div>';
    this.saveRunToHistory('lost');
    showScreen('screen-result');
  },

  async showRewardScreen() {
    showLoading('生成奖励...');
    try {
      const choices = await API.getBuffChoices();
      hideLoading();
      const container = document.getElementById('reward-cards');
      container.innerHTML = '';
      this.selectedReward = null;
      choices.forEach(ch => {
        const el = document.createElement('div');
        el.className = 'reward-card';
        const rarityName = { common: '普通', rare: '稀有', legendary: '传说', curse: '诅咒' }[ch.rarity] || ch.rarity;
        el.innerHTML = '<h4>' + ch.name + ' <span style="font-size:12px;color:var(--text-muted);">[' + rarityName + ']</span></h4><p>' + ch.description + '</p>';
        el.addEventListener('click', () => {
          document.querySelectorAll('.reward-card').forEach(x => x.style.borderColor = '');
          el.style.borderColor = 'var(--accent-gold)';
          this.selectedReward = ch;
          setTimeout(() => this.applyReward(), 400);
        });
        container.appendChild(el);
      });
      showScreen('screen-reward');
    } catch (err) {
      hideLoading();
      showToast('奖励生成失败: ' + (err.message || '未知错误'), 'error');
    }
  },

  async applyReward() {
    if (!this.selectedReward) return;
    this.buffs.push(this.selectedReward);
    if (this.currentRun) this.currentRun.buffs = this.buffs;
    try {
      await API.applyBuff(this.selectedReward);
    } catch (err) {
      console.warn('Apply buff failed:', err);
    }
    this.selectedReward = null;
    this.goToTeamSetup();
  },

  showVictoryScreen() {
    document.getElementById('result-icon').textContent = '🏆';
    document.getElementById('result-title').textContent = '恭喜通关！';
    document.getElementById('result-title').className = 'result-title victory';
    document.getElementById('result-desc').textContent = '你击败了所有5个Boss！';
    const team = this.currentRun ? this.currentRun.team : Cards.currentTeam;
    document.getElementById('result-stats').innerHTML =
      '<div class="stat-row"><span>队伍人数</span><span>' + team.length + '</span></div>' +
      '<div class="stat-row"><span>获得增益</span><span>' + this.buffs.length + '</span></div>';
    this.saveRunToHistory('won');
    showScreen('screen-result');
  },

  nextAfterResult() {
    if (this.currentRound >= 5) {
      showScreen('screen-start');
    } else {
      this.goToTeamSetup();
    }
  },

  async saveRunToHistory(status) {
    if (this.currentRun) {
      this.currentRun.status = status;
      this.currentRun.endedAt = new Date().toISOString();
      try {
        const progress = await API.getGameState();
        progress.history = progress.history || [];
        progress.history.push(this.currentRun);
        progress.currentRun = null;
        await API.saveGameState(progress);
      } catch (err) {
        console.warn('Save run history failed:', err);
      }
      this.currentRun = null;
    }
  },

  async openCollection() {
    await Cards.loadCollection();
    Cards.renderCollection('collection-grid');
    showScreen('screen-collection');
  },

  addToTeam(card) {
    if (Cards.currentTeam.length >= Cards.maxTeamSize) {
      showToast('队伍已满', 'warning');
      return;
    }
    if (!Cards.currentTeam.find(c => c.id === card.id)) {
      Cards.currentTeam.push(card);
      Cards.updateTeamSlots();
    }
  },

  removeFromTeam(index) {
    if (index >= 0 && index < Cards.currentTeam.length) {
      Cards.currentTeam.splice(index, 1);
      Cards.updateTeamSlots();
    }
  }
};

window.Game = Game;
document.addEventListener('DOMContentLoaded', () => Game.init());
