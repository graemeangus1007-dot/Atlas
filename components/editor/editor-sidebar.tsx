"use client";

import {
  EDITOR_SIDEBAR_ITEMS,
  type EditorSidebarId,
} from "@/data/editor";

type EditorSidebarProps = {
  activeId: EditorSidebarId;
  onSelect: (id: EditorSidebarId) => void;
  open: boolean;
  onClose: () => void;
};

/**
 * Compact left tools rail — Content, Design, Site settings.
 * Atlas is the primary editing interface; this rail is secondary.
 */
export default function EditorSidebar({
  activeId,
  onSelect,
  open,
  onClose,
}: EditorSidebarProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-52 flex-col border-r border-border/70 bg-surface/90 backdrop-blur-xl transition-transform duration-300 lg:static lg:z-auto lg:w-44 lg:translate-x-0 xl:w-48 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Editor tools"
        data-testid="editor-tools-rail"
      >
        <div className="flex h-12 items-center px-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            Tools
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {EDITOR_SIDEBAR_ITEMS.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`editor-rail-${item.id}`}
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-accent-soft text-foreground"
                    : "text-muted hover:bg-white/[0.03] hover:text-foreground"
                }`}
              >
                <span className="text-sm opacity-80" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
