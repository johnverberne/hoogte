<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import Viewport3D from "./components/Viewport3D.vue";
import SliderField from "./components/SliderField.vue";
import { cloneParams, defaultParams, meshStats, MODES } from "./lib/wave.js";
import { TEXT_MODES } from "./lib/textField.js";
import { downloadStl } from "./lib/stl.js";
import { deletePattern, getHealth, listPatterns, savePattern } from "./lib/api.js";

const params = reactive(defaultParams());
const patterns = ref([]);
const activeId = ref(null);
const status = ref("");
const mongoOk = ref(false);
const saving = ref(false);
const openHarmonic = ref(0);

const stats = computed(() => meshStats(params));
const visibleHarmonics = computed(() => params.harmonics.slice(0, params.harmonicCount));
const isRadial = computed(() => params.mode === "radial");
const sourceTitle = computed(() => (isRadial.value ? "Radialen" : "Harmonieken"));
const maxOffset = computed(() => Math.round(params.sizeMm * 0.5));

watch(
  () => params.text,
  (value, previous) => {
    if (value.trim() && !(previous || "").trim() && params.resolution < 140) {
      params.resolution = 140;
    }
  }
);

onMounted(async () => {
  const health = await getHealth();
  mongoOk.value = Boolean(health.mongo);
  await refreshLibrary();
});

async function refreshLibrary() {
  const { items, source } = await listPatterns();
  patterns.value = items;
  if (source === "local" && !mongoOk.value) {
    status.value = "Lokaal opgeslagen. Start Mongo om bibliotheek te delen.";
  }
}

function applyPattern(item) {
  const next = cloneParams({ ...defaultParams(), ...item });
  Object.assign(params, next);
  activeId.value = item.id;
  status.value = `Geladen: ${item.name}`;
}

function resetPattern() {
  Object.assign(params, defaultParams());
  activeId.value = null;
  status.value = "Nieuw patroon";
}

function randomize() {
  params.mode = MODES[Math.floor(Math.random() * MODES.length)].id;
  params.harmonicCount = 2 + Math.floor(Math.random() * 4);
  params.wavelengthScale = 0.7 + Math.random() * 1.4;
  params.amplitudeScale = 0.75 + Math.random() * 0.7;
  params.falloff = Math.random() * 0.55;
  params.twist = Math.round(Math.random() * 180);
  params.harmonics.forEach((h, index) => {
    h.amplitude = 0.15 + Math.random() * 1.1;
    h.wavelength = 4 + Math.random() * 50;
    h.angle = Math.round(Math.random() * 360);
    h.phase = Math.random() * Math.PI * 2;
    h.offset = index === 0 ? 0 : Math.round(12 + Math.random() * maxOffset.value * 0.7);
  });
  status.value = "Willekeurig patroon";
}

function addRadial() {
  if (params.harmonicCount >= 6) return;
  const index = params.harmonicCount;
  params.harmonicCount += 1;
  const source = params.harmonics[index];
  source.offset = 16 + index * 8;
  source.angle = (index * 67) % 360;
  source.amplitude = Math.max(source.amplitude, 0.7);
  source.wavelength = Math.max(source.wavelength, 16);
  openHarmonic.value = index;
  status.value = `${params.harmonicCount} radialen`;
}

function removeRadial() {
  if (params.harmonicCount <= 1) return;
  params.harmonicCount -= 1;
  if (openHarmonic.value >= params.harmonicCount) {
    openHarmonic.value = params.harmonicCount - 1;
  }
  status.value = `${params.harmonicCount} radialen`;
}

async function persist() {
  saving.value = true;
  try {
    const { item, source, warning } = await savePattern(cloneParams(params), activeId.value);
    activeId.value = item.id;
    await refreshLibrary();
    status.value = warning
      ? `Lokaal bewaard. ${warning}`
      : source === "mongo"
        ? "Bewaard in MongoDB"
        : "Lokaal bewaard";
    mongoOk.value = source === "mongo";
  } finally {
    saving.value = false;
  }
}

async function remove(id) {
  await deletePattern(id);
  if (activeId.value === id) activeId.value = null;
  await refreshLibrary();
  status.value = "Patroon verwijderd";
}

