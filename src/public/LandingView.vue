<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
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

const loadingMore = ref(false)
const hasMore = ref(true)
const currentPage = ref(0)
const pageSize = 8
const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// Tab states
const activeTab = ref<'timeline' | 'bucket' | 'challenges'>('timeline')

// Mood states
const partnerAMood = ref<{ mood_emoji: string; mood_note: string } | null>(null)
const partnerBMood = ref<{ mood_emoji: string; mood_note: string } | null>(null)
const userCheckedInToday = ref(false)
const showMoodModal = ref(false)
const selectedEmoji = ref('❤️')
const moodNote = ref('')
const submittingMood = ref(false)
const emojisList = ['❤️', '🌸', '🥰', '🥺', '😄', '😴', '😢', '💼']

// Love Quote states
const activeQuote = ref('')
const showQuoteModal = ref(false)
const quotes = ref<string[]>([])

// Bucket List states
interface BucketItem {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'planning' | 'completed'
  completed_at: string | null
  linked_event_id: string | null
}
const bucketList = ref<BucketItem[]>([])
const loadingBucket = ref(false)

// Love Challenges states
interface LoveChallenge {
  id: string
  title: string
  description: string
  partner_a_completed: boolean
  partner_b_completed: boolean
  reward_text: string | null
  reward_image_url: string | null
  created_at: string
}
const loveChallenges = ref<LoveChallenge[]>([])
const loadingChallenges = ref(false)

// Fetch mood check-ins for today
async function fetchMoods() {
  try {
    const todayStr = dayjs().format('YYYY-MM-DD')
    const { data, error } = await supabase
      .from('mood_tracker')
      .select('profile_id, mood_emoji, mood_note, check_in_date, profiles(role, display_name)')
      .eq('check_in_date', todayStr)
    
    if (error) throw error
    
    partnerAMood.value = null
    partnerBMood.value = null
    userCheckedInToday.value = false
    
    if (data) {
      data.forEach((m: any) => {
        const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
        if (profile) {
          if (profile.role === 'admin') {
            // Quang Huy
            partnerBMood.value = { mood_emoji: m.mood_emoji, mood_note: m.mood_note }
          } else {
            // Diệu Thiện
            partnerAMood.value = { mood_emoji: m.mood_emoji, mood_note: m.mood_note }
          }
        }
        if (m.profile_id === authStore.user?.id) {
          userCheckedInToday.value = true
        }
      })
    }
  } catch (err) {
    console.error('Error fetching moods:', err)
  }
}

async function checkInMood() {
  if (submittingMood.value) return
  submittingMood.value = true
  try {
    const todayStr = dayjs().format('YYYY-MM-DD')
    const { error } = await supabase
      .from('mood_tracker')
      .upsert({
        profile_id: authStore.user?.id,
        mood_emoji: selectedEmoji.value,
        mood_note: moodNote.value.trim() || null,
        check_in_date: todayStr
      })
    
    if (error) throw error
    toast.success('Đã lưu tâm trạng của bạn hôm nay! ❤️')
    showMoodModal.value = false
    await fetchMoods()
  } catch (err: any) {
    toast.error('Lỗi khi lưu tâm trạng: ' + err.message)
  } finally {
    submittingMood.value = false
  }
}

// Fetch love quotes
async function fetchQuotes() {
  try {
    const { data, error } = await supabase
      .from('love_quotes')
      .select('content')
    
    if (error) throw error
    if (data) {
      quotes.value = data.map((q: any) => q.content)
    }
  } catch (err) {
    console.error('Error fetching love quotes:', err)
  }
}

function openFortuneCookie() {
  if (quotes.value.length === 0) {
    activeQuote.value = 'Hôm nay anh nhớ em nhiều hơn hôm qua. ❤️'
  } else {
    const randIdx = Math.floor(Math.random() * quotes.value.length)
    activeQuote.value = quotes.value[randIdx]
  }
  showQuoteModal.value = true
}

