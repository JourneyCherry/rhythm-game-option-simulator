import * as Option from "./views/Options.mjs";

async function loadPresets() {
    const res = await fetch("./game_presets.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`failed to load presets: ${res.status}`);
    return await res.json();
}

async function init() {
    console.log("Rhythm Game Option Simulator initialized");

    const rootStyles = getComputedStyle(document.documentElement);

    // CSS 변수에서 판정선 위치(%)를 읽어와서 0~1 범위 값으로 변환
    const judgeLinePercent = parseFloat(
        rootStyles.getPropertyValue("--judgeline-position"),
    );
    const JUDGE_LINE_Y = Number.isNaN(judgeLinePercent)
        ? 0.8
        : judgeLinePercent / 100;

    //TODO : Preset.mjs에서 로드하기
    const presetData = await loadPresets();
    const presetMap = Object.fromEntries(
        presetData.presets.map((p) => [p.id, p]),
    );

    const DEFAULT_PRESET_ID = presetData.defaultPresetId;
    let currentPresetId = DEFAULT_PRESET_ID;
    let currentPreset = presetMap[currentPresetId];

    //TODO : Preview.mjs로 보내기. 그리는데 사용됨.
    let config = makeConfigFromPreset(currentPreset);

    //TODO : Preview.mjs에서 update()메소드에서 처리하기
    function applyCallback(id, value) {
        switch (id) {
            case "speed":
                config.speed = value;
                break;
            case "sudden":
                config.sudden = value;
                applyCoverHeights();
                break;
            case "hidden":
                config.hidden = value;
                applyCoverHeights();
                break;
            case "direction":
                const v = parseInt(value, 10);
                if (v === 1 || v === -1) config.direction = v;
                break;
        }
    }

    //TODO : Preview.mjs로 보내기. 그리는데 사용됨
    function applyCoverHeights() {
        document.documentElement.style.setProperty(
            "--cover-top-height",
            `${config.sudden}%`,
        );
        document.documentElement.style.setProperty(
            "--cover-bottom-height",
            `${config.hidden}%`,
        );
    }

    applyCoverHeights();

    // 이동 관련 설정값 (추후 옵션으로 바꿀 예정)

    const SPAWN_Y_TOP = -0.1;
    const SPAWN_Y_BOTTOM = 1.1;

    function getSpawnY() {
        return config.direction === 1 ? SPAWN_Y_TOP : SPAWN_Y_BOTTOM;
    }

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

    const noteLayer = document.getElementById("note-layer");
    const beatLayer = document.getElementById("beat-layer");

    if (!noteLayer || !beatLayer) {
        console.error("Note or beat layer not found");
        return;
    }

    // -----------------------------
    // 유틸리티: 라인 인덱스 → left%
    // -----------------------------
    function laneIndexToLeftPercent(laneIndex) {
        // laneIndex: 1 ~ 5
        const laneWidth = 100 / 5; // 5개 라인
        return (laneIndex - 1) * laneWidth;
    }

    // 노트 하나 생성 (샘플: 중앙 라인 기준)
    function createNote(laneIndex) {
        const el = document.createElement("div");
        el.className = "note";

        // 가로 위치 : 해당 라인
        const leftPercent = laneIndexToLeftPercent(laneIndex);
        el.style.left = `${leftPercent}%`;

        // 라인별 노트 색상 적용
        const color = NOTE_COLORS[laneIndex] || "#ffffff";
        el.style.background = color;

        noteLayer.appendChild(el);

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
        beatLayer.appendChild(el);

        return {
            el,
            y: getSpawnY(),
            kind,
        };
    }

    // -----------------------------
    // 상태: 활성 노트/라인 목록
    // -----------------------------

    /** @type {Array<{el:HTMLElement,y:number,laneIndex:number,hidden:boolean}>} */
    let activeNotes = [];

    /** @type {Array<{el:HTMLElement,y:number,kind:string}>} */
    let activeTimingLines = [];

    // -----------------------------
    // 시간 / 스폰 스케줄 관리
    // -----------------------------

    let lastFrameTime = performance.now();
    let songTime = 0; // 재생 시간(초) 개념

    // 노트 스폰 스케줄
    let nextNoteTime = 0;
    let nextNoteIndex = 0; // NOTE_PATTERN 인덱스

    // 마디선 / 박자선 스케줄
    let nextBarTime = 0; // 마디선: 매 마디 시작
    let nextBeatTime = MEASURE_DURATION / 4; // 박자선: 2,3,4박 위치에서 시작

    // 시작 시 바로 첫 마디선 하나 찍어두기
    activeTimingLines.push(createTimingLine("bar"));
    nextBarTime += MEASURE_DURATION;

    // -----------------------------
    // 메인 루프
    // -----------------------------

    function loop(now) {
        const dt = (now - lastFrameTime) / 1000;
        lastFrameTime = now;
        songTime += dt;

        const signedSpeed = config.speed * (config.direction === 1 ? 1 : -1);

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
                    (config.direction === 1 && note.y >= JUDGE_LINE_Y) ||
                    (config.direction === -1 && note.y <= JUDGE_LINE_Y)
                ) {
                    note.hidden = true;
                    note.el.style.display = "none";
                }
            }
        });

        // 화면 아래로 벗어난 노트 제거
        activeNotes = activeNotes.filter((note) => {
            const outOfScreen =
                config.direction === 1 ? note.y > 1.1 : note.y < -0.1;
            if (outOfScreen) {
                noteLayer.removeChild(note.el);
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
                config.direction === 1 ? line.y > 1.1 : line.y < -0.1;
            if (outOfScreen) {
                beatLayer.removeChild(line.el);
                return false;
            }
            return true;
        });

        requestAnimationFrame(loop);
    }

    // --------------------
    // 공통 옵션 컨트롤 컴포넌트
    // --------------------
    Option.init();

    function makeConfigFromPreset(preset) {
        const cfg = {};
        for (const opt of preset.options) {
            cfg[opt.id] = opt.defaultValue;
        }
        return cfg;
    }

    function applyPreset(presetId) {
        if (presetId === currentPresetId) return;
        const preset = presetMap[presetId];
        if (!preset) return;

        currentPresetId = presetId;
        currentPreset = preset;

        // config를 preset의 defaultValue로 덮어쓰기
        for (const opt of preset.options) {
            config[opt.id] = opt.defaultValue;
        }

        applyCoverHeights();

        Option.clearControls(Option.RootType.OPTION);
        Option.renderControlsForPreset(preset, applyCallback);
    }

    // 초기 옵션 컨트롤 렌더링
    Option.clearControls(Option.RootType.OPTION);
    Option.clearControls(Option.RootType.BASE);
    Option.renderControlsForPreset(currentPreset, applyCallback);
    Option.createSelectControl(Option.RootType.BASE, {
        type: "select",
        id: "gamePreset",
        label: "Game Preset",
        options: Object.values(presetMap).map((p) => ({
            value: p.id,
            label: p.label,
        })),
        defaultValue: DEFAULT_PRESET_ID,
        apply(value) {
            applyPreset(value);
        },
    });

    requestAnimationFrame(loop);
}

document.addEventListener("DOMContentLoaded", () => {
    init().catch(console.error);
});
