/**
 * World Operations — GTA-like game built on top of the World Monitor globe.
 *
 * Uses the same Globe.gl 3D engine as the main app, layering real-world
 * intelligence data (conflict zones, military bases, nuclear facilities) to
 * drive the game's wanted-level and hazard systems.
 *
 * Controls:  W/↑ accelerate  S/↓ brake/reverse  A←/D→ steer
 *            SPACE hard-brake  T switch vehicle  ESC pause
 */

import Globe from 'globe.gl';
import type { GlobeInstance } from 'globe.gl';
import { CONFLICT_ZONES, MILITARY_BASES, NUCLEAR_FACILITIES } from '@/config/geo';

// ── Vehicle catalogue ─────────────────────────────────────────────────────────

type VehicleType = 'car' | 'motorcycle' | 'helicopter' | 'boat';

interface Vehicle {
  type: VehicleType;
  emoji: string;
  label: string;
  /** globe-degrees per frame at 60 fps */
  maxSpeed: number;
  /** acceleration per frame */
  accel: number;
  /** degrees per frame turning rate */
  turnRate: number;
}

const VEHICLES: Vehicle[] = [
  { type: 'car',         emoji: '🚗', label: 'Car',         maxSpeed: 0.009,  accel: 0.0015, turnRate: 3.5 },
  { type: 'motorcycle',  emoji: '🏍️', label: 'Motorcycle',  maxSpeed: 0.014,  accel: 0.0028, turnRate: 5.0 },
  { type: 'helicopter',  emoji: '🚁', label: 'Helicopter',  maxSpeed: 0.028,  accel: 0.0045, turnRate: 4.0 },
  { type: 'boat',        emoji: '⛵', label: 'Boat',        maxSpeed: 0.005,  accel: 0.0008, turnRate: 2.0 },
];

// ── World cities ──────────────────────────────────────────────────────────────

interface WorldCity {
  name: string;
  country: string;
  lat: number;
  lng: number;
  tier: 'mega' | 'major' | 'capital';
}

