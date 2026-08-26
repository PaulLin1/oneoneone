"use client";

import type { ReactNode } from "react";

/**
 * A plain <button type="submit"> that gates the form's own server action
 * behind window.confirm() — cancelling just preventDefault()s, the form
 * never submits. Used for Promote/Reject on /admin/review/[id], where a
 * misclick has real consequences (a work goes live, or a candidate is
 * marked rejected).
 */
export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: {
  confirmMessage: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
