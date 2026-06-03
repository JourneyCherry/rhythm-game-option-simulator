// 기타도라 GF 코나스테 렌더러
// 프로파일·로직 모두 이 파일에서 관리한다.

const PROFILE = {
    width: 1920,
    height: 1080,

    // 레인 영역 (절대 픽셀 좌표)
    laneLeft: 780,
    buttonRight: 1071, // 5버튼 영역 우측 경계
    wailingRight: 1138.5, // 웨일링 영역 우측 경계
    laneTop: 104,
    noteSpawnY: 155, // Reverse 기준 노트 최초 등장 Y
    laneBottom: 1080,

    // 판정선 (Reverse 기준)
    judgeLineYReverse: 926,
    judgeLineThickness: 7.5, // 판정선 외부 높이 (px)
    judgeLineStrokeWidth: 2, // 판정선 테두리 두께 (px)

    // 판정선 위치 조절 (judgelinePosition 옵션 1단위 = 이 값(px)만큼 이동)
    // 양수 = 노트 등장 방향 (Reverse: 위, Normal: 아래)
    judgelinePosScale: 1.5,

    // 커버 (value=0이면 표시 안 함). 다른 옵션과 무관, 옵션값만으로 일차함수로 결정.
    suddenBaseY: 160, // 서든 경계 기준 Y (서든은 화면 최상단~경계를 가림)
    hiddenBaseY: 1000, // 히든 경계 기준 Y (히든은 경계~화면 최하단을 가림)
    coverPerUnit: 8.4, // 옵션값 1당 경계 이동 픽셀 (서든 +방향, 히든 -방향)

    // 게임 프레임레이트. px/frame ↔ px/sec 변환 및 오프셋 프레임 해석의 기준.
    fps: 60,

    // 노트 속도: (speedBase + speedPerUnit * speed) px/frame at fps
    speedBase: 1.5,
    speedPerUnit: 3,

    // 타이밍 오프셋 (단위: 프레임 @fps)
    // noteOffset 1단위 = 실제로 0.4프레임 더 늦게 쳐야 함
    offsetPerUnitFrames: 0.4,
    baseNoteOffset: 5, // 기본 노트 표시 타이밍 (옵션 단위). noteOffset에 항상 더해짐. 5 × 0.4 = 2프레임 당김.

    // 노트 색상 [index 0 미사용, 1~5 = 라인 1~5]
    noteColors: [null, "#ff4444", "#44ff44", "#4444ff", "#ffff44", "#ff44ff"],
    wailingColor: "#ff4444",
    wailingBorderColor: "#ffffff",
};

// ---- 테스트 패턴 상수 ----

const TEST_BPM = 120;
const TEST_BEAT_DURATION = 60 / TEST_BPM; // 0.5s
const TEST_MEASURE_BEATS = 4;
const TEST_MEASURES = 2;
const TEST_LOOP_DURATION =
    TEST_MEASURES * TEST_MEASURE_BEATS * TEST_BEAT_DURATION; // 4s
const BUTTON_COUNT = 5;

function buildTestSchedule() {
    const schedule = [];
    const totalBeats = TEST_MEASURES * TEST_MEASURE_BEATS;
    for (let beat = 0; beat < totalBeats; beat++) {
        const time = beat * TEST_BEAT_DURATION;
        for (let lane = 1; lane <= BUTTON_COUNT; lane++) {
            schedule.push({ time, type: "note", lane });
        }
        schedule.push({
            time,
            type: "wailing",
            dir: beat % 2 === 0 ? "up" : "down",
        });
    }
    return schedule;
}

const TEST_SCHEDULE = buildTestSchedule();

// ---- 모듈 상태 ----

let _canvas = null;
let _config = null;
let _running = false;
let _songTime = 0;
let _lastFrameTime = 0;

// ---- 유틸 ----

// 노트 속도 (px/frame) — speed 옵션값의 일차함수.
function getSpeedPpf(cfg) {
    return PROFILE.speedBase + PROFILE.speedPerUnit * cfg.speed;
}

// 노트 속도 (px/sec) — 게임은 fps 기준이므로 ppf × fps.
function getSpeedPps(cfg) {
    return getSpeedPpf(cfg) * PROFILE.fps;
}

// 표시(노란) 판정선 Y 좌표 — judgelinePosition만 반영한다.
// noteOffset/judgeOffset(타이밍 오프셋)에는 영향받지 않는다. drawJudgeLine 전용.
// judgelinePosition > 0 → 노트 등장 방향으로 이동 (Reverse: 위, Normal: 아래)
function getVisualJudgeLineY(cfg) {
    const pos = cfg.judgelinePosition ?? 0;
    const posOffsetPx = pos * PROFILE.judgelinePosScale;

    if (cfg.direction === 1) {
        return PROFILE.judgeLineYReverse - posOffsetPx;
    } else {
        // TODO: Normal 기준 판정선 위치는 실측값 아님 - Reverse 기준 상하 반전
        const baseY =
            PROFILE.laneTop + PROFILE.laneBottom - PROFILE.judgeLineYReverse;
        return baseY + posOffsetPx;
    }
}

