/**
 * ============================================================================
 * HOGWARTS DUEL - BÜYÜ FİZİĞİ & PROJEKTİL / EFEKT YÖNETİCİSİ
 * ============================================================================
 * Bu modül; asadan çıkan projektil büyülerin uçuş fizikleri, kalkan etkileşimleri,
 * çarpışma algılamaları (Hitbox-Hurtbox), Confringo patlamaları, kan birikintileri
 * ve sürekli kanalize edilen ışın/alev çizim sistemlerini koordine eder.
 * 
 * Modüler Mimari Tasarımı (ES6):
 * - Büyü fırlatma süreçleri delta time (dt) tabanlıdır.
 * - Karakterin ayakta veya eğiliyor olma durumuna göre hasar alma kutuları (Hurtbox) dinamik hesaplanır.
 */

import { Engine, Vector2, ParticleFactory } from './engine.js';
import { particles } from './main.js';

/**
 * Uçuş Yolculuğu Yapan Projektil Büyüler Sınıfı
 * (Confringo, Sectumsempra, Expelliarmus mermileri bu sınıftan türetilir)
 */
export class Projectile {
    /**
     * @param {number} x - Başlangıç X koordinatı (Asa ucu)
     * @param {number} y - Başlangıç Y koordinatı
     * @param {number} vx - Saniyede kat edilecek yatay hız ivmesi
     * @param {object} owner - Büyüyü atan karakter referansı
     * @param {string} type - 'confringo', 'sectumsempra' veya 'expelliarmus'
     * @param {object} game - GameOrchestrator referansı
     */
    constructor(x, y, vx, owner, type, game) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = 0; // Gerekirse yerçekimli büyüler için dikey hız
        this.owner = owner;
        this.type = type;
        this.game = game;

