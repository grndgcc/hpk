/**
 * ============================================================================
 * HOGWARTS DUEL - KARAKTER SINIFI & FİZİK / ANIMASYON YÖNETİCİSİ (1. AŞAMA)
 * ============================================================================
 * Bu dosya, düellodaki büyücülerin fizik simülasyonlarını, can/mana/ulti durumlarını,
 * hasar alma, zehir yükü biriktirme ve gelişmiş animasyon kilitlerini yönetir.
 * 
 * 1. Aşama Güncellemeleri:
 * - Süzülmeli yüksek zıplama mekaniği eklendi (vy ve yerçekimi optimize edildi).
 * - Büyü sözü söyleme duraklamasını sağlayan castDelayTimer entegre edildi.
 * - Saldırı animasyonlarının loop etmeyip son karede donması sağlandı.
 * - Voldemort kalkanının yön (mirror/flip) hatası giderildi.
 * - Dengeli pacing için can sınırları artırıldı ve pasif ulti dolumu eklendi.
 */

import { Engine, ParticleFactory } from './engine.js';

/**
 * Karakterlerin kafalarının üzerinde beliren konuşma/büyü kutusu sınıfı.
 * Büyücü bir büyü fırlattığında büyü sözünü söylemesi için ekranda çizilir.
 */
export class SpeechBubble {
    /**
     * @param {string} text - Balonun içinde yazacak olan büyü sözü
     * @param {number} x - Karakterin X koordinatı
     * @param {number} y - Karakterin kafa üstü koordinatı
     */
    constructor(text, x, y) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.maxLife = 1.0; // Büyü sözünün ekranda kalacağı süre (1 saniye)
        this.life = this.maxLife;
    }

    /**
     * Balonun konumunu ve kalan süresini günceller.
     * @param {number} dt - Geçen delta süresi (saniye)
     * @param {number} x - Karakterin anlık X koordinatı
     * @param {number} y - Karakterin anlık kafa üstü koordinatı
     */
    update(dt, x, y) {
        this.x = x;
        this.y = y;
        this.life -= dt;
    }

    /**
     * Konuşma balonunu şık bir koyu cam kartı ve altın çerçeveyle çizer.
     * @param {CanvasRenderingContext2D} ctx - Çizim yapılacak tuval referansı
     */
    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.font = 'bold 16px "Cinzel", Arial, sans-serif';
        const metrics = ctx.measureText(this.text);
        const paddingW = 18;
        const w = metrics.width + paddingW;
        const h = 28;
        
        // Balonun yerleşeceği kutu sınırları
        const rx = this.x - w / 2;
        const ry = this.y - 45 - h;

        // Yumuşak geçişli opaklık (Fade-out efekti)
        ctx.globalAlpha = Engine.clamp(this.life / 0.2, 0, 1);

        // Arka Plan Kartı
        ctx.fillStyle = 'rgba(12, 15, 18, 0.92)';
        ctx.strokeStyle = '#d4af37'; // Tematik altın rengi çerçeve
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 6);
        ctx.fill();
        ctx.stroke();

        // Aşağıyı (Asa ucunu) gösteren küçük işaretçi üçgeni
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.moveTo(this.x - 6, ry + h);
        ctx.lineTo(this.x + 6, ry + h);
        ctx.lineTo(this.x, ry + h + 6);
        ctx.fill();

        // Metin Çizimi
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, ry + h / 2 + 1);
        
        ctx.restore();
    }
}

/**
 * Ana Karakter Yönetim Sınıfı (Büyücüler)
 */
