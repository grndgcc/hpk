/**
 * ============================================================================
 * HOGWARTS DUEL - HİBRİT SES SENTEZLEME VE MP3 ÇALMA MOTORU (3. AŞAMA)
 * ============================================================================
 * Bu sınıf; harici MP3 dosyalarını yükleyip çalabilen ana ses motorudur. Tarayıcıda
 * CORS engeli çıkması veya dosyaların eksik olması durumuna karşı eski prösedürel
 * Web Audio API sentezleyicilerini sessiz yedek (fallback) olarak çalıştırır.
 * 
 * 3. Aşama Güncellemeleri:
 * - HTML5 Audio tabanlı gerçek zamanlı MP3 yükleme ve çalma yapısı kuruldu.
 * - maintheme.mp3 için menüde başlayan döngüsel arka plan müziği desteği eklendi.
 * - Morgan'ın Incendio büyüsü için sürekli döngüsel kanalizasyon sesi entegre edildi.
 * - Tüm büyüler, kalkanlar ve Morgan'ın acı çığlığı MP3 dosyalarıyla eşleştirildi.
 */

export class AudioController {
    constructor() {
        // Tarayıcının ana ses işlem birimi (AudioContext) yedek sentezleyici için
        this.ctx = null;

        // Incendio alev akışı için procedural sentezleyici düğümleri
        this.fireSource = null;
        this.fireOsc = null;
        this.fireGain = null;

        // MP3 Dosya Yolları Sözlüğü
        this.soundPaths = {
            mainTheme: 'maintheme.mp3',
            voldemortProtego: 'voldemortprotego.mp3',
            morganIncendio: 'morganincendio.mp3',
            morganScream: 'morganscream.mp3',
            morganExpelliarmus: 'morganexpelliarmus.mp3',
            morganProtego: 'morganprotego.mp3',
            morganSectumsempra: 'morgansectumsempra.mp3',
            avadaKedavra: 'avadakedavra.mp3',
            confringo: 'confringo.mp3',
            crucio: 'crucio.mp3'
        };

        // Sürekli döngü çalacak olan seslerin nesne referansları
        this.themeAudio = null;
        this.incendioAudio = null;
    }

