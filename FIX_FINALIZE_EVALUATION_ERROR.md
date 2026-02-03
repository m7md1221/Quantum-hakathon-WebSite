# إصلاح مشكلة خطأ 500 في finalize-evaluation

## المشكلة
كان جدول evaluation_scores يحتوي على constraint يسمح فقط بدرجات من 0 إلى 10:
```sql
CHECK (score >= 0 AND score <= 10)
```

لكن بعض المعايير في النظام تقبل درجات حتى 15 (مثل problem_importance, ai_quantum_use, innovation, social_impact)

## الحل المطبق

### 1. تحديث constraint في قاعدة البيانات
تم تشغيل السكريبت `fix_score_constraint_script.js` الذي:
- حذف الـ constraint القديم
- أضاف constraint جديد يسمح بدرجات من 0 إلى 15

### 2. تحديث الملفات
- ✅ `schema.sql` - تحديث الـ constraint ليعكس التغيير
- ✅ `routes/judge.js` - إضافة logging تفصيلي لتتبع الأخطاء

### 3. خطوات الرفع للسيرفر اللايف

يجب رفع الملفات التالية للسيرفر اللايف:

1. **routes/judge.js** - يحتوي على logging محسّن وأفضل معالجة للأخطاء
2. **schema.sql** - محدّث للمشاريع الجديدة
3. تشغيل السكريبت على السيرفر اللايف:

```bash
# على السيرفر اللايف
node fix_score_constraint_script.js
```

أو استخدام SQL مباشرة:
```bash
psql $DATABASE_URL -f fix_score_constraint_final.sql
```

### 4. التحقق من الإصلاح
بعد رفع الملفات، جرب:
1. تسجيل الدخول كحكم (judge)
2. تقييم فريق مع معايير تحتوي على درجات 15
3. يجب أن يعمل التقييم بنجاح دون خطأ 500

## ملاحظات إضافية
- تم تحسين معالجة الأخطاء في finalize-evaluation endpoint
- تم إضافة logging تفصيلي لتتبع أي مشاكل مستقبلية
- الـ constraint الجديد يدعم جميع المعايير (0-15)
