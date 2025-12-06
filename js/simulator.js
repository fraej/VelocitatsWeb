/**
 * Velocitats - Sensor Simulator
 * Simulates GPS movement, compass rotation, and acceleration data
 */

class SensorSimulator {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;

        // Simulation state
        this.time = 0;
        this.latitude = 41.3851;   // Barcelona
        this.longitude = 2.1734;
        this.speed = 0;
        this.bearing = 0;
        this.azimuth = 0;
        this.acceleration = 0;

        // Simulation parameters
        this.scenario = 'cruise'; // cruise, accelerate, brake, stop
        this.scenarioTime = 0;

        // Callbacks (same interface as SensorManager)
        this.onGpsUpdate = null;
        this.onOrientationUpdate = null;
        this.onMotionUpdate = null;
    }

    /**
     * Start the simulation
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        // Run at 60fps for smooth animation
        this.intervalId = setInterval(() => this.tick(), 1000 / 30);
        console.log('Simulation started');
    }

    /**
     * Stop the simulation
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
    }

    /**
     * Simulation tick - update all values
     */
    tick() {
        this.time += 1 / 30; // 30 fps
        this.scenarioTime += 1 / 30;

        // Run scenario logic
        this.updateScenario();

        // Update position based on speed and bearing
        this.updatePosition();

        // Send updates to callbacks
        this.sendUpdates();
    }

    /**
     * Scenario state machine - simulates realistic driving patterns
     */
    updateScenario() {
        switch (this.scenario) {
            case 'accelerate':
                // Accelerate for 5 seconds
                this.speed = Math.min(this.speed + 0.5, 15); // Max 15 m/s (54 km/h)
                this.acceleration = 2.5;
                if (this.scenarioTime > 5) {
                    this.scenario = 'cruise';
                    this.scenarioTime = 0;
                }
                break;

            case 'cruise':
                // Cruise for 8-12 seconds, gentle turns
                this.acceleration = Math.sin(this.time * 0.5) * 0.5; // Slight variations
                this.bearing += Math.sin(this.time * 0.3) * 0.5; // Gentle curves
                this.azimuth += Math.sin(this.time * 0.2) * 0.3; // Device rotation

                if (this.scenarioTime > 8 + Math.random() * 4) {
                    // Randomly brake or continue
                    if (Math.random() > 0.3) {
                        this.scenario = 'brake';
                    } else {
                        this.scenario = 'accelerate';
                    }
                    this.scenarioTime = 0;
                }
                break;

            case 'brake':
                // Hard braking for 2 seconds
                this.speed = Math.max(this.speed - 2.5, 0);
                this.acceleration = -7.0; // Hard brake!

                if (this.scenarioTime > 2 || this.speed <= 0) {
                    this.scenario = this.speed <= 0 ? 'stop' : 'cruise';
                    this.scenarioTime = 0;
                }
                break;

            case 'stop':
                // Stopped for 3 seconds
                this.speed = 0;
                this.acceleration = 0;

                if (this.scenarioTime > 3) {
                    this.scenario = 'accelerate';
                    this.scenarioTime = 0;
                }
                break;
        }

        // Keep bearing in 0-360 range
        this.bearing = ((this.bearing % 360) + 360) % 360;
        this.azimuth = ((this.azimuth % 360) + 360) % 360;
    }

    /**
     * Update lat/lng based on speed and bearing
     */
    updatePosition() {
        if (this.speed <= 0) return;

        const dt = 1 / 30;
        const distance = this.speed * dt; // meters

        // Convert bearing to radians
        const bearingRad = this.bearing * Math.PI / 180;

        // Earth's radius in meters
        const R = 6371000;

        // Calculate new position
        const latRad = this.latitude * Math.PI / 180;
        const dLat = (distance * Math.cos(bearingRad)) / R;
        const dLng = (distance * Math.sin(bearingRad)) / (R * Math.cos(latRad));

        this.latitude += dLat * 180 / Math.PI;
        this.longitude += dLng * 180 / Math.PI;
    }

    /**
     * Send updates through callbacks
     */
    sendUpdates() {
        // GPS update
        if (this.onGpsUpdate) {
            this.onGpsUpdate({
                latitude: this.latitude,
                longitude: this.longitude,
                speed: this.speed,
                bearing: this.bearing,
                accuracy: 5,
                timestamp: Date.now()
            });
        }

        // Orientation update
        if (this.onOrientationUpdate) {
            this.onOrientationUpdate({
                azimuth: this.azimuth,
                initialAzimuth: 0,
                beta: 0,
                gamma: 0
            });
        }

        // Motion update
        if (this.onMotionUpdate) {
            // Add some noise
            const noise = (Math.random() - 0.5) * 0.5;
            this.onMotionUpdate({
                x: noise,
                y: this.acceleration + noise,
                z: noise,
                magnitude: Math.abs(this.acceleration) + Math.random() * 0.5,
                forward: this.acceleration
            });
        }
    }

    /**
     * Trigger a manual brake event (for testing)
     */
    triggerBrake() {
        this.scenario = 'brake';
        this.scenarioTime = 0;
    }

    /**
     * Initialize (compatible with SensorManager interface)
     */
    async initialize() {
        this.start();
        return { gps: true, orientation: true, motion: true };
    }
}

// Export
window.SensorSimulator = SensorSimulator;
