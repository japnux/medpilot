"use client";

import { useEffect, useRef, useState } from "react";

export interface MedicationReference {
  id: string;
  name: string;
  brand_name: string | null;
  active_ingredient: string | null;
  category: string | null;
  default_indication: string | null;
  wikipedia_url: string | null;
  vidal_url: string | null;
  ansm_url: string | null;
  common_side_effects: unknown;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  onPick: (ref: MedicationReference) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * Input texte avec dropdown d'autocomplete depuis /api/medications/references.
 * Debounced (200ms). Affiche les 10 premiers matchs (par name ou brand_name).
 * Le pick prefill les autres champs du form via le callback `onPick`.
 */
export default function MedicationNameAutocomplete({
  value,
  onChange,
  onPick,
  placeholder,
  required,
}: Props) {
  const [suggestions, setSuggestions] = useState<MedicationReference[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  // Anti-flicker : on n'écrase pas les suggestions tant qu'on ne ré-ouvre pas.
  const queryRef = useRef(value);

  // Fetch debouncé
  useEffect(() => {
    queryRef.current = value;
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/medications/references?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          references?: MedicationReference[];
        };
        // Ignore si la query a changé entre temps
        if (queryRef.current === value) {
          setSuggestions(json.references ?? []);
          setActiveIdx(-1);
        }
      } catch {
        /* silencieux */
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [value]);

  // Clic à l'extérieur → fermer
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function handlePick(ref: MedicationReference) {
    onPick(ref);
    setOpen(false);
    setSuggestions([]);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) =>
        i <= 0 ? suggestions.length - 1 : i - 1,
      );
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handlePick(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        autoComplete="off"
        className="w-full px-3 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-10 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-md border border-hairline bg-canvas shadow-lg"
        >
          {suggestions.map((s, idx) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => handlePick(s)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-card ${
                  idx === activeIdx ? "bg-surface-card" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">{s.name}</span>
                  {s.brand_name && (
                    <span className="text-xs text-muted">{s.brand_name}</span>
                  )}
                </div>
                {s.default_indication && (
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {s.default_indication}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