// Fetch bucket list
async function fetchBucketList() {
  loadingBucket.value = true
  try {
    const { data, error } = await supabase
      .from('bucket_list')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    bucketList.value = data || []
  } catch (err: any) {
    console.error('Error fetching bucket list:', err)
  } finally {
    loadingBucket.value = false
  }
}

async function toggleBucketStatus(item: BucketItem) {
  const nextStatus = item.status === 'completed' ? 'pending' : 'completed'
  const completedAt = nextStatus === 'completed' ? dayjs().format('YYYY-MM-DD') : null
  
  try {
    const { error } = await supabase
      .from('bucket_list')
      .update({ status: nextStatus, completed_at: completedAt })
      .eq('id', item.id)
    
    if (error) throw error
    item.status = nextStatus
    item.completed_at = completedAt
    toast.success(nextStatus === 'completed' ? 'Đã hoàn thành nguyện vọng này! 🎉' : 'Đã đưa nguyện vọng về trạng thái chờ.')
  } catch (err: any) {
    toast.error('Lỗi khi cập nhật nguyện vọng: ' + err.message)
  }
}

// Fetch love challenges
async function fetchChallenges() {
  loadingChallenges.value = true
  try {
    const { data, error } = await supabase
      .from('love_challenges')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    loveChallenges.value = data || []
  } catch (err: any) {
    console.error('Error fetching challenges:', err)
  } finally {
    loadingChallenges.value = false
  }
}

async function toggleChallengeStatus(challenge: LoveChallenge) {
  const isPartnerA = authStore.role === 'partner'
  const updates: any = {}
  if (isPartnerA) {
    updates.partner_a_completed = !challenge.partner_a_completed
  } else {
    updates.partner_b_completed = !challenge.partner_b_completed
  }
  
  try {
    const { error } = await supabase
      .from('love_challenges')
      .update(updates)
      .eq('id', challenge.id)
    
    if (error) throw error
    
    if (isPartnerA) {
      challenge.partner_a_completed = !challenge.partner_a_completed
    } else {
      challenge.partner_b_completed = !challenge.partner_b_completed
    }
    
    if (challenge.partner_a_completed && challenge.partner_b_completed) {
      toast.success('Mở khóa thành công! Cả hai bạn đều đã hoàn thành thử thách! 🎁')
    } else {
      toast.success('Đã cập nhật tiến trình thử thách của bạn!')
    }
  } catch (err: any) {
    toast.error('Lỗi khi cập nhật thử thách: ' + err.message)
  }
}

