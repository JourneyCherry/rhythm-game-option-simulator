import * as Monitor from "./Monitor.mjs";

/**
 * 현재 config·모니터 정보를 기반으로 분석 수치를 계산합니다.
 * 실제 계산은 게임별 렌더러의 동명 함수(`renderer.getAnalysis`)에 위임합니다.
 * 모든 게임이 같은 형태({ displayTimeMs, noteSpeedCmPerSec })를 반환하므로
 * 활성 렌더러만 바꿔 끼우면 동일한 분석 내용을 얻을 수 있습니다.
 *
 * @param {object} config - 현재 옵션 설정값
 * @param {object} renderer - 활성 캔버스 렌더러 모듈 (getAnalysis export 필요)
 * @returns {{ displayTimeMs: number|null, noteSpeedCmPerSec: number|null }}
 */
export function getAnalysis(config, renderer) {
    if (!renderer || typeof renderer.getAnalysis !== "function") {
        return { displayTimeMs: null, noteSpeedCmPerSec: null };
    }

    const monitor = Monitor.getMonitor();
    const monitorMetrics = monitor
        ? {
              pixelPitchMm: Monitor.getPixelPitchMm(),
              widthPx: monitor.widthPx,
              heightPx: monitor.heightPx,
          }
        : null;

    return renderer.getAnalysis(config, monitorMetrics);
}
