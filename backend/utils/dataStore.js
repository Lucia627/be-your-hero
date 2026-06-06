const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

const locks = new Map();
const memoryCache = new Map();

async function withFileLock(filePath, fn) {
  const key = path.resolve(filePath);
  while (locks.get(key)) {
    await new Promise(r => setTimeout(r, 10));
  }
  locks.set(key, true);
  try {
    return await fn();
  } finally {
    locks.set(key, false);
  }
}

async function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
  const tempPath = filePath + '.tmp';
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

async function createBackup(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    return;
  }
  const backupDir = path.join(path.dirname(filePath), 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = path.basename(filePath, path.extname(filePath));
  const backupPath = path.join(backupDir, `${baseName}_${timestamp}.json`);
  await fs.copyFile(filePath, backupPath);

  // 清理旧备份，保留最近 N 个
  try {
    const files = await fs.readdir(backupDir);
    const backups = files
      .filter(f => f.startsWith(baseName + '_') && f.endsWith('.json'))
      .map(f => ({ name: f, path: path.join(backupDir, f), stat: null }));
    // 按文件名排序（包含时间戳）
    backups.sort((a, b) => a.name.localeCompare(b.name));
    while (backups.length > config.data.backupCount) {
      const old = backups.shift();
      await fs.unlink(old.path).catch(() => {});
    }
  } catch (e) {
    // 忽略清理错误
  }
}

async function loadJson(filePath, defaultValue, options = {}) {
  return withFileLock(filePath, async () => {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      let parsed = JSON.parse(raw);
      // 兼容旧格式：纯数组（cards.json）
      if (Array.isArray(parsed)) {
        parsed = { version: 1, updatedAt: new Date().toISOString(), data: parsed };
      }
      // 兼容旧格式：{ currentRun, history }（progress.json）
      else if ((parsed.currentRun !== undefined || parsed.history !== undefined) && !parsed.data) {
        parsed = { version: 1, updatedAt: new Date().toISOString(), data: parsed };
      }
      const migrated = migrateData(parsed);
      if (options.validator) {
        const valid = options.validator(migrated.data);
        if (!valid) throw new Error('Data validation failed for ' + filePath);
      }
      memoryCache.set(path.resolve(filePath), { data: migrated.data, timestamp: Date.now() });
      return migrated;
    } catch (e) {
      if (e.code === 'ENOENT') {
        const doc = { version: 1, updatedAt: new Date().toISOString(), data: defaultValue };
        await atomicWrite(filePath, doc);
        memoryCache.set(path.resolve(filePath), { data: defaultValue, timestamp: Date.now() });
        return doc;
      }
      throw e;
    }
  });
}

async function saveJson(filePath, dataValue, options = {}) {
  return withFileLock(filePath, async () => {
    if (options.backup !== false) {
      await createBackup(filePath);
    }
    let doc;
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      doc = JSON.parse(raw);
      if (Array.isArray(doc)) doc = { version: 1, data: doc };
      else if (!doc.data) doc = { version: 1, data: doc };
    } catch (e) {
      doc = { version: 1 };
    }
    doc.version = (doc.version || 0) + 1;
    doc.updatedAt = new Date().toISOString();
    doc.data = dataValue;
    await atomicWrite(filePath, doc);
    memoryCache.set(path.resolve(filePath), { data: dataValue, timestamp: Date.now() });
  });
}

function getCached(filePath) {
  const cached = memoryCache.get(path.resolve(filePath));
  return cached ? cached.data : undefined;
}

function clearCache(filePath) {
  if (filePath) {
    memoryCache.delete(path.resolve(filePath));
  } else {
    memoryCache.clear();
  }
}

function migrateData(doc) {
  if (!doc.version) doc.version = 0;
  // 数据迁移逻辑（未来扩展）
  doc.version = Math.max(doc.version, 1);
  return doc;
}

module.exports = { loadJson, saveJson, atomicWrite, withFileLock, getCached, clearCache };
