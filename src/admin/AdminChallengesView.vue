<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'vue-sonner'
import { compressImage } from '../lib/imageCompressor'

const partnerAName = ref('Diệu Thiện')
const partnerBName = ref('Quang Huy')

interface LoveChallenge {
  id: string
  title: string
  description: string
  partner_a_completed: boolean
  partner_b_completed: boolean
  reward_text: string | null
  reward_image_url: string | null
}
const adminChallenges = ref<LoveChallenge[]>([])
const newChallengeTitle = ref('')
const newChallengeDesc = ref('')
const newChallengeRewardText = ref('')
const newChallengeRewardImageUrl = ref('')
const savingChallenge = ref(false)
const loading = ref(false)

async function fetchSettingsNames() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('partner_a_name, partner_b_name')
      .eq('id', 1)
      .single()
    if (data) {
      partnerAName.value = data.partner_a_name
      partnerBName.value = data.partner_b_name
    }
  } catch (err) {
    console.error('Error fetching settings names:', err)
  }
}

// Fetch Love Challenges
async function fetchAdminChallenges() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('love_challenges')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    adminChallenges.value = data || []
  } catch (err: any) {
    toast.error('Lỗi tải danh sách thử thách: ' + err.message)
  } finally {
    loading.value = false
  }
}

// Upload reward image helper for challenges
async function uploadRewardImage(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    toast.info('Đang tối ưu hóa dung lượng hình ảnh...')
    const compressedBlob = await compressImage(file)
    const fileName = `challenge-reward-${Date.now()}.webp`
    const filePath = `challenges/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('letter-images')
      .upload(filePath, compressedBlob, { cacheControl: '3600', upsert: true })

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('letter-images')
      .getPublicUrl(filePath)

    newChallengeRewardImageUrl.value = data.publicUrl
    toast.success('Tải ảnh quà tặng thành công!')
  } catch (err: any) {
    toast.error('Lỗi khi tải ảnh quà lên: ' + err.message)
  }
}

// Add Love Challenge
async function addChallenge() {
  if (!newChallengeTitle.value.trim() || !newChallengeDesc.value.trim()) {
    toast.error('Vui lòng nhập đầy đủ tiêu đề và nội dung thử thách!')
    return
  }
  savingChallenge.value = true
  try {
    const { error } = await supabase
      .from('love_challenges')
      .insert({
        title: newChallengeTitle.value.trim(),
        description: newChallengeDesc.value.trim(),
        reward_text: newChallengeRewardText.value.trim() || null,
        reward_image_url: newChallengeRewardImageUrl.value || null
      })

    if (error) throw error
    toast.success('Đã thêm thử thách mới thành công!')
    newChallengeTitle.value = ''
    newChallengeDesc.value = ''
    newChallengeRewardText.value = ''
    newChallengeRewardImageUrl.value = ''
    await fetchAdminChallenges()
  } catch (err: any) {
    toast.error('Lỗi khi thêm thử thách: ' + err.message)
  } finally {
    savingChallenge.value = false
  }
}

// Delete Love Challenge
async function deleteChallenge(id: string) {
  if (!confirm('Bạn có chắc chắn muốn xóa thử thách này không?')) return
  try {
    const { error } = await supabase
      .from('love_challenges')
      .delete()
      .eq('id', id)
    if (error) throw error
    toast.success('Đã xóa thử thách!')
    await fetchAdminChallenges()
  } catch (err: any) {
    toast.error('Lỗi khi xóa thử thách: ' + err.message)
  }
}

onMounted(() => {
  fetchSettingsNames()
  fetchAdminChallenges()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-bold font-serif">Quản lý Thử thách đôi</h2>
      <p class="text-xs text-text-muted">Tạo các thử thách hàng tuần cho cả hai và ẩn giấu các phần quà bất ngờ</p>
    </div>

    <!-- Challenges Manager -->
    <div class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-6">
      <!-- Add Challenge Form -->
      <form @submit.prevent="addChallenge" class="bg-surface-1 dark:bg-black/20 border border-border p-4 rounded-xl space-y-4 mb-6">
        <p class="text-xs font-bold text-[#993556] dark:text-[#F4C0D1] border-b border-border pb-1 ml-0.5">
          Tạo thử thách mới
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-[10px] text-text-secondary block mb-1 ml-0.5">Tên thử thách *</label>
            <input 
              v-model="newChallengeTitle"
              type="text"
              placeholder="Ví dụ: Gửi ghi âm nói yêu đối phương..."
              class="w-full text-xs"
              required
            />
          </div>
          <div>
            <label class="text-[10px] text-text-secondary block mb-1 ml-0.5">Nội dung yêu cầu thử thách *</label>
            <input 
              v-model="newChallengeDesc"
              type="text"
              placeholder="Chi tiết cách hoàn thành..."
              class="w-full text-xs"
              required
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-[10px] text-text-secondary block mb-1 ml-0.5">Nội dung phần thưởng bí mật</label>
            <input 
              v-model="newChallengeRewardText"
              type="text"
              placeholder="Ví dụ: Một cái ôm thật to và một buổi đi ăn lẩu..."
              class="w-full text-xs"
            />
          </div>
          <div>
            <label class="text-[10px] text-text-secondary block mb-1.5 ml-0.5">Hình ảnh quà tặng bí mật (Không bắt buộc)</label>
            <div class="flex items-center gap-3">
              <div class="w-12 h-8 rounded bg-surface-1 border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                <img v-if="newChallengeRewardImageUrl" :src="newChallengeRewardImageUrl" class="w-full h-full object-cover" />
                <i v-else class="ti ti-photo text-text-muted text-sm"></i>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                id="challenge-reward-upload" 
                class="hidden" 
                @change="uploadRewardImage"
              />
              <label 
                for="challenge-reward-upload"
                class="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[10px] font-semibold py-1.5 px-2.5 rounded border border-border cursor-pointer transition"
              >
                Tải ảnh lên
              </label>
            </div>
            <input 
              v-model="newChallengeRewardImageUrl"
              type="text"
              placeholder="Hoặc URL hình ảnh phần thưởng..."
              class="w-full mt-2 text-xs"
            />
          </div>
        </div>

        <div class="flex justify-end">
          <button 
            type="submit"
            :disabled="savingChallenge"
            class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer transition flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <i v-if="savingChallenge" class="ti ti-loader animate-spin"></i>
            <span>Tạo thử thách</span>
          </button>
        </div>
      </form>

      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-10 gap-2">
        <i class="ti ti-loader animate-spin text-xl text-[#D4537E]"></i>
        <p class="text-[10px] text-text-muted">Đang tải thử thách...</p>
      </div>

      <!-- Challenges List -->
      <div v-else class="space-y-3">
        <div 
          v-for="item in adminChallenges" 
          :key="item.id"
          class="border border-border p-4 bg-surface-1 dark:bg-black/10 rounded-xl flex justify-between items-start gap-4 text-xs"
        >
          <div class="space-y-1.5 flex-1 min-w-0">
            <h4 class="font-bold text-gray-900 dark:text-gray-100 truncate">
              {{ item.title }}
            </h4>
            <p class="text-text-secondary text-[10px] leading-relaxed">
              {{ item.description }}
            </p>
            <p class="text-[9px] text-[#993556] dark:text-[#F4C0D1] italic" v-if="item.reward_text">
              Quà: {{ item.reward_text }}
            </p>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[8px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-border text-text-muted">
                {{ partnerAName }}: {{ item.partner_a_completed ? 'Hoàn thành ✅' : 'Chưa xong ❌' }}
              </span>
              <span class="text-[8px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-border text-text-muted">
                {{ partnerBName }}: {{ item.partner_b_completed ? 'Hoàn thành ✅' : 'Chưa xong ❌' }}
              </span>
            </div>
          </div>
          <button 
            @click="deleteChallenge(item.id)" 
            class="text-red-500 hover:text-red-600 cursor-pointer text-sm pt-1"
          >
            <i class="ti ti-trash"></i>
          </button>
        </div>
        <p v-if="adminChallenges.length === 0" class="text-center py-6 text-text-muted italic">
          Chưa có thử thách tuần nào được tạo.
        </p>
      </div>
    </div>
  </div>
</template>
