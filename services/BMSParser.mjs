/**
 * BMS 텍스트를 파싱하여 노트 데이터를 반환합니다.
 * @param {string} text - BMS 파일 내용
 * @returns {object|null} 파싱된 노트 데이터, 실패 시 null
 */
export function parse(text) {
    if (!text || !text.trim()) return null;

    // TODO: BMS 헤더 파싱 (#BPM, #PLAYER, #PLAYLEVEL 등)
    // TODO: BMS 채널 데이터 파싱 (#xxxxx: 데이터)
    // TODO: 파싱 결과를 노트 배열로 변환하여 반환
    //       반환 형식 예시:
    //       {
    //           bpm: number,
    //           notes: Array<{ time: number, lane: number, type: 'note'|'long' }>,
    //           totalMeasures: number,
    //       }

    console.warn("BMSParser.parse: 구현 예정");
    return null;
}
