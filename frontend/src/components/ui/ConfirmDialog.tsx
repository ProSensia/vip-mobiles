"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function useConfirmDialog() {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);

  const confirm = (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => setState({ ...options, resolve }));

  const dialog = (
    <Modal open={!!state} onClose={() => { state?.resolve(false); setState(null); }} title={state?.title}>
      {state && (
        <div className="space-y-5">
          {state.description && <p className="text-sm text-muted">{state.description}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { state.resolve(false); setState(null); }}>
              Cancel
            </Button>
            <Button
              variant={state.destructive ? "destructive" : "primary"}
              onClick={() => { state.resolve(true); setState(null); }}
            >
              {state.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );

  return { confirm, dialog };
}
