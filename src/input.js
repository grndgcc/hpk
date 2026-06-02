/**
 * ============================================================================
 * HOGWARTS DUEL - INPUT HANDLER & BINDING SOYUTLAMA SİSTEMİ
 * ============================================================================
 * Bu sınıf; masaüstü klavye girdilerini, harici USB oyun kollarını (Gamepad API)
 * ve mobil dokunmatik sanal tuşları tek bir "Eylem Soyutlama Katmanı" (Action Abstraction)
 * çatısında birleştirir.
 * 
 * Modüler Mimari Tasarımı (ES6):
 * - Mobile özel tarayıcı engellemelerini (zoom, double-tap delay) iptal eder.
 * - Basılı tutulan (continuous) hareketler ile tek tetiklemeli (discrete) büyüleri ayırır.
 * - Gamepad API entegrasyonu ile fiziksel oyun kollarını otomatik algılar.
 */

import { Engine } from './engine.js';

// Global büyü tetikleyicisi (main.js / HTML içindeki global castSpell çağrısına köprü)
const castSpellWrapper = (caster, target, index) => {
    const globalCast = window.castSpell;
    if (typeof globalCast === 'function') {
        globalCast(caster, target, index);
    }
};

export class InputHandler {
    /**
     * @param {object} game - GameOrchestrator referansı (Ana motor)
     */
    constructor(game) {
        this.game = game;

        // Klavye tuşlarının basılma durumları (Sözlük/Dictionary)
        this.keys = {};

        // Soyutlanmış Eylem Durumları (Continuous Actions)
        this.actions = {
            LEFT: false,
            RIGHT: false,
            JUMP: false,
            DUCK: false,
            PROTEGO: false
        };

        // Tek Tetiklemeli (Discrete) Eylemlerin Önceki Kare Durumları
        // Aynı tuşa basılı tutulduğunda büyünün her karede fırlatılmasını (spam) önlemek için kullanılır
        this.prevActions = {
            SPELL1: false,
            SPELL2: false,
            ULTIMATE: false
        };

        // Mobil Dokunmatik Durum Takibi
        this.touchActive = false;

        // Harici Oyun Kolu (Gamepad) Bağlantı Durumu
        this.gamepadConnected = false;
        this.activeGamepadIndex = null;
    }

    /**
     * Tüm donanım dinleyicilerini (Klavye, Dokunmatik ekran, Gamepad) bağlar.
     */
    bindEvents() {
        // 1. Masaüstü Klavye Event Dinleyicileri
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;

            // Tarayıcı yön tuşlarının sayfayı kaydırmasını engelle
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
                e.preventDefault();
            }

            // Ses motorunu ilk tuş vuruşunda tarayıcı güvenlik politikasını aşmak için uyandır
            if (this.game.audio) {
                this.game.audio.init();
            }

            // Tek Tetiklemeli (Discrete) Tuşların Algılanması
            if (this.game.gameRunning && this.game.p1 && this.game.p1.state !== 'dead') {
                if (key === '2' || key === 'k') {
                    this.triggerSpellAction(1);
                }
                if (key === '3' || key === 'l') {
                    this.triggerSpellAction(2);
                }
                if (key === '4' || key === 'i') {
                    this.triggerSpellAction(3);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;

            // Kanalize büyülerin tuş bırakıldığında durdurulması
            if (this.game.gameRunning && this.game.p1) {
                if (this.game.p1.type === 'voldemort' && (key === '3' || key === 'l')) {
                    if (this.game.p1.channelingSpell === 'crucio') {
                        this.game.p1.stopChannel();
                    }
                }
                if (this.game.p1.type === 'morgan' && (key === '2' || key === 'k')) {
                    if (this.game.p1.channelingSpell === 'incendio') {
                        this.game.p1.stopChannel();
                    }
                }
            }
        });

        // Pencere odağını kaybettiğinde (Alt-Tab vb.) karakterlerin kilitli yürümesini önlemek için tuşları sıfırla
        window.addEventListener('blur', () => {
            this.keys = {};
            this.resetActions();
            if (this.game.p1) {
                this.game.p1.shieldActive = false;
                this.game.p1.stopChannel();
            }
        });

        // 2. Mobil Cihaz Dokunmatik Dinleyicileri (Touch Events)
        this.setupMobileEvents();

