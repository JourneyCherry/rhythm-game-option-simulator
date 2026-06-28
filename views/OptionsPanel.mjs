import * as RangeControl from "./RangeControl.mjs";

let _container = null;
let _layout = "rows";
let _onChange = null;
let _onApplyPreset = null;
let _onReset = null;

/**
 * 옵션 패널을 초기화합니다.
 * @param {HTMLElement} container - 마운트할 DOM 요소 (#options-panel)
 * @param {object} opts
 * @param {'rows'|'cols'} opts.layout - 옵션 배치 방향 ('folder' 추후 확장 예정)
 * @param {object[]} opts.options - OptionDef 배열
 * @param {object} opts.values - 현재 옵션 값 맵
 * @param {function} opts.onChange - 값 변경 콜백 (id, value) => void
 * @param {function} [opts.onApplyPreset] - 프리셋(버튼형) 적용 콜백 (id, value, applies) => void
 * @param {function} [opts.onReset] - 옵션 초기화 버튼 콜백 () => void
 */
export function init(container, { layout, options, values, onChange, onApplyPreset, onReset }) {
    _container = container;
    _layout = layout;
    _onChange = onChange;
    _onApplyPreset = onApplyPreset;
    _onReset = onReset;

    render(options, values);
}

/**
 * 프리셋 변경 등으로 옵션 목록을 전체 재렌더링합니다.
 * @param {object[]} options
 * @param {object} values
 */
export function render(options, values) {
    hideTooltip(); // 재렌더로 라벨이 교체되므로 떠 있던 툴팁을 먼저 닫는다

    // 재렌더 시 스크롤 위치 보존 (프리셋 적용 등으로 패널을 다시 그려도 최상단으로 튀지 않게)
    const prevInner = _container.querySelector(".options-panel-inner");
    const prevScroll = prevInner ? prevInner.scrollTop : 0;

    _container.innerHTML = "";

    const inner = document.createElement("div");
    inner.className = `options-panel-inner layout-${_layout}`;

    options.forEach((def) => {
        const item = createOptionItem(def, values[def.id] ?? def.defaultValue, values);
        inner.appendChild(item);
    });

    _container.appendChild(inner);
    inner.scrollTop = prevScroll; // 새로 만든 스크롤 컨테이너에 이전 위치 복원

    // 옵션 초기화 버튼 — 스크롤되는 inner 바깥(패널 하단)에 상시 고정.
    if (_onReset) {
        const footer = document.createElement("div");
        footer.className = "options-panel-footer";

        const resetBtn = document.createElement("button");
        resetBtn.type = "button";
        resetBtn.className = "options-reset-btn";
        resetBtn.textContent = "옵션 초기화";
        resetBtn.addEventListener("click", () => _onReset?.());

        footer.appendChild(resetBtn);
        _container.appendChild(footer);
    }
}

/** layout prop을 변경하고 재렌더링합니다. (추후 folder 지원 시 이 함수 확장) */
export function setLayout(layout, options, values) {
    _layout = layout;
    render(options, values);
}

function createOptionItem(def, currentValue, values) {
    const item = document.createElement("div");
    item.className = "option-item";

    const label = document.createElement("div");
    label.className = "option-label";
    label.textContent = def.label;
    attachTooltip(label, def.description);

    const controlArea = document.createElement("div");
    controlArea.className = "option-control-area";

    // invertButtonsWhenDirection: 현재 direction 값이 이 값과 같으면 +/− 버튼·슬라이더 방향을
    // 뒤집는다(커버 경계가 움직이는 화면 방향과 +방향을 맞춤). 동작(값)은 동일.
    // 서든·히든은 같은 방향에서 경계가 서로 반대로 움직이므로 트리거 방향값도 서로 반대(1 vs -1).
    // RangeControl에는 위/아래 방향을 plusDirection 한 값으로 넘긴다.
    const invertButtons =
        def.invertButtonsWhenDirection != null &&
        Number(values?.direction) === def.invertButtonsWhenDirection;
    const plusDirection = invertButtons ? "down" : "up";

    // 타입별 렌더러 (추후 toggle/numeric 추가 가능)
    switch (def.type) {
        case "number":
            controlArea.appendChild(
                RangeControl.create(def, currentValue, { plusDirection, onChange: _onChange }),
            );
            break;
        case "select":
            controlArea.appendChild(createSelectControl(def, currentValue));
            break;
        case "preset":
            controlArea.appendChild(createPresetControl(def));
            break;
        default:
            controlArea.appendChild(
                RangeControl.create(def, currentValue, { onChange: _onChange }),
            );
    }

    item.append(label, controlArea);
    return item;
}

