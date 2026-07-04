<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/auth'
import Navbar from '../components/Navbar.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { toast } from 'vue-sonner'
import dayjs from 'dayjs'

interface Letter {
  id: string
  title: string
  content: string
  tag: string
  status: string
  unlock_date: string | null
  cover_image_url: string | null
  created_at: string
}

const authStore = useAuthStore()

const letters = ref<Letter[]>([])
const loading = ref(true)
const selectedTag = ref('Tất cả')

// Active letter for modal popup
const activeLetter = ref<Letter | null>(null)
const isOpening = ref(false)

// Fetch letters from the secure view
async function loadLetters() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('secure_letters')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    letters.value = data || []
  } catch (err: any) {
    toast.error('Lỗi khi tải thư: ' + err.message)
  } finally {
    loading.value = false
  }
}

// Check if a letter is locked
function isLocked(letter: Letter) {
  if (authStore.role === 'admin') return false // admin sees everything
  if (!letter.unlock_date) return false
  return dayjs(letter.unlock_date).isAfter(dayjs())
}

// Format date to: 14 thg 3, 2025
function formatDate(dateString: string) {
  const d = dayjs(dateString)
  return `${d.date()} thg ${d.month() + 1}, ${d.year()}`
}

function formatUnlockDate(dateString: string) {
  const d = dayjs(dateString)
  return `${d.date()}/${d.month() + 1}/${d.year()}`
}

// Open letter details
function openLetter(letter: Letter) {
  if (isLocked(letter)) {
    toast.error(`Thư đang khóa. Hãy đợi đến ngày ${formatUnlockDate(letter.unlock_date!)} nhé! 🔐`)
    return
  }
  
  isOpening.value = true
  activeLetter.value = letter
}

function closeLetter() {
  isOpening.value = false
  activeLetter.value = null
}

// Extract unique tags for chip scrolling
const tagsList = computed(() => {
  const list = new Set<string>()
  letters.value.forEach(l => {
    if (l.tag) list.add(l.tag)
  })
  return ['Tất cả', ...Array.from(list)]
})

// Filtered letters based on tag chip selection
const filteredLetters = computed(() => {
  if (selectedTag.value === 'Tất cả') return letters.value
  return letters.value.filter(l => l.tag === selectedTag.value)
})

onMounted(() => {
  loadLetters()
})
</script>

