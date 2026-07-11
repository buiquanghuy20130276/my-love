<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/auth'
import Navbar from '../components/Navbar.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { toast } from 'vue-sonner'
import dayjs from 'dayjs'

interface QuizQuestion {
  id: string
  question: string
  options: string[] | null
  correct_index: number | null
  quiz_type: 'essay' | 'single' | 'multiple'
  created_by: string
  profiles: {
    display_name: string
    role: string
  } | null
}

interface QuizAnswer {
  id: string
  question_id: string
  profile_id: string
  selected_options: number[] | null
  essay_answer: string | null
  created_at: string
  profiles: {
    display_name: string
    role: string
  } | null
}

interface QuizComment {
  id: string
  question_id: string
  profile_id: string
  content: string
  created_at: string
  profiles: {
    display_name: string
    role: string
  } | null
}

const authStore = useAuthStore()

const questions = ref<QuizQuestion[]>([])
const myAnswers = ref<Record<string, QuizAnswer>>({})
const loading = ref(true)

// Modal add quiz state
const showAddModal = ref(false)
const isEditingQuiz = ref(false)
const editingQuizId = ref<string | null>(null)
const newQuestionText = ref('')
const newQuizType = ref<'essay' | 'single' | 'multiple'>('single')
const newOptions = ref<string[]>(['', ''])
const submittingQuiz = ref(false)

function openCreateQuiz() {
  isEditingQuiz.value = false
  editingQuizId.value = null
  newQuestionText.value = ''
  newQuizType.value = 'single'
  newOptions.value = ['', '']
  showAddModal.value = true
}

function openEditQuiz(q: QuizQuestion) {
  isEditingQuiz.value = true
  editingQuizId.value = q.id
  newQuestionText.value = q.question
  newQuizType.value = q.quiz_type
  newOptions.value = q.options ? [...q.options] : ['', '']
  showAddModal.value = true
}

async function saveQuizQuestion() {
  if (isEditingQuiz.value) {
    await updateQuizQuestion()
  } else {
    await createQuizQuestion()
  }
}

// Detail modal state
const activeQuestion = ref<QuizQuestion | null>(null)
const activeAnswers = ref<QuizAnswer[]>([])
const mySelection = ref<number[]>([]) // for choice quiz answering
const mySingleSelection = ref<number | null>(null)
const myEssayAnswer = ref('') // for essay quiz answering
const submittingAnswer = ref(false)
const isEditingAnswer = ref(false)

// Custom Confirm Modal state
const showConfirmModal = ref(false)
const confirmModalTitle = ref('')
const confirmModalMessage = ref('')
const confirmModalAction = ref<(() => Promise<void>) | null>(null)

function openConfirmModal(title: string, message: string, action: () => Promise<void>) {
  confirmModalTitle.value = title
  confirmModalMessage.value = message
  confirmModalAction.value = action
  showConfirmModal.value = true
}

async function triggerConfirmModalAction() {
  if (confirmModalAction.value) {
    try {
      await confirmModalAction.value()
    } catch (err) {
      console.error(err)
    }
  }
  showConfirmModal.value = false
}

function isAnswerEditable(questionId: string) {
  const ans = myAnswers.value[questionId]
  if (!ans) return false
  const created = dayjs(ans.created_at)
  const now = dayjs()
  const diffMinutes = now.diff(created, 'minute')
  return diffMinutes < 5
}

// Essay comments state
const activeComments = ref<QuizComment[]>([])
const loadingComments = ref(false)
const newCommentText = ref('')
const submittingComment = ref(false)

// Fetch data
async function loadQuizData() {
  loading.value = true
  try {
    // 1. Fetch questions
    const { data: qData, error: qError } = await supabase
      .from('quiz_questions')
      .select('id, question, options, correct_index, quiz_type, created_by, profiles(display_name, role)')
      .order('created_at', { ascending: false })

    if (qError) throw qError
    questions.value = (qData || []).map((q: any) => ({
      ...q,
      profiles: Array.isArray(q.profiles) ? q.profiles[0] : q.profiles
    }))

    // 2. Fetch my answers
    if (authStore.user) {
      const { data: aData, error: aError } = await supabase
        .from('quiz_answers')
        .select('*')
        .eq('profile_id', authStore.user.id)

      if (aError) throw aError
      const ansMap: Record<string, QuizAnswer> = {}
      ;(aData || []).forEach(ans => {
        ansMap[ans.question_id] = ans
      })
      myAnswers.value = ansMap
    }
  } catch (err: any) {
    toast.error('Lỗi khi tải câu đố: ' + err.message)
  } finally {
    loading.value = false
  }
}

