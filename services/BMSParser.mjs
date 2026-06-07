/**
 * BMS(Be-Music Source) 텍스트 파서.
 *
 * 설계 원칙: "시간축은 파서, 공간축은 프리뷰".
 * - 파서는 게임 중립. 채널을 표준 BMS 규칙으로 해석해 **번호가 매겨진 레인**의
 *   노트로 산출한다. (레인 번호 = 채널 둘째 자리의 base36 값)
 * - 노트의 "언제 쳐져야 하는가(timeMs)"는 BPM 타임라인만으로 결정되는 게임 독립
 *   연산이므로 파서가 산출한다. "어디에 그려지는가(px)"는 렌더러가 담당한다.
 * - 변속(BPM 변화) 지원 구조를 갖추되(채널 03/08), 현재 고정 스크립트엔 사용하지 않는다.
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
 *                   position:[number,number], timeMs:number }>,
 * }}
 *   - notes는 timeMs 오름차순 정렬. 레인 번호는 채널 둘째 자리 base36 값.
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
            // RANK·LNTYPE·LNOBJ·WAVxx·STOPxx 등은 현재 스코프 외 — 무시
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

    // ---- 5. P1 가시 노트(채널 1x) → 레인별 노트 오브젝트 ----
    const notes = [];
    for (let m = 0; m < measureCount; m++) {
        const chMap = measureData.get(m);
        if (!chMap) continue;
        const start = measureStartBeat[m];
        const beatsInMeasure = measures[m].beats;

        for (const [channel, dataArr] of chMap) {
            if (channel[0] !== "1") continue; // P1 가시 노트만
            const lane = base36(channel[1]); // 레인 번호 = 둘째 자리
            for (const data of dataArr) {
                const objs = splitObjects(data);
                const n = objs.length;
                objs.forEach((obj, i) => {
                    if (obj === "00") return;
                    const beat = start + (i / n) * beatsInMeasure;
                    notes.push({
                        lane,
                        value: obj,
                        measure: m,
                        position: reducePosition(i, n),
                        timeMs: beatToMs(beat),
                    });
                    if (lane > meta.laneCount) meta.laneCount = lane;
                });
            }
        }
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
