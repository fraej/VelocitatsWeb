/**
 * Velocitats - Main Application
 * Orchestrates sensors, UI updates, and safety alerts
 */

class VelocitatsApp {
    constructor() {
        // Modules
        this.sensors = new SensorManager();
        this.simulator = new SensorSimulator();
        this.audio = new AudioEngine();

        // Mode
        this.isSimulating = false;

        // Wake lock
        this.wakeLock = null;

        // Thresholds (lowered for easier testing)
        this.SPEED_THRESHOLD = 0.5;    // m/s (~2 km/h) - minimum speed for braking detection
        this.BRAKE_THRESHOLD = -2.0;   // m/s² - deceleration threshold

        // UI Elements
        this.elements = {
            overlay: document.getElementById('permission-overlay'),
            startBtn: document.getElementById('start-btn'),
            simulateBtn: document.getElementById('simulate-btn'),
            dashboard: document.getElementById('dashboard'),

            // Status indicators
            gpsStatus: document.getElementById('gps-status'),
            motionStatus: document.getElementById('motion-status'),
            wakelockStatus: document.getElementById('wakelock-status'),

            // Telemetry
            speedMs: document.getElementById('speed-ms'),
            speedKmh: document.getElementById('speed-kmh'),
            bearing: document.getElementById('bearing'),
            bearingDirection: document.getElementById('bearing-direction'),
            acceleration: document.getElementById('acceleration'),
            accelStatus: document.getElementById('accel-status'),
            accelCard: document.getElementById('accel-card'),
            latitude: document.getElementById('latitude'),
            longitude: document.getElementById('longitude'),

            // Arrows
            northArrow: document.getElementById('north-arrow'),
            velocityArrow: document.getElementById('velocity-arrow'),
            velocityPolygon: document.getElementById('velocity-polygon'),

            // Brake indicator
            brakeIndicator: document.getElementById('brake-indicator'),

            // Settings
            settingsBtn: document.getElementById('settings-btn'),
            settingsPanel: document.getElementById('settings-panel'),
            speedThresholdInput: document.getElementById('speed-threshold'),
            speedThresholdValue: document.getElementById('speed-threshold-value'),
            brakeThresholdInput: document.getElementById('brake-threshold'),
            brakeThresholdValue: document.getElementById('brake-threshold-value'),
            testSoundBtn: document.getElementById('test-sound-btn')
        };

        // State
        this.currentSpeed = 0;
        this.currentBearing = 0;
        this.currentAzimuth = 0;
        this.currentAcceleration = 0;
        this.isBraking = false;

        this.init();
    }