const CITIES: WorldCity[] = [
  // Megacities
  { name: 'Tokyo',       country: 'Japan',       lat:  35.6762, lng: 139.6503, tier: 'mega'    },
  { name: 'Delhi',       country: 'India',       lat:  28.7041, lng:  77.1025, tier: 'mega'    },
  { name: 'Shanghai',    country: 'China',       lat:  31.2304, lng: 121.4737, tier: 'mega'    },
  { name: 'São Paulo',   country: 'Brazil',      lat: -23.5505, lng: -46.6333, tier: 'mega'    },
  { name: 'Mexico City', country: 'Mexico',      lat:  19.4326, lng: -99.1332, tier: 'mega'    },
  { name: 'Cairo',       country: 'Egypt',       lat:  30.0444, lng:  31.2357, tier: 'mega'    },
  { name: 'Mumbai',      country: 'India',       lat:  19.0760, lng:  72.8777, tier: 'mega'    },
  { name: 'Beijing',     country: 'China',       lat:  39.9042, lng: 116.4074, tier: 'mega'    },
  { name: 'Jakarta',     country: 'Indonesia',   lat:  -6.2088, lng: 106.8456, tier: 'mega'    },
  { name: 'Osaka',       country: 'Japan',       lat:  34.6937, lng: 135.5023, tier: 'mega'    },
  // Major cities
  { name: 'New York',    country: 'USA',         lat:  40.7128, lng: -74.0060, tier: 'major'   },
  { name: 'Los Angeles', country: 'USA',         lat:  34.0522, lng:-118.2437, tier: 'major'   },
  { name: 'London',      country: 'UK',          lat:  51.5074, lng:  -0.1278, tier: 'major'   },
  { name: 'Paris',       country: 'France',      lat:  48.8566, lng:   2.3522, tier: 'major'   },
  { name: 'Moscow',      country: 'Russia',      lat:  55.7558, lng:  37.6173, tier: 'major'   },
  { name: 'Istanbul',    country: 'Turkey',      lat:  41.0082, lng:  28.9784, tier: 'major'   },
  { name: 'Lagos',       country: 'Nigeria',     lat:   6.5244, lng:   3.3792, tier: 'major'   },
  { name: 'Karachi',     country: 'Pakistan',    lat:  24.8607, lng:  67.0011, tier: 'major'   },
  { name: 'Bangkok',     country: 'Thailand',    lat:  13.7563, lng: 100.5018, tier: 'major'   },
  { name: 'Kinshasa',    country: 'DRC',         lat:  -4.3217, lng:  15.3222, tier: 'major'   },
  { name: 'Lima',        country: 'Peru',        lat: -12.0464, lng: -77.0428, tier: 'major'   },
  { name: 'Sydney',      country: 'Australia',   lat: -33.8688, lng: 151.2093, tier: 'major'   },
  { name: 'Chicago',     country: 'USA',         lat:  41.8781, lng: -87.6298, tier: 'major'   },
  { name: 'Berlin',      country: 'Germany',     lat:  52.5200, lng:  13.4050, tier: 'major'   },
  { name: 'Toronto',     country: 'Canada',      lat:  43.6532, lng: -79.3832, tier: 'major'   },
  { name: 'Dubai',       country: 'UAE',         lat:  25.2048, lng:  55.2708, tier: 'major'   },
  { name: 'Singapore',   country: 'Singapore',   lat:   1.3521, lng: 103.8198, tier: 'major'   },
  { name: 'Seoul',       country: 'South Korea', lat:  37.5665, lng: 126.9780, tier: 'major'   },
  { name: 'Cape Town',   country: 'South Africa',lat: -33.9249, lng:  18.4241, tier: 'major'   },
  { name: 'Buenos Aires',country: 'Argentina',   lat: -34.6037, lng: -58.3816, tier: 'major'   },
  // Capitals
  { name: 'Washington DC', country: 'USA',       lat:  38.9072, lng: -77.0369, tier: 'capital' },
  { name: 'Brussels',    country: 'Belgium',     lat:  50.8503, lng:   4.3517, tier: 'capital' },
  { name: 'Riyadh',      country: 'Saudi Arabia',lat:  24.7136, lng:  46.6753, tier: 'capital' },
  { name: 'Kyiv',        country: 'Ukraine',     lat:  50.4501, lng:  30.5234, tier: 'capital' },
  { name: 'Tehran',      country: 'Iran',        lat:  35.6892, lng:  51.3890, tier: 'capital' },
  { name: 'Nairobi',     country: 'Kenya',       lat:  -1.2921, lng:  36.8219, tier: 'capital' },
  { name: 'Ottawa',      country: 'Canada',      lat:  45.4215, lng: -75.6972, tier: 'capital' },
  { name: 'Canberra',    country: 'Australia',   lat: -35.2809, lng: 149.1300, tier: 'capital' },
  { name: 'Brasília',    country: 'Brazil',      lat: -15.7975, lng: -47.8919, tier: 'capital' },
  { name: 'Pretoria',    country: 'South Africa',lat: -25.7479, lng:  28.2293, tier: 'capital' },
];

// ── Danger zone model ─────────────────────────────────────────────────────────

interface DangerZone {
  name: string;
  lat: number;
  lng: number;
  /** km radius that triggers heat accumulation */
  radius: number;
  /** heat points per second inside zone */
  heatRate: number;
  /** CSS colour for minimap */
  color: string;
  kind: 'conflict' | 'military' | 'nuclear';
}

// ── Utility: great-circle distance & bearing ──────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x =
    Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// ── Notification ──────────────────────────────────────────────────────────────

type NotifType = 'info' | 'warning' | 'danger' | 'success';

interface Notification {
  id: string;
  message: string;
  type: NotifType;
  expiry: number;
}

// ── Globe marker data shape ───────────────────────────────────────────────────

interface GlobeMarker {
  id: string;
  lat: number;
  lng: number;
  el: HTMLElement;
}

/** Safely retrieve the current vehicle, defaulting to car. */
function vehicleAt(idx: number): Vehicle {
  return VEHICLES[idx % VEHICLES.length] ?? VEHICLES[0]!;
}

// ── Main game class ───────────────────────────────────────────────────────────

class WorldGame {
  private globe!: GlobeInstance;
  private dangerZones: DangerZone[] = [];
  private notifications: Notification[] = [];
  private keys = new Set<string>();
  private cachedMarkerEls = new Map<string, HTMLElement>();
  private playerEl: HTMLElement | null = null;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private animId = 0;   // rAF handle — stored so future cleanup can cancel with cancelAnimationFrame(this.animId)
  private lastTime = 0;
  private started = false;
  private paused = false;

