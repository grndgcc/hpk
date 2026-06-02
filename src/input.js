/**
 * ============================================================================
 * HOGWARTS DUEL - INPUT HANDLER & BINDING SOYUTLAMA SİSTEMİ
 * ============================================================================
 */

import { Engine } from './engine.js';

const castSpellWrapper = (caster, target, index) => {
    const globalCast = window.castSpell;
    if (typeof globalCast === 'function') {
        globalCast(caster, target, index);
    }
};

export class InputHandler {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.actions = {
            LEFT: false,
            RIGHT: false,
            JUMP: false,
            DUCK: false,
            PROTEGO: false
        };
        this.prevActions = {
            SPELL1: false,
            SPELL2: false,
            ULTIMATE: false
        };
        this.touchActive = false;
        this.gamepadConnected = false;
        this.activeGamepadIndex = null;
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;

            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
                e.preventDefault();
            }

            if (this.game.audio) {
                this.game.audio.init();
            }

            // DÜZELTME: gameRunning yerine currentState kontrolü sağlandı
            if (this.game.currentState === 'PLAYING' && this.game.p1 && this.game.p1.state !== 'dead') {
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

            if (this.game.currentState === 'PLAYING' && this.game.p1) {
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

        window.addEventListener('blur', () => {
            this.keys = {};
            this.resetActions();
            if (this.game.p1) {
                this.game.p1.shieldActive = false;
                this.game.p1.stopChannel();
            }
        });

        this.setupMobileEvents();

        window.addEventListener('gamepadconnected', (e) => {
            this.gamepadConnected = true;
            this.activeGamepadIndex = e.gamepad.index;
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            this.gamepadConnected = false;
            this.activeGamepadIndex = null;
            this.resetActions();
        });
    }

    resetActions() {
        Object.keys(this.actions).forEach(act => this.actions[act] = false);
    }

    setupMobileEvents() {
        const controlsOverlay = document.getElementById('mobile-controls');
        if (!controlsOverlay) return;

        if ('ontouchstart' in window) {
            controlsOverlay.style.display = 'flex';
            this.touchActive = true;
        }

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

        Object.keys(buttonMappings).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            const action = buttonMappings[btnId];

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.actions[action] = true;
                this.game.audio.init();
            });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.actions[action] = false;
                
                if (action === 'PROTEGO' && this.game.p1) {
                    this.game.p1.shieldActive = false;
                }
            });

            btn.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                this.actions[action] = false;
                if (action === 'PROTEGO' && this.game.p1) {
                    this.game.p1.shieldActive = false;
                }
            });
        });

        Object.keys(discreteMappings).forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            const spellIndex = discreteMappings[btnId];

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.game.audio.init();

                if (this.game.currentState === 'PLAYING' && this.game.p1 && this.game.p1.state !== 'dead') {
                    this.triggerSpellAction(spellIndex);
                }
            });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (this.game.currentState === 'PLAYING' && this.game.p1) {
                    if (this.game.p1.type === 'voldemort' && spellIndex === 2) {
                        if (this.game.p1.channelingSpell === 'crucio') this.game.p1.stopChannel();
                    }
                    if (this.game.p1.type === 'morgan' && spellIndex === 1) {
                        if (this.game.p1.channelingSpell === 'incendio') this.game.p1.stopChannel();
                    }
                }
            });
        });
    }

    triggerSpellAction(spellIndex) {
        if (!this.game.p1 || !this.game.p2) return;
        castSpellWrapper(this.game.p1, this.game.p2, spellIndex);
    }

    pollGamepad() {
        if (!this.gamepadConnected || this.activeGamepadIndex === null) return;

        const gamepad = navigator.getGamepads()[this.activeGamepadIndex];
        if (!gamepad) return;

        const axisX = gamepad.axes[0];
        const axisY = gamepad.axes[1];

        const dpadUp = gamepad.buttons[12]?.pressed;
        const dpadDown = gamepad.buttons[13]?.pressed;
        const dpadLeft = gamepad.buttons[14]?.pressed;
        const dpadRight = gamepad.buttons[15]?.pressed;

        this.actions.LEFT = (axisX < -0.3) || dpadLeft;
        this.actions.RIGHT = (axisX > 0.3) || dpadRight;

        const buttonA = gamepad.buttons[0]?.pressed;
        this.actions.JUMP = (axisY < -0.5) || dpadUp || buttonA;
        this.actions.DUCK = (axisY > 0.5) || dpadDown;

        const buttonB = gamepad.buttons[1]?.pressed;
        const buttonRB = gamepad.buttons[5]?.pressed;
        this.actions.PROTEGO = buttonB || buttonRB;

        const buttonX = gamepad.buttons[2]?.pressed;
        if (buttonX) {
            if (!this.prevActions.SPELL1) {
                this.triggerSpellAction(1);
                this.prevActions.SPELL1 = true;
            }
        } else {
            if (this.prevActions.SPELL1) {
                this.prevActions.SPELL1 = false;
                if (this.game.p1 && this.game.p1.type === 'morgan') {
                    if (this.game.p1.channelingSpell === 'incendio') this.game.p1.stopChannel();
                }
            }
        }

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

    updatePlayerMovement(player) {
        if (!player || player.state === 'dead' || player.state === 'stun' || player.state === 'pain') {
            return;
        }

        this.pollGamepad();

        player.vx = 0;

        const goLeft = this.keys['a'] || this.keys['arrowleft'] || this.actions.LEFT;
        const goRight = this.keys['d'] || this.keys['arrowright'] || this.actions.RIGHT;

        if (goLeft) {
            player.vx = -5;
        }
        if (goRight) {
            player.vx = 5;
        }

        const doJump = this.keys['w'] || this.keys['arrowup'] || this.actions.JUMP;
        if (doJump && player.isGrounded) {
            player.vy = -15;
            player.isGrounded = false;
        }

        const doDuck = this.keys['s'] || this.keys['arrowdown'] || this.actions.DUCK;
        player.isDucking = doDuck;

        const holdShield = this.keys['j'] || this.keys['1'] || this.actions.PROTEGO;
        if (holdShield) {
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
