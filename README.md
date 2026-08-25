# SUPER AI

موقع شات ذكاء اصطناعي عربي يعمل على Vercel باستخدام OpenAI Responses API.

## التشغيل على Vercel

1. ارفع الملفات إلى GitHub.
2. استورد المستودع في Vercel.
3. من Project Settings > Environment Variables أضف:

OPENAI_API_KEY=مفتاح_OpenAI_الخاص_بك

اختياريًا:
OPENAI_MODEL=gpt-5.6

4. أعد Deploy.

## التشغيل محليًا

ثبت Vercel CLI ثم:

npm install
vercel dev

لا تضع مفتاح OpenAI داخل `public/` أو داخل JavaScript الخاص بالمتصفح.