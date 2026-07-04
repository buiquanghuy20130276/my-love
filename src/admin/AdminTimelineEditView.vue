<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'vue-sonner'

interface ImageItem {
  id: string
  image_url: string
  isNew?: boolean
  isDeleted?: boolean
}

const route = useRoute()
const router = useRouter()

const isEditMode = computed(() => !!route.params.id)
const id = computed(() => route.params.id as string)

const title = ref('')
const eventDate = ref('')
const description = ref('')
const isSpecial = ref(false)
const images = ref<ImageItem[]>([])
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)

// Keep track of images to delete from Database
const imageIdsToDelete = ref<string[]>([])

// Fetch event details
async function fetchEventDetails() {
  if (!isEditMode.value) return
  loading.value = true
  try {
    // 1. Fetch Event
    const { data: eventData, error: eventError } = await supabase
      .from('timeline_events')
      .select('*')
      .eq('id', id.value)
      .single()

    if (eventError) throw eventError

    if (eventData) {
      title.value = eventData.title
      eventDate.value = eventData.event_date
      description.value = eventData.description
      isSpecial.value = eventData.is_special
    }

    // 2. Fetch linked images
    const { data: imageData, error: imageError } = await supabase
      .from('timeline_images')
      .select('id, image_url')
      .eq('timeline_event_id', id.value)
      .order('sort_order', { ascending: true })

    if (imageError) throw imageError
    images.value = imageData || []

  } catch (err: any) {
    toast.error('Lỗi khi tải thông tin sự kiện: ' + err.message)
    router.push('/admin/timeline')
  } finally {
    loading.value = false
  }
}

import { compressImage } from '../lib/imageCompressor'

// Upload multi images to Storage
async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  uploading.value = true
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      toast.info(`Đang tối ưu hóa ảnh ${i + 1}/${files.length}...`)
      const compressedBlob = await compressImage(file)
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.webp`
      const filePath = `events/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('timeline-images')
        .upload(filePath, compressedBlob)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('timeline-images')
        .getPublicUrl(filePath)

      images.value.push({
        id: `temp-${Date.now()}-${Math.random()}`,
        image_url: data.publicUrl,
        isNew: true
      })
    }
    toast.success('Đã nén và thêm ảnh vào danh sách!')
  } catch (err: any) {
    toast.error('Lỗi khi tải ảnh lên: ' + err.message)
  } finally {
    uploading.value = false
  }
}

// Remove image from list
function removeImage(imageItem: ImageItem) {
  if (imageItem.isNew) {
    // If not saved to DB yet, just filter it out
    images.value = images.value.filter(img => img.id !== imageItem.id)
  } else {
    // Mark for deletion on save
    imageIdsToDelete.value.push(imageItem.id)
    images.value = images.value.filter(img => img.id !== imageItem.id)
  }
}

