// 기타도라 GF 아레나 렌더러
// 프로파일·로직 모두 이 파일에서 관리한다.
// 로직은 GFKonasutePreview.mjs와 거의 동일하며, 아레나 모델의 실측값/차이점만 반영했다.
//
// 코나스테와의 주요 차이점 (구체값은 각 PROFILE 상수·game_presets.json 참고):
//  1. 내부 해상도가 더 큼 (width/height).
//  2. 레인 좌우 얇은 프레임·프레이즈 프레임 없음. 체력바 HUD 패널이 더 넓음.
//  3. Normal 옵션 실측값 없음 → Reverse 기준 추정 + TODO.
//  4. 배속 옵션의 범위·단위가 다름.
//  5. 노트 속도식, 판정선/서든/히든 변동량이 다름.

import * as BMSParser from "./BMSParser.mjs";

const PROFILE = {
    width: 3840,
    height: 2160,

    // 레인 영역 (절대 픽셀 좌표) — 실측
    // 레인 너비: laneLeft ~ buttonRight(웨일링 경계) ~ wailingRight
    laneLeft: 1560,
    buttonRight: 2142, // 5버튼 영역 우측 경계 (= 웨일링 경계)
    wailingRight: 2277, // 웨일링 영역 우측 경계
    // 레인 높이: laneTop ~ noteSpawnYReverse(노트 등장) ~ laneBottom
    laneTop: 201,
    noteSpawnYReverse: 312, // Reverse 기준 노트 최초 등장(첫 노출) Y — 실측
    noteSpawnYNormal: 1997, // TODO: Normal 실측값 없음 — judgeLineYNormal과 같은 대칭축 근거로 역산한 추정값

    laneBottom: 2160,

    // 판정선 — Reverse는 실측.
    judgeLineYReverse: 1852, // judgelinePosition=0 기준 Y
    // TODO: Normal 실측값 없음 — 추정값.
    //   코나스테 Reverse↔Normal 판정선이 레인 높이 내 일정 비율 지점을 대칭축으로 거의 마주보는 데 착안,
    //   같은 비율로 아레나 레인의 대칭축을 잡고 judgeLineYReverse를 그 축에 반사(2×축−Reverse)해 역산했다.
    judgeLineYNormal: 457,
    judgeLineThickness: 15, // 판정선 외부 높이 (px) — 실측
    judgeLineStrokeWidth: 3, // 판정선 테두리 두께 (px) — 추정

    // 판정선 위치 조절 (judgelinePosition 옵션). 변동량이 비선형이라 getJudgelineOffsetPx로 계산
    // (중심 구간과 그 바깥 구간의 1단위당 이동량이 다름).
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
    // noteOffset 1단위가 몇 프레임의 타이밍 변화에 해당하는지(변환 계수)
    offsetPerUnitFrames: 0.4,
    baseNoteOffset: 10, // 기본 노트 표시 타이밍 (옵션 단위). noteOffset에 항상 더해진다(당김 방향).

    // ── 재생 인트로 (한 사이클 시작 연출). 둘 다 실측값 아님 ──
    // introHoldMs: 곡 시작 대기시간(ms). 이 동안 노트는 화면에 표시되지만 정지해 있다(움직이지 않음).
    // leadInMs: 대기 후 첫 마디 시작(t=0)이 판정선에 닿기까지의 이동 시간(ms).
    //            사이클 시작 songTime을 -leadInMs로 두어 그 시간만큼 위에서 판정선까지 내려오게 한다.
    // TODO: 둘 다 임시 추정치 — 실측/취향에 맞춰 보정 필요.
    introHoldMs: 1500,
    leadInMs: 500,

    // ── HUD (옵션과 무관한 고정 구조. 값은 임시 추정치, 추후 실측 보정 예정) ──
    // 아레나는 레인 좌우 얇은 프레임과 프레이즈 프레임이 없다(다른 옵션에서 다른 위치에 표시되므로 생략).
    // 체력바가 있는 상단 HUD 패널만 그리며, 코나스테보다 넓다.

    hudPanelWidth: 1434, // HUD 패널 너비 (px) — 레인 중심 기준 좌우로 펼침. 추정
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
    laneDividerColor: "#ffffff", // 버튼 사이 레인 구분선
    laneDividerWidth: 4,
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

    // 노트 간격 — 버튼 영역(laneLeft~buttonRight) 안에서 5개 노트를 같은 너비로 두고,
    // 노트 사이(4칸)와 양 사이드(2칸)에 모두 이 값(px)만큼 빈 공간을 둔다(총 6칸 간격 + 5칸 노트).
    noteGap: 6,

    // 오픈픽(OPEN PICK) — 아무 버튼도 누르지 않고 피킹만 해서 처리하는 노트.
    // 5버튼 전 영역을 차지하는 밝은 핑크 막대(두께는 일반 노트와 동일)에 가운데 굵은 "OPEN" 글자를 얹는다.
    // 막대가 얇아 글자가 가로로 퍼지므로 자간(openPickLetterSpacing)으로 적당히 벌리고 검은 테두리를 두른다.
    openPickColor: "#ff80ff", // 5번 핑크 버튼보다 조금 더 밝은 핑크
    openPickTextColor: "#ffffff",
    openPickOutlineColor: "#000000",
    openPickOutlineWidth: 2, // "OPEN" 글자 검은 테두리 두께 (px)
    openPickTextOffsetX: 10, // "OPEN" 글자 위치 오프셋 x 좌표 (px)
    openPickFontSize: 18, // 글자 세로 높이(두께) (px) — 막대보다 크게 두껍게
    openPickLetterSpacing: 9, // 글자 사이 기본 간격(px) — 가로 늘임 전 기준
    openPickTextWidth: 216.6, // "OPEN"이 차지할 가로 너비 (px) — 이 너비에 맞춰 글자를 가로로 늘임

    // 롱노트(홀드) — 머리는 일반 노트와 동일, 머리~꼬리를 레인 폭의 반투명 박스로 잇는다.
    longNoteAlpha: 0.2, // 몸통 불투명도(0~1). noteColors 색에 적용.
    longNoteHoldColor: "#ffffff", // 머리 부근 "Hold" 글자 색
    longNoteHoldSize: 76.44, // "Hold" 글자 크기 (px)
    longNoteHoldGap: 12, // 근단(near)과 글자 가까운 끝 사이의 여백 (px)

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

    // ── 입력 시뮬레이션 (오토 재생 가상 입력) ──
    // 키빔: 넥 버튼(1~5)이 눌린 동안 레인 중앙에 노트색 실선을 레인 전체 길이로 그린다.
    // 오픈픽·웨일링은 키빔이 없다.
    keyBeamWidth: 2, // 키빔 두께 (px)
    keyHoldPreMs: 1000, // 노트 처리 전 키 유지 시간(ms)
    keyHoldPostMs: 1000, // 노트 처리 후 키 유지 시간(ms)

    // 판정 윈도우 (|피킹시각 − 노트시각|, ms). OK 윈도우 초과 시 자동 Miss.
    judgeWindowPerfectMs: 33,
    judgeWindowGreatMs: 48,
    judgeWindowGoodMs: 72,
    judgeWindowOkMs: 115,
    judgeWindowMissMs: 150, // 이 시간을 넘기면 자동 Miss 처리

    // 웨일링 입력 유효 시간(ms) — 웨일링 노트가 판정선에 닿은 뒤 이 시간 내 입력하면 성공.
    wailingInputWindowMs: 1000,
};

