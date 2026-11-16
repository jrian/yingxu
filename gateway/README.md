# 映序提示词网关

Node.js 24、零第三方依赖。浏览器只持有网关令牌；OpenAI、Gemini、Anthropic 和兼容服务的 API key 始终留在服务器环境变量中。读取提供商和模型列表不会生成内容。只有显式 `POST /api/prompt` 才调用生成接口，可能由模型服务计费。

## 本机启动

```sh
cd gateway
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

将生成的随机值写入 `.env` 的 `GATEWAY_TOKEN`，并配置需要使用的提供商 key，然后执行：

```sh
npm start
npm test
```

默认监听 `127.0.0.1:8787`。未设置令牌时 CLI 拒绝启动，生产模式也不例外。`.env` 已忽略提交；勿把真实令牌或 key 写入源码、网页构建参数、截图、命令历史或公开仓库。没有配置的提供商显示 `configured:false`，调用其模型或生成接口会返回 503。

变量说明：

| 变量 | 用途 |
| --- | --- |
| `GATEWAY_TOKEN` | 必填、强随机、无空白的网关访问令牌 |
| `OPENAI_API_KEY` | OpenAI 官方服务 key |
| `GEMINI_API_KEY` | Google Gemini 服务 key |
| `ANTHROPIC_API_KEY` | Anthropic Claude 服务 key |
| `COMPATIBLE_API_KEY` | 管理员指定的兼容服务 key |
| `COMPATIBLE_BASE_URL` | 兼容服务 HTTPS base；如 `https://example.com/v1`，也支持无 `/v1` 的 base；统一为单个 `/v1` 后缀 |
| `ALLOWED_ORIGINS` | 逗号分隔的完整网页 origin；默认 `http://127.0.0.1:8765,https://jrian.github.io`，不支持通配符 |
| `HOST` / `PORT` | 默认 `127.0.0.1` / `8787` |

`localhost` 和 `127.0.0.1` 是不同来源，需要时明确加入白名单。无 Origin 的服务器客户端仍须提供 token。CORS 不是认证；除健康检查和浏览器 OPTIONS 预检外，所有 `/api/` 请求都要求 `Authorization: Bearer <GATEWAY_TOKEN>`。预检自身不携带 token，也不会调用模型。

## HTTP 约定

* `GET /health` → `{ "ok": true }`（仅说明进程正常）。
* `GET /api/providers` → `{ "providers": [{ "id": "openai", "name": "OpenAI", "configured": true }, ...] }`。
* `GET /api/models?provider=openai` → `{ "provider": "openai", "models": [{ "id": "...", "name": "..." }] }`，从服务商实时读取，不硬编码最新模型。
* `POST /api/prompt`，`Content-Type: application/json`：

```json
{
  "provider": "openai",
  "model": "从模型列表选择的 ID",
  "input": "待处理的提示词",
  "system": "可选的系统指令",
  "maxOutputTokens": 2048
}
```

成功返回 `{ "provider": "openai", "model": "...", "text": "...", "usage": {} }`，usage 可省略。provider 可为 `openai`、`gemini`、`anthropic`、`compatible`。正文上限 64KB、输出 token 上限 4096（默认 2048）；生成请求超时 40 秒。额外字段会被拒绝，客户端不能指定上游 URL。兼容服务使用 Chat Completions，其余分别使用 Responses、generateContent、Messages。

错误统一为 `{ "error": { "code": "...", "message": "..." } }`。网关认证失败为 401；未配置为 503；服务商认证失败映射为 502；限流为 429；超时为 504；其他上游故障为 502。错误不转发上游原始响应。网关不记录提示词、密钥、Authorization 或上游错误。

## 部署源码

GitHub Pages 只能托管静态页面，不能运行此 Node 服务。将 `gateway/` 单独部署到支持 Node 24 的服务/容器/自有主机；本目录是部署源码，不应放进 Pages artifact。此交付没有创建云服务，也没有调用真实模型。

1. 在服务器 secret/environment 管理中注入令牌和提供商 key。用 `node server.mjs` 启动（平台已注入变量时无需 `.env`）。进程管理器可用 systemd 或平台原生机制。
2. 默认继续监听回环地址，通过 HTTPS 反向代理暴露独立域名。托管平台要求容器监听全部接口时显式设置 `HOST=0.0.0.0` 和平台分配的 `PORT`，将直连端口置于受控网络中。
3. `ALLOWED_ORIGINS` 设置为实际静态网页 origin。浏览器配置网关的 HTTPS 地址和网关 token。HTTPS 网页访问 HTTP 网关可能被混合内容或浏览器本地网络策略阻止，因此生产必须用 HTTPS。
4. 反向代理限制请求正文（64KB）、连接数和请求速率，读取超时应大于 40 秒。避免在代理日志中记录 Authorization、正文或查询中的秘密。持有网关 token 的人可以使用服务器模型额度；按使用者范围分发并定期轮换 token。
5. 检查 `/health`、有/无 token 的 `/api/providers`、正确来源的预检，再读取模型列表；只有用户显式点击生成时才请求 `/api/prompt`。

测试全部使用注入的 mock fetch，不访问真实提供商、不消耗模型额度。覆盖认证、CORS、配置缺失、请求验证、四家协议与输出提取、分页、正文限制、超时及错误脱敏。`/health` 不验证真实 key 的有效性，模型可用性仍以提供商实际响应为准。
