<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'vue-sonner'

const route = useRoute()
const router = useRouter()

const isEditMode = computed(() => !!route.params.id)
const id = computed(() => route.params.id as string)

const title = ref('')
const tag = ref('Xin lỗi')
const customTag = ref('')
const useCustomTag = ref(false)
const content = ref('')
const status = ref<'draft' | 'published'>('draft')
const unlockDate = ref('')
const coverImageUrl = ref('')
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)

const predefinedTags = ['Xin lỗi', 'Lời hứa', 'Thư tình', 'Nhớ em', 'Kỷ niệm']

// Fetch letter details if in edit mode
async function fetchLetter() {
  if (!isEditMode.value) return
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('letters')
      .select('*')
      .eq('id', id.value)
      .single()

    if (error) throw error

    if (data) {
      title.value = data.title
      content.value = data.content
      status.value = data.status as 'draft' | 'published'
      unlockDate.value = data.unlock_date || ''
      coverImageUrl.value = data.cover_image_url || ''
      
      if (predefinedTags.includes(data.tag)) {
        tag.value = data.tag
        useCustomTag.value = false
      } else {
        tag.value = 'Khác'
        customTag.value = data.tag
        useCustomTag.value = true
      }
    }
  } catch (err: any) {
    toast.error('Lỗi khi tải thông tin thư: ' + err.message)
    router.push('/admin')
  } finally {
    loading.value = false
  }
}

import { compressImage } from '../lib/imageCompressor'

// Upload file to Supabase Storage
async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    toast.info('Đang tối ưu hóa dung lượng hình ảnh...')
    const compressedBlob = await compressImage(file)
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.webp`
    const filePath = `covers/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('letter-images')
      .upload(filePath, compressedBlob)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('letter-images')
      .getPublicUrl(filePath)

    coverImageUrl.value = data.publicUrl
    toast.success('Tải ảnh bìa lên thành công!')
  } catch (err: any) {
    toast.error('Lỗi khi tải ảnh lên: ' + err.message)
  } finally {
    uploading.value = false
  }
}

