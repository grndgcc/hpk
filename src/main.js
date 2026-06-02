/**
 * ============================================================================
 * HOGWARTS DUEL - CORE COORDINATOR & GAME ENGINE ORCHESTRATOR (PART 1)
 * ============================================================================
 * Bu dosya, oyunun merkezi işlem birimidir. Oyun durum makinelerini (FSM),
 * delta-time tabanlı oyun döngüsünü, görsel ölçeklendirmeyi, varlık (asset)
 * yükleme süreçlerini ve diğer tüm alt modüllerin (Fizik, Yapay Zeka, Ses,
 * Girdi, Çizim) koordinasyonunu yönetir.
 * 
 * Bu dosya, boyut sınırlarını aşmamak amacıyla iki aşamada sunulmaktadır.
 * Birinci kısım; import şemalarını, ön yükleme (preload) algoritmalarını ve
 * ekran sığdırma/ölçeklendirme matematiklerini içermektedir.
 */

// Alt Modüllerin İçe Aktarılması
import { Engine, particles } from './engine.js';
import { InputHandler } from './input.js';
import { Character } from './character.js';
import { SpellManager, Projectile } from './spell.js';
import { AIManager } from './ai.js';
import { AudioController } from './audio.js';

/**
 * Oyun Ayarları ve Sabitler Konfigürasyonu
 * 16:9 sanal düzlem ve yerçekimi değerleri burada belirlenir.
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
 * Savaşın hangi aşamada olduğunu takip eden durum yapısı.
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

/**
 * Ana Oyun Koordinatörü Sınıfı
 * Tüm alt yöneticileri bünyesinde barındırır ve tek bir merkezi çatı altında işletir.
 */
class GameOrchestrator {
    constructor() {
        // HTML Canvas Kurulumu
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'gameCanvas';
            document.getElementById('game-container').appendChild(this.canvas);
        }
        this.ctx = this.canvas.getContext('2d');

        // Oyun Durumu Başlangıcı (Yükleme ekranıyla başlar)
        this.currentState = GAME_STATES.LOADING;

        // Zamanlayıcı Değişkenleri (Delta Time Hesaplamaları)
        this.lastTime = 0;
        this.accumulatedTime = 0;
        this.roundTimer = CONFIG.ROUND_DURATION;
        this.roundTimeMs = 0; // Raunt süresi milisaniye takibi

        // Görsel Ölçeklendirme ve Letterboxing (Siyah Kenarlık) Bilgileri
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

        // Yumuşak Geçişli (Lerp) HUD Barları İçin Hedef Değerler (250 HP tabanına göre)
        this.p1DisplayHp = 250;
        this.p2DisplayHp = 250;
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
     * Ekran çözünürlüğü değişimi durumlarında 16:9 oranını koruyarak letterbox çizer.
     * Sanal pikselleri fiziksel ekran pikselleri ile eşleştirir.
     */
    resizeCanvas() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        const windowRatio = windowWidth / windowHeight;
        const virtualRatio = CONFIG.VIRTUAL_WIDTH / CONFIG.VIRTUAL_HEIGHT;

        let canvasWidth, canvasHeight;

        if (windowRatio > virtualRatio) {
            canvasHeight = windowHeight;
            canvasWidth = canvasHeight * virtualRatio;
            this.offsetX = (windowWidth - canvasWidth) / 2;
            this.offsetY = 0;
        } else {
            canvasWidth = windowWidth;
            canvasHeight = canvasWidth / virtualRatio;
            this.offsetX = 0;
            this.offsetY = (windowHeight - canvasHeight) / 2;
        }

        this.canvas.style.position = 'absolute';
        this.canvas.style.width = `${canvasWidth}px`;
        this.canvas.style.height = `${canvasHeight}px`;
        this.canvas.style.left = `${this.offsetX}px`;
        this.canvas.style.top = `${this.offsetY}px`;

        this.canvas.width = CONFIG.VIRTUAL_WIDTH;
        this.canvas.height = CONFIG.VIRTUAL_HEIGHT;

