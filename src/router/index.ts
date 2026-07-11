import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

// Public Views
const LoginView = () => import('../public/LoginView.vue')
const LandingView = () => import('../public/LandingView.vue')
const LettersView = () => import('../public/LettersView.vue')
const TimelineDetailView = () => import('../public/TimelineDetailView.vue')
const LoveMapView = () => import('../public/LoveMapView.vue')
const GalleryView = () => import('../public/GalleryView.vue')
const QuizView = () => import('../public/QuizView.vue')
const FeedView = () => import('../public/FeedView.vue')

// Admin Views
const AdminLayout = () => import('../admin/AdminLayout.vue')
const AdminLettersListView = () => import('../admin/AdminLettersListView.vue')
const AdminLetterEditView = () => import('../admin/AdminLetterEditView.vue')
const AdminTimelineListView = () => import('../admin/AdminTimelineListView.vue')
const AdminTimelineEditView = () => import('../admin/AdminTimelineEditView.vue')
const AdminSettingsView = () => import('../admin/AdminSettingsView.vue')
const AdminMapListView = () => import('../admin/AdminMapListView.vue')
const AdminMapEditView = () => import('../admin/AdminMapEditView.vue')
const AdminGalleryView = () => import('../admin/AdminGalleryView.vue')
const AdminBucketView = () => import('../admin/AdminBucketView.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true }
    },
    // Public User routes
    {
      path: '/',
      name: 'landing',
      component: LandingView,
      meta: { requiresAuth: true }
    },
    {
      path: '/letters',
      name: 'letters',
      component: LettersView,
      meta: { requiresAuth: true }
    },
    {
      path: '/timeline/:id',
      name: 'timeline-detail',
      component: TimelineDetailView,
      meta: { requiresAuth: true }
    },
    {
      path: '/map',
      name: 'love-map',
      component: LoveMapView,
      meta: { requiresAuth: true }
    },
    {
      path: '/gallery',
      name: 'gallery',
      component: GalleryView,
      meta: { requiresAuth: true }
    },
    {
      path: '/quiz',
      name: 'quiz',
      component: QuizView,
      meta: { requiresAuth: true }
    },
    {
      path: '/feed',
      name: 'feed',
      component: FeedView,
      meta: { requiresAuth: true }
    },
    // Admin routes wrapped in AdminLayout
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAdmin: true },
      children: [
        {
          path: '',
          name: 'admin-letters',
          component: AdminLettersListView
        },
        {
          path: 'letter/new',
          name: 'admin-letter-new',
          component: AdminLetterEditView
        },
        {
          path: 'letter/edit/:id',
          name: 'admin-letter-edit',
          component: AdminLetterEditView
        },
        {
          path: 'timeline',
          name: 'admin-timeline',
          component: AdminTimelineListView
        },
        {
          path: 'timeline/new',
          name: 'admin-timeline-new',
          component: AdminTimelineEditView
        },
        {
          path: 'timeline/edit/:id',
          name: 'admin-timeline-edit',
          component: AdminTimelineEditView
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: AdminSettingsView
        },
        {
          path: 'map',
          name: 'admin-map',
          component: AdminMapListView
        },
        {
          path: 'map/new',
          name: 'admin-map-new',
          component: AdminMapEditView
        },
        {
          path: 'map/edit/:id',
          name: 'admin-map-edit',
          component: AdminMapEditView
        },
        {
          path: 'gallery',
          name: 'admin-gallery',
          component: AdminGalleryView
        },
        {
          path: 'bucket',
          name: 'admin-bucket',
          component: AdminBucketView
        }
      ]
    },
    // Fallback redirect
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  if (authStore.loading) {
    await authStore.initialize()
  }

  const isAuth = !!authStore.user
  const role = authStore.role

  if (to.matched.some(record => record.meta.requiresAuth) && !isAuth) {
    next('/login')
  } else if (to.matched.some(record => record.meta.requiresAdmin) && (!isAuth || role !== 'admin')) {
    next(isAuth ? '/' : '/login')
  } else if (to.matched.some(record => record.meta.requiresGuest) && isAuth) {
    next('/')
  } else {
    next()
  }
})

export default router