export class Character {
    /**
     * @param {string} type - 'voldemort' veya 'morgan'
     * @param {boolean} isPlayer - Oyuncu mu yoksa yapay zeka mı?
     * @param {number} startX - Savaş alanındaki başlangıç X koordinatı
     * @param {object} game - GameOrchestrator referansı (Ana motor erişimi)
     * @param {object} config - Evrensel konfigürasyon değişkenleri
     */
    constructor(type, isPlayer, startX, game, config) {
        this.type = type;
        this.isPlayer = isPlayer;
        this.game = game;
        this.config = config;

        // Pozisyon ve Fizik Değişkenleri
        this.x = startX;
        this.y = this.config.FLOOR_Y;
        this.vx = 0;
        this.vy = 0;
        this.height = 280; // Sabit boy kilidi (Fighting Oyunu Standardı)

        // Temel İstatistikler (Dengeleme ve daha uzun düellolar için can havuzu artırıldı)
        this.maxHp = 250;
        this.hp = this.maxHp;
        this.mana = 100;
        this.ultCharge = 0;

        // Durum Değişkenleri (FSM)
        this.facingRight = isPlayer;
        this.isGrounded = true;
        this.isDucking = false;
        this.state = 'idle'; // 'idle', 'walk', 'cast', 'pain', 'stun', 'dead'

        // Animasyon Zamanlayıcıları ve Süreç Sayaçları
        this.animTimer = 0;
        this.walkCycleIndex = 0;
        this.painTimer = 0;
        this.stunTimer = 0;

        // Madde 10: Büyü sözü söyleme ve animasyon duraklatma sayacı
        this.castDelayTimer = 0; 

        // Madde 3: Saldırı animasyonunun loop etmeyip son karede donmasını sağlayan süreölçer
        this.castTimer = 0;

        // Büyü ve Kalkan Bayrakları
        this.shieldActive = false;
        this.channelingSpell = null; // 'crucio' veya 'incendio'

        // Üzerindeki DoT (Zamanla Alınan Hasar) Etkileri
        this.burnStacks = 0;
        this.burnTimer = 0;
        this.burnTickAccumulator = 0; // Saniye bazlı hasar hesaplayıcı

        // Aktif Konuşma Balonu
        this.bubble = null;
    }

    /**
     * Karakterin kafasının üzerinde büyü ismi yazdırır.
     * @param {string} text - Söylenecek büyü sözü
     */
    say(text) {
        this.bubble = new SpeechBubble(text, this.x, this.y - this.height);
    }

    /**
     * Karakter hasar aldığında tetiklenen merkezi metod.
     * @param {number} amount - Alınacak hasar miktarı
     * @param {boolean} bypassShield - Kalkanı (Protego) yok sayan patlamalı hasar mı?
     */
    takeDamage(amount, bypassShield = false) {
        if (this.state === 'dead') return;

        // Kalkan (Protego) aktifse ve gelen hasar kalkanı delmiyorsa hasarı engelle
        if (this.shieldActive && !bypassShield) {
            const dirX = this.facingRight ? 1 : -1;
            // Engelleyici kıvılcımları asanın yüksekliğine (y - 210) hizala
            ParticleFactory.spawnShieldDeflect(this.x + dirX * 60, this.y - 210, dirX, 12);
            
            // Kalkan engellemesinde mavi renkli "PROTEGO" uçan yazısı fırlatır
            if (this.game && this.game.spells) {
                this.game.spells.addFloatingText("PROTEGO", this.x, this.y - 230, '#3399ff');
            }
            return;
        }

        // Hasarı can değerinden düş
        this.hp = Math.max(0, this.hp - amount);

        // Alınan hasarı ekranda kırmızı renkle uçan hasar sayısı olarak fırlatır
        if (amount >= 1 && this.game && this.game.spells) {
            this.game.spells.addFloatingText("-" + Math.round(amount), this.x, this.y - 180, '#ff3333');
        }

        // Hasar yenildiğinde kanalize edilen büyüleri kes
        if (this.channelingSpell) {
            this.stopChannel();
        }

        if (this.hp <= 0) {
            // Ölüm Durumu
            this.state = 'dead';
            this.vx = 0;
            this.vy = 0;
            this.stopChannel();
        } else {
            // Kısa Süreli Sarsılma (Flinch) Durumu
            this.state = 'pain';
            this.painTimer = 0.3; // 0.3 saniye boyunca kilitlenir
            this.vx = 0;
            this.castDelayTimer = 0; // Hasar alındığında büyü hazırlığı iptal olur
            
            // Hasar tipine göre darbe kıvılcımları saç
            ParticleFactory.spawnFireExplosion(this.x, this.y - 120, 5);
        }
    }