    /**
     * Tarayıcı güvenlik politikası gereği, kullanıcının ekrana ilk dokunuşunda
     * ses motorunu uyandırır ve aktifleştirir.
     */
    init() {
        if (!this.ctx) {
            // Standart ve Webkit tarayıcı uyumluluğu
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Eğer ses birimi uyku modundaysa (suspended) uyandır
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Güvenli MP3 Çalma Yardımcı Fonksiyonu
     * Eğer dosya bulunamazsa veya CORS engeli çıkarsa otomatik olarak sentezleyici fallback çalıştırır.
     * @param {string} path - Çalınacak .mp3 dosyasının yolu
     * @param {function} fallbackCallback - MP3 çalmazsa çalıştırılacak sentezleyici yedek fonksiyonu
     */
    playSound(path, fallbackCallback) {
        this.init();
        const audio = new Audio(path);
        audio.volume = 0.85; // Büyü sesleri yüksekliği
        audio.play().catch(err => {
            console.warn(`[SES MOTORU] ${path} dosyası çalınamadı. Sentezleyici yedek devreye giriyor. Hata:`, err);
            if (fallbackCallback) {
                fallbackCallback();
            }
        });
    }

    /**
     * Madde 10: Ana menüde ve oyun içinde kesintisiz çalan tema müziğini başlatır.
     */
    playTheme() {
        this.init();
        if (!this.themeAudio) {
            this.themeAudio = new Audio(this.soundPaths.mainTheme);
            this.themeAudio.loop = true;
            this.themeAudio.volume = 0.30; // Arka plan müziği için yumuşak %30 ses düzeyi
        }
        
        this.themeAudio.play().catch(err => {
            console.warn("[SES MOTORU] Tema müziği çalınamadı (Etkileşim bekleniyor):", err);
        });
    }

    /**
     * Voldemort Protego kalkanı aktifleştiğinde çalınır.
     */
    playVoldemortProtego() {
        this.playSound(this.soundPaths.voldemortProtego, () => this.playShieldHit());
    }

    /**
     * Morgan Protego kalkanı aktifleştiğinde çalınır.
     */
    playMorganProtego() {
        this.playSound(this.soundPaths.morganProtego, () => this.playShieldHit());
    }

    /**
     * Voldemort Confringo alan büyüsünü fırlattığında çalınır.
     */
    playConfringoCast() {
        this.playSound(this.soundPaths.confringo, () => this.playWalk());
    }

    /**
     * Voldemort Crucio işkence lanetini kanalize ettiğinde çalınır.
     */
    playCrucioCast() {
        this.playSound(this.soundPaths.crucio, () => this.playLightning());
    }

    /**
     * Voldemort Avada Kedavra ölüm lanetini fırlattığında çalınır.
     */
    playAvadaKedavraCast() {
        this.playSound(this.soundPaths.avadaKedavra, () => this.playLightning());
    }

    /**
     * Morgan Sectumsempra sinsi kesiğini fırlattığında çalınır.
     */
    playMorganSectumsempraCast() {
        this.playSound(this.soundPaths.morganSectumsempra, () => this.playExplosion());
    }

    /**
     * Morgan Expelliarmus nihai sersemletme büyüsünü fırlattığında çalınır.
     */
    playMorganExpelliarmusCast() {
        this.playSound(this.soundPaths.morganExpelliarmus, () => this.playLightning());
    }

    /**
     * Morgan Crucio veya ağır darbe altında çığlık attığında çalınır.
     */
    playMorganScreamSound() {
        this.playSound(this.soundPaths.morganScream, () => this.playScream(true));
    }

    /**
     * Madde 10: Morgan Incendio alev püskürtmesini kanalize ettiğinde döngüsel olarak başlatılır.
     */
    startFlame() {
        this.init();
        if (this.incendioAudio) return; // Zaten çalıyorsa mükerrer başlatma

        this.incendioAudio = new Audio(this.soundPaths.morganIncendio);
        this.incendioAudio.loop = true;
        this.incendioAudio.volume = 0.65;
        this.incendioAudio.play().catch(err => {
            console.warn("[SES MOTORU] Incendio MP3 çalınamadı. Sentezleyici harlama sesi başlatılıyor.", err);
            this.startSyntheticFlame();
        });
    }

    /**
     * Morgan Incendio alev püskürtmesini durdurduğunda çağrılır.
     */
    stopFlame() {
        if (this.incendioAudio) {
            try {
                this.incendioAudio.pause();
                this.incendioAudio.currentTime = 0;
            } catch(e){}
            this.incendioAudio = null;
        }
        this.stopSyntheticFlame();
    }


    /* ========================================================================
       YEDEK SENTEZLEYİCİ SİSTEMİ (PROSEDÜREL WEB AUDIO API FALLBACKS)
       ======================================================================== */

    /**
     * Beyaz Gürültü (White Noise) Tampon Bellek Oluşturucu.
     */
    createNoiseBuffer(seconds = 1.5) {
        const bufferSize = this.ctx.sampleRate * seconds;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    /**
     * Yürüme Ayak Sesi Sentezi (Low-pitched Thud)
     */
    playWalk() {
        this.init();
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(95, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.12);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.12);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
    }

    /**
     * Sentezleyici Patlama Sesi (Confringo Aftermath Fallback)
     */
    playExplosion() {
        this.init();

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(1.5);

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(250, this.ctx.currentTime);
        noiseFilter.frequency.exponentialRampToValueAtTime(15, this.ctx.currentTime + 1.2);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.2);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start();

        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(110, this.ctx.currentTime);
        subOsc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.4);

        subGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        subGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

        subOsc.connect(subGain);
        subGain.connect(this.ctx.destination);

        subOsc.start();
        subOsc.stop(this.ctx.currentTime + 0.4);
    }

    /**
     * Sentezleyici Yıldırım Sesi (Crucio / Avada Fallback)
     */
    playLightning() {
        this.init();

        const staticNoise = this.ctx.createBufferSource();
        staticNoise.buffer = this.createNoiseBuffer(1.0);

        const staticFilter = this.ctx.createBiquadFilter();
        staticFilter.type = 'highpass';
        staticFilter.frequency.setValueAtTime(1300, this.ctx.currentTime);

        const staticGain = this.ctx.createGain();
        staticGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        staticGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.9);

