# 映序提示词网关

## 大模型服务商（2026-11-16）

支持 9 类服务商。新增五家的生成都使用 Chat Completions，流式关闭，只提取最终正文，不输出推理内容。模型 ID 由用户按已开通服务填写，不硬编码“最新”模型。

| 服务商 | 服务端密钥变量 | 默认 Base URL | 本版模型发现 |
| --- | --- | --- | --- |
| DeepSeek | DEEPSEEK_API_KEY | https://api.deepseek.com | 实时 GET /models |
| 通义千问 | QWEN_API_KEY | https://dashscope.aliyuncs.com/compatible-mode/v1 | 手填 |
| 豆包 | DOUBAO_API_KEY | https://ark.cn-beijing.volces.com/api/v3 | 手填模型 ID 或 Endpoint ID |
| 智谱 GLM | ZHIPU_API_KEY | https://open.bigmodel.cn/api/paas/v4 | 手填 |
| Kimi | MOONSHOT_API_KEY | https://api.moonshot.cn/v1 | 手填 |

OpenAI、Gemini、Claude、自定义兼容服务继续可用。提供商元数据只表示服务端是否填写了配置，不验证 key 有效性。手填适配器的 `/api/models` 返回 `discovery:"manual", verified:false, models:[]`，不做付费探测，也不表示厂家没有模型列表能力；仅显式生成成功后确认本次模型可用。实时模型列表返回 `discovery:"remote", verified:true`，仅确认列表访问成功，不保证所有模型可生成文字。

管理员可通过 `<PROVIDER_ID大写>_BASE_URL` 覆盖官方服务 base，例如 `QWEN_BASE_URL`；仅支持无凭据、无查询片段的 HTTPS 地址，不自动追加版本路径。兼容服务仍用 `COMPATIBLE_BASE_URL` 的 /v1 规范。此配置只在服务端设置，浏览器不能覆盖上游。千问 key 与地域必须匹配；官方推荐迁移到业务空间专属域名，旧北京域名仍可用。豆包使用普通按量数据面接口，不自动适配 Coding Plan 套餐。

官方协议核对来源：[DeepSeek Chat](https://api-docs.deepseek.com/api/create-chat-completion/)、[模型列表](https://api-docs.deepseek.com/api/list-models/)、[千问 OpenAI 兼容](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)、[豆包地址与鉴权](https://docs.volcengine.com/docs/ark/base-url-and-authentication?lang=zh)、[智谱快速开始](https://docs.bigmodel.cn/cn/api/introduction)、[Kimi 快速开始](https://platform.moonshot.cn/docs/guide/start-using-kimi-api)。本轮采用文档与 mock 核验，没有真实账号测试或模型费用。

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

成功返回 `{ "provider": "openai", "model": "...", "text": "...", "usage": {} }`，usage 可省略。provider 可为 `deepseek`、`qwen`、`doubao`、`zhipu`、`moonshot`、`openai`、`gemini`、`anthropic`、`compatible`。正文上限 64KB、输出 token 上限 4096（默认 2048）；生成请求超时 40 秒。额外字段会被拒绝，客户端不能指定上游 URL。DeepSeek、千问、豆包、智谱、Kimi 与兼容服务使用 Chat Completions；OpenAI、Gemini、Claude 分别使用 Responses、generateContent、Messages。

错误统一为 `{ "error": { "code": "...", "message": "..." } }`。网关认证失败为 401；未配置为 503；服务商认证失败映射为 502；限流为 429；超时为 504；其他上游故障为 502。错误不转发上游原始响应。网关不记录提示词、密钥、Authorization 或上游错误。

## 部署源码

GitHub Pages 只能托管静态页面，不能运行此 Node 服务。将 `gateway/` 单独部署到支持 Node 24 的服务/容器/自有主机；本目录是部署源码，不应放进 Pages artifact。此交付没有创建云服务，也没有调用真实模型。

1. 在服务器 secret/environment 管理中注入令牌和提供商 key。用 `node server.mjs` 启动（平台已注入变量时无需 `.env`）。进程管理器可用 systemd 或平台原生机制。
2. 默认继续监听回环地址，通过 HTTPS 反向代理暴露独立域名。托管平台要求容器监听全部接口时显式设置 `HOST=0.0.0.0` 和平台分配的 `PORT`，将直连端口置于受控网络中。
3. `ALLOWED_ORIGINS` 设置为实际静态网页 origin。浏览器配置网关的 HTTPS 地址和网关 token。HTTPS 网页访问 HTTP 网关可能被混合内容或浏览器本地网络策略阻止，因此生产必须用 HTTPS。
4. 反向代理限制请求正文（64KB）、连接数和请求速率，读取超时应大于 40 秒。避免在代理日志中记录 Authorization、正文或查询中的秘密。持有网关 token 的人可以使用服务器模型额度；按使用者范围分发并定期轮换 token。
5. 检查 `/health`、有/无 token 的 `/api/providers`、正确来源的预检，再读取模型列表；只有用户显式点击生成时才请求 `/api/prompt`。

测试全部使用注入的 mock fetch，不访问真实提供商、不消耗模型额度。覆盖认证、CORS、配置缺失、请求验证、四家协议与输出提取、分页、正文限制、超时及错误脱敏。`/health` 不验证真实 key 的有效性，模型可用性仍以提供商实际响应为准。
