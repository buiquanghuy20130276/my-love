<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
import { useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

const currentPath = computed(() => route.path)
</script>

<template>
  <div class="min-h-screen bg-surface-2 dark:bg-[#121013] text-gray-800 dark:text-gray-100 flex flex-col md:flex-row">
    
    <!-- Sidebar on PC, top menu on mobile -->
    <aside class="w-full md:w-[220px] bg-surface-1 dark:bg-[#1D1A1F] border-b md:border-b-0 md:border-r border-border p-5 flex flex-col justify-between flex-shrink-0">
      <div>
        <!-- Logo / Title -->
        <div class="flex items-center gap-2 mb-6 px-1">
          <i class="ti ti-heart-filled text-romantic-500 text-lg"></i>
          <span class="text-sm font-semibold tracking-wide uppercase">Admin Panel</span>
        </div>

        <!-- Navigation Menu -->
        <nav class="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 no-scrollbar">
          <RouterLink 
            to="/admin" 
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
            :class="currentPath === '/admin' || currentPath.includes('/admin/letter') ? 'bg-[#FBEAF0] dark:bg-rosewood-950/40 text-[#993556] dark:text-[#F4C0D1]' : 'hover:bg-black/5 dark:hover:bg-white/5 text-text-secondary'"
          >
            <i class="ti ti-mail-heart text-base"></i>
            <span>Thư xin lỗi</span>
          </RouterLink>

          <RouterLink 
            to="/admin/timeline" 
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
            :class="currentPath.includes('/admin/timeline') ? 'bg-[#FBEAF0] dark:bg-rosewood-950/40 text-[#993556] dark:text-[#F4C0D1]' : 'hover:bg-black/5 dark:hover:bg-white/5 text-text-secondary'"
          >
            <i class="ti ti-timeline text-base"></i>
            <span>Dòng thời gian</span>
          </RouterLink>

          <RouterLink 
            to="/admin/map" 
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
            :class="currentPath.includes('/admin/map') ? 'bg-[#FBEAF0] dark:bg-rosewood-950/40 text-[#993556] dark:text-[#F4C0D1]' : 'hover:bg-black/5 dark:hover:bg-white/5 text-text-secondary'"
          >
            <i class="ti ti-map-pin text-base"></i>
            <span>Bản đồ tình yêu</span>
          </RouterLink>

          <RouterLink 
            to="/admin/gallery" 
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
            :class="currentPath === '/admin/gallery' ? 'bg-[#FBEAF0] dark:bg-rosewood-950/40 text-[#993556] dark:text-[#F4C0D1]' : 'hover:bg-black/5 dark:hover:bg-white/5 text-text-secondary'"
          >
            <i class="ti ti-photo-heart text-base"></i>
            <span>Kho ảnh & Video</span>
          </RouterLink>

          <RouterLink 
            to="/admin/bucket" 
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
            :class="currentPath === '/admin/bucket' ? 'bg-[#FBEAF0] dark:bg-rosewood-950/40 text-[#993556] dark:text-[#F4C0D1]' : 'hover:bg-black/5 dark:hover:bg-white/5 text-text-secondary'"
          >
            <i class="ti ti-target text-base"></i>
            <span>Nguyện vọng đôi</span>
          </RouterLink>



          <RouterLink 
            to="/admin/settings" 
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
            :class="currentPath === '/admin/settings' ? 'bg-[#FBEAF0] dark:bg-rosewood-950/40 text-[#993556] dark:text-[#F4C0D1]' : 'hover:bg-black/5 dark:hover:bg-white/5 text-text-secondary'"
          >
            <i class="ti ti-settings text-base"></i>
            <span>Cài đặt</span>
          </RouterLink>

          <RouterLink 
            to="/" 
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap text-text-secondary hover:bg-black/5 dark:hover:bg-white/5"
          >
            <i class="ti ti-external-link text-base"></i>
            <span>Xem trang chính</span>
          </RouterLink>
        </nav>
      </div>

      <!-- User footer / Logout -->
      <div class="hidden md:flex flex-col gap-3 pt-4 border-t border-border mt-auto">
        <div class="flex items-center gap-2.5 px-1">
          <div class="w-8 h-8 rounded-full bg-romantic-100 dark:bg-rosewood-950/50 flex items-center justify-center font-bold text-romantic-700 text-xs">
            {{ authStore.displayName?.[0] || 'A' }}
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium truncate">{{ authStore.displayName || 'Admin' }}</p>
            <p class="text-[10px] text-text-muted truncate">Quản trị viên</p>
          </div>
        </div>
        <button 
          @click="handleLogout"
          class="w-full flex items-center justify-center gap-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-medium py-2 rounded-xl cursor-pointer transition"
        >
          <i class="ti ti-logout text-sm"></i>
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 p-6 md:p-8 overflow-y-auto max-w-6xl w-full mx-auto">
      <RouterView />
    </main>

  </div>
</template>
