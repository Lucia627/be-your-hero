const API_BASE = 'http://localhost:3000/api';

async function api(path, opts) {
    const res = await fetch(API_BASE + path, opts);
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
}

async function test() {
    console.log('1. Get collection');
    const cards = await api('/collection');
    console.log('  Cards:', cards.length);

    console.log('2. Generate card');
    const card = await api('/generate-card', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({object_name: 'sword', category: 'weapon', size: 'medium', traits: ['sharp']})
    });
    console.log('  Card:', card.name, 'HP:', card.hp, 'ATK:', card.atk, 'Skills:', card.skills.length);

    console.log('3. Start run');
    const run = await api('/start-run', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({startingCard: card})
    });
    console.log('  Run:', run.id, 'Round:', run.currentRound);

    console.log('4. Generate boss');
    const boss = await api('/generate-boss', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({analysis: {object_name: 'dragon', category: 'animal', size: 'large'}, roundIndex: 0})
    });
    console.log('  Boss:', boss.name, 'HP:', boss.hp, 'ATK:', boss.atk);

    console.log('5. Start battle');
    let state = await api('/battle/start', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({team: [card], boss, buffs: []})
    });
    console.log('  Turn:', state.turn, 'HP:', state.teamHp, 'MP:', state.mp, 'Boss HP:', state.boss.currentHp);

    console.log('6. Player action');
    const skill = card.skills[0];
    console.log('  Using skill:', skill.name, 'cost:', skill.cost, 'power:', skill.power);
    const action = await api('/battle/action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({state, skillId: skill.id, cardId: card.id})
    });
    console.log('  Action response:', JSON.stringify(action, null, 2).substring(0, 500));
    if (!action.success) { console.error('  Action failed:', action.error); return; }
    console.log('  Success:', action.success, 'Damage:', action.result?.damage, 'Boss HP:', action.state.boss.currentHp);
    state = action.state;

    console.log('7. End turn');
    const endTurn = await api('/battle/end-turn', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({state})
    });
    console.log('  Turn:', endTurn.state.turn, 'Player HP:', endTurn.state.teamHp, 'Boss HP:', endTurn.state.boss.currentHp);

    console.log('8. Buff choices');
    const buffs = await api('/buff-choices', {method: 'POST'});
    console.log('  Buffs:', buffs.map(b => b.name).join(', '));

    console.log('\nAll tests passed!');
}

test().catch(e => console.error('Test failed:', e));
