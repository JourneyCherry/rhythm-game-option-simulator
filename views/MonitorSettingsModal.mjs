import * as Monitor from "../services/Monitor.mjs";

let _overlay = null;
let _closeBtn = null;
let _isRequired = false;
let _onSave = null;

// 폼 입력 요소 참조
let _presetSelect = null;
let _sizeInput = null;
let _widthInput = null;
let _heightInput = null;
let _delayInput = null;
let _aspectDisplay = null;
let _overrideCheck = null;
let _aspectOverrideInput = null;

/**
 * 모니터 설정 모달을 초기화합니다.
 * @param {HTMLElement} container - #modal-root 요소
 * @param {object} opts
 * @param {function} opts.onSave - 저장 콜백 (monitorData) => void
 * @param {object|null} opts.monitor - 현재 저장된 모니터 데이터
 */
export function init(container, { onSave, monitor }) {
    _onSave = onSave;

    _overlay = document.createElement("div");
    _overlay.className = "modal-overlay hidden";
    _overlay.setAttribute("role", "dialog");
    _overlay.setAttribute("aria-modal", "true");
    _overlay.setAttribute("aria-label", "모니터 설정");

    _overlay.addEventListener("click", (e) => {
        if (e.target === _overlay && !_isRequired) close();
    });

    const dialog = document.createElement("div");
    dialog.className = "modal-dialog";

    // 헤더
    const header = document.createElement("div");
    header.className = "modal-header";

    const title = document.createElement("div");
    title.className = "modal-title";
    title.textContent = "모니터 설정";

    _closeBtn = document.createElement("button");
    _closeBtn.type = "button";
    _closeBtn.className = "modal-close-btn";
    _closeBtn.setAttribute("aria-label", "닫기");
    _closeBtn.textContent = "✕";
    _closeBtn.addEventListener("click", () => {
        if (!_isRequired) close();
    });

    header.append(title, _closeBtn);

    // 바디
    const body = document.createElement("div");
    body.className = "modal-body";

    // 프리셋 드롭다운
    const presetGroup = makeFieldGroup("빠른 선택");
    _presetSelect = document.createElement("select");
    _presetSelect.className = "modal-select";
    Monitor.getPresets().forEach((p, i) => {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = p.label;
        _presetSelect.appendChild(opt);
    });
    _presetSelect.addEventListener("change", () => {
        const idx = parseInt(_presetSelect.value, 10);
        const preset = Monitor.getPresets()[idx];
        if (preset && idx > 0) fillForm(preset);
    });
    presetGroup.append(_presetSelect);

    const divider = document.createElement("hr");
    divider.className = "modal-divider";

    // 크기
    const sizeGroup = makeFieldGroup("화면 크기 (인치)");
    _sizeInput = makeInput("number", "24", "narrow");
    _sizeInput.min = 1;
    _sizeInput.max = 100;
    _sizeInput.step = 0.1;
    const sizeRow = document.createElement("div");
    sizeRow.className = "field-row";
    sizeRow.append(_sizeInput, makeSep('"'));
    sizeGroup.appendChild(sizeRow);

    // 해상도
    const resGroup = makeFieldGroup("해상도");
    _widthInput = makeInput("number", "1920", "narrow");
    _widthInput.min = 1;
    _heightInput = makeInput("number", "1080", "narrow");
    _heightInput.min = 1;
    const resRow = document.createElement("div");
    resRow.className = "field-row";
    resRow.append(_widthInput, makeSep("×"), _heightInput);
    resGroup.appendChild(resRow);

    // 해상도 변경 시 화면비 자동 계산
    [_widthInput, _heightInput].forEach((inp) =>
        inp.addEventListener("input", updateAspectDisplay),
    );

    // 입력 지연
    const delayGroup = makeFieldGroup("입력 지연 (ms)");
    _delayInput = makeInput("number", "0", "narrow");
    _delayInput.min = 0;
    _delayInput.max = 1000;
    _delayInput.step = 0.1;
    const delayRow = document.createElement("div");
    delayRow.className = "field-row";
    delayRow.append(_delayInput, makeSep("ms"));
    delayGroup.appendChild(delayRow);

    // 화면비 (자동 계산 + 수동 오버라이드)
    const aspectGroup = makeFieldGroup("화면비");
    const aspectRow = document.createElement("div");
    aspectRow.className = "aspect-row";
    _aspectDisplay = document.createElement("span");
    _aspectDisplay.className = "aspect-display";
    _aspectDisplay.textContent = "16:9";
    const overrideLabel = document.createElement("label");
    overrideLabel.className = "aspect-override-label";
    _overrideCheck = document.createElement("input");
    _overrideCheck.type = "checkbox";
    _overrideCheck.addEventListener("change", () => {
        _aspectOverrideInput.disabled = !_overrideCheck.checked;
        if (!_overrideCheck.checked) updateAspectDisplay();
    });
    _aspectOverrideInput = makeInput("text", "16:9", "narrow");
    _aspectOverrideInput.placeholder = "예: 16:9";
    _aspectOverrideInput.disabled = true;
    overrideLabel.append(_overrideCheck, document.createTextNode("수동 입력"));
    aspectRow.append(_aspectDisplay, overrideLabel, _aspectOverrideInput);
    aspectGroup.appendChild(aspectRow);

    body.append(
        presetGroup,
        divider,
        sizeGroup,
        resGroup,
        delayGroup,
        aspectGroup,
    );

    // 푸터
    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn-primary";
    saveBtn.textContent = "저장";
    saveBtn.addEventListener("click", handleSave);

    footer.appendChild(saveBtn);

    dialog.append(header, body, footer);
    _overlay.appendChild(dialog);
    container.appendChild(_overlay);

    // 기존 저장값이 있으면 폼에 채우기
    if (monitor) fillForm(monitor);
    updateAspectDisplay();
}

