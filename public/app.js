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
// إضافة رسالة
// =========================
function addMessage(role, content, animate = true) {
  const row = document.createElement("div");

  row.className = `message ${role}`;

  const avatar = document.createElement("div");

  avatar.className = "avatar";

  avatar.textContent = role === "user" ? "أنت" : "✦";

  const box = document.createElement("div");

  box.className = "bubble";

  box.textContent = content;

  row.append(avatar, box);

  chat.appendChild(row);

  // زر النسخ لرد الذكاء الاصطناعي
  if (role === "assistant") {
    const copy = document.createElement("button");

    copy.className = "copy";

    copy.textContent = "نسخ";

    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(content);

        copy.textContent = "تم النسخ ✓";

        setTimeout(() => {
          copy.textContent = "نسخ";
        }, 1200);

      } catch {
        copy.textContent = "تعذر النسخ";

        setTimeout(() => {
          copy.textContent = "نسخ";
        }, 1200);
      }
    };

    box.appendChild(copy);
  }

  if (animate) {
    chat.scrollTop = chat.scrollHeight;
  }

  return box;
}

// =========================
// مؤشر التفكير
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

// =========================
// إزالة مؤشر التفكير
// =========================
function removeTyping() {
  document.getElementById("typing")?.remove();
}

// =========================
// ضبط ارتفاع مربع الكتابة
// =========================
function autoSize() {
  input.style.height = "auto";

  input.style.height =
    Math.min(input.scrollHeight, 150) + "px";
}

// =========================
// إرسال الرسالة
// =========================
async function sendMessage(text) {
  text = text.trim();

  if (!text || send.disabled) {
    return;
  }

  // إضافة رسالة المستخدم
  messages.push({
    role: "user",
    content: text
  });

  addMessage("user", text);

  input.value = "";

  autoSize();

  send.disabled = true;

  addTyping();

  try {

    // =========================
    // الاتصال مباشرة بـ Cloudflare
    // =========================
    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        messages: messages
      })
    });

    // محاولة قراءة الرد
    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "الخادم أرسل ردًا غير صالح."
      );
    }

    // التحقق من الخطأ
    if (!response.ok) {
      throw new Error(
        data?.error ||
        `حدث خطأ في الخادم (${response.status})`
      );
    }

    // التأكد من وجود الرد
    if (!data || !data.reply) {
      throw new Error(
        "لم يتم استلام رد من الذكاء الاصطناعي."
      );
    }

    removeTyping();

    // إضافة رد الذكاء الاصطناعي
    messages.push({
      role: "assistant",
      content: data.reply
    });

    addMessage(
      "assistant",
      data.reply
    );

    // =========================
    // حفظ المحادثة
    // =========================
    const title =
      messages
        .find((m) => m.role === "user")
        ?.content
        ?.slice(0, 45) ||
      "محادثة جديدة";

    conversations.push({
      title: title,
      messages: [...messages]
    });

    conversations = conversations.slice(-30);

    save();

    renderHistory();

  } catch (error) {

    removeTyping();

    console.error(
      "SUPER AI Error:",
      error
    );

    addMessage(
      "assistant",
      "❌ " + (
        error?.message ||
        "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي."
      )
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

// =========================
// تغيير حجم مربع الكتابة
// =========================
input.addEventListener("input", autoSize);

// =========================
// Enter للإرسال
// Shift + Enter لسطر جديد
// =========================
input.addEventListener("keydown", (e) => {

  if (e.key === "Enter" && !e.shiftKey) {

    e.preventDefault();

    form.requestSubmit();
  }
});

// =========================
// الأزرار المقترحة
// =========================
document
  .querySelectorAll(".suggestions button")
  .forEach((btn) => {

    btn.addEventListener("click", () => {

      sendMessage(
        btn.dataset.prompt
      );

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
