const fetch = require('node-fetch');

const MOCK_MODE = process.env.LLM_MOCK_MODE === 'true';
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai'; // openai, claude, gemini
const API_KEY = process.env.LLM_API_KEY || '';
const API_URL = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.LLM_MODEL || 'gpt-4o';
const VISION_MODEL = process.env.LLM_VISION_MODEL || 'gpt-4o';
const TEXT_MODEL = process.env.LLM_TEXT_MODEL || process.env.LLM_MODEL || 'deepseek-chat';

/**
 * Analyze image and return object details
 * @param {string} imageBase64 - Base64 encoded image (without data URI prefix)
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeImage(imageBase64) {
  if (MOCK_MODE || !API_KEY) {
    if (!API_KEY) console.log('No API key configured, returning mock data');
    return getMockAnalysis();
  }

  const prompt = `You are looking at a photo. Identify the main object in the photo accurately. Respond ONLY in JSON format:
{
  "object_name": "actual object name in Chinese, 2-6 characters. Be literal and accurate.",
  "category": "one of: animal, plant, food, object, vehicle, building, nature, person",
  "size": "one of: tiny, small, medium, large, huge",
  "traits": ["3 descriptive traits in Chinese"],
  "suggested_role": "one of: 物理输出, 魔法输出, 坦克, 辅助, 治疗, 平衡",
  "confidence": 0.95
}
Rules:
- Output the REAL object name, not a description of a person or character.
- If the photo shows a water bottle, output "矿泉水瓶" not a person.
- If you cannot identify the object, output "未知物体".`;

  try {
    const response = await callLLMAPI(prompt, imageBase64);
    return parseAnalysisResponse(response);
  } catch (error) {
    console.error('LLM analysis error:', error);
    // Fallback to mock on error if no API key
    if (!API_KEY) {
      console.log('No API key configured, returning mock data');
      return getMockAnalysis();
    }
    throw error;
  }
}

/**
 * Validate that image contains a single main object and analyze it
 * @param {string} imageBase64 - Base64 encoded image
 * @returns {Promise<{valid: boolean, error?: string, analysis?: Object}>}
 */
async function validateSingleObject(imageBase64) {
  if (MOCK_MODE || !API_KEY) {
    const analysis = getMockAnalysis();
    analysis._mock = true;
    analysis._notice = '当前使用模拟数据。请在 backend/.env 中配置 LLM_API_KEY 以启用真实图片识别。';
    return { valid: true, analysis };
  }

  try {
    const analysis = await analyzeImage(imageBase64);
    return { valid: true, analysis };
  } catch (error) {
    console.error('Validation/analysis error:', error);
    return { valid: false, error: error.message || '分析失败，请重试' };
  }
}

/**
 * Call LLM API with image
 */
