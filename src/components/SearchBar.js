// ✅ src/components/SearchBar.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import './SearchBar.css';

const DEBOUNCE_MS = 180;

export default function SearchBar({
  placeholder = 'Search hotels, shortlets, restaurants…',
  defaultValue = '',
  className = '',
  inputClassName = '',
  autoFocus = false
}) {
  const navigate = useNavigate();

  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(-1);

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const lastReqId = useRef(0);
  const cacheRef = useRef(new Map()); // q -> suggestions

  const trimmed = useMemo(() => q.trim(), [q]);
  const activeId = active >= 0 && active < items.length ? `hp-opt-${active}` : undefined;

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick, true);
    return () => document.removeEventListener('mousedown', onDocClick, true);
  }, []);

  // Debounced suggestions
  useEffect(() => {
    if (trimmed.length < 2) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    if (cacheRef.current.has(trimmed)) {
      setItems(cacheRef.current.get(trimmed));
      setOpen(true);
      return;
    }

    const id = ++lastReqId.current;
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`);
        if (lastReqId.current !== id) return; // stale
        const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
        cacheRef.current.set(trimmed, suggestions);
        setItems(suggestions);
        setOpen(true);
      } catch {
        /* ignore network errors in suggest */
      } finally {
        if (lastReqId.current === id) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [trimmed]);

  const submit = (value) => {
    const v = (value ?? q).trim();
    if (!v) return;
    setOpen(false);
    navigate(`/search?city=${encodeURIComponent(v)}`);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((p) => Math.min(p + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((p) => Math.max(p - 1, -1));
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && active < items.length) {
        submit(items[active]);
      } else {
        submit();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`hp-searchbar ${className}`}>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="hp-searchbar-form"
      >
        <input
          ref={inputRef}
          type="search"
          className={`hp-search-input ${inputClassName}`}
          placeholder={placeholder}
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(-1); }}
          onFocus={() => { if (items.length) setOpen(true); }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          // A11y combobox props ↓
          role="combobox"
          aria-expanded={open}
          aria-controls="hp-search-listbox"
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
        />
        <button type="submit" className="hp-search-btn" aria-label="Search">Search</button>
      </form>

      {open && (
        <ul
          id="hp-search-listbox"
          className="hp-suggest"
          role="listbox"
          aria-label="Search suggestions"
        >
          {loading && !items.length ? (
            <li className="hp-suggest-item is-muted" aria-disabled="true">Searching…</li>
          ) : (
            <>
              {items.slice(0, 12).map((s, i) => (
                <li
                  id={`hp-opt-${i}`}
                  key={`${s}-${i}`}
                  role="option"
                  aria-selected={active === i}
                  className={`hp-suggest-item ${active === i ? 'is-active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()} // keep focus
                  onClick={() => submit(s)}
                  onMouseEnter={() => setActive(i)}
                >
                  {s}
                </li>
              ))}
              {!items.length && (
                <li className="hp-suggest-item is-muted" aria-disabled="true">No suggestions</li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
