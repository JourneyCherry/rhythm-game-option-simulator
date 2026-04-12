// 이동 관련 설정값 (추후 옵션으로 바꿀 예정)
const SPAWN_Y_TOP = -0.1;
const SPAWN_Y_BOTTOM = 1.1;

// 샘플 데이터
// 4/4 한 마디를 1/8로 나눈 구조
const MEASURE_DURATION = 4.0; // 한 마디 길이(초) - 샘플 값
const SUBDIVISION = 8; // 1/8 박
const SUB_INTERVAL = MEASURE_DURATION / SUBDIVISION;

// 1,2,3,4,5,4,3,2 패턴 (라인: 1~5)
const NOTE_PATTERN = [1, 2, 3, 4, 5, 4, 3, 2];

// 라인별 노트 색상 (게임마다 교체 가능)
const NOTE_COLORS = [
    null, // dummy (인덱스 1부터 사용)
    "#ff4d4d", // 1번 라인: 빨강
    "#4dff4d", // 2번 라인: 초록
    "#4d4dff", // 3번 라인: 파랑
    "#ffff4d", // 4번 라인: 노랑
    "#ff4dff", // 5번 라인: 분홍
];

// 주입 참조 (init()에서 설정)
let _noteLayer, _beatLayer, _config, _JUDGE_LINE_Y;

// 상태: 활성 노트/라인 목록
/** @type {Array<{el:HTMLElement,y:number,laneIndex:number,hidden:boolean}>} */
let activeNotes = [];

/** @type {Array<{el:HTMLElement,y:number,kind:string}>} */
let activeTimingLines = [];

// 시간 / 스폰 스케줄 관리
let lastFrameTime;
let songTime = 0;

let nextNoteTime = 0;
let nextNoteIndex = 0; // NOTE_PATTERN 인덱스

let nextBarTime = 0; // 마디선: 매 마디 시작
let nextBeatTime = MEASURE_DURATION / 4; // 박자선: 2,3,4박 위치에서 시작

let running = false;

// -----------------------------
// 유틸리티: 라인 인덱스 → left%
// -----------------------------
function laneIndexToLeftPercent(laneIndex) {
    // laneIndex: 1 ~ 5
    const laneWidth = 100 / 5; // 5개 라인
    return (laneIndex - 1) * laneWidth;
}

function getSpawnY() {
    return _config.direction === 1 ? SPAWN_Y_TOP : SPAWN_Y_BOTTOM;
}

// 노트 하나 생성
function createNote(laneIndex) {
    const el = document.createElement("div");
    el.className = "note";

    // 가로 위치: 해당 라인
    const leftPercent = laneIndexToLeftPercent(laneIndex);
    el.style.left = `${leftPercent}%`;

    // 라인별 노트 색상 적용
    const color = NOTE_COLORS[laneIndex] || "#ffffff";
    el.style.background = color;

    _noteLayer.appendChild(el);

    return {
        el,
        y: getSpawnY(),
        laneIndex,
        hidden: false,
    };
}

// 박자선 생성 (thin / thick)
function createTimingLine(kind) {
    const el = document.createElement("div");
    el.className = `timing-line ${kind}`;
    _beatLayer.appendChild(el);

    return {
        el,
        y: getSpawnY(),
        kind,
    };
}

// -----------------------------
// 메인 루프
// -----------------------------
function loop(now) {
    if (!running) return;

    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    songTime += dt;

    const signedSpeed = _config.speed * (_config.direction === 1 ? 1 : -1);

    // ----- 노트 스폰: 1,2,3,4,5,4,3,2 (1/8 간격) -----
    while (songTime >= nextNoteTime) {
        const laneIndex = NOTE_PATTERN[nextNoteIndex % NOTE_PATTERN.length];

        const note = createNote(laneIndex);
        activeNotes.push(note);

        nextNoteIndex += 1;
        nextNoteTime += SUB_INTERVAL;
    }

    // ----- 마디선(bar line) 스폰 -----
    while (songTime >= nextBarTime) {
        activeTimingLines.push(createTimingLine("bar"));
        nextBarTime += MEASURE_DURATION;
    }

    // ----- 박자선(beat line) 스폰: 매 1/4박마다 -----
    const BEAT_INTERVAL = MEASURE_DURATION / 4;
    while (songTime >= nextBeatTime) {
        activeTimingLines.push(createTimingLine("beat"));
        nextBeatTime += BEAT_INTERVAL;
    }

    // ----- 노트 업데이트 -----
    activeNotes.forEach((note) => {
        note.y += signedSpeed * dt;
        note.el.style.top = `${note.y * 100}%`;

        // 판정선 도달 시 숨김
        if (!note.hidden) {
            if (
                (_config.direction === 1 && note.y >= _JUDGE_LINE_Y) ||
                (_config.direction === -1 && note.y <= _JUDGE_LINE_Y)
            ) {
                note.hidden = true;
                note.el.style.display = "none";
            }
        }
    });

    // 화면 아래로 벗어난 노트 제거
    activeNotes = activeNotes.filter((note) => {
        const outOfScreen =
            _config.direction === 1 ? note.y > 1.1 : note.y < -0.1;
        if (outOfScreen) {
            _noteLayer.removeChild(note.el);
            return false;
        }
        return true;
    });

    // ----- 타이밍 라인(박자선/마디선) 업데이트 -----
    activeTimingLines.forEach((line) => {
        line.y += signedSpeed * dt;
        line.el.style.top = `${line.y * 100}%`;
    });

    // 화면 아래로 벗어난 타이밍 라인 제거
    activeTimingLines = activeTimingLines.filter((line) => {
        const outOfScreen =
            _config.direction === 1 ? line.y > 1.1 : line.y < -0.1;
        if (outOfScreen) {
            _beatLayer.removeChild(line.el);
            return false;
        }
        return true;
    });

    requestAnimationFrame(loop);
}

// -----------------------------
// 공개 API
// -----------------------------

export function init({ noteLayer, beatLayer, config, judgeLineY }) {
    _noteLayer = noteLayer;
    _beatLayer = beatLayer;
    _config = config;
    _JUDGE_LINE_Y = judgeLineY;

    // 시작 시 바로 첫 마디선 하나 찍어두기
    activeTimingLines.push(createTimingLine("bar"));
    nextBarTime += MEASURE_DURATION;

    lastFrameTime = performance.now();
}

export function start() {
    running = true;
    requestAnimationFrame(loop);
}

export function stop() {
    running = false;
}
