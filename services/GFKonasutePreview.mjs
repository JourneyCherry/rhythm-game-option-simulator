// 기타도라 GF 코나스테 렌더러
// 프로파일·로직 모두 이 파일에서 관리한다.

import * as BMSParser from "./BMSParser.mjs";

const PROFILE = {
    width: 1920,
    height: 1080,

    // 레인 영역 (절대 픽셀 좌표)
    laneLeft: 780,
    buttonRight: 1071, // 5버튼 영역 우측 경계
    wailingRight: 1138.5, // 웨일링 영역 우측 경계
    laneTop: 104,
    noteSpawnYReverse: 156, // Reverse 기준 노트 최초 등장(첫 노출) Y
    noteSpawnYNormal: 1001, // Normal 기준 노트 최초 등장(첫 노출) Y
    laneBottom: 1080,

    // 판정선
    judgeLineYReverse: 926, // Reverse 기준 판정선 Y
    judgeLineYNormal: 233, // Normal 기준 판정선 Y
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

    // ── 프레임/HUD (옵션과 무관한 고정 구조. 값은 임시 추정치, 추후 실측 보정 예정) ──

    // 레인 좌우 얇은 프레임 (레인 세로 전체 길이만큼 laneTop~laneBottom)
    laneFrameThickness: 12, // 좌우 얇은 프레임 두께 (px)
    laneFrameColor: "#3a4a5a",

    // 프레이즈 표시용 프레임 (우측 얇은 프레임 바로 오른쪽, 훨씬 두꺼움).
    // 화면 최상단(Y=0)~laneBottom까지 걸쳐 있다(실제 프레이즈 표시는 레인 영역 부근).
    phraseFrameThickness: 112, // 두꺼운 세로 프레임 두께 (px)
    phraseFrameColor: "#2a3340",

    // 상단 HUD 패널. 화면 최상단(Y=0)~레인 시작(laneTop)에 빈틈없이 붙는다.
    // 좌우 너비는 레인 양옆 프레임 바깥 경계까지만(프레이즈 프레임은 포함 안 함).
    // 상단 테두리선은 그리지 않고(화면 최상단에 붙음), 레인과 맞닿는 하단 두 꼭짓점만 둥글다.
    hudPanelRadius: 14, // 하단 모서리 둥글기 반지름 (px)
    hudPanelColor: "#1a2030",
    hudPanelBorderColor: "#556677",
    hudPanelBorderWidth: 2,

    // HUD 내부 여백
    hudInnerPadX: 16, // 패널 좌/우 안쪽 여백
    hudInnerGap: 16, // 배속 박스와 체력바 사이 간격

    // 배속 표기 정사각형 (HUD 내부 좌측)
    hudSpeedBoxSize: 44, // 정사각형 한 변 (px)
    hudSpeedBoxColor: "#0a0a14",
    hudSpeedBoxBorderColor: "#778899",
    hudSpeedBoxBorderWidth: 2,
    hudSpeedFontColor: "#ffffff",
    hudSpeedFontSize: 22, // 배속 숫자 폰트 크기 (px)

    // 체력바 (배속 박스 오른쪽, 패널 오른쪽 안쪽 여백까지 채움)
    hudHpBarHeight: 28, // 막대 높이 (px)
    hudHpBarBgColor: "#222a38",
    hudHpBarColorFull: "#ff8800", // 100%
    hudHpBarColorPartial: "#3388ff", // 100% 미만
    hudHpRatio: 1, // 표시용 체력 비율(0~1). 옵션 무관 고정값(현재 만피).

    // 배경
    bgColor: "#0a0a14", // 화면 전체 배경
    laneBgColor: "#111120", // 레인 영역 배경

    // 레인 세로 구분선
    laneDividerColor: "#334455", // 버튼 사이 얇은 세로 구분선
    laneDividerWidth: 1,
    buttonDividerColor: "#556677", // 5버튼 영역과 웨일링 영역 사이 굵은 세로선
    buttonDividerWidth: 2,

    // 박자선/마디선 (가로)
    barLineColor: "#8899aa", // 마디선 (TEST_MEASURE_BEATS박마다)
    barLineWidth: 2,
    beatLineColor: "#334455", // 박자선
    beatLineWidth: 1,

    // 판정선 색
    judgeLineColor: "#ffcc00",

    // 노트 테두리
    noteBorderColor: "rgba(255,255,255,0.4)",
    noteBorderWidth: 1,

    // 웨일링 화살표 기하 (px)
    wailingArrowHeight: 40, // 전체 높이
    wailingArrowHeadHeight: 25, // 화살촉 높이
    wailingArrowHeadHalfWidth: 22, // 화살촉 반폭
    wailingArrowShaftHalfWidth: 7, // 몸통 반폭
    wailingArrowBorderWidth: 2, // 테두리 두께

    // 노트 색상 [index 0 미사용, 1~5 = 라인 1~5]
    noteColors: [null, "#ff4444", "#44ff44", "#4444ff", "#ffff44", "#ff44ff"],
    wailingColor: "#ff4444",
    wailingBorderColor: "#ffffff",
};

