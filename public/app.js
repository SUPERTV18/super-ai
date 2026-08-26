const chat = document.getElementById("chat");
const input = document.getElementById("input");
const form = document.getElementById("form");
const send = document.getElementById("send");
const welcome = document.getElementById("welcome");
const historyEl = document.getElementById("history");
const sidebar = document.getElementById("sidebar");

// رابط Cloudflare Worker
const API_URL = "https://superg-ai-api.super-stv.workers.dev/";

let messages = [];

let conversations = JSON.parse(
  localStorage.getItem("superAIConversations") || "[]"
);

// =========================
// إعداد محرك تنسيق الـ Markdown
// =========================
if (window.marked) {
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

function renderMarkdown(rawText) {
  if (!window.marked) return escapeHtml(rawText);
  const html = marked.parse(rawText || "");
  return window.DOMPurify ? DOMPurify.sanitize(html) : html;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function highlightCodeBlocks(container) {
  if (!window.hljs) return;
  container.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
  });
}

// =========================
// حفظ المحادثات
// =========================
function save() {
  localStorage.setItem(
    "superAIConversations",
    JSON.stringify(conversations.slice(-30))
  );
}

// =========================
// عرض سجل المحادثات
// =========================
function renderHistory() {
  historyEl.innerHTML = "";

  [...conversations].reverse().forEach((c, reverseIndex) => {
    const index = conversations.length - 1 - reverseIndex;

    const el = document.createElement("div");
    el.className = "history-item";
    el.textContent = c.title || "محادثة جديدة";
    el.onclick = () => loadConversation(index);

    historyEl.appendChild(el);
  });
}

// =========================
// تحميل محادثة
// =========================
function loadConversation(index) {
  messages = conversations[index]?.messages || [];
  renderMessages();
  sidebar.classList.remove("open");
}

// =========================
// عرض الرسائل
// =========================
function renderMessages() {
  welcome.style.display = messages.length ? "none" : "";

  chat.querySelectorAll(".message").forEach((x) => x.remove());

  messages.forEach((m) => {
    addMessage(m.role, m.content, false);
  });

  requestAnimationFrame(() => {
    chat.scrollTop = chat.scrollHeight;
  });
}

// =========================
// إضافة رسالة (كاملة، غير متدفقة)
// =========================
function addMessage(role, content, animate = true) {
  const row = document.createElement("div");
  row.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "أنت" : "✦";

  const box = document.createElement("div");
  box.className = "bubble";

  const contentEl = document.createElement("div");
  contentEl.className = "msg-content";

  if (role === "assistant") {
    contentEl.innerHTML = renderMarkdown(content);
  } else {
    contentEl.textContent = content;
  }

  box.appendChild(contentEl);
  row.append(avatar, box);
  chat.appendChild(row);

  if (role === "assistant") {
    highlightCodeBlocks(contentEl);
    addCopyButton(box, () => content);
  }

  if (animate) {
    chat.scrollTop = chat.scrollHeight;
  }

  return { row, box, contentEl };
}

// =========================
// زر نسخ رد الذكاء الاصطناعي
// =========================
function addCopyButton(box, getText) {
  const copy = document.createElement("button");
  copy.className = "copy";
  copy.textContent = "نسخ";

  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      copy.textContent = "تم النسخ ✓";
    } catch {
      copy.textContent = "تعذر النسخ";
    }
    setTimeout(() => {
      copy.textContent = "نسخ";
    }, 1200);
  };

  box.appendChild(copy);
}

// =========================
// إنشاء فقاعة رد فارغة لتحديثها أثناء البث
// =========================
function createStreamingBubble() {
  const row = document.createElement("div");
  row.className = "message assistant";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = "✦";

  const box = document.createElement("div");
  box.className = "bubble";

  const contentEl = document.createElement("div");
  contentEl.className = "msg-content";
  contentEl.innerHTML = '<span class="cursor-blink">▍</span>';

  box.appendChild(contentEl);
  row.append(avatar, box);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;

  return { row, box, contentEl };
}

