# Implementation Plan: Love Story Web App

**Stack:** Vue 3 (Vite) + Pinia + Vue Router + Supabase (Auth, Postgres, Storage) + Tailwind CSS + animation/UI libraries (see below)
**Language note:** All planning/technical docs and code comments are in English. All **user-facing content** (UI labels, letters, timeline captions, buttons) must be written in **Vietnamese**.
**Access model:** No public "protection PIN". Instead, there are exactly **2 accounts** (created manually in Supabase Auth, no public sign-up):
- `admin` (the developer/boyfriend) — full CRUD access via `/admin`
- `partner` (cô ấy) — read-only access to the private landing page after login

Everything (including the landing page) sits behind login. There is no anonymous public access.

**Design priority — Mobile-first:** The partner (cô ấy) will view this app almost exclusively on a phone. All public-facing views (landing page, timeline, letters, love map, guestbook, quiz, gallery) must be designed and built **mobile-first** — layouts, touch targets, animations, and image sizing should be validated on small screens (~360–430px width) before being adapted upward to tablet/desktop. The admin panel can remain desktop-first since only the admin manages content, but should still be usable on mobile as a fallback.

---

## Recommended CSS / UI / Animation Libraries

Since visual polish is a priority, the public-facing side of this app should lean on proven libraries rather than hand-rolled CSS wherever possible.

| Purpose | Library | Notes |
|---|---|---|
| Utility CSS framework | **Tailwind CSS** | Fast, consistent, mobile-first by default (`sm:`, `md:` breakpoints). Base for all custom styling. |
| Headless accessible components | **Radix Vue** or **Headless UI (Vue)** | Unstyled but accessible dialogs, dropdowns, tabs — style with Tailwind on top for a fully custom look. |
| Prebuilt styled components (optional shortcut) | **shadcn-vue** | Copy-paste component recipes built on Radix Vue + Tailwind; speeds up admin panel forms/tables. |
| Scroll & reveal animations | **AOS (Animate On Scroll)** or **@vueuse/motion** | Powers the timeline's fade-in/slide-in-on-scroll effect with minimal code. |
| Rich micro-interactions & transitions | **GSAP** (with `ScrollTrigger` plugin) | For the envelope-opening animation, counter count-up effect, and any hero/landing page flourishes. Use selectively — keep it light on mobile. |
| Icons | **Lucide Vue** (or **Heroicons**) | Clean, consistent line icons for buttons, tags, nav. |
| Fonts | **Google Fonts** with good Vietnamese diacritic support (e.g. **Be Vietnam Pro**, **Inter**, or a soft handwritten-style accent font like **Just Another Hand** / **Playfair Display** for letter headings) | Must render Vietnamese tone marks correctly — always test with real Vietnamese text before finalizing. |
| Image lightbox/gallery | **vue-easy-lightbox** or **PhotoSwipe** | For the full photo gallery (Phase 8) and timeline image viewing. |
| Carousel/swiper | **Swiper.js** (Vue bindings) | For multi-image timeline entries and touch-friendly swiping on mobile. |
| Drag-and-drop reordering (admin) | **vuedraggable** (SortableJS wrapper) | Used in Phase 4 for timeline reordering. |
| Maps | **Leaflet** + **vue-leaflet** | Free, no API key required, for the Love Map feature (Phase 8). |
| Toasts/notifications | **vue-sonner** or **vue-toastification** | For success/error feedback across admin and public views. |
| Confetti / celebratory effects (optional nice-to-have) | **canvas-confetti** | Fun touch for milestone dates or quiz correct answers. |

**Guiding principle:** Tailwind handles layout/spacing/typography; GSAP + AOS/motion handle animation; Radix/shadcn-vue or Headless UI handle accessible interactive primitives (modals, dropdowns) so the admin doesn't need to build those from scratch. Keep the actual color palette, spacing scale, and font pairing custom/curated (see Phase 0) rather than using an unstyled default theme — the goal is a distinctive, romantic look, not a generic "Bootstrap" or "Material" feel.

---

## Phase 0 — Project Setup & Infrastructure

**Goal:** Bootstrap the repo and Supabase project so later phases have a working foundation.

