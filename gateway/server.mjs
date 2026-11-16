import http from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', key: 'DEEPSEEK_API_KEY', base: 'https://api.deepseek.com' },
  { id: 'qwen', name: '通义千问', key: 'QWEN_API_KEY', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', discovery: 'manual' },
  { id: 'doubao', name: '豆包', key: 'DOUBAO_API_KEY', base: 'https://ark.cn-beijing.volces.com/api/v3', discovery: 'manual' },
  { id: 'zhipu', name: '智谱 GLM', key: 'ZHIPU_API_KEY', base: 'https://open.bigmodel.cn/api/paas/v4', discovery: 'manual' },
  { id: 'moonshot', name: 'Kimi', key: 'MOONSHOT_API_KEY', base: 'https://api.moonshot.cn/v1', discovery: 'manual' },
  { id: 'openai', name: 'OpenAI', key: 'OPENAI_API_KEY', base: 'https://api.openai.com/v1' },
  { id: 'gemini', name: 'Google Gemini', key: 'GEMINI_API_KEY', base: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'anthropic', name: 'Anthropic Claude', key: 'ANTHROPIC_API_KEY', base: 'https://api.anthropic.com/v1' },
  { id: 'compatible', name: 'OpenAI 兼容', key: 'COMPATIBLE_API_KEY' },
];
function secureBase(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash ? u.href.replace(/\/+$/, '') : null; } catch { return null; }
}
class GatewayError extends Error {
  constructor(status, code, message) { super(message); Object.assign(this, { status, code }); }
}
const fail = (status, code, message) => { throw new GatewayError(status, code, message); };
const equal = (a, b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
function compatibleBase(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) return null;
    return u.href.replace(/\/+$/, '').replace(/(?:\/v1)+$/, '') + '/v1';
  } catch { return null; }
}
function bodyJSON(req) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [], rejected = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 65536) {
        if (!rejected) reject(new GatewayError(413, 'BODY_TOO_LARGE', '请求正文不得超过 64KB。'));
        rejected = true; chunks = []; return;
      }
      if (!rejected) chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new GatewayError(400, 'INVALID_JSON', '请求必须是有效 JSON。')); }
    });
    req.on('error', () => reject(new GatewayError(400, 'INVALID_REQUEST', '请求读取失败。')));
  });
}
function validateInput(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'INVALID_REQUEST', '请求必须是 JSON 对象。');
  const allowed = new Set(['provider', 'model', 'input', 'system', 'maxOutputTokens']);
  if (Object.keys(data).some(k => !allowed.has(k))) fail(400, 'INVALID_REQUEST', '请求包含不支持的字段。');
  if (typeof data.input !== 'string' || !data.input.trim()) fail(400, 'INVALID_INPUT', '请输入提示词内容。');
  if (data.system !== undefined && typeof data.system !== 'string') fail(400, 'INVALID_SYSTEM', 'system 必须是字符串。');
  if (typeof data.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+-]{0,199}$/.test(data.model) || data.model.includes('..')) fail(400, 'INVALID_MODEL', '模型 ID 无效。');
  const max = data.maxOutputTokens ?? 2048;
  if (!Number.isInteger(max) || max < 1 || max > 4096) fail(400, 'INVALID_TOKEN_LIMIT', '输出上限须为 1–4096 的整数。');
  return { ...data, maxOutputTokens: max };
}
function headers(provider, key) {
  if (provider === 'gemini') return { 'x-goog-api-key': key };
  if (provider === 'anthropic') return { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  return { Authorization: `Bearer ${key}` };
}
function generation(provider, data) {
  const { model, input, system, maxOutputTokens: max } = data;
  if (provider === 'openai') return ['/responses', { model, input, ...(system ? { instructions: system } : {}), max_output_tokens: max, store: false }];
  if (provider === 'gemini') {
    const id = model.replace(/^models\//, '');
    return [`/models/${encodeURIComponent(id)}:generateContent`, { contents: [{ role: 'user', parts: [{ text: input }] }], ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), generationConfig: { maxOutputTokens: max } }];
  }
  if (provider === 'anthropic') return ['/messages', { model, max_tokens: max, ...(system ? { system } : {}), messages: [{ role: 'user', content: input }] }];
  return ['/chat/completions', { model, max_tokens: max, stream: false, ...(provider === 'qwen' ? { enable_thinking: false } : {}), messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: input }] }];
}
function output(provider, data) {
  let text, usage;
  if (provider === 'openai') { text = data.output?.flatMap(x => x.content ?? []).filter(x => x.type === 'output_text').map(x => x.text).join('\n'); usage = data.usage; }
  else if (provider === 'gemini') { text = data.candidates?.[0]?.content?.parts?.filter(x => !x.thought && typeof x.text === 'string').map(x => x.text).join('\n'); usage = data.usageMetadata; }
  else if (provider === 'anthropic') { text = data.content?.filter(x => x.type === 'text').map(x => x.text).join('\n'); usage = data.usage; }
  else { text = data.choices?.[0]?.message?.content; usage = data.usage; }
  if (typeof text !== 'string' || !text.trim()) fail(502, 'EMPTY_OUTPUT', '模型未返回文字，请检查模型能力或调整输入。');
  // Return numeric usage only; never relay arbitrary upstream metadata.
  const safeUsage = usage && typeof usage === 'object' ? Object.fromEntries(Object.entries(usage).filter(([k, v]) => /^[a-zA-Z_]+$/.test(k) && typeof v === 'number' && Number.isFinite(v))) : undefined;
  return { text, ...(safeUsage && Object.keys(safeUsage).length ? { usage: safeUsage } : {}) };
}

