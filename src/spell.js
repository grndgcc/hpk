/**
 * ============================================================================
 * HOGWARTS DUEL - BÜYÜ FİZİĞİ & PROJEKTİL / EFEKT YÖNETİCİSİ (YENİ SÜRÜM)
 * ============================================================================
 * Bu modül; uçan mermi büyüleri, yer hedefli patlamaları (Confringo),
 * ulti büyü çarpışmalarını (Priori Incantatem), alev menzillerini ve hasar
 * sayıları gibi uçan yazıları yönetir.
 * 
 * Görsel Geliştirmeler:
 * - Avada Kedavra için yeşil dallanan (branching) prösedürel yıldırımlar eklendi.
 * - Expelliarmus mermisi için kırmızı kırıklı şimşek kuyrukları entegre edildi.
 */

import { Engine, Vector2, ParticleFactory, particles, EngineParticle } from './engine.js';

/**
 * Ekranda süzülerek yükselen arcade tarzı hasar ve durum yazıları sınıfı.
 */
class FloatingText {
    constructor(text, x, y, color = '#ff3333') {
        this.text = text;
        this.x = x;
        this.y = y;
        this.vy = -1.8; // Yukarı süzülme hızı
        this.color = color;
        this.life = 1.0; // Ekranda kalma süresi (1 saniye)
    }

    update(dt) {
        this.y += this.vy * 60 * dt;
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life); // Ömrü bittikçe soluklaşır
        ctx.fillStyle = this.color;
        ctx.font = 'bold 22px "Cinzel", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

/**
 * Yer Hedefli ve 1.2 Saniye Gecikmeli Confringo Alan Etkisi Sınıfı
 */
export class ConfringoArea {
    /**
     * @param {number} targetX - Rakibin büyü yapıldığı andaki X koordinatı
     * @param {object} game - GameOrchestrator referansı
     * @param {object} owner - Büyüyü atan büyücü referansı
     */
    constructor(targetX, game, owner) {
        this.x = targetX;
        this.y = 600; // Zemin yüksekliği (FLOOR_Y)
        this.game = game;
        this.owner = owner;
        this.maxLife = 1.2; // Rakibin kaçabilmesi için tam 1.2 saniye gecikme
        this.life = this.maxLife;
        this.exploded = false;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0 && !this.exploded) {
            this.exploded = true;
            this.explode();
        }
    }

    /**
     * Süre dolduğunda tetiklenen patlama ve hasar kontrolü.
     */
    explode() {
        const target = (this.owner === this.game.p1) ? this.game.p2 : this.game.p1;
        const dist = Math.abs(this.x - target.x);
        
        // Ekrana büyük sarsıntı ver ve patlama sesini çal
        this.game.triggerScreenShake(12, 0.3);
        this.game.audio.playExplosion();
        
        // Patlama animasyon ve parçacık efektlerini tetikle
        this.game.spells.addEffect(new ExplosionEffect(this.x, this.y - 120, this.game));
        ParticleFactory.spawnFireExplosion(this.x, this.y - 120, 25);

        // Rakip patlama menzili (150px) içindeyse ve havaya zıplamadıysa hasar almalı
        if (dist < 150) {
            // Karakter havaya sıçradıysa (y < 460) hasardan tamamen kurtulur (Dodge)
            if (target.y >= 460) {
                target.takeDamage(24, true); // Confringo kalkanı deler, 24 hasar verir
            } else {
                // Başarılı kaçınma durumunda oyuncunun üzerinde yeşil "DODGED" yazısı belirir
                this.game.spells.addFloatingText("DODGED", target.x, target.y - 40, '#33ff33');
            }
        }
    }

    /**
     * Patlama öncesi yerde beliren ve giderek kızaran uyarı çemberini çizer.
     */
    draw(ctx) {
        if (this.exploded) return;
        
        ctx.save();
        const progress = 1 - (this.life / this.maxLife);
        ctx.globalAlpha = 0.4 + progress * 0.5; // Süre yaklaştıkça daha parlak olur
        
        // Yerde parlayan kırmızı rün çemberi
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 3 + progress * 3;
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 10 + progress * 10;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, 120 * progress, 0, Math.PI * 2);
        ctx.stroke();
        
        // Sabit dış çember sınırı
        ctx.strokeStyle = 'rgba(255, 51, 51, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 120, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }
}

/**
 * Uçuş Yolculuğu Yapan Projektil Büyüler Sınıfı
 */