        this.width = 75;
        this.height = 40;
        this.active = true;
        this.distanceTravelled = 0;
    }

    /**
     * Delta-time uyumlu pozisyon ve çarpışma güncelleyicisi.
     * @param {number} dt - Geçen zaman (saniye)
     * @param {object} target - Hedefteki rakip karakter referansı
     */
    update(dt, target) {
        const stepX = this.vx * 60 * dt;
        this.x += stepX;
        this.distanceTravelled += Math.abs(stepX);

        // Ekran dışına çıkan büyüleri pasifleştir
        if (this.x < -100 || this.x > 1380) {
            this.active = false;
            return;
        }

        // Dinamik Hurtbox Hesaplaması (Dövüş oyunu standardı)
        // Karakter eğiliyorsa hasar alma kutusu yarıya iner
        const targetH = target.isDucking ? 150 : 280;
        const targetW = target.width;
        const targetX = target.x - targetW / 2;
        const targetY = target.y - targetH;

        // Projektilin kendi Hitbox sınırları
        const projX = this.x - this.width / 2;
        const projY = this.y - this.height / 2;

        // AABB Dikdörtgen Çarpışma Testi
        if (Engine.rectCollision(
            projX, projY, this.width, this.height,
            targetX, targetY, targetW, targetH
        )) {
            // Karakter can çekişmiyorsa veya ölmediyse darbeyi işle
            if (target.state !== 'dead') {
                this.hit(target);
            }
        }
    }

    /**
     * Büyü hedefe ulaştığında veya kalkana çarptığında tetiklenir.
     */
    hit(target) {
        this.active = false;

        if (this.type === 'confringo') {
            // Confringo unblockable (korunamaz) bir büyüdür, kalkanı yok sayar!
            this.game.audio.playExplosion();
            target.takeDamage(18, true); // true: bypass shield

            // Ekrana sarsıntı ver ve patlama aftermath efekti oluştur
            this.game.triggerScreenShake(12, 0.3);
            this.game.spells.addEffect(new ExplosionEffect(this.x, this.y, this.game));
            
            // Etrafa yayılan ateş parçacıkları
            ParticleFactory.spawnFireExplosion(this.x, this.y, 25);
            
            // Başarılı vuruşta ulti barını doldur
            this.owner.ultCharge += 15;
        } 
        else if (this.type === 'sectumsempra') {
            if (target.shieldActive) {
                // Kalkan (Protego) ile engellendi!
                this.game.audio.playLightning();
                ParticleFactory.spawnShieldDeflect(this.x, this.y, this.vx > 0 ? 1 : -1, 15);
            } else {
                // Kalkan yoksa ağır fiziksel hasar ve kan fışkırması
                this.game.audio.playExplosion();
                target.takeDamage(24, false);
                
                // Sectumsempra Kan lekelerini rakibin üzerine yapıştır
                this.game.spells.addEffect(new BloodOverlay(target, this.game));
                ParticleFactory.spawnFireExplosion(this.x, this.y, 8); // Kan sıçraması yerine ateşle sönümleme
                this.owner.ultCharge += 20;
            }
        }
        else if (this.type === 'expelliarmus') {
            if (target.shieldActive) {
                // Kalkanla mükemmel zamanlama ile engellendi!
                this.game.audio.playLightning();
                ParticleFactory.spawnShieldDeflect(this.x, this.y, this.vx > 0 ? 1 : -1, 20);
            } else {
                // İsabet: Hafif hasar ve 3.5 saniye boyunca sersemletme (Stun)
                target.takeDamage(12, false);
                target.stunTimer = 3.5; // saniye cinsinden
                
                this.game.audio.playLightning();
                this.game.triggerScreenShake(6, 0.2);
                
                // Sersemleme pembe parıltılarını saç
                ParticleFactory.spawnStunSparkles(this.x, this.y - 50, 18);
            }
        }
    }

    /**
     * Projektil büyü görsellerinin çizimi.
     */
    draw(ctx) {
        let img = this.game.assets.images.confringo1;
        let isFlipped = this.vx < 0;

        if (this.type === 'confringo') {
            // Havada giderken confringo1 ve confringo2 kareleri arasında titreşerek uçar
            img = this.game.assets.images[`confringo${Math.floor(Date.now() / 100) % 2 + 1}`];
        } else if (this.type === 'sectumsempra') {
            // Sinsi büyü: İlk 420 piksel boyunca neredeyse görünmezdir (Hafif bir hava dalgası)
            if (this.distanceTravelled < 420) {
                ctx.save();
                ctx.globalAlpha = 0.05; // Şeffaf rüzgar kesiği
                Engine.drawRotatedImage(ctx, this.game.assets.images.sectumsempra, this.x, this.y, this.width, this.height, 0, 0.05, isFlipped, 0.5, 0.5);
                ctx.restore();
                return;
            }
            img = this.game.assets.images.sectumsempra;
        } else if (this.type === 'expelliarmus') {
            img = this.game.assets.images.expelliarmus;
        }

        Engine.drawRotatedImage(ctx, img, this.x, this.y, this.width, this.height, 0, 1.0, isFlipped, 0.5, 0.5);
    }
}

/**
 * Patlama Animasyonu Aftermath Sınıfı (Confringo)
 */
class ExplosionEffect {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.maxLife = 0.4; // 0.4 saniye sürer
        this.life = this.maxLife;
        this.size = 200;
    }

    update(dt) {
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        // Ömrü bittikçe soluklaşır
        ctx.globalAlpha = Engine.clamp(this.life / this.maxLife, 0, 1);
        
        // Çarpışma anındaki zamana göre patlama görselini değiştir (confringo3 veya confringo4)
        const img = this.life > (this.maxLife / 2) ? this.game.assets.images.confringo3 : this.game.assets.images.confringo4;
        ctx.drawImage(img, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        
        ctx.restore();
    }
}

/**
 * Sectumsempra Sonrası Gövdeye Yapışan Kan Lekesi Sınıfı
 */
class BloodOverlay {
    constructor(target, game) {
        this.target = target;
        this.game = game;
        this.maxLife = 1.2; // 1.2 saniye boyunca gövdede akar
        this.life = this.maxLife;
    }