async function callLLMAPI(prompt, imageBase64) {
  const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`;

  let body;
  if (LLM_PROVIDER === 'claude') {
    body = JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 1024,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: prompt }
        ]
      }]
    });
  } else if (LLM_PROVIDER === 'gemini') {
    body = JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
          { text: prompt }
        ]
      }],
      generationConfig: { temperature: 0.3 }
    });
  } else {
    // OpenAI compatible format
    body = JSON.stringify({
      model: VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }],
      max_tokens: 1024,
      temperature: 0.3
    });
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (LLM_PROVIDER === 'gemini') {
    headers['x-goog-api-key'] = API_KEY;
  } else if (LLM_PROVIDER === 'claude') {
    headers['x-api-key'] = API_KEY;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`LLM API error ${res.status}:`, errorText.substring(0, 500));
    throw new Error(`LLM API error ${res.status}`);
  }

  const data = await res.json();

  // Extract text from different response formats
  if (LLM_PROVIDER === 'gemini') {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (LLM_PROVIDER === 'claude') {
    return data.content?.[0]?.text || '';
  } else {
    return data.choices?.[0]?.message?.content || '';
  }
}

/**
 * Parse JSON from LLM response text with enhanced fault tolerance
 */
function parseAnalysisResponse(text) {
  if (!text || typeof text !== 'string') {
    console.error('Invalid LLM response type:', typeof text);
    return { object_name: '未知物体', category: 'object', size: 'medium', traits: ['神秘', '未知', '独特'], suggested_role: '平衡', confidence: 0.3 };
  }

  let jsonStr = text.trim();

  // 1. Try to extract JSON from markdown code blocks
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // 2. If not starting with {, find the first JSON object
  if (!jsonStr.startsWith('{')) {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
  }

  // 3. Clean common LLM formatting issues
  // Remove trailing commas before } or ]
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
  // Replace Chinese quotes if any
  jsonStr = jsonStr.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

  try {
    const result = JSON.parse(jsonStr);
    const parsed = {
      object_name: result.object_name || result.objectName || result.name || '未知物体',
      category: normalizeCategory(result.category || result.type),
      size: normalizeSize(result.size || result.sizeCategory),
      traits: normalizeTraits(result.traits),
      suggested_role: result.suggested_role || result.suggestedRole || result.role || '平衡',
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.8
    };
    console.log('[LLM Analysis] parsed:', parsed.object_name, 'category:', parsed.category, 'confidence:', parsed.confidence);
    return parsed;
  } catch (e) {
    console.error('Failed to parse LLM response, raw text:', text.substring(0, 500));
    // Return unknown instead of random mock to avoid completely wrong results
    return {
      object_name: '未知物体',
      category: 'object',
      size: 'medium',
      traits: ['神秘', '未知', '独特'],
      suggested_role: '平衡',
      confidence: 0.3
    };
  }
}

function normalizeCategory(c) {
  const valid = ['animal', 'plant', 'food', 'object', 'vehicle', 'building', 'nature', 'weapon', 'tool', 'furniture', 'electronics'];
  const lower = String(c || 'object').toLowerCase().trim();
  if (valid.includes(lower)) return lower;
  const map = {
    '动物': 'animal', '植物': 'plant', '食物': 'food', '物体': 'object',
    '物品': 'object', '工具': 'tool', '武器': 'weapon', '家具': 'furniture',
    '建筑': 'building', '车辆': 'vehicle', '车': 'vehicle', '电子': 'electronics',
    '电子产品': 'electronics', '自然': 'nature', '风景': 'nature'
  };
  return map[lower] || 'object';
}

function normalizeSize(s) {
  const valid = ['tiny', 'small', 'medium', 'large', 'giant'];
  const lower = String(s || 'medium').toLowerCase().trim();
  if (valid.includes(lower)) return lower;
  const map = {
    '微小': 'tiny', '极小': 'tiny', '小': 'small', '迷你': 'small',
    '中': 'medium', '中等': 'medium', '正常': 'medium',
    '大': 'large', '巨大': 'giant', '超大': 'giant', 'huge': 'giant'
  };
  return map[lower] || 'medium';
}

function normalizeTraits(traits) {
  if (Array.isArray(traits)) return traits.filter(t => t && typeof t === 'string');
  if (typeof traits === 'string') return traits.split(/[,，、]/).map(t => t.trim()).filter(Boolean);
  return ['普通'];
}

/**
 * Get mock analysis for testing
 */
function getMockAnalysis(objectHint) {
  if (objectHint) {
    return {
      object_name: objectHint,
      category: 'object',
      size: 'medium',
      traits: ['神秘', '未知', '独特'],
      suggested_role: '物理输出',
      confidence: 0.6
    };
  }
  const mocks = [
    {
      object_name: '英国短毛猫',
      category: 'animal',
      size: 'medium',
      traits: ['敏捷', '生物', '毛茸茸'],
      suggested_role: '物理输出',
      confidence: 0.95
    },
    {
      object_name: '仙人掌',
      category: 'plant',
      size: 'small',
      traits: ['坚韧', '带刺', '耐旱'],
      suggested_role: '坦克',
      confidence: 0.92
    },
    {
      object_name: '汉堡包',
      category: 'food',
      size: 'small',
      traits: ['美味', '高热量', '多层'],
      suggested_role: '辅助',
      confidence: 0.88
    }
  ];
  return mocks[Math.floor(Math.random() * mocks.length)];
}

/**
 * Call LLM API with text only (no image)
 */
async function callLLMTextAPI(prompt) {
  let body;
  if (LLM_PROVIDER === 'claude') {
    body = JSON.stringify({
      model: TEXT_MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    });
  } else if (LLM_PROVIDER === 'gemini') {
    body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    });
  } else {
    body = JSON.stringify({
      model: TEXT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
      temperature: 0.9
    });
  }

  const headers = { 'Content-Type': 'application/json' };
  if (LLM_PROVIDER === 'gemini') {
    headers['x-goog-api-key'] = API_KEY;
  } else if (LLM_PROVIDER === 'claude') {
    headers['x-api-key'] = API_KEY;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await fetch(API_URL, { method: 'POST', headers, body, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`LLM API error ${res.status}:`, errorText.substring(0, 500));
    throw new Error(`LLM API error ${res.status}`);
  }
  const data = await res.json();
  if (LLM_PROVIDER === 'gemini') {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (LLM_PROVIDER === 'claude') {
    return data.content?.[0]?.text || '';
  } else {
    return data.choices?.[0]?.message?.content || '';
  }
}

/**
 * Generate an adventure story segment
 * @param {Object} context - Story context
 * @param {Array} context.team - Current team members
 * @param {Object} context.newMember - The newly joined member
 * @param {number} context.round - Current round (1-5)
 * @param {Array} context.previousStory - Previous story segments
 * @param {boolean} context.isFirst - Whether this is the first partner
 * @returns {Promise<string>} Story segment
 */
async function generateStorySegment(context) {
  const { team, newMember, round, previousStory, isFirst, isEnding } = context;
  
  if (MOCK_MODE || !API_KEY) {
    // Fallback: generate a template-based story segment
    return generateMockStorySegment(context);
  }

  const teamNames = (team || []).map(c => c.name).join('、') || '无';
  const prevText = (previousStory || []).join('\n');
  
  let prompt;
  if (isEnding) {
    prompt = `你是一位热血冒险小说的叙述者。请以"你"为主角（第二人称），写一段冒险旅程的结局（15-30个汉字）。

故事设定：
- 主角是"你"（用户本人）
- 你完成了全部5关冒险，击败了所有Boss
- 你的伙伴们一路陪伴你走到了最后

当前队伍：${teamNames}
完整冒险历程：
${prevText || '（暂无）'}

要求：
- 以"你"为主角叙述，用第二人称
- 提到伙伴们的名字，表达旅程结束的感慨
- 风格：热血、感动、略带史诗感
- 15-30个汉字，只输出纯文本，不要加引号或任何格式`;
  } else {
    prompt = `你是一位热血冒险小说的叙述者。请以"你"为主角（第二人称），写一段冒险故事（15-25个汉字）。

故事设定：
- 主角是"你"（用户本人）
- 拍的第一张照片生成的角色是你的第一个伙伴（跟随者）
- 之后每击败一个Boss，该Boss化为伙伴加入你的队伍

当前队伍：${teamNames}
${isFirst ? '起点：你遇到了第一个伙伴' + (newMember?.name || '未知') : '新伙伴：' + (newMember?.name || '未知') + '（刚被你击败后入队）'}
当前进度：第${round}关

之前的故事：
${prevText || '（暂无）'}

要求：
- 以"你"为主角叙述，用第二人称
- 必须提到伙伴的名字和特征
- 风格：热血冒险，略带幽默
- 15-25个汉字，只输出纯文本，不要加引号或任何格式`;
  }

  try {
    const response = await callLLMTextAPI(prompt);
    // Clean up: remove quotes, trim, limit length
    let segment = response.trim().replace(/^[""']|[""']$/g, '').replace(/\n/g, '');
    if (segment.length > 50) segment = segment.substring(0, 50);
    if (segment.length < 10) segment = generateMockStorySegment(context);
    return segment;
  } catch (error) {
    console.error('Story generation error:', error);
    return generateMockStorySegment(context);
  }
}

/**
 * Generate a mock story segment when LLM is unavailable
 */
function generateMockStorySegment(context) {
  const { team, newMember, isFirst, isEnding } = context;
  const name = newMember?.name?.replace(/·.+$/, '') || '神秘伙伴';
  const teamNames = (team || []).map(c => c.name?.replace(/·.+$/, '') || '伙伴').join('、');
  
  if (isEnding) {
    const endings = [
      `你和${teamNames}一起完成了这段传奇冒险，传说将永远流传。`,
      `旅程结束了，但${teamNames}与你的羁绊将永不磨灭。`,
      `你站在终点回望，${teamNames}的身影让这一切都值得。`,
      `冒险落幕，你和${teamNames}的名字将被后人传颂。`,
      `所有的战斗都已成为过往，${teamNames}仍与你并肩而立。`
    ];
    return endings[Math.floor(Math.random() * endings.length)];
  }
  
  const firstOpenings = [
    `你踏上了未知的旅途，${name}成为了你的第一个伙伴。`,
    `冒险开始了，${name}紧跟在你身后，眼神中充满好奇。`,
    `你迈出了第一步，${name}默默站在你身旁，准备迎接挑战。`,
    `传说之地向你敞开大门，${name}是你的第一位同行者。`
  ];
  
  const bossJoins = [
    `你击败了${name}，它心服口服地加入了你的队伍。`,
    `一番激战后，${name}低下了头，成为了你的新伙伴。`,
    `你向${name}伸出了手，它犹豫片刻后选择了跟随。`,
    `战胜了${name}后，它的力量将为你所用。`,
    `${name}被你的实力折服，决定与你并肩作战。`
  ];
  
  const pool = isFirst ? firstOpenings : bossJoins;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
  analyzeImage,
  validateSingleObject,
  callLLMAPI,
  callLLMTextAPI,
  generateStorySegment,
  getMockAnalysis
};
