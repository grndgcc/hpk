/**
 * ============================================================================
 * HOGWARTS DUEL - BÜYÜ FİZİĞİ & PROJEKTİL / EFEKT YÖNETİCİSİ
 * ============================================================================
 */

import { Engine, Vector2, ParticleFactory, particles } from './engine.js';

// --- EKLENTİ 2 YARDIMCI SINIFI: UÇAN YAZILAR ---
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
        ctx.globalAlpha = Math.max(0, this.life); // Zamanla şeffaflaşır
        ctx.fillStyle = this.color;
        ctx.font = 'bold 22px "Cinzel", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

export class Projectile {
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

    hit(target) {
        this.active = false;

        if (this.type === 'confringo') {
            this.game.audio.playExplosion();
            target.takeDamage(18, true); 

            this.game.triggerScreenShake(12, 0.3);
            this.game.spells.addEffect(new ExplosionEffect(this.x, this.y, this.game));
            
            ParticleFactory.spawnFireExplosion(this.x, this.y, 25);
            this.owner.ultCharge += 15;
        } 
        else if (this.type === 'sectumsempra') {
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

    draw(ctx) {
        let img = this.game.assets.images.confringo1;
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
        }

        Engine.drawRotatedImage(ctx, img, this.x, this.y, this.width, this.height, 0, 1.0, isFlipped, 0.5, 0.5);
    }
}

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
        ctx.drawImage(img, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        
        ctx.restore();
    }
}

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
        ctx.drawImage(this.game.assets.images.blood, this.target.x - size / 2, this.target.y - 200, size, size);
        
        ctx.restore();
    }
}

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

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = Engine.clamp(this.life / this.maxLife, 0, 1);
        
        ctx.shadowColor = '#00ff33';
        ctx.shadowBlur = 30;

        const jitterY = 1.0 + (Math.random() * 0.4 - 0.2);
        Engine.drawStretchedBeam(ctx, this.game.assets.images.avadakedavra, this.startX, this.startY, this.endX, this.endY, 130, this.life / this.maxLife, jitterY);

        ctx.restore();
    }
}
export class SpellManager {
    constructor(game) {
        this.game = game;
        this.projectiles = [];
        this.effects = [];
        this.floatingTexts = []; // <-- EKLENDİ: Yazıları tutacak havuz
    }

    clearAll() {
        this.projectiles = [];
        this.effects = [];
        this.floatingTexts = []; // <-- EKLENDİ
    }

    // <-- EKLENDİ: Dışarıdan yazı eklemeyi sağlayan fonksiyon
    addFloatingText(text, x, y, color) {
        this.floatingTexts.push(new FloatingText(text, x, y, color));
    }

    update(dt, p1, p2) {
        // ... (Mevcut mermi ve efekt güncellemeleri) ...

        // <-- EKLENDİ: Yazıları güncelleme döngüsü
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.update(dt);
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        this.effects.forEach(eff => eff.draw(ctx));
        this.projectiles.forEach(proj => proj.draw(ctx));
        this.drawContinuousChannels(ctx);
        
        // <-- EKLENDİ: Yazıları çizdirme döngüsü
        this.floatingTexts.forEach(ft => ft.draw(ctx));
    }
}

        for (let i = this.effects.length - 1; i >= 0; i--) {
            const eff = this.effects[i];
            eff.update(dt);

            if (eff.life <= 0) {
                this.effects.splice(i, 1);
            }
        }