        this.scaleX = canvasWidth / CONFIG.VIRTUAL_WIDTH;
        this.scaleY = canvasHeight / CONFIG.VIRTUAL_HEIGHT;
    }

    /**
     * Manifestteki tüm görselleri önbelleğe asenkron olarak yükler.
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
                
                this.renderLoadingProgress();

                if (this.assets.loadedCount === this.assets.totalCount) {
                    this.onAssetsLoaded();
                }
            };
            img.onerror = () => {
                console.error(`Görsel yüklenemedi: ${this.assetManifest[key]}`);
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
        
        this.ctx.fillStyle = '#d4af37';
        this.ctx.font = 'bold 36px Cinzel, Georgia, serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('HOGWARTS DUELLOSU', CONFIG.VIRTUAL_WIDTH / 2, CONFIG.VIRTUAL_HEIGHT / 2 - 50);

        this.ctx.font = '16px monospace';
        this.ctx.fillStyle = '#8a94a6';
        this.ctx.fillText(`Asalar Hazırlanıyor... %${percent}`, CONFIG.VIRTUAL_WIDTH / 2, CONFIG.VIRTUAL_HEIGHT / 2 + 10);

        const barW = 400;
        const barH = 14;
        const barX = (CONFIG.VIRTUAL_WIDTH - barW) / 2;
        const barY = CONFIG.VIRTUAL_HEIGHT / 2 + 30;

        this.ctx.strokeStyle = '#2d3545';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(barX, barY, barW, barH);

        this.ctx.fillStyle = '#d4af37';
        this.ctx.fillRect(barX + 2, barY + 2, (barW - 4) * (percent / 100), barH - 4);
    }

    /**
     * Tüm görseller asenkron olarak yüklendiğinde tetiklenir.
     */
    onAssetsLoaded() {
        // Durumu Karakter Seçim Menüsüne Geçir
        this.currentState = GAME_STATES.CHARACTER_SELECT;
        
        // Ana Döngüyü Başlat (Süreç döngüsü aktifleşir)
        requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
    }

    /**
     * Karakter seçimi tamamlanıp düello başlatıldığında tetiklenir.
     * @param {string} selectedType - Seçilen karakter tipi ('voldemort' veya 'morgan')
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
     * Belirli bir raundu tamamen sıfırlar ve konumlandırır.
     */
    initRound() {
        this.audio.stopFlame();

        // Karakter Nesnelerini Oluştur
        if (this.playerCharacterType === 'voldemort') {
            this.p1 = new Character('voldemort', true, 200, this, CONFIG);
            this.p2 = new Character('morgan', false, 1080, this, CONFIG);
        } else {
            this.p1 = new Character('morgan', true, 200, this, CONFIG);
            this.p2 = new Character('voldemort', false, 1080, this, CONFIG);
        }

        // HUD Gösterge Değerlerini Can Tabanına (250) Göre Sıfırla
        this.p1DisplayHp = 250;
        this.p2DisplayHp = 250;
        this.p1DisplayMana = 100;
        this.p2DisplayMana = 100;

        this.roundTimer = CONFIG.ROUND_DURATION;
        this.roundTimeMs = 0;
        this.spells.clearAll();
        particles.length = 0;

        this.audio.playLightning();
    }

    // --- PART 1 BURADA SONLANIYOR ---
    // Sınıfın devamı (Sarsıntı, update, render, HUD, büyü gecikme kontrolleri vb.) PART 2 ile eklenecektir.

