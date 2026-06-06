const fetch = require('node-fetch');

const KEY = 'sk-jnqanofvgaxpsjzvsjspsisrfpowoydcyolxsnjdjdsuexds';
const img = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function testVision(model) {
  const body = JSON.stringify({
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image? One word answer.' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${img}` } }
      ]
    }],
    max_tokens: 50
  });
  const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body
  });
  const data = await res.json();
  const msg = data.error?.message || data.choices?.[0]?.message?.content?.substring(0,30) || JSON.stringify(data).substring(0,60);
  console.log(model, '→', res.status, msg);
}

async function main() {
  await testVision('Qwen/Qwen2-VL-72B-Instruct');
  await testVision('Qwen/Qwen2-VL-7B-Instruct');
  await testVision('deepseek-ai/deepseek-vl2');
  await testVision('OpenGVLab/InternVL2-8B');
  await testVision('OpenGVLab/InternVL2-Llama3-76B');
  await testVision('Pro/Qwen/Qwen2-VL-7B-Instruct');
}

main().catch(console.error);
