// 모니터 설정 보관(분석용).
// 모니터 크기(인치)는 게임별 옵션 쿠키(OptionStore, `rg-opt-<presetId>`)에 옵션값과 함께 저장되고,
// 해상도(widthPx·heightPx)는 게임 defaultMonitor에서 온다. 화면비는 항상 16:9 고정.
// 이 모듈은 현재 모니터값을 들고 요약·픽셀 피치만 계산한다(쿠키·영속화는 Option/OptionStore가 담당).

let _monitor = null;

// 현재 모니터값을 설정한다. { sizeInches, widthPx, heightPx } | null
export function set(monitor) {
    _monitor = monitor ? { ...monitor } : null;
}

export function isSet() {
    return _monitor !== null && !!_monitor.widthPx && !!_monitor.heightPx;
}

export function getMonitor() {
    return _monitor ? { ..._monitor } : null;
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
