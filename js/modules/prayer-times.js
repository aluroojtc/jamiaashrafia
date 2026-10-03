/**
 * JAMIA ASHRAFIA LAHORE - CLOUD LEARNING MANAGEMENT SYSTEM (LMS)
 * Dynamic, Location-Aware Islamic Prayer Times & Timezone System
 * 
 * Features:
 * 1. Multi-tier Location Detection (GPS Geolocation -> IP Fallback -> Intl Timezone Mapping -> Ashrafia HQ Fallback)
 * 2. True Dynamic Timezone & UTC Offset Calculation (with DST support)
 * 3. Astronomical Solar Prayer Engine (Karachi, MWL, ISNA, Umm al-Qura, Egypt)
 * 4. Asr Juristic Methods (Hanafi default / Shafi'i Standard)
 * 5. High Latitude Twilight Smoothing (No NaN/null times at extreme latitudes)
 * 6. Real-time active prayer indicator & countdown
 * 7. Interactive Location & Timezone Testing Modal
 * 8. Performance Caching (Location + Date + Method)
 */

(function (window) {
    'use strict';

    // Math helper shortcuts for astronomical equations
    const D2R = Math.PI / 180.0;
    const R2D = 180.0 / Math.PI;
    const sinD = d => Math.sin(d * D2R);
    const cosD = d => Math.cos(d * D2R);
    const tanD = d => Math.tan(d * D2R);
    const asinD = x => Math.asin(x) * R2D;
    const acosD = x => Math.acos(x) * R2D;
    const atan2D = (y, x) => Math.atan2(y, x) * R2D;
    const fixAngle = a => a - 360.0 * Math.floor(a / 360.0);
    const fixHour = h => h - 24.0 * Math.floor(h / 24.0);

    /**
     * Standard Calculation Methods Configuration
     */
    const CALC_METHODS = {
        Karachi: {
            name: "University of Islamic Sciences, Karachi (UIS)",
            fajrAngle: 18,
            ishaAngle: 18,
            maghribParam: 0, // 0 = standard sunset
            defaultJuristic: "Hanafi"
        },
        MWL: {
            name: "Muslim World League (MWL)",
            fajrAngle: 18,
            ishaAngle: 17,
            maghribParam: 0,
            defaultJuristic: "Standard"
        },
        ISNA: {
            name: "Islamic Society of North America (ISNA)",
            fajrAngle: 15,
            ishaAngle: 15,
            maghribParam: 0,
            defaultJuristic: "Hanafi"
        },
        Makkah: {
            name: "Umm Al-Qura University, Makkah",
            fajrAngle: 18.5,
            ishaMinutes: 90, // 90 min after Maghrib
            maghribParam: 0,
            defaultJuristic: "Standard"
        },
        Egypt: {
            name: "Egyptian General Authority of Survey",
            fajrAngle: 19.5,
            ishaAngle: 17.5,
            maghribParam: 0,
            defaultJuristic: "Standard"
        },
        Gulf: {
            name: "Gulf Standard (UAE / Qatar / Kuwait)",
            fajrAngle: 19.5,
            ishaMinutes: 90,
            maghribParam: 0,
            defaultJuristic: "Hanafi"
        }
    };

    /**
     * Built-in Global Timezone & Major Cities Registry
     * Provides instantaneous, 100% offline timezone-to-location mapping
     */
    const GLOBAL_CITIES_REGISTRY = {
        "Asia/Kuala_Lumpur": { city: "Kuala Lumpur", country: "Malaysia", lat: 3.1390, lng: 101.6869, timezone: "Asia/Kuala_Lumpur", method: "MWL", juristic: "Standard" },
        "Asia/Karachi": { city: "Lahore", country: "Pakistan", lat: 31.5204, lng: 74.3587, timezone: "Asia/Karachi", method: "Karachi", juristic: "Hanafi" },
        "Europe/London": { city: "London", country: "United Kingdom", lat: 51.5074, lng: -0.1278, timezone: "Europe/London", method: "MWL", juristic: "Hanafi" },
        "America/New_York": { city: "New York", country: "United States", lat: 40.7128, lng: -74.0060, timezone: "America/New_York", method: "ISNA", juristic: "Hanafi" },
        "Asia/Dubai": { city: "Dubai", country: "United Arab Emirates", lat: 25.2048, lng: 55.2708, timezone: "Asia/Dubai", method: "Gulf", juristic: "Hanafi" },
        "Asia/Tokyo": { city: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503, timezone: "Asia/Tokyo", method: "MWL", juristic: "Hanafi" },
        "Asia/Riyadh": { city: "Makkah", country: "Saudi Arabia", lat: 21.4225, lng: 39.8262, timezone: "Asia/Riyadh", method: "Makkah", juristic: "Standard" },
        "Africa/Cairo": { city: "Cairo", country: "Egypt", lat: 30.0444, lng: 31.2357, timezone: "Africa/Cairo", method: "Egypt", juristic: "Standard" },
        "Asia/Dhaka": { city: "Dhaka", country: "Bangladesh", lat: 23.8103, lng: 90.4125, timezone: "Asia/Dhaka", method: "Karachi", juristic: "Hanafi" },
        "Europe/Istanbul": { city: "Istanbul", country: "Turkey", lat: 41.0082, lng: 28.9784, timezone: "Europe/Istanbul", method: "MWL", juristic: "Hanafi" },
        "Asia/Jakarta": { city: "Jakarta", country: "Indonesia", lat: -6.2088, lng: 106.8456, timezone: "Asia/Jakarta", method: "MWL", juristic: "Standard" },
        "Asia/Singapore": { city: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198, timezone: "Asia/Singapore", method: "MWL", juristic: "Standard" },
        "America/Chicago": { city: "Chicago", country: "United States", lat: 41.8781, lng: -87.6298, timezone: "America/Chicago", method: "ISNA", juristic: "Hanafi" },
        "America/Los_Angeles": { city: "Los Angeles", country: "United States", lat: 34.0522, lng: -118.2437, timezone: "America/Los_Angeles", method: "ISNA", juristic: "Hanafi" },
        "America/Toronto": { city: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832, timezone: "America/Toronto", method: "ISNA", juristic: "Hanafi" },
        "Europe/Paris": { city: "Paris", country: "France", lat: 48.8566, lng: 2.3522, timezone: "Europe/Paris", method: "MWL", juristic: "Hanafi" },
        "Europe/Berlin": { city: "Berlin", country: "Germany", lat: 52.5200, lng: 13.4050, timezone: "Europe/Berlin", method: "MWL", juristic: "Hanafi" },
        "Australia/Sydney": { city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093, timezone: "Australia/Sydney", method: "MWL", juristic: "Hanafi" },
        "Asia/Kolkata": { city: "New Delhi", country: "India", lat: 28.6139, lng: 77.2090, timezone: "Asia/Kolkata", method: "Karachi", juristic: "Hanafi" },
        "Asia/Kabul": { city: "Kabul", country: "Afghanistan", lat: 34.5553, lng: 69.2075, timezone: "Asia/Kabul", method: "Karachi", juristic: "Hanafi" },
        "Asia/Tashkent": { city: "Tashkent", country: "Uzbekistan", lat: 41.2995, lng: 69.2401, timezone: "Asia/Tashkent", method: "Karachi", juristic: "Hanafi" }
    };

    /**
     * Default Institutional Fallback: Jamia Ashrafia Lahore Headquarters
     */
    const ASHRAFIA_HQ_FALLBACK = {
        city: "Lahore",
        country: "Pakistan",
        lat: 31.5204,
        lng: 74.3587,
        timezone: "Asia/Karachi",
        method: "Karachi",
        juristic: "Hanafi",
        source: "institutional_hq"
    };

    /**
     * Pure Astronomical Calculation Engine
     */
    const AstronomicalEngine = {
        getJulianDate(year, month, day) {
            if (month <= 2) {
                year -= 1;
                month += 12;
            }
            const A = Math.floor(year / 100.0);
            const B = 2 - A + Math.floor(A / 4.0);
            return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
        },

        sunPosition(jd) {
            const D = jd - 2451545.0;
            const g = fixAngle(357.529 + 0.98560028 * D);
            const q = fixAngle(280.459 + 0.98564736 * D);
            const L = fixAngle(q + 1.915 * sinD(g) + 0.020 * sinD(2 * g));
            const e = 23.439 - 0.00000036 * D;
            const RA = fixAngle(atan2D(cosD(e) * sinD(L), cosD(L))) / 15.0;
            const decl = asinD(sinD(e) * sinD(L));
            const EqT = q / 15.0 - RA;
            return { decl, EqT };
        },

        calculate({ lat, lng, tzOffsetHours, year, month, day, methodKey = 'Karachi', juristic = 'Hanafi' }) {
            const cfg = CALC_METHODS[methodKey] || CALC_METHODS.Karachi;
            const jd = this.getJulianDate(year, month, day);
            const { decl, EqT } = this.sunPosition(jd);

            // Solar Noon (transit time in decimal hours)
            const transit = 12.0 + tzOffsetHours - lng / 15.0 - EqT;

            const sunAltitudeHourAngle = (angle) => {
                const cosH = (sinD(angle) - sinD(lat) * sinD(decl)) / (cosD(lat) * cosD(decl));
                if (cosH > 1.0 || cosH < -1.0) return null; // Sun does not reach this altitude
                return acosD(cosH) / 15.0;
            };

            // Standard Sun Horizon Angle (-0.8333 degrees for refraction + semi-diameter)
            let riseSetDiff = sunAltitudeHourAngle(-0.8333);
            if (riseSetDiff === null) {
                riseSetDiff = 6.0; // fallback high-latitude approximation
            }

            // Fajr Twilight Angle
            let fajrDiff = sunAltitudeHourAngle(-cfg.fajrAngle);
            if (fajrDiff === null) {
                // High Latitude 1/7th rule
                fajrDiff = riseSetDiff + (24.0 - 2 * riseSetDiff) / 7.0;
            }

            // Isha Twilight Angle or Fixed Interval
            let ishaTime;
            if (cfg.ishaMinutes) {
                ishaTime = transit + riseSetDiff + (cfg.ishaMinutes / 60.0);
            } else {
                let ishaDiff = sunAltitudeHourAngle(-cfg.ishaAngle);
                if (ishaDiff === null) {
                    ishaDiff = riseSetDiff + (24.0 - 2 * riseSetDiff) / 7.0;
                }
                ishaTime = transit + ishaDiff;
            }

            // Asr Altitude Angle: arccot(factor + tan(|lat - decl|))
            const asrFactor = juristic === 'Hanafi' ? 2.0 : 1.0;
            const asrAltitudeAngle = R2D * Math.atan(1.0 / (asrFactor + tanD(Math.abs(lat - decl))));
            const asrDiff = sunAltitudeHourAngle(asrAltitudeAngle) || (riseSetDiff * 0.55);

            // Calculate raw times (in decimal hours)
            const raw = {
                fajr: fixHour(transit - fajrDiff),
                sunrise: fixHour(transit - riseSetDiff),
                zuhr: fixHour(transit + 0.0167), // +1 minute safety buffer past true zenith
                asr: fixHour(transit + asrDiff),
                maghrib: fixHour(transit + riseSetDiff + 0.0167), // +1 minute sunset buffer
                isha: fixHour(ishaTime)
            };

            return raw;
        }
    };

    /**
     * PrayerTimesService Singleton
     */
    const PrayerTimesService = {
        currentLocation: null,
        currentTimings: null,
        currentSettings: {
            method: 'Karachi',
            juristic: 'Hanafi'
        },
        tickerInterval: null,
        isInitialized: false,

        /**
         * Initialize the location detection and prayer schedule
         */
        async init() {
            if (this.isInitialized) return;
            this.isInitialized = true;

            console.log('[PrayerTimesService] Initializing dynamic location & prayer times...');

            // 1. Load saved preferences from cache
            this.loadStoredSettings();

            // 2. Resolve location (Cache -> Geolocation -> IP -> Intl Runtime -> Ashrafia HQ)
            await this.resolveLocation();

            // 3. Compute times for current location and local date
            this.calculateAndRefresh();

            // 4. Start automatic 30s background ticker to keep active prayer live
            this.startTicker();

            // 5. Listen to visibility change to refresh after computer wakes from sleep
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.calculateAndRefresh();
                }
            });
        },

        loadStoredSettings() {
            try {
                const saved = localStorage.getItem('JAMIA_PRAYER_SETTINGS');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.method) this.currentSettings.method = parsed.method;
                    if (parsed.juristic) this.currentSettings.juristic = parsed.juristic;
                }
            } catch (e) {
                console.warn('[PrayerTimesService] Could not parse stored settings:', e);
            }
        },

        saveStoredSettings() {
            try {
                localStorage.setItem('JAMIA_PRAYER_SETTINGS', JSON.stringify(this.currentSettings));
            } catch (e) {}
        },

        /**
         * Dynamic Timezone UTC Offset calculation taking Daylight Saving into account
         */
        getUtcOffsetString(timezone, date = new Date()) {
            try {
                const str = new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone,
                    timeZoneName: 'shortOffset'
                }).format(date);
                const match = str.match(/GMT([+-]\d+(:?\d+)?)/);
                if (match) {
                    const offset = match[1];
                    const parts = offset.split(':');
                    const hours = parseInt(parts[0], 10);
                    const sign = hours >= 0 ? '+' : '-';
                    const absH = String(Math.abs(hours)).padStart(2, '0');
                    const mins = parts[1] ? String(parts[1]).padStart(2, '0') : '00';
                    return `UTC${sign}${absH}:${mins}`;
                }
            } catch (e) {}

            // Robust fallback computation via minute difference
            try {
                const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
                const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
                const diffMinutes = Math.round((tzDate - utcDate) / 60000);
                const sign = diffMinutes >= 0 ? '+' : '-';
                const h = String(Math.floor(Math.abs(diffMinutes) / 60)).padStart(2, '0');
                const m = String(Math.abs(diffMinutes) % 60).padStart(2, '0');
                return `UTC${sign}${h}:${m}`;
            } catch (e) {
                return 'UTC+05:00';
            }
        },

        /**
         * Get decimal hours of UTC offset for astronomical transit calculation
         */
        getUtcOffsetHours(timezone, date = new Date()) {
            try {
                const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
                const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
                return (tzDate - utcDate) / 3600000.0;
            } catch (e) {
                return 5.0;
            }
        },

        /**
         * Get current local date in target timezone
         */
        getLocalDateInTimezone(timezone, date = new Date()) {
            try {
                const formatter = new Intl.DateTimeFormat('en-CA', {
                    timeZone: timezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
                const [year, month, day] = formatter.format(date).split('-').map(Number);
                return { year, month, day };
            } catch (e) {
                return {
                    year: date.getFullYear(),
                    month: date.getMonth() + 1,
                    day: date.getDate()
                };
            }
        },

        /**
         * Get current local time in target timezone
         */
        getLocalTimeInTimezone(timezone, date = new Date()) {
            try {
                const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone,
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                const parts = formatter.formatToParts(date);
                const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
                const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
                const s = parseInt(parts.find(p => p.type === 'second').value, 10);
                return {
                    hours: h,
                    minutes: m,
                    seconds: s,
                    decimalHours: h + m / 60.0 + s / 3600.0,
                    totalMinutes: h * 60 + m
                };
            } catch (e) {
                const h = date.getHours();
                const m = date.getMinutes();
                const s = date.getSeconds();
                return {
                    hours: h,
                    minutes: m,
                    seconds: s,
                    decimalHours: h + m / 60.0 + s / 3600.0,
                    totalMinutes: h * 60 + m
                };
            }
        },

        /**
         * Multi-tier location resolution pipeline
         */
        async resolveLocation(forceRedetect = false) {
            // Priority 1: Check cached location if not forcing redetect
            if (!forceRedetect) {
                try {
                    const cached = localStorage.getItem('JAMIA_PRAYER_LOCATION_V2');
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        const isRecent = (Date.now() - (parsed.timestamp || 0)) < (24 * 3600 * 1000); // 24h cache
                        if (parsed.lat && parsed.lng && parsed.timezone && (isRecent || parsed.isManual)) {
                            this.currentLocation = parsed;
                            console.log('[PrayerTimesService] Loaded cached location:', parsed.city, parsed.timezone);
                            return;
                        }
                    }
                } catch (e) {}
            }

            // Priority 2: Detect device IANA runtime timezone as immediate baseline
            const runtimeTimezone = (typeof Intl !== 'undefined' && Intl.DateTimeFormat)
                ? Intl.DateTimeFormat().resolvedOptions().timeZone
                : 'Asia/Karachi';

            const matchedCity = GLOBAL_CITIES_REGISTRY[runtimeTimezone];
            if (matchedCity) {
                this.currentLocation = {
                    ...matchedCity,
                    utcOffset: this.getUtcOffsetString(matchedCity.timezone),
                    source: 'runtime_timezone',
                    timestamp: Date.now()
                };
                console.log('[PrayerTimesService] Resolved from runtime timezone:', this.currentLocation.city, runtimeTimezone);
            } else {
                // If runtime timezone not in top registry, synthesize baseline
                const tzParts = runtimeTimezone.split('/');
                const cityName = (tzParts[1] || tzParts[0] || 'Local').replace(/_/g, ' ');
                this.currentLocation = {
                    city: cityName,
                    country: tzParts[0] || '',
                    lat: 31.5204, // Default latitude
                    lng: 74.3587,
                    timezone: runtimeTimezone,
                    utcOffset: this.getUtcOffsetString(runtimeTimezone),
                    source: 'runtime_timezone_generic',
                    timestamp: Date.now()
                };
            }

            // Priority 3: Non-blocking refinement via IP Geolocation or Browser Geolocation
            this.refineLocationAsync(forceRedetect);
        },

        /**
         * Asynchronous background refinement (does not block initial render)
         */
        async refineLocationAsync(forcePromptGeo = false) {
            // Try IP Geolocation (Silent, zero permissions prompt required)
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2800);

                const response = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    if (data.latitude && data.longitude) {
                        const iana = (typeof Intl !== 'undefined' && Intl.DateTimeFormat)
                            ? Intl.DateTimeFormat().resolvedOptions().timeZone
                            : this.currentLocation.timezone;

                        this.currentLocation = {
                            city: data.city || data.locality || this.currentLocation.city,
                            country: data.countryName || this.currentLocation.country,
                            lat: parseFloat(data.latitude),
                            lng: parseFloat(data.longitude),
                            timezone: iana,
                            utcOffset: this.getUtcOffsetString(iana),
                            source: 'ip_geolocation',
                            timestamp: Date.now()
                        };
                        this.saveLocationCache();
                        this.calculateAndRefresh();
                        return;
                    }
                }
            } catch (e) {
                // Silently fallback if offline or blocked
            }

            // If user explicitly requested GPS re-detect
            if (forcePromptGeo && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        const iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        this.currentLocation = {
                            city: this.currentLocation.city || 'Detected Location',
                            country: this.currentLocation.country || '',
                            lat,
                            lng,
                            timezone: iana,
                            utcOffset: this.getUtcOffsetString(iana),
                            source: 'gps_device',
                            timestamp: Date.now()
                        };
                        this.saveLocationCache();
                        this.calculateAndRefresh();
                    },
                    (err) => {
                        console.log('[PrayerTimesService] Geolocation permission denied or unavailable:', err.message);
                    },
                    { timeout: 5000, maximumAge: 60000 }
                );
            }
        },

        saveLocationCache() {
            try {
                if (this.currentLocation) {
                    localStorage.setItem('JAMIA_PRAYER_LOCATION_V2', JSON.stringify(this.currentLocation));
                }
            } catch (e) {}
        },

        /**
         * Set location manually (for testing test cities or user selection)
         */
        setLocation(locData) {
            this.currentLocation = {
                ...locData,
                utcOffset: this.getUtcOffsetString(locData.timezone),
                isManual: true,
                timestamp: Date.now()
            };
            if (locData.method) this.currentSettings.method = locData.method;
            if (locData.juristic) this.currentSettings.juristic = locData.juristic;
            this.saveLocationCache();
            this.saveStoredSettings();
            this.calculateAndRefresh();

            if (window.App && typeof window.App.showToast === 'function') {
                window.App.showToast(`Prayer location updated to ${locData.city} (${locData.timezone})`, 'info');
            }
        },

        /**
         * Format decimal hour to 12-hour AM/PM string
         */
        formatDecimalHour(h) {
            if (h === null || isNaN(h)) return '--:--';
            h = fixHour(h);
            const hours24 = Math.floor(h);
            const totalMins = Math.round((h - hours24) * 60);
            const finalHours = (hours24 + Math.floor(totalMins / 60)) % 24;
            const finalMins = totalMins % 60;

            const period = finalHours >= 12 ? 'PM' : 'AM';
            const h12 = finalHours % 12 || 12;
            const padH = String(h12).padStart(2, '0');
            const padM = String(finalMins).padStart(2, '0');
            return `${padH}:${padM} ${period}`;
        },

        /**
         * Main Calculation & Refresh Routine
         */
        calculateAndRefresh() {
            const loc = this.currentLocation || ASHRAFIA_HQ_FALLBACK;
            const tz = loc.timezone || 'Asia/Karachi';
            const now = new Date();

            // 1. Determine target local date
            const localDate = this.getLocalDateInTimezone(tz, now);
            const tzOffsetHours = this.getUtcOffsetHours(tz, now);
            const utcOffsetStr = this.getUtcOffsetString(tz, now);

            // Update location offset
            loc.utcOffset = utcOffsetStr;

            // 2. Compute astronomical prayer times
            const rawTimes = AstronomicalEngine.calculate({
                lat: loc.lat,
                lng: loc.lng,
                tzOffsetHours,
                year: localDate.year,
                month: localDate.month,
                day: localDate.day,
                methodKey: this.currentSettings.method,
                juristic: this.currentSettings.juristic
            });

            // 3. Format into 12-hour strings
            const formatted = {
                date: `${localDate.year}-${String(localDate.month).padStart(2, '0')}-${String(localDate.day).padStart(2, '0')}`,
                fajr: this.formatDecimalHour(rawTimes.fajr),
                sunrise: this.formatDecimalHour(rawTimes.sunrise),
                zuhr: this.formatDecimalHour(rawTimes.zuhr),
                asr: this.formatDecimalHour(rawTimes.asr),
                maghrib: this.formatDecimalHour(rawTimes.maghrib),
                isha: this.formatDecimalHour(rawTimes.isha),
                raw: rawTimes
            };

            this.currentTimings = formatted;

            // 4. Synchronize with global LmsData store
            if (window.LmsData) {
                window.LmsData.prayerTimes = {
                    ...formatted,
                    city: loc.city,
                    country: loc.country,
                    timezone: tz,
                    utcOffset: utcOffsetStr
                };
            }

            // 5. Determine active prayer & next prayer
            this.evaluateActivePrayer();

            // 6. Render UI updates
            this.renderTopHeaderTicker();
        },

        /**
         * Evaluate which prayer is active and which is next based on local time
         */
        evaluateActivePrayer() {
            if (!this.currentTimings || !this.currentLocation) return;
            const tz = this.currentLocation.timezone || 'Asia/Karachi';
            const localTime = this.getLocalTimeInTimezone(tz);
            const currentDec = localTime.decimalHours;
            const r = this.currentTimings.raw;

            let active = 'isha';
            let next = { name: 'Fajr', time: this.currentTimings.fajr, dec: r.fajr };

            if (currentDec >= r.fajr && currentDec < r.sunrise) {
                active = 'fajr';
                next = { name: 'Sunrise', time: this.currentTimings.sunrise, dec: r.sunrise };
            } else if (currentDec >= r.sunrise && currentDec < r.zuhr) {
                active = 'sunrise'; // Sunrise passed, waiting for Zuhr
                next = { name: 'Zuhr', time: this.currentTimings.zuhr, dec: r.zuhr };
            } else if (currentDec >= r.zuhr && currentDec < r.asr) {
                active = 'zuhr';
                next = { name: 'Asr', time: this.currentTimings.asr, dec: r.asr };
            } else if (currentDec >= r.asr && currentDec < r.maghrib) {
                active = 'asr';
                next = { name: 'Maghrib', time: this.currentTimings.maghrib, dec: r.maghrib };
            } else if (currentDec >= r.maghrib && currentDec < r.isha) {
                active = 'maghrib';
                next = { name: 'Isha', time: this.currentTimings.isha, dec: r.isha };
            } else {
                active = 'isha';
                next = { name: 'Fajr', time: this.currentTimings.fajr, dec: r.fajr + 24.0 };
            }

            this.activePrayer = active;

            // Calculate countdown difference in minutes
            let diffHours = next.dec - currentDec;
            if (diffHours < 0) diffHours += 24.0;
            const diffMins = Math.round(diffHours * 60.0);
            const hoursRem = Math.floor(diffMins / 60);
            const minsRem = diffMins % 60;

            this.nextPrayer = {
                name: next.name,
                time: next.time,
                diffMinutes: diffMins,
                diffText: hoursRem > 0 ? `${hoursRem}h ${minsRem}m` : `${minsRem}m`
            };

            if (window.LmsData && window.LmsData.prayerTimes) {
                window.LmsData.prayerTimes.currentActive = active;
                window.LmsData.prayerTimes.nextPrayer = this.nextPrayer;
            }
        },

        /**
         * Render dynamic prayer times & timezone into the top header ticker
         */
        renderTopHeaderTicker() {
            const tickerEl = document.querySelector('.prayer-ticker');
            if (!tickerEl) return;

            const loc = this.currentLocation || ASHRAFIA_HQ_FALLBACK;
            const t = this.currentTimings;
            if (!t) return;

            const active = this.activePrayer;
            const next = this.nextPrayer;

            const cityName = (loc.city || 'Ashrafia').split(',')[0].trim();

            tickerEl.innerHTML = `
                <!-- Prayer Times Heading -->
                <div class="prayer-ticker-heading">
                    <i class="fas fa-mosque"></i>
                    <span>Prayer Times</span>
                </div>
                <span class="prayer-ticker-divider">|</span>

                <!-- Simplified Location: 📍 City | ☰ -->
                <div class="prayer-location-badge" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ')PrayerTimesService.openLocationModal()" onclick="PrayerTimesService.openLocationModal()" title="Location: ${cityName}&#10;Click ☰ to view full location, timezone & prayer settings">
                    <i class="fas fa-map-marker-alt location-icon"></i>
                    <span class="location-city-name">${cityName}</span>
                    <span class="prayer-badge-divider">|</span>
                    <i class="fas fa-bars location-menu-icon" title="View details (☰)"></i>
                </div>

                <!-- Dynamic Prayer Times Pills -->
                <div class="prayer-pills-list">
                    <div class="prayer-pill ${active === 'fajr' ? 'active' : ''}" title="Fajr Dawn Prayer">
                        <span class="pill-name">Fajr</span>
                        <span class="pill-time">${t.fajr}</span>
                    </div>
                    <div class="prayer-pill ${active === 'zuhr' ? 'active' : ''}" title="Zuhr Midday Prayer">
                        <span class="pill-name">Zuhr</span>
                        <span class="pill-time">${t.zuhr}</span>
                    </div>
                    <div class="prayer-pill ${active === 'asr' ? 'active' : ''}" title="Asr Afternoon Prayer (${this.currentSettings.juristic})">
                        <span class="pill-name">Asr</span>
                        <span class="pill-time">${t.asr}</span>
                    </div>
                    <div class="prayer-pill ${active === 'maghrib' ? 'active' : ''}" title="Maghrib Sunset Prayer">
                        <span class="pill-name">Maghrib</span>
                        <span class="pill-time">${t.maghrib}</span>
                    </div>
                    <div class="prayer-pill ${active === 'isha' ? 'active' : ''}" title="Isha Night Prayer">
                        <span class="pill-name">Isha</span>
                        <span class="pill-time">${t.isha}</span>
                    </div>
                </div>
            `;
        },

        /**
         * Periodic ticker to evaluate time transitions
         */
        startTicker() {
            if (this.tickerInterval) clearInterval(this.tickerInterval);
            this.tickerInterval = setInterval(() => {
                this.evaluateActivePrayer();
                this.renderTopHeaderTicker();
            }, 30000); // Check every 30 seconds
        },

        /**
         * Open Interactive Location, Timezone, and Testing Modal
         */
        openLocationModal() {
            const loc = this.currentLocation || ASHRAFIA_HQ_FALLBACK;
            const t = this.currentTimings;
            const now = new Date();
            const localTime = this.getLocalTimeInTimezone(loc.timezone, now);
            const timeStr12 = new Intl.DateTimeFormat('en-US', {
                timeZone: loc.timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).format(now);

            const titleEl = document.getElementById('modal-title-text');
            const bodyEl = document.getElementById('modal-body-container');
            const footerEl = document.getElementById('modal-footer-container');

            if (titleEl) {
                titleEl.innerHTML = `<i class="fas fa-globe-asia" style="color: var(--primary-600);"></i> Dynamic Location & Prayer Times Manager`;
            }

            if (bodyEl) {
                bodyEl.innerHTML = `
                    <div style="font-family: inherit; color: var(--text-primary);">
                        <!-- CURRENT DETECTED LOCATION SUMMARY CARD -->
                        <div style="background: linear-gradient(135deg, var(--primary-50) 0%, #ffffff 100%); border: 1px solid var(--primary-200); border-radius: var(--radius-md); padding: 16px 20px; margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
                                <div>
                                    <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--primary-700); font-weight: 700;">
                                        <i class="fas fa-crosshairs"></i> Active Prayer Location
                                    </div>
                                    <h2 style="font-size: 1.4rem; color: var(--primary-950); margin: 4px 0 2px; font-weight: 800;">
                                        ${loc.city}, ${loc.country || 'Global'}
                                    </h2>
                                    <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; gap: 12px; flex-wrap: wrap;">
                                        <span><i class="far fa-clock"></i> <strong>${timeStr12}</strong> (Local Time)</span>
                                        <span>•</span>
                                        <span><i class="fas fa-calendar-day"></i> <strong>${t ? t.date : 'Today'}</strong></span>
                                    </div>
                                </div>

                                <div style="text-align: right;">
                                    <span class="status-pill primary" style="font-size: 0.82rem; padding: 4px 10px;">
                                        <i class="fas fa-globe"></i> ${loc.timezone}
                                    </span>
                                    <div style="font-size: 0.8rem; color: var(--gold-700); font-weight: 700; margin-top: 4px;">
                                        ${loc.utcOffset} (Offset)
                                    </div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted);">
                                        Coords: ${loc.lat.toFixed(4)}°, ${loc.lng.toFixed(4)}°
                                    </div>
                                </div>
                            </div>

                            <!-- TODAY'S FULL PRAYER SCHEDULE FOR THIS LOCATION -->
                            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-top: 16px; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px;">
                                <div style="text-align: center;">
                                    <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Fajr</div>
                                    <div style="font-size: 0.88rem; font-weight: 700; color: ${this.activePrayer === 'fajr' ? 'var(--primary-600)' : 'var(--text-primary)'};">${t ? t.fajr : '--'}</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Sunrise</div>
                                    <div style="font-size: 0.88rem; font-weight: 700; color: var(--gold-600);">${t ? t.sunrise : '--'}</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Zuhr</div>
                                    <div style="font-size: 0.88rem; font-weight: 700; color: ${this.activePrayer === 'zuhr' ? 'var(--primary-600)' : 'var(--text-primary)'};">${t ? t.zuhr : '--'}</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Asr</div>
                                    <div style="font-size: 0.88rem; font-weight: 700; color: ${this.activePrayer === 'asr' ? 'var(--primary-600)' : 'var(--text-primary)'};">${t ? t.asr : '--'}</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Maghrib</div>
                                    <div style="font-size: 0.88rem; font-weight: 700; color: ${this.activePrayer === 'maghrib' ? 'var(--primary-600)' : 'var(--text-primary)'};">${t ? t.maghrib : '--'}</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Isha</div>
                                    <div style="font-size: 0.88rem; font-weight: 700; color: ${this.activePrayer === 'isha' ? 'var(--primary-600)' : 'var(--text-primary)'};">${t ? t.isha : '--'}</div>
                                </div>
                            </div>
                        </div>

                        <!-- QUICK TEST LOCATIONS (REQUIREMENT 14) -->
                        <div style="margin-bottom: 20px;">
                            <label style="font-size: 0.85rem; font-weight: 700; color: var(--primary-900); display: block; margin-bottom: 8px;">
                                <i class="fas fa-city"></i> Switch to Location (Test Required Cities):
                            </label>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
                                <button class="btn btn-secondary btn-sm" onclick="PrayerTimesService.quickSwitchCity('Asia/Kuala_Lumpur')" style="text-align: left; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;">
                                    <strong>🇲🇾 Kuala Lumpur</strong>
                                    <span style="font-size: 0.68rem; color: var(--text-muted);">Asia/Kuala_Lumpur (UTC+8)</span>
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="PrayerTimesService.quickSwitchCity('Asia/Karachi')" style="text-align: left; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;">
                                    <strong>🇵🇰 Lahore</strong>
                                    <span style="font-size: 0.68rem; color: var(--text-muted);">Asia/Karachi (UTC+5)</span>
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="PrayerTimesService.quickSwitchCity('Europe/London')" style="text-align: left; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;">
                                    <strong>🇬🇧 London</strong>
                                    <span style="font-size: 0.68rem; color: var(--text-muted);">Europe/London (BST/GMT)</span>
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="PrayerTimesService.quickSwitchCity('America/New_York')" style="text-align: left; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;">
                                    <strong>🇺🇸 New York</strong>
                                    <span style="font-size: 0.68rem; color: var(--text-muted);">America/New_York (EDT)</span>
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="PrayerTimesService.quickSwitchCity('Asia/Dubai')" style="text-align: left; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;">
                                    <strong>🇦🇪 Dubai</strong>
                                    <span style="font-size: 0.68rem; color: var(--text-muted);">Asia/Dubai (UTC+4)</span>
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="PrayerTimesService.quickSwitchCity('Asia/Tokyo')" style="text-align: left; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px;">
                                    <strong>🇯🇵 Tokyo</strong>
                                    <span style="font-size: 0.68rem; color: var(--text-muted);">Asia/Tokyo (UTC+9)</span>
                                </button>
                            </div>
                        </div>

                        <!-- CALCULATION METHOD & JURISTIC SCHOOL -->
                        <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-prominent); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                                <div>
                                    <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">
                                        Calculation Method (Fajr / Isha Angles)
                                    </label>
                                    <select class="form-control" id="prayer-calc-method-select" onchange="PrayerTimesService.updateMethod(this.value)" style="font-size: 0.85rem; padding: 6px 10px;">
                                        <option value="Karachi" ${this.currentSettings.method === 'Karachi' ? 'selected' : ''}>Univ. of Islamic Sciences Karachi (18° / 18°)</option>
                                        <option value="MWL" ${this.currentSettings.method === 'MWL' ? 'selected' : ''}>Muslim World League (18° / 17°)</option>
                                        <option value="ISNA" ${this.currentSettings.method === 'ISNA' ? 'selected' : ''}>Islamic Society of North America (15° / 15°)</option>
                                        <option value="Makkah" ${this.currentSettings.method === 'Makkah' ? 'selected' : ''}>Umm Al-Qura, Makkah (18.5° / +90m)</option>
                                        <option value="Egypt" ${this.currentSettings.method === 'Egypt' ? 'selected' : ''}>Egyptian General Authority (19.5° / 17.5°)</option>
                                        <option value="Gulf" ${this.currentSettings.method === 'Gulf' ? 'selected' : ''}>Gulf Standard (19.5° / +90m)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">
                                        Asr Juristic Method (Fiqh)
                                    </label>
                                    <select class="form-control" id="prayer-asr-method-select" onchange="PrayerTimesService.updateJuristic(this.value)" style="font-size: 0.85rem; padding: 6px 10px;">
                                        <option value="Hanafi" ${this.currentSettings.juristic === 'Hanafi' ? 'selected' : ''}>Hanafi (Shadow Factor 2x) - Jamia Tradition</option>
                                        <option value="Standard" ${this.currentSettings.juristic === 'Standard' ? 'selected' : ''}>Standard / Shafi'i / Maliki / Hanbali (Factor 1x)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- AUTO-DETECT BUTTON -->
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
                            <button class="btn btn-secondary btn-sm" onclick="PrayerTimesService.autoDetectLocation(true)">
                                <i class="fas fa-crosshairs"></i> Auto-Detect My Real GPS / IP Location
                            </button>
                            <span style="font-size: 0.72rem; color: var(--text-muted);">
                                Source: ${loc.source || 'Detected'}
                            </span>
                        </div>
                    </div>
                `;
            }

            if (footerEl) {
                footerEl.innerHTML = `
                    <button class="btn btn-primary" onclick="window.App.closeModal()">
                        <i class="fas fa-check"></i> Apply & Close
                    </button>
                `;
            }

            if (window.App && typeof window.App.openModal === 'function') {
                window.App.openModal();
            }
        },

        quickSwitchCity(timezoneKey) {
            const cityData = GLOBAL_CITIES_REGISTRY[timezoneKey];
            if (cityData) {
                this.setLocation(cityData);
                this.openLocationModal(); // Re-render modal to reflect changes
            }
        },

        updateMethod(methodKey) {
            this.currentSettings.method = methodKey;
            this.saveStoredSettings();
            this.calculateAndRefresh();
            this.openLocationModal();
        },

        updateJuristic(juristicKey) {
            this.currentSettings.juristic = juristicKey;
            this.saveStoredSettings();
            this.calculateAndRefresh();
            this.openLocationModal();
        },

        async autoDetectLocation(forcePrompt = true) {
            try {
                localStorage.removeItem('JAMIA_PRAYER_LOCATION_V2');
                await this.resolveLocation(true);
                if (forcePrompt && navigator.geolocation) {
                    this.refineLocationAsync(true);
                }
                this.calculateAndRefresh();
                this.openLocationModal();
                if (window.App && typeof window.App.showToast === 'function') {
                    window.App.showToast('Location auto-detected successfully', 'info');
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    window.PrayerTimesService = PrayerTimesService;

    // Initialize automatically when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => PrayerTimesService.init());
    } else {
        PrayerTimesService.init();
    }

})(window);
