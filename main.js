import * as Option from "./views/Options.mjs";
import { loadPresets } from "./constants/Preset.mjs";
import * as OptionService from "./services/Option.mjs";
import * as Preview from "./services/Preview.mjs";

async function init() {
    console.log("Rhythm Game Option Simulator initialized");

    // CSS 변수에서 판정선 위치(%)를 읽어와서 0~1 범위 값으로 변환
    const rootStyles = getComputedStyle(document.documentElement);
    const judgeLinePercent = parseFloat(
        rootStyles.getPropertyValue("--judgeline-position"),
    );
    const JUDGE_LINE_Y = Number.isNaN(judgeLinePercent)
        ? 0.8
        : judgeLinePercent / 100;

    const { defaultPresetId, presetMap } = await loadPresets();
    const defaultPreset = presetMap[defaultPresetId];

    const config = OptionService.initConfig(defaultPreset);
    OptionService.applyCoverHeights();

    const noteLayer = document.getElementById("note-layer");
    const beatLayer = document.getElementById("beat-layer");
    if (!noteLayer || !beatLayer) {
        console.error("Note or beat layer not found");
        return;
    }

    Preview.init({ noteLayer, beatLayer, config, judgeLineY: JUDGE_LINE_Y });

    Option.init();

    function onPresetChange(preset) {
        Option.clearControls(Option.RootType.OPTION);
        Option.renderControlsForPreset(preset, OptionService.applyOptionChange);
    }

    Option.renderControlsForPreset(defaultPreset, OptionService.applyOptionChange);
    Option.createSelectControl(Option.RootType.BASE, {
        type: "select",
        id: "gamePreset",
        label: "Game Preset",
        options: Object.values(presetMap).map((p) => ({
            value: p.id,
            label: p.label,
        })),
        defaultValue: defaultPresetId,
        apply(_id, value) {
            OptionService.applyPreset(value, presetMap, onPresetChange);
        },
    });

    Preview.start();
}

document.addEventListener("DOMContentLoaded", () => {
    init().catch(console.error);
});
