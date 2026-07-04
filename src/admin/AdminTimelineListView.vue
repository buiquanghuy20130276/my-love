<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'vue-sonner'
import draggable from 'vuedraggable'

interface TimelineEvent {
  id: string
  title: string
  event_date: string
  is_special: boolean
  sort_order: number
  timeline_images: { id: string }[]
}

const timelineEvents = ref<TimelineEvent[]>([])
const loading = ref(true)

// Fetch timeline events
async function fetchTimelineEvents() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('timeline_events')
      .select('id, title, event_date, is_special, sort_order, timeline_images(id)')
      .order('sort_order', { ascending: true })

    if (error) throw error
    timelineEvents.value = data || []
  } catch (err: any) {
    toast.error('Lỗi khi tải dòng thời gian: ' + err.message)
  } finally {
    loading.value = false
  }
}

// Delete event
async function deleteEvent(id: string, title: string) {
  const confirmDelete = confirm(`Bạn có chắc chắn muốn xóa mốc thời gian "${title}"? Tất cả ảnh liên quan cũng sẽ bị xóa.`)
  if (!confirmDelete) return

  try {
    // 1. Fetch linked images to delete from Storage first
    const { data: eventImages } = await supabase
      .from('timeline_images')
      .select('image_url')
      .eq('timeline_event_id', id)

    if (eventImages && eventImages.length > 0) {
      const paths = eventImages.map(img => {
        const parts = img.image_url.split('/timeline-images/')
        return parts.length >= 2 ? parts[1] : null
      }).filter(Boolean) as string[]

      if (paths.length > 0) {
        await supabase.storage.from('timeline-images').remove(paths)
      }
    }

    // 2. Delete database row (which cascade deletes the timeline_images table rows)
    const { error } = await supabase
      .from('timeline_events')
      .delete()
      .eq('id', id)

    if (error) throw error
    toast.success('Đã xóa mốc thời gian thành công!')
    fetchTimelineEvents()
  } catch (err: any) {
    toast.error('Lỗi khi xóa mốc thời gian: ' + err.message)
  }
}

// Update order on drag-end
async function onDragEnd() {
  try {
    const updates = timelineEvents.value.map((event, index) => {
      return supabase
        .from('timeline_events')
        .update({ sort_order: index })
        .eq('id', event.id)
    })

    const results = await Promise.all(updates)
    const failedUpdate = results.find(r => r.error)
    if (failedUpdate) throw failedUpdate.error

    toast.success('Cập nhật thứ tự thành công!')
  } catch (err: any) {
    toast.error('Lỗi khi cập nhật thứ tự: ' + err.message)
  }
}

onMounted(() => {
  fetchTimelineEvents()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-lg font-bold font-serif">Dòng thời gian</h2>
        <p class="text-xs text-text-muted">Kỷ niệm hành trình yêu nhau của hai bạn</p>
      </div>
      <RouterLink 
        to="/admin/timeline/new"
        class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs px-4 py-2.5 rounded-[var(--radius)] flex items-center gap-1.5 cursor-pointer font-medium transition duration-150"
      >
        <i class="ti ti-plus text-sm"></i>
        <span>Thêm mốc mới</span>
      </RouterLink>
    </div>

    <!-- Drag instruction -->
    <p class="text-xs text-text-secondary mb-4 flex items-center gap-1">
      <i class="ti ti-info-circle"></i>
      <span>Kéo thả các mục để sắp xếp thứ tự hiển thị trên trang chủ</span>
    </p>

    <!-- Loading state -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <i class="ti ti-loader animate-spin text-2xl text-romantic-500"></i>
      <p class="text-xs text-text-muted">Đang tải dòng thời gian...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="timelineEvents.length === 0" class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-12 text-center">
      <i class="ti ti-timeline text-4xl text-text-muted mb-2"></i>
      <p class="text-xs text-text-muted mb-4">Chưa có mốc thời gian nào được tạo.</p>
      <RouterLink 
        to="/admin/timeline/new"
        class="text-xs text-[#D4537E] hover:underline font-semibold"
      >
        Tạo mốc thời gian đầu tiên ngay &rarr;
      </RouterLink>
    </div>

    <!-- Drag and Drop List -->
    <div v-else>
      <draggable 
        v-model="timelineEvents"
        @end="onDragEnd"
        item-key="id"
        handle=".drag-handle"
        ghost-class="opacity-50"
        class="space-y-3"
      >
        <template #item="{ element }">
          <div 
            class="flex items-center gap-3 border border-border rounded-2xl p-3 bg-surface-1 dark:bg-[#1D1A1F]/30 hover:shadow-sm transition"
          >
            <!-- Drag Handle -->
            <button class="drag-handle text-lg text-text-muted hover:text-gray-900 dark:hover:text-gray-100 p-1 cursor-grab active:cursor-grabbing">
              <i class="ti ti-grip-vertical"></i>
            </button>

            <!-- Placeholder or Thumbnail -->
            <div class="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
              <i class="ti ti-photo text-lg text-text-muted"></i>
            </div>

            <!-- Content info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {{ element.title }}
              </p>
              <p class="text-[11px] text-text-secondary mt-0.5">
                {{ element.event_date }} &middot; {{ element.timeline_images?.length || 0 }} ảnh
              </p>
            </div>

            <!-- Badges -->
            <div class="flex items-center gap-3 flex-shrink-0">
              <span 
                v-if="element.is_special"
                class="px-2.5 py-0.5 rounded-full text-[10px] bg-[#FBEAF0] dark:bg-rosewood-950/40 text-[#993556] dark:text-[#F4C0D1] font-medium"
              >
                Đặc biệt
              </span>

              <!-- Actions -->
              <div class="flex items-center gap-3 text-base text-text-muted">
                <RouterLink :to="`/admin/timeline/edit/${element.id}`" class="hover:text-romantic-600">
                  <i class="ti ti-edit"></i>
                </RouterLink>
                <button @click="deleteEvent(element.id, element.title)" class="hover:text-red-500 cursor-pointer">
                  <i class="ti ti-trash"></i>
                </button>
              </div>
            </div>

          </div>
        </template>
      </draggable>
    </div>

  </div>
</template>
