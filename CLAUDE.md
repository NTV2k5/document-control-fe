# CLAUDE.md - Project Context, Guidelines & History

This file documents the key guidelines, strict rules, styling tokens, implementation details, and history of adjustments made in the GDU Document Control Front-End React application.

---

## 🛠️ Commands & Verification
Always run verification tools before finalizing any modifications:
- **Prettier formatting**: `./scripts/with-project-node.sh prettier --write <paths>`
- **ESLint linting**: `./scripts/with-project-node.sh eslint . --fix` or `yarn lint:eslint`
- **TypeScript verification**: `yarn typecheck` (runs `tsc --noEmit` through the project wrapper)
- **Local dev server**: `yarn dev` or `./scripts/with-project-node.sh vite dev --port 5002`

---

## 🏗️ Folder Structure & Naming Conventions
Follow the conventions in [AGENTS.md](./AGENTS.md) strictly:
- Use lowercase kebab-case for folder names and filenames (no camelCase filenames).
- Suffix rules:
  - `*.page.tsx`: Page components (wrapper shells in `src/pages`)
  - `*.section.tsx`: Large business screen sections (lives in `src/sections`)
  - `*.component.tsx`: Reusable UI elements (lives in `src/components`)
  - `*.store.ts`: Zustand stores (lives in `src/stores`)
  - `*.api.ts`: API integrations (lives in `src/api`)
  - `*.type.ts`: Type definitions specific to the module
- Barrel exports (`index.ts`) must only export named files: `export * from './file.page';` (avoid recursive `export * from '.'`).
- Named exports only; **DO NOT use default exports** for pages or sections.
- Relative imports should be compressed via stable barrels where available. Avoid `@/...` imports inside `src`.

---

## 🎨 Figma-Mandated Design System & Tokens
All pages must follow this visual identity to match Figma designs 100%:

### 1. Color Palette & Effects
- **Primary Accent Blue**: `bg-blue-600` (`#2563eb`), hover state `hover:bg-blue-700`.
- **Glow Shadow Effect**: Custom shadows for active states or highlighted components, e.g., `shadow-[0_8px_16px_rgba(37,99,235,0.25)]`.
- **Light Accents (Colored Cards top area)**:
  - Word: `bg-blue-50` with icon `text-blue-600`
  - Excel: `bg-emerald-50` with icon `text-emerald-600`
  - PDF: `bg-red-50` with icon `text-red-500`
  - Image: `bg-green-50` with icon `text-green-600`
  - Video: `bg-purple-50` with icon `text-purple-600`

### 2. Page & Layout Spacing
- **Main Container Spacing**: Content inside `MainLayout` must have lateral spacing and not touch the screen edges. Main padding container: `mx-auto max-w-screen-2xl px-6 py-6`.
- **Chatbot AI Button**: A floating AI assistant button must be present in the bottom-right corner of all pages (`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/30`).

---

## 📐 Component Guidelines & Implementations

### 1. Sidebar (`src/components/layout/sidebar`)
- **Logo Area**:
  - Icon: Circular background containing `Landmark` icon with shadow glow (`bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)]`).
  - Text: `"Document Control"` on **one single line** (`whitespace-nowrap`, `text-[14px] font-bold`) and a small `"ADMIN"` sub-badge (`text-[9px] font-bold text-blue-600 uppercase`).
  - Width: Expanded is `w-64` (256px), collapsed is `w-[72px]`.
- **Navigation Items (`SidebarItem`)**:
  - Typography: Size reduced to `text-[12.5px]` to prevent wrapping or truncation for `"Published Documents"`.
  - Spacing: Compact layout (`gap-3 px-3 py-2.5 rounded-full`).
  - Active State: Curved background with primary blue and glow shadow (`bg-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.25)]`).

### 2. Header (`src/components/layout/header`)
- **Search Bar**: Expanded using `flex-1 max-w-none` to match the exact width of the trending tag list below.
- **Hashtag Row**: Positioned directly beneath the search bar, styled with `#` prefixes. Must be fixed so it does not scroll with page content.

### 3. Overview Banner (`src/sections/home/overview-banner`)
- **Glassmorphic Card**: Semi-transparent information panel (`border border-white/15 bg-white/10 p-6 backdrop-blur-md`).
- **Card Sizing**: Max-width set to `md:max-w-[480px]` to completely encapsulate text content without right-edge overflow.
- **Text wrap**: `"GDU Portal"` is placed on line 1, and `"Document Control"` is on line 2 (using `whitespace-nowrap` on its span to ensure they stay together).

### 4. Recently Interacted (`src/sections/home/recently-interacted`)
- **Card Sizing**: Narrower width for a compact grid row (`w-[250px] min-w-[190px]`).
- **File Badge**: Sits at the top-left of the colored card area. Must have **black text** (`text-slate-800`) on a white background.
- **Card Icon**: Housed in a white square shadow container inside the colored top area, positioned below the file badge.
- **Avatar Stack**: Located in the bottom-right footer of the card body (`flex -space-x-1.5`).

---

## 📈 Recent UI Adjustments & History
The following adjustments were successfully made to align the codebase 100% with the Figma mockup:
1. **Sidebar Logo Alignment**: Changed Shield logo to Landmark logo, circular container, shadow blur, and forced title on a single line.
2. **Sidebar Text Fitting**: Decreased sidebar item padding, gap, and font size (`text-[12.5px]`) so "Published Documents" displays fully.
3. **Banner Glassmorphic Overflow Fix**: Expanded glass container width to `480px` and applied selective `whitespace-nowrap` on `"Document Control"` only to prevent cyan text overflowing the border.
4. **AI Assistant Button**: Added floating square-shaped `ChatbotButton` with moderately rounded corners to `MainLayout`.
5. **Overview Heading Sizes**: Standardized page titles. Overview title and Published Documents title are both set to exactly `text-3xl font-bold text-slate-900` for consistent header scaling.
6. **Recently Interacted Redesign**: Resized card dimensions to be narrower. Positioned colored file icons inside the top colored card area below the black-text file badge. Changed file badges from colored text to black/slate-800 text.
