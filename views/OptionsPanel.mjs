let _container = null;
let _layout = "rows";
let _onChange = null;

/**
 * 옵션 패널을 초기화합니다.
 * @param {HTMLElement} container - 마운트할 DOM 요소 (#options-panel)
 * @param {object} opts
 * @param {'rows'|'cols'} opts.layout - 옵션 배치 방향 ('folder' 추후 확장 예정)
 * @param {object[]} opts.options - OptionDef 배열
 * @param {object} opts.values - 현재 옵션 값 맵
 * @param {function} opts.onChange - 값 변경 콜백 (id, value) => void
 */
export function init(container, { layout, options, values, onChange }) {
    _container = container;
    _layout = layout;
    _onChange = onChange;

    render(options, values);
}

/**
 * 프리셋 변경 등으로 옵션 목록을 전체 재렌더링합니다.
 * @param {object[]} options
 * @param {object} values
 */
export function render(options, values) {
    _container.innerHTML = "";

    const inner = document.createElement("div");
    inner.className = `options-panel-inner layout-${_layout}`;

    options.forEach((def) => {
        const item = createOptionItem(def, values[def.id] ?? def.defaultValue);
        inner.appendChild(item);
    });

    _container.appendChild(inner);
}

/** layout prop을 변경하고 재렌더링합니다. (추후 folder 지원 시 이 함수 확장) */
export function setLayout(layout, options, values) {
    _layout = layout;
    render(options, values);
}

function createOptionItem(def, currentValue) {
    const item = document.createElement("div");
    item.className = "option-item";

    const label = document.createElement("div");
    label.className = "option-label";
    label.textContent = def.label;

    const controlArea = document.createElement("div");
    controlArea.className = "option-control-area";

    // 타입별 렌더러 (추후 toggle/numeric 추가 가능)
    switch (def.type) {
        case "number":
            controlArea.appendChild(createRangeControl(def, currentValue));
            break;
        case "select":
            controlArea.appendChild(createSelectControl(def, currentValue));
            break;
        default:
            controlArea.appendChild(createRangeControl(def, currentValue));
    }

    item.append(label, controlArea);
    return item;
}

// ---- RangeControl ----
function createRangeControl(def, currentValue) {
    const wrapper = document.createElement("div");
    wrapper.className = "range-control";

    const row = document.createElement("div");
    row.className = "range-row";

    const decBtn = document.createElement("button");
    decBtn.type = "button";
    decBtn.className = "range-btn";
    decBtn.textContent = "−";
    decBtn.setAttribute("aria-label", `${def.label} 감소`);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "option-slider";
    slider.min = def.min;
    slider.max = def.max;
    slider.step = def.step;
    slider.value = currentValue;

    const incBtn = document.createElement("button");
    incBtn.type = "button";
    incBtn.className = "range-btn";
    incBtn.textContent = "+";
    incBtn.setAttribute("aria-label", `${def.label} 증가`);

    const valueDisplay = document.createElement("span");
    valueDisplay.className = "range-value";
    valueDisplay.textContent = formatValue(currentValue, def.step);

    function applyValue(raw) {
        let v = parseFloat(raw);
        if (Number.isNaN(v)) return;
        v = Math.min(def.max, Math.max(def.min, v));
        // step 단위로 반올림 (부동소수점 오차 방지)
        const decimals = (String(def.step).split(".")[1] ?? "").length;
        v = parseFloat(v.toFixed(decimals));
        slider.value = v;
        valueDisplay.textContent = formatValue(v, def.step);
        _onChange?.(def.id, v);
    }

    slider.addEventListener("input", () => applyValue(slider.value));
    decBtn.addEventListener("click", () =>
        applyValue(parseFloat(slider.value) - def.step),
    );
    incBtn.addEventListener("click", () =>
        applyValue(parseFloat(slider.value) + def.step),
    );

    // cols 레이아웃에서는 −/+ 버튼 위치가 세로로 바뀜 (CSS로 처리)
    row.append(incBtn, slider, decBtn, valueDisplay);
    wrapper.appendChild(row);
    return wrapper;
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

function formatValue(v, step) {
    const decimals = (String(step).split(".")[1] ?? "").length;
    return v.toFixed(decimals);
}
