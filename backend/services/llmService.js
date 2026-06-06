const fetch = require('node-fetch');

const MOCK_MODE = process.env.LLM_MOCK_MODE === 'true';
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai'; // openai, claude, gemini
const API_KEY = process.env.LLM_API_KEY || '';
const API_URL = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.LLM_MODEL || 'gpt-4o';

/**
 * Analyze image and return object details
 * @param {string} imageBase64 - Base64 encoded image (without data URI prefix)
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeImage(imageBase64) {
  if (MOCK_MODE) {
    return getMockAnalysis();
  }

  const prompt = `Analyze the image and identify the main object. Respond in JSON format only:
{
  "object_name": "object's common name in Chinese",
  "category": "one of: animal, plant, food, object, vehicle, building, nature",
  "size": "one of: tiny, small, medium, large, huge",
  "traits": ["trait1", "trait2", "trait3"],
  "suggested_role": "role in Chinese like 物理输出, 魔法输出, 坦克, 辅助, 治疗",
  "confidence": 0.95
}`;

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
      model: MODEL,
      max_tokens: 1024,
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
      }]
    });
  } else {
    // OpenAI compatible format
    body = JSON.stringify({
      model: MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }],
      max_tokens: 1024
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

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LLM API error ${res.status}: ${errorText}`);
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
    return getMockAnalysis();
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
    return {
      object_name: result.object_name || result.objectName || result.name || '未知物体',
      category: normalizeCategory(result.category || result.type),
      size: normalizeSize(result.size || result.sizeCategory),
      traits: normalizeTraits(result.traits),
      suggested_role: result.suggested_role || result.suggestedRole || result.role || '平衡',
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.8
    };
  } catch (e) {
    console.error('Failed to parse LLM response:', text);
    return getMockAnalysis();
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

module.exports = {
  analyzeImage,
  validateSingleObject,
  callLLMAPI,
  getMockAnalysis
};
