// تثبيت الـ Service Worker
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installed');
  self.skipWaiting(); // تفعيل فوري
});

// تنشيط الـ Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  event.waitUntil(clients.claim());
});

// استقبال الإشعارات
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🔥 إنذار حريق';
  const options = {
    body: data.body || 'تم اكتشاف حريق جديد في المنطقة',
    icon: data.icon || '/fire-icon.png',
    badge: data.badge || '/fire-icon.png',
    data: data.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: '📍 عرض على الخريطة',
      },
      {
        action: 'dismiss',
        title: 'إغلاق',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// معالجة النقر على الإشعار
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;

  notification.close();

  if (action === 'open' || !action) {
    const urlToOpen = notification.data?.url || '/';
    const lat = notification.data?.lat;
    const lng = notification.data?.lng;

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // إذا كان هناك نافذة مفتوحة بالفعل، نركزها
          for (const client of clientList) {
            if (client.url.includes(urlToOpen) && 'focus' in client) {
              return client.focus();
            }
          }
          // وإلا نفتح نافذة جديدة
          return clients.openWindow(urlToOpen);
        })
        .then(() => {
          // يمكننا إرسال رسالة إلى الصفحة لفتح الخريطة على الإحداثيات
          // باستخدام BroadcastChannel أو postMessage
        })
    );
  }
});

// استقبال رسائل من الصفحة (لتسجيل الاشتراك)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});