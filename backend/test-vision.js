const fetch = require('node-fetch');

async function test() {
  const img = Buffer.from('{"test":"data"}').toString('base64');
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } }
      ]
    }],
    max_tokens: 100
  });
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer sk-b9ad94a012d54b579744f6828a528fec', 'Content-Type': 'application/json' },
    body
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

test().catch(console.error);
