<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { supabase } from '../lib/supabaseClient'

const musicUrl = ref('')
const musicTitle = ref('')
const isPlaying = ref(false)
const isExpanded = ref(false)
const audioRef = ref<HTMLAudioElement | null>(null)
const activeListener = ref<(() => void) | null>(null)

function handleDiscClick() {
  togglePlay()
  isExpanded.value = true
}

async function fetchMusicSettings() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('music_url, music_title')
      .eq('id', 1)
      .single()

    if (data) {
      musicUrl.value = data.music_url || ''
      musicTitle.value = data.music_title || 'Bài hát kỷ niệm'
      
      if (musicUrl.value) {
        await nextTick()
        attemptAutoplay()
      }
    }
  } catch (err) {
    console.error('Error fetching music settings:', err)
  }
}

function attemptAutoplay() {
  if (!audioRef.value) return
  
  // Force browser to load the audio source
  audioRef.value.load()
  
  // Try immediate autoplay
  audioRef.value.play()
    .then(() => {
      isPlaying.value = true
    })
    .catch(() => {
      // Fallback: play on first user interaction anywhere
      const startPlay = () => {
        if (audioRef.value) {
          audioRef.value.load()
          audioRef.value.play()
            .then(() => {
              isPlaying.value = true
              removeInteractionListeners()
            })
            .catch(err => {
              console.warn('Autoplay fallback failed:', err)
            })
        }
      }
      
      activeListener.value = startPlay
      window.addEventListener('click', startPlay, { once: true })
      window.addEventListener('touchstart', startPlay, { once: true })
      window.addEventListener('scroll', startPlay, { once: true })
      window.addEventListener('keydown', startPlay, { once: true })
    })
}

function removeInteractionListeners() {
  if (activeListener.value) {
    window.removeEventListener('click', activeListener.value)
    window.removeEventListener('touchstart', activeListener.value)
    window.removeEventListener('scroll', activeListener.value)
    window.removeEventListener('keydown', activeListener.value)
    activeListener.value = null
  }
}

function togglePlay() {
  if (!audioRef.value || !musicUrl.value) return
  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play().catch(err => {
      console.warn('Playback failed, user interaction may be required:', err)
    })
  }
  isPlaying.value = !isPlaying.value
}

function handleAudioPlay() {
  isPlaying.value = true
}

function handleAudioPause() {
  isPlaying.value = false
}

onMounted(() => {
  fetchMusicSettings()
})

onUnmounted(() => {
  removeInteractionListeners()
})
</script>

<template>
  <div 
    v-if="musicUrl"
    class="fixed bottom-24 right-4 md:right-[calc(50%-190px)] z-[60] bg-[#FDFBF7]/90 dark:bg-[#1F1C18]/90 backdrop-blur-md border border-[#EBE6DC] dark:border-transparent rounded-full p-1 flex items-center shadow-lg hover:shadow-xl transition-all duration-500 ease-in-out select-none group"
    :class="isExpanded ? 'pr-3 gap-2 max-w-[240px]' : 'pr-1 max-w-[42px]'"
  >
    <!-- Hidden Audio Element -->
    <audio 
      ref="audioRef" 
      :src="musicUrl" 
      loop 
      @play="handleAudioPlay" 
      @pause="handleAudioPause"
    ></audio>

    <!-- Vinyl Disc (Spinning CD) - w-8 h-8 -->
    <div 
      @click="handleDiscClick"
      class="w-8 h-8 rounded-full bg-[#1A1816] border border-neutral-900 flex items-center justify-center cursor-pointer shadow-md relative flex-shrink-0 select-none transition-transform hover:scale-105 duration-300"
      :class="isPlaying ? 'animate-spin-slow' : ''"
    >
      <!-- Vinyl Lines -->
      <div class="absolute inset-1 rounded-full border border-neutral-800/40"></div>
      <div class="absolute inset-2 rounded-full border border-neutral-700/30"></div>
      <!-- Center Sticker -->
      <div class="w-2.5 h-2.5 rounded-full bg-romantic-300 dark:bg-rosewood-800 flex items-center justify-center">
        <!-- Spindle Hole -->
        <div class="w-0.5 h-0.5 rounded-full bg-[#FDFBF7]"></div>
      </div>
      
      <!-- Play/Pause Overlay -->
      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition duration-300">
        <i v-if="isPlaying" class="ti ti-pause text-white text-[9px]"></i>
        <i v-else class="ti ti-player-play-filled text-white text-[9px]"></i>
      </div>
      
      <!-- Blinking Pulse indicator when paused -->
      <div 
        v-if="!isPlaying" 
        class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border border-[#FDFBF7] dark:border-neutral-800 animate-pulse"
      ></div>
    </div>

    <!-- Song Info & Controls (slide-out container) -->
    <div 
      class="flex items-center justify-between min-w-0 transition-all duration-500 ease-in-out flex-1"
      :class="isExpanded ? 'opacity-100 w-auto pointer-events-auto' : 'opacity-0 w-0 overflow-hidden pointer-events-none'"
    >
      <div class="min-w-0 flex flex-col justify-center cursor-pointer flex-1 mr-2" @click="togglePlay">
        <p class="text-[9px] font-bold text-gray-900 dark:text-gray-100 truncate w-[100px] leading-tight">
          {{ musicTitle }}
        </p>
        <p class="text-[7px] text-text-muted leading-tight mt-0.5 uppercase tracking-wider font-semibold">
          {{ isPlaying ? 'Đang phát' : 'Tạm dừng' }}
        </p>
      </div>

      <!-- Collapse Trigger Button -->
      <button 
        @click.stop="isExpanded = false"
        class="text-text-muted hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer p-0.5 transition duration-300 flex items-center justify-center"
      >
        <i class="ti ti-chevron-right text-xs"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.animate-spin-slow {
  animation: spin 12s linear infinite;
}
</style>
