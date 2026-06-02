/**
 * ============================================================================
 * HOGWARTS DUEL - CORE COORDINATOR & GAME ENGINE ORCHESTRATOR
 * ============================================================================
 * Bu dosya, oyunun merkezi işlem birimidir. Oyun durum makinelerini (FSM),
 * delta-time tabanlı oyun döngüsünü, görsel ölçeklendirmeyi, varlık (asset)
 * yükleme süreçlerini ve diğer tüm alt modüllerin (Fizik, Yapay Zeka, Ses,
 * Girdi, Çizim) koordinasyonunu yönetir.
 * 
 * Modüler Mimari Tasarımı (ES6):
 * - Alt sınıflar ve yöneticiler kendi dosyalarından yüklenir.
 * - Çizim ve fizik güncellemeleri ekran kartının yenilenme hızından bağımsızdır.
 * - Tüm koordinasyon 1280x720 sanal çözünürlük düzleminde hesaplanır.
 */

// Alt Modüllerin İçe Aktarılması
import { Engine } from './engine.js';
import { InputHandler } from './input.js';
import { Character } from './character.js';
import { SpellManager } from './spell.js';
import { AIManager } from './ai.js';
import { AudioController } from './audio.js';

/**
 * Oyun Ayarları ve Sabitler Konfigürasyonu
 */
const CONFIG = {
    VIRTUAL_WIDTH: 1280,   // Oyunun matematiksel genişliği (16:9)
    VIRTUAL_HEIGHT: 720,   // Oyunun matematiksel yüksekliği (16:9)
    MAX_DELTA_TIME: 0.1,   // Sekme/ donma anlarında fiziğin sapmaması için maksimum dt sınırı (saniye)
    ROUND_DURATION: 99,    // Raunt süresi (saniye)
    GRAVITY: 0.8,          // Evrensel yerçekimi sabiti
    FLOOR_Y: 600           // Karakterlerin ayak basacağı zemin yüksekliği
};

/**
 * Oyun Durumları (Game State Machine Enum)
 */
const GAME_STATES = {
    LOADING: 'LOADING',
    MENU: 'MENU',
    CHARACTER_SELECT: 'CHARACTER_SELECT',
    PLAYING: 'PLAYING',
    ROUND_OVER: 'ROUND_OVER',
    GAME_OVER: 'GAME_OVER',
    PAUSED: 'PAUSED'
};

class GameOrchestrator {
    constructor() {
        // HTML Canvas Kurulumu
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            // Canvas elementi DOM'da yoksa dinamik olarak oluştur
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'gameCanvas';
            document.getElementById('game-container').appendChild(this.canvas);
        }
        this.ctx = this.canvas.getContext('2d');

        // Oyun Durumu Başlangıcı
        this.currentState = GAME_STATES.LOADING;

        // Zamanlayıcı Değişkenleri (Delta Time Hesaplamaları)
        this.lastTime = 0;
        this.accumulatedTime = 0;
        this.roundTimer = CONFIG.ROUND_DURATION;
        this.roundTimeMs = 0; // Raunt süresi milisaniye takibi

        // Görsel Ölçeklendirme ve Letterboxing Bilgileri
        this.scaleX = 1;
        this.scaleY = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        // Kamera Sarsıntı (Screen Shake) Motoru Değişkenleri
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeX = 0;
        this.shakeY = 0;

        // Alt Modül Örnekleri (Instances)
        this.audio = new AudioController();
        this.input = new InputHandler(this);
        this.spells = new SpellManager(this);
        this.ai = new AIManager(this);

        // Karakter ve Raunt Bilgileri
        this.playerCharacterType = 'voldemort'; // Varsayılan seçim
        this.p1 = null; // Oyuncu
        this.p2 = null; // Yapay Zeka
        this.p1Score = 0;
        this.p2Score = 0;
        this.currentRound = 1;

        // Yumuşak Geçişli (Lerp) HUD Barları İçin Hedef Değerler
        this.p1DisplayHp = 100;
        this.p2DisplayHp = 100;
        this.p1DisplayMana = 100;
        this.p2DisplayMana = 100;

