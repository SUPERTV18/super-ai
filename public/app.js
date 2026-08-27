const chat = document.getElementById("chat");
const input = document.getElementById("input");
const form = document.getElementById("form");
const send = document.getElementById("send");
const welcome = document.getElementById("welcome");
const historyEl = document.getElementById("history");
const sidebar = document.getElementById("sidebar");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const imagePreviewWrap = document.getElementById("imagePreviewWrap");
const imagePreviewImg = document.getElementById("imagePreviewImg");
const removeImageBtn = document.getElementById("removeImageBtn");
const micBtn = document.getElementById("micBtn");

// عناصر لوحة معاينة التصميم
const previewOverlay = document.getElementById("previewOverlay");
const previewFrame = document.getElementById("previewFrame");
const previewCodeWrap = document.getElementById("previewCodeWrap");
const previewCodeEl = document.getElementById("previewCodeEl");
const tabPreviewBtn = document.getElementById("tabPreviewBtn");
const tabCodeBtn = document.getElementById("tabCodeBtn");
const previewCloseBtn = document.getElementById("previewCloseBtn");
const previewCopyBtn = document.getElementById("previewCopyBtn");

// رابط Cloudflare Worker
const API_URL = "https://superg-ai-api.super-stv.workers.dev/";

let messages = [];
let currentConversationId = null;
let pendingImageDataUrl = null;
let voiceJustUsed = false;

let conversations = JSON.parse(
  localStorage.getItem("superAIConversations") || "[]"
);

// =========================
// كلمات مفتاحية لطلب توليد صورة
// =========================
const IMAGE_KEYWORDS = [
  "ارسم", "اعمل صورة", "اعمل لي صورة", "انشئ صورة", "أنشئ صورة",
  "ولد صورة", "ولّد صورة", "صورة لـ", "صور لي", "صمم صورة",
  "لوجو", "شعار", "أيقونة", "ايقونة", "design a logo", "logo design", "create a logo",
  "generate an image", "generate image", "create an image", "draw a", "draw me",
];

function isImageRequest(text) {
  const lower = text.toLowerCase();
  return IMAGE_KEYWORDS.some((k) => lower.includes(k));
}

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
  return window.DOMPurify ? DOMPurify.sanitize(html, { ADD_ATTR: ["target"] }) : html;
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
// استخراج أكواد HTML من رد الذكاء الاصطناعي
// =========================
function extractHtmlBlocks(text) {
  const regex = /```html\s*([\s\S]*?)```/gi;
  const blocks = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

// =========================
// لوحة معاينة التصميم
// =========================
function addDesignPreviewButton(box, htmlCode) {
  const btn = document.createElement("button");
  btn.className = "preview-design-btn";
  btn.textContent = "🖥️ عرض التصميم";
  btn.onclick = () => openDesignPreview(htmlCode);
  box.appendChild(btn);
}

function openDesignPreview(htmlCode) {
  previewFrame.srcdoc = htmlCode;
  previewCodeEl.textContent = htmlCode;
  previewOverlay.classList.remove("hidden");
  switchPreviewTab("preview");
}

function switchPreviewTab(tab) {
  const isPreview = tab === "preview";
  previewFrame.classList.toggle("hidden", !isPreview);
  previewCodeWrap.classList.toggle("hidden", isPreview);
  tabPreviewBtn.classList.toggle("active", isPreview);
  tabCodeBtn.classList.toggle("active", !isPreview);
}

tabPreviewBtn?.addEventListener("click", () => switchPreviewTab("preview"));
tabCodeBtn?.addEventListener("click", () => switchPreviewTab("code"));

previewCloseBtn?.addEventListener("click", () => {
  previewOverlay.classList.add("hidden");
  previewFrame.srcdoc = "";
});

previewCopyBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(previewCodeEl.textContent);
    previewCopyBtn.textContent = "تم النسخ ✓";
  } catch {
    previewCopyBtn.textContent = "تعذر النسخ";
  }
  setTimeout(() => {
    previewCopyBtn.textContent = "نسخ الكود";
  }, 1200);
});