// --- EKLENTİ 1: BÜYÜ ÇARPIŞMASI (PRIORI INCANTATEM) ---
        // Havada çarpışan rakip büyü mermilerini tespit edip patlatır
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            for (let j = i - 1; j >= 0; j--) {
                const projA = this.projectiles[i];
                const projB = this.projectiles[j];

                // Büyüler aktifse ve farklı kişilere aitse çarpışma kontrolü yap
                if (projA.active && projB.active && projA.owner !== projB.owner) {
                    const distanceX = Math.abs(projA.x - projB.x);
                    const distanceY = Math.abs(projA.y - projB.y);

                    // Büyüler havada birbirine çok yaklaştıysa çarpışma gerçekleşir
                    if (distanceX < 45 && distanceY < 35) {
                        projA.active = false;
                        projB.active = false;

                        // Çarpışma noktasında patlama efekti ve ekran sarsıntısı tetikle
                        const clashX = (projA.x + projB.x) / 2;
                        const clashY = (projA.y + projB.y) / 2;

                        this.game.triggerScreenShake(8, 0.2);
                        this.game.audio.playExplosion();
                        
                        // Havaya parıltılar ve patlama halkası saç
                        ParticleFactory.spawnFireExplosion(clashX, clashY, 15);
                    }
                }
            }
        }
        // --- DÜZELTME: KANALİZE SÜREKLİ BÜYÜLERİN MANA/CAN AKTİF ETKİLERİ ---
        [p1, p2].forEach(caster => {
            if (!caster.channelingSpell) return;
            const target = (caster === p1) ? p2 : p1;

            // Büyü kanalizasyonu için saniyelik mana tüketimi
            let drainRate = caster.type === 'voldemort' ? 35 : 30; 
            caster.mana -= drainRate * dt;

            // Büyüyü yapanın manası biterse, hasar yerse veya sersemlerse büyü kesilir
            if (caster.mana <= 0 || caster.state === 'pain' || caster.state === 'stun' || caster.state === 'dead') {
                caster.mana = Math.max(0, caster.mana);
                caster.stopChannel();
                return;
            }

            // Menzil içi hasar ve ulti doldurma kontrolü (Menzil: 780px)
            const dist = Math.abs(caster.x - target.x);
            if (dist < 780) {
                if (caster.type === 'voldemort' && caster.channelingSpell === 'crucio') {
                    if (target.shieldActive) {
                        target.mana -= 18 * dt; // Kalkanın manasını hızla eritir
                    } else {
                        target.takeDamage(16 * dt, false); // Crucio can yakma hasarı
                        caster.ultCharge += 15 * dt;      // Saniyede 15 ulti doldurur
                        target.vx *= 0.5;                  // Karakteri yavaşlatır
                    }
                } 
                else if (caster.type === 'morgan' && caster.channelingSpell === 'incendio') {
                    if (target.shieldActive) {
                        target.mana -= 14 * dt; 
                    } else {
                        target.takeDamage(12 * dt, false); // Incendio doğrudan alev hasarı
                        caster.ultCharge += 12 * dt;
                        if (Math.random() < 4 * dt) { 
                            target.addBurnStack();          // Yakma yükü biriktirir
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
    }

    drawContinuousChannels(ctx) {
        const p1 = this.game.p1;
        const p2 = this.game.p2;

        [p1, p2].forEach(caster => {
            if (!caster.channelingSpell) return;
            const opponent = (caster === p1) ? p2 : p1;

            const startX = caster.x + (caster.facingRight ? 50 : -50);
            // DÜZELTME: Başlangıç ve bitiş koordinatları omuz/asa yüksekliğine (y - 210) çekildi
            const startY = caster.y - 210; 

            const targetX = opponent.x;
            const targetY = opponent.y - 210; 

            if (caster.type === 'voldemort' && caster.channelingSpell === 'crucio') {
                const swirlSize = 130;
                ctx.save();
                ctx.translate(startX, startY);
                ctx.rotate((Date.now() / 150) % (Math.PI * 2));
                ctx.globalAlpha = 0.9;
                ctx.drawImage(this.game.assets.images.crucio, -swirlSize / 2, -swirlSize / 2, swirlSize, swirlSize);
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
            else if (caster.type === 'morgan' && caster.channelingSpell === 'incendio') {
                const flameImg = this.game.assets.images[`incendio${Math.floor(Date.now() / 80) % 3 + 1}`];
                
                ctx.save();
                let finalTargetX = targetX;
                let finalTargetY = targetY;

                if (opponent.shieldActive) {
                    const angle = Vector2.angleBetween(startX, startY, targetX, targetY);
                    const shieldRadius = 150;
                    finalTargetX = targetX - Math.cos(angle) * shieldRadius;
                    finalTargetY = targetY - Math.sin(angle) * shieldRadius;
                    
                    if (Math.random() < 0.3) {
                        ParticleFactory.spawnShieldDeflect(finalTargetX, finalTargetY, caster.facingRight ? 1 : -1, 3);
                    }
                }

                const angle = Vector2.angleBetween(startX, startY, finalTargetX, finalTargetY);
                const distance = Vector2.distance(startX, startY, finalTargetX, finalTargetY);

                ctx.translate(startX, startY);
                ctx.rotate(angle);
                ctx.drawImage(flameImg, 0, -55, distance, 110);
                ctx.restore();
            }
        });
    }
}
