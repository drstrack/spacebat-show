import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shared "Are you sure?" dialog.
 * Cancel, Escape, and a click on the backdrop call `onOpenChange(false)` and
 * do not call `onConfirm`. Only the confirm button does.
 */
export function ConfirmDialog({
  open,
  description,
  confirmLabel,
  pending = false,
  pendingLabel = "Working",
  error = "",
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  pendingLabel?: string;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-ink/40"
          data-testid="confirm-dialog-overlay"
        />
        <Dialog.Content
          role="alertdialog"
          data-testid="confirm-dialog"
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border-4 border-ink bg-ivory p-4 shadow-[6px_6px_0_0_var(--color-ink)] sm:p-5"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
        >
          <Dialog.Title className="font-display text-3xl tracking-wide">Are you sure?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted">{description}</Dialog.Description>
          {error ? (
            <p className="mt-3 text-sm text-crimson" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button
                ref={cancelRef}
                type="button"
                variant="ghost"
                size="md"
                className="w-full sm:w-auto"
                disabled={pending}
                data-testid="confirm-dialog-cancel"
              >
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
              disabled={pending}
              data-testid="confirm-dialog-confirm"
              onClick={onConfirm}
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
