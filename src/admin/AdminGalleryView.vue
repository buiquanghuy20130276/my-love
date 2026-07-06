<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '../lib/supabaseClient'
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
const uploading = ref(false)
const progress = ref(0)
const loadingMore = ref(false)
const hasMore = ref(true)
const currentPage = ref(0)
const pageSize = 12
const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// Form fields
const title = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

// Fetch media items with range-based pagination
async function fetchMediaItems(isInitial = true) {
  if (isInitial) {
    loading.value = true
    currentPage.value = 0
    mediaItems.value = []
    hasMore.value = true
  } else {
    loadingMore.value = true
  }

  const from = currentPage.value * pageSize
  const to = from + pageSize - 1

  try {
    const { data, error } = await supabase
      .from('gallery_media')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    if (data) {
      if (isInitial) {
        mediaItems.value = data
      } else {
        mediaItems.value = [...mediaItems.value, ...data]
      }
      if (data.length < pageSize) {
        hasMore.value = false
      }
    } else {
      hasMore.value = false
    }
  } catch (err: any) {
    toast.error('Lỗi khi tải album ảnh: ' + err.message)
  } finally {
    if (isInitial) {
      loading.value = false
    } else {
      loadingMore.value = false
    }
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  currentPage.value++
  await fetchMediaItems(false)
}

import { compressImage } from '../lib/imageCompressor'

// Client-side video thumbnail generation
function generateVideoThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = URL.createObjectURL(file)

    video.onloadeddata = () => {
      // Seek to 1 second
      video.currentTime = 1
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src)
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Video thumbnail returned null blob'))
          }
        }, 'image/webp', 0.7)
      } catch (err) {
        reject(err)
      }
    }

    video.onerror = (err) => reject(err)
  })
}

