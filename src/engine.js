/**
 * ============================================================================
 * HOGWARTS DUEL - UTILITY MOTORU & GÖRSEL/FİZİK YARDIMCI KÜTÜPHANESİ
 * ============================================================================
 * Bu sınıf; oyunun tüm görsel çizim, rotasyon, fiziksel çarpışma algılamaları
 * ve matematiksel interpolasyon (Lerp, Clamp) süreçlerini üstlenir. Tekken tarzı
 * milimetrik kutu etkileşimleri ve parçacık sistemleri burada formüle edilmiştir.
 * 
 * Modüler Mimari Tasarımı (ES6):
 * - Tamamen statik ve yardımcı sınıflardan oluşur.
 * - Çizim aşamasında CPU/GPU yükünü azaltmak amacıyla matris dönüşümlerini optimize eder.
 */

import { particles } from './main.js';

/**
 * 2D Vektör ve Fizik Yardımcı Sınıfı
 */
export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    /**
     * İki nokta arasındaki Öklid mesafesini hesaplar.
     */
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.hypot(dx, dy);
    }

    /**
     * İki nokta arasındaki açıyı radyan cinsinden döner.
     */
    static angleBetween(startX, startY, endX, endY) {
        return Math.atan2(endY - startY, endX - startX);
    }
}

/**
 * İleri Düzey Matematiksel ve Grafiksel Yardımcı Sınıfı
 */
export class Engine {
    
    /**
     * Değeri minimum ve maksimum sınırlar arasında kilitler.
     * @param {number} val - Giriş değeri
     * @param {number} min - Minimum sınır
     * @param {number} max - Maksimum sınır
     */
    static clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    /**
     * Lineer İnterpolasyon (Yumuşak Değer Geçişi)
     * Sağlık barı akışları ve kamera yumuşatma işlemleri için kullanılır.
     */
    static lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    /**
     * Pencere üzerindeki (tarayıcı) tıklama/dokunma koordinatlarını,
     * ölçekleme ve kayma (offset) paylarını hesaba katarak 1280x720 sanal düzlemine çevirir.
     */
    static windowToCanvas(windowX, windowY, game) {
        const x = (windowX - game.offsetX) / game.scaleX;
        const y = (windowY - game.offsetY) / game.scaleY;
        return { x, y };
    }

    /**
     * 1. AABB (Axis-Aligned Bounding Box) Çarpışma Testi
     * İki dikdörtgen kutunun üst üste binip binmediğini kontrol eder. (Karakter-Projektil)
     */
    static rectCollision(rx1, ry1, rw1, rh1, rx2, ry2, rw2, rh2) {
        return rx1 < rx2 + rw2 &&
               rx1 + rw1 > rx2 &&
               ry1 < ry2 + rh2 &&
               ry1 + rh1 > ry2;
    }

    /**
     * 2. Dairesel ve Dikdörtgensel Çarpışma Testi
     * Confringo'nun dairesel patlama alanının, karakterin dikdörtgen Hurtbox alanına
     * etki edip etmediğini ölçmek amacıyla tasarlanmıştır.
     */
    static circleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
        // Dikdörtgenin daire merkezine en yakın olan noktasını bul
        const closestX = Math.max(rx, Math.min(cx, rx + rw));
        const closestY = Math.max(ry, Math.min(cy, ry + rh));

        // En yakın nokta ile daire merkezi arasındaki mesafeyi hesapla
        const distanceX = cx - closestX;
        const distanceY = cy - closestY;
        
