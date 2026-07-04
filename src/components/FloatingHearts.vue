<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Heart {
  id: number
  left: string
  size: string
  delay: string
  duration: string
  color: string
}

const hearts = ref<Heart[]>([])

const colors = [
  'rgba(212, 83, 126, 0.45)', // #D4537E with opacity
  'rgba(251, 113, 133, 0.5)',  // #fb7185
  'rgba(253, 164, 175, 0.4)',  // #fda4af
  'rgba(244, 63, 94, 0.35)',   // Rose/romantic
  'rgba(146, 51, 86, 0.3)'     // Rosewood
]

onMounted(() => {
  // Spawns 15 randomized hearts
  const tempHearts: Heart[] = []
  for (let i = 0; i < 15; i++) {
    const sizeVal = Math.floor(Math.random() * 16) + 10 // 10px to 25px
    tempHearts.push({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${sizeVal}px`,
      delay: `${Math.random() * 10}s`,
      duration: `${Math.random() * 8 + 8}s`, // 8s to 16s
      color: colors[Math.floor(Math.random() * colors.length)]
    })
  }
  hearts.value = tempHearts
})
</script>

<template>
  <div class="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
    <svg 
      v-for="heart in hearts" 
      :key="heart.id"
      class="absolute bottom-0 float-heart"
      :style="{
        left: heart.left,
        width: heart.size,
        height: heart.size,
        animationDelay: heart.delay,
        animationDuration: heart.duration,
        fill: heart.color
      }"
      viewBox="0 0 24 24"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  </div>
</template>

<style scoped>
.float-heart {
  opacity: 0;
  transform: translateY(10%) scale(0.8);
  animation: floatUp linear infinite;
  will-change: transform, opacity;
}

@keyframes floatUp {
  0% {
    transform: translateY(10vh) rotate(0deg) scale(0.8);
    opacity: 0;
  }
  15% {
    opacity: 0.65;
  }
  85% {
    opacity: 0.4;
  }
  100% {
    transform: translateY(-110vh) rotate(270deg) scale(1.1);
    opacity: 0;
  }
}
</style>
