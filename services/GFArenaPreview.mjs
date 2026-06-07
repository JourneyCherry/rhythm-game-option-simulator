// 기타도라 GF 아레나 렌더러
// 프로파일·로직 모두 이 파일에서 관리한다.
// 로직은 GFKonasutePreview.mjs와 거의 동일하며, 아레나 모델의 실측값/차이점만 반영했다.
//
// 코나스테와의 주요 차이점:
//  1. 해상도 3840×2160 (코나스테는 1920×1080)
//  2. 레인 좌우 얇은 프레임·프레이즈 프레임 없음. 체력바 HUD 패널이 약 2배 넓음.
//  3. Normal 옵션 실측값 없음 → Reverse 기준 추정 + TODO
//  4. 배속 0.5~20, 0.25 단위 (10 다음은 바로 20)
//  5. 노트 속도 (3.0 + 6×배속) px/frame, 판정선/서든/히든 변동량이 코나스테와 다름

import * as BMSParser from "./BMSParser.mjs";

const PROFILE = {
    width: 3840,
    height: 2160,

    // 레인 영역 (절대 픽셀 좌표) — 실측
    // 레인 너비: 1560 ~ 2142(웨일링 경계) ~ 2277
    laneLeft: 1560,
    buttonRight: 2142, // 5버튼 영역 우측 경계 (= 웨일링 경계)
    wailingRight: 2277, // 웨일링 영역 우측 경계
    // 레인 높이: 201 ~ 312(노트 등장) ~ 2160
    laneTop: 201,
    noteSpawnYReverse: 312, // Reverse 기준 노트 최초 등장(첫 노출) Y — 실측
    noteSpawnYNormal: 1997, // TODO: Normal 실측값 없음 — 추정값 (judgeLineYNormal 주석의 대칭축 근거, 2×1154.4−312)

    laneBottom: 2160,

    // 판정선 — Reverse는 실측.
    judgeLineYReverse: 1852, // judgelinePosition=0 기준 Y
    // TODO: Normal 실측값 없음 — 추정값.
    //   코나스테 Reverse↔Normal 대칭축(판정선 (233+926)/2=579.5, 노트등장 (156+1001)/2=578.5로 거의 일치)이
    //   레인 높이의 (579-104)/(1080-104) ≈ 0.4867 지점인 데 착안, 같은 비율을 아레나 레인(201~2160)에
    //   적용한 축 ≈ 1154.4(=201+0.4867×1959) 기준 반사값. 2×1154.4−1852 ≈ 457.
    judgeLineYNormal: 457,
    judgeLineThickness: 15, // 판정선 외부 높이 (px) — 실측
    judgeLineStrokeWidth: 3, // 판정선 테두리 두께 (px) — 추정

    // 판정선 위치 조절 (judgelinePosition 옵션). 변동량이 비선형이라 getJudgelineOffsetPx로 계산.
    //  0~100 구간: 1당 3px / -50~0 & 100~150 구간: 1당 2px
    // 양수 = 노트 등장 방향 (Reverse: 위, Normal: 아래)

    // 커버 (value=0이면 표시 안 함). 다른 옵션과 무관, 옵션값만으로 일차함수로 결정.
    // 코나스테와 달리 서든·히든의 1당 변동량이 다르다.
    suddenBaseY: 36, // 서든 경계 기준 Y (Reverse: 화면 최상단~경계를 가림) — 실측
    suddenPerUnit: 21.23, // 서든 옵션값 1당 경계 이동 픽셀 — 실측
    hiddenBaseY: 2012.12, // 히든 경계 기준 Y (Reverse: 경계~화면 최하단을 가림) — 실측
    hiddenPerUnit: 20.12, // 히든 옵션값 1당 경계 이동 픽셀 — 실측

    // 게임 프레임레이트. px/frame ↔ px/sec 변환 및 오프셋 프레임 해석의 기준.
    fps: 60,

    // 노트 속도: (speedBase + speedPerUnit * speed) px/frame at fps — 실측
    speedBase: 3.0,
    speedPerUnit: 6,

    // 타이밍 오프셋 (단위: 프레임 @fps)
    // noteOffset 1단위 = 실제로 0.4프레임 더 늦게 쳐야 함
    offsetPerUnitFrames: 0.4,
    baseNoteOffset: 10, // 기본 노트 표시 타이밍 (옵션 단위). noteOffset에 항상 더해짐. 10 × 0.4 = 4프레임 당김.

    // ── HUD (옵션과 무관한 고정 구조. 값은 임시 추정치, 추후 실측 보정 예정) ──
    // 아레나는 레인 좌우 얇은 프레임과 프레이즈 프레임이 없다(다른 옵션에서 다른 위치에 표시되므로 생략).
    // 체력바가 있는 상단 HUD 패널만 그리며, 코나스테보다 약 2배 넓다.

    hudPanelWidthScale: 2, // 레인 너비 대비 HUD 패널 너비 배율 — 추정
    hudPanelRadius: 28, // 하단 모서리 둥글기 반지름 (px)
    hudPanelColor: "#1a2030",
    hudPanelBorderColor: "#556677",
    hudPanelBorderWidth: 4,

    // HUD 내부 여백
    hudInnerPadX: 32, // 패널 좌/우 안쪽 여백
    hudInnerGap: 32, // 배속 박스와 체력바 사이 간격

    // 배속 표기 정사각형 (HUD 내부 좌측)
    hudSpeedBoxSize: 88, // 정사각형 한 변 (px)
    hudSpeedBoxColor: "#0a0a14",
    hudSpeedBoxBorderColor: "#778899",
    hudSpeedBoxBorderWidth: 4,
    hudSpeedFontColor: "#ffffff",
    hudSpeedFontSize: 40, // 배속 숫자 폰트 크기 (px)

    // 체력바 (배속 박스 오른쪽, 패널 오른쪽 안쪽 여백까지 채움)
    hudHpBarHeight: 56, // 막대 높이 (px)
    hudHpBarBgColor: "#222a38",
    hudHpBarColorFull: "#ff8800", // 100%
    hudHpBarColorPartial: "#3388ff", // 100% 미만
    hudHpRatio: 1, // 표시용 체력 비율(0~1). 옵션 무관 고정값(현재 만피).

    // 배경
    bgColor: "#0a0a14", // 화면 전체 배경
    laneBgColor: "#111120", // 레인 영역 배경

    // 레인 세로 구분선
    laneDividerColor: "#334455", // 버튼 사이 얇은 세로 구분선
    laneDividerWidth: 2,
    buttonDividerColor: "#556677", // 5버튼 영역과 웨일링 영역 사이 굵은 세로선
    buttonDividerWidth: 4,

    // 박자선/마디선 (가로)
    barLineColor: "#8899aa", // 마디선 (TEST_MEASURE_BEATS박마다)
    barLineWidth: 4,
    beatLineColor: "#334455", // 박자선
    beatLineWidth: 2,

    // 판정선 색
    judgeLineColor: "#ffcc00",

    // 노트 테두리
    noteBorderColor: "rgba(255,255,255,0.4)",
    noteBorderWidth: 2,

    // 웨일링 화살표 기하 (px) — 추정
    wailingArrowHeight: 80, // 전체 높이
    wailingArrowHeadHeight: 50, // 화살촉 높이
    wailingArrowHeadHalfWidth: 44, // 화살촉 반폭
    wailingArrowShaftHalfWidth: 14, // 몸통 반폭
    wailingArrowBorderWidth: 4, // 테두리 두께

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

// 판정선 위치 옵션(judgelinePosition) → 이동 픽셀(절대값, 부호 포함).
// 변동량이 비선형이다: 0~100 구간은 1당 3px, 그 바깥(-50~0, 100~150)은 1당 2px.
function getJudgelineOffsetPx(pos) {
    if (pos > 100) return 100 * 3 + (pos - 100) * 2;
    if (pos < 0) return pos * 2;
    return pos * 3;
}

// 표시(노란) 판정선 Y 좌표 — judgelinePosition만 반영한다.
// noteOffset/judgeOffset(타이밍 오프셋)에는 영향받지 않는다. drawJudgeLine 전용.
// judgelinePosition > 0 → 노트 등장 방향으로 이동 (Reverse: 위, Normal: 아래)
function getVisualJudgeLineY(cfg) {
    const pos = cfg.judgelinePosition ?? 0;
    const posOffsetPx = getJudgelineOffsetPx(pos);

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
// 판정선·타이밍 등 다른 옵션엔 영향받지 않는다. (코나스테와 달리 서든/히든 가변량이 다름)
// 가리는 방향은 노트 등장 방향(direction)에 따라 바뀐다:
// Normal에서는 서든이 하단(Reverse 히든), 히든이 상단(Reverse 서든)을 가린다.
// draw()에서 마지막에 호출되어 노트·박자선·판정선을 모두 덮는다.
function drawCovers(ctx) {
    if (_config.sudden <= 0 && _config.hidden <= 0) return;

    const {
        laneLeft,
        wailingRight,
        height,
        suddenBaseY,
        suddenPerUnit,
        hiddenBaseY,
        hiddenPerUnit,
    } = PROFILE;
    const laneWidth = wailingRight - laneLeft;

    ctx.fillStyle = "rgba(0, 0, 0, 1)";

    // 상단 가림: 화면 최상단(Y=0) ~ 경계. 경계 = suddenBaseY + suddenPerUnit × 옵션값.
    const drawTopCover = (value) => {
        const coverBottom = suddenBaseY + suddenPerUnit * value;
        ctx.fillRect(laneLeft, 0, laneWidth, coverBottom);
    };
    // 하단 가림: 경계 ~ 화면 최하단(Y=height). 경계 = hiddenBaseY − hiddenPerUnit × 옵션값.
    const drawBottomCover = (value) => {
        const coverTop = hiddenBaseY - hiddenPerUnit * value;
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

// 고정 HUD 그리기.
// 아레나는 레인 좌우 얇은 프레임·프레이즈 프레임이 없으므로 상단 HUD 패널만 그린다.
// 패널은 레인 너비보다 약 2배 넓고 레인 중심에 맞춰 배치된다.
// 옵션에 따라 (서든/히든에) 가려질 수는 있으나 그 위치·형태는 변하지 않는다.
// 모든 시각 요소 위(가장 나중)에 그려져 게임 UI 크롬 역할을 한다.
function drawFrame(ctx) {
    const {
        laneLeft,
        wailingRight,
        laneTop,
        hudPanelWidthScale,
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

    // 상단 HUD 패널 — 화면 최상단(Y=0)~레인 시작(laneTop). 레인 중심 기준 약 2배 너비.
    const laneCenter = (laneLeft + wailingRight) / 2;
    const panelWidth = (wailingRight - laneLeft) * hudPanelWidthScale;
    const panelLeft = laneCenter - panelWidth / 2;
    const panelRight = laneCenter + panelWidth / 2;
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
    const speedBoxY = (panelHeight - hudSpeedBoxSize) / 2;
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
// NOTE: Normal 모드 기하는 실측값이 아니므로(TODO) Normal 분석값도 추정치다.
export function getAnalysis(cfg, monitorMetrics) {
    const speed_pps = getSpeedPps(cfg);
    const spawnY = getNoteSpawnY(cfg);

    // 사라지는 기준선: 표시(노란) 판정선.
    const judgeY = getVisualJudgeLineY(cfg);

    const sudden = cfg.sudden ?? 0;
    const hidden = cfg.hidden ?? 0;

    // 커버 경계 — drawCovers와 동일 공식 (서든/히든 가변량이 다름).
    const topCoverEdge = (v) => PROFILE.suddenBaseY + PROFILE.suddenPerUnit * v;
    const bottomCoverEdge = (v) =>
        PROFILE.hiddenBaseY - PROFILE.hiddenPerUnit * v;

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
        appearY = sudden > 0 ? Math.min(spawnY, bottomCoverEdge(sudden)) : spawnY;
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

export const DEFAULT_BMS = `#BPM 120
#PLAYER 1
#TITLE GF Test Pattern
#ARTIST -

*-- 2마디 4/4. 루프(곡 완주 후 재시작)를 눈으로 확인할 수 있게 지그재그(1→2→3→4→5→4→3→2) 패턴.
*-- 11~15 = 5버튼(R/G/B/Y/P), 16 = 웨일링↑, 17 = 웨일링↓, 18 = 프레이즈 경계(각 노트 = 그 프레이즈의 끝).
*-- (16/17/18은 표준 BMS의 스크래치/페달/key6이나 GF엔 없어 전용 사용)
*-- 프레이즈 끝 1000·2000·3750ms → 3 프레이즈. 마지막(3750)은 마지막 게임플레이 노트(3500)보다 뒤,
*-- 그 마디 끝(4000ms)이 곡 끝 = 루프 지점.

*-- 마디 0: beat0=1, beat1=2, beat2=3, beat3=4
#00011:01000000
#00012:00010000
#00013:00000100
#00014:00000001
#00016:01000000
#00018:00000100

*-- 마디 1: beat0=5, beat1=4, beat2=3, beat3=2
#00115:01000000
#00114:00010000
#00113:00000100
#00112:00000001
#00117:01000000
#00118:0100000000000001`;
