import * as Monitor from "../services/Monitor.mjs";

let _monitorInfoBtn = null;
let _gameNameEl = null;
let _onGameChange = null;
let _onMonitorClick = null;
let _onHamburger = null;
let _selectEl = null;

/**
 * 상단 바를 초기화합니다.
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {object[]} opts.presets - 게임 프리셋 목록
 * @param {string} opts.currentPresetId - 현재 선택된 프리셋 ID
 * @param {function} opts.onGameChange - 게임 변경 콜백 (presetId: string) => void
 * @param {function} opts.onMonitorClick - 모니터 설정 모달 열기 콜백
 * @param {function} opts.onHamburger - 햄버거 버튼 클릭 콜백 (태블릿 dock-side)
 */
export function init(container, { presets, currentPresetId, onGameChange, onMonitorClick, onHamburger }) {
    _onGameChange = onGameChange;
    _onMonitorClick = onMonitorClick;
    _onHamburger = onHamburger;

    container.innerHTML = "";

    // 좌측 그룹
    const left = document.createElement("div");
    left.className = "top-bar-left";

    // 햄버거 버튼 (태블릿 dock-side에서만 활성)
    const hamburger = document.createElement("button");
    hamburger.type = "button";
    hamburger.className = "hamburger-btn";
    hamburger.setAttribute("aria-label", "옵션 패널 열기");
    hamburger.textContent = "☰";
    hamburger.addEventListener("click", () => _onHamburger?.());

    // 모바일 전용: 현재 게임명 표시
    _gameNameEl = document.createElement("span");
    _gameNameEl.className = "top-bar-game-name";
    _gameNameEl.textContent =
        presets.find((p) => p.id === currentPresetId)?.label ?? "";

    // 데스크톱/태블릿 전용: 게임 선택 드롭다운
    const gameSelector = document.createElement("div");
    gameSelector.className = "game-selector";
    _selectEl = document.createElement("select");
    _selectEl.className = "game-select";
    _selectEl.setAttribute("aria-label", "게임 선택");
    presets.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.label;
        if (p.id === currentPresetId) opt.selected = true;
        _selectEl.appendChild(opt);
    });
    _selectEl.addEventListener("change", () => {
        const preset = presets.find((p) => p.id === _selectEl.value);
        if (_gameNameEl) _gameNameEl.textContent = preset?.label ?? "";
        _onGameChange?.(_selectEl.value);
    });
    gameSelector.appendChild(_selectEl);

    left.append(hamburger, _gameNameEl, gameSelector);

    // 우측 그룹
    const right = document.createElement("div");
    right.className = "top-bar-right";

    _monitorInfoBtn = document.createElement("button");
    _monitorInfoBtn.type = "button";
    _monitorInfoBtn.className = "monitor-info-btn";
    _monitorInfoBtn.setAttribute("aria-label", "모니터 설정");
    _monitorInfoBtn.addEventListener("click", () => _onMonitorClick?.());

    const gearBtn = document.createElement("button");
    gearBtn.type = "button";
    gearBtn.className = "gear-btn";
    gearBtn.setAttribute("aria-label", "모니터 설정");
    gearBtn.textContent = "⚙";
    gearBtn.addEventListener("click", () => _onMonitorClick?.());

    right.append(_monitorInfoBtn, gearBtn);

    container.append(left, right);

    updateMonitorSummary(Monitor.getSummaryText());
}

/** 모니터 요약 텍스트를 갱신합니다. */
export function updateMonitorSummary(text) {
    if (_monitorInfoBtn) _monitorInfoBtn.textContent = text;
}

/** 게임 선택 드롭다운 값을 외부에서 갱신합니다. */
export function setSelectedPreset(presetId) {
    if (_selectEl) _selectEl.value = presetId;
}