// ---- 노트 레인 해석 ----
// 기타도라는 한 번의 피킹이 하나의 노트(콤보)다. 따라서 화음(동시치기)을 여러 오브젝트로
// 쪼개지 않고, 노트 레인 하나에 눌러야 할 넥버튼을 비트마스크(buttons)로 담는 단일 노트로 본다.
// BMS 채널 둘째 자리 = 레인 번호. 이 렌더러는 레인 1을 노트 레인(넥+오픈픽),
// 2를 웨일링, 3을 프레이즈 경계로 해석하고 그 외 레인은 무시(버림)한다.
// 스크립트에 없는 레인은 빈 레인으로 둔다(노트가 내려오지 않음).
const BUTTON_COUNT = 5; // 넥버튼 5개 (R/G/B/Y/P = buttons의 bit0~bit4)
const NOTE_LANE = 1; // 채널 11 — 노트 레인. value(buttons)에 넥버튼 비트마스크 + 오픈픽 비트.
const WAILING_LANE = 2; // 채널 12 — 웨일링 (value 01=↑, 02=↓)
const PHRASE_LANE = 3; // 채널 13 — 프레이즈(달성률 구간) 경계. 화면엔 안 그림.

// buttons 비트 구성: 하위 5비트(0x1F) = 눌러야 하는 넥버튼, 0x20 비트 = 오픈픽(넥버튼 없이 피킹).
// 오픈픽은 넥버튼이 0이라 0x20 비트로 빈칸과 구분한다.
const NECK_BUTTON_MASK = 0x1f;
const OPEN_PICK_BIT = 0x20;

// buttons가 오픈픽인지 (0x20 비트가 켜졌는지).
function isOpenPick(buttons) {
    return (buttons & OPEN_PICK_BIT) !== 0;
}

