"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "../../lib/islamic/actions";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(
    async (_previous: ActionResult | null, formData: FormData) => action(formData),
    null,
  );
  return (
    <form action={formAction} className={className}>
      {children}
      {state ? <p className="staff-msg" role="status">{state.message}</p> : null}
    </form>
  );
}