// 내부(처리) 판정선 Y 좌표 — 표시 판정선에 타이밍 오프셋을 더한 위치.
// 노트·박자선·마디선은 이 선을 기준으로 그려진다 (노트가 이 선에 닿는 순간 = 키음 타이밍).
// 화면에는 그리지 않는다 (향후 판정 표시 기능에서 사용 예정).
//
// noteOffset > 0 → 0.4프레임 늦게 쳐야 함 → Reverse에서 내부선이 아래(Y 증가)
// judgeOffset > 0 → noteOffset 반대 방향 → Reverse에서 내부선이 위(Y 감소)
function getInternalJudgeLineY(cfg) {
    const speed_ppf = getSpeedPpf(cfg);
    const noteOff = cfg.noteOffset ?? 0;
    const judgeOff = cfg.judgeOffset ?? 0;

    const timingPx =
        (PROFILE.baseNoteOffset + noteOff - judgeOff) *
        PROFILE.offsetPerUnitFrames *
        speed_ppf;
    const visualY = getVisualJudgeLineY(cfg);

    // Reverse: timing(noteOff>0 → 아래) / Normal: 상하 반전
    return cfg.direction === 1 ? visualY + timingPx : visualY - timingPx;
}

// 노트 등장 마스크 경계 Y — 이 선까지(레인 진입 가장자리 쪽) 노트가 가려진다.
// Reverse: noteSpawnY 그대로(레인 상단~이 선 가림).
// Normal: 상하 반전(이 선~레인 하단 가림). (TODO: Normal 실측값 아님)
function getNoteSpawnY(cfg) {
    if (cfg.direction === 1) {
        return PROFILE.noteSpawnY;
    }
    return PROFILE.laneTop + PROFILE.laneBottom - PROFILE.noteSpawnY;
}

// y = judgeLineY - direction * (noteTime - songTime) * speed_pps
function getNoteY(judgeLineY, dir, noteTime, songTime, speed_pps) {
    return judgeLineY - dir * (noteTime - songTime) * speed_pps;
}

// 현재 화면에 보이는 시간 범위 (songTime 기준 오프셋 반환)
function getVisibleTimeOffsets(
    judgeLineY,
    dir,
    speed_pps,
    laneTop,
    laneBottom,
) {
    const tAtTop = (dir * (judgeLineY - laneTop)) / speed_pps;
    const tAtBottom = (dir * (judgeLineY - laneBottom)) / speed_pps;
    return [Math.min(tAtTop, tAtBottom), Math.max(tAtTop, tAtBottom)];
}

// ---- 드로우 함수 ----

function drawBackground(ctx) {
    const {
        width,
        height,
        laneLeft,
        wailingRight,
        buttonRight,
        laneTop,
        laneBottom,
    } = PROFILE;
    const buttonWidth = (buttonRight - laneLeft) / BUTTON_COUNT;

    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#111120";
    ctx.fillRect(
        laneLeft,
        laneTop,
        wailingRight - laneLeft,
        laneBottom - laneTop,
    );

    ctx.strokeStyle = "#334455";
    ctx.lineWidth = 1;
    for (let i = 1; i < BUTTON_COUNT; i++) {
        const x = laneLeft + i * buttonWidth;
        ctx.beginPath();
        ctx.moveTo(x, laneTop);
        ctx.lineTo(x, laneBottom);
        ctx.stroke();
    }

    ctx.strokeStyle = "#556677";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(buttonRight, laneTop);
    ctx.lineTo(buttonRight, laneBottom);
    ctx.stroke();
}

function drawBeatLines(ctx, songTime) {
    const { laneLeft, wailingRight, laneTop, laneBottom } = PROFILE;
    const speed_pps = getSpeedPps(_config);
    const judgeLineY = getInternalJudgeLineY(_config);
    const dir = _config.direction;

    const [tMinOff, tMaxOff] = getVisibleTimeOffsets(
        judgeLineY,
        dir,
        speed_pps,
        laneTop,
        laneBottom,
    );
    const tMin = songTime + tMinOff;
    const tMax = songTime + tMaxOff;

    const firstBeatIdx = Math.ceil(tMin / TEST_BEAT_DURATION);
    const lastBeatIdx = Math.floor(tMax / TEST_BEAT_DURATION);

    for (let bi = firstBeatIdx; bi <= lastBeatIdx; bi++) {
        const t = bi * TEST_BEAT_DURATION;
        const y = getNoteY(judgeLineY, dir, t, songTime, speed_pps);
        if (y < laneTop || y > laneBottom) continue;

        const isBar = bi % TEST_MEASURE_BEATS === 0;
        ctx.strokeStyle = isBar ? "#8899aa" : "#334455";
        ctx.lineWidth = isBar ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(laneLeft, y);
        ctx.lineTo(wailingRight, y);
        ctx.stroke();
    }
}

