import { useRef, useState } from 'react';

export default function NumberInput({ value, onChange, onFocus, onBlur, onWheel, ...props }) {
  const [draft, setDraft] = useState(null);
  const zeroValue = useRef(false);

  const handleFocus = (event) => {
    zeroValue.current = value !== '' && value !== null && Number(value) === 0;
    if (zeroValue.current) setDraft('');
    onFocus?.(event);
  };

  const handleChange = (event) => {
    if (zeroValue.current) setDraft(event.target.value);
    onChange(event);
  };

  const handleBlur = (event) => {
    zeroValue.current = false;
    setDraft(null);
    onBlur?.(event);
  };

  const handleWheel = (event) => {
    event.preventDefault();
    event.currentTarget.blur();
    onWheel?.(event);
  };

  return (
    <input
      {...props}
      type="number"
      value={draft ?? value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onWheel={handleWheel}
    />
  );
}
