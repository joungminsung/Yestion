# Visual Polish & Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add polished, consistent animations and motion throughout the app -- page transitions, sidebar, modals, toasts, dark mode, hover states -- while respecting prefers-reduced-motion.
**Architecture:** Framer Motion provides declarative animation primitives. Shared variants are defined in a central file and consumed by components. CSS transitions handle simple cases (dark mode, hover). All motion respects `prefers-reduced-motion: reduce` via a global flag and CSS media query.
**Tech Stack:** framer-motion, React 18, Tailwind CSS, CSS custom properties

---

### Task 1: Install framer-motion and Create Shared Variants

**Files:**
- Create: `src/lib/motion/variants.ts`
- Create: `src/lib/motion/motion-config.tsx`

- [ ] **Step 1: Install framer-motion**
```bash
pnpm add framer-motion
```

- [ ] **Step 2: Create shared animation variants**
```ts
// src/lib/motion/variants.ts
import type { Variants, Transition } from "framer-motion";

export const spring: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.8,
};

export const springGentle: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.15 } },
};

export const slideDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export const slideRight: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.15 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: spring },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } },
};

export const heightAuto: Variants = {
  hidden: { opacity: 0, height: 0, overflow: "hidden" },
  visible: {
    opacity: 1,
    height: "auto",
    overflow: "visible",
    transition: { duration: 0.25, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    height: 0,
    overflow: "hidden",
    transition: { duration: 0.2 },
  },
};

export const popoverVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -4,
    transition: { duration: 0.1 },
  },
};

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    transition: { duration: 0.15 },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.15 },
  }),
};
```

- [ ] **Step 3: Create MotionConfig provider with reduced-motion support**
```tsx
// src/lib/motion/motion-config.tsx
"use client";

import { MotionConfig, LazyMotion, domAnimation } from "framer-motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { ReactNode } from "react";

export function AppMotionConfig({ children }: { children: ReactNode }) {
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion={prefersReduced ? "always" : "never"}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
```

- [ ] **Step 4: Commit**
```
git add src/lib/motion/variants.ts src/lib/motion/motion-config.tsx package.json pnpm-lock.yaml
git commit -m "feat: install framer-motion, create shared animation variants and config"
```

---

### Task 2: Page Transitions

**Files:**
- Modify: `src/app/(main)/layout.tsx`
- Create: `src/components/layout/page-transition.tsx`

- [ ] **Step 1: Create page transition wrapper**
```tsx
// src/components/layout/page-transition.tsx
"use client";

import { AnimatePresence, m } from "framer-motion";
import { usePathname } from "next/navigation";
import { fadeIn } from "@/lib/motion/variants";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={pathname}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="flex-1 overflow-y-auto"
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Integrate page transition in main layout**

In `src/app/(main)/layout.tsx`, replace the content wrapper:
```tsx
// Add imports:
import { PageTransition } from "@/components/layout/page-transition";
import { AppMotionConfig } from "@/lib/motion/motion-config";

// Replace:
//   <div className="flex-1 overflow-y-auto">{children}</div>
// With:
<AppMotionConfig>
  <PageTransition>{children}</PageTransition>
</AppMotionConfig>
```

- [ ] **Step 3: Commit**
```
git add src/components/layout/page-transition.tsx src/app/(main)/layout.tsx
git commit -m "feat: page transitions with AnimatePresence and fadeIn"
```

---

### Task 3: Sidebar Animation

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Replace CSS transition with framer-motion for sidebar width**

In `src/components/layout/sidebar.tsx`:
```tsx
// Add import at top:
import { m } from "framer-motion";

// Replace the <aside> element with <m.aside>:
<m.aside
  className={cn(
    "flex flex-col h-full overflow-hidden border-r shrink-0",
    isMobile && "fixed top-0 left-0 z-[40] h-full",
  )}
  animate={{
    width: isMobile
      ? (isOpen ? 320 : 0)
      : (isOpen || isHoverExpanded ? width : 0),
    x: isMobile ? (isOpen ? 0 : -320) : 0,
  }}
  transition={{
    type: "spring",
    stiffness: 400,
    damping: 32,
    mass: 0.8,
  }}
  style={{
    backgroundColor: "var(--bg-sidebar)",
    borderColor: "var(--border-default)",
  }}
  onMouseLeave={handleSidebarMouseLeave}
  onMouseEnter={handleSidebarMouseEnter}
