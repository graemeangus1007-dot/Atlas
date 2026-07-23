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
 * Left editor tools rail — Pages, Content, Brand Studio, Media, Publish.
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
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-surface/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Editor tools"
      >
        <div className="flex h-14 items-center border-b border-border px-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Tools
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {EDITOR_SIDEBAR_ITEMS.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-accent-soft text-foreground shadow-[inset_0_0_0_1px_rgba(61,184,168,0.25)]"
                    : "text-muted hover:bg-white/[0.03] hover:text-foreground"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border px-4 py-3">
          <p className="text-xs leading-relaxed text-muted">
            Click text on the live preview to edit. Changes update instantly.
          </p>
        </div>
      </aside>
    </>
  );
}
