const API = (function() {
    let useMock = false;
    let backendChecked = false;
    const API_BASE = '';
    let socket = null;
    let currentRoom = null;

    function delay(ms = 600) { return new Promise(r => setTimeout(r, ms)); }

    // Token 管理
    function getToken() { return localStorage.getItem('hero_token'); }
    function setToken(t) { localStorage.setItem('hero_token', t); }
    function clearToken() { localStorage.removeItem('hero_token'); localStorage.removeItem('hero_user'); }
    function getUser() { const s = localStorage.getItem('hero_user'); return s ? JSON.parse(s) : null; }
    function setUser(u) { localStorage.setItem('hero_user', JSON.stringify(u)); }

    function api(path, opts) {
        opts = opts || {};
        opts.headers = opts.headers || {};
        const token = getToken();
        if (token) {
            opts.headers['Authorization'] = 'Bearer ' + token;
        }
        return fetch(API_BASE + path, opts).then(async res => {
            if (res.status === 401) {
                clearToken();
                throw new Error('登录已过期，请重新登录');
            }
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`API ${path} failed: ${res.status} ${text}`);
            }
            return res.json();
        });
    }

    async function detectBackend() {
        if (backendChecked) return;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(API_BASE + '/api/health', { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json().catch(() => ({}));
            useMock = !res.ok;
            console.log('Backend health check:', res.ok ? `available v${data.version || '?'}` : 'unavailable (using mock)');
        } catch (e) {
            useMock = true;
            console.log('Backend not available, fallback to mock mode');
        }
        backendChecked = true;
    }

    function dataURLToBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--) { u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], {type: mime});
    }

    // ===== 用户认证 =====
    async function login(nickname) {
        await detectBackend();
        if (useMock) {
            await delay(300);
            const user = { id: 'mock_' + nickname, nickname, token: 'mock_token_' + nickname };
            setToken(user.token);
            setUser(user);
            return user;
        }
        const res = await api('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname })
        });
        const user = res.user;
        setToken(user.token);
        setUser(user);
        return user;
    }

    async function getMe() {
        const token = getToken();
        if (!token) return null;
        if (useMock) {
            const user = getUser();
            return user || null;
        }
        try {
            return await api('/api/me');
        } catch {
            return null;
        }
    }

    function logout() {
        clearToken();
        if (socket) { socket.disconnect(); socket = null; }
    }

    // ===== 原有 API（已加入认证）=====
    return {
        getToken, setToken, getUser, logout,
        login,
        getMe,

        async analyzeImage(imgBlob) {
            await detectBackend();
            if (useMock) { await delay(1200); return { object_name: '未知物体', category: 'object', size: 'medium', traits: ['神秘', '未知', '独特'], suggested_role: '物理输出', confidence: 0.6 }; }
            let blob = imgBlob;
            if (typeof imgBlob === 'string' && imgBlob.startsWith('data:')) {
                blob = dataURLToBlob(imgBlob);
            }
            const fd = new FormData();
            fd.append('image', blob, 'upload.jpg');
            return api('/api/analyze', {method:'POST',body:fd});
        },
        async generateCard(analysis) {
            await detectBackend();
            if (useMock) { await delay(1000); return createMockCard(analysis && analysis.object_name, analysis && analysis.category); }
            return api('/api/generate-card', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(analysis)});
        },
        async generateBoss(analysis, roundIndex) {
            await detectBackend();
            if (useMock) { await delay(800); return createMockBoss((roundIndex||0)+1, analysis && analysis.object_name); }
            return api('/api/generate-boss', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({analysis,roundIndex})});
        },
        async getGameState() {
            await detectBackend();
            if (useMock) { await delay(300); const s=localStorage.getItem('hero_progress'); return s?JSON.parse(s):{currentRun:null,history:[]}; }
            return api('/api/game-state');
        },
        async saveGameState(state) {
            await detectBackend();
            if (useMock) { await delay(300); localStorage.setItem('hero_progress',JSON.stringify(state)); return {success:true}; }
            return api('/api/game-state', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
        },
        async getCollection() {
            await detectBackend();
            if (useMock) { await delay(500); const s=localStorage.getItem('hero_collection'); let cards=[]; if(s)try{cards=JSON.parse(s);}catch(e){} return cards; }
            return api('/api/collection');
        },
        async saveCollection(cards) {
            await detectBackend();
            if (useMock) { await delay(300); localStorage.setItem('hero_collection',JSON.stringify(cards)); return {success:true}; }
            return api('/api/collection/batch', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cards})});
        },
        async startRun(startingCard) {
            await detectBackend();
            if (useMock) { await delay(300); const run={id:Date.now().toString(),startingCard,team:[startingCard],currentRound:0,maxRounds:5,buffs:[],battleHistory:[],adventureStory:[],status:'active',startedAt:new Date().toISOString()}; return run; }
            return api('/api/start-run', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({startingCard})});
        },
        async getBuffChoices() {
            await detectBackend();
            if (useMock) { await delay(300); return createMockBuffs(); }
            return api('/api/buff-choices', {method:'POST'});
        },
        async applyBuff(buff) {
            await detectBackend();
            if (useMock) { await delay(200); return {success:true,buff}; }
            return api('/api/apply-buff', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({buff})});
        },
        async resetRun() {
            await detectBackend();
            if (useMock) { await delay(200); localStorage.removeItem('hero_progress'); return {success:true}; }
            return api('/api/reset-run', {method:'POST'});
        },
        async addBoss(runState) {
            await detectBackend();
            if (useMock) { await delay(200); return {success:true}; }
            return api('/api/add-boss', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({runState})});
        },
        async generateStory(context) {
            await detectBackend();
            if (useMock) {
                await delay(800);
                const { newMember, isFirst, isEnding, team } = context || {};
                const name = (newMember?.name || '神秘伙伴').replace(/·.+$/, '');
                const teamNames = (team || []).map(c => (c.name || '伙伴').replace(/·.+$/, '')).join('、');
                if (isEnding) {
                    const endings = [
                        `你和${teamNames}一起完成了这段传奇冒险，传说将永远流传。`,
                        `旅程结束了，但${teamNames}与你的羁绊将永不磨灭。`,
                        `冒险落幕，你和${teamNames}的名字将被后人传颂。`
                    ];
                    return { segment: endings[Math.floor(Math.random()*endings.length)] };
                }
                const firstLines = [
                    `你踏上了未知的旅途，${name}成为了你的第一个伙伴。`,
                    `冒险开始了，${name}紧跟在你身后，眼神中充满好奇。`,
                    `你迈出了第一步，${name}默默站在你身旁。`
                ];
                const bossLines = [
                    `你击败了${name}，它心服口服地加入了你的队伍。`,
                    `一番激战后，${name}低下了头，成为了你的新伙伴。`,
                    `战胜了${name}后，它的力量将为你所用。`
                ];
                return { segment: isFirst ? firstLines[Math.floor(Math.random()*firstLines.length)] : bossLines[Math.floor(Math.random()*bossLines.length)] };
            }
            return api('/api/story/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(context)});
        },
        async startBattle(team, boss, buffs) {
            await detectBackend();
            if (useMock) throw new Error('战斗功能需要启动后端服务');
            return api('/api/battle/start', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({team,boss,buffs})});
        },
        async battleAction(state, skillId, cardId) {
            await detectBackend();
            if (useMock) throw new Error('战斗功能需要启动后端服务');
            return api('/api/battle/action', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,skillId,cardId})});
        },
        async endBattleTurn(state) {
            await detectBackend();
            if (useMock) throw new Error('战斗功能需要启动后端服务');
            return api('/api/battle/end-turn', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state})});
        },

        // ===== PvP REST API =====
        async createPvPRoom() {
            return api('/api/pvp/room/create', {method:'POST'});
        },
        async joinPvPRoom(roomCode) {
            return api('/api/pvp/room/join', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomCode})});
        },
        async getPvPRoom(roomCode) {
            return api('/api/pvp/room/' + roomCode, {method:'GET'});
        },
        async leavePvPRoom(roomCode) {
            return api('/api/pvp/room/' + roomCode + '/leave', {method:'POST'});
        },

        // ===== PvP Socket =====
        connectPvPSocket() {
            if (typeof io === 'undefined') {
                console.error('Socket.IO client not loaded');
                return null;
            }
            if (socket) { socket.disconnect(); }
            socket = io('/pvp', { auth: { token: getToken() } });
            return socket;
        },
        getPvPSocket() { return socket; },
        disconnectPvPSocket() {
            if (socket) { socket.disconnect(); socket = null; }
        },
        isSocketConnected() { return socket && socket.connected; },

        // Mock helpers
        createMockCard: createMockCard,
        createMockBoss: createMockBoss
    };
})();