// buttons에서 눌러야 하는 넥버튼 비트만 추출 (하위 5비트).
function neckButtonsOf(buttons) {
    return buttons & NECK_BUTTON_MASK;
}

// 고정 BMS(DEFAULT_BMS)를 파싱하고, 게임 중립 파서의 레인/값을 이 렌더러의 노트 모델로 정규화한다.
// 실패 시 빈 차트로 폴백.
//  - 노트 레인: value를 base36 정수로 디코드해 buttons(넥 비트마스크 + 오픈픽 비트)로 둔다.
//  - 웨일링 레인: value 1=↑, 2=↓.
//  - 프레이즈 레인: 시각(timeMs)만 사용.
function loadChart() {
    const parsed = BMSParser.parse(DEFAULT_BMS);
    if (!parsed.ok) {
        return {
            notes: [],
            cycle: { measureCount: 0, timeMs: 1 },
            timing: { initialBpm: 120, bpmEvents: [], measures: [] },
        };
    }
    const notes = [];
    for (const n of parsed.notes) {
        if (n.lane === NOTE_LANE) {
            notes.push({
                kind: "note",
                buttons: parseInt(n.value, 36) || 0,
                timeMs: n.timeMs,
                endTimeMs: n.endTimeMs,
            });
        } else if (n.lane === WAILING_LANE) {
            const v = parseInt(n.value, 36) || 0;
            notes.push({
                kind: "wailing",
                dir: v === 2 ? "down" : "up",
                timeMs: n.timeMs,
            });
        } else if (n.lane === PHRASE_LANE) {
            notes.push({ kind: "phrase", timeMs: n.timeMs });
        }
        // 그 외 레인: 무시(버림)
    }
    return { notes, cycle: parsed.cycle, timing: parsed.timing };
}