// Save/Update letter
async function saveLetter() {
  if (!title.value || !content.value) {
    toast.error('Vui lòng điền đầy đủ tiêu đề và nội dung thư.')
    return
  }

  saving.value = true
  const finalTag = useCustomTag.value || tag.value === 'Khác' ? customTag.value || 'Khác' : tag.value
  
  const payload = {
    title: title.value,
    content: content.value,
    tag: finalTag,
    status: status.value,
    unlock_date: unlockDate.value || null,
    cover_image_url: coverImageUrl.value || null,
  }

  try {
    if (isEditMode.value) {
      const { error } = await supabase
        .from('letters')
        .update(payload)
        .eq('id', id.value)

      if (error) throw error
      toast.success('Đã cập nhật thư thành công!')
    } else {
      const { error } = await supabase
        .from('letters')
        .insert([payload])

      if (error) throw error
      toast.success('Đã tạo thư mới thành công!')
    }
    router.push('/admin')
  } catch (err: any) {
    toast.error('Lỗi khi lưu thư: ' + err.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchLetter()
})
</script>

<template>
  <div>
    <!-- Back Header -->
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/admin" class="text-text-muted hover:text-gray-900 dark:hover:text-gray-100 flex items-center">
        <i class="ti ti-arrow-left text-xl"></i>
      </RouterLink>
      <div>
        <h2 class="text-lg font-bold font-serif">
          {{ isEditMode ? 'Chỉnh sửa lá thư' : 'Viết lá thư mới' }}
        </h2>
        <p class="text-xs text-text-muted">
          {{ isEditMode ? 'Cập nhật lại nội dung bức thư' : 'Tạo thêm một bức thư mới gửi cho cô ấy' }}
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <i class="ti ti-loader animate-spin text-2xl text-romantic-500"></i>
      <p class="text-xs text-text-muted">Đang tải dữ liệu...</p>
    </div>

    <!-- Edit Form -->
    <div v-else class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-6">
      <form @submit.prevent="saveLetter" class="space-y-5">
        
        <!-- Grid fields -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Title -->
          <div>
            <label class="text-xs text-text-secondary block mb-1.5 ml-1">Tiêu đề thư</label>
            <input 
              v-model="title"
              type="text"
              placeholder="Nhập tiêu đề của bức thư..."
              class="w-full"
              required
            />
          </div>

          <!-- Tag Selection -->
          <div>
            <label class="text-xs text-text-secondary block mb-1.5 ml-1">Nhãn thư</label>
            <div class="flex gap-2">
              <select 
                v-model="tag"
                class="flex-1"
                @change="useCustomTag = (tag === 'Khác')"
              >
                <option v-for="t in predefinedTags" :key="t" :value="t">{{ t }}</option>
                <option value="Khác">Khác...</option>
              </select>
              
              <input 
                v-if="useCustomTag"
                v-model="customTag"
                type="text"
                placeholder="Nhập nhãn tùy chỉnh..."
                class="flex-1"
              />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Status -->
          <div>
            <label class="text-xs text-text-secondary block mb-1.5 ml-1">Trạng thái đăng</label>
            <select v-model="status" class="w-full">
              <option value="draft">Bản nháp (Draft)</option>
              <option value="published">Đăng ngay (Published)</option>
            </select>
          </div>

          <!-- Unlock Date -->
          <div>
            <label class="text-xs text-text-secondary block mb-1.5 ml-1">Ngày mở khóa (Không bắt buộc)</label>
            <input 
              v-model="unlockDate"
              type="date"
              class="w-full"
            />
            <p class="text-[10px] text-text-muted mt-1 ml-1">
              Thư sẽ ở trạng thái khóa (sealed) trên trang của cô ấy cho đến ngày này.
            </p>
          </div>
        </div>

        <!-- Cover Image Upload -->
        <div>
          <label class="text-xs text-text-secondary block mb-1.5 ml-1">Hình ảnh bìa thư</label>
          <div class="flex flex-col md:flex-row items-center gap-4">
            <!-- Cover preview -->
            <div 
              class="w-full md:w-32 aspect-video md:aspect-square rounded-xl bg-surface-1 border border-border flex items-center justify-center overflow-hidden flex-shrink-0"
            >
              <img 
                v-if="coverImageUrl" 
                :src="coverImageUrl" 
                class="w-full h-full object-cover" 
                alt="Bìa thư"
              />
              <i v-else class="ti ti-photo text-xl text-text-muted"></i>
            </div>
            
            <!-- Upload controller -->
            <div class="flex-1 w-full space-y-2">
              <div class="flex items-center gap-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  id="cover-upload"
                  class="hidden" 
                  @change="handleFileUpload" 
                  :disabled="uploading"
                />
                <label 
                  for="cover-upload"
                  class="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold py-2 px-4 rounded-xl border border-border cursor-pointer flex items-center gap-1.5 transition"
                  :class="{'opacity-50 pointer-events-none': uploading}"
                >
                  <i class="ti ti-upload"></i>
                  <span>{{ uploading ? 'Đang tải lên...' : 'Tải ảnh mới lên' }}</span>
                </label>
                <button 
                  v-if="coverImageUrl"
                  type="button"
                  @click="coverImageUrl = ''"
                  class="text-xs text-red-500 hover:underline cursor-pointer"
                >
                  Xóa ảnh
                </button>
              </div>
              <input 
                v-model="coverImageUrl"
                type="text"
                placeholder="Hoặc dán URL ảnh trực tiếp vào đây..."
                class="w-full"
              />
            </div>
          </div>
        </div>

        <!-- Content Editor -->
        <div>
          <label class="text-xs text-text-secondary block mb-1.5 ml-1">Nội dung bức thư</label>
          <textarea 
            v-model="content"
            rows="10"
            placeholder="Viết những gì anh muốn nói với em... (Hỗ trợ định dạng văn bản thô hoặc viết tâm sự)"
            class="w-full font-sans text-sm leading-relaxed resize-y"
            required
          ></textarea>
        </div>

        <!-- Save Button -->
        <div class="flex justify-end gap-3 pt-2">
          <RouterLink 
            to="/admin"
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
            <span>{{ saving ? 'Đang lưu...' : (isEditMode ? 'Cập nhật thư' : 'Tạo lá thư') }}</span>
          </button>
        </div>

      </form>
    </div>
  </div>
</template>