/**
     * Kamera sarsıntısı (Screen Shake) yoğunluğunu ve süresini belirler.
     * @param {number} intensity - Sarsıntı gücü (piksel sapması)
     * @param {number} duration - Sarsıntı süresi (saniye)
     */
    triggerScreenShake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }

    /**
     * Delta Time tabanlı ana oyun döngüsü. Tarayıcının yenilenme hızına uyum sağlar.
     * @param {number} timestamp - Tarayıcıdan gelen milisaniye cinsinden anlık zaman damgası
     */
    gameLoop(timestamp) {
        if (!this.lastTime) {
            this.lastTime = timestamp;
        }

        let deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Sekme veya donma anlarında fiziğin bozulmaması için üst sınır
        if (deltaTime > CONFIG.MAX_DELTA_TIME) {
            deltaTime = CONFIG.MAX_DELTA_TIME;
        }

        this.update(deltaTime);
        this.render();

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    /**
     * Tüm nesnelerin, fiziklerin, büyü okuma süreçlerinin ve ses tetikleyicilerinin güncellendiği merkezi metot.
     * @param {number} dt - Geçen zaman dilimi (saniye)
     */
    update(dt) {
        // Kamera Sarsıntısı (Screen Shake) hesabı
        if (this.shakeDuration > 0) {
            this.shakeDuration -= dt;
            this.shakeX = (Math.random() * 2 - 1) * this.shakeIntensity;
            this.shakeY = (Math.random() * 2 - 1) * this.shakeIntensity;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }

        // Oyun oynamıyor durumundaysa güncellemeleri durdur
        if (this.currentState !== GAME_STATES.PLAYING) {
            return;
        }

        // Raunt Süresi Takipçisi (Saniye biriktirme mantığı)
        this.roundTimeMs += dt * 1000;
        if (this.roundTimeMs >= 1000) {
            this.roundTimer = Math.max(0, this.roundTimer - 1);
            this.roundTimeMs -= 1000;

            if (this.roundTimer === 0) {
                this.handleRoundEnd(true);
            }
        }

        // --- MADDE 10: PROTEGO KALKANI MP3 SES TETİKLEYİCİSİ ---
        // Karakter kalkanı açtığı an tek seferlik kalkan aktifleşme sesi (.mp3) tetiklenir
        [this.p1, this.p2].forEach(char => {
            if (char && char.state !== 'dead') {
                if (char.shieldActive && !char.prevShieldActive) {
                    if (char.type === 'voldemort') {
                        this.audio.playVoldemortProtego();
                    } else {
                        this.audio.playMorganProtego();
                    }
                }
                char.prevShieldActive = char.shieldActive; // Önceki kare durumunu güncelle
            }
        });

        // --- MADDE 10: 1 SANİYELİK BÜYÜ GECİKMESİ VE HAZIRLIK TAKİBİ ---
        // Eğer bir büyücü büyü sözünü söylemiş ve castDelayTimer'ı bitmişse asıl mermiyi fırlatır
        [this.p1, this.p2].forEach(caster => {
            if (caster && caster.pendingSpellIndex !== null && caster.castDelayTimer <= 0) {
                this.executePendingSpell(caster);
            }
        });

        // Oyuncu girdilerini işle
        this.input.updatePlayerMovement(this.p1);

        // Karakterleri ve fizik konumlarını güncelle
        this.p1.update(dt, this.p2);
        this.p2.update(dt, this.p1);

        // Yapay Zekayı (AI) güncelle
        this.ai.update(dt, this.p2, this.p1);

        // Büyüleri, mermileri ve sürekli alev menzillerini güncelle
        this.spells.update(dt, this.p1, this.p2);

        // Parçacık efektlerini güncelle
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update(dt);
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Lerp HUD barları yumuşak geçiş güncellemesi (250 HP tabanına göre dengelenmiştir)
        const lerpFactor = 10 * dt;
        this.p1DisplayHp += (this.p1.hp - this.p1DisplayHp) * lerpFactor;
        this.p2DisplayHp += (this.p2.hp - this.p2DisplayHp) * lerpFactor;
        
        this.p1DisplayMana += (this.p1.mana - this.p1DisplayMana) * lerpFactor;
        this.p2DisplayMana += (this.p2.mana - this.p2DisplayMana) * lerpFactor;

        // Canı sıfırlanan karakter varsa raundu sonlandır
        if (this.p1.hp <= 0 || this.p2.hp <= 0) {
            this.handleRoundEnd(false);
        }
    }

    /**
     * Raunt bittiğinde puan durumunu ve kazananı belirler.
     * @param {boolean} isTimeOut - Raunt süresinin dolup dolmadığı bilgisi
     */
    handleRoundEnd(isTimeOut) {
        this.currentState = GAME_STATES.ROUND_OVER;
        this.audio.stopFlame();

        let winner = null;

        if (isTimeOut) {
            if (this.p1.hp > this.p2.hp) {
                winner = this.p1;
                this.p1Score++;
            } else if (this.p2.hp > this.p1.hp) {
                winner = this.p2;
                this.p2Score++;
            }
        } else {
            if (this.p1.hp > 0) {
                winner = this.p1;
                this.p1Score++;
            } else {
                winner = this.p2;
                this.p2Score++;
            }
        }

        if (winner) {
            winner.say("Zafer benim!");
        }

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
     * Görsel render katmanı. Tüm çizim matrislerini yönetir.
     */
    render() {
        this.ctx.save();
        this.ctx.clearRect(0, 0, CONFIG.VIRTUAL_WIDTH, CONFIG.VIRTUAL_HEIGHT);

        // Kamera sarsıntısı aktifse ekran matrisini kaydır
        if (this.shakeIntensity > 0) {
            this.ctx.translate(this.shakeX, this.shakeY);
        }

        // Arka plan resmini veya düz rengi çiz
        if (this.assets.images.bg) {
            this.ctx.drawImage(this.assets.images.bg, 0, 0, CONFIG.VIRTUAL_WIDTH, CONFIG.VIRTUAL_HEIGHT);
        } else {
            this.ctx.fillStyle = '#111318';
            this.ctx.fillRect(0, 0, CONFIG.VIRTUAL_WIDTH, CONFIG.VIRTUAL_HEIGHT);
        }

        // Oyun veya Raunt Sonu aşamasındaysak karakterleri ve büyüleri çiz
        if (this.currentState === GAME_STATES.PLAYING || this.currentState === GAME_STATES.ROUND_OVER) {
            this.spells.draw(this.ctx);

            if (this.p1) this.p1.draw(this.ctx);
            if (this.p2) this.p2.draw(this.ctx);

            for (let i = 0; i < particles.length; i++) {
                particles[i].draw(this.ctx);
            }

            this.drawHUD();
        }

        if (this.currentState === GAME_STATES.ROUND_OVER) {
            this.drawRoundOverScreen();
        }

        this.ctx.restore();
    }

    /**
     * Madde 1: HUD Gösterge Barlarının Ayrı ve Simetrik Olarak Çizilmesi
     */
    drawHUD() {
        // Sol Panel: Oyuncu Büyücü Göstergeleri (Can, Mana, Ulti)
        this.drawBar(50, 40, 320, 22, this.p1DisplayHp / 250, '#ff3333', '#4a0d0d', 'CAN');
        this.drawBar(50, 70, 240, 12, this.p1DisplayMana / 100, '#3399ff', '#0d284a', 'MANA');
        this.drawBar(50, 90, 240, 8, this.p1.ultCharge / 100, '#ffcc00', '#4a3c0d', 'ULTI');

        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 22px "Cinzel", serif';
        this.ctx.fillText(this.p1.type.toUpperCase() + ' (SEN)', 50, 30);
        this.ctx.restore();

        // Sağ Panel: Yapay Zeka Karakter Göstergeleri (Can, Mana, Ulti)
        // Madde 1: alignRight true verilerek x=50 girildiğinde barlar sağ kenardan simetrik hizalanır
        this.drawBar(50, 40, 320, 22, this.p2DisplayHp / 250, '#ff3333', '#4a0d0d', 'CAN', true);
        this.drawBar(50, 70, 240, 12, this.p2DisplayMana / 100, '#3399ff', '#0d284a', 'MANA', true);
        this.drawBar(50, 90, 240, 8, this.p2.ultCharge / 100, '#ffcc00', '#4a3c0d', 'ULTI', true);

        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 22px "Cinzel", serif';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(this.p2.type.toUpperCase() + ' (AI)', CONFIG.VIRTUAL_WIDTH - 50, 30);
        this.ctx.restore();

        this.drawCenterHUD();
    }

    /**
     * HUD Barlarını çizen parametrik metot.
     */
    drawBar(x, y, w, h, pct, fgColor, bgColor, label, alignRight = false) {
        this.ctx.save();
        
        let drawX = x;
        if (alignRight) {
            drawX = CONFIG.VIRTUAL_WIDTH - x - w;
        }

        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(drawX, y, w, h);

        const activeWidth = Math.max(0, w * Math.min(1, pct));
        this.ctx.fillStyle = fgColor;
        this.ctx.fillRect(drawX, y, activeWidth, h);

        this.ctx.strokeStyle = '#2d3545';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(drawX, y, w, h);

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
     * Ekranın ortasında yer alan süreyi ve raunt skor boncuklarını çizer.
     */
    drawCenterHUD() {
        this.ctx.save();

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

        this.ctx.fillStyle = this.roundTimer <= 10 ? '#ff3333' : '#ffffff';
        this.ctx.font = 'bold 32px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.roundTimer.toString().padStart(2, '0'), CONFIG.VIRTUAL_WIDTH / 2, panelY + 32);

        this.ctx.fillStyle = '#8a94a6';
        this.ctx.font = 'bold 11px "Cinzel", serif';
        this.ctx.fillText(`RAUNT ${this.currentRound}`, CONFIG.VIRTUAL_WIDTH / 2, panelY + 48);

        const drawScoreDots = (score, startX, direction) => {
            const dotRadius = 5;
            const gap = 14;
            for (let i = 0; i < 2; i++) {
                this.ctx.beginPath();
                this.ctx.arc(startX + i * gap * direction, panelY + 60, dotRadius, 0, Math.PI * 2);
                if (i < score) {
                    this.ctx.fillStyle = '#d4af37';
                } else {
                    this.ctx.fillStyle = '#2d3545';
                }
                this.ctx.fill();
                this.ctx.strokeStyle = '#0c0f12';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }
        };

        drawScoreDots(this.p1Score, CONFIG.VIRTUAL_WIDTH / 2 - 15, -1);
        drawScoreDots(this.p2Score, CONFIG.VIRTUAL_WIDTH / 2 + 15, 1);

        this.ctx.restore();
    }

    /**
     * Raunt bittiğinde K.O. ekranını çizer.
     */
    drawRoundOverScreen() {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
        this.ctx.fillRect(0, 0, CONFIG.VIRTUAL_WIDTH, CONFIG.VIRTUAL_HEIGHT);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        let mainText = "K.O.";
        let mainColor = '#ff3333';

        if (this.roundTimer === 0 && this.p1.hp > 0 && this.p2.hp > 0) {
            mainText = "SÜRE BİTTİ";
            mainColor = '#ffcc00';
        }

        this.ctx.fillStyle = mainColor;
        this.ctx.font = 'bold 90px "Cinzel", Georgia, serif';
        this.ctx.shadowColor = mainColor;
        this.ctx.shadowBlur = 25;
        this.ctx.fillText(mainText, CONFIG.VIRTUAL_WIDTH / 2, CONFIG.VIRTUAL_HEIGHT / 2 - 30);

        let winSubText = "BERABERE";
        if (this.p1.hp > this.p2.hp) {
            winSubText = `${this.p1.type.toUpperCase()} RAUNDU KAZANDI`;
        } else if (this.p2.hp > this.p1.hp) {
            winSubText = `${this.p2.type.toUpperCase()} RAUNDU KAZANDI`;
        }

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 24px "Cinzel", serif';
        this.ctx.shadowBlur = 0;
        this.ctx.fillText(winSubText, CONFIG.VIRTUAL_WIDTH / 2, CONFIG.VIRTUAL_HEIGHT / 2 + 50);

        this.ctx.restore();
    }

    /**
     * Madde 10: 1 Saniyelik Büyü Sözü Söyleme Gecikmesi Süresini Dolduran ve Asıl Fırlatmayı Tetikleyen Fonksiyon
     */
    executePendingSpell(caster) {
        const target = (caster === this.p1) ? this.p2 : this.p1;
        
        // Büyü okuma sırasında darbe alındıysa büyü iptal edilir (Interrupt)
        if (caster.state === 'pain' || caster.state === 'stun' || caster.state === 'dead') {
            caster.pendingSpellIndex = null;
            return;
        }

        const index = caster.pendingSpellIndex;
        caster.pendingSpellIndex = null; // Hazırlığı sıfırla

        let dir = caster.facingRight ? 1 : -1;

        if (caster.type === 'voldemort') {
            if (index === 1) { // Yer hedefli Confringo patlaması tetiklenir (Zemine dikilir)
                this.spells.triggerConfringo(target.x, caster);
            }
            else if (index === 3) { // Avada Kedavra ölüm ışını fırlatılır
                let isHit = true;
                if (target.isDucking) isHit = false;
                if (target.y < 600 - 50) isHit = false; // Havaya sıçrayan hedefler kurtulur

                const startX = caster.x + dir * 60;
                const startY = caster.y - 210;
                const endX = isHit ? target.x : (caster.facingRight ? 1280 : 0);
                const endY = isHit ? target.y - 210 : caster.y - 210;

                this.spells.triggerAvadaBeam(startX, startY, endX, endY);

                if (isHit) {
                    target.takeDamage(9999, true); // Bypass shield (Canı tamamen götürür)
                }
            }
        } else { // Morgan
            if (index === 2) { // Sectumsempra mermisi fırlatılır (Hız 12'ye düşürüldü)
                this.spells.addProjectile(new Projectile(caster.x + dir * 60, caster.y - 210, dir * 12, caster, 'sectumsempra', this));
            }
            else if (index === 3) { // Expelliarmus ulti mermisi fırlatılır (Hız 14'ye düşürüldü)
                this.spells.addProjectile(new Projectile(caster.x + dir * 60, caster.y - 210, dir * 14, caster, 'expelliarmus', this));
            }
        }
    }
}

// Oyun motoru nesnesini başlat ve dışa aktar
export const game = new GameOrchestrator();

// --- BÜYÜ TETİKLEYİCİSİ KÖPRÜSÜ (Büyülerin çalışması için) ---
// Madde 10: Büyü sözü söyleme duraklama ve MP3 ses çalma tetikleyicileri entegre edildi
export function castSpell(caster, target, index) {
    if (caster.state === 'dead' || caster.state === 'stun' || caster.state === 'pain' || caster.castDelayTimer > 0) return;

    if (caster.type === 'voldemort') {
        if (index === 1) { // Confringo
            if (caster.mana >= 25) {
                caster.mana -= 25;
                caster.say("Confringo!");
                caster.castDelayTimer = 1.0; // Madde 10: 1.0 saniye büyü sözü söyleme kilidi
                caster.pendingSpellIndex = index;
                game.audio.playConfringoCast(); // confringo.mp3 çalınır
            }
        } 
        else if (index === 2) { // Crucio (Kanalizasyon büyüsü - gecikmesiz başlar)
            if (caster.mana >= 30) {
                caster.say("Crucio!");
                caster.channelingSpell = 'crucio';
                game.audio.playCrucioCast(); // crucio.mp3 çalınır
            }
        }
        else if (index === 3) { // Avada Kedavra
            if (caster.ultCharge >= 100) {
                caster.ultCharge = 0;
                caster.say("Avada Kedavra!");
                caster.castDelayTimer = 1.0; // 1.0 saniye gecikme
                caster.pendingSpellIndex = index;
                game.audio.playAvadaKedavraCast(); // avadakedavra.mp3 çalınır
            }
        }
    } 
    else { // Morgan
        if (index === 1) { // Incendio (Kanalizasyon - gecikmesiz)
            if (caster.mana >= 20) {
                caster.say("Incendio!");
                caster.channelingSpell = 'incendio';
                game.audio.startFlame(); // morganincendio.mp3 döngüsü başlar
            }
        }
        else if (index === 2) { // Sectumsempra
            if (caster.mana >= 20) {
                caster.mana -= 20;
                caster.say("Sectumsempra!");
                caster.castDelayTimer = 1.0; // 1.0 saniye gecikme
                caster.pendingSpellIndex = index;
                game.audio.playMorganSectumsempraCast(); // morgansectumsempra.mp3 çalınır
            }
        }
        else if (index === 3) { // Expelliarmus
            if (caster.ultCharge >= 100) {
                caster.ultCharge = 0;
                caster.say("Expelliarmus!");
                caster.castDelayTimer = 1.0; // 1.0 saniye gecikme
                caster.pendingSpellIndex = index;
                game.audio.playMorganExpelliarmusCast(); // morganexpelliarmus.mp3 çalınır
            }
        }
    }
}

// Modül dışındaki input.js veya ai.js gibi scriptlerin window'dan bu fonksiyona erişebilmesini sağla
window.castSpell = castSpell;

// --- DÜELLOBAŞLATICI OYUNİÇİ ELEMANLAR (SEÇİM EKRANI VE BUTONLAR) ---
const cardVold = document.getElementById('card-voldemort');
const cardMorgan = document.getElementById('card-morgan');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('selection-overlay');

let playerChar = 'voldemort'; // Varsayılan seçim

if (cardVold && cardMorgan && startBtn && overlay) {
    cardVold.addEventListener('click', () => {
        playerChar = 'voldemort';
        cardVold.classList.add('selected');
        cardMorgan.classList.remove('selected');
    });

    cardMorgan.addEventListener('click', () => {
        playerChar = 'morgan';
        cardMorgan.classList.add('selected');
        cardVold.classList.remove('selected');
    });

    startBtn.addEventListener('click', () => {
        // Ses modülünü uyandır
        game.audio.init();
        game.audio.playTheme(); // maintheme.mp3 ana menü müziğini başlatır

        // Düelloyu başlat
        game.startDuel(playerChar);

        // Mobil düğme isimlerini dinamik olarak ayarla
        if (playerChar === 'voldemort') {
            document.getElementById('btn-sp1').innerHTML = '<span>Confringo</span><small>K / 2</small>';
            document.getElementById('btn-sp2').innerHTML = '<span>Crucio</span><small>L / 3</small>';
        } else {
            document.getElementById('btn-sp1').innerHTML = '<span>Incendio</span><small>K / 2</small>';
            document.getElementById('btn-sp2').innerHTML = '<span>Sectum</span><small>L / 3</small>';
        }

        // Seçim ekranını kaldır
        overlay.style.opacity = 0;
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 500);
    });
}

// Madde 10: Sayfaya ilk etkileşimde ana tema müziğini güvenli bir şekilde uyandırır
window.addEventListener('click', () => {
    if (game.audio) {
        game.audio.init();
        game.audio.playTheme();
    }
}, { once: true });
