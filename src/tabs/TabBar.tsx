import type { WorkspaceTab } from "../core/types";

type Props = {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCreateTab: () => void;
  onCloseTab: (tabId: string) => void;
};

export function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCreateTab,
  onCloseTab,
}: Props) {
  return (
    <nav className="tab-bar" aria-label="Workspace tabs">
      <div className="tab-bar__tabs">
        {tabs.map((tab) => (
          <div
            className={`tab-bar__tab ${tab.id === activeTabId ? "tab-bar__tab--active" : ""}`}
            key={tab.id}
          >
            <button type="button" onClick={() => onSelectTab(tab.id)}>
              {tab.title}
            </button>
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
      <button className="tab-bar__add" type="button" onClick={onCreateTab}>
        + New Tab
      </button>
    </nav>
  );
}

