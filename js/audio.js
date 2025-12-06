/**
 * Velocitats - Audio Engine
 * Web Audio API based beep synthesizer for safety alerts
 */

class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.isUnlocked = false;
        this.lastBeepTime = 0;
        this.debounceMs = 1000; // 1 second between beeps
    }

    /**
     * Initialize audio context (must be called from user interaction)
     */
    async unlock() {
        if (this.isUnlocked) return true;

        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // iOS requires a silent sound to be played to unlock
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Play a silent buffer to fully unlock on iOS
            const buffer = this.audioContext.createBuffer(1, 1, 22050);
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start(0);

            this.isUnlocked = true;
            console.log('Audio unlocked');
            return true;
        } catch (error) {
            console.error('Failed to unlock audio:', error);
            return false;
        }
    }

    /**
     * Play a synthetic beep sound
     * @param {number} frequency - Frequency in Hz (default 880)
     * @param {number} duration - Duration in ms (default 150)
     * @param {string} type - Oscillator type: sine, square, sawtooth, triangle
     */
    playBeep(frequency = 880, duration = 150, type = 'sine') {
        if (!this.isUnlocked || !this.audioContext) {
            console.warn('Audio not unlocked');
            return false;
        }

        // Debounce check
        const now = Date.now();
        if (now - this.lastBeepTime < this.debounceMs) {
            return false;
        }
        this.lastBeepTime = now;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

            // Envelope for smooth sound
            const startTime = this.audioContext.currentTime;
            const endTime = startTime + (duration / 1000);

            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.01); // Quick attack
            gainNode.gain.setValueAtTime(0.5, endTime - 0.05);
            gainNode.gain.linearRampToValueAtTime(0, endTime); // Quick release

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.start(startTime);
            oscillator.stop(endTime);

            return true;
        } catch (error) {
            console.error('Beep failed:', error);
            return false;
        }
    }

    /**
     * Play the braking alert beep
     */
    playBrakeAlert() {
        // 880Hz (A5 note) for 150ms - sharp, noticeable but not alarming
        return this.playBeep(880, 150, 'sine');
    }

    /**
     * Set the debounce interval between beeps
     * @param {number} ms - Milliseconds between allowed beeps
     */
    setDebounce(ms) {
        this.debounceMs = ms;
    }
}

// Export for use in app.js
window.AudioEngine = AudioEngine;