        // Mesafe, yarıçaptan küçükse çarpışma gerçekleşmiştir
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
        return distanceSquared < (radius * radius);
    }

    /**
     * Gelişmiş Özelleştirilmiş Çizim Fonksiyonu (Anchor Point Destekli)
     * Karakterlerin ve büyülerin konum, rotasyon, opaklık ve yön (horizontal flip)
     * parametrelerini tek bir matris dönüşüm işleminde çizer.
     * 
     * @param {CanvasRenderingContext2D} ctx - Çizim yapılacak canvas context'i
     * @param {HTMLImageElement} img - Çizilecek görsel nesnesi
     * @param {number} x - Çizim merkez/taban X koordinatı
     * @param {number} y - Çizim merkez/taban Y koordinatı
     * @param {number} width - Çizim genişliği
     * @param {number} height - Çizim yüksekliği
     * @param {number} angle - Dönüş açısı (radyan)
     * @param {number} alpha - Opaklık (0 - 1)
     * @param {boolean} flipX - Yatay olarak ters çevrilsin mi?
     * @param {number} anchorX - Yatay hizalama oranı (0: Sol, 0.5: Orta, 1: Sağ)
     * @param {number} anchorY - Dikey hizalama oranı (0: Üst, 0.5: Orta, 1: Taban)
     */
    static drawRotatedImage(ctx, img, x, y, width, height, angle = 0, alpha = 1, flipX = false, anchorX = 0.5, anchorY = 0.5) {
        if (!img || img.width === 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Matrisi çizim noktasına ötele
        ctx.translate(x, y);

        // Yatay yön dönüşünü (Mirror) uygula
        if (flipX) {
            ctx.scale(-1, 1);
        }

        // Dönüş açısını (Radyan) uygula
        if (angle !== 0) {
            ctx.rotate(angle);
        }

        // Çapa noktasına (Anchor Point) göre ofsetleri hesapla
        const dx = -width * anchorX;
        const dy = -height * anchorY;

        ctx.drawImage(img, dx, dy, width, height);
        ctx.restore();
    }

    /**
     * Büyü Işınlarını ve Yıldırımları Çizme ve Uzatma Yardımcısı
     * İki koordinat noktası arasına (Asa ucu -> Hedef) bir görseli açılı olarak
     * gerer ve sığdırır. (Avada Kedavra, Expelliarmus ve Incendio bu algoritmayı kullanır).
     */
    static drawStretchedBeam(ctx, img, startX, startY, endX, endY, beamHeight, alpha = 1, scaleY = 1) {
        if (!img || img.width === 0) return;

        const distance = Vector2.distance(startX, startY, endX, endY);
        const angle = Vector2.angleBetween(startX, startY, endX, endY);

        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Işının başlangıç asası ucuna matrisi kilitle
        ctx.translate(startX, startY);
        ctx.rotate(angle);

        // Genişlik olarak iki nokta arasındaki mesafeyi, yükseklik olarak büyü kalınlığını uygula
        const dy = -(beamHeight * scaleY) / 2;
        ctx.drawImage(img, 0, dy, distance, beamHeight * scaleY);

        ctx.restore();
    }

    /**
     * İki renk arasında yumuşak geçiş hesaplar (Parçacıkların küle dönüşmesi için).
     */
    static interpolateColor(color1, color2, factor) {
        const r = Math.round(color1.r + (color2.r - color1.r) * factor);
        const g = Math.round(color1.g + (color2.g - color1.g) * factor);
        const b = Math.round(color1.b + (color2.b - color1.b) * factor);
        return `rgb(${r},${g},${b})`;
    }
}

/**
 * Özelleştirilmiş Görsel Parçacık Sınıfı (Particle Effects)
 * Büyü patlamalarında, kalkan darbelerinde ve yanma durumlarında oluşan
 * parçacıkları yönetir.
 */
export class EngineParticle {
    /**
     * @param {number} x - Başlangıç X koordinatı
     * @param {number} y - Başlangıç Y koordinatı
     * @param {object} colorRGB - {r, g, b} formatında başlangıç rengi
     * @param {object} endColorRGB - {r, g, b} formatında yok olma rengi
     * @param {number} size - Parçacık piksel çapı
     * @param {number} vx - Yatay hız ivmesi
     * @param {number} vy - Dikey hız ivmesi
     * @param {number} life - Ömür süresi (saniye cinsinden)
     * @param {number} gravity - Yerçekiminden etkilenme çarpanı
     */
    constructor(x, y, colorRGB, endColorRGB, size, vx, vy, life = 1.0, gravity = 0) {
        this.x = x;
        this.y = y;
        this.colorRGB = colorRGB;
        this.endColorRGB = endColorRGB;
        this.size = size;
        this.vx = vx;
        this.vy = vy;
        this.maxLife = life;
        this.life = life;
        this.gravity = gravity;
    }