export class Projectile {
    /**
     * @param {number} x - Başlangıç X koordinatı
     * @param {number} y - Başlangıç Y koordinatı
     * @param {number} vx - Saniyede kat edilecek yatay hız ivmesi
     * @param {object} owner - Büyüyü atan karakter referansı
     * @param {string} type - 'sectumsempra' veya 'expelliarmus'
     * @param {object} game - GameOrchestrator referansı
     */
    constructor(x, y, vx, owner, type, game) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = 0; 
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
     */
    update(dt, target) {
        const stepX = this.vx * 60 * dt;
        this.x += stepX;
        this.distanceTravelled += Math.abs(stepX);

        if (this.x < -100 || this.x > 1380) {
            this.active = false;
            return;
        }

        const targetH = target.isDucking ? 150 : 280;
        const targetW = target.width;
        const targetX = target.x - targetW / 2;
        const targetY = target.y - targetH;

        const projX = this.x - this.width / 2;
        const projY = this.y - this.height / 2;

        if (Engine.rectCollision(
            projX, projY, this.width, this.height,
            targetX, targetY, targetW, targetH
        )) {
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

        if (this.type === 'sectumsempra') {
            if (target.shieldActive) {
                this.game.audio.playLightning();
                ParticleFactory.spawnShieldDeflect(this.x, this.y, this.vx > 0 ? 1 : -1, 15);
            } else {
                this.game.audio.playExplosion();
                target.takeDamage(24, false);
                
                this.game.spells.addEffect(new BloodOverlay(target, this.game));
                ParticleFactory.spawnFireExplosion(this.x, this.y, 8); 
                this.owner.ultCharge += 20;
            }
        }
        else if (this.type === 'expelliarmus') {
            if (target.shieldActive) {
                this.game.audio.playLightning();
                ParticleFactory.spawnShieldDeflect(this.x, this.y, this.vx > 0 ? 1 : -1, 20);
            } else {
                target.takeDamage(12, false);
                target.stunTimer = 3.5; 
                
                this.game.audio.playLightning();
                this.game.triggerScreenShake(6, 0.2);
                
                ParticleFactory.spawnStunSparkles(this.x, this.y - 50, 18);
            }
        }
    }

    /**
     * Projektil büyü görsellerinin çizimi.
     * Expelliarmus için arkasında kırmızı/pembe elektrik kırıkları çizer.
     */
    draw(ctx) {
        let img = this.game.assets.images.sectumsempra;
        let isFlipped = this.vx < 0;

        if (this.type === 'confringo') {
            img = this.game.assets.images[`confringo${Math.floor(Date.now() / 100) % 2 + 1}`];
        } else if (this.type === 'sectumsempra') {
            if (this.distanceTravelled < 420) {
                ctx.save();
                ctx.globalAlpha = 0.05; 
                Engine.drawRotatedImage(ctx, this.game.assets.images.sectumsempra, this.x, this.y, this.width, this.height, 0, 0.05, isFlipped, 0.5, 0.5);
                ctx.restore();
                return;
            }
            img = this.game.assets.images.sectumsempra;
        } else if (this.type === 'expelliarmus') {
            img = this.game.assets.images.expelliarmus;

            // --- EXPELLIARMUS ULTI MERMİSİ İÇİN KIRMIZI ŞİMŞEK KUYRUKLARI ---
            ctx.save();
            ctx.strokeStyle = '#ff0033'; // Parlak kızıl şimşek rengi
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 12;
            ctx.lineWidth = 2 + Math.random() * 2;
            
            const trailDirection = this.vx > 0 ? -1 : 1;
            // Arkaya doğru uzanan 3 kırıklı kızıl elektrik hattı oluşturur
            for (let t = 0; t < 3; t++) {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                let curX = this.x;
                let curY = this.y;
                const segments = 5;
                for (let s = 1; s <= segments; s++) {
                    curX += trailDirection * (25 + Math.random() * 15);
                    curY += (Math.random() * 2 - 1) * 18;
                    ctx.lineTo(curX, curY);
                }
                ctx.stroke();
            }
            ctx.restore();
        }

        Engine.drawRotatedImage(ctx, img, this.x, this.y, this.width, this.height, 0, 1.0, isFlipped, 0.5, 0.5);
    }
}

/**
 * Patlama Animasyonu Aftermath Sınıfı
 */
class ExplosionEffect {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.maxLife = 0.4; 
        this.life = this.maxLife;
        this.size = 200;
    }

