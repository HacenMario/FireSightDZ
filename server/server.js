require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webPush = require('web-push');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error('❌ VAPID keys missing.');
  process.exit(1);
}

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@firesight.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

app.use(cors());
app.use(express.json());

// تقديم الملفات الثابتة من مجلد public (الموجود في نفس المستوى)
app.use(express.static(path.join(__dirname, '../public')));

let subscriptions = [];

// ====== API endpoints ======

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription data' });
  }
  const exists = subscriptions.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push(subscription);
    console.log(`[SUB] ✅ New (${subscriptions.length})`);
  }
  res.status(201).json({ message: 'Subscribed successfully' });
});

app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
  subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
  res.json({ message: 'Unsubscribed' });
});

app.post('/api/test-notification', async (req, res) => {
  if (subscriptions.length === 0) return res.status(400).json({ error: 'No subscribers' });
  const payload = JSON.stringify({
    title: '🔔 Test Notification',
    body: 'System is working!',
    icon: '/fire-icon.png',
    badge: '/fire-icon.png',
    data: { url: '/' },
  });
  const results = [];
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(sub, payload);
      results.push({ status: 'success' });
    } catch (error) {
      if (error.statusCode === 410) {
        subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
      }
      results.push({ status: 'failed', error: error.message });
    }
  }
  res.json({ results });
});

app.post('/api/send-fire-notification', async (req, res) => {
  const { location, temperature, confidence, timeAgo, lat, lng } = req.body;
  if (!location) return res.status(400).json({ error: 'Missing data' });
  if (subscriptions.length === 0) return res.status(400).json({ error: 'No subscribers' });

  const payload = JSON.stringify({
    title: `🔥 New Fire in ${location}`,
    body: `${temperature}°C | ${confidence} | ${timeAgo}`,
    icon: '/fire-icon.png',
    badge: '/fire-icon.png',
    data: { url: '/', lat, lng },
  });

  const results = [];
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(sub, payload);
      results.push({ status: 'success' });
    } catch (error) {
      if (error.statusCode === 410) {
        subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
      }
      results.push({ status: 'failed', error: error.message });
    }
  }
  res.json({ results });
});

// Serve index.html for any other route (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 VAPID Public: ${vapidKeys.publicKey.substring(0, 20)}...`);
});