// ---- 노트 레인 해석 ----
// BMS 채널 둘째 자리 = 레인 번호. 이 렌더러는 레인 1~5를 5버튼 노트로,
// 6/7을 웨일링↑/↓, 8을 프레이즈 경계로 해석하고 그 외 레인은 무시(버림)한다.
// 스크립트에 없는 레인은 빈 레인으로 둔다(노트가 내려오지 않음).
const BUTTON_COUNT = 5; // 5버튼 = 레인 1~5
const WAILING_LANE_UP = 6; // 채널 16
const WAILING_LANE_DOWN = 7; // 채널 17
const PHRASE_LANE = 8; // 채널 18 — 프레이즈(달성률 구간) 경계. 화면엔 안 그림.

// 고정 BMS(DEFAULT_BMS)를 파싱한다. 실패 시 빈 차트로 폴백.
function loadChart() {
    const parsed = BMSParser.parse(DEFAULT_BMS);
    if (parsed.ok) return parsed;
    return {
        notes: [],
        cycle: { measureCount: 0, timeMs: 1 },
        timing: { initialBpm: 120, bpmEvents: [], measures: [] },
    };
}

// 프레이즈(기타도라 달성률 구간) 경계 계산.
// 곡을 n등분한 구간이며 구간 사이 빈 곳은 없다. PHRASE_LANE 노트 = 각 프레이즈의 "끝".
// BMS는 노트 외 사운드(BGM 등)가 있어 스크립트만으론 실제 곡 끝을 알 수 없으므로,
// 마지막 프레이즈 노트가 곡 끝을 정의한다(그 노트가 든 마디의 끝 = 곡 끝 = 루프 지점 = cycle.timeMs).
// 따라서 프레이즈 수 = 프레이즈 노트 수. 첫 프레이즈는 곡 시작(0)부터 시작한다.
// (마지막 프레이즈 노트는 모든 게임플레이 노트보다 뒤여야 한다 — 스크립트 작성 규칙.)
function computePhrases(chart) {
    const ends = chart.notes
        .filter((n) => n.lane === PHRASE_LANE && n.timeMs > 0)
        .map((n) => n.timeMs)
        .sort((a, b) => a - b);
    const bounds = [0, ...ends];
    const phrases = [];
    for (let i = 0; i + 1 < bounds.length; i++) {
        phrases.push({ startMs: bounds[i], endMs: bounds[i + 1] });
    }
    return phrases;
}

// ---- 모듈 상태 ----

let _canvas = null;
let _config = null;
let _running = false;
let _songTime = 0;
let _lastFrameTime = 0;
let _chart = null; // 파싱된 BMS 차트 (notes, cycle, timing)
let _phrases = []; // 프레이즈 경계 구간 [{ startMs, endMs }, ...]

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
        // Normal: 옵션값이 커질수록 아래로 내려감 (Y 증가). 변동량·범위는 Reverse와 동일.
        return PROFILE.judgeLineYNormal + posOffsetPx;
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

