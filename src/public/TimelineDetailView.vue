<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/auth'
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
const authStore = useAuthStore()

const eventDetail = ref<TimelineEvent | null>(null)
const eventImages = ref<ImageItem[]>([])
const loading = ref(true)

// Custom Confirm Modal state
const showConfirmModal = ref(false)
const confirmModalTitle = ref('')
const confirmModalMessage = ref('')
const confirmModalAction = ref<(() => Promise<void>) | null>(null)

function openConfirmModal(title: string, message: string, action: () => Promise<void>) {
  confirmModalTitle.value = title
  confirmModalMessage.value = message
  confirmModalAction.value = action
  showConfirmModal.value = true
}

async function triggerConfirmModalAction() {
  if (confirmModalAction.value) {
    try {
      await confirmModalAction.value()
    } catch (err) {
      console.error(err)
    }
  }
  showConfirmModal.value = false
}

interface Comment {
  id: string
  timeline_event_id: string
  profile_id: string
  content: string
  created_at: string
  profiles: {
    display_name: string
    role: string
  } | null
}

const comments = ref<Comment[]>([])
const loadingComments = ref(false)
const newComment = ref('')
const submittingComment = ref(false)

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

    // Fetch comments
    await fetchComments(eventId)

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

async function fetchComments(eventId: string) {
  loadingComments.value = true
  try {
    const { data, error } = await supabase
      .from('timeline_comments')
      .select('id, timeline_event_id, profile_id, content, created_at, profiles(display_name, role)')
      .eq('timeline_event_id', eventId)
      .order('created_at', { ascending: true })

    if (error) throw error
    
    // Normalize profiles relation from array to single object if needed
    comments.value = (data || []).map((c: any) => ({
      ...c,
      profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
    }))
  } catch (err: any) {
    console.error('Lỗi khi tải bình luận:', err.message)
  } finally {
    loadingComments.value = false
  }
}

async function sendComment() {
  if (!newComment.value.trim() || !eventDetail.value) return
  submittingComment.value = true

  try {
    const { data, error } = await supabase
      .from('timeline_comments')
      .insert([{
        timeline_event_id: eventDetail.value.id,
        profile_id: authStore.user?.id,
        content: newComment.value.trim()
      }])
      .select('id, timeline_event_id, profile_id, content, created_at, profiles(display_name, role)')
      .single()

    if (error) throw error

    const normalized = {
      ...data,
      profiles: Array.isArray((data as any).profiles) ? (data as any).profiles[0] : (data as any).profiles
    }
    comments.value.push(normalized)
    newComment.value = ''
    toast.success('Gửi bình luận thành công!')
  } catch (err: any) {
    toast.error('Lỗi khi gửi bình luận: ' + err.message)
  } finally {
    submittingComment.value = false
  }
}

