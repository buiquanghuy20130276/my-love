<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/auth'
import { toast } from 'vue-sonner'
import { compressImage } from '../lib/imageCompressor'
import Navbar from '../components/Navbar.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

// Configure Vietnamese locale manually to bypass Vite pre-bundler caching anomalies
dayjs.locale({
  name: 'vi',
  weekdays: 'Chủ Nhật_Thứ Hai_Thứ Ba_Thứ Tư_Thứ Năm_Thứ Sáu_Thứ Bảy'.split('_'),
  months: 'Tháng 1_Tháng 2_Tháng 3_Tháng 4_Tháng 5_Tháng 6_Tháng 7_Tháng 8_Tháng 9_Tháng 10_Tháng 11_Tháng 12'.split('_'),
  weekStart: 1,
  formats: {
    LT: 'HH:mm',
    LTS: 'HH:mm:ss',
    L: 'DD/MM/YYYY',
    LL: 'D MMMM [năm] YYYY',
    LLL: 'D MMMM [năm] YYYY HH:mm',
    LLLL: 'dddd, D MMMM [năm] YYYY HH:mm'
  },
  relativeTime: {
    future: '%s tới',
    past: '%s trước',
    s: 'vài giây',
    m: 'một phút',
    mm: '%d phút',
    h: 'một giờ',
    hh: '%d giờ',
    d: 'một ngày',
    dd: '%d ngày',
    M: 'một tháng',
    MM: '%d tháng',
    y: 'một năm',
    yy: '%d năm'
  }
})

const authStore = useAuthStore()

// Interfaces
interface FeedComment {
  id: string
  post_id: string
  user_id: string
  author_name: string
  author_avatar_url: string | null
  content: string
  created_at: string
}

interface FeedReaction {
  id: string
  post_id: string
  user_id: string
  emoji: string
  created_at: string
}

interface FeedPost {
  id: string
  user_id: string
  author_name: string
  author_avatar_url: string | null
  content: string | null
  images: string[]
  layout_type: 'grid-equal' | 'left-large' | 'top-large'
  created_at: string
  reactions?: FeedReaction[]
  comments?: FeedComment[]
  // local UI states
  showEmojiPicker?: boolean
}

interface UserProfile {
  id: string
  role: string
  display_name: string
  avatar_url: string | null
}

interface ImageTransform {
  scale: number
  x: number // relative fraction (-1 to 1)
  y: number // relative fraction (-1 to 1)
}

interface PreviewItem {
  url: string
  file?: File | null
  originalUrl: string
  originalFile?: File | null
  transform?: ImageTransform
}

function parseImageWithTransform(url: string) {
  if (!url) return { url: '', hasTransform: false, transform: { scale: 1, x: 0, y: 0 } }
  const parts = url.split('#')
  const baseUrl = parts[0]
  const hash = parts[1]
  const transform = { scale: 1, x: 0, y: 0 }
  let hasTransform = false
  if (hash) {
    const params = new URLSearchParams(hash)
    transform.scale = parseFloat(params.get('scale') || '1')
    transform.x = parseFloat(params.get('x') || '0')
    transform.y = parseFloat(params.get('y') || '0')
    hasTransform = true
  }
  return { url: baseUrl, hasTransform, transform }
}

function getTransformStyle(transform?: ImageTransform) {
  if (!transform) return {}
  return {
    transform: `translate(${transform.x * 100}%, ${transform.y * 100}%) scale(${transform.scale})`,
    transformOrigin: 'center'
  }
}

// img class helper: always absolute inset-0 so overflow:hidden on parent clips correctly
function getGridImageProps(imgUrl: string) {
  if (!imgUrl) return { src: '', class: '', style: {} }
  const parsed = parseImageWithTransform(imgUrl)
  return {
    src: parsed.url,
    class: parsed.hasTransform 
      ? 'absolute inset-0 w-full h-full object-contain origin-center select-none pointer-events-none' 
      : 'absolute inset-0 w-full h-full object-cover select-none pointer-events-none',
    style: parsed.hasTransform ? getTransformStyle(parsed.transform) : {}
  }
}

function getDetailImageProps(imgUrl: string) {
  if (!imgUrl) return { src: '', class: '', style: {}, onClick: () => {} }
  const parsed = parseImageWithTransform(imgUrl)
  return {
    src: parsed.url,
    class: parsed.hasTransform 
      ? 'absolute inset-0 w-full h-full object-contain origin-center select-none cursor-zoom-in' 
      : 'absolute inset-0 w-full h-full object-cover select-none cursor-zoom-in',
    style: parsed.hasTransform ? getTransformStyle(parsed.transform) : {},
    onClick: (e: MouseEvent) => {
      e.stopPropagation()
      openLightbox(imgUrl)
    }
  }
}

function getComposerPreviewProps(item: PreviewItem) {
  if (!item) return { src: '', class: '', style: {} }
  const hasTransform = !!(item.transform && (item.transform.scale !== 1 || item.transform.x !== 0 || item.transform.y !== 0))
  return {
    src: item.originalUrl || item.url,
    class: hasTransform 
      ? 'absolute inset-0 w-full h-full object-contain origin-center cursor-pointer hover:opacity-90 transition' 
      : 'absolute inset-0 w-full h-full object-cover cursor-pointer hover:opacity-90 transition',
    style: hasTransform ? getTransformStyle(item.transform) : {}
  }
}

// State variables
const posts = ref<FeedPost[]>([])
const loading = ref(false)
const profilesMap = ref<Record<string, UserProfile>>({})
const settingsData = ref<any>(null)

// Lightbox states
const showLightbox = ref(false)
const activeLightboxUrl = ref<string | null>(null)

// Modals toggling
const showComposeModal = ref(false)
const showDetailModal = ref(false)
const activePost = ref<FeedPost | null>(null)

// Editing state variables
const isEditing = ref(false)
const editingPostId = ref<string | null>(null)

// Composer states
const postContent = ref('')
const previewItems = ref<PreviewItem[]>([])
const layoutType = ref<'grid-equal' | 'left-large' | 'top-large'>('grid-equal')
const submittingPost = ref(false)

// Edit comment states
const editingCommentId = ref<string | null>(null)
const editingCommentText = ref('')

// Crop modal states
const showCropModal = ref(false)
const cropImageSrc = ref('')
const selectedPreviewIndex = ref<number | null>(null)
const zoom = ref(1)
const posX = ref(0)
const posY = ref(0)
const targetAspect = ref(1)
const cropW = ref(0)
const cropH = ref(0)
const cropLeft = ref(0)
const cropTop = ref(0)
const fittedWidth = ref(0)
const fittedHeight = ref(0)
const imgLeft = ref(0)
const imgTop = ref(0)

let imgNaturalWidth = 0
let imgNaturalHeight = 0
let scaleFit = 1

let dragStartX = 0
let dragStartY = 0
let dragInitialPosX = 0
let dragInitialPosY = 0
const isDraggingImage = ref(false)

let initialTouchDistance = 0
let initialZoom = 1

function getTargetAspect(count: number, layout: string, idx: number): number {
  if (count <= 1) return 1.2
  
  if (count === 2) {
    if (layout === 'grid-equal') return 1.0
    if (layout === 'left-large') {
      return idx === 0 ? 1.33 : 0.67
    }
    if (layout === 'top-large') {
      return idx === 0 ? 2.2 : 4.5
    }
  }
  
  if (count === 3) {
    if (layout === 'grid-equal') return 0.8
    if (layout === 'left-large') return 1.13
    if (layout === 'top-large') return 2.23
  }
  
  if (count === 4) {
    if (layout === 'grid-equal') return 1.5
    if (layout === 'left-large') {
      return idx === 0 ? 1.13 : 1.7
    }
    if (layout === 'top-large') {
      return idx === 0 ? 2.23 : 1.5
    }
  }
  
  if (count === 5) {
    if (layout === 'grid-equal') {
      return idx < 2 ? 1.5 : 1.0
    }
    if (layout === 'left-large') {
      return 0.85
    }
    if (layout === 'top-large') {
      return idx === 0 ? 3.0 : 0.75
    }
  }
  
  return 1.0
}