// Fetch settings and first page of timeline events
async function loadLandingData() {
  loading.value = true
  hasMore.value = true
  currentPage.value = 0
  timelineEvents.value = []
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
    await fetchTimeline(true)

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

// Fetch timeline events with range-based pagination
async function fetchTimeline(isInitial = true) {
  if (isInitial) {
    currentPage.value = 0
    timelineEvents.value = []
    hasMore.value = true
  } else {
    loadingMore.value = true
  }

  const from = currentPage.value * pageSize
  const to = from + pageSize - 1

  try {
    const { data: eventsData, error: eventsError } = await supabase
      .from('timeline_events')
      .select('*, timeline_images(image_url)')
      .order('sort_order', { ascending: true })
      .range(from, to)

    if (eventsError) throw eventsError

    if (eventsData) {
      if (isInitial) {
        timelineEvents.value = eventsData
      } else {
        timelineEvents.value = [...timelineEvents.value, ...eventsData]
      }
      if (eventsData.length < pageSize) {
        hasMore.value = false
      }
    } else {
      hasMore.value = false
    }
  } catch (err: any) {
    toast.error('Lỗi khi tải dòng thời gian: ' + err.message)
  } finally {
    if (!isInitial) {
      loadingMore.value = false
    }
  }
}

async function loadMoreEvents() {
  if (loadingMore.value || !hasMore.value) return
  currentPage.value++
  await fetchTimeline(false)
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
  fetchMoods()
  fetchQuotes()
  fetchBucketList()
  fetchChallenges()

  // Setup observer for scroll loading
  observer = new IntersectionObserver((entries) => {
    const target = entries[0]
    if (target.isIntersecting && hasMore.value && !loading.value && !loadingMore.value && activeTab.value === 'timeline') {
      loadMoreEvents()
    }
  }, {
    rootMargin: '100px'
  })

  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value)
  }
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
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

        <!-- Mood Tracker Section -->
        <section class="mt-4 bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-[20px] p-4 flex flex-col items-center shadow-sm gap-3">
          <div class="flex items-center justify-between w-full border-b border-border pb-2 px-1">
            <span class="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1">
              <i class="ti ti-mood-smile text-[#D4537E]"></i>
              <span>Cảm xúc của hai ta hôm nay</span>
            </span>
            <button 
              @click="showMoodModal = true"
              class="text-[10px] font-bold text-[#D4537E] hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <i class="ti ti-heart-pulse animate-pulse"></i>
              <span>{{ userCheckedInToday ? 'Cập nhật' : 'Check-in tâm trạng' }}</span>
            </button>
          </div>
          
          <div class="flex w-full justify-around gap-2 pt-1">
            <!-- Partner A Mood -->
            <div class="flex flex-col items-center w-[45%] text-center">
              <div class="flex items-center gap-1.5 justify-center">
                <div class="w-6 h-6 rounded-full overflow-hidden bg-[#ED93B1] flex-shrink-0 border border-white/20">
                  <img v-if="settings?.partner_a_avatar_url" :src="settings.partner_a_avatar_url" class="w-full h-full object-cover" />
                  <i v-else class="ti ti-user text-xs text-white"></i>
                </div>
                <span class="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[80px]">
                  {{ settings?.partner_a_name || 'Diệu Thiện' }}
                </span>
              </div>
              <div class="mt-2 p-2 bg-[#FDF2F8] dark:bg-rosewood-950/20 border border-romantic-200/10 rounded-xl w-full flex flex-col items-center justify-center min-h-[50px]">
                <span class="text-xl leading-none select-none">{{ partnerAMood?.mood_emoji || '❔' }}</span>
                <span class="text-[9px] text-text-muted mt-1 truncate w-full" :title="partnerAMood?.mood_note || 'Chưa cập nhật'">
                  {{ partnerAMood?.mood_note || 'Chưa cập nhật' }}
                </span>
              </div>
            </div>

            <!-- Heart separator -->
            <div class="flex items-center justify-center text-[#D4537E] text-xs">
              <i class="ti ti-heart-handshake text-lg"></i>
            </div>

            <!-- Partner B Mood -->
            <div class="flex flex-col items-center w-[45%] text-center">
              <div class="flex items-center gap-1.5 justify-center">
                <div class="w-6 h-6 rounded-full overflow-hidden bg-[#F0997B] flex-shrink-0 border border-white/20">
                  <img v-if="settings?.partner_b_avatar_url" :src="settings.partner_b_avatar_url" class="w-full h-full object-cover" />
                  <i v-else class="ti ti-user text-xs text-white"></i>
                </div>
                <span class="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[80px]">
                  {{ settings?.partner_b_name || 'Quang Huy' }}
                </span>
              </div>
              <div class="mt-2 p-2 bg-[#E3EFFD] dark:bg-blue-950/10 border border-blue-200/10 rounded-xl w-full flex flex-col items-center justify-center min-h-[50px]">
                <span class="text-xl leading-none select-none">{{ partnerBMood?.mood_emoji || '❔' }}</span>
                <span class="text-[9px] text-text-muted mt-1 truncate w-full" :title="partnerBMood?.mood_note || 'Chưa cập nhật'">
                  {{ partnerBMood?.mood_note || 'Chưa cập nhật' }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Fortune Cookie Widget -->
        <section 
          @click="openFortuneCookie"
          class="mt-4 bg-gradient-to-r from-[#FBEAF0] to-[#FAF5F7] dark:from-rosewood-950/20 dark:to-neutral-900/35 border border-romantic-200/20 dark:border-rosewood-900/20 rounded-[20px] p-4 flex items-center justify-between shadow-sm cursor-pointer hover:shadow-md transition group select-none"
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl animate-bounce">🥠</span>
            <div>
              <p class="text-xs font-bold text-[#993556] dark:text-[#F4C0D1]">Thông điệp yêu thương hàng ngày</p>
              <p class="text-[10px] text-text-secondary">Chạm để mở bánh may mắn và nhận lời nhắn...</p>
            </div>
          </div>
          <i class="ti ti-chevron-right text-sm text-[#993556] dark:text-[#F4C0D1] group-hover:translate-x-0.5 transition"></i>
        </section>

        <!-- Tabbed Content Section -->
        <section class="mt-6">
          <!-- Tab Navigation Headers -->
          <div class="flex border-b border-border mb-5">
            <button 
              @click="activeTab = 'timeline'"
              class="flex-1 pb-2.5 text-xs font-semibold border-b-2 text-center transition cursor-pointer"
              :class="activeTab === 'timeline' 
                ? 'border-[#D4537E] text-[#D4537E]' 
                : 'border-transparent text-text-secondary hover:text-gray-900 dark:hover:text-gray-100'"
            >
              🕒 Dòng thời gian
            </button>
            <button 
              @click="activeTab = 'bucket'"
              class="flex-1 pb-2.5 text-xs font-semibold border-b-2 text-center transition cursor-pointer"
              :class="activeTab === 'bucket' 
                ? 'border-[#D4537E] text-[#D4537E]' 
                : 'border-transparent text-text-secondary hover:text-gray-900 dark:hover:text-gray-100'"
            >
              📌 Nguyện vọng
            </button>
            <button 
              @click="activeTab = 'challenges'"
              class="flex-1 pb-2.5 text-xs font-semibold border-b-2 text-center transition cursor-pointer"
              :class="activeTab === 'challenges' 
                ? 'border-[#D4537E] text-[#D4537E]' 
                : 'border-transparent text-text-secondary hover:text-gray-900 dark:hover:text-gray-100'"
            >
              ⚔️ Thử thách đôi
            </button>
          </div>

          <!-- Tab Content: Timeline -->
          <div v-if="activeTab === 'timeline'">
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

            <!-- Load More Trigger & Loading indicator -->
            <div 
              ref="loadMoreTrigger" 
              class="py-6 flex flex-col justify-center items-center gap-2 select-none"
            >
              <template v-if="loadingMore">
                <i class="ti ti-loader animate-spin text-lg text-[#D4537E]"></i>
                <span class="text-xs text-text-muted">Đang mở thêm kỷ niệm...</span>
              </template>
              <template v-else-if="!hasMore && timelineEvents.length > 0">
                <span class="text-[10px] text-text-muted italic">Mỗi khoảnh khắc bên em đều là kỷ niệm vô giá... ❤️</span>
              </template>
            </div>
          </div>

          <!-- Tab Content: Bucket List -->
          <div v-else-if="activeTab === 'bucket'" class="space-y-4">
            <div v-if="loadingBucket" class="flex flex-col items-center justify-center py-12 gap-2">
              <i class="ti ti-loader animate-spin text-xl text-[#D4537E]"></i>
              <p class="text-[10px] text-text-muted">Đang tải bảng nguyện vọng...</p>
            </div>
            
            <div v-else-if="bucketList.length === 0" class="text-center py-10 bg-surface-1 dark:bg-[#1D1A1F]/20 rounded-2xl border border-border">
              <i class="ti ti-target text-2xl text-text-muted mb-2"></i>
              <p class="text-xs text-text-muted">Chưa có điều nguyện vọng nào.</p>
              <p class="text-[10px] text-text-secondary mt-1">Hãy đăng nhập Admin để thêm danh sách nhé!</p>
            </div>
            
            <div v-else class="space-y-3">
              <div 
                v-for="item in bucketList" 
                :key="item.id"
                class="border border-border rounded-xl p-4 bg-surface-2 dark:bg-[#1D1A1F]/30 flex items-start gap-3 transition hover:shadow-sm"
              >
                <!-- Toggle check checkbox -->
                <button 
                  @click="toggleBucketStatus(item)"
                  class="w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer transition flex-shrink-0 mt-0.5"
                  :class="item.status === 'completed' 
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' 
                    : 'border-border-strong hover:border-[#D4537E] dark:hover:border-romantic-400'"
                >
                  <i v-if="item.status === 'completed'" class="ti ti-check text-xs"></i>
                </button>
                
                <div class="flex-1 min-w-0">
                  <p 
                    class="text-xs font-semibold text-gray-900 dark:text-gray-100"
                    :class="item.status === 'completed' ? 'line-through text-text-muted' : ''"
                  >
                    {{ item.title }}
                  </p>
                  <p 
                    v-if="item.description" 
                    class="text-[10px] text-text-muted mt-1 leading-relaxed"
                  >
                    {{ item.description }}
                  </p>
                  <div class="flex flex-wrap items-center gap-2 mt-2 select-none">
                    <span 
                      class="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase"
                      :class="item.status === 'completed' 
                        ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400' 
                        : item.status === 'planning'
                          ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400'
                          : 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-400'"
                    >
                      {{ item.status === 'completed' ? 'Đã hoàn thành' : item.status === 'planning' ? 'Đang lập kế hoạch' : 'Đang chờ' }}
                    </span>
                    
                    <span v-if="item.completed_at" class="text-[8px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Xong ngày: {{ item.completed_at }}
                    </span>
                    
                    <!-- Link to Timeline event -->
                    <RouterLink 
                      v-if="item.linked_event_id" 
                      :to="`/timeline/${item.linked_event_id}`"
                      class="text-[8px] text-[#D4537E] hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <i class="ti ti-link"></i>
                      <span>Xem kỷ niệm</span>
                    </RouterLink>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab Content: Challenges -->
          <div v-else-if="activeTab === 'challenges'" class="space-y-4">
            <div v-if="loadingChallenges" class="flex flex-col items-center justify-center py-12 gap-2">
              <i class="ti ti-loader animate-spin text-xl text-[#D4537E]"></i>
              <p class="text-[10px] text-text-muted">Đang tải thử thách...</p>
            </div>
            
            <div v-else-if="loveChallenges.length === 0" class="text-center py-10 bg-surface-1 dark:bg-[#1D1A1F]/20 rounded-2xl border border-border">
              <i class="ti ti-swords text-2xl text-text-muted mb-2"></i>
              <p class="text-xs text-text-muted">Chưa có thử thách tuần nào.</p>
              <p class="text-[10px] text-text-secondary mt-1">Hãy truy cập Admin để tạo nhé!</p>
            </div>
            
            <div v-else class="space-y-4">
              <div 
                v-for="challenge in loveChallenges" 
                :key="challenge.id"
                class="border border-border rounded-xl p-4 bg-surface-2 dark:bg-[#1D1A1F]/30 flex flex-col gap-3 transition hover:shadow-sm"
              >
                <div>
                  <h4 class="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <i class="ti ti-swords text-[#D4537E]"></i>
                    <span>{{ challenge.title }}</span>
                  </h4>
                  <p class="text-[10px] text-text-secondary mt-1 leading-relaxed">
                    {{ challenge.description }}
                  </p>
                </div>
                
                <!-- Completion trackers -->
                <div class="grid grid-cols-2 gap-3 py-1 border-t border-b border-border-strong/10">
                  <!-- Partner A Completion -->
                  <div class="flex items-center gap-2">
                    <button 
                      @click="authStore.role === 'partner' ? toggleChallengeStatus(challenge) : null"
                      :disabled="authStore.role !== 'partner'"
                      class="w-5 h-5 rounded border flex items-center justify-center transition flex-shrink-0"
                      :class="[
                        challenge.partner_a_completed 
                          ? 'bg-romantic-100 border-romantic-300 text-[#993556] dark:bg-rosewood-950/30 dark:text-[#F4C0D1]' 
                          : 'border-border-strong dark:border-white/10',
                        authStore.role === 'partner' ? 'cursor-pointer hover:border-[#D4537E]' : 'cursor-default opacity-85'
                      ]"
                    >
                      <i v-if="challenge.partner_a_completed" class="ti ti-check text-xs"></i>
                    </button>
                    <span class="text-[9px] font-semibold text-text-secondary truncate">
                      {{ settings?.partner_a_name || 'Diệu Thiện' }}: 
                      <span :class="challenge.partner_a_completed ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-text-muted font-normal'">
                        {{ challenge.partner_a_completed ? 'Hoàn thành' : 'Chưa xong' }}
                      </span>
                    </span>
                  </div>

                  <!-- Partner B Completion -->
                  <div class="flex items-center gap-2">
                    <button 
                      @click="authStore.role === 'admin' ? toggleChallengeStatus(challenge) : null"
                      :disabled="authStore.role !== 'admin'"
                      class="w-5 h-5 rounded border flex items-center justify-center transition flex-shrink-0"
                      :class="[
                        challenge.partner_b_completed 
                          ? 'bg-[#E3EFFD] border-blue-300 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' 
                          : 'border-border-strong dark:border-white/10',
                        authStore.role === 'admin' ? 'cursor-pointer hover:border-blue-400' : 'cursor-default opacity-85'
                      ]"
                    >
                      <i v-if="challenge.partner_b_completed" class="ti ti-check text-xs"></i>
                    </button>
                    <span class="text-[9px] font-semibold text-text-secondary truncate">
                      {{ settings?.partner_b_name || 'Quang Huy' }}: 
                      <span :class="challenge.partner_b_completed ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-text-muted font-normal'">
                        {{ challenge.partner_b_completed ? 'Hoàn thành' : 'Chưa xong' }}
                      </span>
                    </span>
                  </div>
                </div>
                
                <!-- Surprise Reward Section (locked unless both completed) -->
                <div class="p-3.5 bg-surface-1 dark:bg-[#1D1A1F]/50 border border-dashed rounded-xl flex items-center justify-center text-center relative overflow-hidden">
                  <!-- Locked overlay -->
                  <div 
                    v-if="!challenge.partner_a_completed || !challenge.partner_b_completed"
                    class="absolute inset-0 bg-[#FDFBF7]/95 dark:bg-[#1F1C18]/95 backdrop-blur-[0.5px] flex items-center justify-center gap-1.5 text-[10px] font-bold text-text-secondary select-none"
                  >
                    <i class="ti ti-lock text-xs text-[#D4537E]"></i>
                    <span>Cần cả hai hoàn thành để xem quà tặng</span>
                  </div>
                  
                  <!-- Unlocked Reward contents -->
                  <div class="space-y-1.5">
                    <span class="text-lg">🎁</span>
                    <p class="text-[11px] font-serif font-bold text-[#993556] dark:text-[#F4C0D1] uppercase tracking-wide">
                      Phần thưởng bất ngờ đã được mở khóa!
                    </p>
                    <p class="text-[10px] text-gray-800 dark:text-gray-200 italic leading-relaxed">
                      {{ challenge.reward_text || 'Món quà bất ngờ từ đối phương.' }}
                    </p>
                    <!-- Reward Image (if exists) -->
                    <div v-if="challenge.reward_image_url" class="mt-2 rounded-lg overflow-hidden max-h-32 border border-border">
                      <img :src="challenge.reward_image_url" class="w-full h-full object-cover" alt="Món quà kỷ niệm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

    </div>

    <!-- Mood Tracker Modal -->
    <transition name="fade">
      <div 
        v-if="showMoodModal"
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showMoodModal = false"
      >
        <div class="w-full max-w-[320px] bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 rounded-3xl p-5 shadow-2xl space-y-4 text-[#4B2F15] dark:text-[#E2CBB2]">
          <h3 class="text-xs font-bold uppercase tracking-wider text-center border-b border-[#EBE6DC] dark:border-[#2C2924] pb-2 text-[#4B2F15] dark:text-[#E2CBB2]">
            Hôm nay cảm xúc thế nào?
          </h3>
          
          <!-- Emoji Grid selection -->
          <div class="grid grid-cols-4 gap-2.5">
            <button 
              v-for="emoji in emojisList" 
              :key="emoji"
              @click="selectedEmoji = emoji"
              class="w-12 h-12 rounded-xl text-xl flex items-center justify-center border cursor-pointer transition duration-150"
              :class="selectedEmoji === emoji 
                ? 'bg-[#FBEAF0] border-[#D4537E] dark:bg-rosewood-950/20 dark:border-romantic-400' 
                : 'border-[#EBE6DC] dark:border-transparent bg-[#F6F2E9] dark:bg-[#282420] hover:bg-[#EBE6DC] dark:hover:bg-[#322C27] text-[#4B2F15] dark:text-[#E2CBB2]'"
            >
              {{ emoji }}
            </button>
          </div>
          
          <!-- Quick Note -->
          <div>
            <label class="text-[10px] text-text-secondary block mb-1">Ghi chú ngắn (nhớ anh/em, mệt mỏi...)</label>
            <input 
              v-model="moodNote"
              type="text"
              placeholder="Hôm nay mình..."
              class="w-full text-xs p-2.5 bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent rounded-xl text-[#4B2F15] dark:text-[#E2CBB2] focus:outline-none"
              maxlength="40"
              :disabled="submittingMood"
            />
          </div>
          
          <!-- Actions -->
          <div class="flex gap-2 pt-2">
            <button 
              @click="showMoodModal = false"
              class="flex-1 bg-[#EFECE6] dark:bg-[#2C2924] text-xs font-semibold py-2 rounded-xl border border-transparent cursor-pointer text-[#4B2F15] dark:text-[#E2CBB2] hover:bg-[#E3DFD7] transition"
            >
              Hủy
            </button>
            <button 
              @click="checkInMood"
              :disabled="submittingMood"
              class="flex-1 bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs font-semibold py-2 rounded-xl shadow-lg shadow-romantic-500/10 cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <i v-if="submittingMood" class="ti ti-loader animate-spin"></i>
              <span>Lưu lại</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Fortune Cookie Quote Modal -->
    <transition name="fade">
      <div 
        v-if="showQuoteModal"
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showQuoteModal = false"
      >
        <div class="w-full max-w-[280px] bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 rounded-3xl p-5 shadow-2xl text-center space-y-4 text-[#4B2F15] dark:text-[#E2CBB2]">
          <div class="space-y-1.5 mt-2">
            <span class="text-3xl">🥠</span>
            <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Thông điệp cho bạn
            </h3>
            <div class="h-[0.5px] bg-[#EAE6DD] dark:bg-[#2C2924] w-12 mx-auto my-2"></div>
            <p class="font-serif text-xs italic leading-relaxed py-2 text-justify">
              "{{ activeQuote }}"
            </p>
          </div>
          
          <button 
            @click="showQuoteModal = false"
            class="w-full bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs font-semibold py-2 rounded-xl shadow-lg cursor-pointer transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </transition>

    <!-- Navigation Bar -->
    <Navbar />
  </div>
</template>
