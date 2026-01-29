# ✅ GitHub-Only Project Submission System

## تحديث النظام: من رفع الملفات إلى روابط GitHub

تم تحويل نظام تسليم المشاريع بالكامل من رفع ملفات ZIP إلى إدخال رابط GitHub Repository فقط.

---

## 📋 ملخص التغييرات

### 1️⃣ قاعدة البيانات (Database)
- ✅ تم استبدال عمود `file_path` بـ `github_url` في جدول `projects`
- ✅ تم حذف عمود `public_id` (لم يعد مستخدم)
- ✅ إضافة validation على مستوى التطبيق لضمان صحة الروابط

**ملف Migration:**
```bash
migrate_to_github_urls.sql
```

---

### 2️⃣ Backend API (Node.js/Express)

#### تحديثات Endpoints:

**`POST /api/team/submit`** (جديد ✨)
- يستقبل `github_url` بدل ملف
- Validation:
  - يجب أن يبدأ برابط بـ `https://github.com/`
  - يجب أن يكون رابط GitHub صحيح
- Response: `{ message: "Project submitted successfully", github_url: "..." }`

**`GET /api/admin/projects/:teamId`**
- تم تحديثه: يُرجع `github_url` بدل `signedUrl`
- Response: `{ github_url: "https://github.com/..." }`

**`GET /api/judge/projects/:teamId`**
- تم تحديثه: يُرجع `github_url` بدل `signedUrl`
- Response: `{ github_url: "https://github.com/..." }`

#### الملفات المحدثة:
- `routes/team.js` - إزالة multer، إضافة `/submit` endpoint
- `routes/admin.js` - حذف Cloudinary imports، تحديث `/projects/:teamId`
- `routes/judge.js` - حذف Cloudinary imports، تحديث `/projects/:teamId`
- `server.js` - إزالة معالجة أخطاء multer

---

### 3️⃣ Frontend (واجهة الطالب)

#### الصفحات:
- **`upload-project.html`** (معاد تسمية: Submit Project)
  - تم استبدال file input بـ text input للرابط
  - إضافة placeholder وتعليمات واضحة
  - real-time validation مع رسائل خطأ/نجاح

#### الملفات المحدثة:
- `public/upload.js` - تم تحديثه بالكامل:
  - function `validateGitHubUrl()` للتحقق من الرابط
  - function `openProjectRepository()` لفتح الرابط
  - real-time validation بألوان مختلفة

---

### 4️⃣ Judge Dashboard

#### الملفات المحدثة:
- `public/evaluate.js`
  - استبدال `downloadProject()` بـ `openProjectRepository()`
  - الآن يفتح الرابط في تبويب جديد بدل التحميل

- `public/evaluate-team.html`
  - تحديث زر "📥 Download Project" ← "🔗 View Project on GitHub"

---

### 5️⃣ Admin Dashboard

#### الملفات المحدثة:
- `public/team-details.js`
  - استبدال `downloadProject()` بـ `openProjectRepository()`
  - الآن يفتح الرابط في تبويب جديد

- `public/team-details.html`
  - تحديث زر "Download Project" ← "🔗 View on GitHub"

---

### 6️⃣ Team Dashboard

#### الملفات المحدثة:
- `public/js/team-dashboard.js`
  - تحديث رسالة الحالة من "upload your project ZIP file" إلى "submit your GitHub repository"

---

## 🔒 Security & Validation

### على مستوى Backend:
```javascript
// GitHub URL Validation
- يجب أن يبدأ بـ https://github.com/
- يجب أن يكون رابط URL صحيح
- يتم تنظيف الرابط (إزالة trailing slashes)
- يتم تخزينه في قاعدة البيانات مباشرة (نص)
```

### على مستوى Frontend:
```javascript
// Real-time Validation
- التحقق أثناء الكتابة
- رسائل خطأ واضحة بألوان مختلفة
- منع الإرسال إذا كان الرابط غير صحيح
```

---

## 🗑️ ما تم حذفه

- ❌ `multer` package: لم يعد مستخدم (يمكن حذفه من package.json اختياري)
- ❌ `cloudinary` imports من routes (لا تزال مستخدمة في routes أخرى)
- ❌ `/uploads` directory: لم يعد ضروري
- ❌ `file_path` و `public_id` من جدول projects
- ❌ جميع كود معالجة الملفات من الـ endpoints

---

## 📦 خطوات التثبيت والتحديث

### لمشروع جديد:
1. استخدم `schema.sql` مباشرة (تم تحديثه)
2. انشر التطبيق الجديد

### للمشاريع الموجودة:
1. **Backup قاعدة البيانات أولاً**
2. تشغيل `migrate_to_github_urls.sql`:
   ```bash
   psql -U username -d database_name -f migrate_to_github_urls.sql
   ```
3. انشر التطبيق الجديد
4. اختبر النظام بالكامل

---

## ✨ المميزات الجديدة

✅ **أبسط للمستخدمين:** لا حاجة لضغط الملفات  
✅ **أفضل للأداء:** لا حاجة للتخزين السحابي  
✅ **أكثر أماناً:** لا ملفات على السيرفر  
✅ **أسهل في الصيانة:** شفرة نظيفة وبسيطة  
✅ **توثيق أفضل:** الحكام يرون الشفرة مباشرة  

---

## 🧪 الاختبار

```bash
# اختبر submission بـ valid URL
curl -X POST http://localhost:3000/api/team/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"github_url":"https://github.com/username/project-name"}'

# اختبر الـ invalid URLs:
# ❌ https://gitlab.com/...  (not GitHub)
# ❌ http://github.com/...   (must be HTTPS)
# ❌ github.com/...          (must have https://)
```

---

## 📝 Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/team/submit` | Submit GitHub URL |
| GET | `/api/team/status` | Get submission status |
| GET | `/api/admin/projects/:teamId` | Get project GitHub URL (Admin) |
| GET | `/api/judge/projects/:teamId` | Get project GitHub URL (Judge) |

---

## ⚠️ Notes for Admins

- جميع الفرق تحتاج لإعادة تسليم مشاريعها برابط GitHub
- لا يوجد بيانات قديمة تُهاجر تلقائياً (يجب على الفرق التسليم من جديد)
- يمكن استخدام SQL script لتعيين روابط افتراضية إذا لزم الأمر

---

## 📧 Support

للأسئلة أو المشاكل:
- تحقق من browser console للأخطاء
- تحقق من server logs للتفاصيل
- قراءة التعليقات في الكود

---

**آخر تحديث:** يناير 2026  
**الإصدار:** 2.0 - GitHub Integration
