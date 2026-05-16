"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

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
  /** Sélection explicite depuis le dropdown : prefill complet (nom, marque, …). */
  onPick: (ref: MedicationReference) => void;
  /** Match exact détecté pendant la frappe : prefill conservateur (URLs, side effects). */
  onMatchByName?: (ref: MedicationReference) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * Input texte + dropdown depuis /api/medications/references.
 * - Clic / focus : ouvre la liste (top 50 si vide, 10 filtrés sinon).
 * - Frappe : filtre debouncé 200ms. Si un match est exact (name ou brand_name),
 *   `onMatchByName` est déclenché pour pré-remplir les URLs/effets indésirables
 *   sans cliquer.
 * - Le user peut toujours valider un nom libre qui n'est pas dans la table.
 */
export default function MedicationNameAutocomplete({
  value,
  onChange,
  onPick,
  onMatchByName,
  placeholder,
  required,
}: Props) {
  const [suggestions, setSuggestions] = useState<MedicationReference[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef(value);
  // Évite de re-déclencher onMatchByName en boucle pour le même match
  const lastMatchedIdRef = useRef<string | null>(null);

  // Fetch debouncé (déclenché aussi pour query vide, à l'ouverture)
  useEffect(() => {
    queryRef.current = value;
    const q = value.trim();
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/medications/references?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          references?: MedicationReference[];
        };
        if (queryRef.current !== value) return;
        const list = json.references ?? [];
        setSuggestions(list);
        setActiveIdx(-1);

        // Match exact (case + accent-insensitive minimal via normalize)
        if (q.length >= 2 && onMatchByName) {
          const norm = (s: string) =>
            s
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .toLowerCase()
              .trim();
          const target = norm(q);
          const exact = list.find(
            (r) =>
              norm(r.name) === target ||
              (r.brand_name && norm(r.brand_name) === target),
          );
          if (exact && lastMatchedIdRef.current !== exact.id) {
            lastMatchedIdRef.current = exact.id;
            onMatchByName(exact);
          } else if (!exact) {
            lastMatchedIdRef.current = null;
          }
        } else {
          lastMatchedIdRef.current = null;
        }
      } catch {
        /* silencieux */
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [value, onMatchByName]);

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
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (suggestions.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
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
      <div className="relative">
        <input
          ref={inputRef}
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
          className="w-full pl-3 pr-9 py-2 rounded-md border border-hairline bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 px-2 flex items-center text-muted hover:text-ink"
          aria-label={open ? "Fermer la liste" : "Ouvrir la liste"}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
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