    update(dt) {
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = Engine.clamp(this.life / this.maxLife, 0, 1);
        
        // Kan lekelerini hedefin mevcut hareketlerine ve pozisyonuna göre kilitle
        const size = 260;
        ctx.drawImage(this.game.assets.images.blood, this.target.x - size / 2, this.target.y - 200, size, size);
        
        ctx.restore();
    }
}

/**
 * Avada Kedavra Ölüm Işını Efekti Sınıfı (Görsel flash takibi)
 */
class AvadaKedavraBeam {
    constructor(startX, startY, endX, endY, game) {
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.game = game;
        this.maxLife = 0.35; // 0.35 saniye ekranda kalır
        this.life = this.maxLife;
    }

    update(dt) {
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = Engine.clamp(this.life / this.maxLife, 0, 1);
        
        // Yıldırımın yanlarında parlayan yeşil neon gölge
        ctx.shadowColor = '#00ff33';
        ctx.shadowBlur = 30;

        // Avada Kedavra şimşek görselini iki koordinat arasına ger
        // Şimşeğin aşırı kararsız durması için rastgele dikey dalgalanmalar ver
        const jitterY = 1.0 + (Math.random() * 0.4 - 0.2);
        Engine.drawStretchedBeam(ctx, this.game.assets.images.avadakedavra, this.startX, this.startY, this.endX, this.endY, 130, this.life / this.maxLife, jitterY);

        ctx.restore();
    }
}

/**
 * Tüm Büyüleri ve Alan Efektlerini Yöneten Sınıf (Orchestrator Module)
 */
export class SpellManager {
    constructor(game) {
        this.game = game;
        this.projectiles = [];
        this.effects = [];
    }

    /**
     * Tüm aktif büyüleri ve patlama izlerini temizler (Yeniden başlarken).
     */
    clearAll() {
        this.projectiles = [];
        this.effects = [];
    }

    /**
     * Havada giden mermi fırlatır.
     */
    addProjectile(proj) {
        this.projectiles.push(proj);
    }

    /**
     * Patlama, kan lekesi veya ışın izi ekler.
     */
    addEffect(eff) {
        this.effects.push(eff);
    }

    /**
     * Delta-time uyumlu merkezi güncelleme sistemi.
     */
    update(dt, p1, p2) {
        // Havada süzülen mermileri güncelle
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            
            // Eğer projektil p1'e aitse p2'yi vurabilir, aksi takdirde p1'i vurur
            const target = (proj.owner === p1) ? p2 : p1;
            proj.update(dt, target);

            if (!proj.active) {
                this.projectiles.splice(i, 1);
            }
        }

        // Alan ve patlama efektlerini güncelle
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const eff = this.effects[i];
            eff.update(dt);

