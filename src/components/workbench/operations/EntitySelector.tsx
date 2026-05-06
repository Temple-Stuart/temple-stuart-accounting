'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export interface Entity {
  id: string;
  name: string;
  entity_type: string;
  is_default: boolean;
}

export interface EntityContext {
  entities: Entity[];
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  selectedEntity: Entity | null;
}

const STORAGE_KEY = 'operations-entity-id';

export const OperationsEntityContext = createContext<EntityContext | null>(null);

export function useOperationsEntity(): EntityContext {
  const ctx = useContext(OperationsEntityContext);
  if (!ctx) {
    throw new Error('useOperationsEntity must be used within OperationsEntityProvider');
  }
  return ctx;
}

export function OperationsEntityProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityIdState] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) return saved === 'null' ? null : saved;
      }
    } catch {}
    return null;
  });

  const setSelectedEntityId = useCallback((id: string | null) => {
    setSelectedEntityIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id === null ? 'null' : id);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchEntities = async () => {
      try {
        const res = await fetch('/api/entities');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const list: Entity[] = data?.entities ?? [];
        setEntities(list);

        // Apply is_default only when the user has never expressed a preference.
        const hasStoredPreference =
          typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== null;
        if (!hasStoredPreference && selectedEntityId === null) {
          const def = list.find((e) => e.is_default);
          if (def) setSelectedEntityId(def.id);
        }
      } catch {
        // silent — UI still renders with no entities
      }
    };
    fetchEntities();
    return () => {
      cancelled = true;
    };
    // selectedEntityId is intentionally not in deps: we only want the
    // is_default fallback to run once on initial entity load. Subsequent
    // user selections are persisted by setSelectedEntityId itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null;

  return (
    <OperationsEntityContext.Provider
      value={{ entities, selectedEntityId, setSelectedEntityId, selectedEntity }}
    >
      {children}
    </OperationsEntityContext.Provider>
  );
}

export default function EntitySelectorStrip() {
  const { entities, selectedEntityId, setSelectedEntityId } = useOperationsEntity();

  const activeClass =
    'px-2 py-1 text-xs font-mono border-b-2 border-brand-purple text-brand-purple';
  const inactiveClass =
    'px-2 py-1 text-xs font-mono border-b-2 border-transparent text-text-muted hover:text-text-primary';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setSelectedEntityId(null)}
        className={selectedEntityId === null ? activeClass : inactiveClass}
      >
        All
      </button>
      {entities.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => setSelectedEntityId(e.id)}
          className={selectedEntityId === e.id ? activeClass : inactiveClass}
        >
          {e.name}
        </button>
      ))}
    </div>
  );
}
