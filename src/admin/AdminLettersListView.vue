<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'vue-sonner'

interface Letter {
  id: string
  title: string
  tag: string
  status: 'draft' | 'published'
  unlock_date: string | null
  created_at: string
}

const letters = ref<Letter[]>([])
const loading = ref(true)
const selectedTagFilter = ref('Tất cả')

// Fetch letters
async function fetchLetters() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('letters')
      .select('id, title, tag, status, unlock_date, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    letters.value = data || []
  } catch (err: any) {
    toast.error('Lỗi khi tải danh sách thư: ' + err.message)
  } finally {
    loading.value = false
  }
}

// Delete letter
async function deleteLetter(id: string, title: string) {
  const confirmDelete = confirm(`Bạn có chắc chắn muốn xóa lá thư "${title}" không?`)
  if (!confirmDelete) return

  try {
    const { error } = await supabase
      .from('letters')
      .delete()
      .eq('id', id)

    if (error) throw error
    toast.success('Đã xóa thư thành công!')
    fetchLetters() // refresh
  } catch (err: any) {
    toast.error('Lỗi khi xóa thư: ' + err.message)
  }
}

// Unique tags for filter dropdown
const allTags = computed(() => {
  const tags = new Set<string>()
  letters.value.forEach(l => {
    if (l.tag) tags.add(l.tag)
  })
  return ['Tất cả', ...Array.from(tags)]
})

// Filtered letters
const filteredLetters = computed(() => {
  if (selectedTagFilter.value === 'Tất cả') return letters.value
  return letters.value.filter(l => l.tag === selectedTagFilter.value)
})

// Stats counters
const totalCount = computed(() => letters.value.length)
const publishedCount = computed(() => letters.value.filter(l => l.status === 'published').length)
const draftCount = computed(() => letters.value.filter(l => l.status === 'draft').length)

onMounted(() => {
  fetchLetters()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-lg font-bold font-serif">Thư xin lỗi</h2>
        <p class="text-xs text-text-muted">Quản lý các bức thư gửi cho cô ấy</p>
      </div>
      <RouterLink 
        to="/admin/letter/new"
        class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs px-4 py-2.5 rounded-[var(--radius)] flex items-center gap-1.5 cursor-pointer font-medium transition duration-150"
      >
        <i class="ti ti-plus text-sm"></i>
        <span>Viết thư mới</span>
      </RouterLink>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-surface-1 dark:bg-[#1D1A1F] border border-border rounded-xl p-4">
        <p class="text-[11px] text-text-secondary mb-1">Tổng số thư</p>
        <p class="text-2xl font-bold font-serif">{{ totalCount }}</p>
      </div>
      <div class="bg-surface-1 dark:bg-[#1D1A1F] border border-border rounded-xl p-4">
        <p class="text-[11px] text-text-secondary mb-1">Đã đăng</p>
        <p class="text-2xl font-bold font-serif text-[#03543F] dark:text-[#4ADE80]">{{ publishedCount }}</p>
      </div>
      <div class="bg-surface-1 dark:bg-[#1D1A1F] border border-border rounded-xl p-4">
        <p class="text-[11px] text-text-secondary mb-1">Bản nháp</p>
        <p class="text-2xl font-bold font-serif text-text-secondary">{{ draftCount }}</p>
      </div>
    </div>

    <!-- Filters & Table -->
    <div class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-4 md:p-6">
      <!-- Filters -->
      <div class="flex justify-between items-center mb-4">
        <span class="text-xs font-semibold text-text-secondary">Danh sách</span>
        <div class="flex items-center gap-2">
          <label class="text-[11px] text-text-secondary">Lọc nhãn:</label>
          <select 
            v-model="selectedTagFilter"
            class="text-xs py-1 px-2 border border-border-strong rounded-lg bg-surface-1"
          >
            <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-12 gap-3">
        <i class="ti ti-loader animate-spin text-2xl text-romantic-500"></i>
        <p class="text-xs text-text-muted">Đang tải danh sách thư...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredLetters.length === 0" class="text-center py-12">
        <i class="ti ti-mail-opened text-3xl text-text-muted mb-2"></i>
        <p class="text-xs text-text-muted">Không tìm thấy lá thư nào.</p>
      </div>

      <!-- Letters Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-border text-text-secondary">
              <th class="py-2.5 px-2 font-medium w-[45%]">Tiêu đề</th>
              <th class="py-2.5 px-2 font-medium w-[20%]">Nhãn</th>
              <th class="py-2.5 px-2 font-medium w-[20%]">Trạng thái</th>
              <th class="py-2.5 px-2 font-medium w-[15%] text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="letter in filteredLetters" 
              :key="letter.id"
              class="border-b border-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <td class="py-3 px-2 font-medium">
                <div>
                  <p class="text-gray-900 dark:text-gray-100 font-medium">{{ letter.title }}</p>
                  <p v-if="letter.unlock_date" class="text-[10px] text-text-muted mt-0.5">
                    Mở khóa ngày: {{ letter.unlock_date }}
                  </p>
                </div>
              </td>
              <td class="py-3 px-2 text-text-secondary">
                <span class="px-2 py-0.5 rounded-lg bg-black/5 dark:bg-white/5 border border-border text-[10px]">
                  {{ letter.tag }}
                </span>
              </td>
              <td class="py-3 px-2">
                <span 
                  v-if="letter.status === 'published'"
                  class="px-2 py-0.5 rounded-full text-[10px] bg-[#DEF7EC] text-[#03543F] dark:bg-[#052E16] dark:text-[#4ADE80]"
                >
                  Đã đăng
                </span>
                <span 
                  v-else
                  class="px-2 py-0.5 rounded-full text-[10px] bg-surface-1 text-text-secondary border border-border"
                >
                  Nháp
                </span>
              </td>
              <td class="py-3 px-2 text-right">
                <div class="flex justify-end gap-3 text-base text-text-muted">
                  <RouterLink :to="`/admin/letter/edit/${letter.id}`" class="hover:text-romantic-600">
                    <i class="ti ti-edit"></i>
                  </RouterLink>
                  <button @click="deleteLetter(letter.id, letter.title)" class="hover:text-red-500 cursor-pointer">
                    <i class="ti ti-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
