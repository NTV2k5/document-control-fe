# Document Manager FE Agent Guide

This file defines the working conventions for AI agents editing `document-manager`.

Use these rules as defaults unless the user explicitly asks for a different structure.

## Core Agent Principles

These principles are high priority. Apply them before local style preferences.

### 1. Think Before Coding

- Understand the request before editing.
- State or infer the goal clearly.
- Prefer a short concrete plan for non-trivial changes.
- If the requested direction is weak, push toward a cleaner and more defensible solution.
- Do not blindly patch symptoms if there is an obvious structural root cause.

### 2. Simplicity First

- Prefer the simplest solution that fully solves the problem.
- Do not add abstractions, wrappers, or helpers unless they reduce real complexity.
- Avoid speculative architecture.
- If a change can be done locally and clearly, keep it local.

### 3. Surgical Changes

- Touch only the code required for the requested outcome.
- Do not mix unrelated cleanup into the same change unless the broken structure blocks the task.
- Preserve existing behavior unless the task explicitly requires behavior change.
- When refactoring, remove dead code created by the refactor instead of leaving zombie modules behind.

### 4. Goal-Driven Verification

- Define what “done” means for the current task.
- Run the smallest useful verification first, then broader checks if needed.
- Prefer real verification over assumptions:
  - `eslint`
  - `tsc --noEmit`
  - targeted runtime boot
  - focused manual path verification
- Do not claim a fix is complete if the relevant verification still fails.

## Scope

- Applies to the FE app in `document-manager`.
- Prefer changing FE code to match this guide instead of introducing one-off patterns.

## Working Style

- Keep responses short, direct, and action-focused.
- Do the work instead of stopping at analysis when the requested direction is clear.
- Prefer concrete edits over long proposals.
- When refactoring, preserve behavior first and improve structure second.
- Prefer strong opinions with clear technical reasoning over passive agreement.

## Project Structure

- `src/routes`: route declarations only. Keep route files thin.
- `src/pages`: page-level UI and page wrappers.
- `src/sections`: screen-sized business UI sections.
- `src/components`: reusable UI/business components.
- `src/api`: app/domain API modules.
- `src/lib`: app-level helpers, editor logic, template logic, utilities specific to this app.
- `src/models`: shared app models.
- `src/stores`: state/store modules.
- `reactjs-platform/ui`: shared platform UI.
- `reactjs-platform/utilities`: shared platform utilities.

## Route and Page Rules

- Route files should mainly contain `createFileRoute(...)`.
- Real page UI should live in `src/pages`.
- Prefer this split:
  - route file: route wrapper only
  - page file: actual page component
- Example:
  - `src/routes/home.tsx`
  - `src/pages/home/home.page.tsx`

## Folder and File Naming

- Use lowercase kebab-case for folders and filenames.
- Do not use camelCase filenames.
- Do not create mixed naming styles in the same module.

Use these suffixes:

- `*.page.tsx`: page component
- `*.section.tsx`: section component
- `*.component.tsx`: reusable component
- `*.store.ts`: store implementation
- `*.type.ts`: types/interfaces for the module
- `*.api.ts`: API call module
- `index.ts`: barrel exports only

Examples:

- `src/pages/sign-in/sign-in.page.tsx`
- `src/sections/change-password/change-password.section.tsx`
- `src/components/template/template-name-modal/template-name-modal.component.tsx`
- `src/stores/transaction-store/transaction-store.store.ts`
- `src/api/partner/get-banks/get-banks.api.ts`

## Module Shape

For page/section/component/api/store modules, prefer this structure:

```txt
folder-name/
  folder-name.page.tsx | folder-name.section.tsx | folder-name.component.tsx | folder-name.api.ts | folder-name.store.ts
  folder-name.type.ts
  index.ts
```

If a module has no extracted types yet, it may temporarily omit `*.type.ts`, but new props/interfaces should go there.

## Export Rules

- Do not use `export default` for pages or sections.
- Prefer named exports everywhere.
- Prefer:
  - `export const HomePage = ...`
  - `export const TemplatesSection = ...`
- Barrel files should explicitly export module files.
- Do not write broken barrels like `export * from '.'`.

Good:

```ts
export * from './home.page';
export * from './home.type';
```

Bad:

```ts
export * from '.';
```

## Import Rules

- Inside `src`, prefer normal relative imports.
- Do not introduce `@/...` imports.
- Use platform aliases only for platform layers:
  - `reactjs-platform/ui`
  - `reactjs-platform/utilities`
- Use `api` alias for `src/api`.

Prefer:

```ts
import { HomeSection } from '../../sections';
import { Button } from 'reactjs-platform/ui';
import { getTemplateByIdAPI } from 'api';
```

Avoid:

```ts
import { HomeSection } from '@/sections';
```

### Import Compression

- Prefer barrel imports when a stable barrel already exists.
- Prefer:

```ts
import { Button, Input, Toast } from 'reactjs-platform/ui';
import { profileStore, hasPermission } from 'reactjs-platform/utilities';
import { TemplateNameModal, PreviewModal } from '../../components/template';
```

- Avoid unnecessarily deep imports when the barrel already exports the symbol.

## Type Naming

Use these naming prefixes consistently:

- `I`: interfaces
- `T`: type aliases
- `E`: enums

Examples:

- `IPagination`
- `ISignInSectionProps`
- `TPartner`
- `TVariableKey`
- `EDocumentStatus`

## Props and Type Placement

- Move page/section/component props into the module `*.type.ts` file.
- Do not keep large props interfaces inline unless there is a strong local reason.
- Prefer names based on the module/folder name.

Examples:

- `sign-in.type.ts` -> `ISignInSectionProps`
- `home.type.ts` -> `IHomeSectionProps`
- `document-editor.type.ts` -> `IDocumentEditorPageProps`

## Component Declaration Style

- Prefer arrow functions assigned to `const`.
- Avoid `function Foo()` unless there is a specific reason.

Prefer:

```ts
export const HomePage = () => { ... };
const normalizeTemplateVariables = (...) => { ... };
```

Avoid:

```ts
export default function HomePage() { ... }
function normalizeTemplateVariables(...) { ... }
```

## Formatting and Tooling

- Keep formatting consistent with Prettier/Biome/ESLint setup already in the repo.
- Use the project runtime wrapper for node-based commands.

Common commands:

```sh
./scripts/with-project-node.sh prettier --write <paths>
./scripts/with-project-node.sh eslint . --fix
./scripts/with-project-node.sh tsc --noEmit
./scripts/with-project-node.sh vite dev --port 5002
```

Or use package scripts:

```sh
yarn dev
yarn build
yarn lint:eslint
yarn typecheck
```

## Refactor Priorities

When cleaning code, prefer this order:

1. Keep behavior working
2. Fix imports/exports
3. Normalize naming
4. Move types to `*.type.ts`
5. Thin route files into page wrappers
6. Compress imports through barrels where appropriate

## Avoid

- `export default` for pages/sections
- `@/...` imports
- camelCase filenames like `transactionStore.ts`
- deep imports when a stable barrel exists
- route files holding large page logic
- broken or recursive barrel exports
- mixing unrelated concerns into `reactjs-platform/utilities`

## Current Direction

The preferred FE architecture is:

- route = route declaration
- page = page shell / page UI
- section = business screen section
- component = reusable piece
- type file = extracted interfaces/types
- barrel = clean import surface

If you add a new module, follow this structure by default.
