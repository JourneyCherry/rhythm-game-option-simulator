import * as Monitor from "./Monitor.mjs";

/**
 * 현재 config와 모니터 정보를 기반으로 분석 수치를 계산합니다.
 * @param {object} config - 현재 옵션 설정값
 * @returns {object} 분석 수치 객체
 */
export function getAnalysis(config) {
    // TODO: 판정선 위치(%) 및 화면 높이를 기준으로 노트 표시 시간(ms) 계산
    //       speed 값, 화면 비율, 판정선 위치를 사용
    const displayTimeMs = null;

    // TODO: 픽셀 간격(mm)과 speed 값으로 낙하 속도(mm/s) 계산
    //       Monitor.getPixelPitchMm() 활용
    const fallSpeedMmPerSec = null;

    // TODO: sudden(%)과 hidden(%)을 고려한 노트 유효 구간(%) 계산
    const effectiveRangePercent = null;

    return {
        displayTimeMs,
        fallSpeedMmPerSec,
        effectiveRangePercent,
    };
}
