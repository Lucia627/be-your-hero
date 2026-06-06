const Cards = {
    collection: [],
    currentTeam: [],
    maxTeamSize: 5,

    async loadCollection() {
        try {
            this.collection = (await API.getCollection()).filter(c => c && c.id);
            // 从 localStorage 恢复图片
            this.collection.forEach(c => {
                if (!c.image && !c.sourceImage) {
                    const img = localStorage.getItem('hero_img_' + c.id);
                    if (img) { c.image = img; c.sourceImage = img; }
                }
            });
        } catch { this.collection = []; }
    },

    async saveToCollection(card) {
        if (!card || !card.id) return;
        if (!this.collection.find(c => c && c.id === card.id)) {
            this.collection.push(card);
            // 保存图片到 localStorage（后端只存轻量数据，图片从本地恢复）
            if (card.image || card.sourceImage) {
                try { localStorage.setItem('hero_img_' + card.id, card.image || card.sourceImage || ''); } catch(e) {}
            }
            // 保存时剥离 base64 图片，避免传输几 MB 的 JSON
            const slimCollection = this.collection.filter(c => c && c.id).map(c => {
                const { image, sourceImage, ...rest } = c;
                return rest;
            });
            try { await API.saveCollection(slimCollection); } catch {}
        }
    },

    clearTeam() { this.currentTeam = []; },

    updateTeamSlots() {
        const slots = document.querySelectorAll('#team-slots .team-slot');
        slots.forEach((slot, i) => {
            // 克隆节点以清除旧事件监听器，避免多次渲染后重复触发
            const cleanSlot = document.createElement('div');
            cleanSlot.className = 'team-slot';
            cleanSlot.dataset.index = i;
            slot.replaceWith(cleanSlot);
            const card = this.currentTeam[i];
            if (card) {
                cleanSlot.classList.add('filled');
                const img = document.createElement('img');
                img.src = card.image || card.sourceImage || '';
                img.alt = card.name;
                cleanSlot.appendChild(img);
                cleanSlot.addEventListener('click', () => this.showCardDetail(card));
            } else {
                cleanSlot.classList.add('locked');
                const lockIcon = document.createElement('div');
                lockIcon.className = 'slot-lock-icon';
                lockIcon.textContent = '🔒';
                cleanSlot.appendChild(lockIcon);
                const lockText = document.createElement('div');
                lockText.className = 'slot-lock-text';
                lockText.textContent = '未解锁';
                cleanSlot.appendChild(lockText);
            }
        });
        document.getElementById('team-count').textContent = `${this.currentTeam.length} / ${this.maxTeamSize}`;
        this.updateTeamStats();
        const btn = document.getElementById('btn-start-battle');
        if (btn) btn.disabled = this.currentTeam.length === 0;
    },

    updateTeamStats() {
        const hp = this.currentTeam.reduce((s, c) => s + (c.hp || c.maxHp || 0), 0);
        const atk = this.currentTeam.reduce((s, c) => s + (c.atk || 0), 0);
        document.getElementById('team-hp-text').textContent = hp;
        document.getElementById('team-hp-bar').style.width = '100%';
        document.getElementById('team-atk-text').textContent = atk;
        document.getElementById('team-atk-bar').style.width = '100%';
    },

    renderPool(containerId) {
        const c = document.getElementById(containerId || 'setup-collection');
        if (!c) return;
        c.innerHTML = '';
        this.collection.forEach(card => {
            const inTeam = this.currentTeam.find(t => t.id === card.id);
            const el = createGameCard(card, { clickable: true, selected: !!inTeam, onClick: (cd) => {
                if (inTeam) {
                    const idx = this.currentTeam.findIndex(t => t.id === cd.id);
                    if (idx >= 0) Game.removeFromTeam(idx);
                } else {
                    Game.addToTeam(cd);
                }
            }});
            c.appendChild(el);
        });
    },

    renderCollection(containerId) {
        const c = document.getElementById(containerId || 'collection-grid');
        const empty = document.getElementById('collection-empty');
        if (!c) return;
        c.innerHTML = '';
        if (this.collection.length === 0) {
            if (empty) empty.style.display = 'flex';
            return;
        }
        if (empty) empty.style.display = 'none';
        this.collection.forEach(card => {
            const el = createGameCard(card, { clickable: true, onClick: (cd) => this.showCardDetail(cd) });
            c.appendChild(el);
        });
    },

    showCardDetail(card) {
        const content = document.getElementById('card-detail-content');
        if (!content) return;
        content.innerHTML = createCardDetailHTML(card);
        const modal = document.getElementById('modal-card-detail');
        if (modal) modal.classList.add('active');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#modal-card-detail .modal-close').forEach(btn => {
        btn.addEventListener('click', () => document.getElementById('modal-card-detail').classList.remove('active'));
    });
    document.querySelectorAll('#modal-how-to-play .modal-close').forEach(btn => {
        btn.addEventListener('click', () => document.getElementById('modal-how-to-play').classList.remove('active'));
    });
    const howToBtn = document.getElementById('btn-how-to-play');
    if (howToBtn) howToBtn.addEventListener('click', () => document.getElementById('modal-how-to-play').classList.add('active'));
});
