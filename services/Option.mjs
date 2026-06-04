let config = {};
let currentPresetId = null;

export function initConfig(preset) {
    config = makeConfigFromPreset(preset);
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
}

export function applyPreset(presetId, presetMap, onPresetsChange) {
    if (presetId === currentPresetId) return;
    const preset = presetMap[presetId];
    if (!preset) return;

    currentPresetId = presetId;
    for (const opt of preset.options) {
        config[opt.id] = opt.defaultValue;
    }

    if (onPresetsChange) onPresetsChange(preset);
}
