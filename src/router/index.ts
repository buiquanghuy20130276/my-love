import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

// Public Views
import LoginView from '../public/LoginView.vue'
import LandingView from '../public/LandingView.vue'
import LettersView from '../public/LettersView.vue'
import TimelineDetailView from '../public/TimelineDetailView.vue'
import LoveMapView from '../public/LoveMapView.vue'
import GalleryView from '../public/GalleryView.vue'
import QuizView from '../public/QuizView.vue'

// Admin Views
import AdminLayout from '../admin/AdminLayout.vue'
import AdminLettersListView from '../admin/AdminLettersListView.vue'
import AdminLetterEditView from '../admin/AdminLetterEditView.vue'
import AdminTimelineListView from '../admin/AdminTimelineListView.vue'
import AdminTimelineEditView from '../admin/AdminTimelineEditView.vue'
import AdminSettingsView from '../admin/AdminSettingsView.vue'
import AdminMapListView from '../admin/AdminMapListView.vue'
import AdminMapEditView from '../admin/AdminMapEditView.vue'
import AdminGalleryView from '../admin/AdminGalleryView.vue'

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
