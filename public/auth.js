// =========================
// إعدادات Supabase
// غيّر القيمتين دول بعد ما تجيبهم من Settings > API في مشروعك على Supabase
// =========================
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================
// التجربة المجانية (24 ساعة من أول زيارة)
// =========================
const TRIAL_HOURS = 24;
const FIRST_VISIT_KEY = "superAI_firstVisit";

function getFirstVisit() {
  let t = localStorage.getItem(FIRST_VISIT_KEY);
  if (!t) {
    t = Date.now().toString();
    localStorage.setItem(FIRST_VISIT_KEY, t);
  }
  return parseInt(t, 10);
}

function getTrialRemainingMs() {
  const first = getFirstVisit();
  const elapsed = Date.now() - first;
  const total = TRIAL_HOURS * 60 * 60 * 1000;
  return Math.max(0, total - elapsed);
}

function formatRemaining(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `متبقي ${hours} ساعة و${minutes} دقيقة من التجربة المجانية`;
  }
  return `متبقي ${minutes} دقيقة من التجربة المجانية`;
}

// =========================
// عناصر الصفحة
// =========================
const authOverlay = document.getElementById("authOverlay");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authSwitchBtn = document.getElementById("authSwitchBtn");
const authSwitchText = document.getElementById("authSwitchText");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const googleBtn = document.getElementById("googleBtn");
const trialBanner = document.getElementById("trialBanner");
const trialText = document.getElementById("trialText");
const trialLoginBtn = document.getElementById("trialLoginBtn");
const authStatus = document.getElementById("authStatus");

let isSignUpMode = false;
let currentSession = null;

// =========================
// إظهار / إخفاء شاشة الدخول
// =========================
function showOverlay(forced) {
  authOverlay.classList.remove("hidden");

  if (forced) {
    authTitle.textContent = "انتهت فترة التجربة المجانية";
    authSubtitle.textContent =
      "سجّل دخولك أو أنشئ حساب مجاني للمتابعة في استخدام SUPER AI.";
  } else {
    authTitle.textContent = isSignUpMode
      ? "أنشئ حسابك المجاني"
      : "سجّل دخولك";
    authSubtitle.textContent = isSignUpMode
      ? "خلّي حسابك جاهز عشان تستخدم SUPER AI في أي وقت."
      : "أهلاً بيك تاني في SUPER AI.";
  }
}

function hideOverlay() {
  authOverlay.classList.add("hidden");
}

trialLoginBtn.onclick = () => showOverlay(false);

// =========================
// التبديل بين تسجيل الدخول وإنشاء حساب
// =========================
authSwitchBtn.onclick = () => {
  isSignUpMode = !isSignUpMode;
  authError.classList.add("hidden");
  authSubmitBtn.textContent = isSignUpMode ? "إنشاء حساب" : "دخول";
  authSwitchText.textContent = isSignUpMode
    ? "عندك حساب بالفعل؟"
    : "معندكش حساب؟";
  authSwitchBtn.textContent = isSignUpMode
    ? "سجّل دخولك"
    : "إنشاء حساب جديد";
  authTitle.textContent = isSignUpMode
    ? "أنشئ حسابك المجاني"
    : "سجّل دخولك للمتابعة";
};

// =========================
// تسجيل الدخول / إنشاء حساب بالإيميل
// =========================
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  authSubmitBtn.disabled = true;

  const email = authEmail.value.trim();
  const password = authPassword.value;

  try {
    let result;

    if (isSignUpMode) {
      result = await sb.auth.signUp({ email, password });
    } else {
      result = await sb.auth.signInWithPassword({ email, password });
    }

    if (result.error) throw result.error;

    if (isSignUpMode && !result.data.session) {
      authError.classList.remove("hidden");
      authError.classList.add("success");
      authError.textContent =
        "تم إنشاء الحساب! افتح إيميلك لتأكيد الحساب، وبعدين سجّل دخولك.";
    } else {
      hideOverlay();
    }
  } catch (err) {
    authError.classList.remove("hidden");
    authError.classList.remove("success");
    authError.textContent = translateAuthError(err.message);
  } finally {
    authSubmitBtn.disabled = false;
  }
});

// =========================
// تسجيل الدخول بـ Google
// =========================
googleBtn.onclick = async () => {
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin }
  });
};

function translateAuthError(msg) {
  if (!msg) return "حصل خطأ غير متوقع.";
  if (msg.includes("Invalid login credentials")) return "الإيميل أو كلمة المرور غلط.";
  if (msg.includes("User already registered")) return "الإيميل ده متسجل بالفعل. جرّب تسجّل دخولك بدل ما تعمل حساب جديد.";
  if (msg.includes("Password should be")) return "كلمة المرور لازم تكون 6 حروف على الأقل.";
  return msg;
}

// =========================
// عرض حالة تسجيل الدخول في القائمة الجانبية
// =========================
function renderAuthStatus() {
  if (currentSession) {
    const email = currentSession.user.email || "مستخدم";
    authStatus.innerHTML =
      '<div class="user-chip">' +
      '<span class="user-email">' + email + '</span>' +
      '<button id="logoutBtn" class="logout-btn">خروج</button>' +
      '</div>';

    document.getElementById("logoutBtn").onclick = async () => {
      await sb.auth.signOut();
    };
  } else {
    authStatus.innerHTML = '<span class="status"><span></span> متصل</span>';
  }
}

// =========================
// تحديث بانر التجربة المجانية / إجبار تسجيل الدخول
// =========================
function updateTrialBanner() {
  if (currentSession) {
    trialBanner.classList.add("hidden");
    hideOverlay();
    return;
  }

  const remaining = getTrialRemainingMs();

  if (remaining <= 0) {
    trialBanner.classList.add("hidden");
    showOverlay(true);
  } else {
    trialBanner.classList.remove("hidden");
    trialText.textContent = formatRemaining(remaining);
  }
}

// =========================
// متابعة تغيّر حالة تسجيل الدخول
// =========================
sb.auth.onAuthStateChange((_event, session) => {
  currentSession = session;
  renderAuthStatus();
  updateTrialBanner();
});

// =========================
// التشغيل عند فتح الصفحة
// =========================
(async function initAuth() {
  const { data } = await sb.auth.getSession();
  currentSession = data.session;
  renderAuthStatus();
  updateTrialBanner();
  setInterval(updateTrialBanner, 60 * 1000);
})();
