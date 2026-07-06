<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const currentPath = computed(() => route.path)
</script>

<template>
  <nav 
    class="fixed bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-4 w-full md:max-w-[420px] bg-surface-2/95 dark:bg-[#1D1A1F]/95 backdrop-blur-md border-t md:border border-border md:rounded-2xl md:shadow-lg py-2.5 px-2 flex justify-around items-center z-50 transition-all duration-300"
  >
    <!-- Home Tab -->
    <RouterLink 
      to="/" 
      class="flex-1 flex flex-col items-center justify-center transition"
      :class="currentPath === '/' || currentPath.includes('/timeline') ? 'text-[#D4537E]' : 'text-text-muted hover:text-text-secondary'"
    >
      <i class="ti ti-home text-[22px] leading-none"></i>
      <span class="text-[10px] font-medium mt-1">Trang chủ</span>
    </RouterLink>

    <!-- Feed Tab -->
    <RouterLink 
      to="/feed" 
      class="flex-1 flex flex-col items-center justify-center transition"
      :class="currentPath === '/feed' ? 'text-[#D4537E]' : 'text-text-muted hover:text-text-secondary'"
    >
      <i class="ti ti-rss text-[22px] leading-none"></i>
      <span class="text-[10px] font-medium mt-1">Bảng tin</span>
    </RouterLink>

    <!-- Letters Tab -->
    <RouterLink 
      to="/letters" 
      class="flex-1 flex flex-col items-center justify-center transition"
      :class="currentPath === '/letters' ? 'text-[#D4537E]' : 'text-text-muted hover:text-text-secondary'"
    >
      <i class="ti ti-mail text-[22px] leading-none"></i>
      <span class="text-[10px] font-medium mt-1">Thư</span>
    </RouterLink>

    <!-- Map Tab -->
    <RouterLink 
      to="/map" 
      class="flex-1 flex flex-col items-center justify-center transition"
      :class="currentPath === '/map' ? 'text-[#D4537E]' : 'text-text-muted hover:text-text-secondary'"
    >
      <i class="ti ti-map-pin text-[22px] leading-none"></i>
      <span class="text-[10px] font-medium mt-1">Bản đồ</span>
    </RouterLink>

    <!-- Quiz Tab -->
    <RouterLink 
      to="/quiz" 
      class="flex-1 flex flex-col items-center justify-center transition"
      :class="currentPath === '/quiz' ? 'text-[#D4537E]' : 'text-text-muted hover:text-text-secondary'"
    >
      <i class="ti ti-brain text-[22px] leading-none"></i>
      <span class="text-[10px] font-medium mt-1">Câu đố</span>
    </RouterLink>

    <!-- Gallery Tab -->
    <RouterLink 
      to="/gallery" 
      class="flex-1 flex flex-col items-center justify-center transition"
      :class="currentPath === '/gallery' ? 'text-[#D4537E]' : 'text-text-muted hover:text-text-secondary'"
    >
      <i class="ti ti-photo text-[22px] leading-none"></i>
      <span class="text-[10px] font-medium mt-1">Ảnh</span>
    </RouterLink>
  </nav>
</template>
