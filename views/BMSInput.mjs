/** @type {HTMLTextAreaElement|null} */
let _textarea = null;

/**
 * BMS 입력 UI 요소를 생성합니다.
 * 데스크톱/태블릿: footer collapsible
 * 모바일: setup 탭 섹션 (main.js에서 DOM 이동)
 *
 * @param {object} opts
 * @param {function} opts.onParse - (text: string) => void
 * @returns {HTMLElement} 생성된 루트 요소 (이동 가능)
 */
export function create({ onParse }) {
    const root = document.createElement("div");
    root.className = "bms-input-section";

    // 토글 버튼 (collapsible 헤더)
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "bms-toggle";
    toggle.textContent = "▼  BMS 입력";

    // 접을 수 있는 바디
    const body = document.createElement("div");
    body.className = "bms-body collapsed";

    toggle.addEventListener("click", () => {
        const isCollapsed = body.classList.toggle("collapsed");
        toggle.classList.toggle("open", !isCollapsed);
        toggle.textContent = isCollapsed ? "▼  BMS 입력" : "▲  BMS 입력";
    });

    const textarea = document.createElement("textarea");
    textarea.className = "bms-textarea";
    textarea.placeholder = "BMS 데이터를 여기에 붙여넣으세요...";
    textarea.rows = 5;
    textarea.setAttribute("aria-label", "BMS 데이터 입력");
    textarea.setAttribute("spellcheck", "false");
    _textarea = textarea;

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "bms-apply-btn";
    applyBtn.textContent = "적용";
    applyBtn.addEventListener("click", () => {
        onParse?.(textarea.value);
    });

    body.append(textarea, applyBtn);
    root.append(toggle, body);

    return root;
}

/**
 * textarea 내용을 외부에서 설정합니다.
 * 렌더러 전환 시 게임별 기본 BMS 스크립트를 채워넣는 용도.
 * @param {string} text
 */
export function setContent(text) {
    if (_textarea) _textarea.value = text;
}
