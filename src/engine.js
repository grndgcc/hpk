export const particles = [];

export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.hypot(dx, dy);
    }

    static angleBetween(startX, startY, endX, endY) {
        return Math.atan2(endY - startY, endX - startX);
    }
}

export class Engine {
    static clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    static lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    static windowToCanvas(windowX, windowY, game) {
        const x = (windowX - game.offsetX) / game.scaleX;
        const y = (windowY - game.offsetY) / game.scaleY;
        return { x, y };
    }

    static rectCollision(rx1, ry1, rw1, rh1, rx2, ry2, rw2, rh2) {
        return rx1 < rx2 + rw2 &&
               rx1 + rw1 > rx2 &&
               ry1 < ry2 + rh2 &&
               ry1 + rh1 > ry2;
    }

    static circleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
        const closestX = Math.max(rx, Math.min(cx, rx + rw));
        const closestY = Math.max(ry, Math.min(cy, ry + rh));

        const distanceX = cx - closestX;
        const distanceY = cy - closestY;
        
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
        return distanceSquared < (radius * radius);
    }

    static drawRotatedImage(ctx, img, x, y, width, height, angle = 0, alpha = 1, flipX = false, anchorX = 0.5, anchorY = 0.5) {
        if (!img || img.width === 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);

        if (flipX) {
            ctx.scale(-1, 1);
        }

        if (angle !== 0) {
            ctx.rotate(angle);
        }

        const dx = -width * anchorX;
        const dy = -height * anchorY;

        ctx.drawImage(img, dx, dy, width, height);
        ctx.restore();
    }

    static drawStretchedBeam(ctx, img, startX, startY, endX, endY, beamHeight, alpha = 1, scaleY = 1) {
        if (!img || img.width === 0) return;

        const distance = Vector2.distance(startX, startY, endX, endY);
        const angle = Vector2.angleBetween(startX, startY, endX, endY);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(startX, startY);
        ctx.rotate(angle);

        const dy = -(beamHeight * scaleY) / 2;
        ctx.drawImage(img, 0, dy, distance, beamHeight * scaleY);

        ctx.restore();
    }

    static interpolateColor(color1, color2, factor) {
        const r = Math.round(color1.r + (color2.r - color1.r) * factor);
        const g = Math.round(color1.g + (color2.g - color1.g) * factor);
        const b = Math.round(color1.b + (color2.b - color1.b) * factor);
        return `rgb(${r},${g},${b})`;
    }
}

export class EngineParticle {
    constructor(x, y, colorRGB, endColorRGB, size, vx, vy, life = 1.0, gravity = 0) {
        this.x = x;
        this.y = y;
        this.colorRGB = colorRGB;
        this.endColorRGB = endColorRGB;
        this.size = size;
        this.vx = vx;
        this.vy = vy;
        this.maxLife = life;
        this.life = life;
        this.gravity = gravity;
    }

    update(dt) {
        this.vy += this.gravity * dt;
        this.x += this.vx * 60 * dt;
        this.y += this.vy * 60 * dt;
        this.life -= dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        const factor = 1 - (this.life / this.maxLife);
        ctx.fillStyle = Engine.interpolateColor(this.colorRGB, this.endColorRGB, factor);
        ctx.globalAlpha = Engine.clamp(this.life / this.maxLife, 0, 1);
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class ParticleFactory {
    static spawnFireExplosion(x, y, count = 20) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 5;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = 3 + Math.random() * 5;
            const life = 0.5 + Math.random() * 0.7;

            particles.push(new EngineParticle(
                x, y, 
                { r: 255, g: 150, b: 0 },
                { r: 40, g: 40, b: 40 },
                size, vx, vy, life, 0.2
            ));
        }
    }

    static spawnShieldDeflect(x, y, directionX, count = 15) {
        for (let i = 0; i < count; i++) {
            const angle = (directionX > 0 ? 0 : Math.PI) + (Math.random() * 1.2 - 0.6);
            const speed = 3 + Math.random() * 6;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - (1 + Math.random() * 2);
            const size = 2 + Math.random() * 3;
            const life = 0.3 + Math.random() * 0.5;

            particles.push(new EngineParticle(
                x, y,
                { r: 50, g: 150, b: 255 },
                { r: 10, g: 30, b: 80 },
                size, vx, vy, life, 0.1
            ));
        }
    }

    static spawnCrucioPain(x, y, count = 4) {
        for (let i = 0; i < count; i++) {
            const vx = (Math.random() * 2 - 1) * 2;
            const vy = -(1 + Math.random() * 3);
            const size = 2 + Math.random() * 2;
            const life = 0.4 + Math.random() * 0.4;

            particles.push(new EngineParticle(
                x, y,
                { r: 180, g: 50, b: 240 },
                { r: 30, g: 5, b: 50 },
                size, vx, vy, life, -0.05
            ));
        }
    }

    static spawnStunSparkles(x, y, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 4;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = 2 + Math.random() * 2;
            const life = 0.6 + Math.random() * 0.6;

            particles.push(new EngineParticle(
                x, y,
                { r: 255, g: 50, b: 150 },
                { r: 50, g: 0, b: 50 },
                size, vx, vy, life, 0
            ));
        }
    }
}