// =========================
// مؤشر التفكير (قبل وصول أول جزء من الرد)
// =========================
function addTyping() {
  const row = document.createElement("div");
  row.className = "message assistant";
  row.id = "typing";
  row.innerHTML =
    '<div class="avatar">✦</div>' +
    '<div class="bubble typing">جاري التفكير...</div>';
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing")?.remove();
}

// =========================
// ضبط ارتفاع مربع الكتابة
// =========================
function autoSize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 150) + "px";
}

// =========================
// إرسال الرسالة (مع بث الرد أول بأول)
// =========================
async function sendMessage(text) {
  text = text.trim();
  if (!text || send.disabled) return;

  messages.push({ role: "user", content: text });
  addMessage("user", text);

  input.value = "";
  autoSize();
  send.disabled = true;
  addTyping();

  let fullText = "";
  let streamBubble = null;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const contentType = response.headers.get("content-type") || "";

    // خطأ راجع كـ JSON عادي (مش بث)
    if (!response.ok || contentType.includes("application/json")) {
      let data = {};
      try {
        data = await response.json();
      } catch {}
      throw new Error(data?.error || `حدث خطأ في الخادم (${response.status})`);
    }

    if (!response.body) {
      throw new Error("المتصفح لا يدعم استقبال الردود المتدفقة.");
    }

    removeTyping();
    streamBubble = createStreamingBubble();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // آخر سطر ناقص، نحتفظ بيه للمرة الجاية

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;

        try {
          const parsed = JSON.parse(payload);
          const piece = parsed.response ?? "";
          if (piece) {
            fullText += piece;
            streamBubble.contentEl.innerHTML =
              renderMarkdown(fullText) + '<span class="cursor-blink">▍</span>';
            chat.scrollTop = chat.scrollHeight;
          }
        } catch {
          // تجاهل أي سطر مش JSON صالح
        }
      }
    }

    // إزالة مؤشر الكتابة النابض وعرض الشكل النهائي المنسّق
    streamBubble.contentEl.innerHTML = renderMarkdown(fullText);
    highlightCodeBlocks(streamBubble.contentEl);
    addCopyButton(streamBubble.box, () => fullText);

    if (!fullText.trim()) {
      throw new Error("لم يتم استلام رد من الذكاء الاصطناعي.");
    }

    messages.push({ role: "assistant", content: fullText });

    const title =
      messages.find((m) => m.role === "user")?.content?.slice(0, 45) ||
      "محادثة جديدة";

    conversations.push({ title, messages: [...messages] });
    conversations = conversations.slice(-30);
    save();
    renderHistory();
  } catch (error) {
    removeTyping();
    console.error("SUPER AI Error:", error);

    if (streamBubble) {
      streamBubble.row.remove();
    }

    addMessage(
      "assistant",
      "❌ " + (error?.message || "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.")
    );
  } finally {
    send.disabled = false;
    input.focus();
  }
}

// =========================
// إرسال النموذج
// =========================
form.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("input", autoSize);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// =========================
// الأزرار المقترحة
// =========================
document.querySelectorAll(".suggestions button").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendMessage(btn.dataset.prompt);
  });
});

// =========================
// محادثة جديدة
// =========================
document.getElementById("newChat").onclick = () => {
  messages = [];
  renderMessages();
  input.focus();
  sidebar.classList.remove("open");
};

// =========================
// مسح المحادثة الحالية
// =========================
document.getElementById("clearBtn").onclick = () => {
  messages = [];
  renderMessages();
  input.focus();
};

// =========================
// القائمة الجانبية
// =========================
document.getElementById("menuBtn").onclick = () => {
  sidebar.classList.toggle("open");
};

// =========================
// تشغيل سجل المحادثات
// =========================
renderHistory();
