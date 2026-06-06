const fetch = require('node-fetch');

async function test(model) {
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 10
  });
  const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer sk-jnqanofvgaxpsjzvsjspsisrfpowoydcyolxsnjdjdsuexds', 'Content-Type': 'application/json' },
    body
  });
  const data = await res.json();
  console.log(model, '→', res.status, data.error?.message || data.choices?.[0]?.message?.content?.substring(0,20));
}

async function main() {
  await test('Qwen/Qwen2.5-7B-Instruct');
  await test('Qwen/Qwen2-VL-7B-Instruct');
  await test('Pro/Qwen/Qwen2-VL-7B-Instruct');
  await test('deepseek-ai/DeepSeek-V2.5');
}

main().catch(console.error);