// ===== Mock Data Generators（保留用于离线模式）=====
function createMockCard(nameOverride, catOverride) {
    const names = ['火焰狮','冰霜狼','雷电鹰','暗影豹','圣骑士','狂暴熊','钻石龟','幻影猫','深海鲨','风行者'];
    const skillDefs = [
        {n:'猛击',t:'physical',p:1.5,c:2},{n:'火球术',t:'magic',p:1.8,c:3},{n:'坚盾',t:'defense',p:0,c:1,e:'add_defense_layer'},
        {n:'毒液喷吐',t:'abnormal',p:0.8,c:2,e:'poison'},{n:'治愈之光',t:'support',p:0,c:2,e:'heal'},
        {n:'雷电风暴',t:'magic',p:2.2,c:4},{n:'恐惧嚎叫',t:'abnormal',p:0.3,c:2,e:'fear'},
        {n:'催眠曲',t:'abnormal',p:0.2,c:3,e:'sleep'},{n:'战吼',t:'support',p:0,c:2,e:'buff_atk'},
        {n:'虚弱射线',t:'abnormal',p:0.4,c:2,e:'weak'}
    ];
    function desc(base) {
        if(base.e==='poison') return `造成${base.p}倍伤害并中毒`;
        if(base.e==='heal') return `恢复30%生命`;
        if(base.e==='fear') return `造成${base.p}倍伤害并恐惧`;
        if(base.e==='sleep') return `造成${base.p}倍伤害并睡眠`;
        if(base.e==='weak') return `造成${base.p}倍伤害并虚弱`;
        if(base.e==='buff_atk') return `全队攻击+30% 2回合`;
        if(base.e==='add_defense_layer') return `获得2层防御`;
        return `造成${base.p}倍${base.t==='magic'?'魔法':'物理'}伤害`;
    }
    function utf8ToBase64(str) {
        try { return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m,p1)=>String.fromCharCode('0x'+p1))); }
        catch (e) { return btoa(unescape(encodeURIComponent(str))); }
    }
    const rarities=['common','common','common','rare','rare','epic','legendary'];
    const rarity = rarities[Math.floor(Math.random()*rarities.length)];
    const mult = {common:1,rare:1.3,epic:1.7,legendary:2.2}[rarity];
    const prefixes = ['勇敢的','神秘的','闪耀的','古老的','狂暴的','神圣的'];
    const prefix = prefixes[Math.floor(Math.random()*prefixes.length)];
    const baseName = nameOverride || names[Math.floor(Math.random()*names.length)];
    const name = nameOverride ? (prefix + baseName) : baseName;
    const num = rarity==='legendary'?3: rarity==='epic'?3: rarity==='rare'?2:1;
    const skills=[]; const used=new Set();
    for(let i=0;i<num;i++){
        let idx; do{idx=Math.floor(Math.random()*skillDefs.length);}while(used.has(idx)); used.add(idx);
        const b=skillDefs[idx];
        skills.push({id:`sk_${Date.now()}_${i}`,name:b.n,type:b.t,cost:b.c,power:b.p,effect:b.e||null,limit:(b.t==='support'||b.t==='defense')?'per_turn':(Math.random()>0.8?'per_game':'per_turn'),description:desc(b)});
    }
    const colors=['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e'];
    const c=colors[Math.floor(Math.random()*colors.length)];
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect fill="${c}" width="300" height="400"/><text x="150" y="200" font-size="60" fill="white" text-anchor="middle" dominant-baseline="middle">${name[0]}</text></svg>`;
    const hp = Math.floor((80+Math.random()*120)*mult);
    const atk = Math.floor((15+Math.random()*25)*mult);
    const image = 'data:image/svg+xml;base64,'+utf8ToBase64(svg);
    const category = catOverride||['animal','plant','object','food','landscape'][Math.floor(Math.random()*5)];
    return {id:`c_${Date.now()}_${Math.floor(Math.random()*10000)}`,name,image,hp,maxHp:hp,atk,skills,category,rarity,obtainedAt:new Date().toISOString()};
}

function createMockBoss(stage=1, objectName) {
    const bossNames=['暗影魔王','深渊巨龙','虚空行者','混沌骑士','毁灭泰坦','亡灵法师','血族女王','机械暴君'];
    const baseName = objectName ? (objectName + '之王') : bossNames[(stage-1)%bossNames.length];
    const mult=1+(stage-1)*0.3;
    const bossSkills=[{n:'暗影爪',t:'physical',p:1.6,c:2},{n:'暗影爆发',t:'magic',p:2.0,c:3},{n:'恐惧嚎叫',t:'abnormal',p:0.5,e:'fear',c:2},{n:'剧毒之触',t:'abnormal',p:0.6,e:'poison',c:2},{n:'催眠术',t:'abnormal',p:0.3,e:'sleep',c:3},{n:'虚弱光环',t:'abnormal',p:0.4,e:'weak',c:2},{n:'黑暗治愈',t:'support',p:0,e:'heal',c:2}];
    function desc(b) {
        if(b.e==='poison') return `造成${b.p}倍伤害并中毒`;
        if(b.e==='heal') return `恢复30%生命`;
        if(b.e==='fear') return `造成${b.p}倍伤害并恐惧`;
        if(b.e==='sleep') return `造成${b.p}倍伤害并睡眠`;
        if(b.e==='weak') return `造成${b.p}倍伤害并虚弱`;
        return `造成${b.p}倍${b.t==='magic'?'魔法':'物理'}伤害`;
    }
    function utf8ToBase64(str) {
        try { return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m,p1)=>String.fromCharCode('0x'+p1))); }
        catch (e) { return btoa(unescape(encodeURIComponent(str))); }
    }
    const num=Math.min(2+Math.floor(stage/3),5);
    const skills=[];
    for(let i=0;i<num;i++){const b=bossSkills[i%bossSkills.length]; skills.push({id:`bs_${stage}_${i}`,name:b.n,type:b.t,cost:b.c,power:parseFloat((b.p*(1+(stage-1)*0.1)).toFixed(1)),effect:b.e||null,limit:'per_turn',description:desc(b)});}
    const colors=['#8e44ad','#c0392b','#27ae60','#d35400','#2c3e50','#7f8c8d','#16a085'];
    const c=colors[stage%colors.length];
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect fill="${c}" width="300" height="400"/><text x="150" y="200" font-size="80" fill="white" text-anchor="middle" dominant-baseline="middle">\u2620</text></svg>`;
    const hp = Math.floor(300*mult);
    const atk = Math.floor(30*mult);
    return {id:`boss_${Date.now()}`,name:`${baseName} Lv.${stage}`,image:'data:image/svg+xml;base64,'+utf8ToBase64(svg),hp,maxHp:hp,atk,skills,stage,bossMultiplier:mult,category:objectName?'object':'boss'};
}

function createMockBuffs() {
    return [
        {id:'dmg_up_10',name:'攻击力提升',description:'全队伤害+10%',rarity:'common',effect:{type:'damage_up',value:0.10}},
        {id:'hp_up_10',name:'生命值提升',description:'全队最大HP+10%',rarity:'common',effect:{type:'hp_up',value:0.10}},
        {id:'init_mp_1',name:'初始水晶',description:'战斗开始时额外+1水晶',rarity:'rare',effect:{type:'initial_mp_bonus',value:1}}
    ];
}
