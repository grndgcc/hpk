/**
 * ============================================================================
 * HOGWARTS DUEL - TAKTİKSEL YAPAY ZEKA (HARD AI) SİSTEMİ
 * ============================================================================
 * Bu sınıf; rakip büyücünün (P2) karar alma ağaçlarını yönetir. AI, robotik ve
 * anında kalkan açan hileli bir yapı yerine; insan sinirsel reaksiyon gecikmesini
 * simüle eden bir gecikme kuyruğu (Reaction Queue) kullanır.
 * 
 * Modüler Mimari Tasarımı (ES6):
 * - Maç skoruna göre reaksiyon sürelerini dinamik daraltır (Kaybederken güçlenme).
 * - Oyuncunun kalkan durumuna göre büyü kombinasyonlarını gerçek zamanlı değiştirir.
 */

import { Engine, Vector2 } from './engine.js';
import { Projectile } from './spell.js';

class DelayedAction {
    /**
     * @param {number} delay - Eylemin tetiklenmesi için kalan süre (saniye)
     * @param {function} callback - Tetiklenecek olan fonksiyon referansı
     */
    constructor(delay, callback) {
        this.delay = delay;
        this.callback = callback;
    }
}

export class AIManager {
    constructor(game) {
        this.game = game;

        // Karar alma ve eylem zamanlayıcıları
        this.decisionTimer = 0;          // Genel taktiksel durum analiz periyodu (Örn: 200ms)
        this.decisionInterval = 0.20;     // 0.20 saniyede bir stratejik rota çizilir
        
        // İnsansı reaksiyon gecikmeleri kuyruğu
        this.reactionQueue = [];

        // Kaçınma / Geri çekilme zamanlayıcıları
        this.evadeTimer = 0;
        this.evadeDirection = 0;
    }

    /**
     * Eylem kuyruğuna gecikmeli bir hamle ekler.
     * Bu sayede AI, oyuncu tuşa bastığı an robotik olarak değil, insansı bir gecikmeyle tepki verir.
     */
    queueAction(delay, callback) {
        // Aynı türden mükerrer kalkan tetiklemelerini önlemek için kontrol et
        this.reactionQueue.push(new DelayedAction(delay, callback));
    }

    /**
     * Reaksiyon kuyruğunda bekleyen tüm gecikmeli eylemleri temizler.
     */
    clearReactionQueue() {
        this.reactionQueue = [];
    }

    /**
     * Yapay zekanın maçı kaybediyor olması durumunda odaklanmasını artıran
     * dinamik reaksiyon süresi hesaplayıcı.
     */
    getReactionDelay() {
        const playerScore = this.game.p1Score;
        const aiScore = this.game.p2Score;

        // Taban reaksiyon süresi: 220ms (Ortalama insan hızı)
        let baseDelay = 0.22;

        if (playerScore === 1 && aiScore === 0) {
            // AI maçı kaybediyorsa reaksiyon süresi 130ms'ye kadar iner (Aşırı odaklanmış mod)
            baseDelay = 0.13;
        } else if (playerScore === 0 && aiScore === 1) {
            // AI öndeyse reaksiyonu hafif gevşeterek oyuncuya şans tanı (260ms)
            baseDelay = 0.26;
        }

        // Reaksiyona hafif insansı sapmalar ekle (+- 30ms)
        const jitter = (Math.random() * 0.06) - 0.03;
        return Math.max(0.08, baseDelay + jitter);
    }

    /**
     * Yapay Zeka Güncelleme Döngüsü
     */
    update(dt, ai, player) {
        // AI can çekişiyorsa, dondurulmuşsa veya ölüyse hamle yapamaz
        if (ai.state === 'dead' || ai.state === 'pain' || ai.state === 'stun') {
            this.clearReactionQueue();
            return;
        }

        // 1. Gecikmeli Tepki (Reaction Queue) Sayacının İşletilmesi
        for (let i = this.reactionQueue.length - 1; i >= 0; i--) {
            const action = this.reactionQueue[i];
            action.delay -= dt;
            if (action.delay <= 0) {
                action.callback();
                this.reactionQueue.splice(i, 1);
            }
        }

        // 2. DEFANSİF REAKSİYON KATMANI (Her Karede Dinamik Tehdit Taraması)
        this.handleReactiveDefense(dt, ai, player);

        // 3. OFANSİF STRATEJİ KATMANI (Belirli periyotlarla tetiklenir - CPU Optimizasyonu)
        this.decisionTimer += dt;
        if (this.decisionTimer >= this.decisionInterval) {
            this.decisionTimer -= this.decisionInterval;
            this.handleTacticalOffense(ai, player);
        }

        // Kaçınma süresi bittiğinde yön ivmesini sıfırla
        if (this.evadeTimer > 0) {
            this.evadeTimer -= dt;
            ai.vx = this.evadeDirection * 4.5;
        }
    }