function constrainZoom() {
  const minZoom = Math.max(cropW.value / fittedWidth.value, cropH.value / fittedHeight.value)
  zoom.value = Math.max(minZoom, Math.min(6, zoom.value))
}

function constrainOffsets() {
  const w_render = fittedWidth.value * zoom.value
  const h_render = fittedHeight.value * zoom.value
  
  // Bounds for posX
  const minX = cropLeft.value + cropW.value - (256 + w_render) / 2
  const maxX = cropLeft.value - (256 - w_render) / 2
  posX.value = Math.max(minX, Math.min(maxX, posX.value))
  
  // Bounds for posY
  const minY = cropTop.value + cropH.value - (256 + h_render) / 2
  const maxY = cropTop.value - (256 - h_render) / 2
  posY.value = Math.max(minY, Math.min(maxY, posY.value))
}

function onCropImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  imgNaturalWidth = img.naturalWidth
  imgNaturalHeight = img.naturalHeight
  
  // Outer container is fixed at 256x256 (w-64 h-64)
  const W_c = 256
  const H_c = 256
  
  // Calculate crop box size inside 256x256 to fit aspect ratio
  let cw = 256
  let ch = 256 / targetAspect.value
  if (ch > 256) {
    ch = 256
    cw = 256 * targetAspect.value
  }
  cropW.value = cw
  cropH.value = ch
  cropLeft.value = (W_c - cw) / 2
  cropTop.value = (H_c - ch) / 2
  
  // Fit image inside the crop box aspect ratio (representing layout cell)
  scaleFit = Math.min(cropW.value / imgNaturalWidth, cropH.value / imgNaturalHeight)
  
  fittedWidth.value = imgNaturalWidth * scaleFit
  fittedHeight.value = imgNaturalHeight * scaleFit
  
  imgLeft.value = (W_c - fittedWidth.value) / 2
  imgTop.value = (H_c - fittedHeight.value) / 2

  const minZoom = Math.max(cropW.value / fittedWidth.value, cropH.value / fittedHeight.value)
  
  // Restore saved transform only if it was truly user-adjusted (not the untouched default)
  const idx = selectedPreviewIndex.value
  const savedTransform = idx !== null ? previewItems.value[idx]?.transform : null
  const hasUserTransform = savedTransform && (
    savedTransform.scale !== 1 || savedTransform.x !== 0 || savedTransform.y !== 0
  )
  
  if (hasUserTransform && savedTransform) {
    zoom.value = savedTransform.scale
    posX.value = savedTransform.x * fittedWidth.value
    posY.value = savedTransform.y * fittedHeight.value
  } else {
    // Default: fit zoom to exactly cover the crop box, centered
    zoom.value = minZoom
    posX.value = 0
    posY.value = 0
  }
  
  // Always clamp zoom ≥ minZoom so the image always fills the crop frame
  constrainZoom()
  constrainOffsets()
}

function handleDragStart(e: MouseEvent | TouchEvent) {
  isDraggingImage.value = true
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  dragStartX = clientX
  dragStartY = clientY
  dragInitialPosX = posX.value
  dragInitialPosY = posY.value
}

function handleDragMove(e: MouseEvent | TouchEvent) {
  if (!isDraggingImage.value) return
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  const dx = clientX - dragStartX
  const dy = clientY - dragStartY
  posX.value = dragInitialPosX + dx
  posY.value = dragInitialPosY + dy
  constrainOffsets()
}

function handleDragEnd() {
  isDraggingImage.value = false
}

// Mouse scroll wheel zoom
function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const zoomSpeed = 0.08
  if (e.deltaY < 0) {
    zoom.value = Math.min(6, zoom.value + zoomSpeed)
  } else {
    zoom.value = zoom.value - zoomSpeed
  }
  constrainZoom()
  constrainOffsets()
}

// Helper touch distance
function getTouchDistance(touches: TouchList) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function handleTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    isDraggingImage.value = false
    initialTouchDistance = getTouchDistance(e.touches)
    initialZoom = zoom.value
  } else {
    handleDragStart(e)
  }
}

function handleTouchMove(e: TouchEvent) {
  if (e.touches.length === 2) {
    const dist = getTouchDistance(e.touches)
    const factor = dist / initialTouchDistance
    zoom.value = initialZoom * factor
    constrainZoom()
    constrainOffsets()
  } else {
    handleDragMove(e)
  }
}

function startCropImage(idx: number) {
  selectedPreviewIndex.value = idx
  const item = previewItems.value[idx]
  // Always strip hash transform fragment so we load the pure original image
  const rawSrc = (item.originalUrl || item.url).split('#')[0]
  cropImageSrc.value = rawSrc
  targetAspect.value = getTargetAspect(previewItems.value.length, layoutType.value, idx)
  
  // posX/posY will be restored in onCropImageLoad after the image loads & dimensions are known
  posX.value = 0
  posY.value = 0
  zoom.value = 1
  
  showCropModal.value = true
}

function confirmCrop() {
  if (selectedPreviewIndex.value === null) return
  
  const idx = selectedPreviewIndex.value
  const item = previewItems.value[idx]
  
  // Convert absolute pixel offsets to relative fractions of fitted image sizes
  item.transform = {
    scale: zoom.value,
    x: fittedWidth.value > 0 ? posX.value / fittedWidth.value : 0,
    y: fittedHeight.value > 0 ? posY.value / fittedHeight.value : 0
  }
  
  showCropModal.value = false
  toast.success('Đã căn chỉnh vị trí ảnh!')
}

// Load all user profile configurations
async function fetchProfiles() {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, role, display_name, avatar_url')
    if (data) {
      const map: Record<string, UserProfile> = {}
      data.forEach((p: any) => {
        map[p.id] = p
      })
      profilesMap.value = map
    }
  } catch (err) {
    console.error('Error fetching user profiles details:', err)
  }
}

// Load settings for avatars mapping
async function fetchSettings() {
  try {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single()
    if (data) {
      settingsData.value = data
    }
  } catch (err) {
    console.error('Error fetching settings for avatars:', err)
  }
}

// Lightbox handlers
function openLightbox(url: string) {
  activeLightboxUrl.value = url.split('#')[0]
  showLightbox.value = true
}

async function downloadImage(url: string) {
  try {
    toast.info('Đang chuẩn bị tải ảnh...')
    const res = await fetch(url, { mode: 'cors' })
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `love-feed-${Date.now()}.webp`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
    toast.success('Đã tải ảnh thành công!')
  } catch (e) {
    // Fallback: direct download link
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.download = `love-feed-${Date.now()}.webp`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Đã mở ảnh trong tab mới để tải xuống!')
  }
}

// Helper: Get user avatar
function getAvatarUrl(userId: string) {
  const profile = profilesMap.value[userId]
  const role = profile?.role || 'admin'
  
  if (settingsData.value) {
    const settingsAvatar = role === 'admin'
      ? settingsData.value.partner_b_avatar_url
      : settingsData.value.partner_a_avatar_url
    if (settingsAvatar) return settingsAvatar
  }

  // Fallback to Dicebear chibi
  if (role === 'admin') {
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=QuangHuy&backgroundColor=fbeaf0`
  } else {
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=DieuThien&backgroundColor=fbeaf0`
  }
}

// Helper: Get author display name
function getAuthorName(userId: string) {
  return profilesMap.value[userId]?.display_name || 'Người dùng'
}

