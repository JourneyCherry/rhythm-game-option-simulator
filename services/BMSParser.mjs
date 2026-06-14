/**
 * BMS(Be-Music Source) 텍스트 파서.
 *
 * 설계 원칙: "시간축은 파서, 공간축은 프리뷰".
 * - 파서는 게임 중립. 채널을 표준 BMS 규칙으로 해석해 **번호가 매겨진 레인**의
 *   노트로 산출한다. (레인 번호 = 채널 둘째 자리의 base36 값)
 * - 노트의 "언제 쳐져야 하는가(timeMs)"는 BPM 타임라인만으로 결정되는 게임 독립
 *   연산이므로 파서가 산출한다. "어디에 그려지는가(px)"는 렌더러가 담당한다.
 * - 변속(BPM 변화) 지원 구조를 갖추되(채널 03/08), 현재 고정 스크립트엔 사용하지 않는다.
 * - 롱노트는 두 표준 방식을 지원한다: 채널 5x(LNTYPE 1 — 같은 레인의 시작/끝 오브젝트 쌍)와
 *   #LNOBJ(채널 1x에서 지정 값이 직전 노트를 끝내는 종료 마커). 결과 노트는 endTimeMs를 가진다
 *   (롱노트면 끝 시각, 탭이면 null). LNTYPE 2(구식 MGQ 방식)는 지원하지 않는다.
 * - STOP(채널 09)과 P2(채널 2x)는 구현하지 않는다(기타도라엔 불필요). 비가시 노트(3x/4x)·지뢰(Dx)도 무시.
 *
 * 참고(검증 출처):
 *   - BMS command memo (hitkey): https://hitkey.bms.ms/cmds.htm
 *   - Be-Music Source (Wikipedia): https://en.wikipedia.org/wiki/Be-Music_Source
 *   - Extended BPM (hitkey): https://bms.ms/~hitkey/exbpm-object.htm
 */

// #XXXYY:데이터  (XXX=마디 3자리, YY=채널 2자리, 나머지=오브젝트 열)
const DATA_LINE = /^#(\d{3})([0-9A-Za-z]{2}):(.*)$/;
// #WORD 값  (헤더 명령. WORD는 영문으로 시작, #BPMxx 같은 인덱스형도 포함)
const HEADER_LINE = /^#([A-Za-z][A-Za-z0-9]*)\s*(.*)$/;

/** base36 한 자리(또는 문자열)를 정수로. 실패 시 0. */
function base36(s) {
    const n = parseInt(s, 36);
    return Number.isNaN(n) ? 0 : n;
}

/** 데이터 문자열을 2자씩 오브젝트로 분할. 공백 제거, 끝의 홀수 문자는 버림. */
function splitObjects(data) {
    const clean = data.replace(/\s+/g, "");
    const objs = [];
    for (let i = 0; i + 1 < clean.length; i += 2) {
        objs.push(clean.slice(i, i + 2));
    }
    return objs;
}

function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}

/** 마디 내 위치 i/n을 기약분수 [num, den]으로. i=0이면 [0, 1]. */
function reducePosition(i, n) {
    if (i === 0) return [0, 1];
    const g = gcd(i, n) || 1;
    return [i / g, n / g];
}

/**
 * BMS 텍스트를 파싱한다.
 *
 * @param {string} text - BMS 파일 내용
 * @param {object} [opts]
 * @param {number} [opts.defaultMeasureBeats=4] - 마디 기본 박자 수(4/4 기준 4박)
 * @param {number} [opts.defaultBpm=130] - #BPM 생략 시 기본 BPM(BMS 관례값)
 * @returns {{
 *   ok: boolean,
 *   meta?: { title: string, artist: string, initialBpm: number, player: number,
 *            playLevel: number|null, laneCount: number },
 *   timing?: { initialBpm: number, bpmEvents: Array<{beat:number, bpm:number}>,
 *              measures: Array<{index:number, beats:number}> },
 *   cycle?: { measureCount: number, timeMs: number },
 *   notes?: Array<{ lane:number, value:string, measure:number,
 *                   position:[number,number], timeMs:number, endTimeMs:number|null }>,
 * }}
 *   - notes는 timeMs 오름차순 정렬. 레인 번호는 채널 둘째 자리 base36 값.
 *   - endTimeMs: 롱노트의 끝 시각(ms). 탭 노트는 null.
 *   - cycle.timeMs = 곡 전체 길이(= 1 루프 사이클).
 */
