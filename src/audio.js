/**
 * ============================================================================
 * HOGWARTS DUEL - PROSEDÜREL SES SENTEZLEME MOTORU (WEB AUDIO API)
 * ============================================================================
 * Bu modül; harici hiçbir ses (.mp3/.wav) dosyası yüklemeye ihtiyaç duymadan,
 * tarayıcının kendi osilatör ve filtre modüllerini kullanarak tüm ses efektlerini
 * gerçek zamanlı (prosedürel) olarak sentezler.
 * 
 * Modüler Mimari Tasarımı (ES6):
 * - FM Synthesis (Frekans Modülasyonu) ile metalik kalkan ve şimşek çıtırtıları üretir.
 * - LFO (Düşük Frekans Osilatörü) ile alevlerin dalgalanma (tremolo) hissini taklit eder.
 * - Bandpass Formant filtreleri ile insan gırtlak rezonansını simüle ederek acı çığlığı üretir.
 */

export class AudioController {
    constructor() {
        // Tarayıcının ana ses işlem birimi referansı (AudioContext)
        this.ctx = null;

        // Incendio alev akışı için sürekli döngüde çalışan aktif ses düğümleri (nodes)
        this.fireSource = null;
        this.fireOsc = null;
        this.fireGain = null;
    }

    /**
     * Tarayıcı güvenlik politikası gereği, kullanıcının ekrana ilk dokunuşunda/tuş vuruşunda
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
     * Beyaz Gürültü (White Noise) Tampon Bellek Oluşturucu.
     * Patlamalar, rüzgarlar, şimşekler ve alev seslerinin ham maddesi olan
     * rastgele ses sinyallerini üretir.
     * 
     * @param {number} seconds - Üretilecek gürültünün saniye cinsinden süresi
     */
    createNoiseBuffer(seconds = 1.5) {
        const bufferSize = this.ctx.sampleRate * seconds;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Sinyal düzlemini rastgele -1 ile 1 arasında sayılarla doldur
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    /**
     * Yürüme Ayak Sesi Sentezi (Low-pitched Thud)
     * Ağır cüppeli büyücülerin mermer zemindeki ayak adımlarını simüle eder.
     */
    playWalk() {
        this.init();
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Üçgen dalga yumuşak bas vuruşları için idealdir
        osc.type = 'triangle';
        // Perdeyi (pitch) 95Hz'den başlatıp 0.12 saniyede hızlıca 35Hz'e düşür (Thud etkisi)
        osc.frequency.setValueAtTime(95, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.12);

        // Ayak sesini boğuklaştırmak için lowpass filtre uygula
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, this.ctx.currentTime);

        // Sesin milisaniyeler içinde sönümlenmesini sağlayan genlik zarfı (Envelope)
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.12);

