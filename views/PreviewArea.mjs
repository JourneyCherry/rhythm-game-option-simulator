let _playBtn = null;
let _pauseBtn = null;
let _isPlaying = false;
let _onPlay = null;
let _onPause = null;
let _onReset = null;

/**
 * 프리뷰 영역을 초기화합니다.
 * 내부에 플레이 화면(#playfield)과 재생 컨트롤을 생성합니다.
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

    // 플레이 화면 (Preview.mjs가 이 안의 요소를 사용)
    const playfield = document.createElement("div");
    playfield.id = "playfield";
    playfield.innerHTML = `
        <div class="note-lanes">
            <div class="lane"></div>
            <div class="lane"></div>
            <div class="lane"></div>
            <div class="lane"></div>
            <div class="lane"></div>
        </div>
        <div id="judgeline"></div>
        <div id="beat-layer" class="beat-layer"></div>
        <div id="note-layer" class="note-layer"></div>
        <div class="cover cover-top"></div>
        <div class="cover cover-bottom"></div>
    `;

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
