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
        rootStyles.getPropertyValue("--judgeline-position")
    );
    const JUDGE_LINE_Y = Number.isNaN(judgeLinePercent)
        ? 0.8
        : judgeLinePercent / 100;

    const presetData = await loadPresets();
    const presetMap = Object.fromEntries(
        presetData.presets.map((p) => [p.id, p])
    );

    const DEFAULT_PRESET_ID = presetData.defaultPresetId;
    currentPresetId = DEFAULT_PRESET_ID;
    currentPreset = presetMap[currentPresetId];

    config = makeConfigFromPreset(currentPreset);

    const applyMap = makeApplyMap(config);

    function applyCoverHeights() {
        document.documentElement.style.setProperty(
            "--cover-top-height",
            `${config.sudden}%`
        );
        document.documentElement.style.setProperty(
            "--cover-bottom-height",
            `${config.hidden}%`
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

    const baseControlsRoot = document.getElementById("base-controls");
    const optionControlsRoot = document.getElementById("option-controls");
    const controlHandles = {}; // 각 옵션 컨트롤에 접근하기 위한 핸들

    function clearControls(root) {
        root.innerHTML = "";
        for (const k of Object.keys(controlHandles)) {
            if (k.root == root) delete controlHandles[k];
        }
    }

    function renderControlsForPreset(preset) {
        const defs = buildOptionDefinitionsForPreset(preset);
        defs.forEach((def) => {
            if (def.type === "number")
                createNumericControl(optionControlsRoot, def);
            else if (def.type === "select")
                createSelectControl(optionControlsRoot, def);
        });
    }

    function makeConfigFromPreset(preset) {
        const cfg = {};
        for (const opt of preset.options) {
            cfg[opt.id] = opt.defaultValue;
        }
        return cfg;
    }

    function buildOptionDefinitionsForPreset(preset) {
        const defsFromJson = preset.options.map((o) => ({
            ...o,
            apply: applyMap[o.id],
        }));

        return [...defsFromJson];
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

        clearControls(optionControlsRoot);
        renderControlsForPreset(preset);
    }

    function makeApplyMap(config) {
        return {
            speed(value) {
                config.speed = value;
            },
            sudden(value) {
                config.sudden = value;
                applyCoverHeights();
            },
            hidden(value) {
                config.hidden = value;
                applyCoverHeights();
            },
            direction(value) {
                const v = parseInt(value, 10);
                if (v === 1 || v === -1) config.direction = v;
            },
        };
    }

    function createNumericControl(root, def) {
        const wrapper = document.createElement("div");
        wrapper.className = "option-control";

        const label = document.createElement("label");
        label.className = "option-label";
        label.textContent = def.label;
        label.htmlFor = `${def.id}-slider`;

        const row = document.createElement("div");
        row.className = "option-row";

        const decBtn = document.createElement("button");
        decBtn.type = "button";
        decBtn.textContent = "-";
        decBtn.className = "option-btn";

        const slider = document.createElement("input");
        slider.type = "range";
        slider.id = `${def.id}-slider`;
        slider.className = "option-slider";
        slider.min = def.min;
        slider.max = def.max;
        slider.step = def.step;
        slider.value = def.defaultValue;

        const incBtn = document.createElement("button");
        incBtn.type = "button";
        incBtn.textContent = "+";
        incBtn.className = "option-btn";

        const input = document.createElement("input");
        input.type = "number";
        input.className = "option-input";
        input.min = def.min;
        input.max = def.max;
        input.step = def.step;
        input.value = def.defaultValue;

        row.append(decBtn, slider, incBtn, input);
        wrapper.append(label, row);
        root.appendChild(wrapper);

        function applyFromValue(raw) {
            // 값 적용. 여러 컨트롤이 같이 변경되어야 하므로 함수로 관리
            let v = parseFloat(raw);
            if (Number.isNaN(v)) return;
            if (v < def.min) v = def.min;
            if (v > def.max) v = def.max;

            slider.value = String(v);
            input.value = String(v);
            def.apply(v);
        }

        slider.addEventListener("input", () => {
            applyFromValue(slider.value);
        });

        input.addEventListener("change", () => {
            applyFromValue(input.value);
        });

        decBtn.addEventListener("click", () => {
            const v = parseFloat(slider.value) - def.step;
            applyFromValue(v);
        });

        incBtn.addEventListener("click", () => {
            const v = parseFloat(slider.value) + def.step;
            applyFromValue(v);
        });

        // 외부에서 값 세팅 가능하게 핸들 등록
        controlHandles[def.id] = {
            root: root,
            setValue(v) {
                applyFromValue(v);
            },
        };

        // 초기값 적용
        applyFromValue(def.defaultValue);
    }

    function createSelectControl(root, def) {
        const wrapper = document.createElement("div");
        wrapper.className = "option-control";

        const label = document.createElement("label");
        label.className = "option-label";
        label.textContent = def.label;

        const select = document.createElement("select");
        select.className = "option-select";

        def.options.forEach((opt) => {
            const optionEl = document.createElement("option");
            optionEl.value = String(opt.value);
            optionEl.textContent = opt.label;
            select.append(optionEl);
        });

        select.value = String(def.defaultValue);

        select.addEventListener("change", () => {
            def.apply(select.value);
        });

        wrapper.append(label, select);
        root.appendChild(wrapper);

        // 외부에서 값 세팅 가능하게 핸들 등록
        controlHandles[def.id] = {
            root: root,
            setValue(v) {
                select.value = String(v);
                def.apply(v);
            },
        };

        // 초기값 설정
        def.apply(def.defaultValue);
    }

    // 초기 옵션 컨트롤 렌더링
    clearControls(optionControlsRoot);
    clearControls(baseControlsRoot);
    renderControlsForPreset(currentPreset);
    createSelectControl(baseControlsRoot, {
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
