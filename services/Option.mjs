import * as OptionStore from "./OptionStore.mjs";

let config = {};
let currentPresetId = null;

export function initConfig(preset) {
    config = makeConfigFromPreset(preset);
    config.monitorSizeInches = preset.defaultMonitor?.sizeInches ?? null;
    applySavedValues(config, preset, OptionStore.load(preset.id));
    currentPresetId = preset.id;
    return config; // Preview.mjs에 공유할 참조 반환
}

export function makeConfigFromPreset(preset) {
    const cfg = {};
    for (const opt of preset.options) {
        cfg[opt.id] = opt.defaultValue;
    }
    return cfg;
}

// 쿠키에서 불러온 마지막 값을 config에 덮어쓴다.
// 게임 옵션(프리셋에 존재하는 id)과 모니터 크기(monitorSizeInches)를 함께 복원한다.
function applySavedValues(cfg, preset, saved) {
    if (!saved) return;
    for (const opt of preset.options) {
        if (Object.prototype.hasOwnProperty.call(saved, opt.id)) {
            cfg[opt.id] = saved[opt.id];
        }
    }
    if (Object.prototype.hasOwnProperty.call(saved, "monitorSizeInches")) {
        cfg.monitorSizeInches = saved.monitorSizeInches;
    }
}

export function getConfig() {
    return config;
}

export function applyOptionChange(id, value) {
    switch (id) {
        case "direction": {
            const v = parseInt(value, 10);
            if (v === 1 || v === -1) config.direction = v;
            break;
        }
        default:
            config[id] = value;
            break;
    }
    // 변경된 옵션값을 현재 게임의 쿠키에 저장 (다음에 이 게임을 선택하면 복원)
    if (currentPresetId) OptionStore.save(currentPresetId, config);
}

export function applyPreset(presetId, presetMap, onPresetsChange) {
    if (presetId === currentPresetId) return;
    const preset = presetMap[presetId];
    if (!preset) return;

    currentPresetId = presetId;
    // 기본값으로 초기화한 뒤, 이 게임의 쿠키 저장값이 있으면 덮어쓴다.
    for (const opt of preset.options) {
        config[opt.id] = opt.defaultValue;
    }
    config.monitorSizeInches = preset.defaultMonitor?.sizeInches ?? null;
    applySavedValues(config, preset, OptionStore.load(preset.id));

    if (onPresetsChange) onPresetsChange(preset);
}

// 현재 게임의 모든 옵션을 프리셋 기본값으로 되돌리고 쿠키에 반영한다.
// (모니터 크기는 게임플레이 옵션이 아니므로 유지 — 모니터 초기화는 모달에서 별도.)
// config 참조는 유지(렌더러와 공유)하며, 갱신된 config를 반환한다.
export function resetToDefaults(preset) {
    for (const opt of preset.options) {
        config[opt.id] = opt.defaultValue;
    }
    if (currentPresetId) OptionStore.save(currentPresetId, config);
    return config;
}

// 모니터 크기(인치)를 config에 반영하고 현재 게임 쿠키에 저장한다.
export function setMonitorSize(sizeInches) {
    config.monitorSizeInches = sizeInches;
    if (currentPresetId) OptionStore.save(currentPresetId, config);
}

// 현재 게임의 모니터 크기(인치)를 반환한다 (없으면 null).
export function getMonitorSize() {
    return config.monitorSizeInches ?? null;
}