// 노트 등장 마스크 경계 Y — 이 픽셀이 첫 노출 위치이며, 그 너머(진입 가장자리 쪽)가 가려진다.
// Reverse: 레인 상단~이 선 직전 가림. Normal: 이 선 직후~레인 하단 가림.
function getNoteSpawnY(cfg) {
    return cfg.direction === 1
        ? PROFILE.noteSpawnYReverse
        : PROFILE.noteSpawnYNormal;
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
        bgColor,
        laneBgColor,
        laneDividerColor,
        laneDividerWidth,
        buttonDividerColor,
        buttonDividerWidth,
    } = PROFILE;
    const buttonWidth = (buttonRight - laneLeft) / BUTTON_COUNT;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = laneBgColor;
    ctx.fillRect(
        laneLeft,
        laneTop,
        wailingRight - laneLeft,
        laneBottom - laneTop,
    );

    ctx.strokeStyle = laneDividerColor;
    ctx.lineWidth = laneDividerWidth;
    for (let i = 1; i < BUTTON_COUNT; i++) {
        const x = laneLeft + i * buttonWidth;
        ctx.beginPath();
        ctx.moveTo(x, laneTop);
        ctx.lineTo(x, laneBottom);
        ctx.stroke();
    }

    ctx.strokeStyle = buttonDividerColor;
    ctx.lineWidth = buttonDividerWidth;
    ctx.beginPath();
    ctx.moveTo(buttonRight, laneTop);
    ctx.lineTo(buttonRight, laneBottom);
    ctx.stroke();
}

