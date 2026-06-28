// 옵션 한 개의 버튼(+/−) + 슬라이더 컨트롤 모듈.
//
// 방향 매개변수 하나(plusDirection)로 + 버튼이 놓이는 쪽과 슬라이더 증가 방향을 함께 정한다.
// 이 값 하나만 바꾸면 위/아래 배치가 통째로 뒤집힌다(동작·값은 동일, 표시만 반전):
//   "up"(기본) — cols 레이아웃에서 + 위·− 아래, 슬라이더는 아래(−)→위(+)
//   "down"     — + 아래·− 위, 슬라이더는 위(−)→아래(+) (서든/히든처럼 커버 방향에 맞출 때)
// 실제 상하 스왑(버튼 order·슬라이더 direction)은 CSS의 .buttons-inverted가 처리하고,
// 이 모듈은 plusDirection에 따라 그 클래스만 토글한다. (rows 레이아웃엔 대응 CSS가 없어 무효)

/**
 * range 컨트롤(.range-control) 요소를 만들어 반환합니다.
 * @param {object} def - OptionDef (id·label·min·max·step·steps)
 * @param {number} currentValue - 현재 값
 * @param {object} [opts]
 * @param {"up"|"down"} [opts.plusDirection="up"] - + 버튼 방향(위/아래). 이 한 값으로 방향 전환.
 * @param {function} [opts.onChange] - 값 변경 콜백 (id, value) => void
 * @returns {HTMLElement}
 */
export function create(def, currentValue, { plusDirection = "up", onChange } = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = "range-control";
    if (plusDirection === "down") wrapper.classList.add("buttons-inverted");

    const row = document.createElement("div");
    row.className = "range-row";

    const decBtn = document.createElement("button");
    decBtn.type = "button";
    decBtn.className = "range-btn dec-btn";
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
    incBtn.className = "range-btn inc-btn";
    incBtn.textContent = "+";
    incBtn.setAttribute("aria-label", `${def.label} 증가`);

    const valueDisplay = document.createElement("span");
    valueDisplay.className = "range-value";
    valueDisplay.textContent = formatValue(currentValue, def.step);

    // steps 배열이 있으면 슬라이더를 인덱스 기반으로 동작
    const steps = def.steps ?? null;
    if (steps) {
        slider.min = 0;
        slider.max = steps.length - 1;
        slider.step = 1;
        const initIdx = steps.indexOf(parseFloat(slider.value));
        slider.value = initIdx >= 0 ? initIdx : 0;
    }

    function applyValue(raw) {
        if (steps) {
            let idx = parseInt(raw, 10);
            if (Number.isNaN(idx)) return;
            idx = Math.max(0, Math.min(steps.length - 1, idx));
            slider.value = idx;
            const v = steps[idx];
            valueDisplay.textContent = formatValue(v, def.step);
            onChange?.(def.id, v);
        } else {
            let v = parseFloat(raw);
            if (Number.isNaN(v)) return;
            v = Math.min(def.max, Math.max(def.min, v));
            // step 단위로 반올림 (부동소수점 오차 방지)
            const decimals = (String(def.step).split(".")[1] ?? "").length;
            v = parseFloat(v.toFixed(decimals));
            slider.value = v;
            valueDisplay.textContent = formatValue(v, def.step);
            onChange?.(def.id, v);
        }
    }

    function stepIndex(dir) {
        return String(parseInt(slider.value, 10) + dir);
    }

    slider.addEventListener("input", () => applyValue(slider.value));
    decBtn.addEventListener("click", () =>
        steps ? applyValue(stepIndex(-1)) : applyValue(parseFloat(slider.value) - def.step),
    );
    incBtn.addEventListener("click", () =>
        steps ? applyValue(stepIndex(1)) : applyValue(parseFloat(slider.value) + def.step),
    );

    // DOM 순서는 항상 [−, slider, +, value]. cols 레이아웃에서 시각적 상하 배치는
    // CSS order가 정하고, plusDirection이 "down"이면 .buttons-inverted가 그 order를 뒤집는다.
    row.append(decBtn, slider, incBtn, valueDisplay);
    wrapper.appendChild(row);
    return wrapper;
}

function formatValue(v, step) {
    const decimals = (String(step).split(".")[1] ?? "").length;
    return v.toFixed(decimals);
}