- [ ] Init Vue 3 + Vite project (`npm create vite@latest`, Vue + TypeScript template)
- [ ] Install core dependencies: `vue-router`, `pinia`, `@supabase/supabase-js`, `dayjs`
- [ ] Install and configure **Tailwind CSS** (mobile-first breakpoints, `darkMode: 'class'`), set up a custom theme (color palette, font families, spacing scale) instead of default Tailwind theme, with a matching dark-mode color set for every custom token
- [ ] Build a `useTheme` composable / Pinia `themeStore`: reads `settings.theme_mode_default` on first login, then persists the user's manual light/dark toggle choice locally (per-device, e.g. `localStorage` or a cookie) so each account can keep its own preference across sessions
- [ ] Install UI/animation libraries: `@vueuse/core`, `@vueuse/motion` or `aos`, `gsap`, `lucide-vue-next` (icons)
- [ ] Set up Google Fonts with Vietnamese diacritic support (e.g. Be Vietnam Pro for body text, an accent font for letter headings) — test rendering with real Vietnamese sentences immediately
- [ ] Decide on Radix Vue / Headless UI vs shadcn-vue for interactive primitives (modals, dropdowns, tabs) and scaffold one example component to validate the choice
- [ ] Install feature-specific libraries as stubs for later phases: `swiper` (carousels), `vue-easy-lightbox` or `photoswipe` (gallery), `vuedraggable` (Phase 4), `leaflet` + `vue-leaflet` (Phase 8 map), `vue-sonner` (toasts)
- [ ] Create Supabase project
- [ ] Set up `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Create `src/lib/supabaseClient.ts`
- [ ] Set up base folder structure:
  ```
  src/
    admin/         # admin-only views
    public/        # landing page views (partner-facing)
    components/
    stores/
    router/
    lib/
  ```
- [ ] Configure Vue Router with two top-level branches: `/admin/*` and `/` (landing page), both behind an auth guard
- [ ] Add `<meta name="viewport" content="width=device-width, initial-scale=1">` and set up a mobile-first CSS approach (e.g. CSS variables + `min-width` media queries, or a utility framework like Tailwind used mobile-first)
- [ ] Deploy skeleton to Vercel/Netlify to validate CI/CD pipeline early, and test the deployed skeleton on an actual phone browser

**Output:** Empty but deployable app connected to Supabase.

---

## Phase 1 — Database Schema & Supabase Setup

**Goal:** Design and create all tables, storage buckets, and Row Level Security (RLS) policies.

### Tables

**`profiles`** (mirrors `auth.users`, extends role info)
| column | type | notes |
|---|---|---|
| id | uuid, PK, FK → auth.users.id | |
| role | text | `'admin'` or `'partner'` |
| display_name | text | e.g. "Anh", "Em" |

**`settings`** (single-row config table)
| column | type | notes |
|---|---|---|
| id | int, PK (always 1) | |
| relationship_start_date | date | used for day counter |
| theme_color | text | |
| theme_mode_default | text | `'light'` \| `'dark'` — default mode when a user first logs in; the user's later toggle choice is remembered locally, not stored here |
| partner_a_name | text | e.g. "Diệu Thiện" |
| partner_a_avatar_url | text | profile photo shown on the left of the day counter |
| partner_b_name | text | e.g. "Quang Huy" |
| partner_b_avatar_url | text | profile photo shown on the right of the day counter |
| cover_image_url | text | |
| next_special_date | date, nullable | for countdown feature |
| next_special_label | text, nullable | e.g. "Kỷ niệm 1 năm" |

**`letters`**
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| title | text | |
| content | text (rich text/HTML or Markdown) | |
| tag | text | e.g. "Xin lỗi", "Thư tình", "Nhớ em" |
| status | text | `'draft'` \| `'published'` |
| unlock_date | date, nullable | if set, hidden until this date even if published |
| cover_image_url | text, nullable | |
| created_at | timestamptz | |

**`timeline_events`**
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| title | text | |
| description | text | |
| event_date | date | |
| is_special | boolean | highlight milestone |
| sort_order | int | manual drag-drop order |
| created_at | timestamptz | |

**`timeline_images`**
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| timeline_event_id | uuid, FK → timeline_events.id | |
| image_url | text | |
| sort_order | int | |

**`love_map_locations`** (Phase 8 feature)
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| name | text | |
| lat | float | |
| lng | float | |
| note | text | |
| image_url | text, nullable | |

**`guestbook_entries`** (Phase 8 feature)
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| author_role | text | `'admin'` or `'partner'` |
| message | text | |
| created_at | timestamptz | |

**`quiz_questions`** (Phase 8 feature)
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| question | text | |
| options | jsonb | array of choices |
| correct_index | int | |
| unlock_reward_letter_id | uuid, FK → letters.id, nullable | |

### Storage
- Bucket `letter-images` (private, served via signed URLs or RLS-controlled public read for authenticated users only)
- Bucket `timeline-images` (same access model)
- Bucket `map-images` (same access model)

### RLS Policies (critical)
- All tables: `SELECT` allowed only to authenticated users whose `profiles.role` is `admin` or `partner`
- All tables except `guestbook_entries`: `INSERT/UPDATE/DELETE` allowed **only** to `admin` role
- `letters`: partner role can only `SELECT` rows where `status = 'published' AND (unlock_date IS NULL OR unlock_date <= now())`
- `guestbook_entries`: both roles can `INSERT`; only `admin` can `DELETE`
- Storage buckets: read policy scoped to authenticated users only; write policy scoped to `admin` only

**Output:** Full schema deployed via Supabase SQL editor or migration files, with RLS verified using both test accounts.

---

## Phase 2 — Authentication (2-Account System)

**Goal:** Replace "PIN protection" with real login restricted to exactly two pre-created accounts.

- [ ] In Supabase Auth, manually create 2 users (admin email, partner email) — no public registration UI
- [ ] Insert matching rows into `profiles` with correct `role`
- [ ] Build `LoginView.vue` (Vietnamese UI: "Đăng nhập", "Email", "Mật khẩu")
- [ ] Create `authStore` (Pinia) to hold session + role
- [ ] Implement router navigation guard:
  - Not logged in → redirect to `/login`
  - Logged in as `partner` trying to access `/admin/*` → redirect to `/`
  - Logged in as `admin` → full access
- [ ] Handle session persistence (Supabase auto-refresh token) and logout button
- [ ] Add a simple "Sai tài khoản hoặc mật khẩu" error state

**Output:** Two working logins, each landing on the correct experience, no unauthenticated access possible.

---

## Phase 3 — Admin Panel: Letters Management

**Goal:** Admin can fully manage apology/love letters.

- [ ] `AdminLettersListView.vue` — table/list of letters with status badges (draft/published), tag filter
- [ ] `AdminLetterEditView.vue` — form with:
  - Title, tag dropdown, rich-text/Markdown content editor
  - Cover image upload (→ `letter-images` bucket)
  - Status toggle (draft/published)
  - Optional `unlock_date` picker ("Mở khóa vào ngày...")
- [ ] Create / update / delete actions wired to Supabase
- [ ] Confirmation modal before delete
- [ ] Sort/filter by tag and status in the list view

**Output:** Admin can write, tag, schedule, and publish letters end-to-end.

---

## Phase 4 — Admin Panel: Timeline Management

**Goal:** Admin can build the relationship timeline with multiple images per event.

- [ ] `AdminTimelineListView.vue` — list of events ordered by `sort_order`
- [ ] Drag-and-drop reordering (e.g. `vuedraggable`) updating `sort_order` in bulk
- [ ] `AdminTimelineEditView.vue` — form with:
  - Title, description, event date
  - "Đánh dấu là cột mốc đặc biệt" checkbox (`is_special`)
  - Multi-image upload with preview, reorderable, delete individual images
- [ ] Create / update / delete event (cascade delete its images + storage files)

**Output:** Admin can fully curate the visual timeline shown on the landing page.

---

## Phase 5 — Admin Panel: Settings

**Goal:** Centralized control over global landing page behavior.

- [ ] `AdminSettingsView.vue` with a single form bound to the `settings` row:
  - Relationship start date (drives the day counter)
  - Theme color picker
  - Cover image upload
  - Next special date + label (for countdown feature)
- [ ] Save updates the single settings row (upsert)

**Output:** One screen to control all global/dynamic landing page parameters.

---

## Phase 6 — Landing Page: Day Counter & Timeline Display

**Goal:** Build the core private landing page experience (Vietnamese UI copy).

- [ ] `LandingView.vue` as the root of `/`
- [ ] **Light/dark mode toggle**: a small sun/moon switch in the header of every public view, using the `themeStore` from Phase 0; must not require a page reload and must persist per-device
- [ ] **Day counter component**: computed from `settings.relationship_start_date` to now, animated count-up (days / months / years) using GSAP, label in Vietnamese e.g. "Chúng ta đã bên nhau được"; displays the relationship start date underneath (no end date, since the relationship is ongoing); shows the two partner avatars (`partner_a_avatar_url` on the left, `partner_b_avatar_url` on the right of the number) each with their name below (`partner_a_name`, `partner_b_name`)
- [ ] **Countdown component**: if `next_special_date` set, show days remaining + label
- [ ] **Timeline component**:
  - **Vertical scroll layout by default** (horizontal-scroll timelines are hard to use on phones — reserve horizontal layout for desktop/tablet only, if used at all)
  - Each entry: date, title, description, image carousel/gallery (swipeable on touch)
  - Scroll-triggered fade-in/slide-in animation (via AOS or `@vueuse/motion`), kept lightweight so it doesn't lag on mobile devices
  - Special milestones visually highlighted (larger card, accent color, icon)
  - Images sized/compressed appropriately for mobile bandwidth (avoid loading full-resolution desktop images on phone)
  - Each entry's title and image are tappable/clickable, navigating to a dedicated **timeline detail page** (`/timeline/:id`)
- [ ] **Timeline detail page** (`TimelineDetailView.vue`):
  - Shows the full date, title, special-milestone badge (if applicable), full description text, and a swipeable image gallery/carousel of all images for that event
  - Back button/gesture returns to the landing page at the same scroll position
  - On desktop/tablet widths, lay out image gallery on the left and title/date/description on the right; on mobile, stack image gallery on top and text content below (same responsive pattern as the timeline list cards)

**Output:** Fully functional, animated landing page showing counter + timeline, gated behind login, verified to work smoothly on a real phone screen.

---

## Phase 7 — Landing Page: Letters Display

**Goal:** Present published, unlocked letters as an emotional "envelope" experience.

- [ ] `LettersView.vue` — single-column grid on mobile (expanding to multi-column on wider screens), one envelope card per published+unlocked letter
- [ ] Tap-to-open animation (envelope flips/opens, built with GSAP) revealing letter content, sized to be fully readable without zooming on a phone screen
- [ ] Locked letters (future `unlock_date`) shown as sealed/greyed out with a "Sẽ mở vào ngày ..." label, or hidden entirely (decide preference)
- [ ] Filter/sort by tag, using a compact dropdown or horizontal chip-scroll on mobile rather than a wide filter bar

**Output:** Partner can browse and "open" letters in a designed reading experience.

---

## Phase 8 — Additional Features

**Goal:** Layer in the extra features that add depth beyond the core ask.

### 8a. Love Map
- [ ] `LoveMapView.vue` using a map library (e.g. Leaflet/MapLibre, free tier)
- [ ] Admin CRUD for `love_map_locations` (name, coordinates, note, optional image)
- [ ] Pins on map open a popup/card with note + image

### 8b. Guestbook
- [ ] `GuestbookView.vue` — both accounts can post short messages
- [ ] Realtime updates via Supabase Realtime subscription (messages appear live)
- [ ] Admin can delete inappropriate/duplicate entries

### 8c. Memory Quiz
- [ ] `QuizView.vue` — sequential quiz about shared memories
- [ ] Admin CRUD for questions/options/correct answer
- [ ] Correct answers can optionally unlock a bonus letter (`unlock_reward_letter_id`)

### 8d. Full Photo Gallery
- [ ] `GalleryView.vue` — aggregates all `timeline_images` (+ optionally a dedicated `gallery_images` table for photos not tied to a timeline event) into an album/lightbox view

**Explicitly excluded per requirements:** reminder notifications (email/push), memory music box/playlist.

**Output:** Feature-complete app beyond the MVP ask.

---

## Phase 9 — Polish, Testing & Deployment

**Goal:** Ship a stable, good-looking, production-ready app.

- [ ] Dedicated mobile QA pass on real devices (not just browser devtools emulation): test on at least one small phone (~360px) and one larger phone (~430px), covering landing page, timeline, letters, map, guestbook, quiz, and gallery
- [ ] Check touch target sizes (buttons, envelope taps, map pins) are comfortably tappable, and that no horizontal scroll/overflow occurs on any public view
- [ ] Loading states & empty states for all admin/public views (Vietnamese copy: "Đang tải...", "Chưa có dữ liệu")
- [ ] Error handling & toasts for all Supabase calls
- [ ] Image optimization (resize on upload or use Supabase transform)
- [ ] Manual QA pass logged in as each role separately, confirming RLS boundaries hold (partner cannot write, cannot see drafts/locked letters)
- [ ] Final content pass: ensure every user-facing string is in Vietnamese
- [ ] Set up production environment variables on hosting platform
- [ ] Deploy final build (Vercel/Netlify) + custom domain if desired
- [ ] Backup/export plan for Supabase data (in case of accidental deletion)

**Output:** Live, polished, private love-story web app accessible only to the two of you.

---

## Suggested Build Order Summary

1. Phase 0 → 1 → 2 (foundation + data + auth) — must be done in order
2. Phase 3, 4, 5 (admin features) — can be built in parallel by an AI agent working feature-by-feature
3. Phase 6 → 7 (public landing page) — depends on Phase 3/4/5 data existing
4. Phase 8 (extras) — independent add-ons, can be done anytime after Phase 2
5. Phase 9 (polish/deploy) — always last
