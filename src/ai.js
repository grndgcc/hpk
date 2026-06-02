/**
 * ============================================================================
 * HOGWARTS DUEL - TAKTİKSEL YAPAY ZEKA (ADVANCED TACTICAL AI) (5. AŞAMA)
 * ============================================================================
 * Bu sınıf; rakip büyücünün (AI) tüm karar alma, mermi yörünge simülasyonu,
 * yer hedefli tehlikelerden kaçınma, kalkan parry zamanlamaları ve akıllı
 * kombo cezalandırma mekaniklerini yönetir.
 * 
 * 5. Aşama Güncellemeleri:
 * - 120 kare ileriye dönük CPU yörünge simülasyon motoru kuruldu.
 * - Confringo uyarı çemberinden zıplayarak veya yürüyerek kaçınma eklendi.
 * - Oyuncunun büyü okuma gecikmesini yakalayıp büyü kesme (interrupt) taktiği yazıldı.
 * - Milisaniyelik Perfect Protego Parry sistemi entegre edildi.
 * - Karakter tipine göre özel savaş mesafesi (spacing) yapay zekası yazıldı.
 */

import { Engine, Vector2 } from './engine.js';
import { ConfringoArea } from './spell.js';

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
        this.decisionTimer = 0;          // Genel taktiksel durum analiz periyodu
        this.decisionInterval = 0.15;     // CPU yükü gözetmeksizin 150ms'de bir stratejik durum analizi yapılır
        
        // İnsansı reaksiyon gecikmeleri kuyruğu
        this.reactionQueue = [];

        // Kaçınma / Geri çekilme zamanlayıcıları
        this.evadeTimer = 0;
        this.evadeDirection = 0;
    }

    /**
     * Eylem kuyruğuna gecikmeli bir hamle ekler.
     */
    queueAction(delay, callback) {
        this.reactionQueue.push(new DelayedAction(delay, callback));
    }

    /**
     * Reaksiyon kuyruğunda bekleyen tüm gecikmeli eylemleri temizler.
     */
    clearReactionQueue() {
        this.reactionQueue = [];
    }

    /**
     * Maçın gidişatına göre dinamik olarak tepki süresi hesaplar.
     * AI kaybederken veya canı azken odaklanması (reaksiyon hızı) maksimuma ulaşır.
     */
    getReactionDelay(ai) {
        const playerScore = this.game.p1Score;
        const aiScore = this.game.p2Score;

        let baseDelay = 0.20; // Standart reaksiyon süresi (200ms)

        // AI raunt gerideyse reaksiyon hızı 110ms'ye kadar iner
        if (playerScore === 1 && aiScore === 0) {
            baseDelay = 0.11;
        }

        // Kendi canı %30'un altındaysa adrenalin bonusuyla reaksiyon hızlanır
        if (ai.hp < 75) {
            baseDelay -= 0.04;
        }

        const jitter = (Math.random() * 0.04) - 0.02; // +-20ms insansı sapma
        return Math.max(0.06, baseDelay + jitter);
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

        // 1. Gecikmeli Tepki Kuyruğunun İşletilmesi
        for (let i = this.reactionQueue.length - 1; i >= 0; i--) {
            const action = this.reactionQueue[i];
            action.delay -= dt;
            if (action.delay <= 0) {
                action.callback();
                this.reactionQueue.splice(i, 1);
            }
        }

        // 2. DEFANSİF REAKSİYON KATMANI (Her Karede CPU Gelecek Öngörü Simülasyonu)
        this.handleReactiveDefense(dt, ai, player);

        // 3. OFANSİF STRATEJİ KATMANI (Belirli periyotlarla tetiklenir)
        this.decisionTimer += dt;
        if (this.decisionTimer >= this.decisionInterval) {
            this.decisionTimer -= this.decisionInterval;
            this.handleTacticalOffense(ai, player);
        }

        // Kaçınma depar süresi bittiğinde yön ivmesini sıfırla
        if (this.evadeTimer > 0) {
            this.evadeTimer -= dt;
            ai.vx = this.evadeDirection * 5.0;
        }
    }

    /**
     * Madde 9: Gelecek Öngörülü Yoğun CPU Tehdit Analiz ve Parry Motoru
     */
    handleReactiveDefense(dt, ai, player) {
        // --- 1. KISIM: YERDEKİ CONFRINGO UYARI ÇEMBERİ ANALİZİ ---
        // Yerde parlayan bir Confringo rünü var mı tara
        const confringoThreat = this.game.spells.effects.find(eff => eff instanceof ConfringoArea && !eff.exploded);
        if (confringoThreat) {
            const distToExplosion = Math.abs(ai.x - confringoThreat.x);
            
            // Eğer AI tehlike alanının (150px yarıçap) içindeyse kaçınma planla
            if (distToExplosion < 140) {
                // Patlamaya kalan süre kritik seviyedeyse zıplayarak veya kaçarak dodgela
                if (confringoThreat.life < 0.4 && ai.isGrounded) {
                    this.clearReactionQueue();
                    
                    if (Math.random() < 0.70) {
                        // %70 ihtimalle süzülmeli yüksek zıplamayla kaçınır
                        ai.vy = -19;
                        ai.isGrounded = false;
                    } else {
                        // %30 ihtimalle ters yöne depar atarak kaçınır
                        this.evadeTimer = 0.35;
                        this.evadeDirection = ai.x > confringoThreat.x ? 1 : -1;
                    }
                }
            }
        }

        // --- 2. KISIM: CPU MERMİ YÖRÜNGE SİMÜLASYONU VE PERFECT PARRY ---
        const activeProjectiles = this.game.spells.projectiles;
        
        // Yapay zekaya doğru yaklaşan en yakın tehlikeli mermiyi bul
        const threat = activeProjectiles.find(proj => {
            const isMovingTowardsAI = (proj.vx < 0 && ai.x < proj.x) || (proj.vx > 0 && ai.x > proj.x);
            return proj.owner === player && isMovingTowardsAI;
        });

        if (threat) {
            // Merminin gelecekteki 120 karesini sanal döngüde önden çalıştır
            let tempX = threat.x;
            let tempY = threat.y;
            let stepsToCollide = -1; // Çarpışmaya kalan kare sayısı

            for (let step = 0; step < 120; step++) {
                tempX += threat.vx * 60 * 0.016; // 60 FPS fizikli kare adımları

                // Yapay zekanın hasar kutusu sınırları
                const targetH = ai.isDucking ? 150 : 280;
                const targetW = ai.width || 80;
                const targetX = ai.x - targetW / 2;
                const targetY = ai.y - targetH;

                // Merminin o karedeki sınırları
                const projX = tempX - threat.width / 2;
                const projY = tempY - threat.height / 2;

                if (Engine.rectCollision(projX, projY, threat.width, threat.height, targetX, targetY, targetW, targetH)) {
                    stepsToCollide = step;
                    break; // Çarpışma anı bulundu, simülasyonu sonlandır
                }
            }

            // Eğer simülasyon merminin kesinlikle çarpacağını tespit ettiyse:
            if (stepsToCollide !== -1) {
                // Mermi yüksekten uçuyorsa eğilerek atlat (ducking)
                if (threat.y < 440 && stepsToCollide < 20) {
                    ai.isDucking = true;
                    return;
                }

                // Mermi gövde hizasındaysa ve kalkan kapalıysa:
                if (!ai.shieldActive) {
                    // Kusursuz Bloklama (Perfect Parry): Çarpışmaya 8 kareden az (130ms) kala kalkanı tetikle!
                    if (stepsToCollide < 8) {
                        if (ai.mana > 12) {
                            ai.shieldActive = true;
                        }
                    }
                }
            }
        } else {
            // Havada aktif bir tehdit kalmadıysa kalkanı anında kapatarak manayı koru
            if (ai.shieldActive && !player.channelingSpell) {
                ai.shieldActive = false;
            }
        }

        // Oyuncu Crucio veya Incendio kanalize ediyorsa ve menzildeyse kalkanı açık tut
        if (player.channelingSpell && Math.abs(player.x - ai.x) < 750) {
            if (!ai.shieldActive && ai.mana > 20) {
                ai.shieldActive = true;
            }
        }
    }

    /**
     * Taktiksel Saldırı, Pozisyon Alma ve Alan Cezalandırma Yapay Zekası
     */
    handleTacticalOffense(ai, player) {
        const dist = Math.abs(ai.x - player.x);

        // Kanalize büyü devam ediyorsa hareketi dondur
        if (ai.channelingSpell) {
            return;
        }

        // 1. DURUM: DEPLASMAN VE DEFANSİF turtle MODU (Mana < 25)
        if (ai.mana < 25) {
            ai.shieldActive = false;
            ai.vx = ai.facingRight ? -4.0 : 4.0; // Geri çekil
            ai.isDucking = true; // Hurtbox'ı daraltarak menzilli mermilerin üstünden geçmesini bekle
            return;
        } else {
            ai.isDucking = false;
        }

        // 2. DURUM: KOMBO VE BÜYÜ İPTAL CEZALANDIRMASI (INTERRUPT)
        // Madde 10: Eğer oyuncu büyü sözü söylüyorsa (gecikme kilitliyse), büyü fırlatarak onu havada kes!
        if (player.castDelayTimer > 0.1 && dist < 750) {
            if (ai.type === 'voldemort') {
                // Voldemort Confringo'yu oyuncunun bastığı yere anında dikerek kilitler
                this.triggerSpell(ai, player, 1);
                return;
            } else {
                // Morgan hızlı bir Sectumsempra mermisi fırlatıp oyuncunun büyü okumasını havada böler
                this.triggerSpell(ai, player, 2);
                return;
            }
        }

        // 3. DURUM: AKILLI SAVAŞ MESAFESİ (SPACING SENSORS)
        // Karakter tiplerine ve alev/büyü menzillerine göre optimum alan koruma
        let targetMinDist = 450;
        let targetMaxDist = 650;

        if (ai.type === 'morgan') {
            // Morgan, yeni 500px Incendio sınırını bildiği için daha yakında (350px-480px) durmak ister
            targetMinDist = 330;
            targetMaxDist = 480;
        }

        if (this.evadeTimer <= 0) {
            if (dist > targetMaxDist) {
                // Rakip çok uzaktaysa üzerine yürü
                ai.vx = ai.facingRight ? 3.8 : -3.8;
            } else if (dist < targetMinDist) {
                // Rakip çok yakınsa geri adımlarla mesafeyi aç
                ai.vx = ai.facingRight ? -3.8 : 3.8;
            } else {
                // Spacing kusursuz hizada, dur ve ofansif rotasyona başla
                ai.vx = 0;
                this.executeSpellAI(ai, player);
            }
        }
    }

    /**
     * Karakter tipine özel akıllı büyü rotasyon sistemi
     */
    executeSpellAI(ai, player) {
        if (player.state === 'dead' || player.state === 'pain') return;

        if (ai.type === 'voldemort') {
            // --- VOLDEMORT KOMBO SİSTEMİ ---
            
            // Ultimate (Avada Kedavra) hazır durumdaysa:
            if (ai.ultCharge >= 100) {
                // Oyuncu havada zıplamıyorsa veya eğilmiyorsa (ıskalama payını sıfıra indir) at!
                if (!player.isDucking && player.isGrounded && player.castDelayTimer === 0) {
                    this.triggerSpell(ai, player, 3); // Avada Kedavra lanetini oku
                    return;
                }
            }

            // Oyuncu kalkanını (Protego) kaldırmış kilitli bekliyorsa:
            if (player.shieldActive) {
                // Kalkanı delip hasar veren yer hedefli Confringo rününü dik
                this.triggerSpell(ai, player, 1);
            } else {
                // Kalkanı kapalıysa:
                if (Math.random() < 0.45) {
                    this.triggerSpell(ai, player, 2); // Crucio ile kilitleyip saniyede 16 hasar ver
                } else {
                    this.triggerSpell(ai, player, 1); // Confringo patlaması yerleştir
                }
            }
        } else {
            // --- MORGAN KOMBO SİSTEMİ ---
            
            // Ultimate (Expelliarmus) hazır durumdaysa:
            if (ai.ultCharge >= 100) {
                this.triggerSpell(ai, player, 3); // 3.5s kilitleyen sersemletmeyi yolla
                return;
            }

            // Oyuncu kalkanını açık tutuyorsa:
            if (player.shieldActive) {
                // Incendio alev fırtınasıyla kalkan manasını saniyede 14 birim erit
                this.triggerSpell(ai, player, 1);
            } else {
                // Kalkanı kapalıysa:
                if (Math.random() < 0.55) {
                    this.triggerSpell(ai, player, 2); // Sinsi yavaş Sectumsempra mermisini fırlat
                } else {
                    this.triggerSpell(ai, player, 1); // Incendio ile alev püskürt ve yakma yükü biriktir
                }
            }
        }
    }

    /**
     * Büyü tetikleme komutunu asıl motor köprüsüne iletir.
     */
    triggerSpell(ai, player, index) {
        if (ai.channelingSpell) return;

        const mainJS = this.game; 
        const castSpell = mainJS.canvas.ownerDocument.defaultView.castSpell || window.castSpell;
        
        if (castSpell) {
            castSpell(ai, player, index);
        } else {
            const globalCast = window.castSpell;
            if (typeof globalCast === 'function') {
                globalCast(ai, player, index);
            }
        }
    }
}
