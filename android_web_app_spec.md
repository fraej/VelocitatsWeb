# Velocitats - Android Web App Specification

## 1. Overview
**Velocitats** is a web-based mobile application designed to provide real-time locational and kinematic feedback to the user. It functions as a digital dashboard displaying speed, bearing, coordinates, and acceleration, augmented with visual directional indicators and audible safety alerts.

## 2. Target Platform
*   **Primary**: Mobile Web (Android Chrome / generic mobile browsers).
*   **Deployment Model**: Progressive Web App (PWA) with "Add to Home Screen" capability and potentially TWA (Trusted Web Activity) wrapping for Play Store distribution.

## 3. Functional Requirements

### 3.1. Dashboard Telemetry
The application must display the following metrics in real-time text format:
*   **Speed**: Current speed in both meters per second (m/s) and kilometers per hour (km/h).
    *   *Source*: GPS (Geolocation API).
*   **Bearing**: Direction of travel in degrees (0-360°).
    *   *Source*: GPS (Geolocation API).
*   **Coordinates**: Latitude and Longitude in Degrees, Minutes, Seconds (DMS) format (e.g., `52° 31' 12.345" N`).
    *   *Source*: GPS (Geolocation API).
*   **Acceleration**: Linear acceleration magnitude in m/s².
    *   *Source*: Device Motion Sensors (Accelerometer excluding gravity).
    *   *Behavior*: Explicitly state "Waiting for sensor..." if data is unavailable.

### 3.2. Visual Visualization (Arrow View)
A graphical component (SVG) providing directional situational awareness:
*   **North Indicator (Blue Arrow)**:
    *   Points towards Magnetic North.
    *   *Rotation*: Rotates based on the device's physical orientation (Azimuth).
    *   *Reference*: Phone "Up" (Portrait mode top).
*   **Velocity Vector (Red Arrow)**:
    *   Points towards the user's actual direction of movement (GPS Bearing) relative to the device's orientation.
    *   *Logic*: Rotation = `GPS Bearing` - `Device Start Azimuth`.
    *   *Dynamic Scaling*: The arrow's length must scale dynamically based on speed (longer arrow = faster speed), capped at a visual maximum.

### 3.3. Audio Safety Alerts
*   **Braking Alert (Synthetic Beep)**:
    *   Top priority safety feature.
    *   **Trigger Condition**: 
        1.  User is moving (Speed > ~1.4 m/s or 5 km/h).
        2.  Significant "Braking" detected (Forward Acceleration < -5.0 m/s²).
    *   **Action**: Play a generated sine wave beep (e.g., 880Hz for 150ms).
    *   **Debounce**: Prevent spamming by enforcing a minimum interval (e.g., 1 second) between beeps.

### 3.4. System Behavior
*   **Screen Wake Lock**: The screen must remain active (prevent sleep) while the app is in the foreground.
*   **Permissions Handling**: gracefully request and handle denial of:
    *   Location (High Accuracy).
    *   Motion Sensors (Gyroscope/Accelerometer).

## 4. Technical Specifications (Web Stack)

### 4.1. APIs & Web Standards
*   **Geolocation API**:
    *   Use `navigator.geolocation.watchPosition()` with `enableHighAccuracy: true`.
*   **Device Orientation API**:
    *   Use `window.addEventListener('deviceorientationabsolute', ...)` for compass azimuth. Fallback to `deviceorientation` if absolute is unavailable (though magnetic north requires absolute).
*   **Device Motion API**:
    *   Use `window.addEventListener('devicemotion', ...)` to access `acceleration` (excluding gravity).
    *   *Note*: iOS requires explicit permission request interaction for Motion/Orientation; Android Chrome generally allows it if the site is HTTPS, though usage varies by version.
*   **Web Audio API**:
    *   Use `AudioContext` to synthesize the beep sound (low latency compared to loading an MP3).
    *   *Note*: Audio context must be unlocked via a user interaction (tap/click) first.
*   **Screen Wake Lock API**:
    *   Use `navigator.wakeLock.request('screen')`.

### 4.2. UI/UX Design
*   **Theme**: Light/Dark mode compatible (Android app uses `Theme.AppCompat.Light.NoActionBar`).
*   **Layout**: Simple vertical stack:
    *   Text Statistics (Speed, Bearing, Coords).
    *   Visual Arrow View (Centered, taking available space).
*   **Responsiveness**: Layout should adapt to portrait and landscape, though Portrait is the primary use case for the compass view.

## 5. Implementation Roadmap
1.  **Project Setup**: Initialize PWA manifest and service worker.
2.  **Sensor Access Layer**: Abstract the Geolocation and Motion sensor logic, handling browser differences (permissions, iOS vs Android event mapping).
3.  **Visual Component**: Implement the Dual-Arrow view using HTML5 Canvas for smooth 60fps rotation updates.
4.  **Audio Engine**: Implement a simple oscillator-based audio player for the beep.
5.  **Integration**: Connect sensors to UI and Audio logic.
6.  **Testing**: Field testing for GPS accuracy and Braking threshold calibration.
