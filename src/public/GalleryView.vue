<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient'
import Navbar from '../components/Navbar.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { toast } from 'vue-sonner'

interface MediaItem {
  id: string
  title: string | null
  media_url: string
  media_type: 'image' | 'video'
  thumbnail_url: string | null
  created_at: string
}

const mediaItems = ref<MediaItem[]>([])
const loading = ref(true)

// Lightbox state
const activeMedia = ref<MediaItem | null>(null)

// Fetch all media
async function loadGallery() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('gallery_media')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    mediaItems.value = data || []
  } catch (err: any) {
    toast.error('Lỗi khi tải bộ sưu tập: ' + err.message)
  } finally {
    loading.value = false
  }
}

// Download file helper (directly fetches file as blob)
function downloadFile(url: string, filename: string) {
  toast.info('Đang chuẩn bị tải xuống...')
  fetch(url)
    .then(resp => resp.blob())
    .then(blob => {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Đã tải xuống thành công!')
    })
    .catch(err => {
      toast.error('Lỗi tải tệp tin: ' + err.message)
    })
}

onMounted(() => {
  loadGallery()
})
</script>

<template>
  <div class="min-h-screen bg-surface-1 dark:bg-[#121013] text-gray-800 dark:text-gray-100 pb-24 transition-colors duration-300">
    <ThemeToggle />
    
    <!-- Centered mobile viewport frame -->
    <div class="max-w-[430px] mx-auto min-h-screen bg-surface-2 dark:bg-[#1C1A1D] border-x border-border shadow-sm flex flex-col">
      
      <!-- Header -->
      <header class="p-5 border-b border-border flex-shrink-0">
        <h2 class="text-base font-bold font-serif text-gray-900 dark:text-gray-100">Kho lưu trữ kỷ niệm</h2>
        <p class="text-xs text-text-secondary">Những thước phim, bức ảnh chụp lại từng khoảnh khắc ngọt ngào</p>
      </header>

      <!-- Loading State -->
      <div v-if="loading" class="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <i class="ti ti-loader animate-spin text-2xl text-[#D4537E]"></i>
        <p class="text-xs text-text-muted">Đang mở tủ ảnh kỷ niệm...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="mediaItems.length === 0" class="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <i class="ti ti-photo-heart text-4xl text-text-muted mb-3"></i>
        <p class="text-xs text-text-muted leading-relaxed">
          Hiện tại album ảnh đang trống. Hãy chờ anh ấy đăng thêm ảnh và video mới nhé! 📸
        </p>
      </div>

      <!-- Gallery Grid -->
      <div v-else class="flex-1 overflow-y-auto p-4">
        <div class="grid grid-cols-2 gap-3 pb-8">
          
          <div 
            v-for="item in mediaItems" 
            :key="item.id"
            @click="activeMedia = item"
            class="group bg-surface-1 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl overflow-hidden cursor-pointer relative hover:shadow-sm hover:-translate-y-0.5 transition duration-200"
          >
            <!-- Media Preview Thumbnail (Square aspect ratio) -->
            <div class="aspect-square bg-[#121013] relative overflow-hidden flex items-center justify-center">
              
              <!-- Video preview frame -->
              <template v-if="item.media_type === 'video'">
                <img 
                  v-if="item.thumbnail_url" 
                  :src="item.thumbnail_url" 
                  class="w-full h-full object-cover" 
                />
                <!-- Play overlay -->
                <div class="absolute inset-0 flex items-center justify-center bg-black/25">
                  <div class="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white">
                    <i class="ti ti-player-play-filled text-base"></i>
                  </div>
                </div>
              </template>

              <!-- Image preview -->
              <template v-else>
                <img :src="item.media_url" class="w-full h-full object-cover" />
              </template>

            </div>

            <!-- Card footer -->
            <div class="p-2 flex flex-col justify-between">
              <p class="text-[11px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                {{ item.title || 'Khoảnh khắc ngọt ngào' }}
              </p>
              <div class="flex justify-between items-center mt-1 text-[9px] uppercase font-bold text-text-muted">
                <span>{{ item.media_type === 'image' ? 'Ảnh' : 'Video' }}</span>
                <i class="ti ti-eye text-xs"></i>
              </div>
            </div>

          </div>

        </div>
      </div>

    </div>

    <!-- Media Lightbox Modal -->
    <transition name="fade">
      <div 
        v-if="activeMedia"
        class="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4"
        @click.self="activeMedia = null"
      >
        <!-- Top bar actions -->
        <header class="flex justify-between items-center text-white pt-2 px-2 z-10">
          <p class="text-xs font-semibold max-w-[70%] truncate">
            {{ activeMedia.title || 'Khoảnh khắc kỷ niệm' }}
          </p>
          <div class="flex items-center gap-3">
            <button 
              @click="downloadFile(activeMedia.media_url, `kỷ-niệm-${activeMedia.id}.${activeMedia.media_type === 'image' ? 'webp' : 'mp4'}`)"
              class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition text-lg"
              title="Tải tệp này xuống"
            >
              <i class="ti ti-download"></i>
            </button>
            <button 
              @click="activeMedia = null"
              class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition text-lg"
            >
              <i class="ti ti-x"></i>
            </button>
          </div>
        </header>

        <!-- Media Display (Centered) -->
        <div class="flex-1 flex items-center justify-center p-2 z-0">
          <!-- Video Player -->
          <video 
            v-if="activeMedia.media_type === 'video'" 
            :src="activeMedia.media_url" 
            class="max-w-full max-h-[70vh] rounded-2xl border border-white/10 shadow-2xl"
            controls 
            autoplay 
            loop
          ></video>

          <!-- Image Display -->
          <img 
            v-else 
            :src="activeMedia.media_url" 
            class="max-w-full max-h-[70vh] object-contain rounded-2xl border border-white/10 shadow-2xl" 
            alt="Kỷ niệm"
          />
        </div>

        <!-- Footer -->
        <footer class="text-center text-[10px] text-white/50 pb-2">
          {{ activeMedia.media_type === 'image' ? 'Ảnh đã được tối ưu hóa chất lượng cao WebP' : 'Video phát trực tiếp chất lượng cao' }}
        </footer>

      </div>
    </transition>

    <Navbar />
  </div>
</template>

<style scoped>
/* Modal transition fade effects */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