// 프레이즈(기타도라 달성률 구간) 경계 계산.
// 곡을 n등분한 구간이며 구간 사이 빈 곳은 없다. PHRASE_LANE 노트 = 각 프레이즈의 "끝".
// BMS는 노트 외 사운드(BGM 등)가 있어 스크립트만으론 실제 곡 끝을 알 수 없으므로,
// 마지막 프레이즈 노트가 곡 끝을 정의한다(그 노트가 든 마디의 끝 = 곡 끝 = 루프 지점 = cycle.timeMs).
// 따라서 프레이즈 수 = 프레이즈 노트 수. 첫 프레이즈는 곡 시작(0)부터 시작한다.
// (마지막 프레이즈 노트는 모든 게임플레이 노트보다 뒤여야 한다 — 스크립트 작성 규칙.)
function computePhrases(chart) {
    const ends = chart.notes
        .filter((n) => n.kind === "phrase" && n.timeMs > 0)
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
let _inputSchedule = null; // 가상 입력 스케줄 (키빔 구간 + 판정/콤보 결과)
let _freezeRemaining = 0; // 곡 시작 대기 잔여 시간(초). >0이면 노트 정지(표시만).

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
// 변동량이 비선형이다: 중심 구간과 그 바깥 구간의 1단위당 이동량이 다르다(구간 경계·이동량은 아래 구현 참고).
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
// noteOffset > 0 → 더 늦게 쳐야 함 → Reverse에서 내부선이 아래(Y 증가)
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

// 버튼 노트 한 칸의 너비 (px). 버튼 영역을 5개 노트 + 6칸 간격(noteGap)으로 나눈다
// (노트 사이 4칸 + 양 사이드 2칸). 모든 버튼 노트는 같은 너비.
function getNoteWidth() {
    const { laneLeft, buttonRight, noteGap } = PROFILE;
    return (
        (buttonRight - laneLeft - (BUTTON_COUNT + 1) * noteGap) / BUTTON_COUNT
    );
}

// 레인(1~BUTTON_COUNT)의 노트 좌측 X 좌표. 좌측 사이드 간격(noteGap)부터 시작한다.
function getNoteX(lane) {
    return (
        PROFILE.laneLeft +
        PROFILE.noteGap +
        (lane - 1) * (getNoteWidth() + PROFILE.noteGap)
    );
}

// ---- 입력 시뮬레이션 ----

// 겹치거나 맞닿는 구간을 병합한다 ([start, end] 배열, 초 단위).
function mergeIntervals(list) {
    if (list.length === 0) return [];
    const sorted = [...list].sort((a, b) => a[0] - b[0]);
    const out = [sorted[0].slice()];
    for (let i = 1; i < sorted.length; i++) {
        const last = out[out.length - 1];
        if (sorted[i][0] <= last[1]) {
            last[1] = Math.max(last[1], sorted[i][1]);
        } else {
            out.push(sorted[i].slice());
        }
    }
    return out;
}

// 피킹 편차(ms)를 판정으로 분류한다. OK 윈도우를 넘기면 Miss.
function classifyJudge(diffMs) {
    const a = Math.abs(diffMs);
    if (a <= PROFILE.judgeWindowPerfectMs) return "perfect";
    if (a <= PROFILE.judgeWindowGreatMs) return "great";
    if (a <= PROFILE.judgeWindowGoodMs) return "good";
    if (a <= PROFILE.judgeWindowOkMs) return "ok";
    return "miss";
}

// 가상 입력 스케줄을 차트로부터 계산한다.
//  - beams: 넥 버튼(1~5)별 키빔 점등 구간(초). 각 피킹 그룹이 자기 버튼을 쥐고 있는 구간을 경계로 분할해 만든다.
//    한 그룹은 기본 [처리−pre, 처리+post] 동안 점등하되, 다음 그룹이 처리 후 유지시간 안에 오면 그 다음 그룹의
//    pre 시작점에서 버튼을 다음 그룹 버튼으로 넘긴다 — 즉 두 그룹이 겹쳐 함께 눌려 있지 않고, 이전 그룹의 전용
//    버튼은 전환 시점에 떼어진다(다음 코드가 다르면 손가락을 바꾼다). 같은 버튼이 연속되면 경계가 맞닿아 연속 점등.
//    롱노트는 머리~꼬리 내내 쥐고 있으므로 그 레인은 꼬리+post까지 유지한다(경계 분할 무시).
//  - judgments/wailings/counts/maxCombo: 처리 결과. 오토 재생이라 피킹이 노트 시각과 정확히 일치 → 전부 Perfect/성공.
//    노트 레인의 노트 1개 = 한 콤보(한 번의 피킹). 넥버튼은 buttons 비트마스크에서 펼친다.
// TODO(미사용): judgments/wailings/counts/maxCombo는 추후 콤보·판정 애니메이션/통계 표시에 사용 예정.
function computeInputSchedule(chart) {
    const pre = PROFILE.keyHoldPreMs / 1000;
    const post = PROFILE.keyHoldPostMs / 1000;

    // 1) 피킹 그룹 — 노트 레인의 노트 1개 = 한 그룹(한 콤보, 한 번의 피킹). buttons에서 눌리는
    //    넥버튼 레인(1~5)을 펼치고, 오픈픽은 별도로 표시한다. longTails[lane] = 롱노트 꼬리 시각(초).
    const groups = chart.notes
        .filter((n) => n.kind === "note")
        .map((n) => {
            const neck = neckButtonsOf(n.buttons);
            const lanes = [];
            const longTails = {};
            for (let b = 1; b <= BUTTON_COUNT; b++) {
                if (!(neck & (1 << (b - 1)))) continue;
                lanes.push(b);
                if (n.endTimeMs != null) longTails[b] = n.endTimeMs / 1000;
            }
            return {
                timeMs: n.timeMs,
                t: n.timeMs / 1000,
                lanes,
                openPick: isOpenPick(n.buttons),
                longTails,
            };
        })
        .sort((a, b) => a.t - b.t);

    // 2) 넥 버튼(1~5) 키빔 구간 — 그룹별 점등 구간을 인접 그룹과의 전환 경계로 잘라 만든다.
    //    이전 그룹과 겹치면 점등 시작을 이전 그룹 처리시각까지로 미루고(holdStart), 다음 그룹의 pre가
    //    처리 후 유지시간 안에서 시작되면 거기서 점등을 끊는다(holdEnd) → 다음 그룹 버튼으로 전환.
    //    멀리 떨어진 그룹끼리는 경계가 [t−pre,t+post] 밖이라 그 사이에 빈 구간(버튼 뗌)이 생긴다.
    const laneIntervals = {};
    for (let l = 1; l <= BUTTON_COUNT; l++) laneIntervals[l] = [];
    for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        const prev = groups[i - 1];
        const next = groups[i + 1];
        const holdStart = prev ? Math.max(g.t - pre, prev.t) : g.t - pre;
        const holdEnd = next
            ? Math.min(g.t + post, Math.max(g.t, next.t - pre))
            : g.t + post;
        for (const lane of g.lanes) {
            const tail = g.longTails[lane];
            // 롱노트 레인은 꼬리+post까지(경계 분할 무시), 탭은 전환 경계까지.
            const end = tail != null ? tail + post : holdEnd;
            laneIntervals[lane].push([holdStart, end]);
        }
    }
    const beams = {};
    for (let l = 1; l <= BUTTON_COUNT; l++) {
        beams[l] = mergeIntervals(laneIntervals[l]);
    }

    // 3) 판정 이벤트 — 그룹별. 오토 재생이라 피킹 편차 0 → 전부 Perfect.
    const judgments = groups.map((g) => ({
        timeMs: g.timeMs,
        lanes: g.lanes.slice().sort((a, b) => a - b),
        openPick: g.openPick,
        pickDiffMs: 0, // 오토 = 정확히 처리(편차 0)
        judge: classifyJudge(0), // perfect
    }));

    // 4) 웨일링 — 오토는 판정선 도달 즉시 입력 → 성공.
    const wailings = chart.notes
        .filter((n) => n.kind === "wailing")
        .map((n) => ({ timeMs: n.timeMs, dir: n.dir, success: true }))
        .sort((a, b) => a.timeMs - b.timeMs);

    // 처리 결과 집계 (오토라 전부 Perfect, maxCombo = 콤보(그룹) 수).
    const counts = { perfect: 0, great: 0, good: 0, ok: 0, miss: 0 };
    for (const j of judgments) counts[j.judge]++;

    return { beams, judgments, wailings, counts, maxCombo: judgments.length };
}

