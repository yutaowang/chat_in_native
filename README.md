# chat_native

一个以“每个人都用自己的母语聊天”为核心的即时通讯 Web MVP。

## 功能

- 设置用户母语
- 联系人和群聊界面
- 任意语言输入
- 每条消息显示为当前用户的母语
- 一键切换原文与译文
- OpenAI 兼容服务端翻译，API key 不暴露给浏览器
- 支持 OpenAI、OpenRouter、自定义网关和本地兼容模型
- 未配置 API key 时自动进入可交互的 Demo 模式

## 本地运行

```bash
npm install
copy .env.example .env
npm run dev
```

打开 `http://localhost:5173`。

在 `.env` 中设置：

```dotenv
OPENAI_API_KEY=你的_API_Key
OPENAI_BASE_URL=https://api.openai.com/v1
MODEL=gpt-4o-mini
```

后端调用 OpenAI 兼容的 `POST /chat/completions` 接口。`OPENAI_BASE_URL`
既可以填写以 `/v1` 结尾的基础地址，也可以直接填写完整的
`/chat/completions` 地址。`MODEL` 可替换为对应服务支持的任意聊天模型。

## 生产构建

```bash
npm run build
npm start
```

打开 `http://localhost:8787`。

## 架构说明

当前版本聚焦产品体验和翻译链路。真实多用户生产环境还需要接入：

- 身份认证和用户资料
- WebSocket / Firebase / Supabase Realtime
- 消息数据库与离线同步
- 群组和成员权限
- 端到端加密策略
- 推送通知和内容安全

生成插画位于 `public/language-flow.png`。
