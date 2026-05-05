const STORAGE_KEY = "rg-monitor";

const PRESETS = [
    {
        label: "커스텀",
        sizeInches: null,
        widthPx: null,
        heightPx: null,
        refreshRateHz: null,
        inputDelayMs: 0,
    },
    {
        label: '24" 1920×1080 144Hz',
        sizeInches: 24,
        widthPx: 1920,
        heightPx: 1080,
        refreshRateHz: 144,
        inputDelayMs: 0,
    },
    {
        label: '27" 1920×1080 60Hz',
        sizeInches: 27,
        widthPx: 1920,
        heightPx: 1080,
        refreshRateHz: 60,
        inputDelayMs: 0,
    },
    {
        label: '27" 2560×1440 165Hz',
        sizeInches: 27,
        widthPx: 2560,
        heightPx: 1440,
        refreshRateHz: 165,
        inputDelayMs: 0,
    },
    {
        label: '32" 3840×2160 60Hz',
        sizeInches: 32,
        widthPx: 3840,
        heightPx: 2160,
        refreshRateHz: 60,
        inputDelayMs: 0,
    },
    {
        label: '15.6" 1920×1080 60Hz (노트북)',
        sizeInches: 15.6,
        widthPx: 1920,
        heightPx: 1080,
        refreshRateHz: 60,
        inputDelayMs: 0,
    },
];

let _monitor = null;

export function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            _monitor = JSON.parse(stored);
        } catch {
            _monitor = null;
        }
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

export function getPresets() {
    return PRESETS;
}

export function getSummaryText() {
    if (!isSet()) return "모니터 미설정";
    const m = _monitor;
    const parts = [];
    if (m.sizeInches) parts.push(`${m.sizeInches}"`);
    if (m.widthPx && m.heightPx) parts.push(`${m.widthPx}×${m.heightPx}`);
    if (m.refreshRateHz) parts.push(`${m.refreshRateHz}Hz`);
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
