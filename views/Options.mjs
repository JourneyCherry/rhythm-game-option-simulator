export const RootType = Object.freeze({
    // 각 옵션 컨트롤을 표시할 Root Element의 id 이름
    BASE: "base-controls",
    OPTION: "option-controls",
});
const controlRoots = {}; // 각 옵션 컨트롤을 표시할 Root Elements
const controlHandles = {}; // 각 옵션 컨트롤에 접근하기 위한 핸들

export function init() {
    controlRoots[RootType.BASE] = document.getElementById(RootType.BASE);
    controlRoots[RootType.OPTION] = document.getElementById(RootType.OPTION);

    for (const type of Object.values(RootType)) {
        clearControls(type);
    }
}

export function clearControls(rootType) {
    controlRoots[rootType].innerHTML = "";
    for (const k of Object.keys(controlHandles)) {
        if (k.rootType == rootType) delete controlHandles[k];
    }
}

export function createNumericControl(rootType, def) {
    const wrapper = document.createElement("div");
    wrapper.className = "option-control";

    const label = document.createElement("label");
    label.className = "option-label";
    label.textContent = def.label;
    label.htmlFor = `${def.id}-slider`;

    const row = document.createElement("div");
    row.className = "option-row";

    const decBtn = document.createElement("button");
    decBtn.type = "button";
    decBtn.textContent = "-";
    decBtn.className = "option-btn";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.id = `${def.id}-slider`;
    slider.className = "option-slider";
    slider.min = def.min;
    slider.max = def.max;
    slider.step = def.step;
    slider.value = def.defaultValue;

    const incBtn = document.createElement("button");
    incBtn.type = "button";
    incBtn.textContent = "+";
    incBtn.className = "option-btn";

    const input = document.createElement("input");
    input.type = "number";
    input.className = "option-input";
    input.min = def.min;
    input.max = def.max;
    input.step = def.step;
    input.value = def.defaultValue;

    row.append(decBtn, slider, incBtn, input);
    wrapper.append(label, row);
    controlRoots[rootType].appendChild(wrapper);

    function applyFromValue(raw) {
        // 값 적용. 여러 컨트롤이 같이 변경되어야 하므로 함수로 관리
        let v = parseFloat(raw);
        if (Number.isNaN(v)) return;
        if (v < def.min) v = def.min;
        if (v > def.max) v = def.max;

        slider.value = String(v);
        input.value = String(v);
        def.apply(v);
    }

    slider.addEventListener("input", () => {
        applyFromValue(slider.value);
    });

    input.addEventListener("change", () => {
        applyFromValue(input.value);
    });

    decBtn.addEventListener("click", () => {
        const v = parseFloat(slider.value) - def.step;
        applyFromValue(v);
    });

    incBtn.addEventListener("click", () => {
        const v = parseFloat(slider.value) + def.step;
        applyFromValue(v);
    });

    // 외부에서 값 세팅 가능하게 핸들 등록
    controlHandles[def.id] = {
        rootType: rootType,
        setValue(v) {
            applyFromValue(v);
        },
    };

    // 초기값 적용
    applyFromValue(def.defaultValue);
}

export function createSelectControl(rootType, def) {
    const wrapper = document.createElement("div");
    wrapper.className = "option-control";

    const label = document.createElement("label");
    label.className = "option-label";
    label.textContent = def.label;

    const select = document.createElement("select");
    select.className = "option-select";

    def.options.forEach((opt) => {
        const optionEl = document.createElement("option");
        optionEl.value = String(opt.value);
        optionEl.textContent = opt.label;
        select.append(optionEl);
    });

    select.value = String(def.defaultValue);

    select.addEventListener("change", () => {
        def.apply(select.value);
    });

    wrapper.append(label, select);
    controlRoots[rootType].appendChild(wrapper);

    // 외부에서 값 세팅 가능하게 핸들 등록
    controlHandles[def.id] = {
        rootType: rootType,
        setValue(v) {
            select.value = String(v);
            def.apply(v);
        },
    };

    // 초기값 설정
    def.apply(def.defaultValue);
}
