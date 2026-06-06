const fs = require('fs');
const fetch = require('node-fetch');

const KEY = 'sk-jnqanofvgaxpsjzvsjspsisrfpowoydcyolxsnjdjdsuexds';
const imgPath = '/home/a1246/Be Your Hero/backend/test-img.jpg';

async function test(model) {
  const img = fs.readFileSync(imgPath).toString('base64');
  console.log('Image size:', fs.statSync(imgPath).size, 'bytes');
  
  const body = JSON.stringify({
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze the image and identify the main object. Respond in JSON only: {"object_name":"Chinese name","category":"animal/plant/food/object/vehicle/building/nature","size":"tiny/small/medium/large/huge","traits":["trait1","trait2"],"suggested_role":"Chinese role","confidence":0.95}' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } }
      ]
    }],
    max_tokens: 512
  });
  
  const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body
  });
  
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Content:', data.choices?.[0]?.message?.content || JSON.stringify(data));
}

test('Qwen/Qwen3-VL-8B-Instruct').catch(console.error);
