const STORAGE_KEY = "rg-monitor";

// 기본 모니터 — 아케이드와 동일 환경(32" 1920×1080). 저장값이 없을 때 사용.
// 화면비는 항상 16:9로 고정이라 별도 필드를 두지 않는다.
const DEFAULT_MONITOR = {
    sizeInches: 32,
    widthPx: 1920,
    heightPx: 1080,
};

let _monitor = null;

export function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            _monitor = JSON.parse(stored);
        } catch {
            _monitor = { ...DEFAULT_MONITOR };
        }
    } else {
        _monitor = { ...DEFAULT_MONITOR };
    }
}

export function isSet() {
    return _monitor !== null && !!_monitor.widthPx && !!_monitor.heightPx;
}

export function getMonitor() {
    return _monitor ? { ..._monitor } : null;
}

export function save(data) {
    _monitor = { ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_monitor));
}

export function getSummaryText() {
    if (!isSet()) return "모니터 미설정";
    const m = _monitor;
    const parts = [];
    if (m.sizeInches) parts.push(`${m.sizeInches}"`);
    if (m.widthPx && m.heightPx) parts.push(`${m.widthPx}×${m.heightPx}`);
    return parts.join(" ") || "모니터 미설정";
}

/** 화소 간격(mm)을 계산합니다. 모니터 크기와 해상도가 모두 설정된 경우에만 유효. */
export function getPixelPitchMm() {
    if (!isSet() || !_monitor.sizeInches) return null;
    const diagonalMm = _monitor.sizeInches * 25.4;
    const diagPx = Math.sqrt(
        _monitor.widthPx ** 2 + _monitor.heightPx ** 2,
    );
    return diagonalMm / diagPx;
}
