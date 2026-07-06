<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'vue-sonner'

const relationshipStartDate = ref('2025-03-14')
const themeColor = ref('#D4537E')
const themeModeDefault = ref<'light' | 'dark'>('light')
const partnerAName = ref('Diệu Thiện')
const partnerBName = ref('Quang Huy')
const partnerAAvatarUrl = ref('')
const partnerBAvatarUrl = ref('')
const coverImageUrl = ref('')
const nextSpecialDate = ref('')
const nextSpecialLabel = ref('')
const musicUrl = ref('')
const musicTitle = ref('')

const loading = ref(true)
const saving = ref(false)
const uploadingMusic = ref(false)

// Fetch current settings
async function fetchSettings() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    if (data) {
      relationshipStartDate.value = data.relationship_start_date
      themeColor.value = data.theme_color
      themeModeDefault.value = data.theme_mode_default as 'light' | 'dark'
      partnerAName.value = data.partner_a_name
      partnerBName.value = data.partner_b_name
      partnerAAvatarUrl.value = data.partner_a_avatar_url || ''
      partnerBAvatarUrl.value = data.partner_b_avatar_url || ''
      coverImageUrl.value = data.cover_image_url || ''
      nextSpecialDate.value = data.next_special_date || ''
      nextSpecialLabel.value = data.next_special_label || ''
      musicUrl.value = data.music_url || ''
      musicTitle.value = data.music_title || 'Bài hát kỷ niệm'
    }
  } catch (err: any) {
    toast.error('Lỗi khi tải cài đặt: ' + err.message)
  } finally {
    loading.value = false
  }
}

import { compressImage } from '../lib/imageCompressor'

// Upload helper for settings images
async function uploadImage(event: Event, targetField: 'partnerA' | 'partnerB' | 'cover') {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    toast.info('Đang tối ưu hóa dung lượng hình ảnh...')
    const compressedBlob = await compressImage(file)
    const fileName = `settings-${targetField}-${Date.now()}.webp`
    const filePath = `settings/${fileName}`

    // Use letter-images bucket as public resource storage
    const { error: uploadError } = await supabase.storage
      .from('letter-images')
      .upload(filePath, compressedBlob, { cacheControl: '3600', upsert: true })

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('letter-images')
      .getPublicUrl(filePath)

    if (targetField === 'partnerA') partnerAAvatarUrl.value = data.publicUrl
    if (targetField === 'partnerB') partnerBAvatarUrl.value = data.publicUrl
    if (targetField === 'cover') coverImageUrl.value = data.publicUrl
    
    toast.success('Tải ảnh lên thành công!')
  } catch (err: any) {
    toast.error('Lỗi khi tải ảnh lên: ' + err.message)
  }
}

// Upload audio/mp3 file to Supabase Storage
async function uploadMusicFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > 15 * 1024 * 1024) { // Limit to 15MB
    toast.error('Kích thước tệp nhạc quá lớn! Vui lòng chọn tệp dưới 15MB.')
    return
  }

  uploadingMusic.value = true
  try {
    toast.info('Đang tải tệp nhạc lên hệ thống lưu trữ...')
    const fileName = `music-${Date.now()}.mp3`
    const filePath = `music/${fileName}`

    // Upload to letter-images storage bucket (which is public)
    const { error: uploadError } = await supabase.storage
      .from('letter-images')
      .upload(filePath, file, { cacheControl: '3600', contentType: 'audio/mpeg', upsert: true })

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('letter-images')
      .getPublicUrl(filePath)

    musicUrl.value = data.publicUrl
    toast.success('Đã tải nhạc lên thành công! Hãy lưu cấu hình.')
  } catch (err: any) {
    toast.error('Lỗi khi tải nhạc lên: ' + err.message)
  } finally {
    uploadingMusic.value = false
  }
}

