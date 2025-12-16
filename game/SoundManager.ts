import { TowerType } from '../types';

export class SoundManager {
    private ctx: AudioContext;
    private masterGain: GainNode;
    
    // --- 节奏音序器状态 ---
    private isInitialized: boolean = false;
    private isMuted: boolean = false;
    private isPlayingBgm: boolean = false;
    
    private nextNoteTime: number = 0;
    private current16thNote: number = 0; // 0-63 循环 (4小节)
    private tempo: number = 110.0; // BPM
    private lookahead: number = 25.0; // 调度频率 ms
    private scheduleAheadTime: number = 0.1; // 预调度时间 seconds
    private timerID: number | null = null;

    // 音符频率表 (扩展)
    private readonly FREQS = {
        D2: 73.42,
        E2: 82.41,
        F2: 87.31,
        G2: 98.00,
        A2: 110.00,
        Bb2: 116.54,
        C3: 130.81,
        D3: 146.83,
        E3: 164.81,
        F3: 174.61,
        G3: 196.00,
        A3: 220.00,
        C4: 261.63,
        D4: 293.66,
        E4: 329.63,
        F4: 349.23,
        A4: 440.00,
        C5: 523.25,
        D5: 587.33,
        E5: 659.25
    };

    constructor() {
        // 兼容不同浏览器的 AudioContext
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        // 整体音量调低，使其更像背景音乐
        this.masterGain.gain.value = 0.15; 
    }

    /**
     * 初始化音频上下文
     */
    public async init() {
        if (this.isInitialized) return;
        
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        
        this.startBGM();
        this.isInitialized = true;
    }

