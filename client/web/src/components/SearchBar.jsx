export default function SearchBar({value, onChange}) {
  return (
    <div className="mb-4">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        className="border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/40"
      />
    </div>
  );
}
