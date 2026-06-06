const fetch = require('node-fetch');

async function test() {
  // 创建一个 1x1 像素的红色图片作为测试
  const img = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const body = JSON.stringify({
    model: 'OpenGVLab/InternVL2-8B',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze the image and identify the main object. Respond in JSON format only: {"object_name":"name in Chinese","category":"one of: animal, plant, food, object, vehicle, building, nature","size":"one of: tiny, small, medium, large, huge","traits":["trait1","trait2"],"suggested_role":"role in Chinese","confidence":0.95}' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${img}` } }
      ]
    }],
    max_tokens: 512
  });
  const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer sk-jnqanofvgaxpsjzvsjspsisrfpowoydcyolxsnjdjdsuexds', 'Content-Type': 'application/json' },
    body
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2).substring(0, 800));
}

test().catch(console.error);
