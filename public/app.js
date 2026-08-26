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
let currentConversationId = null;

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

  [...conversations].reverse().forEach((c) => {
    const el = document.createElement("div");
    el.className = "history-item";
    if (c.id === currentConversationId) {
      el.classList.add("active");
    }

    const titleSpan = document.createElement("span");
    titleSpan.className = "history-title-text";
    titleSpan.textContent = c.title || "محادثة جديدة";
    titleSpan.onclick = () => loadConversation(c.id);

    const delBtn = document.createElement("button");
    delBtn.className = "history-delete";
    delBtn.setAttribute("aria-label", "حذف المحادثة");
    delBtn.textContent = "🗑";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteConversation(c.id);
    };

    el.append(titleSpan, delBtn);
    historyEl.appendChild(el);
  });
}

// =========================
// حذف محادثة
// =========================
function deleteConversation(id) {
  const sure = confirm("متأكد إنك عايز تحذف المحادثة دي؟ الإجراء ده مش هيتراجع.");
  if (!sure) return;

  conversations = conversations.filter((c) => c.id !== id);
  save();

  if (currentConversationId === id) {
    messages = [];
    currentConversationId = null;
    renderMessages();
  }

  renderHistory();
}

// =========================
// تحميل محادثة
// =========================
function loadConversation(id) {
  const convo = conversations.find((c) => c.id === id);
  currentConversationId = id;
  messages = convo?.messages || [];
  renderMessages();
  renderHistory();
  sidebar.classList.remove("open");
  closeSidebarBackdrop();
}

// =========================
// عرض الرسائل
// =========================
function renderMessages() {
  welcome.style.display = messages.length ? "none" : "";

  chat.querySelectorAll(".message").forEach((x) => x.remove());

  messages.forEach((m, i) => {
    addMessage(m.role, m.content, false, i);
  });

  requestAnimationFrame(() => {
    chat.scrollTop = chat.scrollHeight;
  });
}

// =========================
// إضافة رسالة (كاملة، غير متدفقة)
// =========================
function addMessage(role, content, animate = true, index = null) {
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
  } else if (role === "user" && index !== null) {
    addEditButton(box, contentEl, index);
  }

  if (animate) {
    chat.scrollTop = chat.scrollHeight;
  }

  return { row, box, contentEl };
}

// =========================
// زر تعديل رسالة المستخدم
// =========================
function addEditButton(box, contentEl, index) {
  const editBtn = document.createElement("button");
  editBtn.className = "edit-msg-btn";
  editBtn.textContent = "✎ تعديل";
  editBtn.onclick = () => enterEditMode(box, contentEl, index, editBtn);
  box.appendChild(editBtn);
}

function enterEditMode(box, contentEl, index, editBtn) {
  const originalText = messages[index]?.content ?? "";

  contentEl.style.display = "none";
  editBtn.style.display = "none";

  const wrap = document.createElement("div");
  wrap.className = "edit-wrap";

  const textarea = document.createElement("textarea");
  textarea.className = "edit-textarea";
  textarea.value = originalText;

  const actions = document.createElement("div");
  actions.className = "edit-actions";

  const saveBtn = document.createElement("button");
  saveBtn.className = "edit-save";
  saveBtn.textContent = "حفظ وإرسال";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "edit-cancel";
  cancelBtn.textContent = "إلغاء";

  saveBtn.onclick = () => {
    const newText = textarea.value.trim();
    if (!newText) return;

    // نحذف الرسالة دي وكل اللي بعدها، ونبعتها تاني كأنها رسالة جديدة
    messages = messages.slice(0, index);
    wrap.remove();
    renderMessages();
    sendMessage(newText);
  };

  cancelBtn.onclick = () => {
    wrap.remove();
    contentEl.style.display = "";
    editBtn.style.display = "";
  };

  actions.append(saveBtn, cancelBtn);
  wrap.append(textarea, actions);
  box.appendChild(wrap);

  textarea.focus();
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  });
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
  addMessage("user", text, true, messages.length - 1);

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

    saveCurrentConversation();
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
// حفظ/تحديث المحادثة الحالية فقط (مش عنصر جديد كل رسالة)
// =========================
function saveCurrentConversation() {
  const title =
    messages.find((m) => m.role === "user")?.content?.slice(0, 45) ||
    "محادثة جديدة";

  if (currentConversationId === null) {
    currentConversationId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    conversations.push({
      id: currentConversationId,
      title,
      messages: [...messages],
    });
  } else {
    const existing = conversations.find((c) => c.id === currentConversationId);
    if (existing) {
      existing.messages = [...messages];
    } else {
      conversations.push({ id: currentConversationId, title, messages: [...messages] });
    }
  }

  if (conversations.length > 30) {
    const removed = conversations.splice(0, conversations.length - 30);
    if (removed.some((c) => c.id === currentConversationId)) {
      currentConversationId = null;
    }
  }

  save();
  renderHistory();
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
  currentConversationId = null;
  renderMessages();
  renderHistory();
  input.focus();
  sidebar.classList.remove("open");
  closeSidebarBackdrop();
};

// =========================
// مسح المحادثة الحالية
// =========================
document.getElementById("clearBtn").onclick = () => {
  messages = [];
  currentConversationId = null;
  renderMessages();
  renderHistory();
  input.focus();
};

// =========================
// القائمة الجانبية (مع خلفية تقفل بالضغط عليها في الموبايل)
// =========================
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

function openSidebarBackdrop() {
  sidebarBackdrop?.classList.add("show");
}

function closeSidebarBackdrop() {
  sidebarBackdrop?.classList.remove("show");
}

document.getElementById("menuBtn").onclick = () => {
  const isOpen = sidebar.classList.toggle("open");
  if (isOpen) {
    openSidebarBackdrop();
  } else {
    closeSidebarBackdrop();
  }
};

sidebarBackdrop?.addEventListener("click", () => {
  sidebar.classList.remove("open");
  closeSidebarBackdrop();
});

// =========================
// تشغيل سجل المحادثات
// =========================
renderHistory();
