/**
 * ============================================================================
 * HOGWARTS DUEL - CORE COORDINATOR & GAME ENGINE ORCHESTRATOR
 * ============================================================================
 */

import { Engine, particles } from './engine.js';
import { InputHandler } from './input.js';
import { Character } from './character.js';
import { SpellManager, Projectile } from './spell.js';
import { AIManager } from './ai.js';
import { AudioController } from './audio.js';

const CONFIG = {
    VIRTUAL_WIDTH: 1280,   
    VIRTUAL_HEIGHT: 720,   
    MAX_DELTA_TIME: 0.1,   
    ROUND_DURATION: 99,    
    GRAVITY: 0.8,          
    FLOOR_Y: 600           
};

const GAME_STATES = {
    LOADING: 'LOADING',
    MENU: 'MENU',
    CHARACTER_SELECT: 'CHARACTER_SELECT',
    PLAYING: 'PLAYING',
    ROUND_OVER: 'ROUND_OVER',
    GAME_OVER: 'GAME_OVER',
    PAUSED: 'PAUSED'
};

class GameOrchestrator {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'gameCanvas';
            document.getElementById('game-container').appendChild(this.canvas);
        }
        this.ctx = this.canvas.getContext('2d');

        this.currentState = GAME_STATES.LOADING;

        this.lastTime = 0;
        this.accumulatedTime = 0;
        this.roundTimer = CONFIG.ROUND_DURATION;
        this.roundTimeMs = 0; 

        this.scaleX = 1;
        this.scaleY = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeX = 0;
        this.shakeY = 0;

        this.audio = new AudioController();
        this.input = new InputHandler(this);
        this.spells = new SpellManager(this);
        this.ai = new AIManager(this);

        this.playerCharacterType = 'voldemort'; 
        this.p1 = null; 
        this.p2 = null; 
        this.p1Score = 0;
        this.p2Score = 0;
        this.currentRound = 1;

        this.p1DisplayHp = 100;
        this.p2DisplayHp = 100;
        this.p1DisplayMana = 100;
        this.p2DisplayMana = 100;

        this.assets = {
            images: {},
            loadedCount: 0,
            totalCount: 0
        };

        this.assetManifest = {
            bg: 'arkaplan.png',
            protego: 'protego.png',
            blood: 'sectumsemprablood.png',

            avadakedavra: 'avadakedavra.png',
            expelliarmus: 'expelliarmus.png',
            crucio: 'crucio.png',
            sectumsempra: 'sectumsempra.png',
            confringo1: 'confringo1.png',
            confringo2: 'confringo2.png',
            confringo3: 'confringo3.png',
            confringo4: 'confringo4.png',
            incendio1: 'incendio1.png',
            incendio2: 'incendio2.png',
            incendio3: 'incendio3.png',

            voldemortstand: 'voldemortstand.png',
            voldemortattack1: 'voldemortattack1.png',
            voldemortattack2: 'voldemortattack2.png',
            voldemortattack3: 'voldemortattack3.png',
            voldemortwalk1: 'voldemortwalk1.png',
            voldemortwalk2: 'voldemortwalk2.png',
            voldemortwalk3: 'voldemortwalk3.png',
            voldemortwalk4: 'voldemortwalk4.png',
            voldemortwalk5: 'voldemortwalk5.png',
            voldemortwalk6: 'voldemortwalk6.png',
            voldemortwalk7: 'voldemortwalk7.png',

            morganstand: 'morganstand.png',
            morganattack1: 'morganattack1.png',
            morganattack2: 'morganattack2.png',
            morganattack3: 'morganattack3.png',
            morganwalk1: 'morganwalk1.png',
            morganwalk2: 'morganwalk2.png',
            morganwalk3: 'morganwalk3.png',
            morganwalk4: 'morganwalk4.png',
            morganwalk5: 'morganwalk5.png',
            morganwalk6: 'morganwalk6.png',
            morganwalk7: 'morganwalk7.png'
        };

        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.input.bindEvents();
        this.preloadAssets();
    }

    resizeCanvas() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        const windowRatio = windowWidth / windowHeight;
        const virtualRatio = CONFIG.VIRTUAL_WIDTH / CONFIG.VIRTUAL_HEIGHT;

        let canvasWidth, canvasHeight;

        if (windowRatio > virtualRatio) {
            canvasHeight = windowHeight;
            canvasWidth = canvasHeight * virtualRatio;
            this.offsetX = (windowWidth - canvasWidth) / 2;
            this.offsetY = 0;
        } else {
            canvasWidth = windowWidth;
            canvasHeight = canvasWidth / virtualRatio;
            this.offsetX = 0;
            this.offsetY = (windowHeight - canvasHeight) / 2;
        }

        this.canvas.style.position = 'absolute';
        this.canvas.style.width = `${canvasWidth}px`;
        this.canvas.style.height = `${canvasHeight}px`;
        this.canvas.style.left = `${this.offsetX}px`;
        this.canvas.style.top = `${this.offsetY}px`;

        this.canvas.width = CONFIG.VIRTUAL_WIDTH;
        this.canvas.height = CONFIG.VIRTUAL_HEIGHT;

        this.scaleX = canvasWidth / CONFIG.VIRTUAL_WIDTH;
        this.scaleY = canvasHeight / CONFIG.VIRTUAL_HEIGHT;
    }

    preloadAssets() {
        const keys = Object.keys(this.assetManifest);
        this.assets.totalCount = keys.length;

        if (this.assets.totalCount === 0) {
            this.onAssetsLoaded();
            return;
        }

        keys.forEach(key => {
            const img = new Image();
            img.src = this.assetManifest[key];
            img.onload = () => {
                this.assets.images[key] = img;
                this.assets.loadedCount++;
                
                this.renderLoadingProgress();

                if (th
