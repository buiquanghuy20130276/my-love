<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
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

// Pagination states
const currentPage = ref(0)
const pageSize = 10
const filteredTotalCount = ref(0)
const totalCount = ref(0)
const publishedCount = ref(0)
const draftCount = ref(0)
const uniqueTags = ref<string[]>(['Tất cả'])
const loadingMore = ref(false)
const hasMore = ref(true)
const loadMoreTrigger = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null


// Fetch Stats (Totals, Published, Drafts)
async function fetchStats() {
  try {
    const { count: total } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
    totalCount.value = total || 0

    const { count: published } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
    publishedCount.value = published || 0

    const { count: draft } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft')
    draftCount.value = draft || 0
  } catch (err: any) {
    console.error('Lỗi khi tải thống kê thư:', err)
  }
}

// Fetch all unique tags for filter
async function fetchUniqueTags() {
  try {
    const { data } = await supabase.from('letters').select('tag')
    const tags = new Set<string>()
    if (data) {
      data.forEach(l => {
        if (l.tag) tags.add(l.tag)
      })
    }
    uniqueTags.value = ['Tất cả', ...Array.from(tags)]
  } catch (err: any) {
    console.error('Lỗi khi tải danh sách nhãn:', err)
  }
}

// Fetch letters with range-based pagination
async function fetchLetters(isInitial = true) {
  if (isInitial) {
    loading.value = true
    currentPage.value = 0
    letters.value = []
    hasMore.value = true
  } else {
    loadingMore.value = true
  }

  const from = currentPage.value * pageSize
  const to = from + pageSize - 1

  try {
    let query = supabase
      .from('letters')
      .select('id, title, tag, status, unlock_date, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (selectedTagFilter.value !== 'Tất cả') {
      query = query.eq('tag', selectedTagFilter.value)
    }

    const { data, count, error } = await query

    if (error) throw error

    if (data) {
      if (isInitial) {
        letters.value = data
      } else {
        letters.value = [...letters.value, ...data]
      }
      if (data.length < pageSize) {
        hasMore.value = false
      }
    } else {
      hasMore.value = false
    }
    filteredTotalCount.value = count || 0
  } catch (err: any) {
    toast.error('Lỗi khi tải danh sách thư: ' + err.message)
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
  await fetchLetters(false)
}

// Delete letter
async function deleteLetter(id: string, title: string) {
  const confirmDelete = confirm(`Bạn có chắc chắn muốn xóa lá thư "${title}" không?`)
  if (!confirmDelete) return

  try {
    // 1. Fetch letter details to check cover image URL
    const { data: letterData } = await supabase
      .from('letters')
      .select('cover_image_url')
      .eq('id', id)
      .single()

    if (letterData && letterData.cover_image_url) {
      const urlParts = letterData.cover_image_url.split('/letter-images/')
      if (urlParts.length >= 2) {
        const filePath = urlParts[1]
        await supabase.storage.from('letter-images').remove([filePath])
      }
    }

    // 2. Delete database row
    const { error } = await supabase
      .from('letters')
      .delete()
      .eq('id', id)

    if (error) throw error
    toast.success('Đã xóa thư thành công!')
    
    // Refresh stats and unique tags
    fetchStats()
    fetchUniqueTags()
    
    // Adjust current page if needed
    if (letters.value.length === 1 && currentPage.value > 0) {
      currentPage.value--
    }
    fetchLetters()
  } catch (err: any) {
    toast.error('Lỗi khi xóa thư: ' + err.message)
  }
}

// Unique tags for filter dropdown
const allTags = computed(() => uniqueTags.value)

// Filtered letters (already filtered on db level)
const filteredLetters = computed(() => letters.value)

// Reset page and reload on tag change
watch(selectedTagFilter, () => {
  fetchLetters()
})

onMounted(() => {
  fetchStats()
  fetchUniqueTags()
  fetchLetters()

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

      <!-- Load More Trigger & Loading indicator -->
      <div 
        ref="loadMoreTrigger" 
        class="py-6 flex flex-col justify-center items-center gap-2 select-none border-t border-border mt-4"
      >
        <template v-if="loadingMore">
          <i class="ti ti-loader animate-spin text-lg text-[#D4537E]"></i>
          <span class="text-xs text-text-muted">Đang tải thêm thư...</span>
        </template>
        <template v-else-if="!hasMore && letters.length > 0">
          <span class="text-[11px] text-text-muted italic">Đã tải toàn bộ thư trong danh sách (Tổng số {{ filteredTotalCount }} thư).</span>
        </template>
      </div>
    </div>
  </div>
</template>
