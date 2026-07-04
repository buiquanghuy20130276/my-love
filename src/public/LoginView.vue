<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/auth'

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const router = useRouter()
const authStore = useAuthStore()

async function handleLogin() {
  if (!email.value || !password.value) {
    errorMessage.value = 'Vui lòng điền đầy đủ email và mật khẩu.'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    let loginEmail = email.value.trim()
    if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@love.com`
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: password.value,
    })

    if (error) {
      if (error.message === 'Invalid login credentials') {
        errorMessage.value = 'Sai tài khoản hoặc mật khẩu.'
      } else {
        errorMessage.value = 'Đã xảy ra lỗi: ' + error.message
      }
      loading.value = false
      return
    }

    if (data.user) {
      await authStore.fetchProfile(data.user.id)
      if (authStore.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/')
      }
    }
  } catch (err: any) {
    errorMessage.value = 'Không thể kết nối đến máy chủ.'
    console.error(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-1 flex items-center justify-center p-4 transition-colors duration-300">
    <div class="w-[320px] bg-surface-2 border border-border rounded-[20px] p-8 flex flex-col items-center shadow-sm">
      
      <!-- Heart badge -->
      <div class="w-14 h-14 rounded-full bg-[#FBEAF0] dark:bg-rosewood-950/30 flex items-center justify-center mb-4">
        <i class="ti ti-heart text-[26px] text-[#D4537E]" aria-hidden="true"></i>
      </div>

      <!-- Title & Subtitle -->
      <h1 class="font-serif text-[22px] font-medium text-gray-900 dark:text-gray-100 text-center mb-1">
        Câu chuyện của chúng ta
      </h1>
      <p class="text-[13px] text-text-secondary text-center mb-7 leading-relaxed">
        Đăng nhập để xem những kỷ niệm riêng của hai ta
      </p>

      <!-- Form -->
      <form @submit.prevent="handleLogin" class="w-full flex flex-col items-center">
        <!-- Error Alert -->
        <div v-if="errorMessage" class="w-full p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-100 dark:border-red-950/30 text-center mb-4">
          {{ errorMessage }}
        </div>

        <div class="w-full mb-3.5">
          <label class="text-[13px] text-text-secondary block mb-1.5">Email</label>
          <input
            v-model="email"
            type="text"
            placeholder="ten@email.com"
            class="w-full"
            :disabled="loading"
          />
        </div>

        <div class="w-full mb-5.5">
          <label class="text-[13px] text-text-secondary block mb-1.5">Mật khẩu</label>
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
            class="w-full"
            :disabled="loading"
          />
        </div>

        <button
          type="submit"
          class="w-full bg-[#D4537E] hover:bg-[#c2436d] text-white text-sm font-medium py-2.5 rounded-[var(--radius)] mb-3 transition-colors duration-150 cursor-pointer disabled:opacity-50"
          :disabled="loading"
        >
          <span v-if="loading">Đang đăng nhập...</span>
          <span v-else>Đăng nhập</span>
        </button>
      </form>

      <!-- Footer -->
      <p class="text-[12px] text-text-muted text-center mt-2">
        Chỉ dành riêng cho hai chúng ta 💌
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Reset input styling from Tailwind to match mockup inputs */
input {
  width: 100%;
}
</style>
