// Official API presets. Custom endpoints and account-specific model IDs live in advanced mode.
export const MODEL_PRESETS = [
  {provider:'deepseek', model:'deepseek-flash', label:'DeepSeek Flash', base:'https://api.deepseek.com'},
  {provider:'deepseek', model:'deepseek-v4-pro', label:'DeepSeek V4 Pro', base:'https://api.deepseek.com'},
  {provider:'qwen', model:'qwen-plus', label:'通义千问 Plus · 中国内地', base:'https://dashscope.aliyuncs.com/compatible-mode/v1'},
  {provider:'doubao', model:'doubao-seed-2-1-pro-260915', label:'豆包 Seed 2.1 Pro', base:'https://ark.cn-beijing.volces.com/api/v3'},
  {provider:'zhipu', model:'glm-5.3', label:'智谱 GLM-5.3', base:'https://open.bigmodel.cn/api/paas/v4'},
  {provider:'moonshot', model:'kimi-k3.1-pro', label:'Kimi K3.1 Pro', base:'https://api.moonshot.cn/v1'},
  {provider:'openai', model:'gpt-6.1-sol', label:'OpenAI GPT-6.1 Sol', base:'https://api.openai.com/v1'},
  {provider:'gemini', model:'gemini-4-hydrogen', label:'Gemini 4 Hydrogen', base:'https://generativelanguage.googleapis.com/v1beta'},
  {provider:'anthropic', model:'claude-haiku-5-5', label:'Claude Haiku 5.5', base:'https://api.anthropic.com/v1'},
];
