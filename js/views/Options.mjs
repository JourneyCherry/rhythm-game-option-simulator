export function clearControls(root) {
    root.innerHTML = "";
    for (const k of Object.keys(controlHandles)) {
        if (k.root == root) delete controlHandles[k];
    }
}

export function createNumericControl(root, def) {
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
    root.appendChild(wrapper);

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
        root: root,
        setValue(v) {
            applyFromValue(v);
        },
    };

    // 초기값 적용
    applyFromValue(def.defaultValue);
}

export function createSelectControl(root, def) {
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
    root.appendChild(wrapper);

    // 외부에서 값 세팅 가능하게 핸들 등록
    controlHandles[def.id] = {
        root: root,
        setValue(v) {
            select.value = String(v);
            def.apply(v);
        },
    };

    // 초기값 설정
    def.apply(def.defaultValue);
}
