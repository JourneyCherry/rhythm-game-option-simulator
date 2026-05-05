const TABS = [
    { id: "options", icon: "🎚", label: "옵션" },
    { id: "analysis", icon: "📊", label: "분석" },
    { id: "bms", icon: "📝", label: "BMS" },
];

let _onTabChange = null;
let _activeTab = "options";

/**
 * 모바일 탭 바를 초기화합니다.
 * @param {HTMLElement} container - #mobile-tab-bar 요소
 * @param {object} opts
 * @param {function} opts.onTabChange - (tabId: string) => void
 * @param {string} [opts.initialTab='options']
 */
export function init(container, { onTabChange, initialTab = "options" }) {
    _onTabChange = onTabChange;
    _activeTab = initialTab;

    container.innerHTML = "";

    TABS.forEach(({ id, icon, label }) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `tab-btn${id === _activeTab ? " active" : ""}`;
        btn.dataset.tab = id;
        btn.setAttribute("aria-label", label);

        const iconEl = document.createElement("span");
        iconEl.className = "tab-btn-icon";
        iconEl.textContent = icon;

        const labelEl = document.createElement("span");
        labelEl.className = "tab-btn-label";
        labelEl.textContent = label;

        btn.append(iconEl, labelEl);
        btn.addEventListener("click", () => setActiveTab(id));
        container.appendChild(btn);
    });

    // 초기 탭 활성화
    onTabChange?.(_activeTab);
}

export function setActiveTab(tabId) {
    _activeTab = tabId;

    document.querySelectorAll("#mobile-tab-bar .tab-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    _onTabChange?.(tabId);
}
