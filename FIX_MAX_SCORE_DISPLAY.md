# إصلاح عرض الدرجات القصوى (Max Score) في تفاصيل التقييمات

## المشكلة
كانت جميع المعايير تُعرض بحد أقصى 10 نقاط، بغض النظر عن وزنها الفعلي:
- ❌ Innovation & Creativity: 1.0/**10.0** (15%)
- ❌ Problem & Importance: 0.0/**10.0** (15%)

بينما الصحيح أن بعض المعايير لها حد أقصى 15 نقطة:
- ✅ Innovation & Creativity: 1.0/**15.0** (15%)
- ✅ Problem & Importance: 0.0/**15.0** (15%)

هذا كان يسبب ارباك للمستخدمين لأن العرض لا يعكس النقاط الحقيقية.

## الحساب الصحيح
مثال على الحساب الصحيح (من البيانات المعروضة):
- Innovation & Creativity: 1/15 × 15% = 1.5/100 ✅

## الإصلاحات المطبقة

### 1. في `/api/admin/teams/:teamId`
**السطر 218:**
```javascript
// قبل الإصلاح ❌
10::FLOAT as max_score

// بعد الإصلاح ✅
c.weight::FLOAT as max_score
```

### 2. في `/api/admin/evaluation-scores/:scoreId`
**السطور 402-414:**
```javascript
// قبل الإصلاح ❌
const scoreCheck = await pool.query(
  `SELECT es.id, es.evaluation_id, 10 as max_score
   FROM evaluation_scores es
   WHERE es.id = $1`
);
const maxScore = parseFloat(scoreCheck.rows[0].max_score) || 10;

// بعد الإصلاح ✅
const scoreCheck = await pool.query(
  `SELECT es.id, es.evaluation_id, c.weight as max_score
   FROM evaluation_scores es
   JOIN criteria c ON es.criterion_key = c.key
   WHERE es.id = $1`
);
const maxScore = parseFloat(scoreCheck.rows[0].max_score) || 15;
```

### 3. في `/api/admin/team-evaluations/:teamId`
**السطر 514:**
```javascript
// قبل الإصلاح ❌
10 as max_score

// بعد الإصلاح ✅
c.weight as max_score
```

## النتيجة
الآن سيتم عرض الحد الأقصى الصحيح لكل معيار:
- **15 نقطة** للمعايير ذات الوزن 15%:
  - Problem & Importance
  - Use of AI / Quantum Computing
  - Innovation & Creativity
  - Social Impact

- **10 نقاط** للمعايير ذات الوزن 10%:
  - UN Sustainable Development Goals (SDGs)
  - Code Quality & Extensibility
  - Performance & Result Quality
  - Presentation & Teamwork

## الملفات المعدلة
- ✅ `routes/admin.js` - تحديث 3 queries

## ملاحظة مهمة
في جدول `criteria`، العمود `weight` يمثل في نفس الوقت:
1. **وزن المعيار** في الحساب النهائي (15% أو 10%)
2. **الحد الأقصى للدرجة** التي يمكن إعطاؤها (15 أو 10 نقاط)

لذلك استخدمنا `c.weight` كقيمة لـ `max_score`.
