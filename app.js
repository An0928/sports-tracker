let map, polyline;
let watchId = null;
let timerId = null;
let routeCoordinates = []; // 儲存所有 GPS 點的陣列
let totalDistance = 0;     // 跑步中即時累加距離 (單位：公尺)
let lastPosition = null;   // 記錄上一個點
let totalSeconds = 0;

// 1. 初始化地圖
function initMap() {
    map = L.map('map').setView([25.0339, 121.5644], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    polyline = L.polyline([], { color: '#0d00ff', weight: 6, opacity: 0.8 }).addTo(map);

    // 解決地圖空白核心：強制讓 Leaflet 重新計算容器大小
    setTimeout(() => {
        map.invalidateSize();
    }, 400);
}

// 2. Haversine 距離計算公式
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // 地球半徑 (公尺)
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 3. 格式化時間 (00:00:00)
function formatTime(seconds) {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

// 4. 開始運動
function startTracking() {
    if (!navigator.geolocation) return alert("您的瀏覽器不支援 GPS 定位");

    // 重設所有變數
    routeCoordinates = [];
    totalDistance = 0;
    lastPosition = null;
    totalSeconds = 0;
    polyline.setLatLngs([]);

    document.getElementById('distance').innerText = "0.00";
    document.getElementById('timer').innerText = "00:00:00";
    document.getElementById('speed').innerText = "--.-";
    document.getElementById('share-container').style.display = 'none'; // 開始新運動時先隱藏分享區

    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;

    // 啟動計時器
    timerId = setInterval(() => {
        totalSeconds++;
        document.getElementById('timer').innerText = formatTime(totalSeconds);
    }, 1000);

    // 監聽 GPS
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            if (accuracy > 20) return; // 過濾壞訊號

            const newPoint = [latitude, longitude];
            routeCoordinates.push(newPoint); // 存入陣列
            polyline.addLatLng(newPoint);    // 即時畫線
            map.setView(newPoint, 17);       // 地圖視角跟隨

            if (lastPosition) {
                const dist = calculateDistance(
                    lastPosition.latitude, lastPosition.longitude,
                    latitude, longitude
                );
                totalDistance += dist;
                document.getElementById('distance').innerText = (totalDistance / 1000).toFixed(2);
            }
            lastPosition = { latitude, longitude };
        },
        (err) => console.error("GPS 錯誤: ", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// 5. 結束運動並結算
function stopTracking() {
    if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    if (timerId) { clearInterval(timerId); timerId = null; }

    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;

    const totalKm = totalDistance / 1000;

    let avgSpeed = 0;
    if (totalSeconds > 0) {
        avgSpeed = totalKm / (totalSeconds / 3600);
    }

    let paceString = `--'--"`;
    if (totalDistance > 0) {
        const secondsPerKm = totalSeconds / totalKm;
        const paceMins = Math.floor(secondsPerKm / 60);
        const paceSecs = Math.floor(secondsPerKm % 60);
        if (paceMins < 60) {
            paceString = `${paceMins}'${String(paceSecs).padStart(2, '0')}`;
        }
    }

    document.getElementById('speed').innerText = avgSpeed.toFixed(1);

    map.invalidateSize();
    if (routeCoordinates.length > 0) {
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    }

    // === 將數據同步塞進 Strava 分享卡片 ===
    document.getElementById('card-km').innerText = totalKm.toFixed(2);
    document.getElementById('card-time').innerText = formatTime(totalSeconds);
    document.getElementById('card-pace').innerText = paceString;

    // 關鍵一行：讓隱藏的分享區塊現身
    document.getElementById('share-container').style.display = 'block';

    // 叫 Canvas 畫出純橘色軌跡線
    if (routeCoordinates.length > 1) {
        drawTrajectoryOnCanvas(routeCoordinates, "mini-map-canvas");
    }

    setTimeout(() => {
        alert(
            `🎉 運動完成！\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `⏱ 總共時間：${formatTime(totalSeconds)}\n` +
            `🛣 總共距離：${totalKm.toFixed(2)} 公里\n` +
            `⚡️ 平均時速：${avgSpeed.toFixed(1)} km/h\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `請下滑網頁上傳運動照片，即可匯出分享圖！`
        );
    }, 600);
}

// 6. Canvas 繪圖功能
function drawTrajectoryOnCanvas(coords, canvasId) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    let lats = coords.map(p => p[0]), lngs = coords.map(p => p[1]);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0d00ff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    coords.forEach((point, index) => {
        let x = ((point[1] - minLng) / (maxLng - minLng || 1)) * (canvas.width - 60) + 30;
        let y = canvas.height - (((point[0] - minLat) / (maxLat - minLat || 1)) * (canvas.height - 60) + 30);

        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

// === 事件監聽群組（乾淨不重複版） ===
document.getElementById('startBtn').addEventListener('click', startTracking);
document.getElementById('stopBtn').addEventListener('click', stopTracking);

// 照片選取與即時底圖預覽
document.getElementById('imageLoader').addEventListener('change', function (e) {
    const reader = new FileReader();
    reader.onload = function (event) {
        document.getElementById('bg-preview').src = event.target.result;
    }
    if (e.target.files[0]) {
        reader.readAsDataURL(e.target.files[0]);
    }
});

// 下載按鈕點擊：截圖匯出卡片（補回這段功能就完整了！）
document.getElementById('downloadBtn').addEventListener('click', () => {
    const card = document.getElementById('capture-card');
    html2canvas(card, { useCORS: true }).then(canvas => {
        const imageUri = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.download = `我的運動紀錄_${Date.now()}.png`;
        link.href = imageUri;
        link.click();
    });
});

// === 註冊 PWA 後台服務 (Service Worker) ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('PWA Service Worker 註冊成功！範圍:', reg.scope))
            .catch((err) => console.error('PWA Service Worker 註冊失敗:', err));
    });
}

window.onload = initMap;