<template>
  <div class="min-h-screen bg-surface-1 dark:bg-[#121013] text-gray-800 dark:text-gray-100 pb-24 transition-colors duration-300">
    <ThemeToggle />

    <!-- Container viewport wrapper -->
    <div class="max-w-[430px] mx-auto min-h-screen bg-surface-2 dark:bg-[#1C1A1D] border-x border-border shadow-sm flex flex-col p-5">
      
      <!-- Header -->
      <header class="mb-5 mt-2">
        <h2 class="text-base font-bold font-serif text-gray-900 dark:text-gray-100">Những lá thư</h2>
        <p class="text-xs text-text-secondary">Những điều anh muốn nói với em</p>
      </header>

      <!-- Horizontal chip tags scroll -->
      <div class="flex gap-2 mb-5 overflow-x-auto no-scrollbar flex-shrink-0">
        <button 
          v-for="t in tagsList" 
          :key="t"
          @click="selectedTag = t"
          class="text-xs px-3.5 py-1.5 rounded-full whitespace-nowrap cursor-pointer transition border border-border"
          :class="selectedTag === t 
            ? 'bg-[#FBEAF0] dark:bg-rosewood-950/40 text-[#993556] dark:text-[#F4C0D1] border-romantic-200/10' 
            : 'bg-surface-1 text-text-secondary hover:bg-black/5 dark:hover:bg-white/5'"
        >
          {{ t }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <i class="ti ti-loader animate-spin text-2xl text-[#D4537E]"></i>
        <p class="text-xs text-text-muted">Đang tìm các lá thư...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredLetters.length === 0" class="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <i class="ti ti-mail-opened text-3xl text-text-muted mb-2"></i>
        <p class="text-xs text-text-muted">Chưa có lá thư nào ở mục này.</p>
      </div>

      <!-- Letters list -->
      <div v-else class="flex-1 space-y-3">
        
        <div 
          v-for="letter in filteredLetters" 
          :key="letter.id"
          @click="openLetter(letter)"
          class="border border-border rounded-xl p-3.5 flex items-center gap-3.5 transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
          :class="isLocked(letter) 
            ? 'opacity-55 bg-surface-1 dark:bg-[#1D1A1F]/15' 
            : 'bg-surface-2 dark:bg-[#1D1A1F]/30 hover:shadow-sm'"
        >
          <!-- Left Icon badge -->
          <div 
            class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner"
            :class="isLocked(letter) 
              ? 'bg-black/5 dark:bg-white/5 text-text-muted' 
              : 'bg-[#FBEAF0] dark:bg-rosewood-950/40 text-[#993556] dark:text-[#F4C0D1]'"
          >
            <i v-if="isLocked(letter)" class="ti ti-lock text-base"></i>
            <i v-else class="ti ti-mail-heart text-xl"></i>
          </div>

          <!-- Mid Info -->
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
              {{ isLocked(letter) ? 'Thư bí mật' : letter.title }}
            </p>
            <p class="text-[10px] text-text-muted mt-1 select-none">
              <span v-if="isLocked(letter)">Sẽ mở vào {{ formatUnlockDate(letter.unlock_date!) }}</span>
              <span v-else>{{ letter.tag }} &middot; {{ formatDate(letter.created_at) }}</span>
            </p>
          </div>

          <!-- Arrow -->
          <i v-if="!isLocked(letter)" class="ti ti-chevron-right text-sm text-text-muted"></i>
        </div>

      </div>

    </div>

    <!-- Letter Reading Modal (Handwritten overlay style) -->
    <transition name="fade">
      <div 
        v-if="activeLetter"
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="closeLetter"
      >
        <transition name="scale">
          <div 
            class="w-full max-w-[360px] bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 rounded-3xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col justify-between overflow-y-auto text-[#4B2F15] dark:text-[#E2CBB2]"
          >
            <!-- Close button -->
            <button 
              @click="closeLetter"
              class="absolute top-4 right-4 w-7 h-7 rounded-full bg-[#EFECE6] dark:bg-[#2C2924] hover:bg-[#E3DFD7] text-[#4B2F15] dark:text-[#E2CBB2] flex items-center justify-center cursor-pointer transition text-xs"
            >
              <i class="ti ti-x"></i>
            </button>

            <!-- Letter Body -->
            <div class="flex-1">
              <!-- Cover image if set -->
              <div 
                v-if="activeLetter.cover_image_url"
                class="w-full aspect-square rounded-xl bg-[#EFECE6] dark:bg-[#121013] overflow-hidden mb-4 border border-[#E3DFD7] dark:border-transparent shadow-inner"
              >
                <img :src="activeLetter.cover_image_url" class="w-full h-full object-cover" alt="Bìa thư" />
              </div>

              <!-- Header info -->
              <div class="border-b border-[#EAE6DD] dark:border-[#2C2924] pb-3 mb-4 mt-2">
                <span class="px-2 py-0.5 bg-[#FAF3E5] dark:bg-[#2D281E] border border-[#E3DFD7] dark:border-transparent text-[10px] uppercase font-bold tracking-wider rounded-md">
                  {{ activeLetter.tag }}
                </span>
                <h2 class="font-serif text-lg font-bold mt-2 leading-snug">
                  {{ activeLetter.title }}
                </h2>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1 select-none">
                  Ngày gửi: {{ formatDate(activeLetter.created_at) }}
                </p>
              </div>

              <!-- Content body -->
              <p class="font-serif text-[13px] leading-relaxed whitespace-pre-line text-justify italic">
                {{ activeLetter.content }}
              </p>
            </div>

            <!-- Footer signature -->
            <div class="mt-6 pt-4 border-t border-[#EAE6DD] dark:border-[#2C2924] text-right font-serif text-[11px] text-gray-500 dark:text-gray-400">
              Yêu em thật nhiều, Quang Huy ❤️
            </div>

          </div>
        </transition>
      </div>
    </transition>

    <Navbar />
  </div>
</template>

<style scoped>
/* Transitive styles for modal popups */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.scale-enter-active, .scale-leave-active {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}
.scale-enter-from, .scale-leave-to {
  transform: scale(0.92);
  opacity: 0;
}
</style>