export function parse(text, { defaultMeasureBeats = 4, defaultBpm = 130 } = {}) {
    if (!text || !text.trim()) return { ok: false };

    const meta = {
        title: "",
        artist: "",
        initialBpm: defaultBpm,
        player: 1,
        playLevel: null,
        laneCount: 0,
    };
    const bpmDefs = {}; // #BPMxx → bpm (확장 BPM 정의)
    let lnobj = null; // #LNOBJ — 채널 1x에서 롱노트 끝을 나타내는 오브젝트 값(대문자)
    let lntype = 1; // #LNTYPE — 1=채널 5x 시작/끝 쌍(지원). 2(MGQ)는 미지원

    // measureData: Map<마디번호, Map<채널, string[]>> (같은 마디·채널 중복 라인은 누적)
    const measureData = new Map();
    let maxMeasure = 0;

    // ---- 1. 라인 분류 (헤더 / 데이터) ----
    for (const rawLine of text.split(/\r\n|\r|\n/)) {
        const line = rawLine.trim();
        if (!line || line[0] !== "#") continue;

        const dm = DATA_LINE.exec(line);
        if (dm) {
            const measure = parseInt(dm[1], 10);
            const channel = dm[2].toUpperCase();
            if (measure > maxMeasure) maxMeasure = measure;
            if (!measureData.has(measure)) measureData.set(measure, new Map());
            const chMap = measureData.get(measure);
            if (!chMap.has(channel)) chMap.set(channel, []);
            chMap.get(channel).push(dm[3]);
            continue;
        }

        const hm = HEADER_LINE.exec(line);
        if (!hm) continue;
        const word = hm[1].toUpperCase();
        const value = hm[2].trim();

        // 확장 정의형: #BPMxx (5자) — 초기 #BPM(3자)과 구분
        if (word.length === 5 && word.startsWith("BPM")) {
            bpmDefs[word.slice(3)] = parseFloat(value);
            continue;
        }
        switch (word) {
            case "PLAYER":
                meta.player = parseInt(value, 10) || 1;
                break;
            case "BPM":
                meta.initialBpm = parseFloat(value) || defaultBpm;
                break;
            case "TITLE":
                meta.title = value;
                break;
            case "ARTIST":
                meta.artist = value;
                break;
            case "PLAYLEVEL":
                meta.playLevel = parseInt(value, 10);
                break;
            case "LNOBJ":
                lnobj = value.toUpperCase().slice(0, 2) || null;
                break;
            case "LNTYPE":
                lntype = parseInt(value, 10) || 1;
                break;
            // RANK·WAVxx 등은 무시. STOPxx(채널 09)는 구현하지 않음.
            default:
                break;
        }
    }

    const measureCount = maxMeasure + 1;

    // ---- 2. 마디 길이(채널 02) → 마디별 박자 수, 누적 시작 박자 ----
    const measures = [];
    const measureStartBeat = [];
    let accBeat = 0;
    for (let m = 0; m < measureCount; m++) {
        let beats = defaultMeasureBeats;
        const chMap = measureData.get(m);
        if (chMap && chMap.has("02")) {
            const arr = chMap.get("02");
            // 같은 마디에 02가 여러 번이면 마지막 값 채택
            const ratio = parseFloat(arr[arr.length - 1]);
            if (!Number.isNaN(ratio) && ratio > 0) {
                beats = ratio * defaultMeasureBeats;
            }
        }
        measures.push({ index: m, beats });
        measureStartBeat[m] = accBeat;
        accBeat += beats;
    }
    const totalBeats = accBeat;

    // ---- 3. BPM 변경(채널 03=16진, 08=#BPMxx 참조) → bpmEvents ----
    const bpmEvents = [];
    for (let m = 0; m < measureCount; m++) {
        const chMap = measureData.get(m);
        if (!chMap) continue;
        const start = measureStartBeat[m];
        const beatsInMeasure = measures[m].beats;

        const collect = (channel, toBpm) => {
            if (!chMap.has(channel)) return;
            for (const data of chMap.get(channel)) {
                const objs = splitObjects(data);
                const n = objs.length;
                objs.forEach((obj, i) => {
                    if (obj === "00") return;
                    const bpm = toBpm(obj);
                    if (bpm == null || Number.isNaN(bpm)) return;
                    bpmEvents.push({ beat: start + (i / n) * beatsInMeasure, bpm });
                });
            }
        };
        collect("03", (obj) => parseInt(obj, 16)); // 16진 BPM 01~FF
        collect("08", (obj) => bpmDefs[obj] ?? null); // 확장 BPM 참조
    }
    bpmEvents.sort((a, b) => a.beat - b.beat);

    // ---- 4. 박자→ms 변환기 (BPM 구간 적분) ----
    const segments = [{ beat: 0, bpm: meta.initialBpm }];
    for (const ev of bpmEvents) {
        if (ev.beat <= 0) segments[0].bpm = ev.bpm;
        else segments.push(ev);
    }
    const beatToMs = (targetBeat) => {
        let ms = 0;
        for (let i = 0; i < segments.length; i++) {
            const b0 = segments[i].beat;
            const b1 = i + 1 < segments.length ? segments[i + 1].beat : Infinity;
            const segEnd = Math.min(b1, targetBeat);
            if (segEnd > b0) ms += (segEnd - b0) * (60000 / segments[i].bpm);
            if (b1 >= targetBeat) break;
        }
        return ms;
    };

    // ---- 5. P1 가시 노트 → 레인별 노트 오브젝트 ----
    // 채널 1x(탭/LNOBJ 롱노트)와 5x(LNTYPE 1 롱노트)를 다룬다. LNOBJ 종료·5x 쌍 매칭은
    // 마디 경계를 넘어 시간순으로 처리해야 올바르므로, 먼저 레인별로 모아 정렬한 뒤 해석한다.
    const tapEventsByLane = new Map(); // 채널 1x: lane → [{beat, value, measure, position}]
    const lnEventsByLane = new Map(); // 채널 5x: lane → [{beat, value, measure, position}]
    for (let m = 0; m < measureCount; m++) {
        const chMap = measureData.get(m);
        if (!chMap) continue;
        const start = measureStartBeat[m];
        const beatsInMeasure = measures[m].beats;

        for (const [channel, dataArr] of chMap) {
            const cat = channel[0];
            if (cat !== "1" && cat !== "5") continue; // P1 가시 노트(1x)·P1 롱노트(5x)만
            const lane = base36(channel[1]); // 레인 번호 = 둘째 자리
            const target = cat === "1" ? tapEventsByLane : lnEventsByLane;
            if (!target.has(lane)) target.set(lane, []);
            const bucket = target.get(lane);
            for (const data of dataArr) {
                const objs = splitObjects(data);
                const n = objs.length;
                objs.forEach((obj, i) => {
                    if (obj === "00") return;
                    bucket.push({
                        beat: start + (i / n) * beatsInMeasure,
                        value: obj.toUpperCase(),
                        measure: m,
                        position: reducePosition(i, n),
                    });
                });
            }
        }
    }

    const notes = [];
    const noteLanes = new Set();

    // 5a. 채널 1x: 탭 노트. #LNOBJ 값을 만나면 같은 레인의 직전 노트를 롱노트로 종료한다.
    for (const [lane, events] of tapEventsByLane) {
        events.sort((a, b) => a.beat - b.beat);
        let lastNote = null; // 이 레인에서 마지막으로 추가한 (아직 닫히지 않은) 탭 노트
        for (const ev of events) {
            if (lnobj && ev.value === lnobj) {
                // 롱노트 종료 마커: 직전 노트를 롱노트로 만들고, 마커 자체는 노트로 두지 않는다.
                if (lastNote) {
                    lastNote.endTimeMs = beatToMs(ev.beat);
                    lastNote = null;
                }
                continue;
            }
            const note = {
                lane,
                value: ev.value,
                measure: ev.measure,
                position: ev.position,
                timeMs: beatToMs(ev.beat),
                endTimeMs: null,
            };
            notes.push(note);
            noteLanes.add(lane);
            lastNote = note;
        }
    }

    // 5b. 채널 5x(LNTYPE 1): 시간순 오브젝트를 (시작, 끝) 쌍으로 묶어 롱노트로 만든다.
    // LNTYPE 2(MGQ 방식)는 미지원이라 5x 채널을 해석하지 않고 버린다.
    if (lntype === 1) {
        for (const [lane, events] of lnEventsByLane) {
            events.sort((a, b) => a.beat - b.beat);
            for (let i = 0; i < events.length; i += 2) {
                const head = events[i];
                const tail = events[i + 1]; // 짝이 없으면(홀수) endTimeMs=null인 탭으로 떨어진다.
                notes.push({
                    lane,
                    value: head.value,
                    measure: head.measure,
                    position: head.position,
                    timeMs: beatToMs(head.beat),
                    endTimeMs: tail ? beatToMs(tail.beat) : null,
                });
                noteLanes.add(lane);
            }
        }
    }

    for (const lane of noteLanes) {
        if (lane > meta.laneCount) meta.laneCount = lane;
    }
    notes.sort((a, b) => a.timeMs - b.timeMs || a.lane - b.lane);

    return {
        ok: true,
        meta,
        timing: { initialBpm: meta.initialBpm, bpmEvents, measures },
        cycle: { measureCount, timeMs: beatToMs(totalBeats) },
        notes,
    };
}