// 넥 버튼 lane(1~5)이 songTime에 눌려 있는가(키빔 점등 여부).
function isLaneBeamOn(lane, songTime) {
    if (!_inputSchedule) return false;
    const intervals = _inputSchedule.beams[lane];
    if (!intervals) return false;
    for (const [down, up] of intervals) {
        if (songTime >= down && songTime <= up) return true;
    }
    return false;
}

// ---- 드로우 함수 ----

// 키빔 — 눌린 넥 버튼(1~5)의 레인 중앙에 노트색 실선을 레인 전체(laneTop~laneBottom)로 그린다.
// 노트 등장 마스크 이후·커버 이전에 호출돼 레인 전체에 보이되 서든/히든에는 함께 가려진다.
// (넥 버튼만 키빔이 있다 — 오픈픽·웨일링은 키빔 없음.)
function drawKeyBeams(ctx, songTime) {
    const { laneTop, laneBottom, keyBeamWidth, noteColors } = PROFILE;
    const noteWidth = getNoteWidth();
    ctx.lineWidth = keyBeamWidth;
    for (let lane = 1; lane <= BUTTON_COUNT; lane++) {
        if (!isLaneBeamOn(lane, songTime)) continue;
        const cx = getNoteX(lane) + noteWidth / 2;
        ctx.strokeStyle = noteColors[lane];
        ctx.beginPath();
        ctx.moveTo(cx, laneTop);
        ctx.lineTo(cx, laneBottom);
        ctx.stroke();
    }
}

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
        noteGap,
    } = PROFILE;
    const noteWidth = getNoteWidth();

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = laneBgColor;
    ctx.fillRect(
        laneLeft,
        laneTop,
        wailingRight - laneLeft,
        laneBottom - laneTop,
    );

    // 버튼 사이 구분선은 노트 사이 빈 공간(간격)의 한가운데에 그린다.
    ctx.strokeStyle = laneDividerColor;
    ctx.lineWidth = laneDividerWidth;
    for (let i = 1; i < BUTTON_COUNT; i++) {
        const x = laneLeft + i * noteWidth + (i + 0.5) * noteGap;
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
    const noteWidth = getNoteWidth();
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
        // 롱노트(endTimeMs 보유)는 머리가 판정선을 지난 뒤에도 몸통이 남으므로 별도 처리.
        if (note.kind === "note" && note.endTimeMs != null) {
            drawLongNote(ctx, note, songTime, judgeLineY, dir, speed_pps);
            continue;
        }

        const t = note.timeMs / 1000;
        if (t < tMin || t > tMax) continue;
        if (t < songTime) continue;

        const y = getNoteY(judgeLineY, dir, t, songTime, speed_pps);
        if (y < laneTop || y > laneBottom) continue;

        if (note.kind === "note") {
            if (isOpenPick(note.buttons)) {
                drawOpenPick(ctx, y, noteH);
            } else {
                // 눌리는 넥버튼마다 노트색 사각형을 그린다(화음 = 한 노트의 여러 버튼).
                const neck = neckButtonsOf(note.buttons);
                const ny = y - noteH / 2;
                for (let b = 1; b <= BUTTON_COUNT; b++) {
                    if (!(neck & (1 << (b - 1)))) continue;
                    const x = getNoteX(b);
                    ctx.fillStyle = noteColors[b];
                    ctx.fillRect(x, ny, noteWidth, noteH);
                    ctx.strokeStyle = noteBorderColor;
                    ctx.lineWidth = noteBorderWidth;
                    ctx.strokeRect(x + 0.5, ny + 0.5, noteWidth - 1, noteH - 1);
                }
            }
        } else if (note.kind === "wailing") {
            drawWailingArrow(
                ctx,
                buttonRight,
                wailingWidth,
                y,
                note.dir,
                wailingColor,
                wailingBorderColor,
            );
        }
        // 프레이즈 경계(kind === "phrase")는 화면에 그리지 않는다.
    }
}