// Add option to choices array
function addOption() {
  newOptions.value.push('')
}

// Remove option from choices array
function removeOption(index: number) {
  if (newOptions.value.length > 2) {
    newOptions.value.splice(index, 1)
  }
}

// Create Question
async function createQuizQuestion() {
  if (!newQuestionText.value.trim()) {
    toast.error('Vui lòng nhập câu hỏi.')
    return
  }

  if (newQuizType.value !== 'essay') {
    const validOptions = newOptions.value.filter(o => o.trim())
    if (validOptions.length < 2) {
      toast.error('Vui lòng nhập ít nhất 2 lựa chọn.')
      return
    }
  }

  submittingQuiz.value = true
  try {
    const optionsPayload = newQuizType.value !== 'essay' ? newOptions.value.filter(o => o.trim()) : null
    const { error } = await supabase
      .from('quiz_questions')
      .insert([{
        question: newQuestionText.value.trim(),
        quiz_type: newQuizType.value,
        options: optionsPayload,
        created_by: authStore.user?.id
      }])

    if (error) throw error
    toast.success('Đã tạo câu đố thành công!')
    showAddModal.value = false
    newQuestionText.value = ''
    newOptions.value = ['', '']
    newQuizType.value = 'single'
    loadQuizData()
  } catch (err: any) {
    toast.error('Lỗi khi tạo câu đố: ' + err.message)
  } finally {
    submittingQuiz.value = false
  }
}

async function updateQuizQuestion() {
  if (!newQuestionText.value.trim() || !editingQuizId.value) return

  if (newQuizType.value !== 'essay') {
    const validOptions = newOptions.value.filter(o => o.trim())
    if (validOptions.length < 2) {
      toast.error('Vui lòng nhập ít nhất 2 lựa chọn.')
      return
    }
  }

  submittingQuiz.value = true
  try {
    const optionsPayload = newQuizType.value !== 'essay' ? newOptions.value.filter(o => o.trim()) : null
    
    const { error } = await supabase
      .from('quiz_questions')
      .update({
        question: newQuestionText.value.trim(),
        quiz_type: newQuizType.value,
        options: optionsPayload
      })
      .eq('id', editingQuizId.value)

    if (error) throw error
    toast.success('Đã cập nhật câu đố thành công!')
    showAddModal.value = false
    loadQuizData()
  } catch (err: any) {
    toast.error('Lỗi khi cập nhật câu đố: ' + err.message)
  } finally {
    submittingQuiz.value = false
  }
}

async function deleteQuizQuestion(questionId: string) {
  openConfirmModal(
    'Xóa câu đố',
    'Bạn có chắc chắn muốn xóa câu đố này không? Tất cả các câu trả lời liên quan cũng sẽ bị xóa.',
    async () => {
      try {
        const { error } = await supabase
          .from('quiz_questions')
          .delete()
          .eq('id', questionId)

        if (error) throw error
        toast.success('Đã xóa câu đố thành công!')
        loadQuizData()
      } catch (err: any) {
        toast.error('Lỗi khi xóa câu đố: ' + err.message)
      }
    }
  )
}

// Fetch all answers & comments for selected question details
async function openQuestionDetail(q: QuizQuestion) {
  activeQuestion.value = q
  isEditingAnswer.value = false
  mySelection.value = []
  mySingleSelection.value = null
  myEssayAnswer.value = ''
  activeAnswers.value = []
  activeComments.value = []
  showConfirmModal.value = false

  // Pre-fill answer if already answered
  const myAns = myAnswers.value[q.id]
  if (myAns) {
    if (q.quiz_type === 'essay') {
      myEssayAnswer.value = myAns.essay_answer || ''
    } else if (q.quiz_type === 'single') {
      mySingleSelection.value = myAns.selected_options?.[0] ?? null
    } else {
      mySelection.value = myAns.selected_options || []
    }
  }

  // Load all answers for this question
  try {
    const { data: answersData, error: answersError } = await supabase
      .from('quiz_answers')
      .select('id, question_id, profile_id, selected_options, essay_answer, created_at, profiles(display_name, role)')
      .eq('question_id', q.id)

    if (answersError) throw answersError
    activeAnswers.value = (answersData || []).map((a: any) => ({
      ...a,
      profiles: Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
    }))

    // Load comments if it is an essay question
    if (q.quiz_type === 'essay') {
      loadEssayComments(q.id)
    }
  } catch (err: any) {
    console.error('Lỗi khi tải chi tiết đáp án:', err.message)
  }
}