export function createGateway({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const origins = new Set((env.ALLOWED_ORIGINS ?? 'http://127.0.0.1:8765,https://jrian.github.io').split(',').map(x => x.trim()).filter(Boolean));
  const token = env.GATEWAY_TOKEN?.trim();
  const config = PROVIDERS.map(p => ({ ...p, keyValue: env[p.key]?.trim(), base: p.id === 'compatible' ? compatibleBase(env.COMPATIBLE_BASE_URL) : env[p.id.toUpperCase() + '_BASE_URL'] ? secureBase(env[p.id.toUpperCase() + '_BASE_URL']) : p.base }));
  async function upstream(p, path, body) {
    try {
      const response = await fetchImpl(p.base + path, { method: body ? 'POST' : 'GET', headers: { ...headers(p.id, p.keyValue), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(40000), redirect: 'error' });
      if (!response.ok) {
        await response.body?.cancel();
        const status = response.status;
        if (status === 401 || status === 403) fail(502, 'UPSTREAM_AUTH_FAILED', '服务端模型密钥无效或权限不足。');
        if (status === 429) fail(429, 'UPSTREAM_RATE_LIMITED', '模型服务限流或配额不足，请稍后重试。');
        if (status >= 500) fail(502, 'UPSTREAM_UNAVAILABLE', '模型服务暂时不可用。');
        fail(502, 'UPSTREAM_REJECTED', '模型服务拒绝请求，请检查模型和输入参数。');
      }
      try { return await response.json(); }
      catch (error) {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw error;
        fail(502, 'UPSTREAM_INVALID_JSON', '模型服务返回了无效 JSON。');
      }
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') fail(504, 'UPSTREAM_TIMEOUT', '模型请求超过 40 秒，请稍后重试。');
      fail(502, 'UPSTREAM_CONNECTION_FAILED', '无法连接模型服务。');
    }
  }
  const server = http.createServer(async (req, res) => {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const origin = req.headers.origin;
      res.setHeader('Vary', 'Origin');
      if (origin) {
        if (!origins.has(origin)) fail(403, 'ORIGIN_NOT_ALLOWED', '此网页来源未获允许。');
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      if (req.method === 'OPTIONS') {
        if (!url.pathname.startsWith('/api/')) fail(404, 'NOT_FOUND', '接口不存在。');
        const method = req.headers['access-control-request-method'];
        const requestedHeaders = (req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
        if (!['GET', 'POST'].includes(method) || requestedHeaders.some(x => !['authorization', 'content-type'].includes(x))) fail(403, 'PREFLIGHT_REJECTED', '预检请求不受支持。');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true });
      if (url.pathname.startsWith('/api/')) {
        if (!token) fail(503, 'GATEWAY_NOT_CONFIGURED', '管理员尚未配置网关访问令牌。');
        const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
        if (!match || !equal(match[1], token)) fail(401, 'UNAUTHORIZED', '网关访问令牌无效。');
      }
      if (req.method === 'GET' && url.pathname === '/api/providers') return send(200, { providers: config.map(({ id, name, key, keyValue, base, discovery }) => ({ id, name, keyEnv: key, baseUrl: base, modelDiscovery: discovery ?? 'remote', configured: Boolean(keyValue && base) })) });
      const modelsRoute = req.method === 'GET' && url.pathname === '/api/models';
      const promptRoute = req.method === 'POST' && url.pathname === '/api/prompt';
      if (!modelsRoute && !promptRoute) fail(404, 'NOT_FOUND', '接口不存在。');
      if (promptRoute && !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) fail(415, 'UNSUPPORTED_MEDIA_TYPE', '请使用 application/json。');
      const data = promptRoute ? validateInput(await bodyJSON(req)) : null;
      const provider = modelsRoute ? url.searchParams.get('provider') : data.provider;
      const p = config.find(x => x.id === provider);
      if (!p) fail(400, 'INVALID_PROVIDER', '不支持的模型提供商。');
      if (!p.keyValue || !p.base) fail(503, 'PROVIDER_NOT_CONFIGURED', '管理员尚未配置此模型提供商。');
      if (modelsRoute) {
        if (p.discovery === 'manual') return send(200, { provider, models: [], discovery: 'manual', verified: false, message: '本适配器使用手动模型 ID。服务端已填写密钥，尚未验证密钥与模型权限；仅显式生成成功后确认可用。' });
        let models = [], path = '/models', pages = 0;
        do {
          const result = await upstream(p, path);
          const list = provider === 'gemini' ? result?.models : result?.data;
          if (!Array.isArray(list)) fail(502, 'UPSTREAM_INVALID_RESPONSE', '模型列表格式无效。');
          models.push(...list.filter(x => x && typeof (x.id ?? x.name) === 'string').filter(x => provider !== 'gemini' || x.supportedGenerationMethods?.includes('generateContent')).map(x => ({ id: provider === 'gemini' ? x.name.replace(/^models\//, '') : x.id, name: x.displayName || x.display_name || x.id || x.name })));
          path = provider === 'gemini' && result.nextPageToken ? '/models?pageToken=' + encodeURIComponent(result.nextPageToken) : provider === 'anthropic' && result.has_more && result.last_id ? '/models?after_id=' + encodeURIComponent(result.last_id) : null;
          if (++pages >= 20 && path) fail(502, 'UPSTREAM_INVALID_RESPONSE', '模型列表分页过多。');
        } while (path);
        return send(200, { provider, models, discovery: 'remote', verified: true });
      }
      const [path, payload] = generation(provider, data);
      const result = await upstream(p, path, payload);
      let extracted;
      try { extracted = output(provider, result); }
      catch (error) { if (error instanceof GatewayError) throw error; fail(502, 'UPSTREAM_INVALID_RESPONSE', '模型响应格式无效。'); }
      send(200, { provider, model: data.model, ...extracted });
    } catch (error) {
      const safe = error instanceof GatewayError ? error : new GatewayError(500, 'INTERNAL_ERROR', '网关内部错误。');
      send(safe.status, { error: { code: safe.code, message: safe.message } });
    }
  });
  server.requestTimeout = 45000;
  server.headersTimeout = 15000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.GATEWAY_TOKEN?.trim() || /\s/.test(process.env.GATEWAY_TOKEN)) {
    console.error('Set GATEWAY_TOKEN to a nonempty token without whitespace before starting.');
    process.exitCode = 1;
  } else {
    const port = Number(process.env.PORT ?? 8787);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
    createGateway().listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`Prompt gateway listening on port ${port}`));
  }
}