        // 3. Harici USB Oyun Kolu Entegrasyonu (Gamepad API Events)
        window.addEventListener('gamepadconnected', (e) => {
            console.log(`Gamepad Bağlandı: ${e.gamepad.id}`);
            this.gamepadConnected = true;
            this.activeGamepadIndex = e.gamepad.index;
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log(`Gamepad Ayrıldı: ${e.gamepad.id}`);
            this.gamepadConnected = false;
            this.activeGamepadIndex = null;
            this.resetActions();
        });
    }

    /**
     * Eylem durumlarını tamamen sıfırlar.
     */
    resetActions() {
        Object.keys(this.actions).forEach(act => this.actions[act] = false);
    }

    /**
     * Mobil cihazlar için dokunmatik butonları kurgular.
     * Tarayıcı kısıtlamalarını (Zoom vb.) engeller.
     */
    setupMobileEvents() {
        const controlsOverlay = document.getElementById('mobile-controls');
        if (!controlsOverlay) return;

        // Dokunmatik ekran algılandığında sanal gamepad arayüzünü aç
        if ('ontouchstart' in window) {
            controlsOverlay.style.display = 'flex';
            this.touchActive = true;
        }

        // Sanal Butonların ID'lerine göre aksiyon eşleştirmeleri
        const buttonMappings = {
            'btn-up': 'JUMP',
            'btn-left': 'LEFT',
            'btn-right': 'RIGHT',
            'btn-down': 'DUCK',
            'btn-prot': 'PROTEGO'
        };

        const discreteMappings = {
            'btn-sp1': 1,
            'btn-sp2': 2,
            'btn-ult': 3
        };

        // Continuous (Basılı tutulabilen) Butonların Dinlenmesi
        Object.keys(buttonMappings).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            const action = buttonMappings[btnId];

            // Dokunma Başlangıcı
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Sayfa kaydırma ve çift tıklama engeli (Altın kural)
                this.actions[action] = true;
                this.game.audio.init();
            });

            // Dokunma Bitişi
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.actions[action] = false;
                
                // Kalkan (Protego) bırakıldığında kapat
                if (action === 'PROTEGO' && this.game.p1) {
                    this.game.p1.shieldActive = false;
                }
            });

            // Dokunmanın ekrandan taşma durumlarında kilitlenmeyi önle
            btn.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                this.actions[action] = false;
                if (action === 'PROTEGO' && this.game.p1) {
                    this.game.p1.shieldActive = false;
                }
            });
        });

        // Discrete (Tek tıklamalı/Kanalizasyonlu) Büyü Butonlarının Dinlenmesi
        Object.keys(discreteMappings).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            const spellIndex = discreteMappings[btnId];

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.game.audio.init();

                if (this.game.gameRunning && this.game.p1 && this.game.p1.state !== 'dead') {
                    // Büyüyü tetikle
                    this.triggerSpellAction(spellIndex);
                }
            });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                // Basma bitince, eğer kanalizasyon büyüsüyse (Voldemort Crucio, Morgan Incendio) durdur
                if (this.game.gameRunning && this.game.p1) {
                    if (this.game.p1.type === 'voldemort' && spellIndex === 2) { // Crucio
                        if (this.game.p1.channelingSpell === 'crucio') this.game.p1.stopChannel();
                    }
                    if (this.game.p1.type === 'morgan' && spellIndex === 1) { // Incendio
                        if (this.game.p1.channelingSpell === 'incendio') this.game.p1.stopChannel();
                    }
                }
            });
        });
    }

    /**
     * Büyü tetikleme komutunu çalıştırır.
     * @param {number} spellIndex - 1, 2 veya 3 (Büyü sırası)
     */
    triggerSpellAction(spellIndex) {
        if (!this.game.p1 || !this.game.p2) return;
        castSpellWrapper(this.game.p1, this.game.p2, spellIndex);
    }

    /**
     * Saniyede 60 kez harici oyun kollarını (Gamepad API) sorgular.
     * Bağlı kolların analog eksen ve tuş verilerini eylemlere dönüştürür.
     */
    pollGamepad() {
        if (!this.gamepadConnected || this.activeGamepadIndex === null) return;

        const gamepad = navigator.getGamepads()[this.activeGamepadIndex];
        if (!gamepad) return;

        // 1. Sol Analog Stick ve D-Pad (Yön Tuşları) Girdileri
        const axisX = gamepad.axes[0]; // -1 (Sol) ile +1 (Sağ) arası
        const axisY = gamepad.axes[1]; // -1 (Yukarı) ile +1 (Aşağı) arası

        // D-Pad Düğme İndeksleri (Standart Gamepad haritalaması)
        const dpadUp = gamepad.buttons[12]?.pressed;
        const dpadDown = gamepad.buttons[13]?.pressed;
        const dpadLeft = gamepad.buttons[14]?.pressed;
        const dpadRight = gamepad.buttons[15]?.pressed;

        // Sağa Sola Yürüme Eylemlerinin Soyutlanması
        this.actions.LEFT = (axisX < -0.3) || dpadLeft;
        this.actions.RIGHT = (axisX > 0.3) || dpadRight;

        // Zıplama (Analog yukarı / Xbox A düğmesi [0])
        const buttonA = gamepad.buttons[0]?.pressed;
        this.actions.JUMP = (axisY < -0.5) || dpadUp || buttonA;

        // Eğilme (Analog aşağı / Dpad aşağı)
        this.actions.DUCK = (axisY > 0.5) || dpadDown;

        // Protego Kalkanı (Xbox B düğmesi [1] veya Sağ Tetik RB [5])
        const buttonB = gamepad.buttons[1]?.pressed;
        const buttonRB = gamepad.buttons[5]?.pressed;
        this.actions.PROTEGO = buttonB || buttonRB;

        // Tek Tetiklemeli Büyü Butonları Sorgulaması (Dövüş oyunu hassas vuruş takibi)
        // Xbox X [2] -> SPELL1 (Confringo / Incendio)
        const buttonX = gamepad.buttons[2]?.pressed;
        if (buttonX) {
            if (!this.prevActions.SPELL1) {
                this.triggerSpellAction(1);
                this.prevActions.SPELL1 = true;
            }
        } else {
            // Tuş bırakıldığında durdurma ve kilit çözme
            if (this.prevActions.SPELL1) {
                this.prevActions.SPELL1 = false;
                if (this.game.p1 && this.game.p1.type === 'morgan') {
                    if (this.game.p1.channelingSpell === 'incendio') this.game.p1.stopChannel();
                }
            }
        }

        // Xbox Y [3] -> SPELL2 (Crucio / Sectumsempra)
        const buttonY = gamepad.buttons[3]?.pressed;
        if (buttonY) {
            if (!this.prevActions.SPELL2) {
                this.triggerSpellAction(2);
                this.prevActions.SPELL2 = true;
            }
        } else {
            if (this.prevActions.SPELL2) {
                this.prevActions.SPELL2 = false;
                if (this.game.p1 && this.game.p1.type === 'voldemort') {
                    if (this.game.p1.channelingSpell === 'crucio') this.game.p1.stopChannel();
                }
            }
        }

        // Xbox RT [7] (Sağ Alt Tetik) -> ULTIMATE
        const buttonRT = gamepad.buttons[7]?.pressed;
        if (buttonRT) {
            if (!this.prevActions.ULTIMATE) {
                this.triggerSpellAction(3);
                this.prevActions.ULTIMATE = true;
            }
        } else {
            this.prevActions.ULTIMATE = false;
        }
    }

    /**
     * Update (Fizik) döngüsünde her kare çağrılır.
     * Klavye, mobil dokunmatik ve oyun kollarının birikmiş verilerini doğrudan
     * karakterin fiziksel hızlarına ve kalkan bayraklarına yansıtır.
     * 
     * @param {object} player - Güncellenecek p1 (Büyücü) referansı
     */
    updatePlayerMovement(player) {
        if (!player || player.state === 'dead' || player.state === 'stun' || player.state === 'pain') {
            return;
        }

        // USB Oyun kollarını tara (Varsa eylemleri günceller)
        this.pollGamepad();

        // Karakterin yatay ivmesini sıfırla (Sürtünme başlangıcı)
        player.vx = 0;

        // 1. Sağa Sola Yürüme Kontrolleri (Keyboard / Gamepad / Touch birleşimi)
        const goLeft = this.keys['a'] || this.keys['arrowleft'] || this.actions.LEFT;
        const goRight = this.keys['d'] || this.keys['arrowright'] || this.actions.RIGHT;

        if (goLeft) {
            player.vx = -5; // Saniyede sola doğru piksel hareketi
        }
        if (goRight) {
            player.vx = 5;  // Saniyede sağa doğru piksel hareketi
        }

        // 2. Zıplama Kontrolü (Grounded filtresiyle çift zıplama engellenir)
        const doJump = this.keys['w'] || this.keys['arrowup'] || this.actions.JUMP;
        if (doJump && player.isGrounded) {
            player.vy = -15; // Zıplama dikey kalkış ivmesi
            player.isGrounded = false;
        }

        // 3. Eğilme (Ducking) Kontrolü (Hurtbox daraltıcı durum)
        const doDuck = this.keys['s'] || this.keys['arrowdown'] || this.actions.DUCK;
        player.isDucking = doDuck;

        // 4. Protego Kalkanını Açma/Kapatma Durum Güncellemesi
        const holdShield = this.keys['j'] || this.keys['1'] || this.actions.PROTEGO;
        if (holdShield) {
            // Kalkanı açmak için minimum 5 mana eşiği kontrolü
            if (player.mana > 5) {
                player.shieldActive = true;
            } else {
                player.shieldActive = false;
            }
        } else {
            player.shieldActive = false;
        }
    }
}
