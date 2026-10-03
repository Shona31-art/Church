import Link from "next/link";

/**
 * Search + filters as a plain GET form: works without JavaScript, keeps the
 * filters in the URL (shareable, back-button friendly), and the server does
 * the filtering — nothing large is loaded into the browser.
 */
export function FilterBar({
  query,
  placeholder = "Search…",
  label = "Search",
  children,
  resetHref,
  active,
}: {
  query?: string;
  placeholder?: string;
  label?: string;
  /** Extra <select> filters. Give each a label (sr-only is fine). */
  children?: React.ReactNode;
  resetHref: string;
  /** Whether any filter is applied (shows "Clear"). */
  active: boolean;
}) {
  return (
    <form role="search" className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex-1 min-w-[12rem]">
        <label htmlFor="q" className="sr-only">
          {label}
        </label>
        <input id="q" name="q" type="search" defaultValue={query} placeholder={placeholder} maxLength={80} className="input" />
      </div>
      {children}
      <button type="submit" className="btn-secondary">
        Apply
      </button>
      {active && (
        <Link href={resetHref} className="btn-ghost">
          Clear
        </Link>
      )}
    </form>
  );
}

/** A labelled <select> sized for the filter bar. */
export function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="sr-only">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={value ?? ""} className="input w-auto">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
