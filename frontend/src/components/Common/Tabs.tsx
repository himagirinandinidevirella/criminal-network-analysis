/**
 * Tabs — lightweight accessible tab set (no external dependency).
 * "Dossier" underline style: hairline rule with a vermilion active underline.
 */
import { createContext, useContext, useState } from "react";

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue>({ value: "", setValue: () => {} });

export function Tabs({ defaultValue, children }: { defaultValue: string; children: React.ReactNode }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className="w-full">{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="tablist" className={`flex gap-6 border-b border-paper-line ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = "" }: { value: string; children: React.ReactNode; className?: string }) {
  const { value: active, setValue } = useContext(TabsContext);
  const isActive = active === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setValue(value)}
      className={`relative -mb-px whitespace-nowrap border-b-2 px-1 pb-2.5 pt-1 font-mono text-xs font-semibold uppercase tracking-wide transition ${
        isActive
          ? "border-seal text-seal"
          : "border-transparent text-ink-faint hover:border-paper-line hover:text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const { value: active } = useContext(TabsContext);
  if (active !== value) return null;
  return <div role="tabpanel" className="pt-4">{children}</div>;
}
