// 게임(프리셋)별 마지막 설정값을 쿠키에 저장/복원한다.
// 게임을 다시 선택하면 그 게임의 옵션값과 모니터 크기(monitorSizeInches)를 함께 불러온다.
// 저장 대상은 Option.mjs의 config 객체 전체(게임 옵션 + monitorSizeInches)다.

import { getCookie, setCookie } from "./Cookie.mjs";

const COOKIE_PREFIX = "rg-opt-";

/** 프리셋의 마지막 옵션값을 반환한다 (없거나 파싱 실패 시 null). */
export function load(presetId) {
    const raw = getCookie(COOKIE_PREFIX + presetId);
    if (!raw) return null;
    try {
        const obj = JSON.parse(decodeURIComponent(raw));
        return obj && typeof obj === "object" ? obj : null;
    } catch {
        return null;
    }
}

/** 프리셋의 현재 옵션값을 쿠키에 저장한다. */
export function save(presetId, values) {
    setCookie(COOKIE_PREFIX + presetId, encodeURIComponent(JSON.stringify(values)));
}