function drawNotes(ctx, songTime) {
    const {
        laneLeft,
        buttonRight,
        wailingRight,
        laneTop,
        laneBottom,
        judgeLineThickness,
        judgeLineStrokeWidth,
        noteColors,
        wailingColor,
        wailingBorderColor,
    } = PROFILE;
    const buttonWidth = (buttonRight - laneLeft) / BUTTON_COUNT;
    const wailingWidth = wailingRight - buttonRight;
    const noteH = judgeLineThickness - 2 * judgeLineStrokeWidth;

    const speed_pps = getSpeedPps(_config);
    const judgeLineY = getInternalJudgeLineY(_config);
    const dir = _config.direction;

    const [tMinOff, tMaxOff] = getVisibleTimeOffsets(
        judgeLineY,
        dir,
        speed_pps,
        laneTop,
        laneBottom,
    );
    const tMin = songTime + tMinOff;
    const tMax = songTime + tMaxOff;

    const loopStart = Math.floor(tMin / TEST_LOOP_DURATION);
    const loopEnd = Math.ceil(tMax / TEST_LOOP_DURATION);

    for (let loopN = loopStart; loopN <= loopEnd; loopN++) {
        for (const event of TEST_SCHEDULE) {
            const t = loopN * TEST_LOOP_DURATION + event.time;
            if (t < tMin || t > tMax) continue;
            if (t < songTime) continue;

            const y = getNoteY(judgeLineY, dir, t, songTime, speed_pps);
            if (y < laneTop || y > laneBottom) continue;

            if (event.type === "note") {
                const x = laneLeft + (event.lane - 1) * buttonWidth;
                const ny = y - noteH / 2;
                ctx.fillStyle = noteColors[event.lane];
                ctx.fillRect(x, ny, buttonWidth, noteH);
                ctx.strokeStyle = "rgba(255,255,255,0.4)";
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, ny + 0.5, buttonWidth - 1, noteH - 1);
            } else if (event.type === "wailing") {
                drawWailingArrow(
                    ctx,
                    buttonRight,
                    wailingWidth,
                    y,
                    event.dir,
                    wailingColor,
                    wailingBorderColor,
                );
            }
        }
    }
}