// Upload file & Save to database
async function handleUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploading.value = true
  progress.value = 10
  
  try {
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image'
    let finalBlob: Blob = file
    let thumbnailBlob: Blob | null = null

    // 1. Optimize File on Client Side
    if (mediaType === 'image') {
      progress.value = 25
      toast.info('Đang tối ưu hóa dung lượng hình ảnh...')
      finalBlob = await compressImage(file)
    } else if (mediaType === 'video') {
      progress.value = 25
      toast.info('Đang chụp ảnh đại diện từ video...')
      try {
        thumbnailBlob = await generateVideoThumbnail(file)
      } catch (thumbErr) {
        console.warn('Could not generate video thumbnail:', thumbErr)
      }
    }

    progress.value = 45
    // 2. Upload file to Supabase Storage
    const fileExt = mediaType === 'image' ? 'webp' : file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `gallery/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('gallery-media')
      .upload(filePath, finalBlob)

    if (uploadError) throw uploadError

    const { data: mediaUrlData } = supabase.storage
      .from('gallery-media')
      .getPublicUrl(filePath)

    progress.value = 75

    // 3. Upload Thumbnail if exists
    let thumbnailUrl: string | null = null
    if (thumbnailBlob) {
      const thumbFileName = `gallery/thumb-${Date.now()}-${Math.random().toString(36).substring(2)}.webp`
      const { error: thumbUploadError } = await supabase.storage
        .from('gallery-media')
        .upload(thumbFileName, thumbnailBlob)

      if (!thumbUploadError) {
        const { data: thumbUrlData } = supabase.storage
          .from('gallery-media')
          .getPublicUrl(thumbFileName)
        thumbnailUrl = thumbUrlData.publicUrl
      }
    }

    progress.value = 90

    // 4. Save record to Database
    const { error: dbError } = await supabase
      .from('gallery_media')
      .insert([{
        title: title.value || null,
        media_url: mediaUrlData.publicUrl,
        media_type: mediaType,
        thumbnail_url: thumbnailUrl
      }])

    if (dbError) throw dbError

    progress.value = 100
    toast.success('Đã tải và lưu trữ đa phương tiện thành công!')
    title.value = ''
    if (fileInput.value) fileInput.value.value = ''
    fetchMediaItems()
  } catch (err: any) {
    toast.error('Lỗi khi tải lên: ' + err.message)
  } finally {
    uploading.value = false
    progress.value = 0
  }
}

// Delete media
async function deleteMedia(item: MediaItem) {
  const confirmDelete = confirm(`Bạn có chắc chắn muốn xóa mục này không?`)
  if (!confirmDelete) return

  try {
    // 1. Delete from database
    const { error: dbError } = await supabase
      .from('gallery_media')
      .delete()
      .eq('id', item.id)

    if (dbError) throw dbError

    // 2. Extract path from URL to delete from Storage
    // Example url: https://.../storage/v1/object/public/gallery-media/gallery/filename.webp
    const urlParts = item.media_url.split('/gallery-media/')
    if (urlParts.length >= 2) {
      const filePath = urlParts[1]
      await supabase.storage.from('gallery-media').remove([filePath])
    }

    if (item.thumbnail_url) {
      const thumbParts = item.thumbnail_url.split('/gallery-media/')
      if (thumbParts.length >= 2) {
        const thumbPath = thumbParts[1]
        await supabase.storage.from('gallery-media').remove([thumbPath])
      }
    }

    toast.success('Đã xóa mục kỷ niệm thành công!')
    fetchMediaItems()
  } catch (err: any) {
    toast.error('Lỗi khi xóa mục kỷ niệm: ' + err.message)
  }
}

// Direct download helper
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
      toast.success('Tải xuống thành công!')
    })
    .catch(err => {
      toast.error('Lỗi khi tải xuống: ' + err.message)
    })
}

const editingId = ref<string | null>(null)
const editingTitle = ref('')
const savingEdit = ref(false)

// Custom directive to auto-focus inputs
const vFocus = {
  mounted: (el: HTMLElement) => el.focus()
}

function startEdit(item: MediaItem) {
  editingId.value = item.id
  editingTitle.value = item.title || ''
}

async function saveEdit(item: MediaItem) {
  if (savingEdit.value) return
  if (editingTitle.value.trim() === (item.title || '')) {
    editingId.value = null
    return
  }

  savingEdit.value = true
  try {
    const nextTitle = editingTitle.value.trim() || null
    const { error } = await supabase
      .from('gallery_media')
      .update({ title: nextTitle })
      .eq('id', item.id)

    if (error) throw error
    item.title = nextTitle
    toast.success('Đã cập nhật tiêu đề kỷ niệm!')
    editingId.value = null
  } catch (err: any) {
    toast.error('Lỗi khi cập nhật tiêu đề: ' + err.message)
  } finally {
    savingEdit.value = false
  }
}

onMounted(() => {
  fetchMediaItems()

  // Setup observer for scroll loading
  observer = new IntersectionObserver((entries) => {
    const target = entries[0]
    if (target.isIntersecting && hasMore.value && !loading.value && !loadingMore.value) {
      loadMore()
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
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-bold font-serif">Quản lý Ảnh & Video</h2>
      <p class="text-xs text-text-muted">Tải lên và nén tự động các đa phương tiện lưu trữ khoảnh khắc</p>
    </div>

    <!-- Upload Box -->
    <div class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-5 mb-6">
      <h3 class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4 ml-1">
        Tải lên Ảnh hoặc Video mới
      </h3>

      <div class="space-y-4">
        <!-- Title input -->
        <div>
          <label class="text-xs text-text-secondary block mb-1.5 ml-1">Tên/Tiêu đề mô tả (Không bắt buộc)</label>
          <input 
            v-model="title"
            type="text"
            placeholder="Mô tả ngắn khoảnh khắc này..."
            class="w-full"
            :disabled="uploading"
          />
        </div>

        <!-- File Pick & Progress -->
        <div class="flex flex-col sm:flex-row items-center gap-4">
          <div class="flex-1 w-full">
            <input 
              type="file" 
              accept="image/*,video/*" 
              id="gallery-file-picker" 
              class="hidden" 
              ref="fileInput"
              @change="handleUpload"
              :disabled="uploading"
            />
            <label 
              for="gallery-file-picker"
              class="w-full py-4 border border-dashed border-border-strong rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-text-muted hover:text-romantic-500 transition duration-150"
              :class="{'opacity-50 pointer-events-none': uploading}"
            >
              <i class="ti ti-cloud-upload text-2xl"></i>
              <span class="text-xs font-semibold">CHỌN ẢNH HOẶC VIDEO ĐỂ TẢI LÊN</span>
              <span class="text-[10px] text-text-muted">Ảnh sẽ được tự động nén WebP để tiết kiệm dung lượng</span>
            </label>
          </div>
        </div>

        <!-- Progress meter -->
        <div v-if="uploading" class="space-y-1.5 ml-1">
          <div class="flex justify-between text-[11px] font-semibold text-romantic-600">
            <span>Đang xử lý và tải tệp tin lên...</span>
            <span>{{ progress }}%</span>
          </div>
          <div class="w-full bg-surface-1 rounded-full h-2 overflow-hidden border border-border">
            <div class="bg-[#D4537E] h-full transition-all duration-300" :style="{ width: `${progress}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Media Grid List -->
    <div class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-4 md:p-6">
      <h3 class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4 ml-1">
        Album Lưu Trữ
      </h3>

      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
        <i class="ti ti-loader animate-spin text-2xl text-romantic-500"></i>
        <p class="text-xs text-text-muted">Đang tải danh sách album...</p>
      </div>

      <!-- Empty -->
      <div v-else-if="mediaItems.length === 0" class="text-center py-12">
        <i class="ti ti-photo-off text-3xl text-text-muted mb-2"></i>
        <p class="text-xs text-text-muted">Album hiện tại đang trống.</p>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <div 
          v-for="item in mediaItems" 
          :key="item.id"
          class="group bg-surface-1 dark:bg-[#1D1A1F]/50 border border-border rounded-xl overflow-hidden relative flex flex-col justify-between"
        >
          <!-- Media Preview (Image or Video Thumbnail) -->
          <div class="aspect-square bg-[#121013] overflow-hidden relative flex items-center justify-center">
            
            <!-- Video Thumbnail frame -->
            <template v-if="item.media_type === 'video'">
              <img 
                v-if="item.thumbnail_url" 
                :src="item.thumbnail_url" 
                class="w-full h-full object-cover" 
              />
              <!-- Play icon overlay -->
              <div class="absolute inset-0 flex items-center justify-center bg-black/30">
                <i class="ti ti-player-play-filled text-2xl text-white drop-shadow"></i>
              </div>
            </template>

            <!-- Image preview -->
            <template v-else>
              <img :src="item.media_url" class="w-full h-full object-cover" />
            </template>

            <!-- Delete trigger -->
            <button 
              @click="deleteMedia(item)"
              class="absolute top-1.5 right-1.5 w-6.5 h-6.5 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center cursor-pointer transition text-xs opacity-80 md:opacity-0 md:group-hover:opacity-100"
              title="Xóa mục này"
            >
              <i class="ti ti-trash"></i>
            </button>
          </div>

          <!-- Bottom description / Download action -->
          <div class="p-2.5 flex flex-col justify-between flex-1">
            <!-- Inline Title Editor -->
            <div v-if="editingId === item.id" class="flex items-center gap-1 mb-1">
              <input 
                v-model="editingTitle"
                @keyup.enter="saveEdit(item)"
                @keyup.esc="editingId = null"
                @blur="saveEdit(item)"
                class="text-[11px] px-1 py-0.5 border border-[#D4537E] rounded bg-white dark:bg-[#1C1A1D] w-full focus:outline-none"
                v-focus
              />
            </div>
            <div v-else class="flex items-center justify-between gap-1 mb-1">
              <p class="text-[11px] font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                {{ item.title || 'Không có tên mô tả' }}
              </p>
              <button 
                @click="startEdit(item)"
                class="text-[10px] text-text-muted hover:text-[#D4537E] cursor-pointer"
                title="Sửa tiêu đề"
              >
                <i class="ti ti-pencil"></i>
              </button>
            </div>
            
            <div class="flex justify-between items-center mt-auto">
              <span class="text-[9px] uppercase font-bold text-text-muted">
                {{ item.media_type === 'image' ? 'Hình ảnh' : 'Video' }}
              </span>
              <button 
                @click="downloadFile(item.media_url, `k kỷ-niệm-${item.id}.${item.media_type === 'image' ? 'webp' : 'mp4'}`)"
                class="text-[11px] text-[#D4537E] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <i class="ti ti-download"></i>
                <span>Tải xuống</span>
              </button>
            </div>
          </div>

        </div>

        <!-- Load More Trigger & Loading indicator -->
        <div 
          ref="loadMoreTrigger" 
          class="py-6 flex flex-col justify-center items-center gap-2 select-none"
        >
          <template v-if="loadingMore">
            <i class="ti ti-loader animate-spin text-lg text-[#D4537E]"></i>
            <span class="text-xs text-text-muted">Đang tải thêm hình ảnh/video...</span>
          </template>
          <template v-else-if="!hasMore && mediaItems.length > 0">
            <span class="text-xs text-text-muted italic">Đã tải toàn bộ hình ảnh và video trong kho lưu trữ.</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
