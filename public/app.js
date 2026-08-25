const chat = document.getElementById("chat");
const input = document.getElementById("input");
const form = document.getElementById("form");
const send = document.getElementById("send");
const welcome = document.getElementById("welcome");
const historyEl = document.getElementById("history");
const sidebar = document.getElementById("sidebar");

let messages = [];
let conversations = JSON.parse(localStorage.getItem("superAIConversations") || "[]");

function save() {
  localStorage.setItem("superAIConversations", JSON.stringify(conversations.slice(-30)));
}

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

function loadConversation(index) {
  messages = conversations[index]?.messages || [];
  renderMessages();
  sidebar.classList.remove("open");
}

function renderMessages() {
  welcome.style.display = messages.length ? "none" : "";
  chat.querySelectorAll(".message").forEach(x => x.remove());

  messages.forEach(m => addMessage(m.role, m.content, false));
  requestAnimationFrame(() => chat.scrollTop = chat.scrollHeight);
}

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

  if (role === "assistant") {
    const copy = document.createElement("button");
    copy.className = "copy";
    copy.textContent = "نسخ";
    copy.onclick = async () => {
      await navigator.clipboard.writeText(content);
      copy.textContent = "تم النسخ ✓";
      setTimeout(() => copy.textContent = "نسخ", 1200);
    };
    box.appendChild(copy);
  }

  if (animate) chat.scrollTop = chat.scrollHeight;
  return box;
}

function addTyping() {
  const row = document.createElement("div");
  row.className = "message assistant";
  row.id = "typing";
  row.innerHTML = '<div class="avatar">✦</div><div class="bubble typing">جاري التفكير...</div>';
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing")?.remove();
}

function autoSize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 150) + "px";
}

async function sendMessage(text) {
  text = text.trim();
  if (!text || send.disabled) return;

  messages.push({ role: "user", content: text });
  addMessage("user", text);
  input.value = "";
  autoSize();
  send.disabled = true;
  addTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "حدث خطأ.");

    removeTyping();
    messages.push({ role: "assistant", content: data.reply });
    addMessage("assistant", data.reply);

    const title = messages.find(m => m.role === "user")?.content?.slice(0, 45) || "محادثة جديدة";
    conversations.push({ title, messages: [...messages] });
    conversations = conversations.slice(-30);
    save();
    renderHistory();
  } catch (error) {
    removeTyping();
    addMessage("assistant", "❌ " + error.message);
  } finally {
    send.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", e => {
  e.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("input", autoSize);

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll(".suggestions button").forEach(btn => {
  btn.addEventListener("click", () => sendMessage(btn.dataset.prompt));
});

document.getElementById("newChat").onclick = () => {
  messages = [];
  renderMessages();
  input.focus();
  sidebar.classList.remove("open");
};

document.getElementById("clearBtn").onclick = () => {
  messages = [];
  renderMessages();
};

document.getElementById("menuBtn").onclick = () => {
  sidebar.classList.toggle("open");
};

renderHistory();