// TODO: 분석 수치 계산 로직이 구현되면 카드 업데이트 활성화 (services/Analysis.mjs 참조)

const METRICS = [
    { key: "displayTimeMs", label: "노트 표시 시간", unit: "ms" },
    { key: "fallSpeedMmPerSec", label: "낙하 속도", unit: "mm/s" },
    { key: "effectiveRangePercent", label: "유효 구간", unit: "%" },
];

let _cardValueEls = {};
let _getAnalysis = null;

/**
 * 분석 패널을 초기화합니다.
 * @param {HTMLElement} container - #analysis-panel 요소
 * @param {object} opts
 * @param {function} opts.getAnalysis - () => { displayTimeMs, fallSpeedMmPerSec, effectiveRangePercent }
 * @returns {{ update: function }} - update()를 호출하면 카드를 갱신
 */
export function init(container, { getAnalysis }) {
    _getAnalysis = getAnalysis;
    _cardValueEls = {};

    container.innerHTML = "";

    const title = document.createElement("div");
    title.className = "panel-title";
    title.textContent = "분석";

    const inner = document.createElement("div");
    inner.className = "analysis-panel-inner";

    METRICS.forEach(({ key, label, unit }) => {
        const card = document.createElement("div");
        card.className = "analysis-card";

        const labelEl = document.createElement("div");
        labelEl.className = "card-label";
        labelEl.textContent = label;

        const valueEl = document.createElement("div");
        valueEl.className = "card-value";
        valueEl.textContent = "—";

        const unitEl = document.createElement("div");
        unitEl.className = "card-unit";
        unitEl.textContent = unit;

        card.append(labelEl, valueEl, unitEl);
        inner.appendChild(card);
        _cardValueEls[key] = valueEl;
    });

    container.append(title, inner);

    return { update };
}

/** 분석 수치를 다시 계산하여 카드를 갱신합니다. */
export function update() {
    // TODO: getAnalysis()가 실제 값을 반환하면 여기서 카드 갱신
    if (!_getAnalysis) return;
    const analysis = _getAnalysis();
    METRICS.forEach(({ key }) => {
        const el = _cardValueEls[key];
        if (!el) return;
        const val = analysis[key];
        el.textContent = val != null ? String(val) : "—";
    });
}