// Load Comments for Essay Quizzes
async function loadEssayComments(questionId: string) {
  loadingComments.value = true
  try {
    const { data, error } = await supabase
      .from('quiz_comments')
      .select('id, question_id, profile_id, content, created_at, profiles(display_name, role)')
      .eq('question_id', questionId)
      .order('created_at', { ascending: true })

    if (error) throw error
    activeComments.value = (data || []).map((c: any) => ({
      ...c,
      profiles: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
    }))
  } catch (err: any) {
    console.error('Lỗi khi tải bình luận câu đố:', err.message)
  } finally {
    loadingComments.value = false
  }
}

// Submit Answer
async function submitAnswer() {
  if (!activeQuestion.value || !authStore.user) return

  let selectedOptionsPayload: number[] | null = null
  let essayAnswerPayload: string | null = null

  if (activeQuestion.value.quiz_type === 'essay') {
    if (!myEssayAnswer.value.trim()) {
      toast.error('Vui lòng viết câu trả lời.')
      return
    }
    essayAnswerPayload = myEssayAnswer.value.trim()
  } else if (activeQuestion.value.quiz_type === 'single') {
    if (mySingleSelection.value === null) {
      toast.error('Vui lòng chọn 1 đáp án.')
      return
    }
    selectedOptionsPayload = [mySingleSelection.value]
  } else {
    if (mySelection.value.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 đáp án.')
      return
    }
    selectedOptionsPayload = mySelection.value
  }

  submittingAnswer.value = true
  try {
    const payload = {
      question_id: activeQuestion.value.id,
      profile_id: authStore.user.id,
      selected_options: selectedOptionsPayload,
      essay_answer: essayAnswerPayload
    }

    const { data, error } = await supabase
      .from('quiz_answers')
      .upsert(payload, { onConflict: 'question_id, profile_id' })
      .select()
      .single()

    if (error) throw error

    toast.success('Đã gửi câu trả lời thành công!')
    
    // Update local answers lists
    myAnswers.value[activeQuestion.value.id] = data
    isEditingAnswer.value = false
    openQuestionDetail(activeQuestion.value) // reload detailed info
    loadQuizData() // reload questions state
  } catch (err: any) {
    toast.error('Lỗi khi gửi câu trả lời: ' + err.message)
  } finally {
    submittingAnswer.value = false
  }
}

// Send Comment for Essay
async function sendQuizComment() {
  if (!newCommentText.value.trim() || !activeQuestion.value || !authStore.user) return
  submittingComment.value = true

  try {
    const { data, error } = await supabase
      .from('quiz_comments')
      .insert([{
        question_id: activeQuestion.value.id,
        profile_id: authStore.user.id,
        content: newCommentText.value.trim()
      }])
      .select('id, question_id, profile_id, content, created_at, profiles(display_name, role)')
      .single()

    if (error) throw error

    const normalized = {
      ...data,
      profiles: Array.isArray((data as any).profiles) ? (data as any).profiles[0] : (data as any).profiles
    }
    activeComments.value.push(normalized)
    newCommentText.value = ''
    toast.success('Đã gửi phản hồi!')
  } catch (err: any) {
    toast.error('Lỗi khi gửi phản hồi: ' + err.message)
  } finally {
    submittingComment.value = false
  }
}

// Delete Comment (custom popup trigger)
function deleteQuizComment(commentId: string) {
  openConfirmModal(
    'Xóa bình luận',
    'Bạn có chắc chắn muốn xóa bình luận này không?',
    async () => {
      try {
        console.log('Sending delete request to Supabase for comment:', commentId)
        const { data, error, status } = await supabase
          .from('quiz_comments')
          .delete()
          .eq('id', commentId)
          .select()

        console.log('Supabase delete comment response status:', status, 'data:', data, 'error:', error)
        if (error) throw error
        activeComments.value = activeComments.value.filter(c => c.id !== commentId)
        toast.success('Đã xóa bình luận!')
      } catch (err: any) {
        console.error('deleteQuizComment error:', err)
        toast.error('Lỗi khi xóa bình luận: ' + err.message)
      }
    }
  )
}