function exportStl() {
  downloadStl(cloneParams(params));
  status.value = `STL geëxporteerd · ${stats.value.fileKb} kB`;
}
</script>

<template>
  <div class="app">
    <header class="topbar">
      <a class="brand" href="https://captainjohn.nl" target="_blank" rel="noreferrer">
        <img class="brand-logo" src="/logo-captainjohn.png" alt="Captain John" />
        <div>
          <p class="eyebrow">captainjohn.nl</p>
          <h1>print relief to stl</h1>
        </div>
      </a>
      <div class="top-actions">
        <span class="pill" :class="{ on: mongoOk }">{{ mongoOk ? "Mongo verbonden" : "Lokaal" }}</span>
        <button type="button" class="ghost" @click="resetPattern">Nieuw</button>
        <button type="button" class="ghost" @click="randomize">Dobbelen</button>
        <button type="button" class="ghost" :disabled="saving" @click="persist">
          {{ saving ? "Bewaren…" : "Bewaar" }}
        </button>
        <button type="button" class="primary" @click="exportStl">Exporteer STL</button>
      </div>
    </header>

    <main class="layout">
      <section class="stage">
        <Viewport3D :params="params" />
        <div class="stage-meta">
          <div>
            <strong>{{ stats.widthMm }} × {{ stats.depthMm }} × {{ stats.heightMm }} mm</strong>
            <span>{{ stats.triangles.toLocaleString("nl-NL") }} driehoeken · {{ stats.fileKb }} kB</span>
          </div>
          <p v-if="status">{{ status }}</p>
        </div>
      </section>

      <aside class="panel">
        <label class="name-field">
          Naam
          <input v-model="params.name" maxlength="80" />
        </label>

        <div class="modes">
          <button
            v-for="mode in MODES"
            :key="mode.id"
            type="button"
            :class="{ active: params.mode === mode.id }"
            @click="params.mode = mode.id"
          >
            {{ mode.label }}
          </button>
        </div>

        <section>
          <h2>Golf</h2>
          <SliderField
            v-model="params.harmonicCount"
            :label="sourceTitle"
            :min="1"
            :max="6"
            :step="1"
            :digits="0"
          />
          <div v-if="isRadial" class="source-actions">
            <button type="button" class="ghost" :disabled="params.harmonicCount >= 6" @click="addRadial">
              Voeg radiaal toe
            </button>
            <button type="button" class="ghost" :disabled="params.harmonicCount <= 1" @click="removeRadial">
              Verwijder
            </button>
          </div>
          <SliderField
            v-model="params.wavelengthScale"
            label="Golflengte"
            :min="0.25"
            :max="3"
            :step="0.01"
            :digits="2"
            unit="×"
          />
          <SliderField
            v-model="params.amplitudeScale"
            label="Amplitude"
            :min="0.2"
            :max="2.5"
            :step="0.01"
            :digits="2"
            unit="×"
          />
          <SliderField
            v-model="params.twist"
            label="Draaiing"
            :min="0"
            :max="180"
            :step="1"
            :digits="0"
            unit="°"
          />
          <SliderField
            v-model="params.falloff"
            label="Randdemping"
            :min="0"
            :max="1"
            :step="0.01"
            :digits="2"
          />
        </section>

        <section>
          <h2>{{ sourceTitle }}</h2>
          <article
            v-for="(harmonic, index) in visibleHarmonics"
            :key="index"
            class="harmonic"
            :class="{ open: openHarmonic === index }"
          >
            <button type="button" class="harmonic-head" @click="openHarmonic = index">
              <span>{{ isRadial ? `R${index + 1}` : `H${index + 1}` }}</span>
              <span>
                {{
                  isRadial
                    ? `${Math.round(harmonic.offset)} mm · ${Math.round(harmonic.angle)}°`
                    : `${harmonic.wavelength.toFixed(1)} mm · ${Math.round(harmonic.angle)}°`
                }}
              </span>
            </button>
            <div v-if="openHarmonic === index" class="harmonic-body">
              <SliderField
                v-model="harmonic.amplitude"
                label="Amplitude"
                :min="0"
                :max="2"
                :step="0.01"
              />
              <SliderField
                v-model="harmonic.wavelength"
                label="Golflengte"
                :min="2"
                :max="120"
                :step="0.1"
                unit="mm"
                :digits="1"
              />
              <SliderField
                v-if="isRadial"
                v-model="harmonic.offset"
                label="Afstand tot midden"
                :min="0"
                :max="maxOffset"
                :step="1"
                unit="mm"
                :digits="0"
              />
              <SliderField
                v-model="harmonic.angle"
                :label="isRadial ? 'Positie' : 'Richting'"
                :min="0"
                :max="isRadial ? 360 : 180"
                :step="1"
                unit="°"
                :digits="0"
              />
              <SliderField
                v-model="harmonic.phase"
                label="Fase"
                :min="0"
                :max="6.2832"
                :step="0.01"
                unit="rad"
              />
            </div>
          </article>
        </section>

        <section>
          <h2>Tekst</h2>
          <label class="name-field">
            Letters
            <textarea
              v-model="params.text"
              rows="2"
              maxlength="80"
              placeholder="Captain John"
            />
          </label>
          <div class="modes modes-2">
            <button
              v-for="mode in TEXT_MODES"
              :key="mode.id"
              type="button"
              :class="{ active: params.textMode === mode.id }"
              @click="params.textMode = mode.id"
            >
              {{ mode.label }}
            </button>
          </div>
          <SliderField
            v-model="params.textSizeMm"
            label="Lettergrootte"
            :min="6"
            :max="80"
            :step="1"
            unit="mm"
            :digits="0"
          />
          <SliderField
            v-model="params.textHeightMm"
            :label="params.textMode === 'engrave' ? 'Diepte' : 'Hoogte'"
            :min="0.4"
            :max="8"
            :step="0.1"
            unit="mm"
            :digits="1"
          />
          <SliderField
            v-model="params.textOffsetX"
            label="Links / rechts"
            :min="-maxOffset"
            :max="maxOffset"
            :step="1"
            unit="mm"
            :digits="0"
          />
          <SliderField
            v-model="params.textOffsetY"
            label="Voor / achter"
            :min="-maxOffset"
            :max="maxOffset"
            :step="1"
            unit="mm"
            :digits="0"
          />
          <SliderField
            v-model="params.textRotation"
            label="Draaiing"
            :min="0"
            :max="360"
            :step="1"
            :digits="0"
            unit="°"
          />
          <p class="hint">Hogere resolutie maakt letters scherper in de STL.</p>
        </section>

        <section>
          <h2>Printplaat</h2>
          <SliderField
            v-model="params.sizeMm"
            label="Plaatgrootte"
            :min="40"
            :max="280"
            :step="1"
            unit="mm"
            :digits="0"
          />
          <SliderField
            v-model="params.waveHeightMm"
            label="Golfhoogte"
            :min="0.6"
            :max="32"
            :step="0.1"
            unit="mm"
            :digits="1"
          />
          <SliderField
            v-model="params.baseThicknessMm"
            label="Bodemdikte"
            :min="0.8"
            :max="10"
            :step="0.1"
            unit="mm"
            :digits="1"
          />
          <SliderField
            v-model="params.resolution"
            label="Resolutie"
            :min="24"
            :max="180"
            :step="1"
            :digits="0"
          />
        </section>

        <section>
          <h2>Bibliotheek</h2>
          <ul class="library">
            <li v-for="item in patterns" :key="item.id" :class="{ current: item.id === activeId }">
              <button type="button" class="lib-load" @click="applyPattern(item)">
                <strong>{{ item.name }}</strong>
                <span>{{ item.mode }} · {{ item.harmonicCount }} {{ item.mode === "radial" ? "R" : "H" }}</span>
              </button>
              <button type="button" class="lib-del" @click="remove(item.id)">×</button>
            </li>
            <li v-if="!patterns.length" class="empty">Nog geen bewaarde patronen.</li>
          </ul>
        </section>
      </aside>
    </main>
  </div>
</template>
