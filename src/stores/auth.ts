import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const role = ref<'admin' | 'partner' | null>(null)
  const displayName = ref<string | null>(null)
  const avatarUrl = ref<string | null>(null)
  const loading = ref<boolean>(true)

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, display_name, avatar_url')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error.message)
        return
      }

      if (data) {
        role.value = data.role as 'admin' | 'partner'
        displayName.value = data.display_name
        avatarUrl.value = data.avatar_url
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err)
    }
  }

  async function initialize() {
    loading.value = true
    try {
      // 1. Get initial session
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        user.value = session.user
        await fetchProfile(session.user.id)
      } else {
        resetState()
      }

      // 2. Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (newSession?.user) {
          user.value = newSession.user
          await fetchProfile(newSession.user.id)
        } else {
          resetState()
        }
        loading.value = false
      })
    } catch (err) {
      console.error('Error initializing auth:', err)
    } finally {
      loading.value = false
    }
  }

  function resetState() {
    user.value = null
    role.value = null
    displayName.value = null
    avatarUrl.value = null
  }

  async function logout() {
    loading.value = true
    await supabase.auth.signOut()
    resetState()
    loading.value = false
  }

  return {
    user,
    role,
    displayName,
    avatarUrl,
    loading,
    initialize,
    logout,
    fetchProfile
  }
})
