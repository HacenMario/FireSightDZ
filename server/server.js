require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webPush = require('web-push');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// التحقق من وجود مفاتيح VAPID
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error('❌ VAPID keys missing. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment variables.');
  process.exit(1);
}

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:stevenhacen@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

app.use(cors());
app.use(express.json());

// تقديم الملفات الثابتة من مجلد public (إذا كنت تريد تشغيل الكل من Render)
// ولكن بما أنك تستخدم Vercel للواجهة، يمكنك تخطي هذا
// app.use(express.static(path.join(__dirname, '../public')));

// تخزين الاشتراكات في الذاكرة
let subscriptions = [];

// ============================================================
// API Endpoints
// ============================================================

// جلب المفتاح العمومي VAPID
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// تسجيل اشتراك جديد
app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    console.error('[SUB] Invalid subscription data');
    return res.status(400).json({ error: 'Invalid subscription data' });
  }

  const exists = subscriptions.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push(subscription);
    console.log(`[SUB] ✅ New subscription (${subscriptions.length} total)`);
  } else {
    console.log(`[SUB] ℹ️ Subscription already exists`);
  }

  res.status(201).json({ 
    message: 'Subscribed successfully',
    total: subscriptions.length 
  });
});

// إلغاء الاشتراك
app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint required' });
  }
  subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
  console.log(`[UNSUB] 🗑️ Removed (${subscriptions.length} remaining)`);
  res.json({ message: 'Unsubscribed' });
});

// جلب قائمة الاشتراكات (للتشخيص)
app.get('/api/subscriptions', (req, res) => {
  res.json({ 
    count: subscriptions.length, 
    subscriptions: subscriptions.map(s => ({ endpoint: s.endpoint.substring(0, 30) + '...' })) 
  });
});

// إرسال إشعار تجريبي
app.post('/api/test-notification', async (req, res) => {
  if (subscriptions.length === 0) {
    return res.status(400).json({ error: 'No subscribers' });
  }

  const payload = JSON.stringify({
    title: '🔔 Test Notification',
    body: 'Your wildfire alert system is working!',
    icon: 'https://fire-sight-dz.vercel.app/fire-icon.png',
    badge: 'https://fire-sight-dz.vercel.app/fire-icon.png',
    data: { url: 'https://fire-sight-dz.vercel.app/' },
  });

  const results = [];
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(sub, payload);
      results.push({ status: 'success' });
      console.log(`[PUSH] ✅ Sent test`);
    } catch (error) {
      console.error(`[PUSH] ❌ Error:`, error.message);
      if (error.statusCode === 410) {
        subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
        console.log(`[PUSH] 🗑️ Removed expired subscription`);
      }
      results.push({ status: 'failed', error: error.message });
    }
  }
  res.json({ results });
});

// إرسال إشعار حريق
app.post('/api/send-fire-notification', async (req, res) => {
  const { location, temperature, confidence, timeAgo, lat, lng } = req.body;
  if (!location) {
    return res.status(400).json({ error: 'Missing fire data' });
  }

  if (subscriptions.length === 0) {
    return res.status(400).json({ error: 'No active subscriptions' });
  }

  const payload = JSON.stringify({
    title: `🔥 New Fire in ${location}`,
    body: `${temperature}°C | ${confidence} | ${timeAgo}`,
    icon: 'https://fire-sight-dz.vercel.app/fire-icon.png',
    badge: 'https://fire-sight-dz.vercel.app/fire-icon.png',
    data: { 
      url: 'https://fire-sight-dz.vercel.app/', 
      lat, 
      lng 
    },
  });

  const results = [];
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(sub, payload);
      results.push({ status: 'success' });
      console.log(`[FIRE] ✅ Sent fire alert`);
    } catch (error) {
      console.error(`[FIRE] ❌ Error:`, error.message);
      if (error.statusCode === 410) {
        subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
        console.log(`[FIRE] 🗑️ Removed expired subscription`);
      }
      results.push({ status: 'failed', error: error.message });
    }
  }
  res.json({ results });
});

// ============================================================
// مسار الـ Proxy (وكيل لـ NASA FIRMS)
// ============================================================
app.get('/proxy/*', async (req, res) => {
  const targetUrl = req.params[0];
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target URL' });
  }

  const fullUrl = decodeURIComponent(targetUrl);
  console.log(`[PROXY] Fetching: ${fullUrl.substring(0, 80)}...`);

  try {
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.text();
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', response.headers.get('content-type') || 'text/plain');
    res.send(data);
    console.log(`[PROXY] ✅ Success (${data.length} bytes)`);
  } catch (error) {
    console.error(`[PROXY] ❌ Error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// مسار الصحة (Health Check) لـ Render
// ============================================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    subscriptions: subscriptions.length 
  });
});

// ============================================================
// تشغيل الخادم
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀 Wildfire Alert Server running on port ${PORT}`);
  console.log(`🔑 VAPID Public Key: ${vapidKeys.publicKey.substring(0, 30)}...`);
  console.log(`📨 ${subscriptions.length} active subscriptions`);
  console.log(`📌 Health check: /health\n`);
});
