<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/m03-trip-history.html
    h1: Trip History & Playback
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
<div class="container">

      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Trip History & Playback</h1>
          <p class="page-subtitle">Historical route tracking, playback, and travel behavior analysis</p>
        </div>
        <div style="display: flex; gap: var(--spacing-sm);">
          <select class="select" style="width: 150px;">
            <option>Today</option>
            <option selected>Yesterday</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
          </select>
          <button class="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Report
          </button>
        </div>
      </div>

      <!-- Vehicle Selection -->
      <div class="card" style="margin-bottom: var(--spacing-xl);">
        <div class="card-body">
          <div style="display: flex; gap: var(--spacing-xl); align-items: flex-end;">
            <div style="flex: 1;">
              <label class="input-label">Select Vehicle</label>
              <select class="select" id="vehicleSelect" style="width: 100%;">
                <option value="KBZ 123A">KBZ 123A - Matatu (Route 24)</option>
                <option value="KBX 456B">KBX 456B - Bus (Route 46)</option>
                <option value="KCJ 789C">KCJ 789C - Matatu (Route 11)</option>
                <option value="KBL 321D">KBL 321D - Bodaboda</option>
                <option value="KBR 654E">KBR 654E - Truck</option>
              </select>
            </div>
            <div>
              <label class="input-label">Date</label>
              <input type="date" class="input" id="tripDate" value="2026-04-08">
            </div>
            <div>
              <button class="btn btn-primary" onclick="loadTrip()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Playback Area -->
      <div class="grid-2" style="margin-bottom: var(--spacing-xl);">

        <!-- Real Google Map -->
        <div class="map-container" style="height: 450px; position: relative;">
          <div id="map" style="width: 100%; height: 100%;"></div>

          <div class="map-controls">
            <button class="map-control-btn" onclick="mapZoomIn()" title="Zoom in">+</button>
            <button class="map-control-btn" onclick="mapZoomOut()" title="Zoom out">−</button>
            <button class="map-control-btn" onclick="fitRoute()"   title="Fit route">⤢</button>
            <button class="map-control-btn" onclick="toggleFullscreen()" title="Fullscreen">⛶</button>
          </div>

          <div class="map-legend">
            <div class="legend-title">Route Status</div>
            <div class="legend-items">
              <div class="legend-item">
                <div style="width: 16px; height: 4px; background: #10b981; border-radius: 2px;"></div>
                <span>Traveled</span>
              </div>
              <div class="legend-item">
                <div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 50%;"></div>
                <span>Start Point</span>
              </div>
              <div class="legend-item">
                <div style="width: 12px; height: 12px; background: #10b981; border-radius: 50%;"></div>
                <span>Current Position</span>
              </div>
              <div class="legend-item">
                <div style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></div>
                <span>Waypoint</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Trip Details & Controls -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Trip Details</div>
              <div class="card-subtitle" id="tripSubtitle">KBZ 123A · April 8, 2026</div>
            </div>
          </div>
          <div class="card-body">

            <!-- Trip Info -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-md); margin-bottom: var(--spacing-xl);">
              <div style="padding: var(--spacing-md); background: var(--secondary-bg); border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Departure Time</div>
                <div style="font-size: 1.25rem; font-weight: 700;" id="departTime">06:15</div>
              </div>
              <div style="padding: var(--spacing-md); background: var(--secondary-bg); border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Arrival Time</div>
                <div style="font-size: 1.25rem; font-weight: 700;" id="arriveTime">07:42</div>
              </div>
              <div style="padding: var(--spacing-md); background: var(--secondary-bg); border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Total Distance</div>
                <div style="font-size: 1.25rem; font-weight: 700;" id="distance">18.5 km</div>
              </div>
              <div style="padding: var(--spacing-md); background: var(--secondary-bg); border-radius: var(--radius-md); text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Avg Speed</div>
                <div style="font-size: 1.25rem; font-weight: 700;" id="avgSpeed">38.2 km/h</div>
              </div>
            </div>

            <!-- Playback Controls -->
            <div style="margin-bottom: var(--spacing-lg);">
              <div style="display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
                <button class="btn btn-secondary" style="padding: var(--spacing-sm);" onclick="seek(-1)" title="Previous">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="19 20 9 12 19 4 19 20" />
                    <line x1="5" y1="19" x2="5" y2="5" />
                  </svg>
                </button>
                <button class="btn btn-primary" style="padding: var(--spacing-sm);" id="playBtn" onclick="togglePlay()" title="Play/Pause">
                  <svg id="playIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </button>
                <button class="btn btn-secondary" style="padding: var(--spacing-sm);" onclick="seek(1)" title="Next">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 4 15 12 5 20 5 4" />
                    <line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                </button>
                <div style="flex: 1; text-align: center;">
                  <span style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 600;" id="clock">06:45:30</span>
                  <span style="color: var(--text-muted);" id="clockTotal"> / 01:27:00</span>
                </div>
              </div>

              <!-- Timeline slider -->
              <div style="position: relative; height: 40px;">
                <div style="position: absolute; top: 50%; left: 0; right: 0; height: 4px; background: var(--secondary-bg); border-radius: 2px; transform: translateY(-50%);"></div>
                <div id="traveledBar" style="position: absolute; top: 50%; left: 0; width: 45%; height: 4px; background: var(--success); border-radius: 2px; transform: translateY(-50%);"></div>
                <div id="sliderThumb" style="position: absolute; top: 50%; left: 45%; width: 12px; height: 12px; background: var(--success); border-radius: 50%; transform: translate(-50%, -50%); cursor: pointer;"></div>
                <input type="range" id="timeline" min="0" max="100" value="45"
                  style="position:absolute;inset:0;width:100%;height:40px;opacity:0;cursor:pointer"
                  oninput="seekToPercent(this.value)">
                <div style="position: absolute; bottom: 0; left: 0;    font-size: 0.625rem; color: var(--text-muted);" id="t0">06:15</div>
                <div style="position: absolute; bottom: 0; left: 25%;  font-size: 0.625rem; color: var(--text-muted);" id="t1">06:45</div>
                <div style="position: absolute; bottom: 0; left: 50%;  font-size: 0.625rem; color: var(--text-muted);" id="t2">07:15</div>
                <div style="position: absolute; bottom: 0; left: 75%;  font-size: 0.625rem; color: var(--text-muted);" id="t3">07:45</div>
                <div style="position: absolute; bottom: 0; right: 0;   font-size: 0.625rem; color: var(--text-muted);" id="t4">08:00</div>
              </div>

              <!-- Speed control -->
              <div style="display: flex; align-items: center; gap: var(--spacing-md); margin-top: var(--spacing-md);">
                <span style="font-size: 0.75rem; color: var(--text-muted);">Playback Speed:</span>
                <div style="display: flex; gap: var(--spacing-xs);">
                  <button class="btn btn-sm btn-ghost"        onclick="setSpeed(0.5)">0.5x</button>
                  <button class="btn btn-sm btn-secondary active" id="sp1" onclick="setSpeed(1)">1x</button>
                  <button class="btn btn-sm btn-ghost"        onclick="setSpeed(2)">2x</button>
                  <button class="btn btn-sm btn-ghost"        onclick="setSpeed(4)">4x</button>
                </div>
              </div>
            </div>

            <!-- Event Log -->
            <div>
              <div style="font-weight: 600; margin-bottom: var(--spacing-md);">Event Log</div>
              <div id="eventLog" style="max-height: 150px; overflow-y: auto;">
                <!-- populated by JS -->
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Trip Statistics -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Trip Statistics</div>
            <div class="card-subtitle">Detailed travel behavior analysis</div>
          </div>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-lg);">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--spacing-sm);">Driving Time</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-blue);">01:15:22</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">86.5% of trip</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--spacing-sm);">Idle Time</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-amber);">00:08:15</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">6 stops</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--spacing-sm);">Max Speed</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-red);">68 km/h</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">at 06:42</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: var(--spacing-sm);">Fuel Consumed</div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-emerald);">2.8 L</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">6.6 km/L efficiency</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useNavSubtitle('Trip History')
</script>
