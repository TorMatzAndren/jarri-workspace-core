import { useEffect, useRef, useState } from "react";
import type { WorkspaceTab } from "../core/types";

type Props = {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCreateTab: () => void;
  onRenameTab: (tabId: string, title: string) => void;
  onCloseTab: (tabId: string) => void;
};

export function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCreateTab,
  onRenameTab,
  onCloseTab,
}: Props) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingTabId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingTabId]);

  function beginRename(tab: WorkspaceTab) {
    setEditingTabId(tab.id);
    setDraftTitle(tab.title);
  }

  function commitRename(tab: WorkspaceTab) {
    const nextTitle = draftTitle.trim();
    if (nextTitle && nextTitle !== tab.title) {
      onRenameTab(tab.id, nextTitle);
    }
    setEditingTabId(null);
    setDraftTitle("");
  }

  function cancelRename() {
    setEditingTabId(null);
    setDraftTitle("");
  }

  return (
    <nav className="tab-bar" aria-label="Workspace tabs">
      <div className="tab-bar__tabs">
        {tabs.map((tab) => (
          <div
            className={`tab-bar__tab ${tab.id === activeTabId ? "tab-bar__tab--active" : ""}`}
            key={tab.id}
          >
            {editingTabId === tab.id ? (
              <input
                ref={editInputRef}
                className="tab-bar__rename-input"
                value={draftTitle}
                aria-label={`Rename ${tab.title}`}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={() => commitRename(tab)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitRename(tab);
                  if (event.key === "Escape") cancelRename();
                }}
              />
            ) : (
              <button
                type="button"
                title="Double-click to rename"
                onClick={() => onSelectTab(tab.id)}
                onDoubleClick={() => beginRename(tab)}
              >
                {tab.title}
              </button>
            )}
            <button
              type="button"
              disabled={tabs.length <= 1}
              aria-label={`Close ${tab.title}`}
              onClick={() => onCloseTab(tab.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="tab-bar__actions">
        <button className="tab-bar__add" type="button" onClick={onCreateTab}>
          + New Tab
        </button>
      </div>
    </nav>
  );
}
