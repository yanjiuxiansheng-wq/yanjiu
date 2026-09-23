# 邬言九

网页聊天。头像用你给的照片。人设是话少、不苟言笑、会讲题但脾气很坏的数学老师。

## 怎么用

1. 整夹一起保留：`index.html`、`styles.css`、`app.js`、`prompt.js`、`avatar.png`
2. 用浏览器打开 `index.html`
3. 第一次会弹出「接口」。填一个**带视觉**的模型，否则看不了照片里的题

推荐（都能走 OpenAI 兼容格式）：

| 预设 | 建议模型 |
| --- | --- |
| OpenAI | `gpt-4o` |
| xAI Grok | `grok-2-vision-1212` 或当前账号可用的视觉模型 |
| OpenRouter | `openai/gpt-4o` |
| 硅基流动 | `Qwen/Qwen2.5-VL-72B-Instruct` |
| 通义千问 | `qwen-vl-max` |

密钥只存在你这台电脑的浏览器里，页面本身不上传到别的服务器。

本地起一个静态服务更稳，避免个别浏览器拦 `file://` 请求：

```bash
cd wuyanjiu-chat
python3 -m http.server 8080
```

然后打开 `http://localhost:8080`。

## 功能

- 打字对话
- 上传或粘贴题目照片
- 公式用 KaTeX 渲染
- 新对话清空上下文

人设写在 `prompt.js`。要改口头禅或骂人密度，改那一段即可。