>
  {/* ... existing sidebar content ... */}
</m.aside>
```

- [ ] **Step 2: Commit**
```
git add src/components/layout/sidebar.tsx
git commit -m "feat: sidebar spring animation with framer-motion"
```

---

### Task 4: Modal/Dialog Animations

**Files:**
- Create: `src/components/ui/animated-dialog.tsx`
- Modify: `src/components/share/share-dialog.tsx`
- Modify: `src/components/layout/command-palette.tsx`

- [ ] **Step 1: Create animated dialog wrapper**
```tsx
// src/components/ui/animated-dialog.tsx
"use client";

import { m, AnimatePresence } from "framer-motion";
import { modalOverlay, modalContent } from "@/lib/motion/variants";
import type { ReactNode } from "react";

type AnimatedDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Width class, default "max-w-lg" */
  maxWidth?: string;
};

export function AnimatedDialog({
  isOpen,
  onClose,
  children,
  className = "",
  maxWidth = "max-w-lg",
}: AnimatedDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0" style={{ zIndex: "var(--z-modal)" }}>
          {/* Backdrop */}
          <m.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          {/* Content */}
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <m.div
              variants={modalContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={`w-full ${maxWidth} rounded-xl border shadow-2xl pointer-events-auto ${className}`}
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-default)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </m.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Apply AnimatedDialog to share-dialog.tsx**

In `src/components/share/share-dialog.tsx`, wrap the dialog content with `AnimatedDialog`:
```tsx
// Add import:
import { AnimatedDialog } from "@/components/ui/animated-dialog";

// Replace the outer fixed div + backdrop with:
<AnimatedDialog isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
  {/* existing dialog inner content */}
</AnimatedDialog>
```

- [ ] **Step 3: Apply AnimatedDialog to command-palette.tsx**

In `src/components/layout/command-palette.tsx`:
```tsx
// Add import:
import { AnimatedDialog } from "@/components/ui/animated-dialog";

// Wrap with AnimatedDialog instead of raw fixed overlay
<AnimatedDialog isOpen={isOpen} onClose={close} maxWidth="max-w-xl">
  {/* existing palette content */}
</AnimatedDialog>
```

- [ ] **Step 4: Commit**
```
git add src/components/ui/animated-dialog.tsx src/components/share/share-dialog.tsx src/components/layout/command-palette.tsx
git commit -m "feat: animated dialog wrapper with spring transitions for modals"
```

---

### Task 5: Dropdown/Popover Animations

**Files:**
- Create: `src/components/ui/animated-popover.tsx`

- [ ] **Step 1: Create animated popover wrapper**
```tsx
// src/components/ui/animated-popover.tsx
"use client";

import { m, AnimatePresence } from "framer-motion";
import { popoverVariants } from "@/lib/motion/variants";
import { useEffect, useRef, type ReactNode } from "react";

type AnimatedPopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Anchor position */
  style?: React.CSSProperties;
};

export function AnimatedPopover({
  isOpen,
  onClose,
  children,
  className = "",
  style,
}: AnimatedPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          ref={ref}
          variants={popoverVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`rounded-lg border shadow-lg ${className}`}
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-default)",
            zIndex: "var(--z-dropdown)",
            ...style,
          }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Commit**
```
git add src/components/ui/animated-popover.tsx
git commit -m "feat: animated popover component with scale+fade transition"
```

---

### Task 6: Toast Animations

**Files:**
- Modify: `src/components/ui/toast-container.tsx`

- [ ] **Step 1: Add framer-motion animations to toast container**

Replace `src/components/ui/toast-container.tsx`:
```tsx
// src/components/ui/toast-container.tsx
"use client";

import { AnimatePresence, m } from "framer-motion";
import { useToastStore } from "@/stores/toast";
import { Toast } from "./toast";
import { slideUp } from "@/lib/motion/variants";

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col-reverse gap-2"
      style={{ zIndex: "var(--z-toast)" }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.slice(0, 3).map((toast) => (
          <m.div
            key={toast.id}
            variants={slideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
          >
            <Toast toast={toast} />
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```
git add src/components/ui/toast-container.tsx
git commit -m "feat: animated toast enter/exit with slideUp variants"
```

---

### Task 7: Block Insert/Delete Animations

**Files:**
- Modify: `src/components/editor/utils/editor-styles.css`

- [ ] **Step 1: Add block animation CSS**

Append to `src/components/editor/utils/editor-styles.css`:
```css
/* Block Insert/Delete Animations */
.ProseMirror > * {
  animation: blockInsert 0.2s ease-out;
}

@keyframes blockInsert {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Smooth height changes for toggled content */
.notion-toggle-content,
.synced-block-content {
  transition: max-height 0.25s ease, opacity 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .ProseMirror > * {
    animation: none;
  }

  .notion-toggle-content,
  .synced-block-content {
    transition: none;
  }
}
```

- [ ] **Step 2: Commit**
```
git add src/components/editor/utils/editor-styles.css
git commit -m "feat: block insert animation via CSS keyframes"
```

---

### Task 8: Dark Mode Smooth Transition

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add CSS transition for dark mode switching**

Append to `src/app/globals.css`:
```css
/* Smooth dark mode transition */
html[data-transitioning] *,
html[data-transitioning] *::before,
html[data-transitioning] *::after {
  transition:
    background-color 0.3s ease,
    color 0.2s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease !important;
}

/* Exclude elements that should not transition */
html[data-transitioning] .ProseMirror,
html[data-transitioning] video,
html[data-transitioning] img,
html[data-transitioning] canvas {
  transition: none !important;
}

@media (prefers-reduced-motion: reduce) {
  html[data-transitioning] *,
  html[data-transitioning] *::before,
  html[data-transitioning] *::after {
    transition: none !important;
  }
}
```

- [ ] **Step 2: Commit**
```
git add src/app/globals.css
git commit -m "feat: smooth dark mode transition with data-transitioning attribute"
```

---

### Task 9: Hover/Focus Consistency

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add default transition utility to tailwind config**

In `tailwind.config.ts`, add to `theme.extend`:
```ts
transitionDuration: {
  DEFAULT: "150ms",
},
transitionTimingFunction: {
  DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
},
```

- [ ] **Step 2: Add global focus ring styles to globals.css**

Append to `src/app/globals.css`:
```css
/* Global focus ring style */
:focus-visible {
  outline: 2px solid #2383e2;
  outline-offset: 2px;
  border-radius: 2px;
}

/* Remove default focus for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}

/* Consistent button/interactive hover */
button:not([disabled]),
[role="button"]:not([disabled]) {
  transition: background-color 150ms ease, color 150ms ease, opacity 150ms ease;
}
```

- [ ] **Step 3: Commit**
```
git add tailwind.config.ts src/app/globals.css
git commit -m "feat: consistent focus ring and hover transition defaults"
```

---

### Task 10: Loading Skeleton Pulse

**Files:**
- Modify: `src/components/ui/skeleton.tsx`

- [ ] **Step 1: Update skeleton with consistent pulse animation**

Replace `src/components/ui/skeleton.tsx` Skeleton component:
```tsx
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded", className)}
      style={{
        backgroundColor: "var(--bg-tertiary, #e8e7e4)",
        animation: "skeletonPulse 1.5s ease-in-out infinite",
      }}
      {...props}
    />
  );
}
```

Add a `<style>` tag or append to globals.css:
```css
/* Skeleton pulse */
@keyframes skeletonPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes skeletonPulse {
    0%, 100% { opacity: 0.7; }
  }
}
```

- [ ] **Step 2: Commit**
```
git add src/components/ui/skeleton.tsx src/app/globals.css
git commit -m "feat: consistent skeleton pulse animation with reduced-motion support"
```

---

### Task 11: prefers-reduced-motion Global Support

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/lib/motion/motion-config.tsx`

- [ ] **Step 1: Add global reduced-motion CSS reset**

Append to `src/app/globals.css`:
```css
/* Global reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This works in concert with framer-motion's `reducedMotion="always"` set in `motion-config.tsx` (already created in Task 1 Step 3), which disables all framer animations when the preference is active.

- [ ] **Step 2: Commit**
```
git add src/app/globals.css
git commit -m "feat: global prefers-reduced-motion CSS reset"
```