        staticNoise.connect(staticFilter);
        staticFilter.connect(staticGain);
        staticGain.connect(this.ctx.destination);
        staticNoise.start();

        const shockOsc = this.ctx.createOscillator();
        const shockGain = this.ctx.createGain();

        shockOsc.type = 'sawtooth';
        shockOsc.frequency.setValueAtTime(180, this.ctx.currentTime);

        shockGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        shockGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.9);

        shockOsc.connect(shockGain);
        shockGain.connect(this.ctx.destination);

        shockOsc.start();
        shockOsc.stop(this.ctx.currentTime + 0.9);
    }

    /**
     * Prosedürel Alev Sesi Başlatıcı (Incendio Fallback)
     */
    startSyntheticFlame() {
        if (this.fireOsc) return;

        this.fireSource = this.ctx.createBufferSource();
        this.fireSource.buffer = this.createNoiseBuffer(1.0);
        this.fireSource.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(320, this.ctx.currentTime);
        filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

        this.fireGain = this.ctx.createGain();
        this.fireGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.fireGain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.15);

        this.fireSource.connect(filter);
        filter.connect(this.fireGain);
        this.fireGain.connect(this.ctx.destination);
        this.fireSource.start();

        this.fireOsc = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();

        this.fireOsc.frequency.setValueAtTime(15, this.ctx.currentTime); 
        lfoGain.gain.setValueAtTime(80, this.ctx.currentTime);          

        this.fireOsc.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        
        this.fireOsc.start();
    }

    /**
     * Prosedürel Alev Sesi Kapatıcı
     */
    stopSyntheticFlame() {
        const tempSource = this.fireSource;
        const tempOsc = this.fireOsc;
        const tempGain = this.fireGain;

        if (tempGain) {
            try {
                tempGain.gain.setValueAtTime(tempGain.gain.value, this.ctx.currentTime);
                tempGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
            } catch(e){}
        }

        setTimeout(() => {
            try { if (tempSource) tempSource.stop(); } catch(e){}
            try { if (tempOsc) tempOsc.stop(); } catch(e){}
        }, 200);

        this.fireSource = null;
        this.fireOsc = null;
        this.fireGain = null;
    }

    /**
     * Sentezleyici İşkence Çığlığı (Scream Fallback)
     */
    playScream(isMorgan) {
        this.init();

        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        const baseFreq = isMorgan ? 780 : 380;
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        
        lfo.frequency.setValueAtTime(40, this.ctx.currentTime);
        lfoGain.gain.setValueAtTime(120, this.ctx.currentTime); 
        
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(baseFreq * 1.8, this.ctx.currentTime);
        lfoGain.connect(osc2.frequency);
        osc2.start();

        gain.gain.setValueAtTime(0.32, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.1);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
        filter.Q.setValueAtTime(1.5, this.ctx.currentTime); 

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc2.start();

        osc.stop(this.ctx.currentTime + 1.1);
        osc2.stop(this.ctx.currentTime + 1.1);
        lfo.stop(this.ctx.currentTime + 1.1);
    }

    /**
     * Kalkan Darbe Çınlaması (Synthetic Fallback)
     */
    playShieldHit() {
        this.init();

        const carrier = this.ctx.createOscillator();
        const carrierGain = this.ctx.createGain();

        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(880, this.ctx.currentTime); 

        const modulator = this.ctx.createOscillator();
        const modulatorGain = this.ctx.createGain();

        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(1340, this.ctx.currentTime); 
        modulatorGain.gain.setValueAtTime(500, this.ctx.currentTime);   

        modulator.connect(modulatorGain);
        modulatorGain.connect(carrier.frequency);

        carrierGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        carrierGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        carrier.connect(carrierGain);
        carrierGain.connect(this.ctx.destination);

        modulator.start();
        carrier.start();

        modulator.stop(this.ctx.currentTime + 0.3);
        carrier.stop(this.ctx.currentTime + 0.3);
    }

    /**
     * Ulti Yeteneği Dolarken Yükselen Çınlama Sesi Sentezi
     */
    playChargeUlt() {
        this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 1.0);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 1.0);
    }
}
