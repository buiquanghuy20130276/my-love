<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/auth'
import Navbar from '../components/Navbar.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import dayjs from 'dayjs'
import { gsap } from 'gsap'
import { toast } from 'vue-sonner'

interface Setting {
  relationship_start_date: string
  theme_color: string
  theme_mode_default: string
  partner_a_name: string
  partner_a_avatar_url: string | null
  partner_b_name: string
  partner_b_avatar_url: string | null
  cover_image_url: string | null
  next_special_date: string | null
  next_special_label: string | null
}

interface TimelineEvent {
  id: string
  title: string
  description: string
  event_date: string
  is_special: boolean
  sort_order: number
  timeline_images: { image_url: string }[]
}

const authStore = useAuthStore()
const router = useRouter()

const settings = ref<Setting | null>(null)
const timelineEvents = ref<TimelineEvent[]>([])
const loading = ref(true)

// Days calculation and animation
const animatedDays = ref(0)
const actualDays = ref(0)

const formattedStartDate = computed(() => {
  if (!settings.value) return ''
  return dayjs(settings.value.relationship_start_date).format('DD/MM/YYYY')
})

const countdownLabel = computed(() => {
  if (!settings.value || !settings.value.next_special_date) return ''
  const nextDate = dayjs(settings.value.next_special_date)
  const today = dayjs().startOf('day')
  const diff = nextDate.diff(today, 'day')
  
  if (diff < 0) return null
  if (diff === 0) return `Hôm nay là ${settings.value.next_special_label}!`
  return `Còn ${diff} ngày đến ${settings.value.next_special_label}`
})

