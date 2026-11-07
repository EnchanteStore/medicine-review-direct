'use client';

import * as React from 'react';

export function ErrorSummary({
  errors,
  title = 'There is a problem',
}: {
  errors: { field: string; message: string }[];
  title?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (errors.length > 0) ref.current?.focus();
  }, [errors]);
  if (errors.length === 0) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="rounded-md border-4 border-danger-700 bg-white p-5"
    >
      <h2 id="error-summary-title" className="text-lg font-bold">
        {title}
      </h2>
      <ul className="mt-2 list-none space-y-1">
        {errors.map((e) => (
          <li key={`${e.field}-${e.message}`}>
            <a href={`#${e.field}`} className="font-semibold text-danger-700 underline">
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