function drawBeatLines(ctx, songTime) {
    const {
        laneLeft,
        wailingRight,
        laneTop,
        laneBottom,
        barLineColor,
        barLineWidth,
        beatLineColor,
        beatLineWidth,
    } = PROFILE;
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

    // 박자/마디선은 파싱된 BPM·마디 길이에서 도출한다.
    // (현재 고정 스크립트는 단일 BPM·균일 4/4 — 첫 마디 박자수를 기준으로 삼는다.
    //  변속·가변 마디 길이의 정밀 처리는 추후 과제.)
    const beatDur = 60 / _chart.timing.initialBpm;
    const measureBeats = _chart.timing.measures[0]?.beats ?? 4;
    const cycleSec = _chart.cycle.timeMs / 1000;

    const firstBeatIdx = Math.ceil(tMin / beatDur);
    const lastBeatIdx = Math.floor(tMax / beatDur);

    for (let bi = firstBeatIdx; bi <= lastBeatIdx; bi++) {
        const t = bi * beatDur;
        // 한 사이클([0, cycle))의 박자/마디선만 그린다(다음 사이클 미리 그리지 않음).
        if (t < 0 || t >= cycleSec) continue;
        const y = getNoteY(judgeLineY, dir, t, songTime, speed_pps);
        if (y < laneTop || y > laneBottom) continue;

        const isBar = bi % measureBeats === 0;
        ctx.strokeStyle = isBar ? barLineColor : beatLineColor;
        ctx.lineWidth = isBar ? barLineWidth : beatLineWidth;
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
        noteBorderColor,
        noteBorderWidth,
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

    // 한 사이클(현재 재생 중인 곡)의 노트만 그린다. 인접 사이클을 미리 그리지 않으므로
    // 곡이 끝나기 전에 다음 사이클 노트가 등장하지 않는다(루프는 loop()가 songTime 되감기로 처리).
    for (const note of _chart.notes) {
        const t = note.timeMs / 1000;
        if (t < tMin || t > tMax) continue;
        if (t < songTime) continue;

        const y = getNoteY(judgeLineY, dir, t, songTime, speed_pps);
        if (y < laneTop || y > laneBottom) continue;

        const lane = note.lane;
        if (lane >= 1 && lane <= BUTTON_COUNT) {
            const x = laneLeft + (lane - 1) * buttonWidth;
            const ny = y - noteH / 2;
            ctx.fillStyle = noteColors[lane];
            ctx.fillRect(x, ny, buttonWidth, noteH);
            ctx.strokeStyle = noteBorderColor;
            ctx.lineWidth = noteBorderWidth;
            ctx.strokeRect(x + 0.5, ny + 0.5, buttonWidth - 1, noteH - 1);
        } else if (lane === WAILING_LANE_UP || lane === WAILING_LANE_DOWN) {
            drawWailingArrow(
                ctx,
                buttonRight,
                wailingWidth,
                y,
                lane === WAILING_LANE_UP ? "up" : "down",
                wailingColor,
                wailingBorderColor,
            );
        }
        // 그 외 레인: 이 렌더러가 사용하지 않음 → 버림
    }
}

function drawWailingArrow(ctx, wx, ww, y, dir, fillColor, strokeColor) {
    const totalH = PROFILE.wailingArrowHeight;
    const headH = PROFILE.wailingArrowHeadHeight;
    const headHW = PROFILE.wailingArrowHeadHalfWidth;
    const shaftHW = PROFILE.wailingArrowShaftHalfWidth;
    const cx = wx + ww / 2;
    const ah = totalH / 2;

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = PROFILE.wailingArrowBorderWidth;
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
    const {
        laneLeft,
        wailingRight,
        judgeLineThickness,
        judgeLineStrokeWidth,
        judgeLineColor,
    } = PROFILE;
    const y = getVisualJudgeLineY(_config);
    const w = wailingRight - laneLeft;
    const h = judgeLineThickness;
    const lw = judgeLineStrokeWidth;

    // strokeRect는 선 중앙이 좌표 위에 오므로 lw/2 안쪽으로 inset
    ctx.strokeStyle = judgeLineColor;
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
        // Reverse: 레인 상단 ~ spawnY 직전 구간을 가림 (spawnY가 첫 노출 픽셀)
        ctx.rect(laneLeft, laneTop, laneWidth, spawnY - laneTop);
    } else {
        // Normal: spawnY 직후 ~ 레인 하단 구간을 가림 (spawnY가 첫 노출 픽셀)
        ctx.rect(laneLeft, spawnY + 1, laneWidth, laneBottom - spawnY);
    }
    ctx.clip();
    drawBackground(ctx);
    ctx.restore();
}

// 서든/히든 가림막.
// 경계 위치는 자신의 옵션값만으로 "기준 위치 + 가변량 × 옵션값"의 일차함수로 정해지며,
// 판정선·타이밍 등 다른 옵션엔 영향받지 않는다.
// 단, 가리는 방향은 노트 등장 방향(direction)에 따라 바뀐다:
// Normal에서는 서든이 하단(Reverse 히든), 히든이 상단(Reverse 서든)을 가린다.
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

    // 상단 가림: 화면 최상단(Y=0) ~ 경계. 경계 = suddenBaseY + coverPerUnit × 옵션값.
    const drawTopCover = (value) => {
        const coverBottom = suddenBaseY + coverPerUnit * value;
        ctx.fillRect(laneLeft, 0, laneWidth, coverBottom);
    };
    // 하단 가림: 경계 ~ 화면 최하단(Y=height). 경계 = hiddenBaseY − coverPerUnit × 옵션값.
    const drawBottomCover = (value) => {
        const coverTop = hiddenBaseY - coverPerUnit * value;
        ctx.fillRect(laneLeft, coverTop, laneWidth, height - coverTop);
    };

    if (_config.direction === 1) {
        // Reverse: 노트가 위에서 등장 → 서든=상단 가림, 히든=하단 가림.
        if (_config.sudden > 0) drawTopCover(_config.sudden);
        if (_config.hidden > 0) drawBottomCover(_config.hidden);
    } else {
        // Normal: 노트가 아래에서 등장 →
        // 서든은 Reverse 히든처럼 하단을, 히든은 Reverse 서든처럼 상단을 가린다.
        if (_config.sudden > 0) drawBottomCover(_config.sudden);
        if (_config.hidden > 0) drawTopCover(_config.hidden);
    }
}

