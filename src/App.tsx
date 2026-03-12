import React, { useEffect } from 'react';
import L, { Map as LeafletMap, Circle, Marker } from 'leaflet';

type State = {
  yieldKt: number;
  isAirBurst: boolean;
  lat: number;
  lng: number;
  zoom: number;
  circles: Circle[];
};

const CONSTANTS = {
  AIR: {
    fireball: 0.11,
    heavyBlast: 0.29,
    moderateBlast: 0.7,
    lightBlast: 2.2,
  },
  SURFACE: {
    fireball: 0.1,
    heavyBlast: 0.22,
    moderateBlast: 0.55,
    lightBlast: 1.8,
  },
} as const;

const BOMB_INFO: Record<string, string> = {
  '15': 'Arma de fisión de uranio. Primera arma nuclear usada en guerra.',
  '21': 'Arma de fisión de plutonio. Diseño implosión.',
  '50': 'Cabeza táctica moderna (ej. W80). Alta eficiencia.',
  '300': 'Ojiva termonuclear típica de MIRV (Minuteman III/Trident).',
  '15000': 'Prueba termonuclear estadounidense más grande. Contaminación extensiva.',
  '25000': 'El arma nuclear de mayor rendimiento desarrollada por EE.UU.',
  '50000': 'La bomba más grande jamás detonada. Diseño soviético de 3 etapas.',
};