// Save settings (Upsert row id: 1)
async function saveSettings() {
  saving.value = true
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 1,
        relationship_start_date: relationshipStartDate.value,
        theme_color: themeColor.value,
        theme_mode_default: themeModeDefault.value,
        partner_a_name: partnerAName.value,
        partner_a_avatar_url: partnerAAvatarUrl.value || null,
        partner_b_name: partnerBName.value,
        partner_b_avatar_url: partnerBAvatarUrl.value || null,
        cover_image_url: coverImageUrl.value || null,
        next_special_date: nextSpecialDate.value || null,
        next_special_label: nextSpecialLabel.value || null,
        music_url: musicUrl.value || null,
        music_title: musicTitle.value || null
      })

    if (error) throw error
    toast.success('Đã lưu các thay đổi cấu hình thành công!')
  } catch (err: any) {
    toast.error('Lỗi khi lưu cài đặt: ' + err.message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-bold font-serif">Cài đặt hệ thống</h2>
      <p class="text-xs text-text-muted">Cấu hình các cài đặt chung cho trang kỷ niệm của hai bạn</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <i class="ti ti-loader animate-spin text-2xl text-romantic-500"></i>
      <p class="text-xs text-text-muted">Đang tải cấu hình cài đặt...</p>
    </div>

    <!-- Settings form -->
    <div v-else class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-6">
      <form @submit.prevent="saveSettings" class="space-y-6">
        
        <!-- Section: General -->
        <div>
          <h3 class="text-xs font-bold text-[#993556] dark:text-[#F4C0D1] uppercase tracking-wider mb-4 border-b border-border pb-1.5 ml-1">
            Thông tin chung & Ngày kỷ niệm
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1">Ngày bắt đầu yêu nhau</label>
              <input 
                v-model="relationshipStartDate"
                type="date"
                class="w-full"
                required
              />
            </div>
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1 font-medium">Màu sắc chủ đạo (Hex)</label>
              <div class="flex gap-2">
                <input 
                  v-model="themeColor"
                  type="color"
                  class="w-12 h-10 p-1 border border-border-strong rounded-xl cursor-pointer"
                />
                <input 
                  v-model="themeColor"
                  type="text"
                  placeholder="#D4537E"
                  class="flex-1"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Section: Countdown -->
        <div>
          <h3 class="text-xs font-bold text-[#993556] dark:text-[#F4C0D1] uppercase tracking-wider mb-4 border-b border-border pb-1.5 ml-1">
            Bộ đếm ngược sự kiện tiếp theo
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1">Ngày diễn ra sự kiện</label>
              <input 
                v-model="nextSpecialDate"
                type="date"
                class="w-full"
              />
            </div>
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1">Nhãn tên sự kiện</label>
              <input 
                v-model="nextSpecialLabel"
                type="text"
                placeholder="Ví dụ: Kỷ niệm 1 năm rưỡi..."
                class="w-full"
              />
            </div>
          </div>
        </div>

        <!-- Section: Partner A (Diệu Thiện - Left Avatar) -->
        <div>
          <h3 class="text-xs font-bold text-[#993556] dark:text-[#F4C0D1] uppercase tracking-wider mb-4 border-b border-border pb-1.5 ml-1">
            Thông tin Bạn nữ (Diệu Thiện - Avatar trái)
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1">Tên hiển thị</label>
              <input 
                v-model="partnerAName"
                type="text"
                class="w-full"
                required
              />
            </div>
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1">Ảnh đại diện</label>
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-surface-1 border border-border overflow-hidden flex-shrink-0">
                  <img v-if="partnerAAvatarUrl" :src="partnerAAvatarUrl" class="w-full h-full object-cover" />
                  <i v-else class="ti ti-user text-lg text-text-muted flex items-center justify-center h-full"></i>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  id="avatar-a-upload" 
                  class="hidden" 
                  @change="uploadImage($event, 'partnerA')"
                />
                <label 
                  for="avatar-a-upload"
                  class="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[11px] font-semibold py-1.5 px-3 rounded-lg border border-border cursor-pointer transition"
                >
                  Tải ảnh lên
                </label>
              </div>
              <input 
                v-model="partnerAAvatarUrl"
                type="text"
                placeholder="Hoặc URL ảnh đại diện..."
                class="w-full mt-2"
              />
            </div>
          </div>
        </div>

        <!-- Section: Partner B (Quang Huy - Right Avatar) -->
        <div>
          <h3 class="text-xs font-bold text-[#993556] dark:text-[#F4C0D1] uppercase tracking-wider mb-4 border-b border-border pb-1.5 ml-1">
            Thông tin Bạn nam (Quang Huy - Avatar phải)
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1">Tên hiển thị</label>
              <input 
                v-model="partnerBName"
                type="text"
                class="w-full"
                required
              />
            </div>
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1">Ảnh đại diện</label>
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-surface-1 border border-border overflow-hidden flex-shrink-0">
                  <img v-if="partnerBAvatarUrl" :src="partnerBAvatarUrl" class="w-full h-full object-cover" />
                  <i v-else class="ti ti-user text-lg text-text-muted flex items-center justify-center h-full"></i>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  id="avatar-b-upload" 
                  class="hidden" 
                  @change="uploadImage($event, 'partnerB')"
                />
                <label 
                  for="avatar-b-upload"
                  class="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[11px] font-semibold py-1.5 px-3 rounded-lg border border-border cursor-pointer transition"
                >
                  Tải ảnh lên
                </label>
              </div>
              <input 
                v-model="partnerBAvatarUrl"
                type="text"
                placeholder="Hoặc URL ảnh đại diện..."
                class="w-full mt-2"
              />
            </div>
          </div>
        </div>

        <!-- Section: Cover & Default Theme -->
        <div>
          <h3 class="text-xs font-bold text-[#993556] dark:text-[#F4C0D1] uppercase tracking-wider mb-4 border-b border-border pb-1.5 ml-1">
            Cấu hình Giao diện mặc định & Ảnh nền
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1 font-medium">Giao diện mặc định khi đăng nhập lần đầu</label>
              <select v-model="themeModeDefault" class="w-full">
                <option value="light">Sáng (Light Mode)</option>
                <option value="dark">Tối (Dark Mode)</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1">Hình ảnh bìa chính (Cover Image)</label>
              <div class="flex items-center gap-3">
                <div class="w-14 h-10 rounded-lg bg-surface-1 border border-border overflow-hidden flex-shrink-0">
                  <img v-if="coverImageUrl" :src="coverImageUrl" class="w-full h-full object-cover" />
                  <i v-else class="ti ti-photo text-lg text-text-muted flex items-center justify-center h-full"></i>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  id="cover-bg-upload" 
                  class="hidden" 
                  @change="uploadImage($event, 'cover')"
                />
                <label 
                  for="cover-bg-upload"
                  class="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[11px] font-semibold py-1.5 px-3 rounded-lg border border-border cursor-pointer transition"
                >
                  Tải ảnh lên
                </label>
              </div>
              <input 
                v-model="coverImageUrl"
                type="text"
                placeholder="Hoặc URL ảnh bìa chính..."
                class="w-full mt-2"
              />
            </div>
          </div>
        </div>

        <!-- Section: Music Background -->
        <div>
          <h3 class="text-xs font-bold text-[#993556] dark:text-[#F4C0D1] uppercase tracking-wider mb-4 border-b border-border pb-1.5 ml-1">
            Cấu hình Nhạc nền ứng dụng
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1">Tên bài hát hiển thị</label>
              <input 
                v-model="musicTitle"
                type="text"
                placeholder="Ví dụ: My Love - Westlife"
                class="w-full"
              />
            </div>
            <div>
              <label class="text-xs text-text-secondary block mb-1.5 ml-1">Đường dẫn tệp âm thanh (URL MP3)</label>
              <div class="flex items-center gap-3">
                <input 
                  type="file" 
                  accept="audio/mpeg,audio/mp3" 
                  id="music-file-upload" 
                  class="hidden" 
                  @change="uploadMusicFile"
                  :disabled="uploadingMusic"
                />
                <label 
                  for="music-file-upload"
                  class="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[11px] font-semibold py-2 px-3.5 rounded-lg border border-border cursor-pointer transition flex-shrink-0"
                  :class="uploadingMusic ? 'opacity-50 pointer-events-none' : ''"
                >
                  <i v-if="uploadingMusic" class="ti ti-loader animate-spin mr-1"></i>
                  <span>Tải tệp .mp3 lên</span>
                </label>
                <input 
                  v-model="musicUrl"
                  type="text"
                  placeholder="Nhập link tệp .mp3 hoặc tải lên..."
                  class="flex-1"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="flex justify-end pt-4 border-t border-border">
          <button
            type="submit"
            class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs font-semibold py-2.5 px-6 rounded-xl shadow-lg shadow-romantic-500/10 cursor-pointer transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            :disabled="saving"
          >
            <i v-if="saving" class="ti ti-loader animate-spin text-sm"></i>
            <span>{{ saving ? 'Đang lưu cài đặt...' : 'Lưu các cài đặt' }}</span>
          </button>
        </div>

      </form>
    </div>
  </div>
</template>
