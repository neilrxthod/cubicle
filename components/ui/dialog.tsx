'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Corner X close control.
 * Soft grey circle fades + scales in on hover (icon stays put).
 */
export const dialogCloseButtonClassName = cn(
  'relative inline-flex size-8 shrink-0 items-center justify-center rounded-full',
  'text-neutral-400 outline-none',
  // Circle wash: invisible at rest, eases in on hover / focus.
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:content-['']",
  'before:bg-neutral-500/[0.08] before:opacity-0 before:scale-90',
  'before:transition-[opacity,transform] before:duration-150 before:ease-[cubic-bezier(0.16,1,0.3,1)]',
  'hover:before:opacity-100 hover:before:scale-100',
  'active:before:scale-95 active:before:bg-neutral-500/[0.12]',
  'hover:text-neutral-700 active:text-neutral-900',
  'focus-visible:before:opacity-100 focus-visible:before:scale-100',
  'focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:pointer-events-none disabled:opacity-40',
  '[&_svg]:relative [&_svg]:z-[1] [&_svg]:pointer-events-none [&_svg]:size-[15px] [&_svg]:shrink-0',
)

/**
 * Secondary dismiss action (“Cancel”, “Keep booking”, …).
 * Soft pill wash (not a circle) — text darkens as the chip appears.
 */
export const dialogCancelButtonClassName = cn(
  'relative inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3.5',
  'text-[13px] font-medium tracking-[-0.01em] text-neutral-400 outline-none',
  // Pill wash: fades + gently expands on the horizontal axis.
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:content-['']",
  'before:bg-neutral-500/[0.07] before:opacity-0 before:scale-x-[0.92] before:scale-y-90',
  'before:transition-[opacity,transform] before:duration-150 before:ease-[cubic-bezier(0.16,1,0.3,1)]',
  'hover:before:opacity-100 hover:before:scale-x-100 hover:before:scale-y-100',
  'active:before:scale-[0.97] active:before:bg-neutral-500/[0.11]',
  'hover:text-neutral-800 active:text-neutral-950',
  'focus-visible:before:opacity-100 focus-visible:before:scale-100',
  'focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:pointer-events-none disabled:opacity-40',
)

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={cn(dialogCloseButtonClassName, className)}
      {...props}
    />
  )
}

/** Text dismiss control for dialog footers (Cancel / Keep / etc.). */
function DialogCancel({
  className,
  type = 'button',
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type={type}
      data-slot="dialog-cancel"
      className={cn(dialogCancelButtonClassName, className)}
      {...props}
    />
  )
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/40',
        // Overlay may fade; panel content does not move.
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
        'duration-100 ease-out',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      {/*
        Flex shell centers the panel without transform or m-auto.
        That avoids the “text drifts into place” reflow when height is measured.
      */}
      <div
        data-slot="dialog-center"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <DialogPrimitive.Content
          data-slot="dialog-content"
          aria-describedby={undefined}
          className={cn(
            'pointer-events-auto relative grid w-full max-h-[min(90dvh,100%)] gap-4 overflow-y-auto overscroll-contain rounded-lg border bg-background p-6 shadow-lg sm:max-w-lg',
            // No enter/exit motion on the panel — text stays put.
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className={cn(
                dialogCloseButtonClassName,
                'absolute top-3.5 right-3.5',
              )}
            >
              <XIcon strokeWidth={1.75} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        // Matches app StatBar / page titles: light weight, tight tracking
        'text-[1.375rem] font-extralight leading-tight tracking-[-0.03em] text-foreground sm:text-[1.5rem]',
        className,
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('type-body', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogCancel,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
