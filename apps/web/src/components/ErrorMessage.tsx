export function ErrorMessage({ message }: { message: string }) {
  return <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">⚠️ {message}</div>;
}