// Fetch settings and events
async function loadLandingData() {
  loading.value = true
  try {
    // 1. Fetch settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError
    settings.value = settingsData

    // 2. Fetch timeline
    const { data: eventsData, error: eventsError } = await supabase
      .from('timeline_events')
      .select('*, timeline_images(image_url)')
      .order('sort_order', { ascending: true })

    if (eventsError) throw eventsError
    timelineEvents.value = eventsData || []

    // 3. Compute and animate days
    if (settings.value) {
      const start = dayjs(settings.value.relationship_start_date)
      const today = dayjs().startOf('day')
      actualDays.value = today.diff(start, 'day')

      gsap.to(animatedDays, {
        duration: 1.8,
        value: actualDays.value,
        roundProps: 'value',
        ease: 'power3.out'
      })
    }
  } catch (err: any) {
    toast.error('Lỗi khi tải dữ liệu: ' + err.message)
  } finally {
    loading.value = false
  }
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

// Utility to display Vietnamese formatted dates
function displayEventDate(dateString: string) {
  const d = dayjs(dateString)
  return `${d.date()} thg ${d.month() + 1}, ${d.year()}`
}

onMounted(() => {
  loadLandingData()
})
</script>

<template>
  <div class="min-h-screen bg-surface-1 dark:bg-[#121013] text-gray-800 dark:text-gray-100 pb-24 transition-colors duration-300">
    <ThemeToggle />

    <!-- Container wrapper - Emulate mobile viewport on larger screens -->
    <div class="max-w-[430px] mx-auto min-h-screen bg-surface-2 dark:bg-[#1C1A1D] border-x border-border shadow-sm flex flex-col">
      
      <!-- Top banner / Cover Image -->
      <header class="w-full relative h-40 bg-pink-100 dark:bg-rosewood-950 overflow-hidden flex-shrink-0">
        <img 
          v-if="settings?.cover_image_url"
          :src="settings.cover_image_url"
          class="w-full h-full object-cover"
          alt="Bìa kỉ niệm"
        />
        <!-- Gradient overlay -->
        <div class="absolute inset-0 bg-gradient-to-t from-surface-2 dark:from-[#1C1A1D] to-transparent"></div>
        
        <!-- Header tools -->
        <div class="absolute top-4 left-4 z-10 flex gap-2">
          <!-- Admin shortcut -->
          <RouterLink 
            v-if="authStore.role === 'admin'"
            to="/admin" 
            class="bg-black/50 hover:bg-black/65 backdrop-blur-sm text-white text-[11px] font-semibold py-1.5 px-3 rounded-full flex items-center gap-1 transition"
          >
            <i class="ti ti-settings"></i>
            <span>Quản trị</span>
          </RouterLink>
          
          <button 
            @click="handleLogout" 
            class="bg-black/50 hover:bg-black/65 backdrop-blur-sm text-white text-[11px] font-semibold py-1.5 px-3 rounded-full flex items-center gap-1 transition cursor-pointer"
          >
            <i class="ti ti-logout"></i>
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      <!-- Main Contents -->
      <div v-if="loading" class="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <i class="ti ti-loader animate-spin text-2xl text-[#D4537E]"></i>
        <p class="text-xs text-text-muted">Đang tải câu chuyện của chúng ta...</p>
      </div>

      <div v-else class="flex-1 px-4 pb-10">
        
        <!-- Day Counter Section -->
        <section class="mt-[-28px] relative z-20 bg-[#FBEAF0] dark:bg-rosewood-950/70 border border-romantic-200/20 dark:border-rosewood-900/30 rounded-[20px] p-6 text-center shadow-sm">
          <p class="text-xs text-[#993556] dark:text-[#F4C0D1] mb-3.5 tracking-wide">Chúng ta đã bên nhau được</p>

          <div class="flex items-center justify-center gap-4">
            <!-- Partner A -->
            <div class="flex flex-col items-center w-14">
              <div class="w-12 h-12 rounded-full bg-[#ED93B1] border-2 border-white/80 dark:border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                <img v-if="settings?.partner_a_avatar_url" :src="settings.partner_a_avatar_url" class="w-full h-full object-cover" />
                <i v-else class="ti ti-user text-xl text-[#4B1528]"></i>
              </div>
              <p class="text-[10px] text-[#72243E] dark:text-[#F4C0D1] mt-2 font-medium truncate w-full text-center leading-tight">
                {{ settings?.partner_a_name || 'Diệu Thiện' }}
              </p>
            </div>

            <!-- Number Counter -->
            <p class="font-serif text-[40px] font-medium text-[#4B1528] dark:text-[#F4C0D1] leading-none select-none tracking-tight">
              {{ animatedDays }}
            </p>

            <!-- Partner B -->
            <div class="flex flex-col items-center w-14">
              <div class="w-12 h-12 rounded-full bg-[#F0997B] border-2 border-white/80 dark:border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                <img v-if="settings?.partner_b_avatar_url" :src="settings.partner_b_avatar_url" class="w-full h-full object-cover" />
                <i v-else class="ti ti-user text-xl text-[#4A1B0C]"></i>
              </div>
              <p class="text-[10px] text-[#72243E] dark:text-[#F4C0D1] mt-2 font-medium truncate w-full text-center leading-tight">
                {{ settings?.partner_b_name || 'Quang Huy' }}
              </p>
            </div>
          </div>

          <p class="text-xs text-[#993556] dark:text-[#F4C0D1] mt-3 font-medium">ngày</p>
          <p class="text-[10px] text-[#72243E] dark:text-romantic-300 mt-1 select-none">
            Bắt đầu từ {{ formattedStartDate }}
          </p>

          <!-- Countdown block -->
          <div 
            v-if="countdownLabel"
            class="mt-4 inline-flex items-center gap-1.5 bg-white/60 dark:bg-[#1D1A1F]/50 px-3.5 py-1.5 rounded-full border border-white/30 dark:border-white/5"
          >
            <i class="ti ti-calendar-heart text-[13px] text-[#993556] dark:text-[#F4C0D1]"></i>
            <span class="text-[11px] text-[#72243E] dark:text-[#F4C0D1] font-medium">{{ countdownLabel }}</span>
          </div>
        </section>

        <!-- Timeline Section -->
        <section class="mt-8">
          <h2 class="text-base font-medium mb-5 px-1 font-serif text-gray-900 dark:text-gray-100">
            Dòng thời gian tình yêu
          </h2>

          <div v-if="timelineEvents.length === 0" class="text-center py-10 bg-surface-1 dark:bg-[#1D1A1F]/20 rounded-2xl border border-border">
            <i class="ti ti-photo text-2xl text-text-muted mb-2"></i>
            <p class="text-xs text-text-muted">Chưa có mốc thời gian nào được tạo.</p>
          </div>

          <!-- Vertical Timeline list -->
          <div v-else class="relative pl-6 space-y-8 before:absolute before:left-[10px] before:top-2 before:bottom-2 before:w-[0.5px] before:bg-border-strong">
            
            <div 
              v-for="event in timelineEvents" 
              :key="event.id"
              class="relative"
            >
              <!-- Marker Point -->
              <span 
                class="absolute left-[-21px] top-1.5 w-2.5 h-2.5 rounded-full border border-surface-2 dark:border-[#1C1A1D] z-10"
                :class="event.is_special ? 'bg-[#D4537E]' : 'bg-border-strong'"
              ></span>

              <!-- Event Card -->
              <RouterLink 
                :to="`/timeline/${event.id}`"
                class="block rounded-2xl border border-border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                :class="event.is_special ? 'bg-[#FBEAF0] dark:bg-rosewood-950/20 border-romantic-200/40 dark:border-rosewood-900/30' : 'bg-surface-2 dark:bg-[#1D1A1F]/30'"
              >
                <!-- Thumbnail if images exist -->
                <div 
                  v-if="event.timeline_images && event.timeline_images.length > 0"
                  class="w-full aspect-square rounded-xl bg-surface-1 dark:bg-[#121013] overflow-hidden mb-3 border border-border"
                >
                  <img 
                    :src="event.timeline_images[0].image_url" 
                    class="w-full h-full object-cover" 
                    alt="Ảnh kỉ niệm"
                  />
                </div>

                <!-- Fallback empty photo box if no image and marked special -->
                <div 
                  v-else-if="event.is_special"
                  class="w-full h-24 rounded-xl bg-romantic-100/30 dark:bg-rosewood-950/10 flex items-center justify-center mb-3 border border-dashed border-romantic-300/30"
                >
                  <i class="ti ti-photo text-lg text-romantic-400"></i>
                </div>

                <!-- Text info -->
                <p class="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                  {{ event.title }}
                </p>
                <p class="text-[11px] text-text-muted mt-0.5 select-none">
                  {{ displayEventDate(event.event_date) }}
                </p>
              </RouterLink>
            </div>

          </div>
        </section>

      </div>

    </div>

    <!-- Navigation Bar -->
    <Navbar />
  </div>
</template>