function deleteComment(commentId: string) {
  openConfirmModal(
    'Xóa bình luận',
    'Bạn có chắc chắn muốn xóa bình luận này không?',
    async () => {
      try {
        const { error } = await supabase
          .from('timeline_comments')
          .delete()
          .eq('id', commentId)

        if (error) throw error
        comments.value = comments.value.filter(c => c.id !== commentId)
        toast.success('Đã xóa bình luận!')
      } catch (err: any) {
        toast.error('Lỗi khi xóa bình luận: ' + err.message)
      }
    }
  )
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

        <!-- Comments section -->
        <div class="mt-6 pt-5 border-t border-border text-left">
          <h3 class="text-xs font-bold uppercase tracking-wider mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-1.5 select-none">
            <i class="ti ti-messages"></i>
            <span>Bình luận kỷ niệm</span>
          </h3>

          <!-- Comments list -->
          <div v-if="loadingComments" class="flex justify-center py-4">
            <i class="ti ti-loader animate-spin text-lg text-[#D4537E]"></i>
          </div>
          <div v-else-if="comments.length === 0" class="text-center py-4 text-[11px] text-text-muted italic select-none">
            Chưa có bình luận nào cho kỷ niệm này. Hãy viết cảm xúc của hai bạn nhé!
          </div>
          <div v-else class="space-y-3 mb-4 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
            <div 
              v-for="c in comments" 
              :key="c.id"
              class="bg-[#F6F2E9] dark:bg-[#282420]/40 border border-[#EBE6DC] dark:border-transparent p-2.5 rounded-2xl relative group"
            >
              <!-- Author & Date -->
              <div class="flex items-center justify-between gap-2 mb-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-[11px] font-bold text-gray-800 dark:text-gray-200">
                    {{ c.profiles?.display_name || 'Người dùng' }}
                  </span>
                  <!-- Cute Role Badge -->
                  <span 
                    class="text-[8px] px-1 rounded font-semibold select-none"
                    :class="c.profiles?.role === 'admin' 
                      ? 'bg-[#E3EFFD] text-[#1E40AF]' 
                      : 'bg-[#FDF2F8] text-[#9D174D]'"
                  >
                    {{ c.profiles?.role === 'admin' ? 'Anh ❤️' : 'Em 🌸' }}
                  </span>
                </div>
                
                <!-- Delete button -->
                <button 
                  v-if="c.profile_id === authStore.user?.id || authStore.role === 'admin' || authStore.user?.email === 'quanghuy@love.com'"
                  @click.stop="deleteComment(c.id)"
                  class="text-[10px] text-red-500 opacity-80 hover:opacity-100 cursor-pointer p-1"
                  title="Xóa bình luận"
                >
                  <i class="ti ti-trash"></i>
                </button>
              </div>

              <!-- Content -->
              <p class="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {{ c.content }}
              </p>
              <p class="text-[8px] text-gray-400 mt-1 select-none text-right">
                {{ displayDate(c.created_at) }}
              </p>
            </div>
          </div>

          <!-- Input form -->
          <div class="flex gap-2 mt-4 items-end">
            <textarea 
              v-model="newComment"
              rows="1"
              placeholder="Viết cảm nghĩ của bạn..."
              class="flex-1 text-xs p-2.5 bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent rounded-xl focus:outline-none resize-none font-sans text-gray-800 dark:text-gray-200 leading-snug"
              @keyup.enter.prevent="sendComment"
              :disabled="submittingComment"
            ></textarea>
            <button 
              @click="sendComment"
              class="bg-[#D4537E] hover:bg-[#c2436d] text-white p-2 rounded-xl flex items-center justify-center cursor-pointer transition disabled:opacity-50 h-8 w-8"
              :disabled="submittingComment || !newComment.trim()"
            >
              <i v-if="submittingComment" class="ti ti-loader animate-spin text-sm"></i>
              <i v-else class="ti ti-send text-sm"></i>
            </button>
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

      <!-- Custom Popup Confirm Modal -->
      <transition name="fade">
        <div 
          v-if="showConfirmModal"
          class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          @click.self="showConfirmModal = false"
        >
          <div class="w-full max-w-[280px] bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 rounded-3xl p-5 shadow-2xl text-center space-y-4 text-[#4B2F15] dark:text-[#E2CBB2]">
            <div class="space-y-1.5">
              <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">
                {{ confirmModalTitle }}
              </h3>
              <p class="text-xs text-text-secondary leading-relaxed">
                {{ confirmModalMessage }}
              </p>
            </div>
            <div class="flex gap-2">
              <button 
                type="button"
                @click="showConfirmModal = false"
                class="flex-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold py-2 rounded-xl border border-[#EBE6DC] dark:border-transparent cursor-pointer transition text-gray-800 dark:text-gray-200"
              >
                Hủy
              </button>
              <button 
                type="button"
                @click="triggerConfirmModalAction"
                class="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-2 rounded-xl shadow-lg cursor-pointer transition"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      </transition>

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
