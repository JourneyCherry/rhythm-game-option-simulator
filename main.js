document.addEventListener("DOMContentLoaded", () => {
    console.log("Rhythm Game Option Simulator initialized");

    const rootStyles = getComputedStyle(document.documentElement);

    // CSS 변수에서 판정선 위치(%)를 읽어와서 0~1 범위 값으로 변환
    const judgeLinePercent = parseFloat(
        rootStyles.getPropertyValue("--judgeline-position")
    );
    const JUDGE_LINE_Y = Number.isNaN(judgeLinePercent)
        ? 0.8
        : judgeLinePercent / 100;

    const GAME_PRESETS = {
        default5: {
            id: "default5",
            label: "Default 5-key",
            direction: 1,
            speed: 0.5,
            sudden: 15,
            hidden: 15,
        },
        fast5: {
            id: "fast5",
            label: "Fast 5-key",
            direction: 1,
            speed: 0.9,
            sudden: 10,
            hidden: 10,
        },
    };

    const DEFAULT_PRESET_ID = "default5";
    const DEFAULT_PRESET = GAME_PRESETS[DEFAULT_PRESET_ID];

    const config = {
        direction: DEFAULT_PRESET.direction,
        speed: DEFAULT_PRESET.speed,
        sudden: DEFAULT_PRESET.sudden,
        hidden: DEFAULT_PRESET.hidden,
    };

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

    const controlsRoot = document.getElementById("controls");
    const controlHandles = {}; // 각 옵션 컨트롤에 접근하기 위한 핸들

    function applyPreset(presetId, { syncControls = true } = {}) {
        const preset = GAME_PRESETS[presetId];
        if (!preset) return;

        // config 갱신
        config.direction = preset.direction;
        config.speed = preset.speed;
        config.sudden = preset.sudden;
        config.hidden = preset.hidden;

        // CSS 반영
        applyCoverHeights();

        // 기존 컨트롤 값도 preset에 맞게 변경
        if (syncControls) {
            controlHandles.direction?.setValue(config.direction);
            controlHandles.speed?.setValue(config.speed);
            controlHandles.sudden?.setValue(config.sudden);
            controlHandles.hidden?.setValue(config.hidden);
        }
    }

    function createNumericControl(def) {
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
        controlsRoot.appendChild(wrapper);

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
            setValue(v) {
                applyFromValue(v);
            },
        };

        // 초기값 적용
        applyFromValue(def.defaultValue);
    }

    function createSelectControl(def) {
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
        controlsRoot.appendChild(wrapper);

        // 외부에서 값 세팅 가능하게 핸들 등록
        controlHandles[def.id] = {
            setValue(v) {
                select.value = String(v);
                def.apply(v);
            },
        };

        // 초기값 설정
        def.apply(def.defaultValue);
    }

    // 현재 사용할 옵션 정의
    const optionDefinitions = [
        {
            type: "select",
            id: "gamePreset",
            label: "Game Preset",
            options: Object.values(GAME_PRESETS).map((p) => ({
                value: p.id,
                label: p.label,
            })),
            defaultValue: DEFAULT_PRESET_ID,
            apply(value) {
                applyPreset(value, { syncControls: true });
            },
        },
        {
            type: "number",
            id: "speed",
            label: "Note Speed",
            min: 0.5,
            max: 10.0,
            step: 0.5,
            defaultValue: config.speed,
            apply(value) {
                config.speed = value;
            },
        },
        {
            type: "number",
            id: "sudden",
            label: "Sudden",
            min: 0,
            max: 100,
            step: 1,
            defaultValue: config.sudden,
            apply(value) {
                config.sudden = value;
                applyCoverHeights();
            },
        },
        {
            type: "number",
            id: "hidden",
            label: "Hidden",
            min: 0,
            max: 100,
            step: 1,
            defaultValue: config.hidden,
            apply(value) {
                config.hidden = value;
                applyCoverHeights();
            },
        },
        {
            type: "select",
            id: "direction",
            label: "Direction",
            options: [
                { value: 1, label: "Reverse" },
                { value: -1, label: "Normal" },
            ],
            defaultValue: config.direction,
            apply(value) {
                const v = parseInt(value, 10);
                if (v === 1 || v === -1) {
                    config.direction = v;
                }
            },
        },
    ];

    optionDefinitions.forEach((def) => {
        if (def.type === "number") {
            createNumericControl(def);
        } else if (def.type === "select") {
            createSelectControl(def);
        }
    });

    requestAnimationFrame(loop);
});
