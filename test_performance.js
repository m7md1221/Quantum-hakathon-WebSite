// اختبار أداء السيرفر الجديد
const http = require('http');

console.log('\n🧪 ===== اختبار أداء السيرفر =====\n');

// 1. اختبار Health Check
async function testHealthCheck() {
  console.log('1️⃣ اختبار صحة السيرفر...');
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/api/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        console.log('   ✅ حالة السيرفر:', result.status);
        console.log('   📊 قاعدة البيانات:', result.database);
        if (result.metrics) {
          console.log('   💾 الذاكرة:', result.metrics.memory.used + 'MB / ' + result.metrics.memory.total + 'MB');
          if (result.metrics.database) {
            console.log('   🗄️  اتصالات DB: المجموع=' + result.metrics.database.total + 
                       ', خاملة=' + result.metrics.database.idle + 
                       ', منتظرة=' + result.metrics.database.waiting);
          }
        }
        if (result.warnings) {
          console.log('   ⚠️  تحذيرات:', result.warnings);
        }
        console.log('');
        resolve();
      });
    });
    req.on('error', (e) => {
      console.log('   ❌ خطأ:', e.message);
      resolve();
    });
  });
}

// 2. اختبار Rate Limiting
async function testRateLimiting() {
  console.log('2️⃣ اختبار Rate Limiting (حماية من الطلبات الزائدة)...');
  console.log('   📤 إرسال 105 طلبات متتالية...\n');
  
  let successCount = 0;
  let rateLimitedCount = 0;
  
  const promises = [];
  for (let i = 0; i < 105; i++) {
    promises.push(
      new Promise((resolve) => {
        const req = http.get('http://localhost:3000/api/ping', (res) => {
          if (res.statusCode === 200) {
            successCount++;
          } else if (res.statusCode === 429) {
            rateLimitedCount++;
          }
          resolve();
        });
        req.on('error', () => resolve());
      })
    );
  }
  
  await Promise.all(promises);
  
  console.log('   ✅ نجح:', successCount, 'طلب');
  console.log('   🛑 تم منعه (Rate Limited):', rateLimitedCount, 'طلب');
  console.log('   📊 النتيجة:', rateLimitedCount > 0 ? 'Rate Limiting يعمل ✅' : 'Rate Limiting لم يعمل ❌');
  console.log('');
}

// 3. اختبار الطلبات المتزامنة
async function testConcurrentRequests(count) {
  console.log(`3️⃣ اختبار ${count} طلب متزامن...`);
  
  const startTime = Date.now();
  const promises = [];
  
  for (let i = 0; i < count; i++) {
    promises.push(
      new Promise((resolve) => {
        const req = http.get('http://localhost:3000/api/ping', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, time: Date.now() - startTime }));
        });
        req.on('error', (e) => resolve({ error: e.message }));
      })
    );
  }
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  const successful = results.filter(r => r.status === 200).length;
  const failed = results.filter(r => r.error).length;
  const avgTime = results.reduce((sum, r) => sum + (r.time || 0), 0) / results.length;
  
  console.log('   ⏱️  الوقت الكلي:', (endTime - startTime) + 'ms');
  console.log('   ✅ نجح:', successful + '/' + count);
  console.log('   ❌ فشل:', failed + '/' + count);
  console.log('   📈 متوسط وقت الاستجابة:', Math.round(avgTime) + 'ms');
  console.log('');
}

// 4. اختبار رسائل الأخطاء
async function testErrorMessages() {
  console.log('4️⃣ اختبار رسائل الأخطاء...');
  
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/api/nonexistent', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        console.log('   📝 رسالة الخطأ:', result.error || result.message);
        console.log('   ✅ الرسالة واضحة:', result.message ? 'نعم ✅' : 'لا ❌');
        console.log('');
        resolve();
      });
    });
    req.on('error', (e) => {
      console.log('   ❌ خطأ:', e.message);
      resolve();
    });
  });
}

// تشغيل جميع الاختبارات
async function runAllTests() {
  try {
    await testHealthCheck();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testRateLimiting();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testConcurrentRequests(10);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testConcurrentRequests(30);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testErrorMessages();
    
    console.log('✅ ===== انتهى الاختبار =====\n');
    
    // فحص نهائي
    console.log('📊 ===== فحص نهائي للنظام =====\n');
    await testHealthCheck();
    
  } catch (err) {
    console.error('❌ خطأ في الاختبار:', err);
  }
}

// انتظر ثانيتين ثم ابدأ
setTimeout(runAllTests, 2000);