    /**
     * Tehdit Algılama ve Tepki Mekanizması (Saniyede 60 Kez Taranır)
     */
    handleReactiveDefense(dt, ai, player) {
        // Havada süzülen projektilleri tara
        const activeProjectiles = this.game.spells.projectiles;
        
        // AI'a doğru gelen en yakın tehlikeli mermiyi bul
        const threat = activeProjectiles.find(proj => {
            const isMovingTowardsAI = (proj.vx < 0 && ai.x < proj.x) || (proj.vx > 0 && ai.x > proj.x);
            return proj.owner === player && isMovingTowardsAI;
        });

        if (threat) {
            const distance = Math.abs(threat.x - ai.x);

            if (threat.type === 'confringo') {
                // Confringo korunamaz bir büyüdür! Kalkan açmak yerine kaçınma eylemi planla
                if (distance < 450 && ai.isGrounded && this.evadeTimer <= 0) {
                    this.clearReactionQueue(); // Diğer planları iptal et
                    
                    if (Math.random() < 0.65) {
                        // %65 ihtimalle zıplayarak patlamanın üzerinden atla
                        ai.vy = -16;
                        ai.isGrounded = false;
                    } else {
                        // %35 ihtimalle ters yöne doğru hızlıca geri çekil
                        this.evadeTimer = 0.4; // 0.4 saniye boyunca kaçınır
                        this.evadeDirection = ai.facingRight ? -1 : 1;
                    }
                }
            } else {
                // Korunabilir büyüler (Sectumsempra, Expelliarmus)
                // Mermi kritik yaklaşma mesafesindeyse ve kalkan kapalıysa reaksiyon süresi kuyrukla tetiklenir
                if (distance < 600 && !ai.shieldActive && this.reactionQueue.length === 0) {
                    const delay = this.getReactionDelay();
                    this.queueAction(delay, () => {
                        // Kalkanı açmak için yeterli mana var mı kontrol et
                        if (ai.mana > 15) {
                            ai.shieldActive = true;
                        }
                    });
                }
            }
        } else {
            // Ortada havada süzülen aktif bir mermi yoksa kalkanı açık tutmayı bırak (Mana tasarrufu!)
            // Eğer oyuncu sürekli hasar veren Crucio veya Incendio kanalize etmiyorsa kalkan kapatılır
            if (ai.shieldActive && !player.channelingSpell) {
                // Kalkanı kapatmak için de küçük bir insansı kapatma gecikmesi ekle (150ms)
                if (this.reactionQueue.length === 0) {
                    this.queueAction(0.15, () => {
                        ai.shieldActive = false;
                    });
                }
            }
        }

        // Oyuncu Crucio veya Incendio kanalize ediyorsa ve menzildeyse kalkan açmaya çalış
        if (player.channelingSpell && Math.abs(player.x - ai.x) < 750) {
            if (!ai.shieldActive && ai.mana > 20 && this.reactionQueue.length === 0) {
                const delay = this.getReactionDelay();
                this.queueAction(delay, () => {
                    ai.shieldActive = true;
                });
            }
        }
    }

    /**
     * Taktiksel Saldırı ve Mesafe Yönetimi (Milisaniyede Bir Analiz Edilir)
     */
    handleTacticalOffense(ai, player) {
        const dist = Math.abs(ai.x - player.x);

        // Kanalize büyü devam ediyorsa hareketi kilitle
        if (ai.channelingSpell) {
            return;
        }

        // 1. Durum: Mana Kritik Seviyede (< 30) - Defansif Kaçış Modu
        if (ai.mana < 30) {
            ai.shieldActive = false;
            ai.vx = ai.facingRight ? -3.5 : 3.5; // Geriye kaçarak mana yenilenmesini bekle
            return;
        }

        // 2. Durum: Mana Yeterli - Mesafe Ayarlama (Combat Spacing)
        // AI, oyuncuyla arasındaki mesafeyi her zaman 350px ile 600px "tatlı noktasında" tutmak ister
        if (this.evadeTimer <= 0) {
            if (dist > 650) {
                // Oyuncu çok uzaktaysa üzerine yürü
                ai.vx = ai.facingRight ? 3.5 : -3.5;
            } else if (dist < 220) {
                // Oyuncu çok yakınsa geriye kaç (Menzilli avantaj)
                ai.vx = ai.facingRight ? -3.5 : 3.5;
            } else {
                // Konum mükemmel, dur ve saldırı planla
                ai.vx = 0;

                // Saldırı Büyüsü Fırlatma Karar Algoritmaları
                this.executeSpellAI(ai, player);
            }
        }
    }

