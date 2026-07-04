<script setup lang="ts">
import { useThemeStore } from '../stores/theme'

const themeStore = useThemeStore()
</script>

<template>
  <button 
    @click="themeStore.toggleTheme"
    type="button"
    class="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-surface-2/85 dark:bg-[#1D1A1F]/85 backdrop-blur border border-border shadow-md flex items-center justify-center cursor-pointer transition hover:scale-105 active:scale-95"
    title="Đổi giao diện sáng/tối"
  >
    <i 
      v-if="themeStore.isDarkMode" 
      class="ti ti-sun text-yellow-500 text-lg transition-transform duration-300 rotate-0 hover:rotate-45"
    ></i>
    <i 
      v-else 
      class="ti ti-moon text-[#72243E] text-lg transition-transform duration-300 rotate-0 hover:-rotate-12"
    ></i>
  </button>
</template>
