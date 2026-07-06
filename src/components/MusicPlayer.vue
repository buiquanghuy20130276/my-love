<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { supabase } from '../lib/supabaseClient'

const musicUrl = ref('')
const musicTitle = ref('')
const isPlaying = ref(false)
const audioRef = ref<HTMLAudioElement | null>(null)
const activeListener = ref<(() => void) | null>(null)

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
    class="fixed bottom-22 right-4 z-40 bg-white/80 dark:bg-black/60 backdrop-blur-md border border-border rounded-full p-2 pr-4 flex items-center gap-2.5 shadow-md hover:shadow-lg transition duration-300 group max-w-[200px]"
  >
    <!-- Hidden Audio Element -->
    <audio 
      ref="audioRef" 
      :src="musicUrl" 
      loop 
      @play="handleAudioPlay" 
      @pause="handleAudioPause"
    ></audio>

    <!-- Vinyl Disc (Spinning CD) -->
    <div 
      @click="togglePlay"
      class="w-10 h-10 rounded-full bg-neutral-900 border border-black flex items-center justify-center cursor-pointer shadow-inner relative flex-shrink-0 select-none"
      :class="isPlaying ? 'animate-spin-slow' : ''"
    >
      <!-- Vinyl Lines -->
      <div class="absolute inset-1 rounded-full border border-neutral-800/40"></div>
      <div class="absolute inset-2 rounded-full border border-neutral-700/30"></div>
      <!-- Center Sticker -->
      <div class="w-3.5 h-3.5 rounded-full bg-romantic-300 dark:bg-rosewood-800 flex items-center justify-center">
        <!-- Spindle Hole -->
        <div class="w-1 h-1 rounded-full bg-white"></div>
      </div>
      
      <!-- Play/Pause Overlay -->
      <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition">
        <i v-if="isPlaying" class="ti ti-pause text-white text-xs"></i>
        <i v-else class="ti ti-player-play-filled text-white text-xs"></i>
      </div>
    </div>

    <!-- Song Info -->
    <div class="min-w-0 flex flex-col justify-center cursor-pointer select-none" @click="togglePlay">
      <p class="text-[10px] font-bold text-gray-900 dark:text-gray-100 truncate w-[100px] leading-tight">
        {{ musicTitle }}
      </p>
      <p class="text-[8px] text-text-muted leading-tight mt-0.5 uppercase tracking-wider font-semibold">
        {{ isPlaying ? 'Đang phát' : 'Tạm dừng' }}
      </p>
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