// Fetch posts, reactions, comments
async function fetchFeed() {
  loading.value = true
  try {
    // 1. Fetch posts
    const { data: postsData, error: postsError } = await supabase
      .from('love_feed_posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (postsError) throw postsError
    const fetchedPosts: FeedPost[] = (postsData || []).map(p => ({
      ...p,
      reactions: [],
      comments: [],
      showEmojiPicker: false
    }))

    // 2. Fetch reactions
    const { data: rxData } = await supabase
      .from('love_feed_reactions')
      .select('*')
    
    if (rxData) {
      rxData.forEach(rx => {
        const post = fetchedPosts.find(p => p.id === rx.post_id)
        if (post) post.reactions?.push(rx)
      })
    }

    // 3. Fetch comments
    const { data: commentData } = await supabase
      .from('love_feed_comments')
      .select('*')
      .order('created_at', { ascending: true })

    if (commentData) {
      commentData.forEach(c => {
        const post = fetchedPosts.find(p => p.id === c.post_id)
        if (post) post.comments?.push(c)
      })
    }

    posts.value = fetchedPosts
    
    // Update activePost if detail modal is open
    if (activePost.value) {
      const updatedActive = fetchedPosts.find(p => p.id === activePost.value?.id)
      if (updatedActive) {
        activePost.value = updatedActive
      } else {
        // Active post deleted
        showDetailModal.value = false
        activePost.value = null
      }
    }
  } catch (err: any) {
    toast.error('Lỗi khi tải bảng tin: ' + err.message)
  } finally {
    loading.value = false
  }
}

// Real-time listener channel
let feedChannel: any = null

function setupRealtime() {
  feedChannel = supabase.channel('schema-db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'love_feed_posts' },
      () => { fetchFeed() }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'love_feed_reactions' },
      () => { fetchFeed() }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'love_feed_comments' },
      () => { fetchFeed() }
    )
    .subscribe()
}

// Composer opening
function openNewPostComposer() {
  isEditing.value = false
  editingPostId.value = null
  postContent.value = ''
  previewItems.value = []
  layoutType.value = 'grid-equal'
  showComposeModal.value = true
}

function openEditPostComposer(post: FeedPost) {
  isEditing.value = true
  editingPostId.value = post.id
  postContent.value = post.content || ''
  layoutType.value = post.layout_type
  previewItems.value = post.images.map(img => {
    const parsed = parseImageWithTransform(img)
    return { 
      url: parsed.url,
      file: null,
      originalUrl: parsed.url,
      originalFile: null,
      transform: parsed.transform
    }
  })
  showComposeModal.value = true
}

// File select handler
function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files) return
  const files = Array.from(target.files)
  if (previewItems.value.length + files.length > 5) {
    toast.error('Chỉ được tải lên tối đa 5 ảnh!')
    return
  }
  files.forEach(f => {
    const objectUrl = URL.createObjectURL(f)
    previewItems.value.push({
      url: objectUrl,
      file: f,
      originalUrl: objectUrl,
      originalFile: f,
      transform: { scale: 1, x: 0, y: 0 }
    })
  })
  target.value = ''
}

function removePreview(idx: number) {
  const item = previewItems.value[idx]
  if (item.file) {
    URL.revokeObjectURL(item.url)
  }
  if (item.originalFile && item.originalUrl !== item.url) {
    URL.revokeObjectURL(item.originalUrl)
  }
  previewItems.value.splice(idx, 1)
}

