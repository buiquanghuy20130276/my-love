<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'vue-sonner'

const route = useRoute()
const router = useRouter()

const isEditMode = computed(() => !!route.params.id)
const id = computed(() => route.params.id as string)

const name = ref('')
const lat = ref<number | ''>('')
const lng = ref<number | ''>('')
const note = ref('')
const image_url = ref('')
const link = ref('')

const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)

async function fetchLocationDetails() {
  if (!isEditMode.value) return
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('love_map_locations')
      .select('*')
      .eq('id', id.value)
      .single()

    if (error) throw error
    if (data) {
      name.value = data.name
      lat.value = data.lat
      lng.value = data.lng
      note.value = data.note
      image_url.value = data.image_url || ''
      link.value = data.link || ''
    }
  } catch (err: any) {
    toast.error('Lỗi khi tải thông tin địa điểm: ' + err.message)
    router.push('/admin/map')
  } finally {
    loading.value = false
  }
}

import { compressImage } from '../lib/imageCompressor'

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    toast.info('Đang tối ưu hóa dung lượng hình ảnh...')
    const compressedBlob = await compressImage(file)
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.webp`
    const filePath = `map/${fileName}`

    // Upload to letter-images bucket to ensure it works even if map-images bucket didn't mount
    const { error: uploadError } = await supabase.storage
      .from('letter-images')
      .upload(filePath, compressedBlob)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('letter-images')
      .getPublicUrl(filePath)

    image_url.value = data.publicUrl
    toast.success('Tải ảnh kỷ niệm lên thành công!')
  } catch (err: any) {
    toast.error('Lỗi khi tải ảnh lên: ' + err.message)
  } finally {
    uploading.value = false
  }
}

async function saveLocation() {
  if (!name.value || lat.value === '' || lng.value === '' || !note.value) {
    toast.error('Vui lòng điền đầy đủ tên, tọa độ và ghi chú.')
    return
  }

  saving.value = true

  const payload = {
    name: name.value,
    lat: Number(lat.value),
    lng: Number(lng.value),
    note: note.value,
    image_url: image_url.value || null,
    link: link.value || null
  }

  try {
    if (isEditMode.value) {
      const { error } = await supabase
        .from('love_map_locations')
        .update(payload)
        .eq('id', id.value)

      if (error) throw error
      toast.success('Cập nhật địa điểm thành công!')
    } else {
      const { error } = await supabase
        .from('love_map_locations')
        .insert([payload])

      if (error) throw error
      toast.success('Thêm địa điểm kỷ niệm thành công!')
    }
    router.push('/admin/map')
  } catch (err: any) {
    toast.error('Lỗi khi lưu địa điểm: ' + err.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchLocationDetails()
})
</script>

<template>
  <div>
    <!-- Back Header -->
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/admin/map" class="text-text-muted hover:text-gray-900 dark:hover:text-gray-100 flex items-center">
        <i class="ti ti-arrow-left text-xl"></i>
      </RouterLink>
      <div>
        <h2 class="text-lg font-bold font-serif">
          {{ isEditMode ? 'Chỉnh sửa địa điểm' : 'Thêm địa điểm mới' }}
        </h2>
        <p class="text-xs text-text-muted">
          {{ isEditMode ? 'Cập nhật lại tọa độ hoặc mô tả kỷ niệm' : 'Lưu thêm một dấu chân tình yêu trên bản đồ kỷ niệm' }}
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <i class="ti ti-loader animate-spin text-2xl text-[#D4537E]"></i>
      <p class="text-xs text-text-muted">Đang tải dữ liệu...</p>
    </div>

    <!-- Form -->
    <div v-else class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-6">
      <form @submit.prevent="saveLocation" class="space-y-5">
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Name -->
          <div>
            <label class="text-xs text-text-secondary block mb-1.5 ml-1">Tên địa điểm</label>
            <input 
              v-model="name"
              type="text"
              placeholder="Ví dụ: Quán cafe lần đầu gặp, Hồ Xuân Hương..."
              class="w-full"
              required
            />
          </div>

          <!-- Link / URL -->
          <div>
            <label class="text-xs text-text-secondary block mb-1.5 ml-1">Liên kết Google Maps hoặc URL ngoài</label>
            <input 
              v-model="link"
              type="text"
              placeholder="https://maps.google.com/?q=..."
              class="w-full"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Lat -->
          <div>
            <label class="text-xs text-text-secondary block mb-1.5 ml-1">Vĩ độ (Latitude)</label>
            <input 
              v-model="lat"
              type="number"
              step="any"
              placeholder="Ví dụ: 10.7769"
              class="w-full"
              required
            />
          </div>

          <!-- Lng -->
          <div>
            <label class="text-xs text-text-secondary block mb-1.5 ml-1">Kinh độ (Longitude)</label>
            <input 
              v-model="lng"
              type="number"
              step="any"
              placeholder="Ví dụ: 106.7009"
              class="w-full"
              required
            />
          </div>
        </div>

        <!-- Image Upload -->
        <div>
          <label class="text-xs text-text-secondary block mb-1.5 ml-1">Hình ảnh địa điểm kỷ niệm</label>
          <div class="flex flex-col md:flex-row items-center gap-4">
            <div 
              class="w-full md:w-32 aspect-video md:aspect-square rounded-xl bg-surface-1 border border-border flex items-center justify-center overflow-hidden flex-shrink-0"
            >
              <img 
                v-if="image_url" 
                :src="image_url" 
                class="w-full h-full object-cover" 
                alt="Địa điểm"
              />
              <i v-else class="ti ti-photo text-xl text-text-muted"></i>
            </div>
            
            <div class="flex-1 w-full space-y-2">
              <div class="flex items-center gap-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  id="loc-image-upload"
                  class="hidden" 
                  @change="handleFileUpload" 
                  :disabled="uploading"
                />
                <label 
                  for="loc-image-upload"
                  class="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold py-2 px-4 rounded-xl border border-border cursor-pointer flex items-center gap-1.5 transition"
                  :class="{'opacity-50 pointer-events-none': uploading}"
                >
                  <i class="ti ti-upload"></i>
                  <span>{{ uploading ? 'Đang tải lên...' : 'Tải ảnh mới lên' }}</span>
                </label>
                <button 
                  v-if="image_url"
                  type="button"
                  @click="image_url = ''"
                  class="text-xs text-red-500 hover:underline cursor-pointer"
                >
                  Xóa ảnh
                </button>
              </div>
              <input 
                v-model="image_url"
                type="text"
                placeholder="Hoặc dán URL ảnh trực tiếp vào đây..."
                class="w-full"
              />
            </div>
          </div>
        </div>

        <!-- Note -->
        <div>
          <label class="text-xs text-text-secondary block mb-1.5 ml-1">Mô tả hoặc kỷ niệm đáng nhớ</label>
          <textarea 
            v-model="note"
            rows="4"
            placeholder="Kể lại vì sao địa điểm này đặc biệt với hai bạn..."
            class="w-full text-sm leading-relaxed"
            required
          ></textarea>
        </div>

        <!-- Save Button -->
        <div class="flex justify-end gap-3 pt-2">
          <RouterLink 
            to="/admin/map"
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
            <span>{{ saving ? 'Đang lưu...' : (isEditMode ? 'Cập nhật địa điểm' : 'Tạo địa điểm') }}</span>
          </button>
        </div>

      </form>
    </div>
  </div>
</template>