// =========================
// النطق الصوتي للردود (عبر خاصية المتصفح، مجانًا)
// =========================
function stripMarkdownForSpeech(md) {
  return (md || "")
    .replace(/```[\s\S]*?```/g, " كود برمجي ")
    .replace(/!\[.*?\]\(.*?\)/g, " صورة ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[#*_`>~-]/g, "")
    .trim();
}

function speakText(text) {
  if (!window.speechSynthesis) {
    alert("متصفحك لا يدعم خاصية النطق الصوتي.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(stripMarkdownForSpeech(text));
  utterance.lang = "ar-SA";

  const voices = window.speechSynthesis.getVoices();
  const arabicVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("ar"));
  if (arabicVoice) utterance.voice = arabicVoice;

  window.speechSynthesis.speak(utterance);
}

function addSpeakButton(box, getText) {
  const btn = document.createElement("button");
  btn.className = "speak-btn";
  btn.textContent = "🔊 استماع";
  btn.onclick = () => speakText(getText());
  box.appendChild(btn);
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
// عرض محتوى رسالة فيها صورة (نص + صورة)
// =========================
function renderUserContentWithImage(contentEl, contentArray) {
  const textPart = contentArray.find((c) => c.type === "text")?.text || "";
  const imagePart = contentArray.find((c) => c.type === "image_url")?.image_url?.url;

  if (imagePart) {
    const img = document.createElement("img");
    img.src = imagePart;
    img.className = "msg-image";
    img.alt = "صورة مرفقة";
    contentEl.appendChild(img);
  }

  if (textPart) {
    const p = document.createElement("div");
    p.className = "msg-image-caption";
    p.textContent = textPart;
    contentEl.appendChild(p);
  }
}

// =========================
// إضافة الأزرار المصاحبة لرد الذكاء الاصطناعي (نسخ / استماع / عرض تصميم)
// =========================
function attachAssistantActions(box, contentEl, getText) {
  highlightCodeBlocks(contentEl);
  addCopyButton(box, getText);
  addSpeakButton(box, getText);

  const htmlBlocks = extractHtmlBlocks(getText());
  if (htmlBlocks.length) {
    addDesignPreviewButton(box, htmlBlocks[0]);
  }
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

  const isImageMessage = Array.isArray(content);

  if (role === "assistant") {
    contentEl.innerHTML = renderMarkdown(content);
  } else if (isImageMessage) {
    renderUserContentWithImage(contentEl, content);
  } else {
    contentEl.textContent = content;
  }

  box.appendChild(contentEl);
  row.append(avatar, box);
  chat.appendChild(row);

  if (role === "assistant") {
    attachAssistantActions(box, contentEl, () => content);
  } else if (role === "user" && index !== null && !isImageMessage) {
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
  textarea.value = typeof originalText === "string" ? originalText : "";

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
// مؤشر التفكير (نص قابل للتخصيص)
// =========================
function addTyping(text) {
  const row = document.createElement("div");
  row.className = "message assistant";
  row.id = "typing";
  row.innerHTML =
    '<div class="avatar">✦</div>' +
    `<div class="bubble typing">${text || "جاري التفكير..."}</div>`;
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
// رفع صورة
// =========================
attachBtn?.addEventListener("click", () => fileInput.click());

fileInput?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("الرجاء اختيار ملف صورة فقط.");
    fileInput.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("حجم الصورة كبير جدًا. الحد الأقصى 5 ميجابايت.");
    fileInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    pendingImageDataUrl = reader.result;
    imagePreviewImg.src = pendingImageDataUrl;
    imagePreviewWrap.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
  fileInput.value = "";
});

removeImageBtn?.addEventListener("click", () => {
  pendingImageDataUrl = null;
  imagePreviewImg.src = "";
  imagePreviewWrap.classList.add("hidden");
});

// =========================
// الإدخال الصوتي
// =========================
let recognition = null;
let isRecording = false;

micBtn?.addEventListener("click", () => {
  const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognitionApi) {
    alert("متصفحك لا يدعم التعرف على الصوت. جرّب Google Chrome.");
    return;
  }

  if (isRecording) {
    recognition?.stop();
    return;
  }

  recognition = new SpeechRecognitionApi();
  recognition.lang = "ar-EG";
  recognition.continuous = false;
  recognition.interimResults = true;

  let finalTranscript = "";

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add("recording");
  };

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcriptPiece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcriptPiece;
      } else {
        interim += transcriptPiece;
      }
    }
    input.value = (finalTranscript + interim).trim();
    autoSize();
  };

  recognition.onerror = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
    if (finalTranscript.trim()) {
      voiceJustUsed = true;
    }
  };

  recognition.start();
});

