// 모바일 상단 존(#preview-area)의 [프리뷰][분석] 세그먼트 탭.
// 데스크톱/태블릿에선 CSS로 숨겨지고, 모바일에서만 표시된다.
// 모드 전환 시 onModeChange("preview" | "analysis")를 호출한다.

const TABS = [
    { id: "preview", label: "프리뷰" },
    { id: "analysis", label: "분석" },
];

let _onModeChange = null;
let _mode = "preview";

/**
 * 세그먼트 탭을 초기화합니다.
 * @param {HTMLElement} container - 탭을 그릴 요소 (#preview-area 최상단에 위치)
 * @param {object} opts
 * @param {function} opts.onModeChange - (mode: "preview"|"analysis") => void
 * @param {string} [opts.initialMode="preview"]
 */
export function init(container, { onModeChange, initialMode = "preview" }) {
    _onModeChange = onModeChange;
    _mode = initialMode;

    container.className = "preview-seg-tabs";
    container.innerHTML = "";

    TABS.forEach(({ id, label }) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `seg-tab${id === _mode ? " active" : ""}`;
        btn.dataset.mode = id;
        btn.textContent = label;
        btn.addEventListener("click", () => setMode(id));
        container.appendChild(btn);
    });

    onModeChange?.(_mode);
}

export function setMode(mode) {
    _mode = mode;
    document.querySelectorAll(".preview-seg-tabs .seg-tab").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    _onModeChange?.(mode);
}