    /**
     * Incendio büyüsünden yanma yükü alır. Hasar saniye bazlı birikerek katlanır.
     */
    addBurnStack() {
        if (this.burnStacks < 5) {
            this.burnStacks++;
        }
        this.burnTimer = 4.0; // Her yanma yükü 4 saniye aktif kalır
    }

    /**
     * Devam eden sürekli büyüleri (Crucio / Incendio) durdurur.
     */
    stopChannel() {
        if (this.channelingSpell === 'incendio') {
            this.game.audio.stopFlame();
        }
        this.channelingSpell = null;
    }

    /**
     * Delta-time entegrasyonlu fiziksel güncelleme döngüsü.
     * @param {number} dt - İki kare arasında geçen süre (saniye)
     * @param {object} opponent - Karşıdaki rakip karakter referansı
     */
    update(dt, opponent) {
        this.ultCharge = Math.min(100, this.ultCharge);

        // Her zaman rakibe doğru yönel (Dövüş oyunu standardı)
        this.facingRight = (opponent.x > this.x);

        // Madde 11: Ultimate atılmasını kolaylaştırmak için saniyede pasif ulti birikimi eklendi
        if (this.state !== 'dead') {
            this.ultCharge = Math.min(100, this.ultCharge + 2.0 * dt); // Saniyede pasif +2.0 ulti şarjı
        }

        // Madde 10: Büyü sözü söyleme gecikmesi sayacını işlet
        if (this.castDelayTimer > 0) {
            this.castDelayTimer -= dt;
            this.vx = 0; // Büyü hazırlığı sırasında karakterin yürümesini engelle
        }

        // 1. Sersemletilme (STUN - Expelliarmus) Durum Kontrolü
        if (this.stunTimer > 0) {
            this.stunTimer -= dt;
            this.state = 'stun';
            this.vx = 0;
            this.shieldActive = false;
            this.castDelayTimer = 0;
            this.stopChannel();

            // Kafanın üzerinde dönen sersemleme kıvılcımları saç
            if (Math.random() < 0.25) {
                ParticleFactory.spawnStunSparkles(this.x + (Math.random() * 40 - 20), this.y - this.height - 10, 2);
            }
        }

        // 2. Darbe Alma (PAIN) Geri Kazanım Kontrolü
        if (this.state === 'pain') {
            this.painTimer -= dt;
            this.vx = 0;
            if (this.painTimer <= 0) {
                this.state = 'idle';
            }
        }

        // 3. Yanma (DoT) Hasar Hesaplamaları (Morgan Incendio etkisi)
        if (this.burnStacks > 0) {
            this.burnTimer -= dt;
            this.burnTickAccumulator += dt;

            // Her 0.5 saniyede bir yanma hasarı ver
            if (this.burnTickAccumulator >= 0.5) {
                this.burnTickAccumulator -= 0.5;
                const burnDamage = this.burnStacks * 0.75;
                this.hp = Math.max(0, this.hp - burnDamage);
                
                // Karakterin üzerinden alev kıvılcımları fırlat
                ParticleFactory.spawnFireExplosion(this.x + (Math.random() * 60 - 30), this.y - 120, 3);

                if (this.hp <= 0) {
                    this.state = 'dead';
                    this.vx = 0;
                    this.stopChannel();
                }
            }

            if (this.burnTimer <= 0) {
                this.burnStacks = 0;
                this.burnTickAccumulator = 0;
            }
        }

        // 4. Enerji (Mana) Yenilenmesi ve Protego Tüketim Hesabı
        if (this.state !== 'dead') {
            let manaDelta = 9.0 * dt; // Saniyede +9 mana yenilenme tabanı
            
            if (this.shieldActive) {
                manaDelta = -36.0 * dt; // Protego kalkanını açık tutmak saniyede -36 mana harcar!
            }
            
            this.mana = Math.min(100, Math.max(0, this.mana + manaDelta));

            // Manası sıfırlanan büyücünün kalkanı anında kırılır
            if (this.mana <= 0 && this.shieldActive) {
                this.shieldActive = false;
                this.game.triggerScreenShake(5, 0.15); // Kalkan kırılma sarsıntısı
                ParticleFactory.spawnShieldDeflect(this.x, this.y - 210, this.facingRight ? 1 : -1, 8);
            }
        }

        // 5. Kalkan Koruması Durum Önceliği
        if (this.shieldActive) {
            this.vx = 0;
            this.state = 'cast';
        }

        // 6. Fiziksel Yerçekimi ve Zıplama İvmelenmesi
        // Madde 4: Zıplayarak mermilerden kaçabilmek için dikey fizik süzülme çarpanı yumuşatıldı
        if (!this.isGrounded) {
            this.vy += this.config.GRAVITY * 55 * dt; // Süzülme hissi için yerçekimi katsayısı ayarlandı
            this.y += this.vy * 60 * dt;

            if (this.y >= this.config.FLOOR_Y) {
                this.y = this.config.FLOOR_Y;
                this.vy = 0;
                this.isGrounded = true;
            }
        }

        // Yatay hareket ivmesini uygula
        this.x += this.vx * 60 * dt;

        // Ekran Sınırlarının Korunması (Büyücülerin dövüş arenası sınırları dışına kaçamaması)
        this.x = Math.max(80, Math.min(this.config.VIRTUAL_WIDTH - 80, this.x));

        // 7. Durum Öncelik Hiyerarşisi (State Machine Resolver)
        // Madde 10: castDelayTimer sayacı aktifken karakterin cast durumunda kalması sağlandı (Sectumsempra düzeltmesi)
        if (this.state !== 'pain' && this.state !== 'dead' && this.state !== 'stun') {
            if (this.castDelayTimer > 0 || this.shieldActive || this.channelingSpell) {
                this.state = 'cast';
            } else if (Math.abs(this.vx) > 0.1) {
                this.state = 'walk';
            } else {
                this.state = 'idle';
            }
        }

        // Madde 3: Saldırı animasyonunun son karede kilitlenmesi için castTimer takibi
        if (this.state === 'cast') {
            this.castTimer += dt;
        } else {
            this.castTimer = 0;
        }

        // 8. Konuşma Balonunun Güncellenmesi
        if (this.bubble) {
            this.bubble.update(dt, this.x, this.y - this.height);
            if (this.bubble.life <= 0) {
                this.bubble = null;
            }
        }

        // 9. Yürüme Karelerinin Hız Çarpan Takibi
        if (this.state === 'walk') {
            this.animTimer += dt;
            // Saniyede 12 kare yürüme canlandırma hızı
            if (this.animTimer >= 0.08) {
                this.animTimer -= 0.08;
                this.walkCycleIndex = (this.walkCycleIndex + 1) % 7;
            }
        }
    }

