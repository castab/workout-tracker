export function PencilIcon() {
  return <span aria-hidden="true" className="text-base leading-none">✎</span>;
}

export function TrashIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 20 20">
      <path d="M3.5 5.5h13" />
      <path d="M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" />
      <path d="M5.5 5.5 6.2 16a1.5 1.5 0 0 0 1.5 1.4h4.6A1.5 1.5 0 0 0 13.8 16l.7-10.5" />
      <path d="M8.5 8.5v5" />
      <path d="M11.5 8.5v5" />
    </svg>
  );
}
