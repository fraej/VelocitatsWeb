/**
 * Velocitats - Sensor Abstraction Layer
 * Handles GPS, Device Orientation, and Device Motion APIs
 */

class SensorManager {
    constructor() {
        // State
        this.gpsWatchId = null;
        this.hasMotionPermission = false;
        this.hasOrientationPermission = false;

        // Callbacks
        this.onGpsUpdate = null;
        this.onOrientationUpdate = null;
        this.onMotionUpdate = null;
        this.onError = null;

        // Cached values
        this.lastPosition = null;
        this.lastAzimuth = null;
        this.lastAcceleration = null;
        this.initialAzimuth = null;
    }

    /**
     * Request all necessary permissions and start sensors
     */
    async initialize() {
        const results = {
            gps: false,
            orientation: false,
            motion: false
        };

        // Log available sensor APIs for debugging
        console.log('=== Sensor API Availability ===');
        console.log('Geolocation:', 'geolocation' in navigator ? '✓ Available' : '✗ Not available');
        console.log('DeviceOrientation:', 'ondeviceorientation' in window ? '✓ Available' : '✗ Not available');
        console.log('DeviceOrientationAbsolute:', 'ondeviceorientationabsolute' in window ? '✓ Available' : '✗ Not available');
        console.log('DeviceMotion:', 'ondevicemotion' in window ? '✓ Available' : '✗ Not available');
        console.log('Secure context (HTTPS):', window.isSecureContext ? '✓ Yes' : '✗ No (sensors may be blocked)');

        // Request GPS
        try {
            await this.startGps();
            results.gps = true;
        } catch (error) {
            console.error('GPS error:', error);
            this.handleError('gps', error.message);
        }

        // Request Motion & Orientation (iOS requires explicit permission)
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            // iOS 13+
            try {
                const motionPermission = await DeviceMotionEvent.requestPermission();
                if (motionPermission === 'granted') {
                    this.startMotion();
                    results.motion = true;
                }
            } catch (error) {
                console.error('Motion permission error:', error);
                this.handleError('motion', error.message);
            }

            try {
                const orientationPermission = await DeviceOrientationEvent.requestPermission();
                if (orientationPermission === 'granted') {
                    this.startOrientation();
                    results.orientation = true;
                }
            } catch (error) {
                console.error('Orientation permission error:', error);
                this.handleError('orientation', error.message);
            }
        } else {
            // Android / Desktop - permissions granted automatically (if HTTPS)
            this.startMotion();
            this.startOrientation();
            results.motion = true;
            results.orientation = true;
        }

