// 모니터 설정 모달.
// 화면 크기(인치)와 해상도만 입력받는다. 화면비는 항상 16:9로 고정이며,
// 입력 지연·빠른 선택·수동 화면비 입력은 제공하지 않는다.
// "초기화" 버튼은 현재 게임의 기본 모니터로 되돌린다(main.js의 onReset).

let _overlay = null;
let _closeBtn = null;
let _isRequired = false;
let _onSave = null;
let _onReset = null;

// 폼 입력 요소 참조
let _sizeInput = null;
let _widthInput = null;
let _heightInput = null;

// 화면비는 항상 16:9로 고정.
const FIXED_ASPECT = "16:9";

/**
 * 모니터 설정 모달을 초기화합니다.
 * @param {HTMLElement} container - #modal-root 요소
 * @param {object} opts
 * @param {function} opts.onSave - 저장 콜백 (monitorData) => void
 * @param {function} [opts.onReset] - 초기화 콜백 () => void (현재 게임 기본값으로 복원)
 * @param {object|null} opts.monitor - 현재 저장된 모니터 데이터
 */
export function init(container, { onSave, onReset, monitor }) {
    _onSave = onSave;
    _onReset = onReset;

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

    // 크기
    const sizeGroup = makeFieldGroup("화면 크기 (인치)");
    _sizeInput = makeInput("number", "32", "narrow");
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

    // 화면비 (항상 16:9 고정, 읽기 전용 표시)
    const aspectGroup = makeFieldGroup("화면비");
    const aspectDisplay = document.createElement("span");
    aspectDisplay.className = "aspect-display";
    aspectDisplay.textContent = FIXED_ASPECT;
    aspectGroup.appendChild(aspectDisplay);

    body.append(sizeGroup, resGroup, aspectGroup);

    // 푸터
    const footer = document.createElement("div");
    footer.className = "modal-footer";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn-secondary";
    resetBtn.textContent = "초기화";
    resetBtn.addEventListener("click", () => _onReset?.());

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn-primary";
    saveBtn.textContent = "저장";
    saveBtn.addEventListener("click", handleSave);

    footer.append(resetBtn, saveBtn);

    dialog.append(header, body, footer);
    _overlay.appendChild(dialog);
    container.appendChild(_overlay);

    // 기존 저장값이 있으면 폼에 채우기
    if (monitor) fillForm(monitor);
}

/** 외부에서 모니터 데이터가 바뀌었을 때 폼 내용을 갱신합니다. */
export function setMonitor(data) {
    if (data) fillForm(data);
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
    };
    _onSave?.(data);
    close();
}

function fillForm(data) {
    if (_sizeInput) _sizeInput.value = data.sizeInches ?? "";
    if (_widthInput) _widthInput.value = data.widthPx ?? "";
    if (_heightInput) _heightInput.value = data.heightPx ?? "";
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