  // Player state
  private lat = 0;
  private lng = 0;
  private heading = 0;
  private speed = 0;
  private health = 100;
  private armor = 100;
  private cash = 10_000;
  private wantedHeat = 0;
  private wantedLevel = 0;
  private vehicleIdx = 0;
  private score = 0;
  private missionsCompleted = 0;
  private distanceTraveled = 0;
  private alive = true;

  // Mission state
  private missionTarget: WorldCity | null = null;
  private missionReward = 0;

  constructor(private mountEl: HTMLElement) {
    this.buildDangerZones();
    this.spawnAt(this.randomCity());
    this.initGlobe();
    this.initMinimap();
    this.assignMission(null);
    this.bindInput();
  }

  // ── Initialisation ──────────────────────────────────────────────────────────

  private randomCity(exclude?: WorldCity | null): WorldCity {
    const pool = CITIES.filter(c => c !== exclude);
    const city = pool[Math.floor(Math.random() * pool.length)];
    // pool always has at least one entry since CITIES has 40 cities
    return city!;
  }

  private spawnAt(city: WorldCity): void {
    this.lat = city.lat;
    this.lng = city.lng;
    this.heading = 0;
    this.speed = 0;
    this.health = 100;
    this.armor = 100;
    this.cash = 10_000;
    this.wantedHeat = 0;
    this.wantedLevel = 0;
    this.vehicleIdx = 0;
    this.score = 0;
    this.missionsCompleted = 0;
    this.distanceTraveled = 0;
    this.alive = true;
  }

  private buildDangerZones(): void {
    const heatByIntensity: Record<string, number> = { low: 3, medium: 5, high: 8, critical: 15 };

    // Conflict zones (from real-world intelligence data)
    for (const z of CONFLICT_ZONES) {
      const [lng, lat] = z.center;         // center is [lng, lat]
      this.dangerZones.push({
        name: z.name,
        lat, lng,
        radius: 220,
        heatRate: heatByIntensity[z.intensity ?? 'medium'] ?? 5,
        color: '#ff4400',
        kind: 'conflict',
      });
    }

    // Military bases — cap at 100 for performance
    for (const b of MILITARY_BASES.slice(0, 100)) {
      this.dangerZones.push({
        name: b.name,
        lat: b.lat, lng: b.lon,
        radius: 60,
        heatRate: 10,
        color: '#ff8800',
        kind: 'military',
      });
    }

    // Nuclear facilities
    for (const f of NUCLEAR_FACILITIES) {
      this.dangerZones.push({
        name: f.name,
        lat: f.lat, lng: f.lon,
        radius: 35,
        heatRate: 28,
        color: '#00ff88',
        kind: 'nuclear',
      });
    }
  }