        // Yüklenecek Görsellerin Listesi ve Yollarının Tanımlanması
        this.assets = {
            images: {},
            loadedCount: 0,
            totalCount: 0
        };

        this.assetManifest = {
            // Arka Plan
            bg: 'arkaplan.png',
            
            // Kalkan ve Kan Efektleri
            protego: 'protego.png',
            blood: 'sectumsemprablood.png',

            // Büyü Efektleri (Projektiller ve Işınlar)
            avadakedavra: 'avadakedavra.png',
            expelliarmus: 'expelliarmus.png',
            crucio: 'crucio.png',
            sectumsempra: 'sectumsempra.png',
            confringo1: 'confringo1.png',
            confringo2: 'confringo2.png',
            confringo3: 'confringo3.png',
            confringo4: 'confringo4.png',
            incendio1: 'incendio1.png',
            incendio2: 'incendio2.png',
            incendio3: 'incendio3.png',

            // Voldemort Animasyon Kareleri
            voldemortstand: 'voldemortstand.png',
            voldemortattack1: 'voldemortattack1.png',
            voldemortattack2: 'voldemortattack2.png',
            voldemortattack3: 'voldemortattack3.png',
            voldemortwalk1: 'voldemortwalk1.png',
            voldemortwalk2: 'voldemortwalk2.png',
            voldemortwalk3: 'voldemortwalk3.png',
            voldemortwalk4: 'voldemortwalk4.png',
            voldemortwalk5: 'voldemortwalk5.png',
            voldemortwalk6: 'voldemortwalk6.png',
            voldemortwalk7: 'voldemortwalk7.png',

            // Morgan Animasyon Kareleri
            morganstand: 'morganstand.png',
            morganattack1: 'morganattack1.png',
            morganattack2: 'morganattack2.png',
            morganattack3: 'morganattack3.png',
            morganwalk1: 'morganwalk1.png',
            morganwalk2: 'morganwalk2.png',
            morganwalk3: 'morganwalk3.png',
            morganwalk4: 'morganwalk4.png',
            morganwalk5: 'morganwalk5.png',
            morganwalk6: 'morganwalk6.png',
            morganwalk7: 'morganwalk7.png'
        };

