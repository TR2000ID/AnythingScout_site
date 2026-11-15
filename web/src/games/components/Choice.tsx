// A row of buttons where exactly one is on (a "segmented" radio group): Settings' language/titles/store
// pickers and the Sales page's "at least x% off" and sort pickers.
export function Choice<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][]; // [value, what the button says]
  onChange: (v: T) => void;
  label: string; // read out by screen readers for the whole group
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([option, name]) => (
        <button key={option} role="radio" aria-checked={value === option} className={value === option ? "is-on" : ""} onClick={() => onChange(option)}>
          {name}
        </button>
      ))}
    </div>
  );
}
