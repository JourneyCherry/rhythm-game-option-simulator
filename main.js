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

    // 이동 관련 설정값 (추후 옵션으로 바꿀 예정)
    const DIRECTION = 1; // 1: 위 -> 아래, -1: 아래 -> 위
    const NOTE_SPEED_PER_SEC = 0.4; // 노트/박자선이 1초에 playfield 높이의 몇 배를 이동할지 (0~1 기준)

    const SPAWN_Y = -0.1;

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
            y: SPAWN_Y, // 화면 위쪽 밖에서 시작 (0=최상단, 1=최하단)
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
            y: SPAWN_Y, // 약간 위에서 시작
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

        const delta = DIRECTION * NOTE_SPEED_PER_SEC * dt;

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
            note.y += delta;
            note.el.style.top = `${note.y * 100}%`;

            // 판정선 도달 시 숨김
            if (!note.hidden && note.y >= JUDGE_LINE_Y) {
                note.hidden = true;
                note.el.style.display = "none";
            }
        });

        // 화면 아래로 벗어난 노트 제거
        activeNotes = activeNotes.filter((note) => {
            if (note.y > 1.1 || note.y < -0.2) {
                noteLayer.removeChild(note.el);
                return false;
            }
            return true;
        });

        // ----- 타이밍 라인(박자선/마디선) 업데이트 -----
        activeTimingLines.forEach((line) => {
            line.y += delta;
            line.el.style.top = `${line.y * 100}%`;
        });

        // 화면 아래로 벗어난 타이밍 라인 제거
        activeTimingLines = activeTimingLines.filter((line) => {
            if (line.y > 1.1 || line.y < -0.2) {
                beatLayer.removeChild(line.el);
                return false;
            }
            return true;
        });

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
});