// Delete Answer (custom popup trigger)
function deleteAnswer(answerId: string) {
  openConfirmModal(
    'Xóa câu trả lời',
    'Bạn có chắc chắn muốn xóa câu trả lời này? Bạn có thể nộp lại đáp án khác sau khi xóa.',
    async () => {
      try {
        console.log('Sending delete request to Supabase for ID:', answerId)
        const { data, error, status } = await supabase
          .from('quiz_answers')
          .delete()
          .eq('id', answerId)
          .select()

        console.log('Supabase delete response status:', status, 'data:', data, 'error:', error)
        if (error) throw error
        
        if (activeQuestion.value) {
          console.log('Updating local active answers...')
          delete myAnswers.value[activeQuestion.value.id]
          activeAnswers.value = activeAnswers.value.filter(a => a.id !== answerId)
        }
        isEditingAnswer.value = false
        toast.success('Đã xóa câu trả lời thành công!')
        console.log('Calling loadQuizData()...')
        await loadQuizData()
        console.log('loadQuizData finished!')
      } catch (err: any) {
        console.error('deleteAnswer error:', err)
        toast.error('Lỗi khi xóa câu trả lời: ' + err.message)
      }
    }
  )
}

// Format Date
function formatDate(dateString: string) {
  const d = dayjs(dateString)
  return `${d.date()} thg ${d.month() + 1}, ${d.year()}`
}

// Toggle multiple selection
function toggleMultipleOption(index: number) {
  if (mySelection.value.includes(index)) {
    mySelection.value = mySelection.value.filter(i => i !== index)
  } else {
    mySelection.value.push(index)
  }
}

onMounted(() => {
  loadQuizData()
})
</script>