// ---- SelectControl ----
function createSelectControl(def, currentValue) {
    const chipList = document.createElement("div");
    chipList.className = "chip-list";

    def.options.forEach((opt) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = opt.label;
        chip.dataset.value = String(opt.value);
        if (String(opt.value) === String(currentValue)) {
            chip.classList.add("selected");
        }

        chip.addEventListener("click", () => {
            chipList
                .querySelectorAll(".chip")
                .forEach((c) => c.classList.remove("selected"));
            chip.classList.add("selected");
            _onChange?.(def.id, opt.value);
        });

        chipList.appendChild(chip);
    });

    return chipList;
}

// ---- PresetControl ----
// 버튼형 옵션: 클릭하면 자신의 `applies` 맵({ 옵션id: 값 })을 다른 옵션들에 일괄 적용한다.
// 체크박스/토글과 달리 **상태를 갖지 않는 순수 액션 버튼** — 선택 표시(selected) 없이
// 누를 때마다 다른 옵션값만 수정한다. "- -"(applies 없음)는 아무 동작도 하지 않는다.
// 적용 후 패널이 재렌더되어(main.js의 onApplyPreset) 영향받은 슬라이더/칩이 갱신된다.
function createPresetControl(def) {
    const chipList = document.createElement("div");
    chipList.className = "chip-list preset-list";

    def.options.forEach((opt) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip preset-chip";
        chip.textContent = opt.label;
        chip.dataset.value = String(opt.value);

        chip.addEventListener("click", () => {
            if (opt.applies) _onApplyPreset?.(opt.applies);
        });

        // 실측값 확보 전까지 프리셋 버튼 동작 무력화. applies 데이터·핸들러는 보존하므로
        // 재활성화하려면 이 disabled 줄만 제거하면 된다.
        chip.disabled = true;

        chipList.appendChild(chip);
    });

    return chipList;
}

// ====================
//  옵션 설명 툴팁
// ====================
// PC: 라벨 hover 시 고정 위치로 표시(마우스를 따라가지 않음).
// 태블릿/모바일: 라벨 탭으로 토글, 바깥을 조작/클릭하면 닫힘.
// 설명(def.description)이 없거나 비어 있으면 "작성중"으로 표시.

let _tooltipEl = null;
let _tooltipAnchor = null; // 현재 탭으로 열린 라벨 (모바일 토글 판별용)
let _tooltipGlobalsBound = false;

function getTooltipEl() {
    if (!_tooltipEl) {
        _tooltipEl = document.createElement("div");
        _tooltipEl.className = "option-tooltip";
        _tooltipEl.setAttribute("role", "tooltip");
        document.body.appendChild(_tooltipEl);
    }
    return _tooltipEl;
}

function bindTooltipGlobals() {
    if (_tooltipGlobalsBound) return;
    _tooltipGlobalsBound = true;
    // 바깥(다른 옵션/컨트롤 등)을 클릭하면 닫기 — 라벨 클릭은 stopPropagation으로 제외됨
    document.addEventListener("click", hideTooltip);
    // 스크롤/리사이즈로 라벨 위치가 바뀌면 고정 툴팁이 어긋나므로 닫기
    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);
}

function showTooltip(anchorEl, text) {
    const tip = getTooltipEl();
    // 줄바꿈은 `\n`(권장). 편의상 `<br>`·`\r\n`도 줄바꿈으로 인식한다.
    // textContent로 넣어 HTML 주입은 막고, 실제 개행은 CSS white-space: pre-line이 렌더한다.
    tip.textContent = String(text)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/\r\n?/g, "\n");
    tip.classList.add("visible");

    // 라벨 바로 아래에 고정 배치. 뷰포트 밖으로 나가면 좌우/상하 보정.
    const margin = 8;
    const r = anchorEl.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = r.left;
    let top = r.bottom + 6;
    if (left + tw > window.innerWidth - margin) left = window.innerWidth - margin - tw;
    if (left < margin) left = margin;
    if (top + th > window.innerHeight - margin) top = r.top - th - 6; // 아래 공간 부족 → 위로
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
}

function hideTooltip() {
    if (_tooltipEl) _tooltipEl.classList.remove("visible");
    _tooltipAnchor = null;
}

function attachTooltip(labelEl, description) {
    // 설명이 없거나 비어 있으면 툴팁을 달지 않는다 (리스너·표시 모두 없음).
    const text = description && String(description).trim();
    if (!text) return;
    labelEl.classList.add("has-tooltip");
    bindTooltipGlobals();

    // hover 지원 기기(PC)에서만 마우스 오버로 표시
    if (window.matchMedia("(hover: hover)").matches) {
        labelEl.addEventListener("mouseenter", () => showTooltip(labelEl, text));
        labelEl.addEventListener("mouseleave", hideTooltip);
    }

    // 터치/클릭 토글 (태블릿·모바일). 전파를 막아 바깥 클릭 닫기와 충돌하지 않게 한다.
    labelEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (_tooltipAnchor === labelEl) {
            hideTooltip();
        } else {
            showTooltip(labelEl, text);
            _tooltipAnchor = labelEl;
        }
    });
}
