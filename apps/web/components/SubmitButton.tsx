'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        'inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60'
      }
    >
      {pending ? 'Working…' : children}
    </button>
  );
}