    /**
     * Karakter tiplerine ve oyuncu durumlarına göre en verimli büyüyü seçer.
     */
    executeSpellAI(ai, player) {
        // Oyuncu zaten yere serilmiş veya darbe yiyorsa bekle
        if (player.state === 'dead' || player.state === 'pain') return;

        if (ai.type === 'voldemort') {
            // --- VOLDEMORT AI STRATEJİSİ ---
            
            // 1. Senaryo: Ultimate (Avada Kedavra) Hazır!
            if (ai.ultCharge >= 100) {
                // Oyuncunun havadayken veya eğilirken ıskalamamak için, oyuncu tam ayakta/yerdeyken at!
                if (!player.isDucking && player.isGrounded) {
                    this.triggerSpell(ai, player, 3); // Avada Kedavra
                    return;
                }
            }

            // 2. Senaryo: Oyuncu Kalkanını (Protego) kaldırmış durumda bekliyor!
            if (player.shieldActive) {
                // Kalkanı delen alan hasarlı Confringo fırlat (Kalkanı tamamen cezalandır!)
                this.triggerSpell(ai, player, 1);
            } else {
                // Oyuncunun kalkanı kapalı ve savunmasızsa:
                if (Math.random() < 0.5) {
                    this.triggerSpell(ai, player, 2); // Crucio ile kilitle ve acı çektir
                } else {
                    this.triggerSpell(ai, player, 1); // Confringo ile bursts hasar ver
                }
            }
        } else {
            // --- MORGAN AI STRATEJİSİ ---
            
            // 1. Senaryo: Ultimate (Expelliarmus) Hazır!
            if (ai.ultCharge >= 100) {
                this.triggerSpell(ai, player, 3); // Expelliarmus (Stun) fırlat
                return;
            }

            // 2. Senaryo: Oyuncu kalkanını açık tutuyor
            if (player.shieldActive) {
                // Kalkanı zorlamak için sürekli alev dalgası (Incendio) bas
                // Incendio manayı kalkan tutmaktan çok daha az harcar, bu oyuncunun manasını eritir!
                this.triggerSpell(ai, player, 1);
            } else {
                // Oyuncu savunmasızsa:
                if (Math.random() < 0.6) {
                    this.triggerSpell(ai, player, 2); // Sinsi hızlı Sectumsempra fırlat
                } else {
                    this.triggerSpell(ai, player, 1); // Incendio ile yanma yükü biriktir
                }
            }
        }
    }

    /**
     * Büyü atma komutunu asıl motor tetikleyicisine iletir.
     */
    triggerSpell(ai, player, index) {
        // Eğer oyuncu zaten bir kanalizasyon altındaysa ve tekrar kanalize edilmek isteniyorsa kesintiyi önle
        if (ai.channelingSpell) return;

        // Büyü tetikleme komutunu çalıştır
        // index 1: Confringo/Incendio, index 2: Crucio/Sectumsempra, index 3: Ulti
        const mainJS = this.game; 
        
        // global scope veya main.js üzerinden castSpell fonksiyonunu tetikle
        // main.js içindeki castSpell fonksiyonu parametre olarak (caster, target, index) alır
        // Bu işlem asenkron veya doğrudan tetiklenebilir
        const castSpell = mainJS.canvas.ownerDocument.defaultView.castSpell || window.castSpell;
        
        if (castSpell) {
            castSpell(ai, player, index);
        } else {
            // Fallback: Eğer global scope'da bulunamazsa main.js içindeki yerel fonksiyon çağrısını taklit et
            // main.js'teki olay dinleyicisi ile doğrudan entegrasyon
            const p1 = this.game.p1;
            const p2 = this.game.p2;
            const target = (ai === p1) ? p2 : p1;
            
            // main.js'te bulunan castSpell yerel fonksiyonu aslında import edilmeksizin globalleşmiş durumdadır
            // Başlatma anında startBtn olayında tanımlanan yapı
            const globalCast = window.castSpell;
            if (typeof globalCast === 'function') {
                globalCast(ai, target, index);
            }
        }
    }
}
