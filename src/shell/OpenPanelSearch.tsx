import {
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  searchOpenPanels,
  type OpenPanelSearchDefinition,
  type OpenPanelSearchModule,
  type OpenPanelSearchResult,
  type OpenPanelSearchTab,
} from "./openPanelSearchModel";

type Props = {
  tabs: OpenPanelSearchTab[];
  definitions: OpenPanelSearchDefinition[];
  modules: OpenPanelSearchModule[];
  onNavigate: (result: OpenPanelSearchResult) => void;
};

export function OpenPanelSearch({
  tabs,
  definitions,
  modules,
  onNavigate,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  /*
   * Input state is immediate and local.
   * Search projection may yield to more urgent rendering work.
   */
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () =>
      searchOpenPanels(
        tabs,
        definitions,
        modules,
        deferredQuery,
      ),
    [tabs, definitions, modules, deferredQuery],
  );

  const selectedIndex = Math.min(
    activeIndex,
    Math.max(0, results.length - 1),
  );

  function navigate(index: number) {
    const result = results[index];

    if (!result) {
      return;
    }

    onNavigate(result);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div className="workspace-shell__open-panel-search">
      <input
        type="search"
        value={query}
        placeholder="Find open panel…"
        aria-label="Find an open panel"
        aria-expanded={open && Boolean(query.trim())}
        onFocus={() => {
          if (query.trim()) {
            setOpen(true);
          }
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(Boolean(value.trim()));
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuery("");
            setOpen(false);
            setActiveIndex(0);
            event.currentTarget.blur();
            return;
          }

          if (!results.length) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(
              (selectedIndex + 1) % results.length,
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(
              (selectedIndex - 1 + results.length) %
                results.length,
            );
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            navigate(selectedIndex);
          }
        }}
      />

      {open && query.trim() ? (
        <div
          className="workspace-shell__open-panel-search-results"
          role="listbox"
          aria-label="Open panel search results"
        >
          {results.length ? (
            results.map((result, index) => (
              <button
                key={`${result.tabId}:${result.panelId}`}
                type="button"
                role="option"
                aria-selected={index === selectedIndex}
                className={
                  index === selectedIndex
                    ? "workspace-shell__open-panel-search-result workspace-shell__open-panel-search-result--active"
                    : "workspace-shell__open-panel-search-result"
                }
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  navigate(index);
                }}
              >
                <strong>{result.title}</strong>
                <span>
                  {result.moduleTitle}
                  {result.title !== result.definitionTitle
                    ? ` · ${result.definitionTitle}`
                    : ""}
                  {` · ${result.tabTitle}`}
                  {result.minimized ? " · minimized" : ""}
                </span>
              </button>
            ))
          ) : (
            <div className="workspace-shell__open-panel-search-empty">
              No matching open panels
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
