<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'vue-sonner'

// Timeline events option list for linking bucket items
interface TimelineEventOpt {
  id: string
  title: string
  event_date: string
}
const allTimelineEvents = ref<TimelineEventOpt[]>([])

// Bucket List management state
interface BucketItem {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'planning' | 'completed'
  completed_at: string | null
  linked_event_id: string | null
}
const adminBucketList = ref<BucketItem[]>([])
const newBucketTitle = ref('')
const newBucketDesc = ref('')
const newBucketStatus = ref<'pending' | 'planning' | 'completed'>('pending')
const newBucketLinkedEventId = ref('')
const savingBucket = ref(false)
const loading = ref(false)

// Fetch all timeline events to link to bucket list items
async function fetchTimelineEventsForLink() {
  try {
    const { data } = await supabase
      .from('timeline_events')
      .select('id, title, event_date')
      .order('event_date', { ascending: false })
    allTimelineEvents.value = data || []
  } catch (err) {
    console.error('Error fetching timeline events for link:', err)
  }
}

// Fetch Bucket List
async function fetchAdminBucketList() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('bucket_list')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    adminBucketList.value = data || []
  } catch (err: any) {
    toast.error('Lỗi tải danh sách nguyện vọng: ' + err.message)
  } finally {
    loading.value = false
  }
}

// Add Bucket List Item
async function addBucketItem() {
  if (!newBucketTitle.value.trim()) {
    toast.error('Vui lòng nhập tiêu đề nguyện vọng!')
    return
  }
  savingBucket.value = true
  try {
    const completedAt = newBucketStatus.value === 'completed' ? new Date().toISOString().split('T')[0] : null
    const { error } = await supabase
      .from('bucket_list')
      .insert({
        title: newBucketTitle.value.trim(),
        description: newBucketDesc.value.trim() || null,
        status: newBucketStatus.value,
        completed_at: completedAt,
        linked_event_id: newBucketLinkedEventId.value || null
      })

    if (error) throw error
    toast.success('Đã thêm nguyện vọng thành công!')
    newBucketTitle.value = ''
    newBucketDesc.value = ''
    newBucketStatus.value = 'pending'
    newBucketLinkedEventId.value = ''
    await fetchAdminBucketList()
  } catch (err: any) {
    toast.error('Lỗi khi thêm nguyện vọng: ' + err.message)
  } finally {
    savingBucket.value = false
  }
}

// Delete Bucket List Item
async function deleteBucketItem(id: string) {
  if (!confirm('Bạn có chắc chắn muốn xóa nguyện vọng này không?')) return
  try {
    const { error } = await supabase
      .from('bucket_list')
      .delete()
      .eq('id', id)
    if (error) throw error
    toast.success('Đã xóa nguyện vọng!')
    await fetchAdminBucketList()
  } catch (err: any) {
    toast.error('Lỗi khi xóa nguyện vọng: ' + err.message)
  }
}