    /**
     * Büyücü karakteri ve kalkanını ekrana çizer.
     * @param {CanvasRenderingContext2D} ctx - Çizim yapılacak tuval referansı
     */
    draw(ctx) {
        ctx.save();
        
        let mustFlip = !this.facingRight;
        
        // Akıllı Yedekleme Sistemi (Görsellerin yüklenememesi ihtimaline karşı varsayılan ayakta durma görseli)
        const standImg = this.type === 'voldemort' ? this.game.assets.images.voldemortstand : this.game.assets.images.morganstand;
        let img = standImg;

        // Durum kalkanına göre doğru sprite karesini seç
        if (this.type === 'voldemort') {
            if (this.state === 'dead') {
                img = this.game.assets.images.voldemortwalk1 || standImg; // Yerde yatış tabanı
            } else if (this.state === 'pain') {
                img = this.game.assets.images.voldemortwalk4 || standImg; // Darbe alma karesi
            } else if (this.state === 'cast') {
                // Madde 3: Saldırı animasyonunun loop etmeyip son karede (Frame 3) donma mantığı
                const attackIndex = Math.min(2, Math.floor(this.castTimer / 0.1)); // 100ms'de bir kare atlar, maksimum 2. indekste (Frame 3) donar
                img = this.game.assets.images[`voldemortattack${attackIndex + 1}`] || standImg;
            } else if (this.state === 'walk') {
                img = this.game.assets.images[`voldemortwalk${this.walkCycleIndex + 1}`] || standImg;
            }
        } else { // Morgan Le Fay
            if (this.state === 'dead') {
                img = this.game.assets.images.morganwalk1 || standImg;
            } else if (this.state === 'pain') {
                img = this.game.assets.images.morganwalk4 || standImg;
            } else if (this.state === 'cast') {
                // Madde 3: Morgan saldırı animasyonu son karesinde sabitlenir
                const attackIndex = Math.min(2, Math.floor(this.castTimer / 0.1));
                img = this.game.assets.images[`morganattack${attackIndex + 1}`] || standImg;
            } else if (this.state === 'walk') {
                img = this.game.assets.images[`morganwalk${this.walkCycleIndex + 1}`] || standImg;
            }
        }

        // Son koruma önlemi (Görsel tamamen bulunamadıysa çizimi güvenle durdur)
        if (!img) {
            ctx.restore();
            return;
        }

        // Görsel genişliğini, asimetrik dikey bozulmayı önleyecek şekilde yüksekliğe oranla koru
        const aspect = img.width / img.height;
        const drawH = this.height;
        const drawW = drawH * aspect;

        // Darbe yendiğinde karakterin acı içinde sallanma sarsıntısı (Vibration Offset)
        let painShakeX = 0;
        if (this.state === 'pain') {
            painShakeX = (Math.random() * 2 - 1) * 8; // Milisaniyelik acı titremesi
        }

        let drawX = this.x + painShakeX;
        let drawY = this.y;

        // Karakter öldüyse gövdesini 90 derece yana devir
        if (this.state === 'dead') {
            ctx.translate(this.x, this.y);
            ctx.rotate(mustFlip ? -Math.PI / 2 : Math.PI / 2);
            // Ölen karakteri yerde düzgün hizalamak için offsetleri kaydır
            ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
            ctx.restore();
            return;
        }

        // Yatay çevirme ve hizalama mantığı
        if (mustFlip) {
            Engine.drawRotatedImage(ctx, img, drawX, drawY, drawW, drawH, 0, 1, true, 0.5, 1.0);
        } else {
            Engine.drawRotatedImage(ctx, img, drawX, drawY, drawW, drawH, 0, 1, false, 0.5, 1.0);
        }

        ctx.restore();

        // 10. Protego Kalkanı Çizimi (Gövde merkezli titreşimli kalkan)
        if (this.shieldActive) {
            ctx.save();
            const pulse = 1 + Math.sin(Date.now() / 100) * 0.05; // Titreşim dalgası
            const pSize = 340 * pulse;
            
            // Madde 8: Voldemort'un ve Morgan'ın Protego kalkanının yön (mirror/flipX) ve el hizalaması düzeltildi
            const shieldOffset = this.facingRight ? 60 : -60;
            const px = this.x + shieldOffset;
            const py = this.y - 145; // Göğüs ve asa hizası merkezi

            ctx.globalAlpha = 0.8;
            
            // Baktığı yöne göre kalkan görselini yatayda ters çevir (flipX)
            const flipShield = !this.facingRight;
            Engine.drawRotatedImage(ctx, this.game.assets.images.protego, px, py, pSize, pSize, 0, 0.8, flipShield, 0.5, 0.5);
            ctx.restore();
        }

        // 11. Konuşma Balonunu Çiz
        if (this.bubble) {
            this.bubble.draw(ctx);
        }
    }
}
