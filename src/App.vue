<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'
import { Toaster } from 'vue-sonner'
import { useRoute } from 'vue-router'
import FloatingHearts from './components/FloatingHearts.vue'
import MusicPlayer from './components/MusicPlayer.vue'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const route = useRoute()

onMounted(async () => {
  // Initialize theme mode
  themeStore.initTheme()
  // Trigger auth check
  await authStore.initialize()
})
</script>

<template>
  <!-- Global Toast Provider -->
  <Toaster position="top-center" richColors />
  
  <!-- Floating Hearts Background (disabled in admin panels) -->
  <FloatingHearts v-if="!route.path.includes('/admin')" />
  
  <!-- Global Music Player -->
  <MusicPlayer v-if="!route.path.includes('/admin') && authStore.user" />
  
  <!-- Router View Transition container -->
  <main class="min-h-screen">
    <RouterView />
  </main>
</template>