    /**
     * Set up event listeners
     */
    init() {
        this.elements.startBtn.addEventListener('click', () => this.start(false));
        this.elements.simulateBtn.addEventListener('click', () => this.start(true));

        // Handle visibility change for wake lock
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.wakeLock !== null) {
                this.requestWakeLock();
            }
        });

        // Settings panel toggle
        this.elements.settingsBtn.addEventListener('click', () => {
            this.elements.settingsPanel.classList.toggle('hidden');
        });

        // Speed threshold slider (Ionic ion-range uses ionChange)
        this.elements.speedThresholdInput.addEventListener('ionChange', (e) => {
            this.SPEED_THRESHOLD = parseFloat(e.detail.value);
            this.elements.speedThresholdValue.textContent = this.SPEED_THRESHOLD.toFixed(1);
            this.saveSettings();
        });

        // Brake threshold slider (Ionic ion-range uses ionChange)
        this.elements.brakeThresholdInput.addEventListener('ionChange', (e) => {
            this.BRAKE_THRESHOLD = parseFloat(e.detail.value);
            this.elements.brakeThresholdValue.textContent = this.BRAKE_THRESHOLD.toFixed(1);
            this.saveSettings();
        });

        // Test sound button - unlock audio first then play
        this.elements.testSoundBtn.addEventListener('click', async () => {
            await this.audio.unlock();
            this.audio.playBeep(880, 150, 'sine');
        });

        // Load saved settings
        this.loadSettings();

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then((reg) => console.log('Service Worker registered:', reg.scope))
                .catch((err) => console.error('Service Worker registration failed:', err));
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        const settings = {
            speedThreshold: this.SPEED_THRESHOLD,
            brakeThreshold: this.BRAKE_THRESHOLD
        };
        localStorage.setItem('velocitats-settings', JSON.stringify(settings));
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('velocitats-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.SPEED_THRESHOLD = settings.speedThreshold;
                this.BRAKE_THRESHOLD = settings.brakeThreshold;

                // Update UI
                this.elements.speedThresholdInput.value = this.SPEED_THRESHOLD;
                this.elements.speedThresholdValue.textContent = this.SPEED_THRESHOLD.toFixed(1);
                this.elements.brakeThresholdInput.value = this.BRAKE_THRESHOLD;
                this.elements.brakeThresholdValue.textContent = this.BRAKE_THRESHOLD.toFixed(1);
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    /**
     * Start the application
     * @param {boolean} simulate - If true, use simulator instead of real sensors
     */
    async start(simulate = false) {
        this.isSimulating = simulate;

        // Unlock audio (requires user gesture)
        const audioUnlocked = await this.audio.unlock();

        // Play a confirmation beep to verify audio is working
        if (audioUnlocked) {
            // Short high-pitched beep to confirm audio works
            this.audio.playBeep(1200, 100, 'sine');
            console.log('🔊 Audio confirmed working');
        }

        // Choose data source
        const dataSource = simulate ? this.simulator : this.sensors;

        // Set up sensor callbacks
        dataSource.onGpsUpdate = (data) => this.handleGpsUpdate(data);
        dataSource.onOrientationUpdate = (data) => this.handleOrientationUpdate(data);
        dataSource.onMotionUpdate = (data) => this.handleMotionUpdate(data);

        if (!simulate) {
            this.sensors.onError = (sensor, message) => this.handleSensorError(sensor, message);
        }

        // Initialize sensors/simulator
        const results = await dataSource.initialize();

        // Update status indicators
        this.updateStatusIndicator('gps', results.gps);
        this.updateStatusIndicator('motion', results.motion);

        // Request wake lock
        await this.requestWakeLock();

        // Show dashboard
        this.elements.overlay.classList.add('hidden');
        this.elements.dashboard.classList.remove('hidden');

        if (simulate) {
            console.log('🎮 Simulation mode active');
        }
    }

    /**
     * Handle GPS updates
     */
    handleGpsUpdate(data) {
        this.currentSpeed = data.speed || 0;
        this.currentBearing = data.bearing || 0;

        // Update speed display
        this.elements.speedMs.textContent = this.currentSpeed.toFixed(1);
        this.elements.speedKmh.textContent = (this.currentSpeed * 3.6).toFixed(1);

        // Update bearing display
        if (data.bearing !== null && data.bearing !== undefined) {
            this.elements.bearing.textContent = Math.round(data.bearing);
            this.elements.bearingDirection.textContent = SensorManager.bearingToCardinal(data.bearing);
        }

        // Update coordinates
        this.elements.latitude.textContent = SensorManager.toDMS(data.latitude, true);
        this.elements.longitude.textContent = SensorManager.toDMS(data.longitude, false);

        // Update velocity arrow
        this.updateVelocityArrow();

        // Update GPS status
        this.updateStatusIndicator('gps', true);
    }

    /**
     * Handle device orientation updates
     */
    handleOrientationUpdate(data) {
        // Validate azimuth - must be a finite number
        if (!isFinite(data.azimuth)) {
            console.warn('Invalid azimuth received:', data.azimuth);
            return;
        }

        // Normalize azimuth to 0-360 range
        let azimuth = ((data.azimuth % 360) + 360) % 360;
        this.currentAzimuth = azimuth;

        // Rotate north arrow to point to magnetic north
        // When device points north, arrow should point up (0°)
        // As device rotates clockwise, arrow should rotate counter-clockwise
        const northRotation = -azimuth;

        // Use anime.js for SVG rotation with proper pivot point
        anime.set(this.elements.northArrow, {
            rotate: northRotation,
            transformOrigin: '100px 100px'  // Center of 200x200 SVG viewBox
        });

        // Update velocity arrow based on new orientation
        this.updateVelocityArrow();
    }

    /**
     * Handle device motion updates
     */
    handleMotionUpdate(data) {
        this.currentAcceleration = data.forward;

        // Update acceleration display
        this.elements.acceleration.textContent = data.magnitude.toFixed(1);
        this.elements.accelStatus.textContent = this.getAccelDescription(data.forward);

        // Update card styling based on acceleration
        this.elements.accelCard.classList.remove('braking', 'accelerating');
        if (data.forward < -2) {
            this.elements.accelCard.classList.add('braking');
        } else if (data.forward > 2) {
            this.elements.accelCard.classList.add('accelerating');
        }

        // Update motion status
        this.updateStatusIndicator('motion', true);

        // Check for braking condition
        this.checkBraking(data.forward);
    }

    /**
     * Get human-readable acceleration description
     */
    getAccelDescription(forward) {
        if (forward < -5) return 'Hard braking';
        if (forward < -2) return 'Braking';
        if (forward > 5) return 'Hard acceleration';
        if (forward > 2) return 'Accelerating';
        return 'Steady';
    }

    /**
     * Update velocity arrow position and size
     */
    updateVelocityArrow() {
        // Calculate arrow rotation:
        // GPS bearing is the direction of travel (0° = North)
        // We need to show this relative to the device's current orientation
        let rotation = this.currentBearing - this.currentAzimuth;

        // Normalize rotation to 0-360 range
        rotation = ((rotation % 360) + 360) % 360;

        // Scale arrow length based on speed (min 35px, max 70px from center)
        const minLength = 35;
        const maxLength = 70;
        const maxSpeed = 30; // m/s (~108 km/h)

        const speedRatio = Math.min(this.currentSpeed / maxSpeed, 1);
        const arrowLength = minLength + (maxLength - minLength) * speedRatio;

        // Calculate arrow polygon points
        // Arrow tip, then the two base corners, then back to meet
        const tipY = 100 - arrowLength;
        const baseY = 100 - arrowLength + 35;
        const midY = 100 - arrowLength + 25;

        // Update polygon points
        this.elements.velocityPolygon.setAttribute(
            'points',
            `100,${tipY} 94,${baseY} 100,${midY} 106,${baseY}`
        );

        // Use anime.js for SVG rotation with proper pivot point
        anime.set(this.elements.velocityArrow, {
            rotate: rotation,
            transformOrigin: '100px 100px'  // Center of 200x200 SVG viewBox
        });
    }

    /**
     * Check braking conditions and trigger alert
     */
    checkBraking(forwardAccel) {
        const isMoving = this.currentSpeed > this.SPEED_THRESHOLD;
        const isHardBraking = forwardAccel < this.BRAKE_THRESHOLD;

        if (isMoving && isHardBraking) {
            if (!this.isBraking) {
                this.isBraking = true;
                this.audio.playBrakeAlert();
                this.elements.brakeIndicator.classList.remove('hidden');
            }
        } else {
            if (this.isBraking) {
                this.isBraking = false;
                this.elements.brakeIndicator.classList.add('hidden');
            }
        }
    }

    /**
     * Handle sensor errors
     */
    handleSensorError(sensor, message) {
        console.error(`Sensor error (${sensor}):`, message);
        this.updateStatusIndicator(sensor, false, true);

        // Update UI for specific sensor errors
        if (sensor === 'motion') {
            this.elements.acceleration.textContent = '---';
            this.elements.accelStatus.textContent = 'Not available';
        }
    }

    /**
     * Update status indicator dot
     */
    updateStatusIndicator(sensor, active, error = false) {
        let element;
        switch (sensor) {
            case 'gps':
                element = this.elements.gpsStatus;
                break;
            case 'motion':
            case 'orientation':
                element = this.elements.motionStatus;
                break;
            case 'wakelock':
                element = this.elements.wakelockStatus;
                break;
            default:
                return;
        }

        element.classList.remove('active', 'warning', 'error');
        if (error) {
            element.classList.add('error');
        } else if (active) {
            element.classList.add('active');
        }
    }

    /**
     * Request screen wake lock
     */
    async requestWakeLock() {
        if (!('wakeLock' in navigator)) {
            console.warn('Wake Lock API not supported');
            return;
        }

        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.updateStatusIndicator('wakelock', true);

            this.wakeLock.addEventListener('release', () => {
                this.updateStatusIndicator('wakelock', false);
            });

            console.log('Wake Lock acquired');
        } catch (error) {
            console.error('Wake Lock failed:', error);
            this.updateStatusIndicator('wakelock', false, true);
        }
    }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VelocitatsApp();
});