// 고정 프레임/HUD 그리기.
// 옵션에 따라 (서든/히든에) 가려질 수는 있으나 그 위치·형태는 변하지 않는다.
// 모든 시각 요소 위(가장 나중)에 그려져 게임 UI 크롬 역할을 한다.
function drawFrame(ctx) {
    const {
        height,
        laneLeft,
        wailingRight,
        laneTop,
        laneFrameThickness,
        laneFrameColor,
        phraseFrameThickness,
        phraseFrameColor,
        hudPanelRadius,
        hudPanelColor,
        hudPanelBorderColor,
        hudPanelBorderWidth,
        hudInnerPadX,
        hudInnerGap,
        hudSpeedBoxSize,
        hudSpeedBoxColor,
        hudSpeedBoxBorderColor,
        hudSpeedBoxBorderWidth,
        hudSpeedFontColor,
        hudSpeedFontSize,
        hudHpBarHeight,
        hudHpBarBgColor,
        hudHpBarColorFull,
        hudHpBarColorPartial,
        hudHpRatio,
    } = PROFILE;

    // 레인 좌우 얇은 프레임 — 화면 최상단(Y=0)~최하단(height)까지.
    // 상단 HUD 패널에 가려지는 구간은 패널 하단 굴곡 사이로 자연스럽게 비친다.
    ctx.fillStyle = laneFrameColor;
    ctx.fillRect(laneLeft - laneFrameThickness, 0, laneFrameThickness, height);
    ctx.fillRect(wailingRight, 0, laneFrameThickness, height);

    // 우측 얇은 프레임 바로 오른쪽의 두꺼운 프레이즈 프레임.
    // 화면 최상단(Y=0)~최하단(height)까지 걸쳐 있다.
    ctx.fillStyle = phraseFrameColor;
    ctx.fillRect(
        wailingRight + laneFrameThickness,
        0,
        phraseFrameThickness,
        height,
    );

    // 상단 HUD 패널 — 화면 최상단(Y=0)~레인 시작(laneTop)에 빈틈없이 붙는다.
    // 좌우 너비는 레인 양옆 프레임 바깥 경계까지(프레이즈 프레임 미포함).
    const panelLeft = laneLeft - laneFrameThickness;
    const panelRight = wailingRight + laneFrameThickness;
    const panelTop = 0;
    const panelHeight = laneTop; // panelTop(0) ~ laneTop
    ctx.beginPath();
    ctx.roundRect(panelLeft, panelTop, panelRight - panelLeft, panelHeight, [
        0,
        0,
        hudPanelRadius,
        hudPanelRadius,
    ]);
    ctx.fillStyle = hudPanelColor;
    ctx.fill();

    // 테두리는 상단변을 제외하고(화면 최상단에 붙음) 좌·하(둥근)·우 변만 그린다.
    const panelBottom = panelTop + panelHeight;
    ctx.beginPath();
    ctx.moveTo(panelLeft, panelTop);
    ctx.lineTo(panelLeft, panelBottom - hudPanelRadius);
    ctx.arcTo(
        panelLeft,
        panelBottom,
        panelLeft + hudPanelRadius,
        panelBottom,
        hudPanelRadius,
    );
    ctx.lineTo(panelRight - hudPanelRadius, panelBottom);
    ctx.arcTo(
        panelRight,
        panelBottom,
        panelRight,
        panelBottom - hudPanelRadius,
        hudPanelRadius,
    );
    ctx.lineTo(panelRight, panelTop);
    ctx.strokeStyle = hudPanelBorderColor;
    ctx.lineWidth = hudPanelBorderWidth;
    ctx.stroke();

    // HUD 내부 좌측: 배속 표기 정사각형 (+ 현재 배속 숫자)
    const speedBoxX = panelLeft + hudInnerPadX;
    const speedBoxY = panelHeight / 2;
    ctx.fillStyle = hudSpeedBoxColor;
    ctx.fillRect(speedBoxX, speedBoxY, hudSpeedBoxSize, hudSpeedBoxSize);
    ctx.strokeStyle = hudSpeedBoxBorderColor;
    ctx.lineWidth = hudSpeedBoxBorderWidth;
    ctx.strokeRect(speedBoxX, speedBoxY, hudSpeedBoxSize, hudSpeedBoxSize);

    ctx.fillStyle = hudSpeedFontColor;
    ctx.font = `bold ${hudSpeedFontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
        String(_config.speed ?? ""),
        speedBoxX + hudSpeedBoxSize / 2,
        speedBoxY + hudSpeedBoxSize / 2,
    );
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // HUD 내부 우측: 체력바 (배속 박스 오른쪽 ~ 패널 우측 안쪽 여백)
    const hpBarX = speedBoxX + hudSpeedBoxSize + hudInnerGap;
    const hpBarY = speedBoxY + (hudSpeedBoxSize - hudHpBarHeight) / 2;
    const hpBarW = panelRight - hudInnerPadX - hpBarX;
    const ratio = Math.max(0, Math.min(1, hudHpRatio));
    ctx.fillStyle = hudHpBarBgColor;
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hudHpBarHeight);
    ctx.fillStyle = ratio >= 1 ? hudHpBarColorFull : hudHpBarColorPartial;
    ctx.fillRect(hpBarX, hpBarY, hpBarW * ratio, hudHpBarHeight);
}

// ---- 메인 드로우 / 루프 ----

// 사이클 시작 songTime(초). 음수 = 리드인: 첫 노트가 레인 맨 위에서 등장해
// 판정선까지 내려오는 시간만큼 앞당겨 시작한다(노트가 위에서 새로 내려오는 느낌).
// = 노트가 등장 가장자리에서 판정선까지 이동하는 시간(tMaxOff).
function getCycleStartTime() {
    const speed_pps = getSpeedPps(_config);
    const judgeLineY = getInternalJudgeLineY(_config);
    const [, tMaxOff] = getVisibleTimeOffsets(
        judgeLineY,
        _config.direction,
        speed_pps,
        PROFILE.laneTop,
        PROFILE.laneBottom,
    );
    return -Math.max(0, tMaxOff);
}

// 현재 사이클의 시각 요소가 화면에서 모두 빠졌는지. 노트는 판정선에서 사라지므로
// 곡 끝(cycle) 이후엔 박자선만 가장자리로 빠지면 화면이 빈다 — 그 박자선 잔류를 검사한다.
function isFieldEmpty(songTime) {
    const speed_pps = getSpeedPps(_config);
    const judgeLineY = getInternalJudgeLineY(_config);
    const dir = _config.direction;
    const { laneTop, laneBottom } = PROFILE;
    const beatDur = 60 / _chart.timing.initialBpm;
    const cycleSec = _chart.cycle.timeMs / 1000;
    for (let t = 0; t < cycleSec; t += beatDur) {
        const y = getNoteY(judgeLineY, dir, t, songTime, speed_pps);
        if (y >= laneTop && y <= laneBottom) return false;
    }
    return true;
}

function draw() {
    if (!_canvas || !_config || !_chart) return;
    const ctx = _canvas.getContext("2d");
    drawBackground(ctx);
    drawBeatLines(ctx, _songTime);
    drawNotes(ctx, _songTime);
    drawNoteSpawnMask(ctx);
    drawCovers(ctx);
    drawJudgeLine(ctx);
    drawFrame(ctx);
}

function loop(now) {
    if (!_running) return;
    const dt = (now - _lastFrameTime) / 1000;
    _lastFrameTime = now;
    _songTime += dt;
    // 곡 끝(cycle)을 지나 화면이 완전히 빈 뒤 리드인 지점으로 되감아 재시작한다.
    // → 다음 사이클 노트가 현재 사이클이 끝나기 전에 등장하지 않는다.
    const cycleSec = _chart.cycle.timeMs / 1000;
    if (cycleSec > 0 && _songTime >= cycleSec && isFieldEmpty(_songTime)) {
        _songTime = getCycleStartTime();
    }
    draw();
    requestAnimationFrame(loop);
}

// ---- 분석 수치 계산 ----

// 노트 속도(cm/s) — 내부 px/s를 모니터 물리 길이로 환산한다.
// 게임 화면(16:9)을 비율 유지하며 모니터에 꽉 채운다고 가정:
// 모니터가 게임보다 가로로 길면 세로 기준, 세로로 길면 가로 기준으로 맞춘다.
// metrics({ pixelPitchMm, widthPx, heightPx })가 없거나 부족하면 null.
function computeNoteSpeedCmPerSec(speed_pps, metrics) {
    if (
        !metrics ||
        !metrics.pixelPitchMm ||
        !metrics.widthPx ||
        !metrics.heightPx
    ) {
        return null;
    }
    const { pixelPitchMm, widthPx, heightPx } = metrics;
    const monitorWidthMm = widthPx * pixelPitchMm;
    const monitorHeightMm = heightPx * pixelPitchMm;
    const gameAspect = PROFILE.width / PROFILE.height; // 16:9

    // 모니터 화면비가 게임보다 넓으면(>=) 세로에 맞춤, 좁으면(세로가 길면) 가로에 맞춤.
    const monitorAspect = widthPx / heightPx;
    const gameDisplayHeightMm =
        monitorAspect >= gameAspect
            ? monitorHeightMm
            : monitorWidthMm / gameAspect;

    const mmPerPx = gameDisplayHeightMm / PROFILE.height; // 내부 1px(세로)당 실제 mm
    const mmPerSec = speed_pps * mmPerPx;
    return mmPerSec / 10; // mm → cm
}

// 분석 수치 계산. 프리뷰 기하를 그대로 사용하므로 모든 옵션 변화가 즉시 반영된다.
// monitorMetrics: { pixelPitchMm, widthPx, heightPx } | null
//   - displayTimeMs: 모니터와 무관(시간 단위)하게 항상 계산.
//   - noteSpeedCmPerSec: 모니터 미설정 시 null.
export function getAnalysis(cfg, monitorMetrics) {
    const speed_pps = getSpeedPps(cfg);
    const spawnY = getNoteSpawnY(cfg);

    // 사라지는 기준선: 표시(노란) 판정선.
    // TODO: 정확한 타이밍 기준을 내부 판정선(getInternalJudgeLineY)으로 할지,
    //       또는 표시선·내부선 둘 다 표기할지 확인 필요.
    const judgeY = getVisualJudgeLineY(cfg);

    const sudden = cfg.sudden ?? 0;
    const hidden = cfg.hidden ?? 0;

    // 커버 경계 — drawCovers와 동일 공식.
    const topCoverEdge = (v) => PROFILE.suddenBaseY + PROFILE.coverPerUnit * v;
    const bottomCoverEdge = (v) =>
        PROFILE.hiddenBaseY - PROFILE.coverPerUnit * v;

    // appearY(처음 보이는 위치): 노트 등장 마스크 + 서든.
    // disappearY(사라지는 위치): 판정선 + 히든(판정선을 덮으면 히든 경계가 우선).
    let appearY, disappearY;
    if (cfg.direction === 1) {
        // Reverse(위→아래): 서든=상단 커버, 히든=하단 커버.
        appearY = sudden > 0 ? Math.max(spawnY, topCoverEdge(sudden)) : spawnY;
        disappearY =
            hidden > 0 ? Math.min(judgeY, bottomCoverEdge(hidden)) : judgeY;
    } else {
        // Normal(아래→위): 서든=하단 커버, 히든=상단 커버.
        appearY =
            sudden > 0 ? Math.min(spawnY, bottomCoverEdge(sudden)) : spawnY;
        disappearY =
            hidden > 0 ? Math.max(judgeY, topCoverEdge(hidden)) : judgeY;
    }

    // 이동 방향 기준 가시 거리. 서든/히든이 반대편 경계를 넘어
    // 노트가 한 번도 보이지 않으면 음수가 되므로 0으로 클램프한다.
    // Reverse: 위→아래(appearY < disappearY), Normal: 아래→위(appearY > disappearY).
    const visibleDistancePx =
        cfg.direction === 1
            ? Math.max(0, disappearY - appearY)
            : Math.max(0, appearY - disappearY);
    const displayTimeMs = Math.round((visibleDistancePx / speed_pps) * 1000);

    const noteSpeedRaw = computeNoteSpeedCmPerSec(speed_pps, monitorMetrics);
    const noteSpeedCmPerSec =
        noteSpeedRaw == null ? null : Math.round(noteSpeedRaw * 10) / 10;

    return { displayTimeMs, noteSpeedCmPerSec };
}

// ---- 공개 API ----

export function init({ canvas, config }) {
    _canvas = canvas;
    _config = config;
    _running = false;
    _chart = loadChart();
    _phrases = computePhrases(_chart);
    _songTime = getCycleStartTime(); // 리드인부터 시작
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
    _songTime = getCycleStartTime();
}

// 프레이즈(달성률 구간) 정보. 향후 판정/달성률 표시 기능에서 사용.
export function getPhraseInfo() {
    return { count: _phrases.length, phrases: _phrases };
}

export const DEFAULT_BMS = `#BPM 175
#PLAYER 1
#TITLE GF Test Pattern
#ARTIST -

*-- 11~15 = 5버튼(R/G/B/Y/P), 16 = 웨일링↑, 17 = 웨일링↓, 18 = 프레이즈 경계(각 노트 = 그 프레이즈의 끝).

*-- 마디 0: beat0=1, beat1=2, beat2=3, beat3=4
#00011:00

#00111:01000000010001010100010001000100
#00112:01000000010001000000010000000000
#00113:00000000000001000000000000000000
#00114:00000000000001000000000000000000
#00115:00000000000001000000000000000000

#00211:01000100010001000100010001000100
#00212:01000000000001000000010000000000
#00213:00000000000000000000000000000000
#00214:00000000000000000000000000000000
#00215:00000000000000000000000000000000

#00311:00000000000000010100000001000000
#00312:01000000010001010100010001000100
#00313:01000000010000010100010001000100
#00314:00000000000000010100000001000000
#00315:00000000000000010100000001000000

#00411:01000000000000000000000000000100
#00412:01000000000001000000000001000000
#00413:01000100010000000000010000000000
#00414:01000001000000000100000000000000
#00415:01000000000000000000000000000000

#00511:00000000000000010100000001000000
#00512:00000000000000010100000001000000
#00513:01000000010001010100010001000100
#00514:01000000010001010100010001000100
#00515:00000000000000010100000001000000
#00518:01000000000000000000000000000000

#00611:01000000000000000000000000000000
#00612:01000000000000000000000001000000
#00613:01000000000001000000010000000000
#00614:01000100010000000100000000000000
#00615:01000001000000000000000000000000

#00711:01010101000000000000000000000000
#00712:00000000010101010000000000000000
#00713:00000000000000000101010100000000
#00714:00000000000000000000000001010101
#00715:00000000000000000000000000000000

#00811:00000000000000000000000000000000
#00812:01010101000000000000000000000000
#00813:00000000010101010000000000000000
#00814:00000000000000000101010100000000
#00815:00000000000000000000000001010101

#00911:00000000000000000000000000000000
#00912:01000000000000000000000000000000
#00913:00000000000000000000000000000000
#00914:01000000000000000000000000000000
#00915:00000000000000000000000000000000
#00918:00000000000000000000000000000000

#01018:01
`;