        // Başlatma Rutini
        this.init();
    }

    /**
     * Motorun ilk kurulum adımlarını yönetir.
     */
    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Event Dinleyicilerini Kur (Klavye, dokunmatik, vb.)
        this.input.bindEvents();

        // Görsel Varlıkları Yüklemeye Başla
        this.preloadAssets();
    }

    /**
     * Ekran çözünürlüğü değişimlerinde en-boy oranını (16:9) koruyarak Canvas'ı
     * ölçekler ve ortalar (Letterboxing ve Pillarboxing tekniği).
     */
    resizeCanvas() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Tarayıcı penceresinin oranını bul
        const windowRatio = windowWidth / windowHeight;
        const virtualRatio = CONFIG.VIRTUAL_WIDTH / CONFIG.VIRTUAL_HEIGHT;

        let canvasWidth, canvasHeight;

        if (windowRatio > virtualRatio) {
            // Pencere çok genişse (Yandan siyah barlar eklenecek - Pillarboxing)
            canvasHeight = windowHeight;
            canvasWidth = canvasHeight * virtualRatio;
            this.offsetX = (windowWidth - canvasWidth) / 2;
            this.offsetY = 0;
        } else {
            // Pencere çok dikeyse (Üstten/alttan siyah barlar eklenecek - Letterboxing)
            canvasWidth = windowWidth;
            canvasHeight = canvasWidth / virtualRatio;
            this.offsetX = 0;
            this.offsetY = (windowHeight - canvasHeight) / 2;
        }

        // CSS boyutlandırmalarını uygula
        this.canvas.style.position = 'absolute';
        this.canvas.style.width = `${canvasWidth}px`;
        this.canvas.style.height = `${canvasHeight}px`;
        this.canvas.style.left = `${this.offsetX}px`;
        this.canvas.style.top = `${this.offsetY}px`;

        // Canvas'ın dahili çözünürlüğünü sanal piksel boyutuna kilitle
        this.canvas.width = CONFIG.VIRTUAL_WIDTH;
        this.canvas.height = CONFIG.VIRTUAL_HEIGHT;

        // Tıklama koordinat dönüşümleri için ölçek çarpanlarını sakla
        this.scaleX = canvasWidth / CONFIG.VIRTUAL_WIDTH;
        this.scaleY = canvasHeight / CONFIG.VIRTUAL_HEIGHT;
    }

    /**
     * Manifest dosyasındaki tüm görselleri önbelleğe yükler ve ilerlemeyi takip eder.
     */
    preloadAssets() {
        const keys = Object.keys(this.assetManifest);
        this.assets.totalCount = keys.length;

        if (this.assets.totalCount === 0) {
            this.onAssetsLoaded();
            return;
        }

        keys.forEach(key => {
            const img = new Image();
            img.src = this.assetManifest[key];
            img.onload = () => {
                this.assets.images[key] = img;
                this.assets.loadedCount++;
                
                // Yüklenme yüzdesini çiz (Loading Screen)
                this.renderLoadingProgress();

                if (this.assets.loadedCount === this.assets.totalCount) {
                    this.onAssetsLoaded();
                }
            };
            img.onerror = () => {
                console.error(`Görsel yüklenemedi: ${this.assetManifest[key]}`);
                // Hata durumunda da akışın tıkanmaması için yüklenmiş gibi sayıp devam et
                this.assets.loadedCount++;
                if (this.assets.loadedCount === this.assets.totalCount) {
                    this.onAssetsLoaded();
                }
            };
        });
    }

    /**
     * Yükleme ekranındaki ilerleme çubuğunu çizer.
     */
    renderLoadingProgress() {
        this.ctx.fillStyle = '#0c0f12';
        this.ctx.fillRect(0, 0, CONFIG.VIRTUAL_WIDTH, CONFIG.VIRTUAL_HEIGHT);

        const percent = Math.floor((this.assets.loadedCount / this.assets.totalCount) * 100);
        
        // Dekoratif Büyücü Simgesi & Metin
        this.ctx.fillStyle = '#d4af37';
        this.ctx.font = 'bold 36px Cinzel, Georgia, serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('HOGWARTS DUELLOSU', CONFIG.VIRTUAL_WIDTH / 2, CONFIG.VIRTUAL_HEIGHT / 2 - 50);

        this.ctx.font = '16px monospace';
        this.ctx.fillStyle = '#8a94a6';
        this.ctx.fillText(`Asalar Hazırlanıyor... %${percent}`, CONFIG.VIRTUAL_WIDTH / 2, CONFIG.VIRTUAL_HEIGHT / 2 + 10);

        // İlerleme Çubuğu Çerçevesi
        const barW = 400;
        const barH = 14;
        const barX = (CONFIG.VIRTUAL_WIDTH - barW) / 2;
        const barY = CONFIG.VIRTUAL_HEIGHT / 2 + 30;

        this.ctx.strokeStyle = '#2d3545';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barW, barH);

        // Dolgu Alanı
        this.ctx.fillStyle = '#d4af37';
        this.ctx.fillRect(barX + 2, barY + 2, (barW - 4) * (percent / 100), barH - 4);
    }

    /**
     * Tüm görseller yüklendiğinde tetiklenir.
     */
    onAssetsLoaded() {
        // UI'daki görsel kaynaklarını güncelle
        document.getElementById('card-voldemort').querySelector('img').src = this.assetManifest.voldemortstand;
        document.getElementById('card-morgan').querySelector('img').src = this.assetManifest.morganstand;

        // Durumu Karakter Seçim Menüsüne Geçir
        this.currentState = GAME_STATES.CHARACTER_SELECT;
        
        // Ana Döngüyü Başlat (Delta Time hesaplayıcısının sıfırlanmasıyla birlikte)
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }

    /**
     * Oyuncu karakter seçimini tamamlayıp savaşı başlattığında tetiklenir.
     */
    startDuel(selectedType) {
        this.playerCharacterType = selectedType;
        this.currentRound = 1;
        this.p1Score = 0;
        this.p2Score = 0;

        this.initRound();

        this.currentState = GAME_STATES.PLAYING;
    }

    /**
     * Belirli bir raundu (ilk başlangıç veya raunt geçişlerinde) sıfırlar ve konumlandırır.
     */
    initRound() {
        // Kanalize büyü seslerini kes
        this.audio.stopFlame();

        // Karakter Nesnelerini Oluştur
        if (this.playerCharacterType === 'voldemort') {
            this.p1 = new Character('voldemort', true, 200, this, CONFIG);
            this.p2 = new Character('morgan', false, 1080, this, CONFIG);
        } else {
            this.p1 = new Character('morgan', true, 200, this, CONFIG);
            this.p2 = new Character('voldemort', false, 1080, this, CONFIG);
        }

        // HUD Gösterge Değerlerini Sıfırla
        this.p1DisplayHp = 100;
        this.p2DisplayHp = 100;
        this.p1DisplayMana = 100;
        this.p2DisplayMana = 100;

        // Zamanlayıcıyı ve Entitileri Sıfırla
        this.roundTimer = CONFIG.ROUND_DURATION;
        this.roundTimeMs = 0;
        this.spells.clearAll();
        particles.length = 0;

        // Raunt Başlangıç Sesi
        this.audio.playLightning();
    }

    /**
     * Kamera sarsıntı motorunu tetikleyen fonksiyon.
     * Büyü patlamalarında ve ağır darbelerde çağrılır.
     * 
     * @param {number} intensity - Sarsıntı gücü (piksel cinsinden kayma genliği)
     * @param {number} duration - Sarsıntı süresi (saniye cinsinden)
     */
    triggerScreenShake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }

    /**
     * Gelişmiş Delta Time tabanlı ana oyun döngüsü.
     * Ekranın Hz değerinden bağımsız, sabit hızlı fizik adımları sağlar.
     */
    gameLoop(timestamp) {
        // İlk karede gecikme olmaması için başlangıç zamanını sabitle
        if (!this.lastTime) {
            this.lastTime = timestamp;
        }

        // Geçen süreyi saniye cinsinden hesapla
        let deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Tarayıcı sekmeyi arka plana aldığında veya donma yaşandığında fiziğin uçmaması için sınırla
        if (deltaTime > CONFIG.MAX_DELTA_TIME) {
            deltaTime = CONFIG.MAX_DELTA_TIME;
        }

        // Güncelleme adımlarını çalıştır
        this.update(deltaTime);

        // Ekranı Çiz
        this.render();

        // Bir sonraki kareyi talep et
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    /**
     * Matematiksel güncellemeleri ve fizik simülasyonunu yönetir.
     * @param {number} dt - Bir önceki kareden bu yana geçen süre (saniye)
     */
    update(dt) {
        // Kamera Sarsıntısı Güncelleme Hesabı
        if (this.shakeDuration > 0) {
            this.shakeDuration -= dt;
            this.shakeX = (Math.random() * 2 - 1) * this.shakeIntensity;
            this.shakeY = (Math.random() * 2 - 1) * this.shakeIntensity;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }

        // Aktif oyun oynanma durumu dışındaki senaryolarda fiziği çalıştırma
        if (this.currentState !== GAME_STATES.PLAYING) {
            return;
        }

        // Raunt Zaman Takibi
        this.roundTimeMs += dt * 1000;
        if (this.roundTimeMs >= 1000) {
            this.roundTimer = Math.max(0, this.roundTimer - 1);
            this.roundTimeMs -= 1000;

            // Zaman dolduğunda raundu bitir
            if (this.roundTimer === 0) {
                this.handleRoundEnd(true); // Zaman bitti
            }
        }

        // Oyuncu Girdi Güncellemesi
        this.input.updatePlayerMovement(this.p1);

        // Karakterlerin Güncellenmesi (Fizik ve Çarpışmalar)
        this.p1.update(dt, this.p2);
        this.p2.update(dt, this.p1);

        // Yapay Zeka Güncellemesi (Zor Taktiksel Yapay Zeka)
        this.ai.update(dt, this.p2, this.p1);

        // Büyü/Projektil Güncellemeleri
        this.spells.update(dt, this.p1, this.p2);

        // Parçacık (Visual Particles) Efektlerinin Güncellenmesi
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update(dt);
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        // HUD Barlarının Yumuşak Akış (Lerp) interpolasyonu
        // Gösterge canı, gerçek can değerine saniyede %10 yaklaşacak şekilde kayar
        const lerpFactor = 10 * dt;
        this.p1DisplayHp += (this.p1.hp - this.p1DisplayHp) * lerpFactor;
        this.p2DisplayHp += (this.p2.hp - this.p2DisplayHp) * lerpFactor;
        
        // Mana göstergeleri de aynı şekilde yumuşak geçiş yapar
        this.p1DisplayMana += (this.p1.mana - this.p1DisplayMana) * lerpFactor;
        this.p2DisplayMana += (this.p2.mana - this.p2DisplayMana) * lerpFactor;

        // Karakterlerden birinin canı sıfırlanırsa raundu bitir
        if (this.p1.hp <= 0 || this.p2.hp <= 0) {
            this.handleRoundEnd(false);
        }
    }

    /**
     * Raunt sona erdiğinde kazananı belirler ve puan tablosunu günceller.
     * @param {boolean} isTimeOut - Raunt süresinin dolup dolmadığı bilgisi
     */
    handleRoundEnd(isTimeOut) {
        this.currentState = GAME_STATES.ROUND_OVER;
        this.audio.stopFlame();

        let winner = null;

        if (isTimeOut) {
            // Zaman bittiğinde canı fazla olan kazanır
            if (this.p1.hp > this.p2.hp) {
                winner = this.p1;
                this.p1Score++;
            } else if (this.p2.hp > this.p1.hp) {
                winner = this.p2;
                this.p2Score++;
            }
        } else {
            // Canı sıfırlanmayan kazanır
            if (this.p1.hp > 0) {
                winner = this.p1;
                this.p1Score++;
            } else {
                winner = this.p2;
                this.p2Score++;
            }
        }

        // Galibiyet Yazısı Söyle
        if (winner) {
            winner.say("Zafer benim!");
        }

        // 3 saniye sonra yeni raunda geç veya oyunu tamamen bitir
        setTimeout(() => {
            if (this.p1Score >= 2 || this.p2Score >= 2) {
                this.currentState = GAME_STATES.GAME_OVER;
                document.getElementById('game-over-screen').style.display = 'flex';
                const gameOverText = document.getElementById('game-over-text');
                if (this.p1Score >= 2) {
                    gameOverText.innerText = "DÜELLO KAZANILDI!";
                    gameOverText.style.color = '#d4af37';
                } else {
                    gameOverText.innerText = "DÜELLO KAYBEDİLDİ";
                    gameOverText.style.color = '#ff3333';
                }
            } else {
                this.currentRound++;
                this.initRound();
                this.currentState = GAME_STATES.PLAYING;
            }
        }, 3000);
    }

    /**
     * Görsel render katmanı. Tüm çizim koordinasyonunu sağlar.
     */
    render() {
        this.ctx.save();

        // 1. Ekranı ve birikmiş pikselleri temizle
        this.ctx.clearRect(0, 0, CONFIG.VIRTUAL_WIDTH, CONFIG.VIRTUAL_HEIGHT);

        // 2. Kamera Sarsıntısı (Screen Shake) ötelemesini uygula
        if (this.shakeIntensity > 0) {
            this.ctx.translate(this.shakeX, this.shakeY);
        }

        // 3. Arka Planı Çiz
        if (this.assets.images.bg) {
            this.ctx.drawImage(this.assets.images.bg, 0, 0, CONFIG.VIRTUAL_WIDTH, CONFIG.VIRTUAL_HEIGHT);
        } else {
            this.ctx.fillStyle = '#111318';
            this.ctx.fillRect(0, 0, CONFIG.VIRTUAL_WIDTH, CONFIG.VIRTUAL_HEIGHT);
        }

        // Karakterler ve Büyüler sadece aktif oyun veya raunt sonlarında çizilir
        if (this.currentState === GAME_STATES.PLAYING || this.currentState === GAME_STATES.ROUND_OVER) {
            // 4. Büyülerin ve Efektlerin Çizilmesi
            this.spells.draw(this.ctx);

            // 5. Karakterlerin Çizilmesi (P1 ve P2)
            if (this.p1) this.p1.draw(this.ctx);
            if (this.p2) this.p2.draw(this.ctx);

            // 6. Parçacık Efektlerinin Çizilmesi
            for (let i = 0; i < particles.length; i++) {
                particles[i].draw(this.ctx);
            }

            // 7. Arayüz ve HUD Göstergelerinin Çizilmesi
            this.drawHUD();
        }

        // Raunt Sonu Mesajı Ekranı
        if (this.currentState === GAME_STATES.ROUND_OVER) {
            this.drawRoundOverScreen();
        }

        this.ctx.restore();
    }

    /**
     * Gelişmiş HUD Çizim Katmanı. Can, Mana ve Ulti barlarını ekrana basar.
     */
    drawHUD() {
        // SOL TARAF: Oyuncu (P1) HUD
        this.drawBar(50, 40, 320, 22, this.p1DisplayHp / 100, '#ff3333', '#4a0d0d', 'CAN');
        this.drawBar(50, 70, 240, 12, this.p1DisplayMana / 100, '#3399ff', '#0d284a', 'MANA');
        this.drawBar(50, 90, 240, 8, this.p1.ultCharge / 100, '#ffcc00', '#4a3c0d', 'ULTI');

        this.ctx.save();
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 22px Cinzel, serif';
        this.ctx.fillText(this.p1.type.toUpperCase() + ' (SEN)', 50, 30);
        this.ctx.restore();

        // SAĞ TARAF: Yapay Zeka (P2) HUD
        this.drawBar(910, 40, 320, 22, this.p2DisplayHp / 100, '#ff3333', '#4a0d0d', 'CAN', true);
        this.drawBar(990, 70, 240, 12, this.p2DisplayMana / 100, '#3399ff', '#0d284a', 'MANA', true);
        this.drawBar(990, 90, 240, 8, this.p2.ultCharge / 100, '#ffcc00', '#4a3c0d', 'ULTI', true);

        this.ctx.save();
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 22px Cinzel, serif';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(this.p2.type.toUpperCase() + ' (AI)', CONFIG.VIRTUAL_WIDTH - 50, 30);
        this.ctx.restore();

        // MERKEZ HUD: Raunt Sayacı ve Süre
        this.drawCenterHUD();
    }

    /**
     * HUD barlarını ölçekleyip kenarlıkları ve isimleriyle çizer.
     */
    drawBar(x, y, w, h, pct, fgColor, bgColor, label, alignRight = false) {
        this.ctx.save();
        
        let drawX = x;
        if (alignRight) {
            drawX = CONFIG.VIRTUAL_WIDTH - x - w;
        }

        // Arka Plan Dolgusu
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(drawX, y, w, h);

        // Aktif Dolgu Alanı (Minimum 0 sınırıyla sınırla)
        const activeWidth = Math.max(0, w * Math.min(1, pct));
        this.ctx.fillStyle = fgColor;
        this.ctx.fillRect(drawX, y, activeWidth, h);

        // Metalik Çerçeve Kenarlığı
        this.ctx.strokeStyle = '#2d3545';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(drawX, y, w, h);

        // Küçük Bar Etiketi
        this.ctx.fillStyle = '#8a94a6';
        this.ctx.font = 'bold 10px monospace';
        this.ctx.textBaseline = 'middle';
        
        if (alignRight) {
            this.ctx.textAlign = 'right';
            this.ctx.fillText(label, drawX - 10, y + h / 2);
        } else {
            this.ctx.textAlign = 'left';
            this.ctx.fillText(label, drawX + w + 10, y + h / 2);
        }

        this.ctx.restore();
    }

    /**
     * Ekranın tam ortasında duran süreyi, raunt sayısını ve skor boncuklarını çizer.
     */
    drawCenterHUD() {
        this.ctx.save();

        // Arka Fon Paneli
        const panelW = 120;
        const panelH = 70;
        const panelX = (CONFIG.VIRTUAL_WIDTH - panelW) / 2;
        const panelY = 20;

        this.ctx.fillStyle = 'rgba(12, 15, 18, 0.85)';
        this.ctx.strokeStyle = '#d4af37';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.roundRect(panelX, panelY, panelW, panelH, 6);
        this.ctx.fill();
        this.ctx.stroke();

        // Kalan Süre Metni
        this.ctx.fillStyle = this.roundTimer <= 10 ? '#ff3333' : '#fff'; // Son 10 saniye kırmızı
        this.ctx.font = 'bold 32px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.roundTimer.toString().padStart(2, '0'), CONFIG.VIRTUAL_WIDTH / 2, panelY + 32);

        // Raunt Sayısı Bilgisi
        this.ctx.fillStyle = '#8a94a6';
        this.ctx.font = 'bold 11px Cinzel, serif';
        this.ctx.fillText(`RAUNT ${this.currentRound}`, CONFIG.VIRTUAL_WIDTH / 2, panelY + 48);

        // Skor Boncuklarının (Rounds Won) Çizilmesi
        const drawScoreDots = (score, startX, direction) => {
            const dotRadius = 5;
            const gap = 14;
            for (let i = 0; i < 2; i++) {
                this.ctx.beginPath();
                this.ctx.arc(startX + i * gap * direction, panelY + 60, dotRadius, 0, Math.PI * 2);
                if (i < score) {
                    this.ctx.fillStyle = '#d4af37'; // Kazanılmış raunt
                } else {
                    this.ctx.fillStyle = '#2d3545'; // Boş raunt boncuğu
                }
                this.ctx.fill();
                this.ctx.strokeStyle = '#0c0f12';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }
        };

        // Sol Oyuncu Skor Boncukları (Sola doğru dizilir)
        drawScoreDots(this.p1Score, CONFIG.VIRTUAL_WIDTH / 2 - 15, -1);
        // Sağ Yapay Zeka Skor Boncukları (Sağa doğru dizilir)
        drawScoreDots(this.p2Score, CONFIG.VIRTUAL_WIDTH / 2 + 15, 1);

        this.ctx.restore();
    }

    /**
     * Raunt bittiğinde ekranın ortasında parlayan "K.O." veya "SÜRE BİTTİ" yazısını çizer.
     */
    drawRoundOverScreen() {
        this.ctx.save();
        
        // Ekran karartma filtresi
        this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
        this.ctx.fillRect(0, 0, CONFIG.VIRTUAL_WIDTH, CONFIG.VIRTUAL_HEIGHT);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Durum Metni (K.O. / SÜRE BİTTİ)
        let mainText = "K.O.";
        let mainColor = '#ff3333';

        if (this.roundTimer === 0 && this.p1.hp > 0 && this.p2.hp > 0) {
            mainText = "SÜRE BİTTİ";
            mainColor = '#ffcc00';
        }

        this.ctx.fillStyle = mainColor;
        this.ctx.font = 'bold 90px Cinzel, Georgia, serif';
        this.ctx.shadowColor = mainColor;
        this.ctx.shadowBlur = 25;
        this.ctx.fillText(mainText, CONFIG.VIRTUAL_WIDTH / 2, CONFIG.VIRTUAL_HEIGHT / 2 - 30);

        // Raunt Sonu Kazananının İsmini Yazdır
        let winSubText = "BERABERE";
        if (this.p1.hp > this.p2.hp) {
            winSubText = `${this.p1.type.toUpperCase()} RAUNDU KAZANDI`;
        } else if (this.p2.hp > this.p1.hp) {
            winSubText = `${this.p2.type.toUpperCase()} RAUNDU KAZANDI`;
        }

        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 24px Cinzel, serif';
        this.ctx.shadowBlur = 0;
        this.ctx.fillText(winSubText, CONFIG.VIRTUAL_WIDTH / 2, CONFIG.VIRTUAL_HEIGHT / 2 + 50);

        this.ctx.restore();
    }
}

// --- GLOBAL AKTİF PARÇACIK HAVUZU ---
export const particles = [];

// Oyun motoru nesnesini başlat ve dışa aktar
export const game = new GameOrchestrator();