export function App() {
  useEffect(() => {
    const state: State = {
      yieldKt: 15,
      isAirBurst: true,
      lat: 40.416775,
      lng: -3.70379,
      zoom: 12,
      circles: [],
    };

    const map: LeafletMap = L.map('map', { zoomControl: false }).setView(
      [state.lat, state.lng],
      state.zoom,
    );

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      },
    ).addTo(map);

    const marker: Marker = L.marker([state.lat, state.lng], {
      draggable: true,
    }).addTo(map);

    function updateLocation(lat: number, lng: number) {
      state.lat = lat;
      state.lng = lng;
    }

    function calculateRadii(yieldKt: number) {
      const mode = state.isAirBurst ? CONSTANTS.AIR : CONSTANTS.SURFACE;
      const scale = Math.pow(yieldKt, 1 / 3);

      return {
        fireball: mode.fireball * scale,
        heavyBlast: mode.heavyBlast * scale,
        moderateBlast: mode.moderateBlast * scale,
        lightBlast: mode.lightBlast * scale,
      };
    }

    const els = {
      locationInput: document.getElementById('locationInput') as HTMLInputElement | null,
      btnSearch: document.getElementById('btnSearch') as HTMLButtonElement | null,
      btnMyLocation: document.getElementById('btnMyLocation') as HTMLButtonElement | null,
      bombSelect: document.getElementById('bombSelect') as HTMLSelectElement | null,
      bombInfo: document.getElementById('bombInfo') as HTMLParagraphElement | null,
      modeAir: document.getElementById('modeAir') as HTMLButtonElement | null,
      modeSurface: document.getElementById('modeSurface') as HTMLButtonElement | null,
      modeDesc: document.getElementById('modeDesc') as HTMLParagraphElement | null,
      btnSimulate: document.getElementById('btnSimulate') as HTMLButtonElement | null,
      resFire: document.getElementById('resFire'),
      resHeavy: document.getElementById('resHeavy'),
      resModerate: document.getElementById('resModerate'),
      resLight: document.getElementById('resLight'),
      toast: document.getElementById('toast'),
    };

    function showToast(msg: string) {
      if (!els.toast) return;
      els.toast.textContent = msg;
      els.toast.classList.add('show');
      setTimeout(() => els.toast && els.toast.classList.remove('show'), 3000);
    }

    function updateResults(radii: {
      fireball: number;
      heavyBlast: number;
      moderateBlast: number;
      lightBlast: number;
    }) {
      if (!els.resFire || !els.resHeavy || !els.resModerate || !els.resLight) return;
      els.resFire.textContent = `${radii.fireball.toFixed(2)} km`;
      els.resHeavy.textContent = `${radii.heavyBlast.toFixed(2)} km`;
      els.resModerate.textContent = `${radii.moderateBlast.toFixed(2)} km`;
      els.resLight.textContent = `${radii.lightBlast.toFixed(2)} km`;
    }

    function drawCircles(radii: {
      fireball: number;
      heavyBlast: number;
      moderateBlast: number;
      lightBlast: number;
    }) {
      state.circles.forEach((c) => map.removeLayer(c));
      state.circles = [];

      const center: [number, number] = [state.lat, state.lng];

      const addCircle = (radius: number, color: string) => {
        const circle = L.circle(center, {
          color,
          fillColor: color,
          fillOpacity: 0.4,
          radius: radius * 1000,
          weight: 1,
        }).addTo(map);
        state.circles.push(circle);
      };

      addCircle(radii.lightBlast, '#34c759');
      addCircle(radii.moderateBlast, '#ffcc00');
      addCircle(radii.heavyBlast, '#ff9500');
      addCircle(radii.fireball, '#ff3b30');

      const maxRadiusMeters = Math.max(...Object.values(radii)) * 1000;
      if (maxRadiusMeters > 50000) {
        const bounds = L.latLngBounds([
          center,
          [center[0], center[1] + maxRadiusMeters / 111320],
        ]);
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        map.setView(center, 11);
      }
    }

    function runSimulation() {
      if (state.yieldKt <= 0) {
        showToast('La potencia debe ser mayor a 0');
        return;
      }

      const radii = calculateRadii(state.yieldKt);
      updateResults(radii);
      drawCircles(radii);
      showToast('Simulación actualizada');
    }

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      updateLocation(position.lat, position.lng);
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      updateLocation(e.latlng.lat, e.latlng.lng);
    });

    if (els.btnSearch && els.locationInput) {
      els.btnSearch.addEventListener('click', async () => {
        const query = els.locationInput!.value;
        if (!query) return;

        els.btnSearch!.textContent = '...';
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              query,
            )}`,
          );
          const data: any[] = await response.json();

          if (data && data.length > 0) {
            const loc = data[0];
            const lat = parseFloat(loc.lat);
            const lon = parseFloat(loc.lon);

            marker.setLatLng([lat, lon]);
            map.setView([lat, lon], 12);
            updateLocation(lat, lon);
            showToast(`Ubicado: ${String(loc.display_name).split(',')[0]}`);
          } else {
            showToast('No se encontró la ubicación');
          }
        } catch (e) {
          showToast('Error en la búsqueda');
          console.error(e);
        } finally {
          if (els.btnSearch) els.btnSearch.textContent = '🔍';
        }
      });
    }

    if (els.btnMyLocation) {
      els.btnMyLocation.addEventListener('click', () => {
        if (!navigator.geolocation) {
          showToast('Geolocalización no soportada');
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            marker.setLatLng([lat, lng]);
            map.setView([lat, lng], 13);
            updateLocation(lat, lng);
            showToast('Ubicación detectada');
          },
          () => {
            showToast('Error al obtener ubicación');
          },
        );
      });
    }

    if (els.bombSelect && els.bombInfo) {
      els.bombSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const val = target.value;
        const kt = parseFloat(val);
        state.yieldKt = kt;
        els.bombInfo!.textContent = BOMB_INFO[val] || 'Arma histórica.';
      });
    }

    if (els.modeAir && els.modeSurface && els.modeDesc) {
      els.modeAir.addEventListener('click', () => {
        state.isAirBurst = true;
        els.modeAir!.classList.add('active');
        els.modeSurface!.classList.remove('active');
        els.modeDesc!.textContent =
          'Explosión aérea óptima para maximizar la onda de choque.';
      });

      els.modeSurface.addEventListener('click', () => {
        state.isAirBurst = false;
        els.modeSurface!.classList.add('active');
        els.modeAir!.classList.remove('active');
        els.modeDesc!.textContent =
          'Explosión en el suelo. Mayor cráter y lluvia radiactiva, pero menor radio de onda de choque.';
      });
    }

    if (els.btnSimulate) {
      els.btnSimulate.addEventListener('click', runSimulation);
    }

    runSimulation();

    return () => {
      map.remove();
    };
  }, []);

  return (
    <>
      <header>
        <h1>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v20M2 12h20M4.929 4.929l14.142 14.142M4.929 19.071L19.071 4.929" />
          </svg>
          NuclearMap
        </h1>
      </header>

      <div className="main-container">
        <aside>
          <div className="control-group">
            <label>Ubicación Objetivo</label>
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                type="text"
                id="locationInput"
                placeholder="Ciudad o dirección..."
              />
              <button id="btnSearch" style={{ padding: '0 15px' }}>
                🔍
              </button>
            </div>
            <button id="btnMyLocation" className="secondary">
              Usar mi ubicación actual
            </button>
          </div>

          <div className="control-group">
            <label>Modelo de Bomba</label>
            <select id="bombSelect" defaultValue="15">
              <option value="15">
                Little Boy (Hiroshima, 1945) - 15 kt
              </option>
              <option value="21">Fat Man (Nagasaki, 1945) - 21 kt</option>
              <option value="50">Bomba Táctica (W80) - 50-150 kt</option>
              <option value="300">Ojiva ICBM Promedio - 300 kt</option>
              <option value="15000">
                Castle Bravo (EE.UU., 1954) - 15 Mt
              </option>
              <option value="25000">B41 (EE.UU., máxima) - 25 Mt</option>
              <option value="50000">Tsar Bomba (URSS, 1961) - 50 Mt</option>
            </select>
            <p
              id="bombInfo"
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 5,
              }}
            >
              Arma de fisión de uranio.
            </p>
          </div>

          <div className="control-group">
            <label>Modo de Detonación</label>
            <div className="btn-group">
              <button id="modeAir" className="active">
                Aire
              </button>
              <button id="modeSurface">Superficie</button>
            </div>
            <p
              id="modeDesc"
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 5,
              }}
            >
              Explosión aérea óptima para maximizar la onda de choque.
            </p>
          </div>

          <button id="btnSimulate">Simular Daño</button>

          <div className="control-group">
            <label>Estimación de Radios (Aprox.)</label>
            <div className="results-list">
              <div className="result-item fire">
                <span>Bola de Fuego</span>
                <span className="result-value" id="resFire">
                  0.00 km
                </span>
              </div>
              <div className="result-item heavy">
                <span>Onda de Choque Severa (20 psi)</span>
                <span className="result-value" id="resHeavy">
                  0.00 km
                </span>
              </div>
              <div className="result-item moderate">
                <span>Daños Estructurales (5 psi)</span>
                <span className="result-value" id="resModerate">
                  0.00 km
                </span>
              </div>
              <div className="result-item light">
                <span>Rotura de Cristales (1 psi)</span>
                <span className="result-value" id="resLight">
                  0.00 km
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '0.7rem',
              color: '#666',
              marginTop: 'auto',
            }}
          >
            * Los cálculos son aproximados y basados en modelos escalares
            simplificados (\u0024R \\propto Y^{1/3}\u0024).
          </div>
        </aside>

        <div id="map" />

        <div className="legend">
          <div className="legend-item">
            <div
              className="legend-color"
              style={{ background: 'rgba(255, 59, 48, 0.6)' }}
            />
            Bola de fuego
          </div>
          <div className="legend-item">
            <div
              className="legend-color"
              style={{ background: 'rgba(255, 149, 0, 0.6)' }}
            />
            Daño severo
          </div>
          <div className="legend-item">
            <div
              className="legend-color"
              style={{ background: 'rgba(255, 204, 0, 0.6)' }}
            />
            Daño estructural
          </div>
          <div className="legend-item">
            <div
              className="legend-color"
              style={{ background: 'rgba(52, 199, 89, 0.6)' }}
            />
            Daños leves / cristales
          </div>
        </div>
      </div>

      <div id="toast" className="toast" />
    </>
  );
}

