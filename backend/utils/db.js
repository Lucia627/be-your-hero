const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'game.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open SQLite database:', err);
  } else {
    console.log('SQLite database connected:', DB_PATH);
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    // 用户表（简易模式：昵称即身份）
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL UNIQUE,
        token TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 用户卡牌收藏
    db.run(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        card_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 进行中的冒险
    db.run(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        run_json TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 冒险历史
    db.run(`
      CREATE TABLE IF NOT EXISTS run_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        run_json TEXT NOT NULL,
        status TEXT,
        ended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // PvP 房间
    db.run(`
      CREATE TABLE IF NOT EXISTS pvp_rooms (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL UNIQUE,
        host_id TEXT NOT NULL,
        host_team_json TEXT,
        guest_id TEXT,
        guest_team_json TEXT,
        status TEXT DEFAULT 'waiting',
        winner_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // PvP 战斗历史
    db.run(`
      CREATE TABLE IF NOT EXISTS pvp_history (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        host_id TEXT NOT NULL,
        guest_id TEXT NOT NULL,
        winner_id TEXT,
        battle_json TEXT,
        ended_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized.');
  });
}

// Promise 包装
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { db, run, get, all };