    update(dt) {
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = Engine.clamp(this.life / this.maxLife, 0, 1);
        
        const img = this.life > (this.maxLife / 2) ? this.game.assets.images.confringo3 : this.game.assets.images.confringo4;
        
        // GÜVENLİK KONTROLÜ: Görsel yoksa veya yüklenmediyse oyunu çökertme, yedek vektör çiz!
        if (img && img.width > 0) {
            ctx.drawImage(img, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        } else {
            // Yedek patlama halkası (Görsel hatasında oyunun durmasını önler)
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size / 3.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 90, 0, 0.5)';
            ctx.fill();
            ctx.strokeStyle = '#ff3300';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

/**
 * Sectumsempra Kan Sıçrama Efekti
 */
class BloodOverlay {
    constructor(target, game) {
        this.target = target;
        this.game = game;
        this.maxLife = 1.2; 
        this.life = this.maxLife;
    }

    update(dt) {
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = Engine.clamp(this.life / this.maxLife, 0, 1);
        
        const size = 260;
        const img = this.game.assets.images.blood;
        
        // GÜVENLİK KONTROLÜ: Kan görseli bulunamadıysa çizmeyip es geçerek çökmeyi önler
        if (img && img.width > 0) {
            ctx.drawImage(img, this.target.x - size / 2, this.target.y - 200, size, size);
        } else {
            // Yedek kan damlası parçacıkları
            ctx.fillStyle = 'rgba(180, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.arc(this.target.x, this.target.y - 120, 15, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

/**
 * Avada Kedavra Ölüm Işını Efekti
 * Tamamen prösedürel yeşil dallanan yıldırımlarla çizilecek şekilde güncellendi.
 */
/**
 * Avada Kedavra Yeşil Dallanan Yıldırım Efekti Sınıfı
 */
class AvadaKedavraBeam {
    constructor(startX, startY, endX, endY, game) {
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.game = game;
        this.maxLife = 0.35; 
        this.life = this.maxLife;
    }

    update(dt) {
        this.life -= dt;
    }

    /**
     * Rekürsif (kendi kendini çağıran) yeşil yıldırım dallandırma fonksiyonu
     */
    drawLightningBranch(ctx, sx, sy, ex, ey, depth, maxDepth) {
        if (depth > maxDepth) return;
        
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        
        const dist = Vector2.distance(sx, sy, ex, ey);
        const segments = Math.max(5, Math.floor(dist / 30));
        let lastX = sx;
        let lastY = sy;
        
        ctx.strokeStyle = '#00ff33'; // Neon yeşili elektrik rengi
        ctx.lineWidth = Math.max(0.5, (4 - depth) * (this.life / this.maxLife)); // Derinliğe göre incelir
        ctx.shadowColor = '#00ff33';
        ctx.shadowBlur = 15;

        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            let px = sx + (ex - sx) * t;
            let py = sy + (ey - sy) * t;
            
            if (i < segments) {
                // Şimşeğin doğrultusuna dik açıda kırıklı pürüzler (jitter) ekle
                const angle = Vector2.angleBetween(sx, sy, ex, ey) + Math.PI / 2;
                const jitter = (Math.random() * 2 - 1) * (18 / (depth + 1));
                px += Math.cos(angle) * jitter;
                py += Math.sin(angle) * jitter;
            }
            
            ctx.lineTo(px, py);
            
            // Rastgele yan yıldırımlar (kılcal şimşekler) fırlatır
            if (Math.random() < 0.16 && depth < maxDepth && i < segments) {
                const branchAngle = Vector2.angleBetween(lastX, lastY, px, py) + (Math.random() * 0.9 - 0.45);
                const branchLength = dist * (1 - t) * 0.35;
                const bx = px + Math.cos(branchAngle) * branchLength;
                const by = py + Math.sin(branchAngle) * branchLength;
                this.drawLightningBranch(ctx, px, py, bx, by, depth + 1, maxDepth);
            }
            
            lastX = px;
            lastY = py;
        }
        ctx.stroke();
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = Engine.clamp(this.life / this.maxLife, 0, 1);
        
        // 3 ana koldan dallanan neon yeşili yıldırımı çizdirir
        this.drawLightningBranch(ctx, this.startX, this.startY, this.endX, this.endY, 0, 3);
        
        ctx.restore();
    }
}
/**
 * Tüm Büyüleri, Alan Efektlerini ve Yazıları Yöneten Sınıf (Orchestrator Module)
 */
export class SpellManager {
    constructor(game) {
        this.game = game;
        this.projectiles = [];
        this.effects = [];
        this.floatingTexts = [];
    }

    clearAll() {
        this.projectiles = [];
        this.effects = [];
        this.floatingTexts = [];
    }

    addProjectile(proj) {
        this.projectiles.push(proj);
    }

    addEffect(eff) {
        this.effects.push(eff);
    }

    addFloatingText(text, x, y, color) {
        this.floatingTexts.push(new FloatingText(text, x, y, color));
    }

    /**
     * Voldemort Confringo'yu yer hedefli tetiklediğinde çağrılır.
     */
    triggerConfringo(targetX, caster) {
        this.addEffect(new ConfringoArea(targetX, this.game, caster));
    }

    /**
     * Madde 6: Sadece iki nihai büyü (Avada Kedavra vs Expelliarmus) çarpışırsa tetiklenecek Priori Incantatem köprüsü.
     */
    triggerAvadaBeam(startX, startY, endX, endY) {
        // Havada süzülen aktif bir nihai Expelliarmus ultisi var mı tara
        const expellUlt = this.projectiles.find(p => p.type === 'expelliarmus' && p.active);

        if (expellUlt) {
            // Madde 6: Büyüler tam orta noktada Priori Incantatem ile çarpışır!
            const clashX = (startX + expellUlt.x) / 2;
            const clashY = startY; // İki büyü de omuz hizasında (y - 210)

            // Morgan nihai büyüsünü yok et
            expellUlt.active = false;

            // Avada Kedavra yeşil ışınını çarpışma noktasına kadar kısıtla
            this.addEffect(new AvadaKedavraBeam(startX, startY, clashX, clashY, this.game));

            // Dev kozmik sarsıntı ve ses patlaması
            this.game.triggerScreenShake(15, 0.45);
            this.game.audio.playExplosion();

            // Yeşil ve pembe neon patlama parçacıklarını etrafa saç
            for (let i = 0; i < 40; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 4 + Math.random() * 8;
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;
                const size = 3 + Math.random() * 5;
                const life = 0.6 + Math.random() * 0.8;
                const isGreen = Math.random() < 0.5;

                particles.push(new EngineParticle(
                    clashX, clashY,
                    isGreen ? { r: 0, g: 255, b: 50 } : { r: 255, g: 0, b: 180 },
                    { r: 20, g: 20, b: 20 },
                    size, vx, vy, life, 0.1
                ));
            }
            
            this.addFloatingText("CLASH!", clashX, clashY - 60, '#ffcc00');
        } else {
            // Havada ulti mermisi yoksa normal Avada Kedavra ışını hedefe kadar uzanır
            this.addEffect(new AvadaKedavraBeam(startX, startY, endX, endY, this.game));
        }
    }

    update(dt, p1, p2) {
        // 1. Mermileri güncelle
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const target = (proj.owner === p1) ? p2 : p1;
            proj.update(dt, target);

            if (!proj.active) {
                this.projectiles.splice(i, 1);
            }
        }

        // 2. Alan etkilerini ve Confringo gecikmelerini güncelle
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const eff = this.effects[i];
            eff.update(dt);

            if (eff.life <= 0) {
                this.effects.splice(i, 1);
            }
        }

        // 3. UÇAN HASAR YAZILARINI GÜNCELLE
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.update(dt);
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }

        // 4. SÜREKLİ BÜYÜ AKTİF ETKİLERİ VE MENZİL KONTROLLERİ (Mana Drain & Can Tüketimi)
        [p1, p2].forEach(caster => {
            if (!caster.channelingSpell) return;
            const target = (caster === p1) ? p2 : p1;

            let drainRate = caster.type === 'voldemort' ? 35 : 30; 
            caster.mana -= drainRate * dt;

            if (caster.mana <= 0 || caster.state === 'pain' || caster.state === 'stun' || caster.state === 'dead') {
                caster.mana = Math.max(0, caster.mana);
                caster.stopChannel();
                return;
            }

            const dist = Math.abs(caster.x - target.x);
            
            // Voldemort Crucio sürekli kilitleme etkisi (Menzil: 780px)
            if (caster.type === 'voldemort' && caster.channelingSpell === 'crucio') {
                if (dist < 780) {
                    if (target.shieldActive) {
                        target.mana -= 18 * dt; 
                    } else {
                        target.takeDamage(16 * dt, false); 
                        caster.ultCharge += 15 * dt;      
                        target.vx *= 0.5; // Crucio altındaki kurban yavaşlar

                        // Morgan hasar alırken acı çığlığı (.mp3) tetiklenir
                        if (target.type === 'morgan' && Math.random() < 1.5 * dt) {
                            this.game.audio.playMorganScreamSound();
                        }
                    }
                }
            } 
            // Morgan Incendio alev fırtınası (Menzil: Maksimum 500px ile sınırlandırıldı!)
            else if (caster.type === 'morgan' && caster.channelingSpell === 'incendio') {
                if (dist < 500) { // Limitlendi
                    if (target.shieldActive) {
                        target.mana -= 14 * dt; 
                    } else {
                        target.takeDamage(12 * dt, false); 
                        caster.ultCharge += 12 * dt;
                        if (Math.random() < 4 * dt) { 
                            target.addBurnStack();          
                        }
                    }
                }
            }
        });
    }

    draw(ctx) {
        this.effects.forEach(eff => eff.draw(ctx));
        this.projectiles.forEach(proj => proj.draw(ctx));
        this.drawContinuousChannels(ctx);
        this.floatingTexts.forEach(ft => ft.draw(ctx));
    }

    drawContinuousChannels(ctx) {
        const p1 = this.game.p1;
        const p2 = this.game.p2;

        [p1, p2].forEach(caster => {
            if (!caster.channelingSpell) return;
            const opponent = (caster === p1) ? p2 : p1;

            const startX = caster.x + (caster.facingRight ? 50 : -50);
            const startY = caster.y - 210; 

            const targetX = opponent.x;
            const targetY = opponent.y - 210; 

            if (caster.type === 'voldemort' && caster.channelingSpell === 'crucio') {
                const swirlSize = 130;
                ctx.save();
                ctx.translate(startX, startY);
                ctx.rotate((Date.now() / 150) % (Math.PI * 2));
                ctx.globalAlpha = 0.9;
                const swirlImg = this.game.assets.images.crucio;
if (swirlImg && swirlImg.width > 0) {
    ctx.drawImage(swirlImg, -swirlSize / 2, -swirlSize / 2, swirlSize, swirlSize);
}
                ctx.restore();

                if (!opponent.shieldActive) {
                    ctx.save();
                    ctx.strokeStyle = '#bf55ec';
                    ctx.lineWidth = 4 + Math.random() * 4; 
                    ctx.shadowColor = '#bf55ec';
                    ctx.shadowBlur = 15;
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);

                    const segments = 10;
                    for (let i = 1; i <= segments; i++) {
                        let px = startX + (targetX - startX) * (i / segments);
                        let py = startY + (targetY - startY) * (i / segments);
                        
                        if (i < segments) {
                            px += (Math.random() * 2 - 1) * 15;
                            py += (Math.random() * 2 - 1) * 15;
                        }
                        ctx.lineTo(px, py);
                    }
                    ctx.stroke();
                    ctx.restore();

                    ParticleFactory.spawnCrucioPain(targetX, targetY, 2);
                }
            } 
            // Morgan Incendio Alevinin görsel çizim menzili maksimum 500px ile sınırlandırıldı
            else if (caster.type === 'morgan' && caster.channelingSpell === 'incendio') {
                const flameImg = this.game.assets.images[`incendio${Math.floor(Date.now() / 80) % 3 + 1}`];
                
                ctx.save();
                let finalTargetX = targetX;
                let finalTargetY = targetY;

                // Maksimum 500px sınırını omuz koordinatından itibaren kısıtla
                const distance = Vector2.distance(startX, startY, targetX, targetY);
                if (distance > 500) {
                    const angle = Vector2.angleBetween(startX, startY, targetX, targetY);
                    finalTargetX = startX + Math.cos(angle) * 500;
                    finalTargetY = startY + Math.sin(angle) * 500;
                }

                if (opponent.shieldActive) {
                    const angle = Vector2.angleBetween(startX, startY, finalTargetX, finalTargetY);
                    const shieldRadius = 150;
                    // Eğer kalkan menzil sınırının dışındaysa alev kalkan yüzeyinde kesilmez, sınırında biter
                    if (distance <= 500) {
                        finalTargetX = targetX - Math.cos(angle) * shieldRadius;
                        finalTargetY = targetY - Math.sin(angle) * shieldRadius;
                    }
                    
                    if (Math.random() < 0.3) {
                        ParticleFactory.spawnShieldDeflect(finalTargetX, finalTargetY, caster.facingRight ? 1 : -1, 3);
                    }
                }

                const angle = Vector2.angleBetween(startX, startY, finalTargetX, finalTargetY);
                const actualFlameDistance = Vector2.distance(startX, startY, finalTargetX, finalTargetY);

                ctx.translate(startX, startY);
                ctx.rotate(angle);
               if (flameImg && flameImg.width > 0) {
    ctx.drawImage(flameImg, 0, -55, actualFlameDistance, 110);
}
                ctx.restore();
            }
        });
    }
}
