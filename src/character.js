/**
 * ============================================================================
 * HOGWARTS DUEL - KARAKTER SINIFI & FİZİK / ANIMASYON YÖNETİCİSİ
 * ============================================================================
 */

import { Engine, ParticleFactory } from './engine.js';

export class SpeechBubble {
    constructor(text, x, y) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.maxLife = 0.83;
        this.life = this.maxLife;
    }

    update(dt, x, y) {
        this.x = x;
        this.y = y;
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.font = 'bold 15px Arial, sans-serif';
        const metrics = ctx.measureText(this.text);
        const paddingW = 16;
        const w = metrics.width + paddingW;
        const h = 26;
        
        const rx = this.x - w / 2;
        const ry = this.y - 45 - h;

        ctx.globalAlpha = Engine.clamp(this.life / 0.2, 0, 1);

        ctx.fillStyle = 'rgba(12, 15, 18, 0.9)';
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.moveTo(this.x - 6, ry + h);
        ctx.lineTo(this.x + 6, ry + h);
        ctx.lineTo(this.x, ry + h + 6);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, ry + h / 2 + 1);
        
        ctx.restore();
    }
}

export class Character {
    constructor(type, isPlayer, startX, game, config) {
        this.type = type;
        this.isPlayer = isPlayer;
        this.game = game;
        this.config = config;

        this.x = startX;
        this.y = this.config.FLOOR_Y;
        this.vx = 0;
        this.vy = 0;
        this.height = 280;

        this.hp = 100;
        this.mana = 100;
        this.ultCharge = 0;

        this.facingRight = isPlayer;
        this.isGrounded = true;
        this.isDucking = false;
        this.state = 'idle';

        this.animTimer = 0;
        this.walkCycleIndex = 0;
        this.painTimer = 0;
        this.stunTimer = 0;

        this.shieldActive = false;
        this.channelingSpell = null;

        this.burnStacks = 0;
        this.burnTimer = 0;
        this.burnTickAccumulator = 0;

        this.bubble = null;
    }

    say(text) {
        this.bubble = new SpeechBubble(text, this.x, this.y - this.height);
    }
takeDamage(amount, bypassShield = false) {
        if (this.state === 'dead') return;

        if (this.shieldActive && !bypassShield) {
            const dirX = this.facingRight ? 1 : -1;
            ParticleFactory.spawnShieldDeflect(this.x + dirX * 60, this.y - 210, dirX, 12);
            
            // <-- EKLENDİ: Kalkan engellemesinde mavi PROTEGO yazısı fırlatır
            this.game.spells.addFloatingText("PROTEGO", this.x, this.y - 230, '#3399ff');
            return;
        }

        this.hp = Math.max(0, this.hp - amount);

        // <-- EKLENDİ: Alınan hasarı ekranda kırmızı renkle gösterir (Küsuratları yuvarlar)
        if (amount >= 1) {
            this.game.spells.addFloatingText("-" + Math.round(amount), this.x, this.y - 180, '#ff3333');
        }

        if (this.channelingSpell) {
            this.stopChannel();
        }

        // ... (Ölüm veya acı animasyonunun tetiklendiği mevcut kodlar devam eder) ...


        if (this.hp <= 0) {
            this.state = 'dead';
            this.vx = 0;
            this.vy = 0;
            this.stopChannel();
        } else {
            this.state = 'pain';
            this.painTimer = 0.3;
            this.vx = 0;
            ParticleFactory.spawnFireExplosion(this.x, this.y - 120, 5);
        }
    }

    addBurnStack() {
        if (this.burnStacks < 5) {
            this.burnStacks++;
        }
        this.burnTimer = 4.0;
    }

    stopChannel() {
        if (this.channelingSpell === 'incendio') {
            this.game.audio.stopFlame();
        }
        this.channelingSpell = null;
    }