function drawWailingArrow(ctx, wx, ww, y, dir, fillColor, strokeColor) {
    const totalH = 40;
    const headH = 25;
    const headHW = 22;
    const shaftHW = 7;
    const cx = wx + ww / 2;
    const ah = totalH / 2;

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    if (dir === "up") {
        ctx.moveTo(cx, y - ah);
        ctx.lineTo(cx + headHW, y - ah + headH);
        ctx.lineTo(cx + shaftHW, y - ah + headH);
        ctx.lineTo(cx + shaftHW, y + ah);
        ctx.lineTo(cx - shaftHW, y + ah);
        ctx.lineTo(cx - shaftHW, y - ah + headH);
        ctx.lineTo(cx - headHW, y - ah + headH);
    } else {
        ctx.moveTo(cx - shaftHW, y - ah);
        ctx.lineTo(cx + shaftHW, y - ah);
        ctx.lineTo(cx + shaftHW, y + ah - headH);
        ctx.lineTo(cx + headHW, y + ah - headH);
        ctx.lineTo(cx, y + ah);
        ctx.lineTo(cx - headHW, y + ah - headH);
        ctx.lineTo(cx - shaftHW, y + ah - headH);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function drawJudgeLine(ctx) {
    const { laneLeft, wailingRight, judgeLineThickness, judgeLineStrokeWidth } =
        PROFILE;
    const y = getVisualJudgeLineY(_config);
    const w = wailingRight - laneLeft;
    const h = judgeLineThickness;
    const lw = judgeLineStrokeWidth;

    // strokeRect는 선 중앙이 좌표 위에 오므로 lw/2 안쪽으로 inset
    ctx.strokeStyle = "#ffcc00";
    ctx.lineWidth = lw;
    ctx.strokeRect(laneLeft + lw / 2, y - h / 2 + lw / 2, w - lw, h - lw);
}

// 노트 등장 마스크.
// 노트는 화면 밖에서부터 정상적으로 낙하하지만, noteSpawnY까지는 보이지 않는다.
// 검정 서든이 아니라 레인 배경을 다시 그려 가리므로, 레인 구조(구분선)는 그대로 두고
// 노트·박자선만 등장 지점 전까지 숨겨진다("투명 서든" 느낌).
// drawNotes 직후 호출되어 등장 지점 이전 구간의 노트를 덮는다.
function drawNoteSpawnMask(ctx) {
    const { laneLeft, wailingRight, laneTop, laneBottom } = PROFILE;
    const spawnY = getNoteSpawnY(_config);
    const laneWidth = wailingRight - laneLeft;

    ctx.save();
    ctx.beginPath();
    if (_config.direction === 1) {
        // Reverse: 레인 상단 ~ spawnY 구간을 가림
        ctx.rect(laneLeft, laneTop, laneWidth, spawnY - laneTop);
    } else {
        // Normal: spawnY ~ 레인 하단 구간을 가림
        ctx.rect(laneLeft, spawnY, laneWidth, laneBottom - spawnY);
    }
    ctx.clip();
    drawBackground(ctx);
    ctx.restore();
}

// 서든/히든 가림막.
// 방향·판정선·타이밍 등 다른 어떤 옵션에도 영향받지 않는다.
// 각자 자신의 옵션값만으로 "기준 위치 + 가변량 × 옵션값"의 일차함수로 경계가 정해진다.
// draw()에서 마지막에 호출되어 노트·박자선·판정선을 모두 덮는다.
function drawCovers(ctx) {
    if (_config.sudden <= 0 && _config.hidden <= 0) return;

    const {
        laneLeft,
        wailingRight,
        height,
        suddenBaseY,
        hiddenBaseY,
        coverPerUnit,
    } = PROFILE;
    const laneWidth = wailingRight - laneLeft;

    ctx.fillStyle = "rgba(0, 0, 0, 1)";

    // 서든: 화면 최상단(Y=0)부터 경계까지 가림.
    // 경계 = suddenBaseY + coverPerUnit × sudden (값이 클수록 아래로 내려와 더 많이 가림)
    if (_config.sudden > 0) {
        const coverBottom = suddenBaseY + coverPerUnit * _config.sudden;
        ctx.fillRect(laneLeft, 0, laneWidth, coverBottom);
    }

    // 히든: 경계부터 화면 최하단(Y=height)까지 가림.
    // 경계 = hiddenBaseY - coverPerUnit × hidden (값이 클수록 위로 올라가 더 많이 가림)
    if (_config.hidden > 0) {
        const coverTop = hiddenBaseY - coverPerUnit * _config.hidden;
        ctx.fillRect(laneLeft, coverTop, laneWidth, height - coverTop);
    }
}

// ---- 메인 드로우 / 루프 ----

function draw() {
    if (!_canvas || !_config) return;
    const ctx = _canvas.getContext("2d");
    drawBackground(ctx);
    drawBeatLines(ctx, _songTime);
    drawNotes(ctx, _songTime);
    drawNoteSpawnMask(ctx);
    drawJudgeLine(ctx);
    drawCovers(ctx);
}

function loop(now) {
    if (!_running) return;
    const dt = (now - _lastFrameTime) / 1000;
    _lastFrameTime = now;
    _songTime += dt;
    draw();
    requestAnimationFrame(loop);
}

// ---- 공개 API ----

export function init({ canvas, config }) {
    _canvas = canvas;
    _config = config;
    _running = false;
    _songTime = 0;
    // 캔버스 내부 해상도를 게임 원본 해상도로 설정
    // CSS width/height:100%가 프리뷰 영역에 맞게 스케일해줌
    _canvas.width = PROFILE.width;
    _canvas.height = PROFILE.height;
}

export function start() {
    if (_running) return;
    _running = true;
    _lastFrameTime = performance.now();
    requestAnimationFrame(loop);
}

export function stop() {
    _running = false;
}

export function reset() {
    _running = false;
    _songTime = 0;
}

export const DEFAULT_BMS = `#BPM 120
#PLAYER 1
#TITLE GF Test Pattern
#ARTIST -

*-- 2마디, 4/4박자, 4분음표, 전 라인 + 웨일링
*-- Channel 11=R(1), 12=G(2), 13=B(3), 14=Y(4), 15=P(5)
*-- 웨일링 채널은 기타도라 BMS 포맷 확인 후 추가 예정

#00111:01010101
#00112:01010101
#00113:01010101
#00114:01010101
#00115:01010101

#00211:01010101
#00212:01010101
#00213:01010101
#00214:01010101
#00215:01010101`;
