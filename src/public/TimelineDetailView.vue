<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'vue-sonner'
import ThemeToggle from '../components/ThemeToggle.vue'
import dayjs from 'dayjs'

// Import Swiper Vue.js components & modules
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'

interface TimelineEvent {
  id: string
  title: string
  description: string
  event_date: string
  is_special: boolean
  sort_order: number
}

interface ImageItem {
  id: string
  image_url: string
}

const route = useRoute()
const router = useRouter()

const eventDetail = ref<TimelineEvent | null>(null)
const eventImages = ref<ImageItem[]>([])
const loading = ref(true)

const prevEvent = ref<TimelineEvent | null>(null)
const nextEvent = ref<TimelineEvent | null>(null)

// Swiper setup
const swiperModules = [Pagination]

// Fetch details for route ID
async function fetchEventDetails(eventId: string) {
  loading.value = true
  try {
    // 1. Fetch Event info
    const { data: eventData, error: eventError } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError) throw eventError
    eventDetail.value = eventData

    // 2. Fetch Event images
    const { data: imagesData, error: imagesError } = await supabase
      .from('timeline_images')
      .select('id, image_url')
      .eq('timeline_event_id', eventId)
      .order('sort_order', { ascending: true })

    if (imagesError) throw imagesError
    eventImages.value = imagesData || []

    // 3. Fetch Prev / Next milestones
    if (eventData) {
      const { data: allEvents, error: orderError } = await supabase
        .from('timeline_events')
        .select('id, title, description, sort_order, event_date, is_special')
        .order('sort_order', { ascending: true })

      if (!orderError && allEvents) {
        const index = allEvents.findIndex(e => e.id === eventData.id)
        prevEvent.value = index > 0 ? allEvents[index - 1] : null
        nextEvent.value = index < allEvents.length - 1 ? allEvents[index + 1] : null
      }
    }
  } catch (err: any) {
    toast.error('Lỗi khi tải mốc kỷ niệm: ' + err.message)
    router.push('/')
  } finally {
    loading.value = false
  }
}

// Format date
function displayDate(dateString: string) {
  const d = dayjs(dateString)
  return `${d.date()} thg ${d.month() + 1}, ${d.year()}`
}

function handleBack() {
  router.push('/')
}

onMounted(() => {
  fetchEventDetails(route.params.id as string)
})

// Watch for route param ID changes (when clicking prev/next)
watch(
  () => route.params.id,
  (newId) => {
    if (newId) fetchEventDetails(newId as string)
  }
)
</script>

<template>
  <div class="min-h-screen bg-surface-1 dark:bg-[#121013] text-gray-800 dark:text-gray-100 pb-16 transition-colors duration-300">
    <ThemeToggle />

    <!-- Centered mobile screen frame -->
    <div class="max-w-[430px] mx-auto min-h-screen bg-surface-2 dark:bg-[#1C1A1D] border-x border-border shadow-sm flex flex-col p-5">
      
      <!-- Back Header -->
      <button 
        @click="handleBack"
        class="flex items-center gap-2 mb-4 text-text-secondary hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer text-[13px] self-start"
      >
        <i class="ti ti-arrow-left text-lg"></i>
        <span>Quay lại dòng thời gian</span>
      </button>

      <!-- Loading State -->
      <div v-if="loading" class="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <i class="ti ti-loader animate-spin text-2xl text-[#D4537E]"></i>
        <p class="text-xs text-text-muted">Đang tải kỷ niệm...</p>
      </div>

      <!-- Content -->
      <div v-else-if="eventDetail" class="flex-1 flex flex-col justify-between">
        
        <div>
          <!-- Image Carousel (Swiper.js) -->
          <div 
            v-if="eventImages.length > 0"
            class="w-full aspect-video sm:aspect-square bg-surface-1 dark:bg-[#121013] rounded-2xl overflow-hidden border border-border mb-4 relative"
          >
            <swiper
              :modules="swiperModules"
              :pagination="{ clickable: true }"
              class="w-full h-full"
            >
              <swiper-slide v-for="img in eventImages" :key="img.id">
                <img :src="img.image_url" class="w-full h-full object-cover" alt="Hình kỷ niệm" />
              </swiper-slide>
            </swiper>
          </div>

          <!-- Fallback image box if empty -->
          <div 
            v-else
            class="w-full h-44 rounded-2xl bg-surface-1 dark:bg-[#121013] border border-border flex items-center justify-center mb-4 text-text-muted"
          >
            <i class="ti ti-photo text-3xl"></i>
          </div>

          <!-- Milestone details -->
          <div class="mt-2 space-y-3">
            <span 
              v-if="eventDetail.is_special"
              class="inline-block px-3 py-1 rounded-full text-[10px] font-semibold bg-[#4B1528] text-[#F4C0D1] tracking-wider uppercase"
            >
              Cột mốc đặc biệt
            </span>

            <h1 class="font-serif text-xl font-medium text-gray-900 dark:text-gray-100">
              {{ eventDetail.title }}
            </h1>

            <p class="text-xs text-text-muted">
              {{ displayDate(eventDetail.event_date) }}
            </p>

            <p class="text-sm leading-relaxed text-gray-700 dark:text-gray-300 pt-2 whitespace-pre-line">
              {{ eventDetail.description }}
            </p>
          </div>
        </div>

        <!-- Prev / Next Milestones Navigation -->
        <footer class="mt-8 pt-4 border-t border-border flex items-center justify-between text-xs font-medium">
          <!-- Left: Prev milestone -->
          <RouterLink 
            v-if="prevEvent"
            :to="`/timeline/${prevEvent.id}`"
            class="flex items-center gap-1 text-text-muted hover:text-gray-900 dark:hover:text-gray-100 max-w-[45%] truncate text-left"
          >
            <i class="ti ti-chevron-left text-sm flex-shrink-0"></i>
            <span class="truncate">{{ prevEvent.title }}</span>
          </RouterLink>
          <div v-else class="text-[10px] text-text-muted/40">Đầu dòng thời gian</div>

          <!-- Right: Next milestone -->
          <RouterLink 
            v-if="nextEvent"
            :to="`/timeline/${nextEvent.id}`"
            class="flex items-center gap-1 text-[#D4537E] hover:text-[#b03a61] max-w-[45%] truncate text-right justify-end ml-auto"
          >
            <span class="truncate">{{ nextEvent.title }}</span>
            <i class="ti ti-chevron-right text-sm flex-shrink-0"></i>
          </RouterLink>
          <div v-else class="text-[10px] text-text-muted/40 text-right">Cuối dòng thời gian</div>
        </footer>

      </div>

    </div>
  </div>
</template>

<style>
/* Style adjustments for Swiper pagination bullets */
.swiper-pagination-bullet-active {
  background: #D4537E !important;
}
.swiper-pagination-bullet {
  background: rgba(255, 255, 255, 0.7);
}
</style>