  private initGlobe(): void {
    this.globe = new Globe(this.mountEl, { waitForGlobeReady: true, animateIn: true })
      .globeImageUrl('/textures/earth-topo-bathy.jpg')
      .backgroundImageUrl('/textures/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('#1a3a6a')
      .atmosphereAltitude(0.15)
      .htmlElementsData([])
      .htmlLat((d: unknown) => (d as GlobeMarker).lat)
      .htmlLng((d: unknown) => (d as GlobeMarker).lng)
      .htmlElement((d: unknown) => (d as GlobeMarker).el);

    this.globe.pointOfView({ lat: this.lat, lng: this.lng, altitude: 0.8 });

    // Disable default click-drag auto-rotation
    const controls = this.globe.controls() as any;
    if (controls) {
      controls.autoRotate = false;
      controls.enableZoom = false;   // lock zoom so camera altitude stays constant
    }
  }

  private initMinimap(): void {
    this.minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
  }

  private assignMission(exclude: WorldCity | null): void {
    this.missionTarget = this.randomCity(exclude);
    const rewards = [5_000, 8_000, 12_000, 15_000, 20_000];
    this.missionReward = rewards[Math.floor(Math.random() * rewards.length)] ?? 5_000;
    this.notify(`📦 New mission: Deliver to ${this.missionTarget.name}`, 'info');
    this.updateHUD();
  }

  // ── Input handling ──────────────────────────────────────────────────────────

  private bindInput(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Escape') this.togglePause();
      if (e.code === 'KeyT' && this.started && !this.paused) this.nextVehicle();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  private togglePause(): void {
    if (!this.started) return;
    this.paused = !this.paused;
    (document.getElementById('pause-screen') as HTMLElement).style.display =
      this.paused ? 'flex' : 'none';
  }

  private nextVehicle(): void {
    this.vehicleIdx = (this.vehicleIdx + 1) % VEHICLES.length;
    const v = vehicleAt(this.vehicleIdx);
    this.notify(`${v.emoji} Switched to ${v.label}`, 'info');
    this.rebuildPlayerEl();
  }

  // ── Game loop ───────────────────────────────────────────────────────────────

  start(): void {
    this.started = true;
    (document.getElementById('start-screen') as HTMLElement).style.display = 'none';
    this.lastTime = performance.now();
    this.scheduleFrame();
  }

  private scheduleFrame(): void {
    this.animId = requestAnimationFrame((now) => this.tick(now));
  }

  /** Cancel the game loop (e.g. when unmounting). */
  stop(): void {
    cancelAnimationFrame(this.animId);
    this.started = false;
  }

  private tick(now: number): void {
    if (!this.started) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (!this.paused && this.alive) {
      this.processInput(dt);
      this.processZones(dt);
      this.checkMission();
      this.pruneNotifications();
      this.updateGlobeMarkers();
      this.updateHUD();
      this.drawMinimap();
    }

    this.scheduleFrame();
  }

  // ── Movement ────────────────────────────────────────────────────────────────

  private processInput(dt: number): void {
    const v = vehicleAt(this.vehicleIdx);
    const fps60dt = dt * 60; // normalise so values feel right at 60 fps

    // Steering
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      this.heading = (this.heading - v.turnRate * fps60dt + 360) % 360;
    }
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      this.heading = (this.heading + v.turnRate * fps60dt) % 360;
    }

    // Throttle / brake
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      this.speed = Math.min(this.speed + v.accel * fps60dt, v.maxSpeed);
    } else if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      this.speed = Math.max(this.speed - v.accel * 2 * fps60dt, -v.maxSpeed * 0.3);
    } else {
      // Friction
      const friction = v.accel * 0.5 * fps60dt * (this.speed > 0 ? -1 : 1);
      this.speed += friction;
      if (Math.abs(this.speed) < 0.0001) this.speed = 0;
    }

    // Hard brake
    if (this.keys.has('Space')) {
      this.speed *= 0.90;
      if (Math.abs(this.speed) < 0.0001) this.speed = 0;
    }

    // Translate position
    if (this.speed !== 0) {
      const rad = this.heading * Math.PI / 180;
      const prevLat = this.lat;
      const prevLng = this.lng;

      this.lat = Math.max(-89, Math.min(89, this.lat + Math.cos(rad) * this.speed));
      this.lng = ((this.lng + Math.sin(rad) * this.speed) + 540) % 360 - 180;

      // Accumulate distance (rough km)
      const dlat = (this.lat - prevLat) * 111;
      const dlng = (this.lng - prevLng) * 111 * Math.cos(prevLat * Math.PI / 180);
      this.distanceTraveled += Math.sqrt(dlat * dlat + dlng * dlng);
    }

    // Follow camera
    this.globe.pointOfView(
      { lat: this.lat, lng: this.lng, altitude: this.speed > 0.012 ? 0.55 : 0.75 },
      80,
    );
  }

  // ── Danger zones & wanted level ─────────────────────────────────────────────

  private processZones(dt: number): void {
    let maxHeat = 0;
    let inZone = false;

    for (const zone of this.dangerZones) {
      const dist = haversineKm(this.lat, this.lng, zone.lat, zone.lng);
      if (dist < zone.radius) {
        inZone = true;
        if (zone.heatRate > maxHeat) maxHeat = zone.heatRate;
      }
    }

    const prevLevel = this.wantedLevel;

    if (inZone) {
      this.wantedHeat = Math.min(100, this.wantedHeat + maxHeat * dt);

      // Damage when heat is high
      if (this.wantedHeat > 40) {
        const dmg = maxHeat * 0.5 * dt;
        if (this.armor > 0) {
          this.armor = Math.max(0, this.armor - dmg);
        } else {
          this.health = Math.max(0, this.health - dmg);
        }
      }
    } else {
      // Cooldown: heat drains when safe
      this.wantedHeat = Math.max(0, this.wantedHeat - 6 * dt);
    }

    this.wantedLevel = Math.min(5, Math.floor(this.wantedHeat / 20));

    if (this.wantedLevel > prevLevel) {
      const msgs = [
        'You are being watched.',
        '⚠️ Entering conflict zone.',
        '🔴 High-risk area ahead!',
        '🟠 Military zone — turn back!',
        '☢️ RESTRICTED: Nuclear site!',
        '💀 CRITICAL ALERT!',
      ];
      this.notify(msgs[this.wantedLevel] ?? `Wanted level: ${this.wantedLevel}`, 'danger');
    } else if (prevLevel > 0 && this.wantedLevel === 0) {
      this.notify('✅ Area clear — heat cooled.', 'success');
    }

    if (this.health <= 0) {
      this.alive = false;
      this.showGameOver();
    }
  }

  // ── Mission logic ────────────────────────────────────────────────────────────

  private checkMission(): void {
    if (!this.missionTarget) return;
    const dist = haversineKm(this.lat, this.lng, this.missionTarget.lat, this.missionTarget.lng);
    if (dist < 120) {
      this.cash += this.missionReward;
      this.missionsCompleted++;
      this.score += 1_000;
      const completed = this.missionTarget;
      this.notify(`✅ Delivered to ${completed.name}! +$${this.missionReward.toLocaleString()}`, 'success');
      this.missionTarget = null;
      setTimeout(() => this.assignMission(completed), 1_500);
    }
  }

  // ── Globe marker rendering ───────────────────────────────────────────────────

  private rebuildPlayerEl(): void {
    const v = vehicleAt(this.vehicleIdx);
    if (!this.playerEl) {
      this.playerEl = document.createElement('div');
      this.playerEl.style.cssText = [
        'font-size:26px',
        'filter:drop-shadow(0 0 8px rgba(255,255,200,0.95))',
        'user-select:none',
        'cursor:default',
        'z-index:999',
        'transition:transform 0.06s linear',
      ].join(';');
    }
    this.playerEl.textContent = v.emoji;
    this.playerEl.style.transform = `rotate(${this.heading}deg)`;
  }

  private updateGlobeMarkers(): void {
    const v = vehicleAt(this.vehicleIdx);

    // Player marker
    if (!this.playerEl) this.rebuildPlayerEl();
    // playerEl is always set by rebuildPlayerEl — the non-null assertion is safe here
    const playerEl = this.playerEl!;
    playerEl.textContent = v.emoji;
    playerEl.style.transform = `rotate(${this.heading}deg)`;

    const markers: GlobeMarker[] = [
      { id: '__player', lat: this.lat, lng: this.lng, el: playerEl },
    ];

    // Mission target
    if (this.missionTarget) {
      const key = `__target__${this.missionTarget.name}`;
      if (!this.cachedMarkerEls.has(key)) {
        const el = document.createElement('div');
        el.style.cssText = [
          'font-size:28px',
          'filter:drop-shadow(0 0 10px #ffcc00)',
          'animation:wm-pulse 1.5s ease-in-out infinite',
        ].join(';');
        el.textContent = '📦';
        this.cachedMarkerEls.set(key, el);
      }
      markers.push({
        id: key,
        lat: this.missionTarget.lat,
        lng: this.missionTarget.lng,
        el: this.cachedMarkerEls.get(key)!,
      });
    }

    // Nearby city labels
    for (const city of CITIES) {
      const dist = haversineKm(this.lat, this.lng, city.lat, city.lng);
      if (dist > 2_500) continue;
      const key = `__city__${city.name}`;
      if (!this.cachedMarkerEls.has(key)) {
        const el = document.createElement('div');
        const color =
          city.tier === 'mega'    ? '#ffcc00' :
          city.tier === 'capital' ? '#88aaff' :
          '#aaaaaa';
        el.style.cssText = [
          `color:${color}`,
          'font-size:10px',
          'font-weight:bold',
          'font-family:Courier New,monospace',
          'text-shadow:1px 1px 3px #000',
          'white-space:nowrap',
          'pointer-events:none',
          'user-select:none',
        ].join(';');
        el.textContent = `• ${city.name}`;
        this.cachedMarkerEls.set(key, el);
      }
      markers.push({ id: key, lat: city.lat, lng: city.lng, el: this.cachedMarkerEls.get(key)! });
    }

    this.globe.htmlElementsData(markers);
  }

  // ── HUD ──────────────────────────────────────────────────────────────────────

  private updateHUD(): void {
    const qs = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

    // Health bar
    const hfEl = qs<HTMLDivElement>('health-fill');
    if (hfEl) {
      hfEl.style.width = `${this.health}%`;
      hfEl.style.background =
        this.health > 50 ? '#44ff44' :
        this.health > 25 ? '#ffaa00' :
        '#ff4444';
    }

    // Armor bar
    const afEl = qs<HTMLDivElement>('armor-fill');
    if (afEl) afEl.style.width = `${this.armor}%`;

    // Cash
    const cashEl = qs('cash-display');
    if (cashEl) cashEl.textContent = `$${this.cash.toLocaleString()}`;

    // Score
    const scoreEl = qs('score-display');
    if (scoreEl) scoreEl.textContent = `SCORE: ${this.score.toLocaleString()}`;

    // Wanted stars
    const wantedEl = qs('wanted-stars');
    if (wantedEl) {
      wantedEl.textContent = '★'.repeat(this.wantedLevel) + '☆'.repeat(5 - this.wantedLevel);
      wantedEl.style.color =
        this.wantedLevel >= 4 ? '#ff4444' :
        this.wantedLevel >= 2 ? '#ffaa00' :
        '#ffcc00';
      wantedEl.style.textShadow =
        this.wantedLevel >= 3 ? `0 0 8px ${this.wantedLevel >= 4 ? '#ff4444' : '#ffaa00'}` : '';
    }

    // Speed
    const speedEl = qs('speed-display');
    if (speedEl) {
      const kmh = Math.abs(Math.round(this.speed * 111_000 * 3.6));
      speedEl.textContent = `${kmh} km/h`;
      speedEl.style.color = kmh > 300 ? '#ff8800' : '#ffffff';
    }

    // Vehicle indicator
    const vehEl = qs('vehicle-display');
    if (vehEl) {
      const veh = vehicleAt(this.vehicleIdx);
      vehEl.textContent = `[T] ${veh.emoji} ${veh.label}`;
    }

    // Coordinates
    const locEl = qs('location-display');
    if (locEl) {
      const latStr = `${Math.abs(this.lat).toFixed(2)}°${this.lat >= 0 ? 'N' : 'S'}`;
      const lngStr = `${Math.abs(this.lng).toFixed(2)}°${this.lng >= 0 ? 'E' : 'W'}`;
      locEl.textContent = `${latStr}  ${lngStr}`;
    }

    // Mission banner
    const missionEl = qs('mission-banner');
    if (missionEl) {
      if (this.missionTarget) {
        const dist = haversineKm(this.lat, this.lng, this.missionTarget.lat, this.missionTarget.lng);
        const bearing = bearingDeg(this.lat, this.lng, this.missionTarget.lat, this.missionTarget.lng);
        const dirs = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
        const dir = dirs[Math.round(bearing / 45) % 8];
        missionEl.innerHTML =
          `📦 <strong>${this.missionTarget.name}</strong> — ` +
          `${Math.round(dist).toLocaleString()} km ${dir} — ` +
          `Reward: $${this.missionReward.toLocaleString()}`;
      } else {
        missionEl.textContent = '⏳ Awaiting next mission…';
      }
    }
  }

  // ── Minimap ──────────────────────────────────────────────────────────────────

  private drawMinimap(): void {
    const ctx = this.minimapCtx;
    const W = this.minimapCanvas.width;
    const H = this.minimapCanvas.height;
    const CX = W / 2;
    const CY = H / 2;
    const DEG_PER_PX = 0.22; // degrees of lat/lng per canvas pixel

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(0, 8, 0, 0.88)';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(0, 60, 0, 0.35)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 18) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    /** Project globe coords to canvas pixels (player at centre). */
    const toCanvas = (lat: number, lng: number): { x: number; y: number } => {
      const dlng = ((lng - this.lng + 180) % 360) - 180;
      return {
        x: CX + dlng / DEG_PER_PX,
        y: CY - (lat - this.lat) / DEG_PER_PX,
      };
    };

    // Danger zones
    for (const zone of this.dangerZones) {
      if (haversineKm(this.lat, this.lng, zone.lat, zone.lng) > 2_000) continue;
      const { x, y } = toCanvas(zone.lat, zone.lng);
      const rPx = zone.radius / (DEG_PER_PX * 111);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, rPx), 0, Math.PI * 2);
      ctx.fillStyle = zone.color + '1a';
      ctx.fill();
      ctx.strokeStyle = zone.color + '77';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cities
    for (const city of CITIES) {
      if (haversineKm(this.lat, this.lng, city.lat, city.lng) > 2_000) continue;
      const { x, y } = toCanvas(city.lat, city.lng);
      ctx.beginPath();
      ctx.arc(x, y, city.tier === 'mega' ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle =
        city.tier === 'mega'    ? '#ffcc00' :
        city.tier === 'capital' ? '#6688ff' :
        '#777777';
      ctx.fill();
    }

    // Mission target
    if (this.missionTarget) {
      const { x, y } = toCanvas(this.missionTarget.lat, this.missionTarget.lng);
      const visible = x >= -6 && x <= W + 6 && y >= -6 && y <= H + 6;
      if (visible) {
        // Blinking target dot
        if (Math.floor(Date.now() / 500) % 2 === 0) {
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffcc00';
          ctx.fill();
        }
      } else {
        // Edge arrow
        const bearing = bearingDeg(this.lat, this.lng, this.missionTarget.lat, this.missionTarget.lng);
        const rad = bearing * Math.PI / 180;
        const ax = CX + Math.sin(rad) * (CX - 12);
        const ay = CY - Math.cos(rad) * (CY - 12);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(rad);
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('▲', -4, 4);
        ctx.restore();
      }
    }

    // Player dot
    ctx.beginPath();
    ctx.arc(CX, CY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Heading arrow
    const hRad = this.heading * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + Math.sin(hRad) * 11, CY - Math.cos(hRad) * 11);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Compass 'N'
    ctx.fillStyle = 'rgba(0, 220, 80, 0.75)';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('N', CX - 3, 10);

    // Border
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, W, H);
  }

  // ── Notifications ────────────────────────────────────────────────────────────

  private notify(message: string, type: NotifType): void {
    this.notifications.push({
      id: `n${Date.now()}${Math.random()}`,
      message,
      type,
      expiry: Date.now() + 4_500,
    });
    this.renderNotifications();
  }

  private pruneNotifications(): void {
    const before = this.notifications.length;
    this.notifications = this.notifications.filter(n => n.expiry > Date.now());
    if (this.notifications.length !== before) this.renderNotifications();
  }

  private renderNotifications(): void {
    const container = document.getElementById('notifications');
    if (!container) return;
    container.innerHTML = '';
    // Show only the most recent 5
    for (const n of this.notifications.slice(-5)) {
      const el = document.createElement('div');
      el.className = `notif ${n.type}`;
      el.textContent = n.message;
      container.appendChild(el);
    }
  }

  // ── Game-over / restart ──────────────────────────────────────────────────────

  private showGameOver(): void {
    const el = document.getElementById('gameover-screen') as HTMLElement;
    el.style.display = 'flex';
    const qs = (id: string) => document.getElementById(id);
    qs('go-score')!.textContent     = this.score.toLocaleString();
    qs('go-cash')!.textContent      = `$${this.cash.toLocaleString()}`;
    qs('go-missions')!.textContent  = String(this.missionsCompleted);
    qs('go-distance')!.textContent  = `${Math.round(this.distanceTraveled).toLocaleString()} km`;
  }

  restart(): void {
    const city = this.randomCity();
    this.spawnAt(city);
    this.missionTarget = null;
    this.notifications = [];
    (document.getElementById('gameover-screen') as HTMLElement).style.display = 'none';
    (document.getElementById('pause-screen') as HTMLElement).style.display = 'none';
    this.paused = false;
    this.cachedMarkerEls.clear();
    this.playerEl = null;
    this.globe.pointOfView({ lat: this.lat, lng: this.lng, altitude: 0.8 });
    this.assignMission(city);
    this.notify(`🌍 Respawned in ${city.name}!`, 'success');
  }

  resumeFromPause(): void {
    (document.getElementById('pause-screen') as HTMLElement).style.display = 'none';
    this.paused = false;
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

// Inject @keyframes for the mission-target pulse animation
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes wm-pulse {
    0%, 100% { transform: scale(1);   opacity: 1;   }
    50%       { transform: scale(1.35); opacity: 0.65; }
  }
`;
document.head.appendChild(styleTag);

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('globe-mount')!;
  const game = new WorldGame(mountEl);

  document.getElementById('start-btn')!.addEventListener('click', () => game.start());
  document.getElementById('restart-btn')!.addEventListener('click', () => game.restart());
  document.getElementById('pause-restart-btn')!.addEventListener('click', () => {
    game.restart();
    (document.getElementById('pause-screen') as HTMLElement).style.display = 'none';
  });
  document.getElementById('resume-btn')!.addEventListener('click', () => game.resumeFromPause());
});
