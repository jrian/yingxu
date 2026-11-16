import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGateway } from '../server.mjs';

const baseEnv = { DEEPSEEK_API_KEY:'test-deepseek-key', QWEN_API_KEY:'test-qwen-key', DOUBAO_API_KEY:'test-doubao-key', ZHIPU_API_KEY:'test-zhipu-key', MOONSHOT_API_KEY:'test-moonshot-key', GATEWAY_TOKEN: 'gateway-test-token', OPENAI_API_KEY: 'private-openai-key', GEMINI_API_KEY: 'private-google-key', ANTHROPIC_API_KEY: 'private-anthropic-key', COMPATIBLE_API_KEY: 'private-compatible-key', COMPATIBLE_BASE_URL: 'https://model.example/v1/' };
async function fixture(t, fetchImpl, env = baseEnv) {
  const server = createGateway({ env, fetchImpl: fetchImpl ?? (() => { throw new Error('Unexpected upstream call'); }) });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, options = {}) => fetch(base + path, { ...options, headers: { Authorization: 'Bearer gateway-test-token', ...options.headers } });
}
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const prompt = (provider, extra = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, model: 'test-model', input: 'hello', system: 'be clear', maxOutputTokens: 100, ...extra }) });

test('health and providers expose no secrets; production still requires auth', async t => {
  const request = await fixture(t);
  assert.deepEqual(await (await request('/health')).json(), { ok: true });
  const providers = await (await request('/api/providers')).json();
  assert.equal(providers.providers.length, 9); assert.ok(providers.providers.every(x => x.configured));
  assert.ok(!JSON.stringify(providers).includes('private-'));
  for (const path of ['/api/providers', '/api/models?provider=openai', '/api/unknown']) {
    assert.equal((await request(path, { headers: { Authorization: '' } })).status, 401);
  }
  assert.equal((await request('/api/prompt', { ...prompt('openai'), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' } })).status, 401);
  const unconfigured = await fixture(t, undefined, { NODE_ENV: 'production' });
  assert.equal((await unconfigured('/api/providers')).status, 503);
});
test('CORS preflight, rejected origins and independent authentication', async t => {
  const request = await fixture(t);
  const preflight = await request('/api/prompt', { method: 'OPTIONS', headers: { Authorization: '', Origin: 'http://127.0.0.1:8765', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:8765');
  const noToken = await request('/api/providers', { headers: { Authorization: '', Origin: 'https://jrian.github.io' } });
  assert.equal(noToken.status, 401);
  assert.equal((await request('/api/providers', { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request('/api/prompt', { method: 'OPTIONS', headers: { Origin: 'https://jrian.github.io', 'Access-Control-Request-Method': 'DELETE' } })).status, 403);
});
test('validation rejects invalid bodies, unsafe parameters and absent provider config without upstream calls', async t => {
  const request = await fixture(t);
  for (const extra of [{ input: '' }, { input: 1 }, { provider: 'unknown' }, { model: '../bad' }, { system: 1 }, { maxOutputTokens: 4097 }, { maxOutputTokens: 0 }, { upstreamURL: 'https://evil.example' }]) assert.equal((await request('/api/prompt', prompt('openai', extra))).status, 400);
  assert.equal((await request('/api/prompt', { ...prompt('openai'), body: '{' })).status, 400);
  assert.equal((await request('/api/prompt', { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await request('/api/prompt', prompt('openai', { input: 'x'.repeat(66000) }))).status, 413);
  const missing = await fixture(t, undefined, { GATEWAY_TOKEN: baseEnv.GATEWAY_TOKEN });
  assert.equal((await missing('/api/models?provider=openai')).status, 503);
  const badBase = await fixture(t, undefined, { ...baseEnv, COMPATIBLE_BASE_URL: 'https://user:secret@example.com/v1' });
  assert.equal((await badBase('/api/models?provider=compatible')).status, 503);
});

for (const provider of ['openai', 'gemini', 'anthropic', 'compatible']) {
  test(`${provider}: model listing and explicit generation use expected upstream API`, async t => {
    const calls = [];
    const request = await fixture(t, async (url, options) => {
      calls.push({ url, ...options });
      if (options.method === 'GET') return json(provider === 'gemini' ? { models: [{ name: 'models/test-model', displayName: 'Test', supportedGenerationMethods: ['generateContent'] }, { name: 'models/embed', supportedGenerationMethods: ['embedContent'] }] } : { data: [{ id: 'test-model', display_name: 'Test' }] });
      return json(provider === 'openai' ? { output: [{ content: [{ type: 'output_text', text: 'result' }] }], usage: { output_tokens: 10, secret: 'do not echo' } } : provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: 'hidden', thought: true }, { text: 'result' }] } }], usageMetadata: { candidatesTokenCount: 10 } } : provider === 'anthropic' ? { content: [{ type: 'text', text: 'result' }], usage: { output_tokens: 10 } } : { choices: [{ message: { content: 'result' } }], usage: { completion_tokens: 10 } });
    });
    const listed = await (await request(`/api/models?provider=${provider}`)).json();
    assert.equal(listed.models.length, 1); assert.equal(listed.models[0].id, 'test-model'); assert.equal(calls.length, 1); assert.equal(calls[0].method, 'GET');
    const result = await (await request('/api/prompt', prompt(provider))).json();
    assert.equal(result.text, 'result'); assert.equal(result.provider, provider); assert.ok(!JSON.stringify(result).includes('do not echo'));
    const call = calls[1], payload = JSON.parse(call.body);
    assert.ok(call.signal instanceof AbortSignal);
    if (provider === 'openai') { assert.equal(call.url, 'https://api.openai.com/v1/responses'); assert.equal(payload.store, false); assert.equal(payload.instructions, 'be clear'); assert.equal(payload.max_output_tokens, 100); assert.equal(call.headers.Authorization, 'Bearer private-openai-key'); }
    if (provider === 'gemini') { assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent'); assert.equal(call.headers['x-goog-api-key'], 'private-google-key'); assert.equal(payload.systemInstruction.parts[0].text, 'be clear'); assert.equal(payload.generationConfig.maxOutputTokens, 100); }
    if (provider === 'anthropic') { assert.equal(call.url, 'https://api.anthropic.com/v1/messages'); assert.equal(call.headers['anthropic-version'], '2023-06-01'); assert.equal(call.headers['x-api-key'], 'private-anthropic-key'); assert.equal(payload.max_tokens, 100); }
    if (provider === 'compatible') { assert.equal(call.url, 'https://model.example/v1/chat/completions'); assert.equal(payload.messages[0].role, 'system'); assert.equal(payload.max_tokens, 100); }
  });
}
test('Gemini and Anthropic pagination preserves model lists', async t => {
  for (const provider of ['gemini', 'anthropic']) {
    let count = 0;
    const request = await fixture(t, async url => {
      count++;
      if (count === 2) assert.ok(url.includes(provider === 'gemini' ? 'pageToken=next' : 'after_id=m1'));
      return json(provider === 'gemini' ? { models: [{ name: `models/m${count}`, supportedGenerationMethods: ['generateContent'] }], ...(count === 1 ? { nextPageToken: 'next' } : {}) } : { data: [{ id: `m${count}` }], has_more: count === 1, last_id: 'm1' });
    });
    assert.equal((await (await request(`/api/models?provider=${provider}`)).json()).models.length, 2);
  }
});
test('upstream failures are bounded and never echo raw errors', async t => {
  for (const [status, code] of [[401, 'UPSTREAM_AUTH_FAILED'], [403, 'UPSTREAM_AUTH_FAILED'], [429, 'UPSTREAM_RATE_LIMITED'], [500, 'UPSTREAM_UNAVAILABLE'], [400, 'UPSTREAM_REJECTED']]) {
    const request = await fixture(t, async () => new Response('private-secret prompt text', { status }));
    const response = await request('/api/prompt', prompt('openai'));
    const result = await response.json(); assert.equal(result.error.code, code); assert.ok(!JSON.stringify(result).includes('private-secret'));
    assert.equal(response.status, status === 429 ? 429 : 502);
  }
  for (const [fetcher, code, status] of [
    [async () => new Response('{'), 'UPSTREAM_INVALID_JSON', 502],
    [async () => json({ output: [] }), 'EMPTY_OUTPUT', 502],
    [async () => json({ output: 'malformed' }), 'UPSTREAM_INVALID_RESPONSE', 502],
    [async () => { throw new DOMException('private-secret', 'TimeoutError'); }, 'UPSTREAM_TIMEOUT', 504],
    [async () => { throw new Error('private-secret'); }, 'UPSTREAM_CONNECTION_FAILED', 502],
  ]) {
    const request = await fixture(t, fetcher);
    const response = await request('/api/prompt', prompt('openai'));
    assert.equal(response.status, status); assert.equal((await response.json()).error.code, code);
  }
});

for (const [provider,base] of Object.entries({deepseek:'https://api.deepseek.com',qwen:'https://dashscope.aliyuncs.com/compatible-mode/v1',doubao:'https://ark.cn-beijing.volces.com/api/v3',zhipu:'https://open.bigmodel.cn/api/paas/v4',moonshot:'https://api.moonshot.cn/v1'})) {
 test(`${provider}: discovery is honest and chat uses the provider endpoint`, async t=>{
  const calls=[];
  const request=await fixture(t,async(url,options)=>{calls.push({url,options});return json(options.method==='GET'?{data:[{id:'available-model'}]}:{choices:[{message:{content:'draft'}}]});});
  const listed=await(await request('/api/models?provider='+provider)).json();
  if(provider==='deepseek'){assert.equal(listed.verified,true);assert.equal(calls[0].url,base+'/models');}
  else {assert.equal(listed.discovery,'manual');assert.equal(listed.verified,false);assert.equal(calls.length,0);assert.deepEqual(listed.models,[]);}
  const generated=await(await request('/api/prompt',prompt(provider))).json();assert.equal(generated.text,'draft');
  const call=calls.at(-1);assert.equal(call.url,base+'/chat/completions');assert.equal(call.options.headers.Authorization,'Bearer test-'+provider+'-key');
  const body=JSON.parse(call.options.body);assert.equal(body.max_tokens,100);assert.equal(body.stream,false);assert.equal(body.messages[0].content,'be clear');
  if(provider==='qwen')assert.equal(body.enable_thinking,false);
 });
}
test('provider base overrides are server controlled HTTPS only',async t=>{
 const invalid=await fixture(t,undefined,{...baseEnv,QWEN_BASE_URL:'http://private.invalid/v1'});
 assert.equal((await invalid('/api/models?provider=qwen')).status,503);
 let called;
 const request=await fixture(t,async(url)=>{called=url;return json({choices:[{message:{content:'ok'}}]});},{...baseEnv,QWEN_BASE_URL:'https://workspace.example/compatible-mode/v1/'});
 assert.equal((await request('/api/prompt',prompt('qwen'))).status,200);assert.equal(called,'https://workspace.example/compatible-mode/v1/chat/completions');
});
