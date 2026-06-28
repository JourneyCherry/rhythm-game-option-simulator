// 쿠키 read/write 유틸 — 옵션값(OptionStore)·모니터 크기(Monitor) 등 영속화에 공용으로 쓴다.

const DEFAULT_MAX_AGE_DAYS = 365;

/** 쿠키를 기록한다. days를 음수로 주면 즉시 만료(삭제)된다. */
export function setCookie(name, value, days = DEFAULT_MAX_AGE_DAYS) {
    const maxAge = Math.round(days * 24 * 60 * 60);
    document.cookie = `${name}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

/** 쿠키 값을 반환한다 (없으면 null). */
export function getCookie(name) {
    const prefix = `${name}=`;
    const parts = document.cookie ? document.cookie.split("; ") : [];
    for (const part of parts) {
        if (part.startsWith(prefix)) return part.slice(prefix.length);
    }
    return null;
}
