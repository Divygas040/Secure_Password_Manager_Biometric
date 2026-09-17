export default function FieldFeedback({ id, error, help }: { id: string; error?: string; help?: string }) {
  return <div id={id} aria-live="polite" className="mt-1 text-xs">
    {help && <p className="text-gray-400">{help}</p>}
    {error && <p className="text-red-400">{error}</p>}
  </div>;
}