    update(dt, opponent) {
        this.ultCharge = Math.min(100, this.ultCharge);
        this.facingRight = (opponent.x > this.x);

        if (this.stunTimer > 0) {
            this.stunTimer -= dt;
            this.state = 'stun';
            this.vx = 0;
            this.shieldActive = false;
            this.stopChannel();

            if (Math.random() < 0.25) {
                ParticleFactory.spawnStunSparkles(this.x + (Math.random() * 40 - 20), this.y - this.height - 10, 2);
            }
        }

        if (this.state === 'pain') {
            this.painTimer -= dt;
            this.vx = 0;
            if (this.painTimer <= 0) {
                this.state = 'idle';
            }
        }

        if (this.burnStacks > 0) {
            this.burnTimer -= dt;
            this.burnTickAccumulator += dt;

            if (this.burnTickAccumulator >= 0.5) {
                this.burnTickAccumulator -= 0.5;
                const burnDamage = this.burnStacks * 0.75;
                this.hp = Math.max(0, this.hp - burnDamage);
                
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

        if (this.state !== 'dead') {
            let manaDelta = 9.0 * dt;
            
            if (this.shieldActive) {
                manaDelta = -36.0 * dt;
            }
            
            this.mana = Math.min(100, Math.max(0, this.mana + manaDelta));

            if (this.mana <= 0 && this.shieldActive) {
                this.shieldActive = false;
                this.game.triggerScreenShake(5, 0.15);
                // DÜZELTME: Kalkan kırılma efekti asanın yüksekliğine (y - 210) hizalandı
                ParticleFactory.spawnShieldDeflect(this.x, this.y - 210, this.facingRight ? 1 : -1, 8);
            }
        }

        if (this.shieldActive) {
            this.vx = 0;
            this.state = 'cast';
        }

        if (!this.isGrounded) {
            this.vy += this.config.GRAVITY * 60 * dt;
            this.y += this.vy * 60 * dt;

            if (this.y >= this.config.FLOOR_Y) {
                this.y = this.config.FLOOR_Y;
                this.vy = 0;
                this.isGrounded = true;
            }
        }

        this.x += this.vx * 60 * dt;
        this.x = Math.max(80, Math.min(this.config.VIRTUAL_WIDTH - 80, this.x));

        if (this.state !== 'pain' && this.state !== 'dead' && this.state !== 'stun') {
            if (this.shieldActive || this.channelingSpell) {
                this.state = 'cast';
            } else if (Math.abs(this.vx) > 0.1) {
                this.state = 'walk';
            } else {
                this.state = 'idle';
            }
        }

        if (this.bubble) {
            this.bubble.update(dt, this.x, this.y - this.height);
            if (this.bubble.life <= 0) {
                this.bubble = null;
            }
        }

        if (this.state === 'walk') {
            this.animTimer += dt;
            if (this.animTimer >= 0.08) {
                this.animTimer -= 0.08;
                this.walkCycleIndex = (this.walkCycleIndex + 1) % 7;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        
        let mustFlip = !this.facingRight;
        
        // DÜZELTME: Güvenli varsayılan ayakta durma karesi atandı
        const standImg = this.type === 'voldemort' ? this.game.assets.images.voldemortstand : this.game.assets.images.morganstand;
        let img = standImg;

        // DÜZELTME: Eğer animasyon karesi boşsa karakterin görünmez olmaması için standImg ile yedekleme yapıldı
        if (this.type === 'voldemort') {
            if (this.state === 'dead') {
                img = this.game.assets.images.voldemortwalk1 || standImg;
            } else if (this.state === 'pain') {
                img = this.game.assets.images.voldemortwalk4 || standImg;
            } else if (this.state === 'cast') {
                const attackIndex = Math.floor(Date.now() / 150) % 3;
                img = this.game.assets.images[`voldemortattack${attackIndex + 1}`] || standImg;
            } else if (this.state === 'walk') {
                img = this.game.assets.images[`voldemortwalk${this.walkCycleIndex + 1}`] || standImg;
            }
        } else {
            if (this.state === 'dead') {
                img = this.game.assets.images.morganwalk1 || standImg;
            } else if (this.state === 'pain') {
                img = this.game.assets.images.morganwalk4 || standImg;
            } else if (this.state === 'cast') {
                const attackIndex = Math.floor(Date.now() / 150) % 3;
                img = this.game.assets.images[`morganattack${attackIndex + 1}`] || standImg;
            } else if (this.state === 'walk') {
                img = this.game.assets.images[`morganwalk${this.walkCycleIndex + 1}`] || standImg;
            }
        }

        // Son güvence
        if (!img) {
            ctx.restore();
            return;
        }

        const aspect = img.width / img.height;
        const drawH = this.height;
        const drawW = drawH * aspect;

        let painShakeX = 0;
        if (this.state === 'pain') {
            painShakeX = (Math.random() * 2 - 1) * 8;
        }

        let drawX = this.x + painShakeX;
        let drawY = this.y;

        if (this.state === 'dead') {
            ctx.translate(this.x, this.y);
            ctx.rotate(mustFlip ? -Math.PI / 2 : Math.PI / 2);
            ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
            ctx.restore();
            return;
        }

        if (mustFlip) {
            Engine.drawRotatedImage(ctx, img, drawX, drawY, drawW, drawH, 0, 1, true, 0.5, 1.0);
        } else {
            Engine.drawRotatedImage(ctx, img, drawX, drawY, drawW, drawH, 0, 1, false, 0.5, 1.0);
        }

        ctx.restore();

        if (this.shieldActive) {
            ctx.save();
            const pulse = 1 + Math.sin(Date.now() / 100) * 0.05;
            const pSize = 340 * pulse;
            const px = this.x;
            const py = this.y - 140;

            ctx.globalAlpha = 0.8;
            Engine.drawRotatedImage(ctx, this.game.assets.images.protego, px, py, pSize, pSize, 0, 0.8, false, 0.5, 0.5);
            ctx.restore();
        }

        if (this.bubble) {
            this.bubble.draw(ctx);
        }
    }
}