            if (eff.life <= 0) {
                this.effects.splice(i, 1);
            }
        }
    }

    /**
     * Tüm büyüleri, mermileri ve sürekli kanalize edilen ışınları ekrana çizer.
     */
    draw(ctx) {
        // Önce patlama ve alan efektlerini çiz (Karakterlerin arkasında kalması için)
        this.effects.forEach(eff => eff.draw(ctx));

        // Havada giden mermileri çiz
        this.projectiles.forEach(proj => proj.draw(ctx));

        // Sürekli kanalize edilen Crucio ve Incendio büyü ışınlarını çiz (Her karede prosedürel hesaplanır)
        this.drawContinuousChannels(ctx);
    }

    /**
     * Her karede, kanalize edilen büyülere ait koordinatları gerçek zamanlı birleştirir.
     */
    drawContinuousChannels(ctx) {
        const p1 = this.game.p1;
        const p2 = this.game.p2;

        [p1, p2].forEach(caster => {
            if (!caster.channelingSpell) return;
            const opponent = (caster === p1) ? p2 : p1;

            // Büyücünün bakış açısına göre asasının ucunu (başlangıç noktasını) bul
            const startX = caster.x + (caster.facingRight ? 50 : -50);
            const startY = caster.y - 140;

            // Hedef karakterin göğüs kafesi (Hurtbox merkezi)
            const targetX = opponent.x;
            const targetY = opponent.y - 120;

            if (caster.type === 'voldemort' && caster.channelingSpell === 'crucio') {
                // 1. Voldemort'un asasının ucunda dönen Crucio Vortex halkası çiz
                const swirlSize = 130;
                ctx.save();
                ctx.translate(startX, startY);
                // Girdabın kendi ekseninde sürekli dönmesini sağla
                ctx.rotate((Date.now() / 150) % (Math.PI * 2));
                ctx.globalAlpha = 0.9;
                ctx.drawImage(this.game.assets.images.crucio, -swirlSize / 2, -swirlSize / 2, swirlSize, swirlSize);
                ctx.restore();

                // 2. Kalkan aktif değilse girdaptan hedefe uzanan prosedürel zig-zag mor yıldırım
                if (!opponent.shieldActive) {
                    ctx.save();
                    ctx.strokeStyle = '#bf55ec';
                    ctx.lineWidth = 4 + Math.random() * 4; // Sürekli kalınlık değişimi
                    ctx.shadowColor = '#bf55ec';
                    ctx.shadowBlur = 15;
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);

                    // Yıldırımı 10 kırıklı segmente bölüp aralara rastgele sarsıntı (jitter) ekle
                    const segments = 10;
                    for (let i = 1; i <= segments; i++) {
                        let px = startX + (targetX - startX) * (i / segments);
                        let py = startY + (targetY - startY) * (i / segments);
                        
                        // Son segment hariç kırılma titreşimleri ekle
                        if (i < segments) {
                            px += (Math.random() * 2 - 1) * 15;
                            py += (Math.random() * 2 - 1) * 15;
                        }
                        ctx.lineTo(px, py);
                    }
                    ctx.stroke();
                    ctx.restore();

                    // Acı parçacıkları fışkırt
                    ParticleFactory.spawnCrucioPain(targetX, targetY, 2);
                }
            } 
            else if (caster.type === 'morgan' && caster.channelingSpell === 'incendio') {
                // 3. Morgan'ın Incendio alev dalgası çizimi
                // incendio1, incendio2 ve incendio3 görsellerini hızlıca döngüye sokarak harlama yarat
                const flameImg = this.game.assets.images[`incendio${Math.floor(Date.now() / 80) % 3 + 1}`];
                
                ctx.save();
                // Kalkan aktifse alev dalgasını kalkan yüzeyinde (mesafede) kısıtla
                let finalTargetX = targetX;
                let finalTargetY = targetY;

                if (opponent.shieldActive) {
                    // Kalkanın yarıçapı kadar mesafeyi asaya doğru geri çek
                    const angle = Vector2.angleBetween(startX, startY, targetX, targetY);
                    const shieldRadius = 150;
                    finalTargetX = targetX - Math.cos(angle) * shieldRadius;
                    finalTargetY = targetY - Math.sin(angle) * shieldRadius;
                    
                    // Kalkan üzerinde çarpma kıvılcımları oluştur
                    if (Math.random() < 0.3) {
                        ParticleFactory.spawnShieldDeflect(finalTargetX, finalTargetY, caster.facingRight ? 1 : -1, 3);
                    }
                }

                // Alev görselini başlangıç ve bitiş arasına ger
                const angle = Vector2.angleBetween(startX, startY, finalTargetX, finalTargetY);
                const distance = Vector2.distance(startX, startY, finalTargetX, finalTargetY);

                ctx.translate(startX, startY);
                ctx.rotate(angle);
                ctx.drawImage(flameImg, 0, -55, distance, 110);
                ctx.restore();
            }
        });
    }

    /**
     * Voldemort'un Avada Kedavra yeşil şimşeğini anında haritaya basar.
     */
    triggerAvadaBeam(startX, startY, endX, endY) {
        this.addEffect(new AvadaKedavraBeam(startX, startY, endX, endY, this.game));
    }
}
