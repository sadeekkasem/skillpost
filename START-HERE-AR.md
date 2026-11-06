# ابدأ هنا — مهاراتي

هذه حزمة مشروع Next.js جديدة مستقلة. لا تدمجها مع الحزمة السابقة.

## الآن فقط
1. فك الضغط.
2. افتح المجلد skillpost في VS Code (File → Open Folder).
3. توقف هنا إذا أردت متابعة التجهيز مع المساعد خطوة بخطوة.

## تشغيل لاحقًا
المشروع يستهدف Node.js 22 LTS أو إصدارًا متوافقًا أحدث. لم يُشغّل npm أو يُختبر البناء في بيئة إعداد هذه الحزمة.
في Terminal داخل مجلد package.json:
```
npm install
npm run dev
```
افتح http://localhost:3000 . لا تستخدم الفتح المباشر لملفات TSX.
سترى أمثلة حتى دون Supabase؛ هذا مقصود وليس خطأ.
إذا كان 3000 مشغولًا استخدم العنوان الذي يعرضه Terminal.

## ربط البيانات لاحقًا
1. أنشئ مشروع Supabase جديدًا.
2. نفذ supabase/schema.sql مرة واحدة. السكربت ينشئ الجداول وRLS وbucket خاصًا تلقائيًا.
3. انسخ .env.local.example إلى .env.local بجانب package.json.
4. ضع Project URL والمفتاح publishable العام (أو anon العام المتوافق) في المتغيرين الموجودين. اسم المتغير ANON_KEY هنا مجرد اسم متوافق مع الكود ويقبل المفتاح العام المناسب.
5. لا تضع secret أو service_role في المشروع أو المتصفح ولا ترسلها للمساعد.
6. أوقف خادم التطوير Ctrl+C ثم شغّل npm run dev مجددًا.
7. اضبط Site URL وعناوين إعادة التوجيه في Supabase → Authentication → URL Configuration:
   - Site URL: https://www.skillpostapp.com
   - Redirect URLs (أضف كل سطر):
     - https://www.skillpostapp.com/account
     - https://www.skillpostapp.com/**
     - http://localhost:3000/account
     - http://localhost:3000/**
   رابط استعادة كلمة المرور يستخدم: https://www.skillpostapp.com/account?reset=1
8. سجّل حسابًا تجريبيًا وأكّد البريد إن طُلب، ثم اختبر نشر مشروع وتعليق وتحميل مرفق.

## قبل النشر
اتبع docs/TEST-CHECKLIST.md وdocs/DEPLOYMENT.md وdocs/LIMITATIONS.md.
لا تفتح التسجيل للعامة قبل مراجعة الأمان والمحتوى والخصوصية.
