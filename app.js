const PRESETS = {
  openai: { base: "https://api.openai.com/v1", model: "gpt-4o" },
  xai: { base: "https://api.x.ai/v1", model: "grok-2-vision-1212" },
  openrouter: { base: "https://openrouter.ai/api/v1", model: "openai/gpt-4o" },
  siliconflow: { base: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-VL-72B-Instruct" },
  qwen: { base: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-vl-max" },
  custom: { base: "", model: "" },
};

const $ = (id) => document.getElementById(id);
const messagesEl = $("messages");
const inputEl = $("input");
const fileEl = $("file-input");

let pendingImage = null;
let history = [];
let sending = false;

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem("wuyanjiu-config") || "{}");
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  localStorage.setItem("wuyanjiu-config", JSON.stringify(cfg));
}

function configured() {
  const c = loadConfig();
  return Boolean(c.baseUrl && c.model && c.apiKey);
}

function refreshStatus() {
  const ok = configured();
  $("conn-status").textContent = ok ? "在线" : "未配置接口";
  $("api-hint").textContent = ok
    ? "拍题。糊的重拍。"
    : "先填接口，否则我连骂你的机会都没有。";
}

function addBubble(role, text, imageSrc) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  const who = document.createElement("div");
  who.className = "who";
  who.textContent = role === "user" ? "你" : "邬言九";
  if (role !== "sys") div.appendChild(who);
  if (imageSrc) {
    const img = document.createElement("img");
    img.className = "shot";
    img.src = imageSrc;
    img.alt = "题目";
    div.appendChild(img);
  }
  const body = document.createElement("div");
  body.className = "body";
  if (role === "bot") body.innerHTML = renderContent(text);
  else body.textContent = text;
  div.appendChild(body);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return body;
}

function renderContent(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = escaped
    .replace(/```([\s\S]*?)```/g, "<pre>$1</pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  if (window.renderMathInElement) {
    renderMathInElement(wrap, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
    });
  }
  return wrap.innerHTML;
}

function seedWelcome() {
  messagesEl.innerHTML = "";
  addBubble("bot", "题目发过来。拍清楚。别废话。");
}

function resetChat() {
  history = [];
  pendingImage = null;
  $("preview-row").classList.add("hidden");
  fileEl.value = "";
  seedWelcome();
}

function openSettings() {
  const c = loadConfig();
  $("preset").value = c.preset || "openai";
  $("base-url").value = c.baseUrl || PRESETS.openai.base;
  $("model").value = c.model || PRESETS.openai.model;
  $("api-key").value = c.apiKey || "";
  $("overlay").classList.remove("hidden");
}

function applyPreset() {
  const p = PRESETS[$("preset").value];
  if (!p) return;
  if (p.base) $("base-url").value = p.base;
  if (p.model) $("model").value = p.model;
}

function persistSettings() {
  saveConfig({
    preset: $("preset").value,
    baseUrl: $("base-url").value.trim().replace(/\/+$/, ""),
    model: $("model").value.trim(),
    apiKey: $("api-key").value.trim(),
  });
  $("overlay").classList.add("hidden");
  refreshStatus();
}

function resizeInput() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImage(dataUrl, max = 1280) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, max / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function setImage(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const raw = await fileToDataUrl(file);
  pendingImage = await compressImage(raw);
  $("preview-img").src = pendingImage;
  $("preview-row").classList.remove("hidden");
}

function buildUserContent(text, image) {
  if (!image) return text;
  const parts = [];
  if (text) parts.push({ type: "text", text });
  else parts.push({ type: "text", text: "看图。把题讲完。" });
  parts.push({ type: "image_url", image_url: { url: image } });
  return parts;
}

async function send() {
  const text = inputEl.value.trim();
  if (sending || (!text && !pendingImage)) return;
  if (!configured()) {
    openSettings();
    return;
  }

  const image = pendingImage;
  inputEl.value = "";
  resizeInput();
  pendingImage = null;
  $("preview-row").classList.add("hidden");
  fileEl.value = "";

  addBubble("user", text || "（图片）", image);
  history.push({ role: "user", content: buildUserContent(text, image) });

  sending = true;
  $("btn-send").disabled = true;
  const body = addBubble("bot", "");
  body.classList.add("typing");
  body.textContent = "";

  const cfg = loadConfig();
  const payload = {
    model: cfg.model,
    stream: true,
    temperature: 0.95,
    messages: [
      { role: "system", content: window.WUYANJIU_SYSTEM },
      ...history,
    ],
  };

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${res.status} ${errText.slice(0, 400)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const data = s.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const piece = json.choices?.[0]?.delta?.content || "";
          if (piece) {
            acc += piece;
            body.classList.remove("typing");
            body.innerHTML = renderContent(acc);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        } catch {
          /* keep reading */
        }
      }
    }

    if (!acc) {
      body.classList.remove("typing");
      body.textContent = "接口没吐字。检查模型和密钥。";
    } else {
      history.push({ role: "assistant", content: acc });
    }
  } catch (err) {
    body.classList.remove("typing");
    body.textContent = `请求失败。${err.message}`;
  } finally {
    sending = false;
    $("btn-send").disabled = false;
    inputEl.focus();
  }
}

$("btn-new").onclick = resetChat;
$("btn-new-m").onclick = resetChat;
$("btn-settings").onclick = openSettings;
$("btn-settings-m").onclick = openSettings;
$("btn-cancel").onclick = () => $("overlay").classList.add("hidden");
$("btn-save").onclick = persistSettings;
$("preset").onchange = applyPreset;
$("composer").onsubmit = (e) => {
  e.preventDefault();
  send();
};
inputEl.addEventListener("input", resizeInput);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
fileEl.addEventListener("change", () => setImage(fileEl.files[0]));
$("btn-clear-img").onclick = () => {
  pendingImage = null;
  fileEl.value = "";
  $("preview-row").classList.add("hidden");
};

document.addEventListener("paste", (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
  if (item) setImage(item.getAsFile());
});

if (!configured()) {
  seedWelcome();
  openSettings();
} else {
  seedWelcome();
}
refreshStatus();
