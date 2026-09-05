"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const DialogStateContext = React.createContext(false)

function Dialog({
  children,
  defaultOpen,
  onOpenChange,
  open,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false)
  const isOpen = open ?? uncontrolledOpen

  function handleOpenChange(nextOpen: boolean) {
    if (open === undefined) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <DialogStateContext.Provider value={isOpen}>
      <DialogPrimitive.Root
        data-slot="dialog"
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        open={open}
        {...props}
      >
        {children}
      </DialogPrimitive.Root>
    </DialogStateContext.Provider>
  )
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
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  unstyled = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & {
  unstyled?: boolean
}) {
  const isOpen = React.useContext(DialogStateContext)

  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      data-dialog-state={isOpen ? "open" : "closed"}
      className={cn(
        !unstyled &&
          "fixed inset-0 z-[1050] bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  overlayUnstyled = false,
  unstyled = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  overlayClassName?: string
  overlayUnstyled?: boolean
  unstyled?: boolean
}) {
  const isOpen = React.useContext(DialogStateContext)

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay className={overlayClassName} unstyled={overlayUnstyled} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-dialog-state={isOpen ? "open" : "closed"}
        className={cn(
          !unstyled &&
            "fixed top-[50%] left-[50%] z-[1055] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  unstyled = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title> & {
  unstyled?: boolean
}) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "ui-title",
        !unstyled && "text-lg leading-none font-semibold",
        className
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
      className={cn("ui-description text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
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