<template>
  <div class="min-h-screen bg-surface-1 dark:bg-[#121013] text-gray-800 dark:text-gray-100 pb-24 transition-colors duration-300">
    <ThemeToggle />

    <!-- Centered mobile container -->
    <div class="max-w-[430px] mx-auto min-h-screen bg-surface-2 dark:bg-[#1C1A1D] border-x border-border shadow-sm flex flex-col p-5">
      
      <!-- Header -->
      <header class="flex justify-between items-center mb-5 mt-2">
        <div>
          <h2 class="text-base font-bold font-serif text-gray-900 dark:text-gray-100">Thử thách tình yêu</h2>
          <p class="text-xs text-text-secondary">Trả lời những câu hỏi đố vui từ đối phương</p>
        </div>
        <button 
          @click="openCreateQuiz"
          class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-[11px] font-semibold px-3 py-1.5 rounded-full cursor-pointer flex items-center gap-1 transition"
        >
          <i class="ti ti-plus"></i>
          <span>Tạo câu đố</span>
        </button>
      </header>

      <!-- Loading State -->
      <div v-if="loading" class="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <i class="ti ti-loader animate-spin text-2xl text-[#D4537E]"></i>
        <p class="text-xs text-text-muted">Đang tìm câu đố...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="questions.length === 0" class="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <i class="ti ti-brain text-3xl text-text-muted mb-2"></i>
        <p class="text-xs text-text-muted">Chưa có câu đố nào. Hãy tạo một câu để đố cô ấy/anh ấy nhé! 🤔</p>
      </div>

      <!-- Questions List -->
      <div v-else class="flex-1 space-y-3">
        
        <div 
          v-for="q in questions" 
          :key="q.id"
          @click="openQuestionDetail(q)"
          class="border border-border rounded-2xl p-4 bg-surface-1 dark:bg-[#1D1A1F]/30 hover:bg-[#FBEAF0]/20 cursor-pointer transition flex flex-col gap-2 relative"
        >
          <!-- Creator info & type -->
          <div class="flex items-center justify-between text-[9px] uppercase font-bold text-text-muted">
            <span class="flex items-center gap-1">
              <i class="ti ti-user"></i>
              <span>Từ: {{ q.profiles?.display_name }} ({{ q.profiles?.role === 'admin' ? 'Anh' : 'Em' }})</span>
            </span>
            <span class="px-1.5 py-0.5 bg-black/5 dark:bg-white/5 rounded">
              {{ q.quiz_type === 'essay' ? 'Tự luận' : (q.quiz_type === 'single' ? 'Trắc nghiệm' : 'Chọn nhiều') }}
            </span>
          </div>

          <!-- Question preview -->
          <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-normal">
            {{ q.question }}
          </p>

          <!-- Answer status badge -->
          <div class="flex justify-between items-center mt-1 pt-1.5 border-t border-border/40 text-[10px]">
            <span 
              v-if="myAnswers[q.id]"
              class="text-green-600 dark:text-green-400 font-medium flex items-center gap-0.5"
            >
              <i class="ti ti-checkbox"></i>
              <span>Đã trả lời</span>
            </span>
            <span 
              v-else
              class="text-text-muted font-medium flex items-center gap-0.5"
            >
              <i class="ti ti-help"></i>
              <span>Chưa trả lời</span>
            </span>

            <!-- Question Owner Controls -->
            <div v-if="q.created_by === authStore.user?.id" class="flex items-center gap-2 select-none text-[10px] ml-auto mr-3">
              <button 
                @click.stop="openEditQuiz(q)"
                class="text-[#D4537E] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer p-0.5"
                title="Sửa câu hỏi"
              >
                <i class="ti ti-edit"></i>
                <span>Sửa</span>
              </button>
              <button 
                @click.stop="deleteQuizQuestion(q.id)"
                class="text-red-500 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer p-0.5"
                title="Xóa câu hỏi"
              >
                <i class="ti ti-trash"></i>
                <span>Xóa</span>
              </button>
            </div>

            <span class="text-text-secondary hover:text-[#D4537E] font-medium flex items-center gap-0.5" :class="q.created_by === authStore.user?.id ? '' : 'ml-auto'">
              <span>Xem chi tiết</span>
              <i class="ti ti-chevron-right"></i>
            </span>
          </div>
        </div>

      </div>

    </div>

    <!-- Modal: Add Quiz Question -->
    <transition name="fade">
      <div 
        v-if="showAddModal"
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showAddModal = false"
      >
        <div class="w-full max-w-[360px] bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 rounded-3xl p-5 shadow-2xl space-y-4 text-[#4B2F15] dark:text-[#E2CBB2]">
          <header class="flex justify-between items-center border-b border-border pb-2.5">
            <h3 class="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">{{ isEditingQuiz ? 'Chỉnh sửa câu đố' : 'Tạo câu đố mới' }}</h3>
            <button @click="showAddModal = false" class="text-text-muted hover:text-gray-900 dark:hover:text-gray-100 text-xs">
              <i class="ti ti-x"></i>
            </button>
          </header>

          <form @submit.prevent="saveQuizQuestion" class="space-y-4">
            <!-- Question text -->
            <div>
              <label class="text-[10px] text-text-secondary block mb-1">Nội dung câu hỏi</label>
              <textarea 
                v-model="newQuestionText"
                rows="3"
                placeholder="Ví dụ: Lần đầu tiên tụi mình đi xem phim là phim gì?..."
                class="w-full text-xs p-2.5 bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent rounded-xl text-[#4B2F15] dark:text-[#E2CBB2] focus:outline-none resize-none font-sans leading-snug"
                required
              ></textarea>
            </div>

            <!-- Quiz Type -->
            <div>
              <label class="text-[10px] text-text-secondary block mb-1">Loại câu đố</label>
              <select v-model="newQuizType" class="w-full text-xs bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent rounded-xl text-[#4B2F15] dark:text-[#E2CBB2] focus:outline-none py-2 px-3">
                <option value="single" class="bg-[#FDFBF7] dark:bg-[#1F1C18]">Trắc nghiệm (Chọn 1 đáp án)</option>
                <option value="multiple" class="bg-[#FDFBF7] dark:bg-[#1F1C18]">Chọn nhiều (Chọn nhiều đáp án)</option>
                <option value="essay" class="bg-[#FDFBF7] dark:bg-[#1F1C18]">Tự luận (Hỏi đáp, phản hồi tự do)</option>
              </select>
            </div>

            <!-- Options if choice quiz -->
            <div v-if="newQuizType !== 'essay'" class="space-y-2">
              <label class="text-[10px] text-text-secondary block">Các lựa chọn đáp án</label>
              
              <div 
                v-for="(_, idx) in newOptions" 
                :key="idx"
                class="flex items-center gap-2"
              >
                <span class="text-[10px] text-text-muted font-bold w-4">{{ String.fromCharCode(65 + idx) }}.</span>
                <input 
                  v-model="newOptions[idx]"
                  type="text"
                  placeholder="Nhập câu trả lời..."
                  class="flex-1 text-xs py-1.5 bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent rounded-xl text-[#4B2F15] dark:text-[#E2CBB2] focus:outline-none"
                  required
                />
                <button 
                  v-if="newOptions.length > 2"
                  type="button" 
                  @click="removeOption(idx)"
                  class="text-red-500 hover:text-red-600 text-xs p-1"
                >
                  <i class="ti ti-trash"></i>
                </button>
              </div>

              <button 
                type="button"
                @click="addOption"
                class="text-[10px] text-[#D4537E] hover:underline font-semibold flex items-center gap-0.5 pt-1 cursor-pointer"
              >
                <i class="ti ti-plus"></i>
                <span>Thêm lựa chọn</span>
              </button>
            </div>

            <!-- Submit -->
            <div class="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                @click="showAddModal = false"
                class="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold py-2 px-4 rounded-xl border border-border"
              >
                Hủy
              </button>
              <button
                type="submit"
                class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs font-semibold py-2 px-5 rounded-xl shadow-lg shadow-romantic-500/10 cursor-pointer transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                :disabled="submittingQuiz"
              >
                <i v-if="submittingQuiz" class="ti ti-loader animate-spin text-xs"></i>
                <span>{{ isEditingQuiz ? 'Lưu thay đổi' : 'Tạo câu đố' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>

    <!-- Modal: Quiz Detail & Answers/Comments -->
    <transition name="fade">
      <div 
        v-if="activeQuestion"
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="activeQuestion = null"
      >
        <div class="w-full max-w-[360px] bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col justify-between overflow-y-auto text-[#4B2F15] dark:text-[#E2CBB2]">
          
          <!-- Top -->
          <div class="flex-1">
            <header class="flex justify-between items-center border-b border-border pb-2.5 mb-3">
              <span class="text-[9px] uppercase font-bold text-text-muted">
                Chi tiết câu đố
              </span>
              <button @click="activeQuestion = null" class="text-text-muted hover:text-gray-900 dark:hover:text-gray-100 text-xs">
                <i class="ti ti-x"></i>
              </button>
            </header>

            <!-- Question and Author -->
            <div class="space-y-1.5 mb-4">
              <p class="text-[10px] text-text-secondary select-none">
                Được tạo bởi: <span class="font-bold text-[#D4537E]">{{ activeQuestion.profiles?.display_name }}</span>
              </p>
              <h2 class="text-sm font-bold leading-normal text-gray-900 dark:text-gray-100">
                {{ activeQuestion.question }}
              </h2>
            </div>

            <!-- CASE 1: NOT ANSWERED YET OR EDITING ANSWER -->
            <div v-if="!myAnswers[activeQuestion.id] || isEditingAnswer" class="space-y-4 border-t border-border/40 pt-4">
              <h4 class="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider select-none">
                {{ isEditingAnswer ? 'Chỉnh sửa câu trả lời của bạn' : 'Câu trả lời của bạn' }}
              </h4>
              
              <!-- Essay answer form -->
              <div v-if="activeQuestion.quiz_type === 'essay'" class="space-y-3">
                <textarea 
                  v-model="myEssayAnswer"
                  rows="3"
                  placeholder="Nhập câu trả lời chi tiết của bạn vào đây..."
                  class="w-full text-xs p-2.5 bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent rounded-xl text-[#4B2F15] dark:text-[#E2CBB2] focus:outline-none resize-none font-sans leading-snug"
                  required
                ></textarea>
              </div>

              <!-- Single choice answer form -->
              <div v-else-if="activeQuestion.quiz_type === 'single'" class="space-y-2.5">
                <label 
                  v-for="(opt, idx) in activeQuestion.options" 
                  :key="idx"
                  class="flex items-center gap-3 border border-[#EBE6DC] dark:border-transparent p-2.5 rounded-xl bg-[#F6F2E9] dark:bg-[#282420] hover:bg-[#FBEAF0]/20 cursor-pointer transition select-none"
                  :class="mySingleSelection === idx ? 'border-[#D4537E] bg-[#FBEAF0]/10' : ''"
                >
                  <input 
                    type="radio" 
                    :value="idx" 
                    v-model="mySingleSelection"
                    class="w-4 h-4 accent-[#D4537E]"
                  />
                  <span class="text-xs text-gray-800 dark:text-gray-200">
                    <span class="font-bold text-text-secondary mr-1">{{ String.fromCharCode(65 + idx) }}.</span> {{ opt }}
                  </span>
                </label>
              </div>

              <!-- Multiple choice answer form -->
              <div v-else class="space-y-2.5">
                <label 
                  v-for="(opt, idx) in activeQuestion.options" 
                  :key="idx"
                  @click.prevent="toggleMultipleOption(idx)"
                  class="flex items-center gap-3 border border-[#EBE6DC] dark:border-transparent p-2.5 rounded-xl bg-[#F6F2E9] dark:bg-[#282420] hover:bg-[#FBEAF0]/20 cursor-pointer transition select-none"
                  :class="mySelection.includes(idx) ? 'border-[#D4537E] bg-[#FBEAF0]/10' : ''"
                >
                  <input 
                    type="checkbox" 
                    :checked="mySelection.includes(idx)"
                    class="w-4 h-4 accent-[#D4537E] pointer-events-none"
                  />
                  <span class="text-xs text-gray-800 dark:text-gray-200">
                    <span class="font-bold text-text-secondary mr-1">{{ String.fromCharCode(65 + idx) }}.</span> {{ opt }}
                  </span>
                </label>
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-2">
                <button 
                  v-if="isEditingAnswer"
                  type="button"
                  @click="isEditingAnswer = false"
                  class="flex-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold py-2.5 rounded-xl border border-border cursor-pointer transition"
                >
                  Hủy
                </button>
                <button 
                  @click="submitAnswer"
                  class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs font-semibold py-2.5 rounded-xl shadow-lg cursor-pointer transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  :class="isEditingAnswer ? 'flex-1' : 'w-full'"
                  :disabled="submittingAnswer"
                >
                  <i v-if="submittingAnswer" class="ti ti-loader animate-spin text-xs"></i>
                  <span>{{ isEditingAnswer ? 'Lưu thay đổi' : 'Gửi câu trả lời &rarr;' }}</span>
                </button>
              </div>
            </div>

            <!-- CASE 2: ALREADY ANSWERED AND NOT EDITING -->
            <div v-else class="space-y-4 border-t border-border/40 pt-4">
              <!-- Render details of selected options -->
              <div v-if="activeQuestion.quiz_type !== 'essay'" class="space-y-2.5">
                <h4 class="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider select-none">Các lựa chọn đáp án</h4>
                
                <div 
                  v-for="(opt, idx) in activeQuestion.options" 
                  :key="idx"
                  class="flex items-center justify-between border border-[#EBE6DC] dark:border-transparent p-2.5 rounded-xl bg-[#F6F2E9]/60 dark:bg-[#282420]/60 text-xs"
                >
                  <span><span class="font-bold text-text-secondary mr-1">{{ String.fromCharCode(65 + idx) }}.</span> {{ opt }}</span>
                </div>
              </div>

              <!-- RESPONDENTS' ANSWERS GRID -->
              <div class="space-y-3 pt-2">
                <h4 class="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider select-none">Đáp án của cả hai</h4>
                
                <div 
                  v-for="ans in activeAnswers" 
                  :key="ans.id"
                  class="bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent p-3 rounded-2xl space-y-1.5"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {{ ans.profiles?.display_name }}
                      </span>
                      <span 
                        class="text-[8px] px-1 rounded font-semibold select-none"
                        :class="ans.profiles?.role === 'admin' ? 'bg-[#E3EFFD] text-[#1E40AF]' : 'bg-[#FDF2F8] text-[#9D174D]'"
                      >
                        {{ ans.profiles?.role === 'admin' ? 'Anh ❤️' : 'Em 🌸' }}
                      </span>
                    </div>

                    <!-- Owner Controls -->
                    <div v-if="ans.profile_id === authStore.user?.id" class="flex items-center gap-2 select-none text-[10px]">
                      <button 
                        v-if="isAnswerEditable(activeQuestion.id)"
                        @click.stop="isEditingAnswer = true"
                        class="text-[#D4537E] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer p-1"
                        title="Sửa câu trả lời"
                      >
                        <i class="ti ti-edit"></i>
                        <span>Sửa</span>
                      </button>
                      <button 
                        @click.stop="deleteAnswer(ans.id)"
                        class="text-red-500 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer p-1"
                        title="Xóa câu trả lời"
                      >
                        <i class="ti ti-trash"></i>
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>

                  <!-- Text response if essay -->
                  <p v-if="activeQuestion.quiz_type === 'essay'" class="text-xs text-gray-700 dark:text-gray-300 italic whitespace-pre-wrap leading-relaxed">
                    "{{ ans.essay_answer }}"
                  </p>

                  <!-- Choice selected index mapping -->
                  <div v-else class="text-[11px] text-gray-700 dark:text-gray-300">
                    <span class="text-text-secondary select-none">Đã chọn: </span>
                    <span class="font-semibold text-[#D4537E]">
                      {{ ans.selected_options?.map(idx => String.fromCharCode(65 + idx)).join(', ') || 'Chưa chọn' }}
                    </span>
                  </div>
                </div>

                <div v-if="activeAnswers.length < 2" class="text-center py-2 text-[10px] text-text-muted italic select-none">
                  Đợi đối phương trả lời để so sánh đáp án của nhau nhé! ⏳
                </div>
              </div>

              <!-- COMMENTS SECTION FOR ESSAY (TỰ LUẬN) -->
              <div v-if="activeQuestion.quiz_type === 'essay'" class="border-t border-border/40 pt-4 mt-2">
                <h4 class="text-[11px] font-bold text-[#4B2F15] dark:text-[#E2CBB2] uppercase tracking-wider mb-3 flex items-center gap-1 select-none">
                  <i class="ti ti-messages"></i>
                  <span>Thảo luận câu trả lời</span>
                </h4>

                <!-- Comments list -->
                <div v-if="loadingComments" class="flex justify-center py-3">
                  <i class="ti ti-loader animate-spin text-lg text-romantic-500"></i>
                </div>
                <div v-else-if="activeComments.length === 0" class="text-center py-3 text-[10px] text-gray-400 dark:text-gray-500 italic select-none">
                  Chưa có bình luận nào. Hãy bắt chuyện ngay!
                </div>
                <div v-else class="space-y-2 max-h-[160px] overflow-y-auto pr-1 no-scrollbar mb-3">
                  <div 
                    v-for="c in activeComments" 
                    :key="c.id"
                    class="bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent p-2 rounded-xl relative group text-[11px]"
                  >
                    <div class="flex items-center justify-between gap-1.5 mb-0.5">
                      <div class="flex items-center gap-1">
                        <span class="font-bold text-gray-800 dark:text-gray-200">
                          {{ c.profiles?.display_name }}
                        </span>
                        <span 
                          class="text-[7px] px-0.5 rounded font-semibold select-none"
                          :class="c.profiles?.role === 'admin' ? 'bg-[#E3EFFD] text-[#1E40AF]' : 'bg-[#FDF2F8] text-[#9D174D]'"
                        >
                          {{ c.profiles?.role === 'admin' ? 'Anh' : 'Em' }}
                        </span>
                      </div>
                      
                      <!-- Comment Delete button -->
                      <button 
                        v-if="c.profile_id === authStore.user?.id || authStore.role === 'admin' || authStore.user?.email === 'quanghuy@love.com'"
                        @click.stop="deleteQuizComment(c.id)"
                        class="text-red-500 hover:text-red-600 cursor-pointer p-1"
                        title="Xóa bình luận"
                      >
                        <i class="ti ti-trash text-[11px]"></i>
                      </button>
                    </div>
                    <p class="text-gray-700 dark:text-gray-300 leading-normal whitespace-pre-wrap">
                      {{ c.content }}
                    </p>
                    <p class="text-[8px] text-gray-400 mt-0.5 select-none text-right">
                      {{ formatDate(c.created_at) }}
                    </p>
                  </div>
                </div>

                <!-- Comment Input -->
                <div class="flex gap-2 items-end">
                  <textarea 
                    v-model="newCommentText"
                    rows="1"
                    placeholder="Viết phản hồi..."
                    class="flex-1 text-xs p-2 bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent rounded-xl focus:outline-none resize-none font-sans text-gray-800 dark:text-gray-200"
                    @keyup.enter.prevent="sendQuizComment"
                    :disabled="submittingComment"
                  ></textarea>
                  <button 
                    @click="sendQuizComment"
                    class="bg-[#D4537E] hover:bg-[#c2436d] text-white p-2 rounded-xl flex items-center justify-center cursor-pointer transition disabled:opacity-50 h-8 w-8"
                    :disabled="submittingComment || !newCommentText.trim()"
                  >
                    <i v-if="submittingComment" class="ti ti-loader animate-spin text-sm"></i>
                    <i v-else class="ti ti-send text-sm"></i>
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    </transition>

    <!-- Custom Popup Confirm Modal -->
    <transition name="fade">
      <div 
        v-if="showConfirmModal"
        class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        @click.self="showConfirmModal = false"
      >
        <div class="w-full max-w-[280px] bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 rounded-3xl p-5 shadow-2xl text-center space-y-4 text-[#4B2F15] dark:text-[#E2CBB2]">
          <div class="space-y-1.5">
            <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">
              {{ confirmModalTitle }}
            </h3>
            <p class="text-xs text-text-secondary leading-relaxed">
              {{ confirmModalMessage }}
            </p>
          </div>
          <div class="flex gap-2">
            <button 
              type="button"
              @click="showConfirmModal = false"
              class="flex-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold py-2 rounded-xl border border-[#EBE6DC] dark:border-transparent cursor-pointer transition text-gray-800 dark:text-gray-200"
            >
              Hủy
            </button>
            <button 
              type="button"
              @click="triggerConfirmModalAction"
              class="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-2 rounded-xl shadow-lg cursor-pointer transition"
            >
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </transition>

    <Navbar />
  </div>
</template>

<style scoped>
/* Modal animations */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