    public toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        } else {
            this.masterGain.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.1);
        }
    }

    /**
     * 启动 BGM 音序器
     */
    private startBGM() {
        if (this.isPlayingBgm) return;
        this.isPlayingBgm = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.scheduler();
    }

    /**
     * 调度器：负责定期检查并安排未来的音符
     */
    private scheduler() {
        if (!this.isPlayingBgm) return;

        // 当下一个音符的时间在当前时间 + 预读窗口内时，安排它播放
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
        
        // 使用 setTimeout 保持循环检查
        this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }

    /**
     * 计算下一个 16 分音符的时间
     */
    private nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += 0.25 * secondsPerBeat; // 前进 1/4 拍 (16分音符)
        
        this.current16thNote++;
        if (this.current16thNote === 64) { // 4小节 (16 * 4)
            this.current16thNote = 0; 
        }
    }

    /**
     * 在指定时间播放单个节拍的声音
     */
    private scheduleNote(noteIndex: number, time: number) {
        if (this.isMuted) return;

        // --- 1. 鼓组 (Drums) ---
        // Kick: 更加柔和的 4/4 拍，第四小节稍微变化
        if (noteIndex % 4 === 0) {
            // 在第 60 步 (第四小节最后一拍) 跳过底鼓，制造过门感
            if (noteIndex !== 60) {
                this.playKick(time);
            }
        }

        // Hi-Hat: 依然是反拍，但力度更轻，每隔一拍加一些细碎的闭镲
        if (noteIndex % 4 === 2) {
             this.playHiHat(time, 0.3); // Open Hat (Medium)
        } else if (noteIndex % 2 !== 0) {
             this.playHiHat(time, 0.08); // Closed Hat (Very Soft)
        }

        // --- 2. 贝斯 (Bass) ---
        // 4 Bar Progression: Dm -> F -> Am -> G
        const bar = Math.floor(noteIndex / 16);
        const stepInBar = noteIndex % 16;
        
        let rootFreq = this.FREQS.D2;
        if (bar === 1) rootFreq = this.FREQS.F2;
        else if (bar === 2) rootFreq = this.FREQS.A2;
        else if (bar === 3) rootFreq = this.FREQS.G2;

        // 贝斯律动：16分音符滚奏，但在强拍上加重
        let bassFreq = rootFreq;
        
        // 在每小节的后半段加一点八度跳跃，增加律动
        if (stepInBar > 11 && stepInBar % 2 === 0) {
            bassFreq *= 2; 
        }

        let bassVol = 0.25;
        if (stepInBar % 4 === 0) bassVol = 0.35; // 强拍
        else if (stepInBar % 2 !== 0) bassVol = 0.15; // 弱拍

        this.playBass(time, bassFreq, bassVol, 0.12);

        // --- 3. 旋律/氛围 (Arp/Pluck) ---
        // 增加更有旋律感的音符，稀疏一些，不要填满
        // 使用五声音阶：D F G A C
        
        const playMelody = (freq: number, vol: number = 0.15) => {
            this.playPluck(time, freq, vol);
        };

        // Pattern (针对整个64步的旋律设计)
        // 简单的呼应结构
        if (noteIndex === 0) playMelody(this.FREQS.A4, 0.2);
        if (noteIndex === 6) playMelody(this.FREQS.F4);
        if (noteIndex === 12) playMelody(this.FREQS.D4);
        
        if (noteIndex === 16) playMelody(this.FREQS.C5, 0.2);
        if (noteIndex === 22) playMelody(this.FREQS.A4);
        if (noteIndex === 28) playMelody(this.FREQS.F4);

        if (noteIndex === 32) playMelody(this.FREQS.E5, 0.2); // 高潮一点
        if (noteIndex === 38) playMelody(this.FREQS.C5);
        if (noteIndex === 44) playMelody(this.FREQS.A4);

        if (noteIndex === 48) playMelody(this.FREQS.D5, 0.2);
        if (noteIndex === 54) playMelody(this.FREQS.Bb2 * 2); // Bb3
        if (noteIndex === 58) playMelody(this.FREQS.A3);
    }

    // --- 乐器合成器 ---

    private playKick(t: number) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // 柔化：频率下降不要太快，起始频率降低
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.4);

        // 柔化：Attack稍微慢一点点，消除"咔"声
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.6, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.4);
    }

    private playHiHat(t: number, vol: number) {
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // 提高高通频率，让声音更细
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 9000;

        const gain = this.ctx.createGain();
        // 总体音量降低
        gain.gain.setValueAtTime(vol * 0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(t);
    }

    private playBass(t: number, freq: number, vol: number, duration: number) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 2; // 减少共振，声音更平滑

        // 降低截止频率，让 Bass 更深沉，不抢占中高频
        filter.frequency.setValueAtTime(freq * 2.5, t); 
        filter.frequency.exponentialRampToValueAtTime(freq, t + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + duration);
    }

    private playPluck(t: number, freq: number, vol: number) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle'; // 三角波，声音比较空灵
        osc.frequency.setValueAtTime(freq, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.01); // 快速 Attack
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3); // 较长的 Decay

        // 加一点微弱的延迟效果模拟 (通过第二个更弱的音)
        const delayOsc = this.ctx.createOscillator();
        delayOsc.type = 'triangle';
        delayOsc.frequency.setValueAtTime(freq, t + 0.15);
        const delayGain = this.ctx.createGain();
        delayGain.gain.setValueAtTime(0, t + 0.15);
        delayGain.gain.linearRampToValueAtTime(vol * 0.3, t + 0.16);
        delayGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain);
        
        delayOsc.connect(delayGain);
        delayGain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.3);
        
        delayOsc.start(t + 0.15);
        delayOsc.stop(t + 0.4);
    }

    // --- 现有的 SFX ---

    public playShoot(type: TowerType) {
        if (this.isMuted) return;
        const t = this.ctx.currentTime;
        // 降低音效音量，防止盖过 BGM
        const sfxVol = 0.8; 

        switch (type) {
            case TowerType.LASER: this.synthLaser(t, sfxVol); break;
            case TowerType.CANNON: this.synthCannon(t, sfxVol); break;
            case TowerType.SNIPER: this.synthSniper(t, sfxVol); break;
            case TowerType.SLOW: this.synthSlow(t, sfxVol); break;
        }
    }

    public playDeath() {
        if (this.isMuted) return;
        const t = this.ctx.currentTime;
        this.synthCreatureDeath(t);
    }

    private synthLaser(t: number, volScale: number) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
        gain.gain.setValueAtTime(0.2 * volScale, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    private synthCannon(t: number, volScale: number) {
        const duration = 0.3;
        const noiseBuffer = this.createNoiseBuffer(duration);
        const source = this.ctx.createBufferSource();
        source.buffer = noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.linearRampToValueAtTime(50, t + duration);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6 * volScale, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start(t);
    }

    private synthSniper(t: number, volScale: number) {
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.25 * volScale, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 0.1);

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.2);
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1500;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4 * volScale, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(t);
    }

    private synthSlow(t: number, volScale: number) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, t);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4 * volScale, t + 0.05);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 15;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 150; 
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + 0.3);
        lfo.stop(t + 0.3);
    }

    /**
     * 模拟生物死亡/压扁的声音
     * 结合了快速下降的锯齿波（惨叫）和低通噪音（破碎/压扁）
     */
    private synthCreatureDeath(t: number) {
        // 1. 生物惨叫 (Creature Scream) - 下滑的锯齿波
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        // 稍微高一点的起调，模拟惨叫
        osc.frequency.setValueAtTime(700, t); 
        // 快速滑落，模拟失去生命力
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.25); 

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.12, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

        // 滤波去掉过于刺耳的高频，保留“叫声”的质感
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2500;

        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(this.masterGain);
        
        osc.start(t);
        osc.stop(t + 0.3);

        // 2. 躯体破碎 (Body Crunch) - 较闷的噪音
        const duration = 0.2;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(duration);

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        // 频率范围较低，听起来比较“厚重”或“粘稠”
        noiseFilter.frequency.setValueAtTime(800, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(50, t + duration);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.25, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start(t);
    }

    private createNoiseBuffer(duration: number): AudioBuffer {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }
}

export const soundManager = new SoundManager();