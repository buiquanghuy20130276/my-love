<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'vue-sonner'

interface MapLocation {
  id: string
  name: string
  lat: number
  lng: number
  note: string
  image_url: string | null
  link: string | null
}

const locations = ref<MapLocation[]>([])
const loading = ref(true)

async function fetchLocations() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('love_map_locations')
      .select('*')
    if (error) throw error
    locations.value = data || []
  } catch (err: any) {
    toast.error('Lỗi khi tải danh sách địa điểm: ' + err.message)
  } finally {
    loading.value = false
  }
}

async function deleteLocation(id: string, name: string) {
  const confirmDelete = confirm(`Bạn có chắc chắn muốn xóa địa điểm "${name}"?`)
  if (!confirmDelete) return

  try {
    const { error } = await supabase
      .from('love_map_locations')
      .delete()
      .eq('id', id)

    if (error) throw error
    toast.success('Đã xóa địa điểm thành công!')
    fetchLocations()
  } catch (err: any) {
    toast.error('Lỗi khi xóa địa điểm: ' + err.message)
  }
}

onMounted(() => {
  fetchLocations()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-lg font-bold font-serif">Bản đồ tình yêu</h2>
        <p class="text-xs text-text-muted">Quản lý những địa điểm kỷ niệm của hai người</p>
      </div>
      <RouterLink 
        to="/admin/map/new"
        class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs px-4 py-2.5 rounded-[var(--radius)] flex items-center gap-1.5 cursor-pointer font-medium transition duration-150"
      >
        <i class="ti ti-plus text-sm"></i>
        <span>Thêm địa điểm mới</span>
      </RouterLink>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3">
      <i class="ti ti-loader animate-spin text-2xl text-romantic-500"></i>
      <p class="text-xs text-text-muted">Đang tải danh sách địa điểm...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="locations.length === 0" class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-12 text-center">
      <i class="ti ti-map-pin text-4xl text-text-muted mb-2"></i>
      <p class="text-xs text-text-muted mb-4">Chưa có địa điểm kỷ niệm nào được lưu.</p>
      <RouterLink 
        to="/admin/map/new"
        class="text-xs text-[#D4537E] hover:underline font-semibold"
      >
        Thêm địa điểm đầu tiên ngay &rarr;
      </RouterLink>
    </div>

    <!-- Table List -->
    <div v-else class="bg-surface-2 dark:bg-[#1D1A1F]/30 border border-border rounded-2xl p-4 md:p-6">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-border text-text-secondary">
              <th class="py-2.5 px-2 font-medium w-[10%]">Hình ảnh</th>
              <th class="py-2.5 px-2 font-medium w-[25%]">Tên địa điểm</th>
              <th class="py-2.5 px-2 font-medium w-[30%]">Tọa độ & Liên kết</th>
              <th class="py-2.5 px-2 font-medium w-[20%]">Ghi chú</th>
              <th class="py-2.5 px-2 font-medium w-[15%] text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="loc in locations" 
              :key="loc.id"
              class="border-b border-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <td class="py-3 px-2">
                <div class="w-10 h-10 rounded-lg bg-surface-1 border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
                  <img v-if="loc.image_url" :src="loc.image_url" class="w-full h-full object-cover" />
                  <i v-else class="ti ti-photo text-text-muted"></i>
                </div>
              </td>
              <td class="py-3 px-2 font-medium text-gray-900 dark:text-gray-100">
                {{ loc.name }}
              </td>
              <td class="py-3 px-2 text-text-secondary space-y-1">
                <p class="font-mono text-[10px]">Vĩ độ (Lat): {{ loc.lat }}, Kinh độ (Lng): {{ loc.lng }}</p>
                <a 
                  v-if="loc.link" 
                  :href="loc.link" 
                  target="_blank" 
                  class="inline-flex items-center gap-1 text-[#D4537E] hover:underline text-[10px] truncate max-w-[200px]"
                >
                  <i class="ti ti-link"></i>
                  <span class="truncate">Xem liên kết bản đồ</span>
                </a>
                <span v-else class="text-[10px] text-text-muted">Không có liên kết</span>
              </td>
              <td class="py-3 px-2 text-text-secondary truncate max-w-[150px]">
                {{ loc.note }}
              </td>
              <td class="py-3 px-2 text-right">
                <div class="flex justify-end gap-3 text-base text-text-muted">
                  <RouterLink :to="`/admin/map/edit/${loc.id}`" class="hover:text-romantic-600">
                    <i class="ti ti-edit"></i>
                  </RouterLink>
                  <button @click="deleteLocation(loc.id, loc.name)" class="hover:text-red-500 cursor-pointer">
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