        return results;
    }

    /**
     * Start GPS tracking
     */
    startGps() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            this.gpsWatchId = navigator.geolocation.watchPosition(
                (position) => {
                    this.lastPosition = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        speed: position.coords.speed || 0,
                        bearing: position.coords.heading || 0,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    };

                    if (this.onGpsUpdate) {
                        this.onGpsUpdate(this.lastPosition);
                    }
                    resolve();
                },
                (error) => {
                    let message = 'Unknown GPS error';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Location permission denied';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Location unavailable';
                            break;
                        case error.TIMEOUT:
                            message = 'Location request timed out';
                            break;
                    }
                    reject(new Error(message));
                },
                options
            );
        });
    }

    /**
     * Start device orientation tracking (compass)
     */
    startOrientation() {
        let usingAbsolute = false;
        let hasReceivedData = false;

        const handleOrientation = (event) => {
            // Get azimuth (compass heading)
            // alpha: rotation around z-axis (0-360)
            // For absolute orientation, use webkitCompassHeading on iOS
            let azimuth;

            if (event.webkitCompassHeading !== undefined) {
                // iOS provides compass heading directly (degrees from magnetic north)
                azimuth = event.webkitCompassHeading;
            } else if (event.alpha !== null) {
                // Android / Desktop:
                // When using deviceorientationabsolute (event.absolute is true),
                // alpha represents the compass heading where:
                //   alpha = 0 means device top points to North
                //   alpha increases as device rotates counter-clockwise
                // So compass heading = (360 - alpha) % 360
                //
                // When using regular deviceorientation (not absolute),
                // alpha is relative to the initial orientation and not useful for compass
                if (event.absolute || usingAbsolute) {
                    // Absolute orientation: convert alpha to compass heading
                    azimuth = (360 - event.alpha) % 360;
                } else {
                    // Relative orientation - can't determine true north
                    // Use alpha directly as a fallback (won't be accurate compass)
                    azimuth = event.alpha;
                }
            } else {
                return; // No valid data
            }

            if (!hasReceivedData) {
                hasReceivedData = true;
                console.log('Compass data received, azimuth:', azimuth.toFixed(1), '°');
            }

            // Store initial azimuth for velocity arrow calculation
            if (this.initialAzimuth === null) {
                this.initialAzimuth = azimuth;
            }

            this.lastAzimuth = azimuth;

            if (this.onOrientationUpdate) {
                this.onOrientationUpdate({
                    azimuth: azimuth,
                    initialAzimuth: this.initialAzimuth,
                    beta: event.beta,   // Front-back tilt
                    gamma: event.gamma  // Left-right tilt
                });
            }
        };

        // Try absolute orientation first (more accurate for compass)
        if ('ondeviceorientationabsolute' in window) {
            usingAbsolute = true;
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
            console.log('Using deviceorientationabsolute for compass');
        } else {
            window.addEventListener('deviceorientation', handleOrientation, true);
            console.log('Using deviceorientation for compass (may not be accurate)');
        }

        // Check if we receive orientation data within 2 seconds
        setTimeout(() => {
            if (!hasReceivedData) {
                console.warn('No compass/orientation data received - sensor may not be available');
                this.handleError('orientation', 'Compass not available on this device');
            }
        }, 2000);

        this.hasOrientationPermission = true;
    }

    /**
     * Start device motion tracking (accelerometer)
     */
    startMotion() {
        let hasReceivedData = false;
        let checkTimeout = null;

        const handleMotion = (event) => {
            // Use acceleration excluding gravity for true linear acceleration
            const accel = event.acceleration || event.accelerationIncludingGravity;

            if (!accel || (accel.x === null && accel.y === null && accel.z === null)) {
                // No valid accelerometer data
                return;
            }

            hasReceivedData = true;

            // Calculate magnitude of acceleration vector
            const magnitude = Math.sqrt(
                (accel.x || 0) ** 2 +
                (accel.y || 0) ** 2 +
                (accel.z || 0) ** 2
            );

            // Forward acceleration (Y-axis in portrait mode)
            // Negative Y means braking (decelerating)
            const forwardAccel = accel.y || 0;

            this.lastAcceleration = {
                x: accel.x || 0,
                y: accel.y || 0,
                z: accel.z || 0,
                magnitude: magnitude,
                forward: forwardAccel
            };

            if (this.onMotionUpdate) {
                this.onMotionUpdate(this.lastAcceleration);
            }
        };

        window.addEventListener('devicemotion', handleMotion, true);

        // Check if we receive accelerometer data within 2 seconds
        checkTimeout = setTimeout(() => {
            if (!hasReceivedData) {
                console.warn('No accelerometer data received - sensor may not be available');
                this.handleError('motion', 'Accelerometer not available on this device');
            }
        }, 2000);

        this.hasMotionPermission = true;
    }

    /**
     * Handle sensor errors
     */
    handleError(sensor, message) {
        if (this.onError) {
            this.onError(sensor, message);
        }
    }

    /**
     * Stop all sensors
     */
    stop() {
        if (this.gpsWatchId !== null) {
            navigator.geolocation.clearWatch(this.gpsWatchId);
            this.gpsWatchId = null;
        }
    }

    /**
     * Convert decimal degrees to DMS format
     */
    static toDMS(decimal, isLatitude) {
        const absolute = Math.abs(decimal);
        const degrees = Math.floor(absolute);
        const minutesFloat = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesFloat);
        const seconds = ((minutesFloat - minutes) * 60).toFixed(3);

        let direction;
        if (isLatitude) {
            direction = decimal >= 0 ? 'N' : 'S';
        } else {
            direction = decimal >= 0 ? 'E' : 'W';
        }

        return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
    }

    /**
     * Get cardinal direction from bearing
     */
    static bearingToCardinal(bearing) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
        const index = Math.round(bearing / 45);
        return directions[index];
    }
}

// Export for use in app.js
window.SensorManager = SensorManager;
