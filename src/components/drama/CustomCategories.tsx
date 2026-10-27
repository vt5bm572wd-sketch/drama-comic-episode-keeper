export function CategoryPicker({
  value: _value,
  onChange: _onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return <span className="nina-custom-category-marker hidden" aria-hidden />;
}

export function CategoryManager() {
  return null;
}
