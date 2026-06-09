const CACHE_NAME = 'tracker-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// 安裝 Service Worker 並快取基本檔案（讓 App 跑得更快，甚至支援部分離線功能）
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// 啟用並接管網路請求
self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

// 攔截請求（確保在後台時，基礎的 JS 邏輯不會被系統完全殺死）
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request);
        })
    );
});