// =========================
// توليد صورة بالذكاء الاصطناعي
// =========================
async function sendImageGenerationRequest(text) {
  if (send.disabled) return;

  messages.push({ role: "user", content: text });
  addMessage("user", text, true, messages.length - 1);

  input.value = "";
  autoSize();
  send.disabled = true;
  addTyping("جاري توليد الصورة...");

  const isFirstExchange = messages.length === 1;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "image", prompt: text }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {}

    removeTyping();

    if (!res.ok || !data.image) {
      throw new Error(data?.error || "تعذر توليد الصورة.");
    }

    const dataUrl = `data:image/jpeg;base64,${data.image}`;
    const markdownContent = `تم توليد الصورة بنجاح:\n\n![صورة مولدة بالذكاء الاصطناعي](${dataUrl})`;

    const { box, contentEl } = addMessage("assistant", markdownContent, true);
    attachAssistantActions(box, contentEl, () => markdownContent);

    messages.push({ role: "assistant", content: markdownContent });
    saveCurrentConversation();

    if (isFirstExchange) {
      requestSmartTitle(currentConversationId, [...messages]);
    }
  } catch (error) {
    removeTyping();
    console.error("Image generation error:", error);
    addMessage(
      "assistant",
      "❌ " + (error?.message || "تعذر توليد الصورة، حاول تاني.")
    );
  } finally {
    send.disabled = false;
    input.focus();
  }
}

// =========================
// إرسال الرسالة (مع بث الرد أول بأول)
// =========================
async function sendMessage(text) {
  text = (text || "").trim();
  const imageToSend = pendingImageDataUrl;

  if (!text && !imageToSend) return;
  if (send.disabled) return;

  const spokenReply = voiceJustUsed;
  voiceJustUsed = false;

  let userContent;
  if (imageToSend) {
    userContent = [
      { type: "text", text: text || "صف هذه الصورة بالتفصيل." },
      { type: "image_url", image_url: { url: imageToSend } },
    ];
  } else {
    userContent = text;
  }

  messages.push({ role: "user", content: userContent });
  addMessage("user", userContent, true, messages.length - 1);

  input.value = "";
  autoSize();
  pendingImageDataUrl = null;
  imagePreviewImg.src = "";
  imagePreviewWrap.classList.add("hidden");

  send.disabled = true;
  addTyping();

  let fullText = "";
  let streamBubble = null;
  const isFirstExchange = messages.length === 1;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const contentType = response.headers.get("content-type") || "";

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
      buffer = lines.pop();

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

    streamBubble.contentEl.innerHTML = renderMarkdown(fullText);
    attachAssistantActions(streamBubble.box, streamBubble.contentEl, () => fullText);

    if (!fullText.trim()) {
      throw new Error("لم يتم استلام رد من الذكاء الاصطناعي.");
    }

    messages.push({ role: "assistant", content: fullText });

    saveCurrentConversation();

    if (isFirstExchange) {
      requestSmartTitle(currentConversationId, [...messages]);
    }

    if (spokenReply) {
      speakText(fullText);
    }
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
// طلب عنوان ذكي للمحادثة من الذكاء الاصطناعي
// =========================
async function requestSmartTitle(convoId, msgsSnapshot) {
  if (!convoId) return;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "title", messages: msgsSnapshot }),
    });

    const data = await res.json();
    if (data?.title) {
      const convo = conversations.find((c) => c.id === convoId);
      if (convo) {
        convo.title = data.title;
        save();
        renderHistory();
      }
    }
  } catch (err) {
    console.warn("تعذر توليد عنوان ذكي:", err);
  }
}

// =========================
// حفظ/تحديث المحادثة الحالية فقط
// =========================
function getFallbackTitle() {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "محادثة جديدة";

  if (typeof firstUserMsg.content === "string") {
    return firstUserMsg.content.slice(0, 45) || "محادثة جديدة";
  }

  if (Array.isArray(firstUserMsg.content)) {
    const textPart = firstUserMsg.content.find((c) => c.type === "text")?.text;
    return textPart ? textPart.slice(0, 45) : "📷 صورة";
  }

  return "محادثة جديدة";
}

function saveCurrentConversation() {
  const title = getFallbackTitle();

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

  try {
    save();
  } catch (err) {
    console.warn("تعذر حفظ المحادثة (مساحة التخزين ممتلئة على الأغلب):", err);
  }

  renderHistory();
}

// =========================
// إرسال النموذج
// =========================
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();

  if (!pendingImageDataUrl && text && isImageRequest(text)) {
    sendImageGenerationRequest(text);
  } else {
    sendMessage(input.value);
  }
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
function startNewChat() {
  messages = [];
  currentConversationId = null;
  pendingImageDataUrl = null;
  imagePreviewImg.src = "";
  imagePreviewWrap.classList.add("hidden");
  renderMessages();
  renderHistory();
  input.focus();
  sidebar.classList.remove("open");
  closeSidebarBackdrop();
}

document.getElementById("newChat").onclick = startNewChat;
document.getElementById("mobileNewChatBtn").onclick = startNewChat;

// =========================
// القائمة الجانبية
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