        // Düğüm bağlantı şeması: Oscillator -> Filter -> Gain -> Hoparlör
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        // Osilatörü başlat ve 0.12 saniye sonra otomatik durdur
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
    }

    /**
     * Patlama Sesi Sentezi (Confringo Aftermath)
     * Basit bir gürültü yerine, derin bir bas darbesi ile boğuk bir gürültünün birleşimidir.
     */
    playExplosion() {
        this.init();

        // 1. Katman: Boğuk Gürültü (Rumble)
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(1.5);

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        // Patlamanın şok dalgasını simüle etmek için filtre eşiğini 250Hz'den 15Hz'e süpür
        noiseFilter.frequency.setValueAtTime(250, this.ctx.currentTime);
        noiseFilter.frequency.exponentialRampToValueAtTime(15, this.ctx.currentTime + 1.2);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.2);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start();

        // 2. Katman: Devasa Sub-Bass Darbesi (Boom)
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
     * Yıldırım ve Çatırtı Sesi Sentezi (Avada Kedavra / Expelliarmus)
     * Yüksek frekanslı statik elektrik deşarjı ile hırıltılı bir elektrik şokunun birleşimidir.
     */
    playLightning() {
        this.init();

        // 1. Katman: Statik Çıtırtı (High-pass filtered noise)
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

        // 2. Katman: Elektrik Şoku (Resonant hırıltı)
        const shockOsc = this.ctx.createOscillator();
        const shockGain = this.ctx.createGain();

        // Testere dişi (sawtooth) elektrik arkı hissi vermek için mükemmeldir
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
     * Sürekli Kanalize Edilen Incendio Alev Akışı Başlatıcı
     * Alevlerin sürekli harlama/dalgalanma (tremolo) homurtusu için LFO modülasyonu içerir.
     */
    startFlame() {
        this.init();
        if (this.fireOsc) return; // Zaten alev sesi çalıyorsa mükerrer başlatma

        // Sürekli döngüde beyaz gürültü kaynağını bağla
        this.fireSource = this.ctx.createBufferSource();
        this.fireSource.buffer = this.createNoiseBuffer(1.0);
        this.fireSource.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(320, this.ctx.currentTime);
        filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

        this.fireGain = this.ctx.createGain();
        // Hoparlör patlamalarını önlemek için yumuşak bir yükselme (fade-in) uygula
        this.fireGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.fireGain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.15);

        this.fireSource.connect(filter);
        filter.connect(this.fireGain);
        this.fireGain.connect(this.ctx.destination);
        this.fireSource.start();

        // --- LFO MODÜLASYONU (Alev Harlama Efekti) ---
        // Saniyede 15 kez (15Hz) filtrenin eşik değerini sarsarak alevlerin harlama sesini taklit et
        this.fireOsc = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();

        this.fireOsc.frequency.setValueAtTime(15, this.ctx.currentTime); // LFO Frekansı
        lfoGain.gain.setValueAtTime(80, this.ctx.currentTime);          // Modülasyon Genliği (Filtre salınım payı)

        // LFO Bağlantısı: LFO -> lfoGain -> Filtre Frekansı parametresi
        this.fireOsc.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        
        this.fireOsc.start();
    }

    /**
     * Incendio alev sesini yumuşak bir fade-out ile sonlandırır (Çıtırtı kliklerini önler).
     */
    stopFlame() {
        const tempSource = this.fireSource;
        const tempOsc = this.fireOsc;
        const tempGain = this.fireGain;

        if (tempGain) {
            // Sesi 0.2 saniyede sıfıra düşürerek hoparlörün klik sesi çıkarmasını önle
            tempGain.gain.setValueAtTime(tempGain.gain.value, this.ctx.currentTime);
            tempGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
        }

        // 0.2 saniye sonra tüm düğümleri kapat ve temizle
        setTimeout(() => {
            try { if (tempSource) tempSource.stop(); } catch(e){}
            try { if (tempOsc) tempOsc.stop(); } catch(e){}
        }, 200);

        this.fireSource = null;
        this.fireOsc = null;
        this.fireGain = null;
    }

    /**
     * Crucio İşkence Çığlığı Sentezi (FM Vocal Formant Synthesis)
     * İnsan ses tellerinin rezonansını (Formant) simüle etmek için tasarlanmıştır.
     * 
     * @param {boolean} isMorgan - Çığlık atan karakterin Morgan (kadın) olup olmadığı bilgisi
     */
    playScream(isMorgan) {
        this.init();

        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Taban Frekans Seçimi (Morgan için ince, Voldemort için kalın hırıltılı çığlık)
        const baseFreq = isMorgan ? 780 : 380;
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

        // --- FM MODÜLASYONU (Korku Titremesi) ---
        // Saniyede 40 kez (40Hz) perdeyi titreterek acı ve çaresizlik vibratosu oluştur
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        
        lfo.frequency.setValueAtTime(40, this.ctx.currentTime);
        lfoGain.gain.setValueAtTime(120, this.ctx.currentTime); // Titreme genliği
        
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        // Ses tellerinin harmonik zenginliği için ikinci kare osilatör ekle
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(baseFreq * 1.8, this.ctx.currentTime);
        lfoGain.connect(osc2.frequency);
        osc2.start();

        // Çığlığın 1.1 saniyede sönümlenmesini sağlayan genlik zarfı
        gain.gain.setValueAtTime(0.32, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.1);

        // --- GIRTLAKSIL REZONANS FİLTRESİ (Vocal Formant Filter) ---
        // İnsan ağız boşluğunun morfolojisini taklit etmek için bandpass filtresini 1200Hz'e kilitle
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
        filter.Q.setValueAtTime(1.5, this.ctx.currentTime); // Rezonans keskinliği

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
     * Protego Kalkanına Çarpan Büyülerin Çınlama Sesi (Metallic Bell Clink)
     * Kristal bir kalkan hissi vermek için metalik rezonanslı FM sentezi kullanır.
     */
    playShieldHit() {
        this.init();

        // Taşıyıcı Dalga (Hoparlöre giden çınlama)
        const carrier = this.ctx.createOscillator();
        const carrierGain = this.ctx.createGain();

        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(880, this.ctx.currentTime); // Yüksek frekanslı zil sesi

        // Düzenleyici Dalga (Metalleşme hissi veren uyumsuz frekans)
        const modulator = this.ctx.createOscillator();
        const modulatorGain = this.ctx.createGain();

        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(1340, this.ctx.currentTime); // Uyumsuz zil tınısı
        modulatorGain.gain.setValueAtTime(500, this.ctx.currentTime);   // Modülasyon derinliği

        // Modülasyon Bağlantısı
        modulator.connect(modulatorGain);
        modulatorGain.connect(carrier.frequency);

        // Kalkan darbe genlik zarfı (Çok hızlı sönümlenen metalik çınlama)
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
     * Ulti Yeteneği Dolarken Çalan Yükselen Çınlama Sesi Sentezi
     */
    playChargeUlt() {
        this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        // Frekansı 1.0 saniyede 150Hz'den 600Hz'e yükselterek dolma hissi ver (Sweep Effect)
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
