import { useState, useEffect } from 'react';

// Returns `value`, but only updates after `delay` ms have passed without
// `value` changing again. Used to avoid firing a search request on every
// keystroke.
export default function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