onMounted(() => {
  fetchAdminBucketList()
  fetchTimelineEventsForLink()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-bold font-serif">Quản lý Bảng Nguyện Vọng</h2>
      <p class="text-xs text-text-muted">Lên danh sách và lập kế hoạch cho các dự định chung của hai bạn</p>
    </div>

    <!-- Bucket List Manager -->
    <div class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-6">
      <!-- Add New Bucket Item Form -->
      <form @submit.prevent="addBucketItem" class="bg-surface-1 dark:bg-black/20 border border-border p-4 rounded-xl space-y-4 mb-6">
        <p class="text-xs font-bold text-[#993556] dark:text-[#F4C0D1] border-b border-border pb-1 ml-0.5">
          Thêm nguyện vọng mới
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-[10px] text-text-secondary block mb-1 ml-0.5">Tiêu đề nguyện vọng *</label>
            <input 
              v-model="newBucketTitle"
              type="text"
              placeholder="Ví dụ: Cùng đi ngắm tuyết rơi..."
              class="w-full text-xs"
              required
            />
          </div>
          <div>
            <label class="text-[10px] text-text-secondary block mb-1 ml-0.5">Trạng thái nguyện vọng</label>
            <select v-model="newBucketStatus" class="w-full text-xs">
              <option value="pending">Đang chờ (Pending)</option>
              <option value="planning">Đang lên kế hoạch (Planning)</option>
              <option value="completed">Đã hoàn thành (Completed)</option>
            </select>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="text-[10px] text-text-secondary block mb-1 ml-0.5">Mô tả chi tiết</label>
            <input 
              v-model="newBucketDesc"
              type="text"
              placeholder="Viết thêm ghi chú hoặc dự định..."
              class="w-full text-xs"
            />
          </div>
          <div>
            <label class="text-[10px] text-text-secondary block mb-1 ml-0.5">Liên kết sự kiện Timeline (Không bắt buộc)</label>
            <select v-model="newBucketLinkedEventId" class="w-full text-xs">
              <option value="">Không liên kết</option>
              <option 
                v-for="ev in allTimelineEvents" 
                :key="ev.id" 
                :value="ev.id"
              >
                {{ ev.title }} ({{ ev.event_date }})
              </option>
            </select>
          </div>
        </div>

        <div class="flex justify-end">
          <button 
            type="submit"
            :disabled="savingBucket"
            class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer transition flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <i v-if="savingBucket" class="ti ti-loader animate-spin"></i>
            <span>Thêm nguyện vọng</span>
          </button>
        </div>
      </form>

      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-10 gap-2">
        <i class="ti ti-loader animate-spin text-xl text-[#D4537E]"></i>
        <p class="text-[10px] text-text-muted">Đang tải danh sách nguyện vọng...</p>
      </div>

      <!-- Bucket List Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-border text-text-secondary">
              <th class="py-2.5 px-2 font-medium w-[35%]">Nguyện vọng</th>
              <th class="py-2.5 px-2 font-medium w-[20%]">Mô tả</th>
              <th class="py-2.5 px-2 font-medium w-[15%]">Trạng thái</th>
              <th class="py-2.5 px-2 font-medium w-[20%]">Liên kết</th>
              <th class="py-2.5 px-2 font-medium w-[10%] text-right">Xóa</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="item in adminBucketList" 
              :key="item.id"
              class="border-b border-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <td class="py-3 px-2 font-medium text-gray-900 dark:text-gray-100">
                {{ item.title }}
              </td>
              <td class="py-3 px-2 text-text-muted">
                {{ item.description || '-' }}
              </td>
              <td class="py-3 px-2">
                <span 
                  class="px-2 py-0.5 rounded-full text-[9px] font-semibold"
                  :class="item.status === 'completed' 
                    ? 'bg-[#DEF7EC] text-[#03543F] dark:bg-emerald-950/20 dark:text-emerald-400' 
                    : item.status === 'planning'
                      ? 'bg-[#E3EFFD] text-blue-800 dark:bg-blue-950/20 dark:text-blue-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400'"
                >
                  {{ item.status === 'completed' ? 'Xong' : item.status === 'planning' ? 'Kế hoạch' : 'Đang chờ' }}
                </span>
              </td>
              <td class="py-3 px-2 text-text-muted">
                <span v-if="item.linked_event_id" class="text-[#D4537E] font-medium">Linked 🔗</span>
                <span v-else>-</span>
              </td>
              <td class="py-3 px-2 text-right">
                <button 
                  @click="deleteBucketItem(item.id)" 
                  class="text-red-500 hover:text-red-600 cursor-pointer text-sm"
                >
                  <i class="ti ti-trash"></i>
                </button>
              </td>
            </tr>
            <tr v-if="adminBucketList.length === 0">
              <td colspan="5" class="py-8 text-center text-text-muted italic">
                Chưa có điều nguyện vọng nào được tạo.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
