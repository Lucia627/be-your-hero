function validateBody(schema) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: '请求体必须是JSON对象' });
    }

    const errors = [];
    for (const [key, rule] of Object.entries(schema)) {
      const value = req.body[key];
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`缺少必填字段: ${key}`);
        continue;
      }
      if (value !== undefined && value !== null) {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`字段 ${key} 类型错误，期望 ${rule.type}，实际为 ${typeof value}`);
        }
        if (rule.validator && !rule.validator(value)) {
          errors.push(`字段 ${key} 校验失败: ${rule.message || '不符合规则'}`);
        }
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: '请求参数错误', details: errors });
    }
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [key, rule] of Object.entries(schema)) {
      const value = req.query[key];
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`缺少必填查询参数: ${key}`);
        continue;
      }
      if (value !== undefined && value !== null && value !== '') {
        if (rule.type === 'number' && isNaN(Number(value))) {
          errors.push(`查询参数 ${key} 必须是数字`);
        }
        if (rule.validator && !rule.validator(value)) {
          errors.push(`查询参数 ${key} 校验失败`);
        }
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: '查询参数错误', details: errors });
    }
    next();
  };
}

module.exports = { validateBody, validateQuery };