/** 모달을 엽니다. required=true 이면 닫기 버튼/백드롭이 비활성화됩니다. */
export function open(required = false) {
    _isRequired = required;
    _overlay?.classList.remove("hidden");
    updateCloseButtonState();
}

/** 모달을 닫습니다. */
export function close() {
    _overlay?.classList.add("hidden");
}

function updateCloseButtonState() {
    if (_closeBtn) _closeBtn.disabled = _isRequired;
}

function handleSave() {
    const data = {
        sizeInches: parseFloatOrNull(_sizeInput.value),
        widthPx: parseIntOrNull(_widthInput.value),
        heightPx: parseIntOrNull(_heightInput.value),
        inputDelayMs: parseFloatOrNull(_delayInput.value) ?? 0,
        aspectOverride: _overrideCheck.checked
            ? _aspectOverrideInput.value.trim() || null
            : null,
    };
    _onSave?.(data);
    close();
}

function fillForm(data) {
    if (_sizeInput) _sizeInput.value = data.sizeInches ?? "";
    if (_widthInput) _widthInput.value = data.widthPx ?? "";
    if (_heightInput) _heightInput.value = data.heightPx ?? "";
    if (_delayInput) _delayInput.value = data.inputDelayMs ?? 0;
    if (data.aspectOverride) {
        _overrideCheck.checked = true;
        _aspectOverrideInput.disabled = false;
        _aspectOverrideInput.value = data.aspectOverride;
    } else {
        _overrideCheck.checked = false;
        _aspectOverrideInput.disabled = true;
    }
    updateAspectDisplay();
}

function updateAspectDisplay() {
    if (_overrideCheck?.checked) return;
    const w = parseInt(_widthInput?.value, 10);
    const h = parseInt(_heightInput?.value, 10);
    if (!w || !h) {
        if (_aspectDisplay) _aspectDisplay.textContent = "—";
        return;
    }
    const g = gcd(w, h);
    const ratioText = `${w / g}:${h / g}`;
    if (_aspectDisplay) _aspectDisplay.textContent = ratioText;
    if (_aspectOverrideInput && !_overrideCheck?.checked) {
        _aspectOverrideInput.value = ratioText;
    }
}

function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}

function makeFieldGroup(labelText) {
    const group = document.createElement("div");
    group.className = "field-group";
    const label = document.createElement("div");
    label.className = "field-label";
    label.textContent = labelText;
    group.appendChild(label);
    return group;
}

function makeInput(type, placeholder, extraClass = "") {
    const inp = document.createElement("input");
    inp.type = type;
    inp.className = `modal-input${extraClass ? " " + extraClass : ""}`;
    inp.placeholder = placeholder;
    return inp;
}

function makeSep(text) {
    const span = document.createElement("span");
    span.className = "field-sep";
    span.textContent = text;
    return span;
}

function parseFloatOrNull(v) {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
}

function parseIntOrNull(v) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
}