// Create or update post
async function publishPost() {
  if (!postContent.value.trim() && previewItems.value.length === 0) {
    toast.error('Nội dung bài viết không được để trống!')
    return
  }
  submittingPost.value = true
  try {
    const finalImages: string[] = []
    
    // Process preview items in order
    for (const item of previewItems.value) {
      let publicUrl = ''
      if (item.file) {
        // Compress and upload original uncropped file
        const compressed = await compressImage(item.file)
        const fileName = `feed-${Date.now()}-${Math.random().toString(36).substr(2, 5)}.webp`
        const filePath = `feed/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('letter-images')
          .upload(filePath, compressed, { cacheControl: '3600', contentType: 'image/webp' })
        
        if (uploadError) throw uploadError
        
        const { data } = supabase.storage
          .from('letter-images')
          .getPublicUrl(filePath)
          
        publicUrl = data.publicUrl
      } else {
        // Reuse existing image url, splitting off any old hash
        publicUrl = item.url.split('#')[0]
      }
      
      // Append transform hash if present
      const transformHash = item.transform 
        ? `#scale=${item.transform.scale}&x=${item.transform.x}&y=${item.transform.y}` 
        : ''
      finalImages.push(publicUrl + transformHash)
    }

    if (isEditing.value && editingPostId.value) {
      // Update Post
      const { error } = await supabase
        .from('love_feed_posts')
        .update({
          content: postContent.value.trim() || null,
          images: finalImages,
          layout_type: layoutType.value
        })
        .eq('id', editingPostId.value)

      if (error) throw error
      toast.success('Cập nhật bài viết thành công!')
    } else {
      // Create Post
      const { error } = await supabase
        .from('love_feed_posts')
        .insert({
          user_id: authStore.user?.id,
          author_name: profilesMap.value[authStore.user?.id || '']?.display_name || 'User',
          author_avatar_url: profilesMap.value[authStore.user?.id || '']?.avatar_url || null,
          content: postContent.value.trim() || null,
          images: finalImages,
          layout_type: layoutType.value
        })

      if (error) throw error
      toast.success('Đăng bài thành công!')
    }

    // Reset state
    showComposeModal.value = false
    postContent.value = ''
    previewItems.value.forEach(item => {
      if (item.file) URL.revokeObjectURL(item.url)
      if (item.originalFile && item.originalUrl !== item.url) {
        URL.revokeObjectURL(item.originalUrl)
      }
    })
    previewItems.value = []
    layoutType.value = 'grid-equal'
    isEditing.value = false
    editingPostId.value = null
  } catch (err: any) {
    toast.error('Lỗi khi đăng bài: ' + err.message)
  } finally {
    submittingPost.value = false
  }
}

// React on post
async function reactToPost(post: FeedPost, emoji: string) {
  post.showEmojiPicker = false
  const existing = post.reactions?.find(r => r.user_id === authStore.user?.id)

  try {
    if (existing) {
      if (existing.emoji === emoji) {
        const { error } = await supabase
          .from('love_feed_reactions')
          .delete()
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('love_feed_reactions')
          .update({ emoji })
          .eq('id', existing.id)
        if (error) throw error
      }
    } else {
      const { error } = await supabase
        .from('love_feed_reactions')
        .insert({
          post_id: post.id,
          user_id: authStore.user?.id,
          emoji
        })
      if (error) throw error
    }
  } catch (err: any) {
    toast.error('Lỗi khi thả cảm xúc: ' + err.message)
  }
}

// Add comments
const newCommentText = ref('')
async function sendComment(postId: string) {
  if (!newCommentText.value.trim()) return
  const text = newCommentText.value.trim()
  newCommentText.value = ''

  try {
    const { error } = await supabase
      .from('love_feed_comments')
      .insert({
        post_id: postId,
        user_id: authStore.user?.id,
        author_name: profilesMap.value[authStore.user?.id || '']?.display_name || 'User',
        author_avatar_url: profilesMap.value[authStore.user?.id || '']?.avatar_url || null,
        content: text
      })
    if (error) throw error
  } catch (err: any) {
    toast.error('Lỗi khi gửi bình luận: ' + err.message)
  }
}

// Inline comment editing
function startEditComment(comment: FeedComment) {
  editingCommentId.value = comment.id
  editingCommentText.value = comment.content
}

async function saveCommentUpdate(comment: FeedComment) {
  if (!editingCommentText.value.trim()) return
  try {
    const { error } = await supabase
      .from('love_feed_comments')
      .update({ content: editingCommentText.value.trim() })
      .eq('id', comment.id)
    
    if (error) throw error
    comment.content = editingCommentText.value.trim()
    editingCommentId.value = null
    toast.success('Đã cập nhật bình luận!')
  } catch (err: any) {
    toast.error('Lỗi khi sửa bình luận: ' + err.message)
  }
}

// Delete comments
async function deleteComment(commentId: string) {
  if (!confirm('Bạn có chắc chắn muốn xóa bình luận này không?')) return
  try {
    const { error } = await supabase
      .from('love_feed_comments')
      .delete()
      .eq('id', commentId)
    if (error) throw error
    toast.success('Đã xóa bình luận.')
  } catch (err: any) {
    toast.error('Lỗi khi xóa bình luận: ' + err.message)
  }
}

// Delete post
async function deletePost(postId: string) {
  if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return
  try {
    const { error } = await supabase
      .from('love_feed_posts')
      .delete()
      .eq('id', postId)
    if (error) throw error
    toast.success('Đã xóa bài viết.')
    if (activePost.value?.id === postId) {
      showDetailModal.value = false
      activePost.value = null
    }
  } catch (err: any) {
    toast.error('Lỗi khi xóa bài viết: ' + err.message)
  }
}

// Helpers
function getReactionCounts(post: FeedPost) {
  const counts: Record<string, number> = {}
  post.reactions?.forEach(r => {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1
  })
  return counts
}

function getUserReaction(post: FeedPost) {
  return post.reactions?.find(r => r.user_id === authStore.user?.id)?.emoji || null
}

function openPostDetail(post: FeedPost) {
  activePost.value = post
  showDetailModal.value = true
}

watch(layoutType, () => {
  previewItems.value.forEach(item => {
    item.transform = undefined
  })
})

onMounted(() => {
  fetchProfiles()
  fetchSettings()
  fetchFeed()
  setupRealtime()
})

onUnmounted(() => {
  if (feedChannel) {
    supabase.removeChannel(feedChannel)
  }
  previewItems.value.forEach(item => {
    if (item.file) URL.revokeObjectURL(item.url)
  })
})
</script>

<template>
  <div class="min-h-screen bg-surface-1 dark:bg-[#121013] text-gray-800 dark:text-gray-100 pb-28 transition-colors duration-300">
    <ThemeToggle />

    <!-- Main Container Frame -->
    <div class="max-w-[430px] mx-auto min-h-screen bg-surface-2 dark:bg-[#1C1A1D] border-x border-border shadow-sm flex flex-col p-4 space-y-4">
      
      <!-- Header -->
      <header class="flex justify-between items-center border-b border-border pb-3 flex-shrink-0">
        <div>
          <h1 class="text-base font-bold font-serif flex items-center gap-1.5">
            <i class="ti ti-rss text-romantic-500"></i>
            <span>Bảng tin Tình yêu</span>
          </h1>
          <p class="text-[10px] text-text-muted">Chia sẻ những suy nghĩ và khoảnh khắc hàng ngày</p>
        </div>

        <!-- Floating compose trigger button -->
        <button 
          @click="openNewPostComposer"
          class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-[10px] font-bold py-1.5 px-3.5 rounded-full cursor-pointer shadow-md shadow-romantic-500/10 flex items-center gap-1.5 transition"
        >
          <i class="ti ti-edit"></i>
          <span>Đăng bài</span>
        </button>
      </header>

      <!-- Loading state -->
      <div v-if="loading && posts.length === 0" class="flex-1 flex flex-col items-center justify-center py-20 gap-2">
        <i class="ti ti-loader animate-spin text-2xl text-romantic-500"></i>
        <p class="text-xs text-text-muted">Đang tải bảng tin...</p>
      </div>

      <!-- Feed scroll list -->
      <div v-else class="flex-1 space-y-4 overflow-y-auto">
        
        <!-- Post item card -->
        <div 
          v-for="post in posts" 
          :key="post.id"
          @click="openPostDetail(post)"
          class="bg-surface-1 border border-cream-200 dark:border-cream-950/40 rounded-3xl p-4 shadow-sm space-y-3 relative hover:shadow-md transition cursor-pointer"
        >
          <!-- Author Profile header -->
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full border border-cream-200/60 overflow-hidden flex-shrink-0">
                <img :src="getAvatarUrl(post.user_id)" class="w-full h-full object-cover" />
              </div>
              <div>
                <h4 class="text-xs font-bold text-gray-900 dark:text-gray-100 leading-tight">
                  {{ getAuthorName(post.user_id) }}
                </h4>
                <p class="text-[8px] text-text-muted leading-tight mt-0.5">
                  {{ dayjs(post.created_at).fromNow() }}
                </p>
              </div>
            </div>

            <!-- Post Edit / Delete inline buttons -->
            <div v-if="post.user_id === authStore.user?.id || authStore.role === 'admin'" class="flex items-center gap-1">
              <button 
                @click.stop="openEditPostComposer(post)" 
                class="w-6 h-6 rounded-full bg-cream-100 dark:bg-zinc-800 text-text-muted hover:text-[#D4537E] flex items-center justify-center cursor-pointer transition text-[10px]"
                title="Sửa bài viết"
              >
                <i class="ti ti-edit"></i>
              </button>
              <button 
                @click.stop="deletePost(post.id)" 
                class="w-6 h-6 rounded-full bg-cream-100 dark:bg-zinc-800 text-text-muted hover:text-red-500 flex items-center justify-center cursor-pointer transition text-[10px]"
                title="Xóa bài viết"
              >
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </div>

          <!-- Content text -->
          <p v-if="post.content" class="text-xs text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {{ post.content }}
          </p>

          <!-- Images custom layout -->
          <div v-if="post.images && post.images.length > 0" class="mt-2">
            <!-- 1 Image -->
            <div v-if="post.images.length === 1" class="relative rounded-xl overflow-hidden max-h-60 border border-border">
              <img v-bind="getGridImageProps(post.images[0])" class="w-full h-full object-cover" />
            </div>

            <!-- 2 Images -->
            <div v-else-if="post.images.length === 2">
              <div v-if="post.layout_type === 'grid-equal'" class="grid grid-cols-2 gap-1.5 h-48 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[1])" /></div>
              </div>
              <div v-else-if="post.layout_type === 'left-large'" class="flex gap-1.5 h-48 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden w-2/3 h-full"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="relative overflow-hidden w-1/3 h-full"><img v-bind="getGridImageProps(post.images[1])" /></div>
              </div>
              <div v-else-if="post.layout_type === 'top-large'" class="flex flex-col gap-1.5 h-64 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden h-2/3 w-full"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="relative overflow-hidden h-1/3 w-full"><img v-bind="getGridImageProps(post.images[1])" /></div>
              </div>
            </div>

            <!-- 3 Images -->
            <div v-else-if="post.images.length === 3">
              <div v-if="post.layout_type === 'grid-equal'" class="grid grid-cols-3 gap-1.5 h-40 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[1])" /></div>
                <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[2])" /></div>
              </div>
              <div v-else-if="post.layout_type === 'left-large'" class="flex gap-1.5 h-56 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden w-2/3 h-full"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="w-1/3 flex flex-col gap-1.5 h-full">
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[1])" /></div>
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[2])" /></div>
                </div>
              </div>
              <div v-else-if="post.layout_type === 'top-large'" class="flex flex-col gap-1.5 h-64 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden h-2/3 w-full"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="h-1/3 flex gap-1.5 w-full">
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[1])" /></div>
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[2])" /></div>
                </div>
              </div>
            </div>

            <!-- 4 Images -->
            <div v-else-if="post.images.length === 4">
              <div v-if="post.layout_type === 'grid-equal'" class="grid grid-cols-2 gap-1.5 h-56 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[1])" /></div>
                <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[2])" /></div>
                <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[3])" /></div>
              </div>
              <div v-else-if="post.layout_type === 'left-large'" class="flex gap-1.5 h-56 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden w-2/3 h-full"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="w-1/3 flex flex-col gap-1.5 h-full">
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[1])" /></div>
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[2])" /></div>
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[3])" /></div>
                </div>
              </div>
              <div v-else-if="post.layout_type === 'top-large'" class="flex flex-col gap-1.5 h-64 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden h-2/3 w-full"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="h-1/3 flex gap-1.5 w-full">
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[1])" /></div>
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[2])" /></div>
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[3])" /></div>
                </div>
              </div>
            </div>

            <!-- 5 Images -->
            <div v-else-if="post.images.length === 5">
              <div v-if="post.layout_type === 'grid-equal'" class="flex flex-col gap-1.5 h-64 rounded-xl overflow-hidden border border-border">
                <div class="grid grid-cols-2 gap-1.5 h-1/2">
                  <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[0])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[1])" /></div>
                </div>
                <div class="grid grid-cols-3 gap-1.5 h-1/2">
                  <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[2])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[3])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[4])" /></div>
                </div>
              </div>
              <div v-else-if="post.layout_type === 'left-large'" class="flex gap-1.5 h-56 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden w-1/2 h-full"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="w-1/2 grid grid-cols-2 grid-rows-2 gap-1.5 h-full">
                  <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[1])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[2])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[3])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getGridImageProps(post.images[4])" /></div>
                </div>
              </div>
              <div v-else-if="post.layout_type === 'top-large'" class="flex flex-col gap-1.5 h-64 rounded-xl overflow-hidden border border-border">
                <div class="relative overflow-hidden h-1/2 w-full"><img v-bind="getGridImageProps(post.images[0])" /></div>
                <div class="h-1/2 flex gap-1.5 w-full">
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[1])" /></div>
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[2])" /></div>
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[3])" /></div>
                  <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getGridImageProps(post.images[4])" /></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom reaction display counts -->
          <div v-if="post.reactions && post.reactions.length > 0" class="flex gap-1.5 items-center text-[10px] text-text-secondary pt-1">
            <span class="flex items-center -space-x-1.5">
              <span 
                v-for="(_, emoji) in getReactionCounts(post)" 
                :key="emoji"
                class="inline-block bg-[#FDFBF7] dark:bg-[#1F1C18] px-1 rounded-full border border-cream-200 dark:border-cream-950/40 shadow-xs scale-90"
              >
                {{ emoji }}
              </span>
            </span>
            <span class="font-medium text-[9px] text-text-muted">
              {{ post.reactions.length }} người đã bày tỏ cảm xúc
            </span>
          </div>

          <!-- Post action buttons bar -->
          <div class="flex items-center gap-4 pt-2 border-t border-border-strong/5 text-xs select-none" @click.stop>
            
            <!-- Quick reaction picker popover -->
            <div class="relative">
              <button 
                @click="post.showEmojiPicker = !post.showEmojiPicker"
                class="flex items-center gap-1.5 text-text-secondary hover:text-[#D4537E] font-semibold py-1 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                :class="getUserReaction(post) ? 'text-[#D4537E]' : ''"
              >
                <span v-if="getUserReaction(post)">{{ getUserReaction(post) }}</span>
                <i v-else class="ti ti-heart"></i>
                <span>{{ getUserReaction(post) ? 'Đã thích' : 'Thích' }}</span>
              </button>

              <transition name="fade">
                <div 
                  v-if="post.showEmojiPicker"
                  class="absolute bottom-full left-0 mb-2 bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 p-2 rounded-full shadow-xl flex gap-2.5 z-10 animate-fade-in"
                >
                  <button 
                    v-for="emoji in ['❤️', '👍', '😆', '😢', '😮']" 
                    :key="emoji"
                    @click="reactToPost(post, emoji)"
                    class="text-lg hover:scale-130 transition cursor-pointer"
                  >
                    {{ emoji }}
                  </button>
                </div>
              </transition>
            </div>

            <!-- Comment redirect button -->
            <button 
              @click="openPostDetail(post)"
              class="flex items-center gap-1.5 text-text-secondary hover:text-blue-500 font-semibold py-1 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
            >
              <i class="ti ti-message"></i>
              <span>Bình luận ({{ post.comments?.length || 0 }})</span>
            </button>
          </div>
        </div>

        <!-- Empty Feed state banner -->
        <div v-if="posts.length === 0" class="text-center py-20 bg-surface-1 dark:bg-[#1D1A1F]/20 rounded-3xl border border-border">
          <i class="ti ti-rss text-3xl text-text-muted mb-2.5"></i>
          <p class="text-xs text-text-muted">Bảng tin trống. Đăng chia sẻ đầu tiên của hai bạn nhé! ❤️</p>
        </div>
      </div>

    </div>

    <!-- COMPOSE MODAL (Pop up for writing / editing post) -->
    <transition name="fade">
      <div 
        v-if="showComposeModal" 
        class="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showComposeModal = false"
      >
        <div class="w-full max-w-[360px] bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 rounded-3xl p-5 shadow-2xl space-y-4 text-[#4B2F15] dark:text-[#E2CBB2] max-h-[85vh] overflow-y-auto flex flex-col justify-between">
          <header class="flex justify-between items-center border-b border-[#EBE6DC] dark:border-[#2C2924] pb-2 flex-shrink-0">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#4B2F15] dark:text-[#E2CBB2]">
              {{ isEditing ? 'Chỉnh sửa bài viết' : 'Tạo chia sẻ mới' }}
            </h3>
            <button @click="showComposeModal = false" class="text-text-muted hover:text-gray-900 dark:hover:text-gray-100 text-xs">
              <i class="ti ti-x"></i>
            </button>
          </header>

          <div class="space-y-4 flex-1 my-2">
            <!-- Text input -->
            <textarea
              v-model="postContent"
              placeholder="Bạn đang nghĩ gì thế?..."
              rows="4"
              class="w-full text-xs p-2.5 bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent rounded-xl text-[#4B2F15] dark:text-[#E2CBB2] focus:outline-none resize-none font-sans leading-snug"
              :disabled="submittingPost"
            ></textarea>

            <!-- Image preview layouts -->
            <div v-if="previewItems.length >= 2" class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-[9px] font-bold text-text-secondary uppercase tracking-wide">Bố cục hiển thị ảnh:</span>
                <span class="text-[9px] text-[#D4537E] font-semibold">{{ previewItems.length }} ảnh</span>
              </div>
              
              <!-- Layout Selector -->
              <div class="flex gap-2.5">
                <button 
                  v-for="l in ['grid-equal', 'left-large', 'top-large']" 
                  :key="l"
                  @click="layoutType = (l as any)"
                  class="flex-1 py-1.5 px-2 text-[9px] rounded-lg border font-semibold transition text-center cursor-pointer uppercase tracking-wider"
                  :class="layoutType === l 
                    ? 'bg-romantic-500 border-romantic-600 text-white shadow-sm' 
                    : 'bg-[#F6F2E9] dark:bg-[#282420] border-[#EBE6DC] dark:border-transparent text-text-secondary'"
                >
                  {{ l === 'grid-equal' ? 'Đều' : l === 'left-large' ? 'Trái' : 'Trên' }}
                </button>
              </div>

              <!-- Live Layout Previews -->
              <div class="border border-[#EBE6DC] dark:border-[#2C2924] rounded-xl overflow-hidden p-1.5 bg-[#F6F2E9]/40 dark:bg-black/10">
                
                <!-- 2 Images -->
                <div v-if="previewItems.length === 2">
                  <div v-if="layoutType === 'grid-equal'" class="grid grid-cols-2 gap-1 h-32 rounded-lg overflow-hidden">
                    <div v-for="(item, idx) in previewItems" :key="idx" class="relative overflow-hidden h-full w-full">
                      <img v-bind="getComposerPreviewProps(item)" @click="startCropImage(idx)" />
                      <button @click="removePreview(idx)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                  </div>
                  <div v-else-if="layoutType === 'left-large'" class="flex gap-1 h-32 rounded-lg overflow-hidden">
                    <div class="w-2/3 h-full relative overflow-hidden">
                      <img v-bind="getComposerPreviewProps(previewItems[0])" @click="startCropImage(0)" />
                      <button @click="removePreview(0)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                    <div class="w-1/3 h-full relative overflow-hidden">
                      <img v-bind="getComposerPreviewProps(previewItems[1])" @click="startCropImage(1)" />
                      <button @click="removePreview(1)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                  </div>
                  <div v-else-if="layoutType === 'top-large'" class="flex flex-col gap-1 h-44 rounded-lg overflow-hidden">
                    <div class="h-2/3 w-full relative overflow-hidden">
                      <img v-bind="getComposerPreviewProps(previewItems[0])" @click="startCropImage(0)" />
                      <button @click="removePreview(0)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                    <div class="h-1/3 w-full relative overflow-hidden">
                      <img v-bind="getComposerPreviewProps(previewItems[1])" @click="startCropImage(1)" />
                      <button @click="removePreview(1)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                  </div>
                </div>

                <!-- 3 Images -->
                <div v-else-if="previewItems.length === 3">
                  <div v-if="layoutType === 'grid-equal'" class="grid grid-cols-3 gap-1 h-24 rounded-lg overflow-hidden">
                    <div v-for="(item, idx) in previewItems" :key="idx" class="relative overflow-hidden h-full w-full">
                      <img v-bind="getComposerPreviewProps(item)" @click="startCropImage(idx)" />
                      <button @click="removePreview(idx)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                  </div>
                  <div v-else-if="layoutType === 'left-large'" class="flex gap-1 h-36 rounded-lg overflow-hidden">
                    <div class="w-2/3 h-full relative overflow-hidden">
                      <img v-bind="getComposerPreviewProps(previewItems[0])" @click="startCropImage(0)" />
                      <button @click="removePreview(0)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                    <div class="w-1/3 flex flex-col gap-1 h-full">
                      <div class="h-1/2 relative overflow-hidden">
                        <img v-bind="getComposerPreviewProps(previewItems[1])" @click="startCropImage(1)" />
                        <button @click="removePreview(1)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                      </div>
                      <div class="h-1/2 relative overflow-hidden">
                        <img v-bind="getComposerPreviewProps(previewItems[2])" @click="startCropImage(2)" />
                        <button @click="removePreview(2)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="layoutType === 'top-large'" class="flex flex-col gap-1 h-44 rounded-lg overflow-hidden">
                    <div class="h-2/3 w-full relative overflow-hidden">
                      <img v-bind="getComposerPreviewProps(previewItems[0])" @click="startCropImage(0)" />
                      <button @click="removePreview(0)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                    <div class="h-1/3 flex gap-1 w-full">
                      <div class="w-1/2 h-full relative overflow-hidden">
                        <img v-bind="getComposerPreviewProps(previewItems[1])" @click="startCropImage(1)" />
                        <button @click="removePreview(1)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                      </div>
                      <div class="w-1/2 h-full relative overflow-hidden">
                        <img v-bind="getComposerPreviewProps(previewItems[2])" @click="startCropImage(2)" />
                        <button @click="removePreview(2)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 4 Images -->
                <div v-else-if="previewItems.length === 4">
                  <div v-if="layoutType === 'grid-equal'" class="grid grid-cols-2 gap-1 h-36 rounded-lg overflow-hidden">
                    <div v-for="(item, idx) in previewItems" :key="idx" class="relative overflow-hidden h-full w-full">
                      <img v-bind="getComposerPreviewProps(item)" @click="startCropImage(idx)" />
                      <button @click="removePreview(idx)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                  </div>
                  <div v-else-if="layoutType === 'left-large'" class="flex gap-1 h-36 rounded-lg overflow-hidden">
                    <div class="w-2/3 h-full relative">
                      <img v-bind="getComposerPreviewProps(previewItems[0])" @click="startCropImage(0)" />
                      <button @click="removePreview(0)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                    <div class="w-1/3 flex flex-col gap-1 h-full">
                      <div class="h-[33%] relative overflow-hidden" v-for="idx in [1, 2, 3]" :key="idx">
                        <img v-bind="getComposerPreviewProps(previewItems[idx])" @click="startCropImage(idx)" />
                        <button @click="removePreview(idx)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="layoutType === 'top-large'" class="flex flex-col gap-1 h-44 rounded-lg overflow-hidden">
                    <div class="h-2/3 w-full relative overflow-hidden">
                      <img v-bind="getComposerPreviewProps(previewItems[0])" @click="startCropImage(0)" />
                      <button @click="removePreview(0)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                    <div class="h-1/3 flex gap-1 w-full">
                      <div class="w-1/3 h-full relative overflow-hidden" v-for="idx in [1, 2, 3]" :key="idx">
                        <img v-bind="getComposerPreviewProps(previewItems[idx])" @click="startCropImage(idx)" />
                        <button @click="removePreview(idx)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 5 Images -->
                <div v-else-if="previewItems.length === 5">
                  <div v-if="layoutType === 'grid-equal'" class="flex flex-col gap-1 h-44 rounded-lg overflow-hidden">
                    <div class="grid grid-cols-2 gap-1 h-1/2">
                      <div class="relative overflow-hidden h-full w-full" v-for="idx in [0, 1]" :key="idx">
                        <img v-bind="getComposerPreviewProps(previewItems[idx])" @click="startCropImage(idx)" />
                        <button @click="removePreview(idx)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                      </div>
                    </div>
                    <div class="grid grid-cols-3 gap-1 h-1/2">
                      <div class="relative overflow-hidden h-full w-full" v-for="idx in [2, 3, 4]" :key="idx">
                        <img v-bind="getComposerPreviewProps(previewItems[idx])" @click="startCropImage(idx)" />
                        <button @click="removePreview(idx)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="layoutType === 'left-large'" class="flex gap-1 h-36 rounded-lg overflow-hidden">
                    <div class="w-1/2 h-full relative overflow-hidden">
                      <img v-bind="getComposerPreviewProps(previewItems[0])" @click="startCropImage(0)" />
                      <button @click="removePreview(0)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                    <div class="w-1/2 grid grid-cols-2 grid-rows-2 gap-1 h-full">
                      <div class="relative overflow-hidden h-full w-full" v-for="idx in [1, 2, 3, 4]" :key="idx">
                        <img v-bind="getComposerPreviewProps(previewItems[idx])" @click="startCropImage(idx)" />
                        <button @click="removePreview(idx)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="layoutType === 'top-large'" class="flex flex-col gap-1 h-44 rounded-lg overflow-hidden">
                    <div class="h-1/2 w-full relative overflow-hidden">
                      <img v-bind="getComposerPreviewProps(previewItems[0])" @click="startCropImage(0)" />
                      <button @click="removePreview(0)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                    </div>
                    <div class="h-1/2 flex gap-1 w-full">
                      <div class="w-1/4 h-full relative overflow-hidden" v-for="idx in [1, 2, 3, 4]" :key="idx">
                        <img v-bind="getComposerPreviewProps(previewItems[idx])" @click="startCropImage(idx)" />
                        <button @click="removePreview(idx)" class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[8px] cursor-pointer"><i class="ti ti-x"></i></button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <!-- Single image display -->
            <div v-else-if="previewItems.length === 1" class="relative rounded-xl overflow-hidden max-h-40 border border-[#EBE6DC] dark:border-transparent">
              <img 
                :src="previewItems[0].originalUrl || previewItems[0].url"
                class="w-full h-auto max-h-40 object-cover cursor-pointer hover:opacity-90 transition"
                @click="startCropImage(0)"
              />
              <button @click="removePreview(0)" class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs cursor-pointer">
                <i class="ti ti-x"></i>
              </button>
            </div>
          </div>

          <!-- Bottom controls bar -->
          <footer class="flex justify-between items-center border-t border-[#EBE6DC] dark:border-[#2C2924] pt-3 flex-shrink-0">
            <div>
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                id="modal-image-upload" 
                class="hidden" 
                @change="handleFileChange"
                :disabled="previewItems.length >= 5 || submittingPost"
              />
              <label 
                for="modal-image-upload"
                class="flex items-center gap-1 text-[10px] font-semibold text-[#993556] dark:text-[#F4C0D1] bg-[#FBEAF0] dark:bg-rosewood-950/40 py-1.5 px-3.5 rounded-full cursor-pointer hover:bg-[#F9D6E2] dark:hover:bg-rosewood-900/50 transition"
                :class="previewItems.length >= 5 ? 'opacity-50 pointer-events-none' : ''"
              >
                <i class="ti ti-photo-plus"></i>
                <span>Thêm ảnh (Tối đa 5)</span>
              </label>
            </div>

            <button
              @click="publishPost"
              :disabled="submittingPost"
              class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs font-semibold py-1.5 px-5 rounded-xl cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <i v-if="submittingPost" class="ti ti-loader animate-spin"></i>
              <span>{{ submittingPost ? 'Đang lưu...' : (isEditing ? 'Lưu cập nhật' : 'Đăng ngay') }}</span>
            </button>
          </footer>
        </div>
      </div>
    </transition>

    <!-- POST DETAIL MODAL (Pop up for detail viewing & commenting) -->
    <transition name="fade">
      <div 
        v-if="showDetailModal && activePost" 
        class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showDetailModal = false"
      >
        <div class="w-full max-w-[380px] bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 rounded-3xl p-5 shadow-2xl text-[#4B2F15] dark:text-[#E2CBB2] max-h-[90vh] overflow-y-auto flex flex-col justify-between">
          <header class="flex justify-between items-center border-b border-[#EBE6DC] dark:border-[#2C2924] pb-2 flex-shrink-0">
            <h3 class="text-xs font-bold uppercase tracking-wider">Chi tiết bài đăng</h3>
            <button @click="showDetailModal = false" class="text-text-muted hover:text-gray-900 dark:hover:text-gray-100 text-xs">
              <i class="ti ti-x"></i>
            </button>
          </header>

          <div class="flex-1 space-y-4 my-3 overflow-y-auto pr-1">
            <!-- Header Author card details -->
            <div class="flex justify-between items-start">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full border border-cream-200/60 overflow-hidden flex-shrink-0">
                  <img :src="getAvatarUrl(activePost.user_id)" class="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 class="text-xs font-bold text-gray-900 dark:text-gray-100 leading-tight">
                    {{ getAuthorName(activePost.user_id) }}
                  </h4>
                  <p class="text-[8px] text-text-muted leading-tight mt-0.5">
                    {{ dayjs(activePost.created_at).fromNow() }}
                  </p>
                </div>
              </div>

              <!-- Post edits & removals -->
              <div class="flex items-center gap-2" v-if="activePost.user_id === authStore.user?.id || authStore.role === 'admin'">
                <button 
                  @click="openEditPostComposer(activePost)"
                  class="text-text-muted hover:text-[#D4537E] cursor-pointer text-xs"
                  title="Chỉnh sửa bài viết"
                >
                  <i class="ti ti-edit"></i>
                </button>
                <button 
                  @click="deletePost(activePost.id)"
                  class="text-text-muted hover:text-red-500 cursor-pointer text-xs"
                  title="Xóa bài viết"
                >
                  <i class="ti ti-trash"></i>
                </button>
              </div>
            </div>

            <!-- Content body text -->
            <p v-if="activePost.content" class="text-xs text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {{ activePost.content }}
            </p>

            <!-- Image layouts mapping -->
            <div v-if="activePost.images && activePost.images.length > 0" class="mt-2">
              <div v-if="activePost.images.length === 1" class="relative rounded-xl overflow-hidden max-h-56 border border-border">
                <img v-bind="getDetailImageProps(activePost.images[0])" class="w-full h-full object-cover" />
              </div>
              <div v-else-if="activePost.images.length === 2">
                <div v-if="activePost.layout_type === 'grid-equal'" class="grid grid-cols-2 gap-1 h-36 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                </div>
                <div v-else-if="activePost.layout_type === 'left-large'" class="flex gap-1 h-36 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden w-2/3 h-full"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="relative overflow-hidden w-1/3 h-full"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                </div>
                <div v-else-if="activePost.layout_type === 'top-large'" class="flex flex-col gap-1 h-44 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden h-2/3 w-full"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="relative overflow-hidden h-1/3 w-full"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                </div>
              </div>
              <div v-else-if="activePost.images.length === 3">
                <div v-if="activePost.layout_type === 'grid-equal'" class="grid grid-cols-3 gap-1 h-28 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[2])" /></div>
                </div>
                <div v-else-if="activePost.layout_type === 'left-large'" class="flex gap-1 h-40 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden w-2/3 h-full"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="w-1/3 flex flex-col gap-1 h-full">
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[2])" /></div>
                  </div>
                </div>
                <div v-else-if="activePost.layout_type === 'top-large'" class="flex flex-col gap-1 h-44 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden h-2/3 w-full"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="h-1/3 flex gap-1 w-full">
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[2])" /></div>
                  </div>
                </div>
              </div>

              <!-- 4 Images -->
              <div v-else-if="activePost.images.length === 4">
                <div v-if="activePost.layout_type === 'grid-equal'" class="grid grid-cols-2 gap-1 h-48 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[2])" /></div>
                  <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[3])" /></div>
                </div>
                <div v-else-if="activePost.layout_type === 'left-large'" class="flex gap-1 h-48 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden w-2/3 h-full"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="w-1/3 flex flex-col gap-1 h-full">
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[2])" /></div>
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[3])" /></div>
                  </div>
                </div>
                <div v-else-if="activePost.layout_type === 'top-large'" class="flex flex-col gap-1 h-56 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden h-2/3 w-full"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="h-1/3 flex gap-1 w-full">
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[2])" /></div>
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[3])" /></div>
                  </div>
                </div>
              </div>

              <!-- 5 Images -->
              <div v-else-if="activePost.images.length === 5">
                <div v-if="activePost.layout_type === 'grid-equal'" class="flex flex-col gap-1 h-56 rounded-xl overflow-hidden border border-border">
                  <div class="grid grid-cols-2 gap-1 h-1/2">
                    <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                    <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                  </div>
                  <div class="grid grid-cols-3 gap-1 h-1/2">
                    <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[2])" /></div>
                    <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[3])" /></div>
                    <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[4])" /></div>
                  </div>
                </div>
                <div v-else-if="activePost.layout_type === 'left-large'" class="flex gap-1 h-48 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden w-1/2 h-full"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="w-1/2 grid grid-cols-2 grid-rows-2 gap-1 h-full">
                    <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                    <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[2])" /></div>
                    <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[3])" /></div>
                    <div class="relative overflow-hidden"><img v-bind="getDetailImageProps(activePost.images[4])" /></div>
                  </div>
                </div>
                <div v-else-if="activePost.layout_type === 'top-large'" class="flex flex-col gap-1 h-56 rounded-xl overflow-hidden border border-border">
                  <div class="relative overflow-hidden h-1/2 w-full"><img v-bind="getDetailImageProps(activePost.images[0])" /></div>
                  <div class="h-1/2 flex gap-1 w-full">
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[1])" /></div>
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[2])" /></div>
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[3])" /></div>
                    <div class="relative overflow-hidden flex-1 min-h-0"><img v-bind="getDetailImageProps(activePost.images[4])" /></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Reactions Count section -->
            <div v-if="activePost.reactions && activePost.reactions.length > 0" class="flex gap-1 items-center text-[9px] text-text-secondary py-1 border-b border-[#EBE6DC] dark:border-[#2C2924]">
              <span class="flex items-center -space-x-1.5">
                <span v-for="(_, emoji) in getReactionCounts(activePost)" :key="emoji" class="bg-white dark:bg-[#2C2924] px-1 rounded-full border border-cream-200 dark:border-cream-950/40 shadow-xs">
                  {{ emoji }}
                </span>
              </span>
              <span class="text-text-muted font-medium">{{ activePost.reactions.length }} người đã bày tỏ cảm xúc</span>
            </div>

            <!-- Reactions and Share Actions Bar -->
            <div class="flex items-center gap-3 select-none">
              <!-- Inline reaction trigger -->
              <div class="relative">
                <button 
                  @click="activePost.showEmojiPicker = !activePost.showEmojiPicker"
                  class="flex items-center gap-1.5 text-text-secondary hover:text-[#D4537E] font-semibold py-1 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                  :class="getUserReaction(activePost) ? 'text-[#D4537E]' : ''"
                >
                  <span v-if="getUserReaction(activePost)">{{ getUserReaction(activePost) }}</span>
                  <i v-else class="ti ti-heart"></i>
                  <span>Thích</span>
                </button>

                <transition name="fade">
                  <div 
                    v-if="activePost.showEmojiPicker"
                    class="absolute bottom-full left-0 mb-2 bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 p-2 rounded-full shadow-xl flex gap-2.5 z-10"
                  >
                    <button 
                      v-for="emoji in ['❤️', '👍', '😆', '😢', '😮']" 
                      :key="emoji"
                      @click="reactToPost(activePost, emoji)"
                      class="text-lg hover:scale-130 transition cursor-pointer"
                    >
                      {{ emoji }}
                    </button>
                  </div>
                </transition>
              </div>
            </div>

            <!-- Comments thread header -->
            <div class="space-y-3">
              <h5 class="text-[10px] font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                <i class="ti ti-messages"></i>
                <span>Cuộc đối thoại ({{ activePost.comments?.length || 0 }})</span>
              </h5>

              <!-- Comments scrolling thread -->
              <div v-if="activePost.comments && activePost.comments.length > 0" class="space-y-3 max-h-56 overflow-y-auto">
                <div v-for="c in activePost.comments" :key="c.id" class="flex items-start gap-2.5 text-xs">
                  
                  <!-- Avatar -->
                  <div class="w-7 h-7 rounded-full border border-cream-200/60 overflow-hidden flex-shrink-0 mt-0.5">
                    <img :src="getAvatarUrl(c.user_id)" class="w-full h-full object-cover" />
                  </div>

                  <!-- Text area & Action flags -->
                  <div class="flex-1 bg-[#F6F2E9] dark:bg-[#282420]/30 py-1.5 px-2.5 rounded-xl border border-cream-200/40 dark:border-transparent min-w-0">
                    <div class="flex justify-between items-center">
                      <span class="font-bold text-[10px] text-gray-900 dark:text-gray-100">
                        {{ getAuthorName(c.user_id) }}
                      </span>
                      
                      <!-- Edit or Delete comment trigger option -->
                      <div class="flex items-center gap-1.5" v-if="c.user_id === authStore.user?.id || authStore.role === 'admin'">
                        <button @click="startEditComment(c)" class="text-[8px] text-text-muted hover:text-[#D4537E]" title="Sửa">Sửa</button>
                        <button @click="deleteComment(c.id)" class="text-[8px] text-text-muted hover:text-red-500" title="Xóa">Xóa</button>
                      </div>
                    </div>

                    <!-- Inline editing comment input -->
                    <div v-if="editingCommentId === c.id" class="mt-1 flex gap-2">
                      <input 
                        v-model="editingCommentText"
                        type="text"
                        class="flex-1 text-[10px] p-1.5 bg-[#FDFBF7] dark:bg-black/20 border border-[#EBE6DC] dark:border-transparent rounded-lg text-[#4B2F15] dark:text-[#E2CBB2]"
                        @keyup.enter="saveCommentUpdate(c)"
                      />
                      <button @click="saveCommentUpdate(c)" class="text-[9px] font-bold text-emerald-600">Lưu</button>
                      <button @click="editingCommentId = null" class="text-[9px] text-text-muted">Hủy</button>
                    </div>

                    <!-- Render default comment content -->
                    <p v-else class="text-text-secondary text-[10px] mt-0.5 break-words leading-relaxed">
                      {{ c.content }}
                    </p>

                    <p class="text-[7px] text-text-muted text-right mt-0.5">
                      {{ dayjs(c.created_at).fromNow() }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Empty state comments thread -->
              <p v-else class="text-[10px] text-text-muted text-center italic py-4">
                Chưa có đối thoại nào. Hãy gửi lời yêu thương đầu tiên!
              </p>
            </div>
          </div>

          <!-- Comment input block at bottom of details modal -->
          <footer class="border-t border-[#EBE6DC] dark:border-[#2C2924] pt-3 flex-shrink-0">
            <form @submit.prevent="sendComment(activePost.id)" class="flex gap-2">
              <input 
                v-model="newCommentText"
                type="text"
                placeholder="Viết bình luận của bạn..."
                class="flex-1 text-xs p-2.5 bg-[#F6F2E9] dark:bg-[#282420] border border-[#EBE6DC] dark:border-transparent rounded-xl text-[#4B2F15] dark:text-[#E2CBB2] focus:outline-none"
              />
              <button 
                type="submit"
                class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-[10px] font-bold py-1 px-4 rounded-xl transition cursor-pointer flex items-center justify-center"
              >
                Gửi
              </button>
            </form>
          </footer>
        </div>
      </div>
    </transition>


    <!-- Crop Modal -->
    <transition name="fade">
      <div 
        v-if="showCropModal" 
        class="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showCropModal = false"
      >
        <div class="w-full max-w-[340px] bg-[#FDFBF7] dark:bg-[#1F1C18] border border-cream-200 dark:border-cream-950/40 rounded-3xl p-5 shadow-2xl space-y-4 text-[#4B2F15] dark:text-[#E2CBB2] select-none">
          <header class="flex justify-between items-center border-b border-[#EBE6DC] dark:border-[#2C2924] pb-2">
            <h3 class="text-xs font-bold uppercase tracking-wider">Cắt & Điều chỉnh ảnh</h3>
            <button @click="showCropModal = false" class="text-text-muted hover:text-gray-900 dark:hover:text-gray-100 text-xs">
              <i class="ti ti-x"></i>
            </button>
          </header>

          <p class="text-[10px] text-text-secondary leading-snug">
            Kéo rê ảnh bằng chuột/1 ngón tay để di chuyển vị trí. Cuộn chuột hoặc dùng 2 ngón tay chụm (pinch) để thu phóng ảnh gốc sắc nét.
          </p>

          <!-- Viewport container -->
          <div 
            class="relative w-64 h-64 mx-auto rounded-xl border border-cream-200 dark:border-cream-950/40 bg-[#121013] overflow-hidden select-none touch-none cursor-move flex items-center justify-center"
            @mousedown="handleDragStart"
            @mousemove="handleDragMove"
            @mouseup="handleDragEnd"
            @mouseleave="handleDragEnd"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleDragEnd"
            @wheel="handleWheel"
          >
            <!-- Background Image (Visible through the shadow overlay) -->
            <img 
              :src="cropImageSrc" 
              @load="onCropImageLoad"
              class="absolute max-w-none origin-center pointer-events-none select-none" 
              :style="{
                left: imgLeft + 'px',
                top: imgTop + 'px',
                width: fittedWidth + 'px',
                height: fittedHeight + 'px',
                transform: `translate(${posX}px, ${posY}px) scale(${zoom})`
              }"
            />
            
            <!-- Crop Frame Highlight Box (Overlay) -->
            <div 
              class="absolute border-2 border-white box-border shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none flex flex-col justify-between"
              :style="{
                left: cropLeft + 'px',
                top: cropTop + 'px',
                width: cropW + 'px',
                height: cropH + 'px'
              }"
            >
              <!-- Subtle grid overlay -->
              <div class="w-full h-full relative pointer-events-none">
                <div class="absolute inset-0 border border-white/20 flex flex-col justify-between">
                  <div class="h-1/3 w-full border-b border-white/10"></div>
                  <div class="h-1/3 w-full border-b border-white/10"></div>
                </div>
                <div class="absolute inset-0 flex justify-between">
                  <div class="w-1/3 h-full border-r border-white/10"></div>
                  <div class="w-1/3 h-full border-r border-white/10"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <footer class="flex gap-3 justify-end pt-2 border-t border-[#EBE6DC] dark:border-[#2C2924]">
            <button 
              @click="showCropModal = false"
              class="px-4 py-1.5 rounded-xl border border-cream-200 dark:border-cream-950/40 text-text-secondary text-xs font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button 
              @click="confirmCrop"
              class="bg-[#D4537E] hover:bg-[#c2436d] text-white text-xs font-semibold py-1.5 px-4 rounded-xl cursor-pointer transition flex items-center gap-1.5"
            >
              <span>Lưu chỉnh sửa</span>
            </button>
          </footer>
        </div>
      </div>
    </transition>

    <!-- Lightbox Modal -->
    <transition name="fade">
      <div 
        v-if="showLightbox && activeLightboxUrl" 
        class="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4"
        @click="showLightbox = false"
      >
        <!-- Top bar with actions -->
        <div class="absolute top-4 left-4 right-4 flex justify-between items-center z-10" @click.stop>
          <span class="text-white/60 text-[10px] font-sans">Đang xem ảnh</span>
          <div class="flex items-center gap-3">
            <!-- Download Button -->
            <button 
              @click="downloadImage(activeLightboxUrl)" 
              class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition text-sm"
              title="Tải ảnh xuống"
            >
              <i class="ti ti-download"></i>
            </button>
            <!-- Close Button -->
            <button 
              @click="showLightbox = false" 
              class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition text-sm"
              title="Đóng"
            >
              <i class="ti ti-x"></i>
            </button>
          </div>
        </div>

        <!-- Centered Image -->
        <div class="max-w-full max-h-[80vh] flex items-center justify-center" @click.stop>
          <img 
            :src="activeLightboxUrl" 
            class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl select-none"
          />
        </div>
      </div>
    </transition>

    <!-- Navigation Global bar -->
    <Navbar />
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.15s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
