<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient'
import Navbar from '../components/Navbar.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { toast } from 'vue-sonner'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapLocation {
  id: string
  name: string
  lat: number
  lng: number
  note: string
  image_url: string | null
  link: string | null
}

const locations = ref<MapLocation[]>([])
const loading = ref(true)
const selectedLocation = ref<MapLocation | null>(null)

let map: L.Map | null = null
const markerMap: Record<string, L.Marker> = {}

// Custom romantic heart icon for map pins
const heartIcon = L.divIcon({
  html: `
    <div class="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-[#1D1A1F] border border-[#D4537E]/40 shadow-md">
      <i class="ti ti-heart-filled text-lg text-[#D4537E] animate-bounce"></i>
    </div>
  `,
  className: 'custom-heart-pin',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
})

// Fetch locations
async function loadLocations() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('love_map_locations')
      .select('*')

    if (error) throw error
    locations.value = data || []
  } catch (err: any) {
    toast.error('Lỗi khi tải bản đồ: ' + err.message)
  } finally {
    loading.value = false
  }
}

// Initialize Leaflet map
function initMap() {
  if (locations.value.length === 0) return

  // Default focus: center at Saigon or first location
  const centerLat = locations.value[0]?.lat || 10.7769
  const centerLng = locations.value[0]?.lng || 106.7009

  map = L.map('map-viewport', {
    zoomControl: false // Disable default zoom to position it better
  }).setView([centerLat, centerLng], 14)

  // Add custom zoom control at top-right
  L.control.zoom({ position: 'topright' }).addTo(map)

  // OpenStreetMap Tile Layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map)

  // Add markers
  locations.value.forEach(loc => {
    const marker = L.marker([loc.lat, loc.lng], { icon: heartIcon }).addTo(map!)
    
    // Custom popup bubble content
    const popupHtml = `
      <div class="p-2 text-xs font-sans text-gray-800" style="max-width: 180px;">
        <p class="font-bold text-sm text-[#993556] mb-1">${loc.name}</p>
        ${loc.image_url ? `<img src="${loc.image_url}" class="w-full h-20 object-cover rounded-lg mb-2 border border-gray-200" />` : ''}
        <p class="text-gray-600 leading-relaxed mb-2">${loc.note}</p>
        ${loc.link ? `<a href="${loc.link}" target="_blank" class="inline-flex items-center gap-1 text-[#D4537E] font-semibold hover:underline"><i class="ti ti-external-link"></i> Xem đường đi</a>` : ''}
      </div>
    `
    marker.bindPopup(popupHtml)
    
    // Save reference to marker
    markerMap[loc.id] = marker

    // Handle marker click
    marker.on('click', () => {
      selectedLocation.value = loc
    })
  })

  // Fit bounds to show all markers
  if (locations.value.length > 0) {
    const latLngs = locations.value.map(loc => L.latLng(loc.lat, loc.lng))
    const bounds = L.latLngBounds(latLngs)
    map.fitBounds(bounds, { padding: [50, 50] })
  }
}

// Pan & Zoom to location
function focusLocation(loc: MapLocation) {
  selectedLocation.value = loc
  if (map) {
    map.setView([loc.lat, loc.lng], 16)
    const marker = markerMap[loc.id]
    if (marker) {
      marker.openPopup()
    }
  }
}

onMounted(async () => {
  await loadLocations()
  initMap()
})
</script>

<template>
  <div class="min-h-screen bg-surface-1 dark:bg-[#121013] text-gray-800 dark:text-gray-100 pb-24 transition-colors duration-300">
    <ThemeToggle />
    
    <!-- Centered mobile screen container -->
    <div class="max-w-[430px] mx-auto min-h-screen bg-surface-2 dark:bg-[#1C1A1D] border-x border-border shadow-sm flex flex-col">
      
      <!-- Header -->
      <header class="p-5 border-b border-border flex-shrink-0">
        <h2 class="text-base font-bold font-serif text-gray-900 dark:text-gray-100">Bản đồ tình yêu</h2>
        <p class="text-xs text-text-secondary">Những địa điểm đặc biệt lưu dấu bước chân hai ta</p>
      </header>

      <!-- Map Body area -->
      <div v-if="loading" class="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <i class="ti ti-loader animate-spin text-2xl text-[#D4537E]"></i>
        <p class="text-xs text-text-muted">Đang tải bản đồ kỷ niệm...</p>
      </div>

      <div v-else-if="locations.length === 0" class="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <i class="ti ti-map-2 text-4xl text-text-muted mb-3"></i>
        <p class="text-xs text-text-muted leading-relaxed">
          Chưa có địa điểm kỷ niệm nào được thêm. Hãy bảo anh ấy thêm các địa điểm trong trang Admin nhé! 🗺️
        </p>
      </div>

      <div v-else class="flex-1 flex flex-col min-h-0">
        <!-- Map Viewport -->
        <div id="map-viewport" class="w-full h-72 z-10 border-b border-border"></div>

        <!-- Locations List underneath -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <h3 class="text-xs font-semibold text-text-secondary mb-1 px-1">Danh sách địa điểm</h3>

          <div 
            v-for="loc in locations" 
            :key="loc.id"
            @click="focusLocation(loc)"
            class="flex items-center gap-3.5 border rounded-2xl p-3 bg-surface-1 dark:bg-[#1D1A1F]/30 hover:bg-[#FBEAF0]/20 cursor-pointer transition"
            :class="selectedLocation?.id === loc.id ? 'border-[#D4537E]' : 'border-border'"
          >
            <!-- Thumbnail -->
            <div class="w-12 h-12 rounded-xl bg-surface-2 border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
              <img v-if="loc.image_url" :src="loc.image_url" class="w-full h-full object-cover" />
              <i v-else class="ti ti-photo text-lg text-text-muted"></i>
            </div>

            <!-- Text details -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{{ loc.name }}</p>
              <p class="text-[10px] text-text-muted mt-1 truncate">{{ loc.note }}</p>
            </div>

            <!-- Marker icon -->
            <i class="ti ti-map-pin text-[#D4537E] text-base flex-shrink-0"></i>
          </div>
        </div>
      </div>

    </div>

    <Navbar />
  </div>
</template>

<style>
/* Leaflet styles overrides to match our dark theme and prevent overflow issues */
.leaflet-popup-content-wrapper {
  background: var(--surface-2) !important;
  color: inherit !important;
  border: 1px solid var(--border) !important;
  border-radius: 14px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  padding: 0 !important;
  overflow: hidden;
}

.leaflet-popup-content {
  margin: 0 !important;
  background: var(--surface-2) !important;
  color: inherit !important;
}

.leaflet-popup-tip {
  background: var(--surface-2) !important;
  border: 1px solid var(--border) !important;
  box-shadow: none !important;
}

.leaflet-container a.leaflet-popup-close-button {
  color: var(--text-muted) !important;
  padding: 8px !important;
}

/* Bounce animation for map marker icons */
.custom-heart-pin i {
  animation: heartBounce 1.2s infinite ease-in-out;
}

@keyframes heartBounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
</style>
