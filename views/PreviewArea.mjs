let _playBtn = null;
let _pauseBtn = null;
let _isPlaying = false;
let _onPlay = null;
let _onPause = null;
let _onReset = null;

/** @type {HTMLCanvasElement|null} */
let _canvas = null;

/**
 * 프리뷰 영역을 초기화합니다.
 * 내부에 플레이 화면(#playfield)과 재생 컨트롤을 생성합니다.
 * 프리뷰는 캔버스로만 그려집니다. 그리는 로직은 *Preview.mjs 렌더러에 있습니다.
 * @param {HTMLElement} container - #preview-area 요소
 * @param {object} opts
 * @param {number} opts.previewAspect - 가로/세로 비율 (예: 16/9 = 1.7778)
 * @param {function} [opts.onPlay]
 * @param {function} [opts.onPause]
 * @param {function} [opts.onReset]
 */
export function init(container, { previewAspect, onPlay, onPause, onReset }) {
    _onPlay = onPlay;
    _onPause = onPause;
    _onReset = onReset;
    _isPlaying = false;

    container.innerHTML = "";

    setAspect(previewAspect ?? 16 / 9);

    // 플레이 화면 래퍼 (flex 중앙 정렬 + 레터박스)
    const wrapper = document.createElement("div");
    wrapper.className = "playfield-wrapper";

    // 플레이 화면 (렌더러가 이 안의 canvas에 그림)
    const playfield = document.createElement("div");
    playfield.id = "playfield";

    // 캔버스 렌더러용 canvas. 내부 해상도는 렌더러가 게임 원본 해상도로 설정하고,
    // CSS width/height:100%가 playfield 크기에 맞게 스케일한다.
    _canvas = document.createElement("canvas");
    _canvas.id = "gf-canvas";
    _canvas.className = "gf-canvas";
    playfield.appendChild(_canvas);

    wrapper.appendChild(playfield);

    // 재생 컨트롤 (▶ ⏸ ⟳)
    const controls = document.createElement("div");
    controls.className = "playback-controls";

    _playBtn = makeCtrlBtn("▶", "play-btn", "재생", handlePlay);
    _pauseBtn = makeCtrlBtn("⏸", "pause-btn", "일시정지", handlePause);
    const resetBtn = makeCtrlBtn("⟳", "reset-btn", "리셋", handleReset);

    controls.append(_playBtn, _pauseBtn, resetBtn);
    container.append(wrapper, controls);

    updateButtonStates();
}

/** CSS 변수 --preview-aspect를 갱신합니다. */
export function setAspect(aspect) {
    document.documentElement.style.setProperty("--preview-aspect", aspect);
}

/** 캔버스 렌더러용 canvas 요소를 반환합니다. */
export function getCanvas() {
    return _canvas;
}

/** 재생/일시정지/리셋 콜백을 교체합니다. 렌더러 전환 시 사용. */
export function setCallbacks({ onPlay, onPause, onReset }) {
    if (onPlay !== undefined) _onPlay = onPlay;
    if (onPause !== undefined) _onPause = onPause;
    if (onReset !== undefined) _onReset = onReset;
}

/** 재생 상태를 외부에서 설정합니다 (렌더러 전환 후 버튼 상태 동기화용). */
export function setPlayState(isPlaying) {
    _isPlaying = isPlaying;
    updateButtonStates();
}

function handlePlay() {
    _isPlaying = true;
    updateButtonStates();
    _onPlay?.();
}

function handlePause() {
    _isPlaying = false;
    updateButtonStates();
    _onPause?.();
}

function handleReset() {
    _isPlaying = false;
    updateButtonStates();
    _onReset?.();
}

function updateButtonStates() {
    if (_playBtn) _playBtn.disabled = _isPlaying;
    if (_pauseBtn) _pauseBtn.disabled = !_isPlaying;
}

function makeCtrlBtn(label, className, ariaLabel, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `ctrl-btn ${className}`;
    btn.textContent = label;
    btn.setAttribute("aria-label", ariaLabel);
    btn.addEventListener("click", onClick);
    return btn;
}