// Save event & sync images
async function saveEvent() {
  if (!title.value || !eventDate.value || !description.value) {
    toast.error('Vui lòng điền đầy đủ tiêu đề, ngày và mô tả.')
    return
  }

  saving.value = true

  const eventPayload = {
    title: title.value,
    event_date: eventDate.value,
    description: description.value,
    is_special: isSpecial.value
  }

  try {
    let eventId = id.value

    if (isEditMode.value) {
      // 1. Update event details
      const { error } = await supabase
        .from('timeline_events')
        .update(eventPayload)
        .eq('id', id.value)

      if (error) throw error
    } else {
      // 1. Insert new event details
      // Get current max sort_order
      const { data: maxOrderData } = await supabase
        .from('timeline_events')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)

      const nextSortOrder = maxOrderData && maxOrderData[0] ? maxOrderData[0].sort_order + 1 : 0

      const { data: newEvent, error } = await supabase
        .from('timeline_events')
        .insert([{ ...eventPayload, sort_order: nextSortOrder }])
        .select()
        .single()

      if (error) throw error
      eventId = newEvent.id
    }

    // 2. Sync Images - Delete removed ones
    if (imageIdsToDelete.value.length > 0) {
      const { error: deleteError } = await supabase
        .from('timeline_images')
        .delete()
        .in('id', imageIdsToDelete.value)

      if (deleteError) throw deleteError
    }

    // 3. Sync Images - Insert new ones
    const newImages = images.value.filter(img => img.isNew)
    if (newImages.length > 0) {
      const imagePayloads = newImages.map((img, index) => ({
        timeline_event_id: eventId,
        image_url: img.image_url,
        sort_order: index // simple ordering
      }))

      const { error: insertError } = await supabase
        .from('timeline_images')
        .insert(imagePayloads)

      if (insertError) throw insertError
    }

    toast.success(isEditMode.value ? 'Cập nhật cột mốc thành công!' : 'Tạo cột mốc mới thành công!')
    router.push('/admin/timeline')

  } catch (err: any) {
    toast.error('Lỗi khi lưu thông tin: ' + err.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchEventDetails()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/admin/timeline" class="text-text-muted hover:text-gray-900 dark:hover:text-gray-100 flex items-center">
        <i class="ti ti-arrow-left text-xl"></i>
      </RouterLink>
      <div>
        <h2 class="text-lg font-bold font-serif font-medium">
          {{ isEditMode ? 'Chỉnh sửa mốc thời gian' : 'Thêm mốc thời gian mới' }}
        </h2>
        <p class="text-xs text-text-muted">
          {{ isEditMode ? 'Cập nhật nội dung mốc kỷ niệm' : 'Tạo thêm một mốc kỷ niệm trên hành trình yêu nhau' }}
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <i class="ti ti-loader animate-spin text-2xl text-romantic-500"></i>
      <p class="text-xs text-text-muted">Đang tải thông tin...</p>
    </div>

    <!-- Form -->
    <div v-else class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-6">
      <form @submit.prevent="saveEvent" class="space-y-5">
        
        <!-- Grid fields -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Title -->
          <div>
            <label class="text-xs text-text-secondary block mb-1.5 ml-1">Tiêu đề mốc kỷ niệm</label>
            <input 
              v-model="title"
              type="text"
              placeholder="Ví dụ: Lần đầu gặp nhau..."
              class="w-full"
              required
            />
          </div>

          <!-- Event Date -->
          <div>
            <label class="text-xs text-text-secondary block mb-1.5 ml-1">Ngày diễn ra</label>
            <input 
              v-model="eventDate"
              type="date"
              class="w-full"
              required
            />
          </div>
        </div>

        <!-- Description -->
        <div>
          <label class="text-xs text-text-secondary block mb-1.5 ml-1">Mô tả câu chuyện</label>
          <textarea 
            v-model="description"
            rows="5"
            placeholder="Kể lại kỷ niệm hôm đó của hai bạn..."
            class="w-full text-sm leading-relaxed"
            required
          ></textarea>
        </div>

        <!-- Special milestone check -->
        <div class="flex items-center gap-2 mb-2 ml-1">
          <input 
            v-model="isSpecial"
            type="checkbox"
            id="special-checkbox"
            class="w-4 h-4 accent-romantic-500 rounded border-border-strong cursor-pointer"
          />
          <label for="special-checkbox" class="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
            Đánh dấu là cột mốc đặc biệt (Sẽ được làm nổi bật trên dòng thời gian)
          </label>
        </div>

        <!-- Image Gallery Management -->
        <div>
          <label class="text-xs text-text-secondary block mb-2.5 ml-1">Hình ảnh kỷ niệm</label>
          
          <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            
            <!-- Existing images -->
            <div 
              v-for="img in images" 
              :key="img.id"
              class="aspect-square rounded-xl bg-surface-1 border border-border relative overflow-hidden group shadow-inner"
            >
              <img :src="img.image_url" class="w-full h-full object-cover" alt="Kỷ niệm" />
              <!-- Remove overlay -->
              <button 
                type="button"
                @click="removeImage(img)"
                class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center cursor-pointer transition text-xs opacity-80 md:opacity-0 md:group-hover:opacity-100"
              >
                <i class="ti ti-x"></i>
              </button>
            </div>

            <!-- Upload new button -->
            <div class="aspect-square">
              <input 
                type="file" 
                accept="image/*" 
                id="images-upload" 
                multiple
                class="hidden" 
                @change="handleFileUpload" 
                :disabled="uploading"
              />
              <label 
                for="images-upload"
                class="w-full h-full border border-dashed border-border-strong rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-text-muted hover:text-romantic-500 transition duration-150"
                :class="{'opacity-50 pointer-events-none': uploading}"
              >
                <i v-if="uploading" class="ti ti-loader animate-spin text-xl"></i>
                <i v-else class="ti ti-plus text-xl"></i>
                <span class="text-[10px] font-semibold uppercase">{{ uploading ? 'Tải lên...' : 'Thêm ảnh' }}</span>
              </label>
            </div>

          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex justify-end gap-3 pt-2">
          <RouterLink 
            to="/admin/timeline"
            class="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold py-2.5 px-5 rounded-xl border border-border flex items-center justify-center transition"
          >
            Hủy
          </RouterLink>
          <button
            type="submit"
            class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs font-semibold py-2.5 px-6 rounded-xl shadow-lg shadow-romantic-500/10 cursor-pointer transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            :disabled="saving"
          >
            <i v-if="saving" class="ti ti-loader animate-spin text-sm"></i>
            <span>{{ saving ? 'Đang lưu...' : (isEditMode ? 'Lưu thay đổi' : 'Tạo cột mốc') }}</span>
          </button>
        </div>

      </form>
    </div>
  </div>
</template>