// 오픈픽(OPEN PICK) 그리기 — 5버튼 전 영역(노트1 좌단~노트5 우단)을 차지하는 밝은 핑크 막대.
// 두께(noteH)·양 사이드 간격(noteGap)은 일반 노트와 동일하고, 가운데에 굵은 "OPEN" 글자를 얹는다.
// 막대가 얇고 넓으므로 글자를 자간(openPickLetterSpacing)으로 벌린 뒤, 목표 너비
// (openPickTextWidth)만큼 차지하도록 가로로 늘인다(세로 높이는 openPickFontSize 그대로).
// 검은 테두리(strokeText)를 둘러 가독성을 높인다.
function drawOpenPick(ctx, y, noteH) {
    const {
        openPickColor,
        openPickTextColor,
        openPickOutlineColor,
        openPickOutlineWidth,
        openPickFontSize,
        openPickLetterSpacing,
        openPickTextWidth,
        noteBorderColor,
        noteBorderWidth,
        openPickTextOffsetX,
    } = PROFILE;
    const noteWidth = getNoteWidth();
    const left = getNoteX(1);
    const right = getNoteX(BUTTON_COUNT) + noteWidth;
    const w = right - left;
    const ny = y - noteH / 2;

    ctx.fillStyle = openPickColor;
    ctx.fillRect(left, ny, w, noteH);
    ctx.strokeStyle = noteBorderColor;
    ctx.lineWidth = noteBorderWidth;
    ctx.strokeRect(left + 0.5, ny + 0.5, w - 1, noteH - 1);

    ctx.save();
    ctx.font = `bold ${openPickFontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = `${openPickLetterSpacing}px`;
    ctx.lineJoin = "round";

    // 자연 너비를 재고 목표 너비(막대 × 비율)에 맞춰 가로 배율을 구한다.
    const naturalW = ctx.measureText("OPEN").width;
    const scaleX = naturalW > 0 ? openPickTextWidth / naturalW : 1;
    ctx.translate(left + w / 2, y);
    ctx.scale(scaleX, 1);

    // 테두리는 늘인 글자에 비례하도록 같은 변환 안에서 그린다.
    ctx.lineWidth = openPickOutlineWidth;
    ctx.strokeStyle = openPickOutlineColor;
    ctx.strokeText("OPEN", openPickTextOffsetX, 0);
    ctx.fillStyle = openPickTextColor;
    ctx.fillText("OPEN", openPickTextOffsetX, 0);
    ctx.restore();
}

// 롱노트(홀드) 그리기.
// 머리~꼬리는 다른 노트처럼 **내부 판정선** 기준으로 평범하게 떨어진다(judgeLineY = getInternalJudgeLineY).
// 머리~꼬리를 레인 폭의 반투명 박스로 잇고, 시작 지점 부근에 90도 회전한 "Hold" 글자를 함께 내린다.
//
// 시작 지점(머리)의 위치는 처리 여부에 따라 다르다:
//  - 처리 전(songTime < headT, 머리가 내부 판정선 도달 전): 머리 위치 그대로 — 평범하게 표시.
//    (내부 판정선이 표시 판정선보다 뒤면 머리·Hold가 표시 판정선을 지나서 렌더링될 수 있다.)
//  - 처리 시작(songTime ≥ headT)부터: 시작 지점을 **표시(노란) 판정선으로 이동/고정**.
//    내부선이 표시선보다 뒤면 표시선 앞으로 당겨지고, 앞이면 표시선으로 순간이동한다.
//  - 꼬리가 내부 판정선에 닿는 순간(songTime ≥ tailT) 롱노트 전체가 사라진다(잔여 길이째 팝).
// 기타도라 롱노트는 떼도 Miss/판정이 없고 조합이 깨지면 즉시 사라지지만, 프리뷰는 오토 재생이라
// 처리 시작부터 꼬리 도달까지 정상적으로 처리되는 모습만 보인다.
function drawLongNote(ctx, note, songTime, judgeLineY, dir, speed_pps) {
    const {
        laneTop,
        laneBottom,
        judgeLineThickness,
        judgeLineStrokeWidth,
        noteColors,
        noteBorderColor,
        noteBorderWidth,
        longNoteAlpha,
        longNoteHoldColor,
        longNoteHoldSize,
        longNoteHoldGap,
    } = PROFILE;

    const neck = neckButtonsOf(note.buttons);
    if (neck === 0) return; // 롱노트는 넥버튼만 (오픈픽·웨일링 롱노트 없음)

    const headT = note.timeMs / 1000;
    const tailT = note.endTimeMs / 1000;
    if (songTime >= tailT) return; // 꼬리가 내부 판정선 도달 → 롱노트 전체 소멸

    const buttonWidth = getNoteWidth();

    // 머리/꼬리는 내부 판정선 기준으로 평범하게 떨어진다.
    const headY = getNoteY(judgeLineY, dir, headT, songTime, speed_pps);
    const tailY = getNoteY(judgeLineY, dir, tailT, songTime, speed_pps);

    // 시작 지점: 처리 전엔 머리 그대로, 처리 시작(songTime ≥ headT)부턴 표시 판정선으로 이동·고정.
    const startY = songTime >= headT ? getVisualJudgeLineY(_config) : headY;

    // 내부 판정선이 표시 판정선보다 뒤면(처리 후) 꼬리가 시작 지점을 진행 방향으로 넘어가 몸통이 뒤집힌다.
    // 뒤집힌 경우엔 표시하지 않는다 → 사실상 꼬리가 시작 지점(표시 판정선)에 닿는 순간 사라진다.
    if (dir * (tailY - startY) > 0) return;

    // 몸통 = 시작 지점 ~ 꼬리, 레인 클램프.
    const top = Math.max(laneTop, Math.min(startY, tailY));
    const bottom = Math.min(laneBottom, Math.max(startY, tailY));
    if (bottom <= top) return; // 화면 밖

    const noteH = judgeLineThickness - 2 * judgeLineStrokeWidth;
    // 회전 방향은 H가 항상 시작(판정선) 쪽에 오도록 꼬리 방향 부호로 정한다.
    const towardTail = Math.sign(tailY - startY) || -dir;
    const fontSize = longNoteHoldSize;

    // 눌리는 넥버튼마다 몸통+머리+"Hold"를 그린다(화음 전체가 같은 길이로 유지됨).
    for (let b = 1; b <= BUTTON_COUNT; b++) {
        if (!(neck & (1 << (b - 1)))) continue;
        const x = getNoteX(b);

        // 반투명 몸통
        ctx.save();
        ctx.globalAlpha = longNoteAlpha;
        ctx.fillStyle = noteColors[b];
        ctx.fillRect(x, top, buttonWidth, bottom - top);
        ctx.restore();

        // 머리(시작 지점, 일반 노트와 동일)
        if (startY >= laneTop && startY <= laneBottom) {
            const ny = startY - noteH / 2;
            ctx.fillStyle = noteColors[b];
            ctx.fillRect(x, ny, buttonWidth, noteH);
            ctx.strokeStyle = noteBorderColor;
            ctx.lineWidth = noteBorderWidth;
            ctx.strokeRect(x + 0.5, ny + 0.5, buttonWidth - 1, noteH - 1);
        }

        // "Hold" 글자 — 90도 회전(위→아래 읽음). 시작 지점에서 꼬리 방향으로 글자 절반 길이만큼
        // 밀고, 몸통(top~bottom)으로 클리핑해 롱노트 안에서만 보인다(끝지점이 글자 중간에 오면 잘림).
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, top, buttonWidth, bottom - top);
        ctx.clip();
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const textLen = ctx.measureText("Hold").width;
        const textCenterY = startY + towardTail * (longNoteHoldGap + textLen / 2);
        ctx.translate(x + buttonWidth / 2, textCenterY);
        ctx.rotate((towardTail * Math.PI) / 2); // H가 시작(판정선) 쪽
        ctx.fillStyle = longNoteHoldColor;
        ctx.fillText("Hold", 0, 0);
        ctx.restore();
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
// 패널은 레인 너비보다 넓고(`hudPanelWidth`) 레인 중심에 맞춰 배치된다.
// 옵션에 따라 (서든/히든에) 가려질 수는 있으나 그 위치·형태는 변하지 않는다.
// 모든 시각 요소 위(가장 나중)에 그려져 게임 UI 크롬 역할을 한다.
function drawFrame(ctx) {
    const {
        laneLeft,
        wailingRight,
        laneTop,
        hudPanelWidth,
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

    // 상단 HUD 패널 — 화면 최상단(Y=0)~레인 시작(laneTop). 레인 중심 기준 좌우로 펼침.
    const laneCenter = (laneLeft + wailingRight) / 2;
    const panelWidth = hudPanelWidth;
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

// 한 사이클을 시작(또는 재시작)한다.
// songTime을 -leadInMs로 두어 첫 마디(t=0)가 leadInMs 동안 판정선까지 내려오게 하고,
// introHoldMs 동안은 노트를 정지(표시만)시켜 곡 시작 대기 연출을 한다(loop()의 freeze 처리).
function startCycle() {
    _songTime = -PROFILE.leadInMs / 1000;
    _freezeRemaining = PROFILE.introHoldMs / 1000;
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
    drawKeyBeams(ctx, _songTime);
    drawCovers(ctx);
    drawJudgeLine(ctx);
    drawFrame(ctx);
}

function loop(now) {
    if (!_running) return;
    const dt = (now - _lastFrameTime) / 1000;
    _lastFrameTime = now;
    if (_freezeRemaining > 0) {
        // 곡 시작 대기: 노트는 표시되지만 움직이지 않는다(songTime 고정).
        _freezeRemaining -= dt;
    } else {
        _songTime += dt;
        // 곡 끝(cycle)을 지나 화면이 완전히 빈 뒤 다음 사이클을 시작한다(리드인+대기 재개).
        // → 다음 사이클 노트가 현재 사이클이 끝나기 전에 등장하지 않는다.
        const cycleSec = _chart.cycle.timeMs / 1000;
        if (cycleSec > 0 && _songTime >= cycleSec && isFieldEmpty(_songTime)) {
            startCycle();
        }
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
    _inputSchedule = computeInputSchedule(_chart);
    startCycle(); // 대기 + 리드인부터 시작
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
    startCycle();
    draw(); // 정지 상태에서도 리셋 결과가 바로 보이도록 한 프레임 그린다.
}

// 현재 상태를 한 번 그린다. 일시정지 중 옵션이 바뀌면 main.js가 호출해 즉시 반영한다.
// (재생 중에는 loop()가 매 프레임 그리므로 추가 호출이 무해하다.)
export function redraw() {
    draw();
}

// 프레이즈(달성률 구간) 정보. 향후 판정/달성률 표시 기능에서 사용.
export function getPhraseInfo() {
    return { count: _phrases.length, phrases: _phrases };
}

// 가상 입력 처리 결과(판정/콤보 집계). 현재 미사용 — 추후 콤보·판정 애니메이션/통계 표시에 사용 예정.
// TODO: 표시 기능 미구현(오토 재생이라 현재는 전부 Perfect/성공).
export function getInputResult() {
    if (!_inputSchedule) return null;
    return {
        judgments: _inputSchedule.judgments,
        wailings: _inputSchedule.wailings,
        counts: _inputSchedule.counts,
        maxCombo: _inputSchedule.maxCombo,
    };
}

export const DEFAULT_BMS = `#BPM 175
#PLAYER 1
#TITLE GF Test Pattern
#ARTIST -
#LNOBJ ZZ

*-- 단일 레인 비트마스크 포맷:
*--   11 = 노트 레인(넥+오픈픽). value(base36) = 넥버튼 비트마스크(bit0=R,1=G,2=B,3=Y,4=P; 01~1F),
*--        0W(=32, 0x20 비트) = 오픈픽(버튼 없이 피킹), ZZ(#LNOBJ) = 직전 노트를 롱노트로 종료.
*--   12 = 웨일링(01=↑, 02=↓), 13 = 프레이즈 경계(각 노트 = 그 프레이즈의 끝).
*-- 예: R+G=03, G+Y=0A, B+Y=0C, P=0G, 오픈픽=0W.
*-- 롱노트: 노트 레인의 노트 뒤에 종료 마커 ZZ를 두면 그 사이가 홀드가 된다(마디 9·10 참고).

*-- 마디 0: 비어 있음(박자 기준).

#00111:0300000003000W010100030001000100

#00211:03000100010003000100030001000100

#00311:060000000600020W0W0006000W000600

#00411:0W000408040002000800040002000100

*-- 마디 5: 프레이즈 경계(달성률 구간 1의 끝).
#00511:0C0000000C000C0W0W000C000W000C00
#00513:01

#00611:0W00080G080004000800040002000000

#00711:01010101020202020404040408080808

#00811:0202020204040404080808080G0G0G0G

*-- 마디 9~10: G+Y(0A) 롱노트 머리(마디 9 시작) → 종료 마커 ZZ(마디 10 시작)로 마디 9 전체 홀드.
#00911:0A

*-- 마디 10: 롱노트 종료 마커 + 마지막 프레이즈 경계(곡 끝 정의).
#01011:ZZ
#01013:01
`;
