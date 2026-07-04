import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDarkMode = ref<boolean>(false)

  // Initialize theme from localStorage or fallback database default
  function initTheme(defaultMode?: 'light' | 'dark') {
    const savedTheme = localStorage.getItem('theme-preference')
    if (savedTheme) {
      isDarkMode.value = savedTheme === 'dark'
    } else if (defaultMode) {
      isDarkMode.value = defaultMode === 'dark'
    } else {
      // Browser preference fallback
      isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    applyTheme()
  }

  function toggleTheme() {
    isDarkMode.value = !isDarkMode.value
    localStorage.setItem('theme-preference', isDarkMode.value ? 'dark' : 'light')
    applyTheme()
  }

  function applyTheme() {
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return {
    isDarkMode,
    initTheme,
    toggleTheme
  }
})