    /**
     * Delta time ile uyumlu fizik güncellemesi.
     */
    update(dt) {
        this.vy += this.gravity * dt; // yerçekimi ivmesi ekle
        this.x += this.vx * 60 * dt;  // saniyede 60 kare standart referanslı hareket
        this.y += this.vy * 60 * dt;
        this.life -= dt;
    }

    /**
     * Parçacığı ekrana çizer. Ömrü azaldıkça rengi soluklaşır ve yok olma rengine yaklaşır.
     */
    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        const factor = 1 - (this.life / this.maxLife);
        ctx.fillStyle = Engine.interpolateColor(this.colorRGB, this.endColorRGB, factor);
        ctx.globalAlpha = Engine.clamp(this.life / this.maxLife, 0, 1);
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * Farklı büyü patlamaları için özelleştirilmiş parçacık tetikleyicileri.
 */
export class ParticleFactory {
    /**
     * Confringo veya dairesel patlamalar için ateş parçacıkları saçar.
     */
    static spawnFireExplosion(x, y, count = 20) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = 3 + Math.random() * 5;
            const life = 0.5 + Math.random() * 0.7;

            particles.push(new EngineParticle(
                x, y, 
                { r: 255, g: 150, b: 0 },   // Turuncu
                { r: 40, g: 40, b: 40 },    // Kül Grisi
                size, vx, vy, life, 0.2
            ));
        }
    }

    /**
     * Protego kalkanına çarpan büyüler için mavi büyü parıltıları fışkırtır.
     */
    static spawnShieldDeflect(x, y, directionX, count = 15) {
        for (let i = 0; i < count; i++) {
            // Çarpan büyünün ters yönüne doğru yay şeklinde fışkırt
            const angle = (directionX > 0 ? 0 : Math.PI) + (Math.random() * 1.2 - 0.6);
            const speed = 3 + Math.random() * 6;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - (1 + Math.random() * 2);
            const size = 2 + Math.random() * 3;
            const life = 0.3 + Math.random() * 0.5;

            particles.push(new EngineParticle(
                x, y,
                { r: 50, g: 150, b: 255 },  // Parlak Mavi
                { r: 10, g: 30, b: 80 },    // Koyu Lacivert
                size, vx, vy, life, 0.1
            ));
        }
    }

    /**
     * Crucio işkencesi esnasında hedefin etrafında dönen mor acı parçacıkları oluşturur.
     */
    static spawnCrucioPain(x, y, count = 4) {
        for (let i = 0; i < count; i++) {
            const vx = (Math.random() * 2 - 1) * 2;
            const vy = -(1 + Math.random() * 3);
            const size = 2 + Math.random() * 2;
            const life = 0.4 + Math.random() * 0.4;

            particles.push(new EngineParticle(
                x, y,
                { r: 180, g: 50, b: 240 },  // Parlak Mor
                { r: 30, g: 5, b: 50 },     // Siyahımsı Mor
                size, vx, vy, life, -0.05   // Yerçekimi ters (yukarı yükselir)
            ));
        }
    }

    /**
     * Expelliarmus isabet ettiğinde yayılan büyü enerjisi parçacıkları.
     */
    static spawnStunSparkles(x, y, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 4;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = 2 + Math.random() * 2;
            const life = 0.6 + Math.random() * 0.6;

            particles.push(new EngineParticle(
                x, y,
                { r: 255, g: 50, b: 150 },  // Magenta/Pembe
                { r: 50, g: 0, b: 50 },     // Koyu Mor
                size, vx, vy, life, 0
            ));
        }
    }
}
