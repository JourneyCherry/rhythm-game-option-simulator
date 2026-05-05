import { loadPresets } from "./constants/Preset.mjs";
import * as OptionService from "./services/Option.mjs";
import * as Preview from "./services/Preview.mjs";
import * as Monitor from "./services/Monitor.mjs";
import * as Analysis from "./services/Analysis.mjs";
import * as BMSParser from "./services/BMSParser.mjs";
import * as TopBar from "./views/TopBar.mjs";
import * as OptionsPanel from "./views/OptionsPanel.mjs";
import * as PreviewArea from "./views/PreviewArea.mjs";
import * as AnalysisPanel from "./views/AnalysisPanel.mjs";
import * as MonitorModal from "./views/MonitorSettingsModal.mjs";
import * as BMSInput from "./views/BMSInput.mjs";
import * as MobileTabBar from "./views/MobileTabBar.mjs";

async function init() {
    Monitor.init();

    const rootStyles = getComputedStyle(document.documentElement);
    const judgeLinePercent = parseFloat(
        rootStyles.getPropertyValue("--judgeline-position"),
    );
    const JUDGE_LINE_Y = Number.isNaN(judgeLinePercent)
        ? 0.8
        : judgeLinePercent / 100;

    const { defaultPresetId, presetMap } = await loadPresets();
    let currentPreset = presetMap[defaultPresetId];

    const config = OptionService.initConfig(currentPreset);
    OptionService.applyCoverHeights();

    const app = document.getElementById("app");
    setDockClass(app, currentPreset.optionsDock);

    let _previewStarted = false;

    // ---- TopBar ----
    TopBar.init(document.getElementById("top-bar"), {
        presets: Object.values(presetMap),
        currentPresetId: defaultPresetId,
        onGameChange: handleGameChange,
        onMonitorClick: () => MonitorModal.open(false),
        onHamburger: handleHamburger,
    });

    // ---- PreviewArea ----
    PreviewArea.init(document.getElementById("preview-area"), {
        previewAspect: currentPreset.previewAspect ?? 16 / 9,
        onPlay: () => Preview.start(),
        onPause: () => Preview.stop(),
        onReset: handlePreviewReset,
    });

    // Preview 서비스 초기화 (PreviewArea DOM 생성 후)
    const noteLayer = document.getElementById("note-layer");
    const beatLayer = document.getElementById("beat-layer");
    if (!noteLayer || !beatLayer) {
        console.error("note-layer 또는 beat-layer를 찾을 수 없습니다.");
        return;
    }
    Preview.init({ noteLayer, beatLayer, config, judgeLineY: JUDGE_LINE_Y });

    // ---- OptionsPanel ----
    OptionsPanel.init(document.getElementById("options-panel"), {
        layout: currentPreset.optionsLayout ?? "rows",
        options: currentPreset.options,
        values: config,
        onChange: OptionService.applyOptionChange,
    });

    // ---- AnalysisPanel ----
    AnalysisPanel.init(document.getElementById("analysis-panel"), {
        getAnalysis: () => Analysis.getAnalysis(config),
    });

    // ---- MonitorSettingsModal ----
    MonitorModal.init(document.getElementById("modal-root"), {
        onSave: (data) => {
            Monitor.save(data);
            TopBar.updateMonitorSummary(Monitor.getSummaryText());
            startPreviewOnce();
        },
        monitor: Monitor.getMonitor(),
    });

    // ---- BMSInput ----
    // 하나의 DOM 요소를 뷰포트에 따라 footer ↔ 셋업탭 사이에서 이동
    const bmsEl = BMSInput.create({
        onParse: (text) => BMSParser.parse(text),
    });
    document.getElementById("footer-bms").appendChild(bmsEl);

    const mobileQuery = window.matchMedia("(max-width: 767px)");
    function syncBmsPosition(e) {
        const target = e.matches
            ? document.getElementById("mobile-bms")
            : document.getElementById("footer-bms");
        target.appendChild(bmsEl);
    }
    mobileQuery.addEventListener("change", syncBmsPosition);
    syncBmsPosition(mobileQuery);

    // ---- MobileTabBar ----
    MobileTabBar.init(document.getElementById("mobile-tab-bar"), {
        onTabChange: handleTabChange,
        initialTab: "options",
    });

    // ---- 사이드바 백드롭 ----
    const backdrop = document.getElementById("sidebar-backdrop");
    backdrop.addEventListener("click", closeSidebar);

    // 초기 탭 상태 적용
    handleTabChange("options");

    startPreviewOnce();

    // ======== 핸들러 ========

    function startPreviewOnce() {
        if (_previewStarted) return;
        _previewStarted = true;
        Preview.start();
    }

    function handleGameChange(presetId) {
        OptionService.applyPreset(presetId, presetMap, (newPreset) => {
            currentPreset = newPreset;
            setDockClass(app, newPreset.optionsDock);
            PreviewArea.setAspect(newPreset.previewAspect ?? 16 / 9);
            OptionsPanel.setLayout(
                newPreset.optionsLayout ?? "rows",
                newPreset.options,
                config,
            );
            OptionService.applyCoverHeights();
        });
        TopBar.setSelectedPreset(presetId);
    }

    function handleHamburger() {
        const panel = document.getElementById("options-panel");
        const isOpen = panel.classList.toggle("sidebar-open");
        backdrop.classList.toggle("active", isOpen);
    }

    function handleTabChange(tabId) {
        document.querySelectorAll(".tab-panel").forEach((el) => {
            el.classList.toggle("tab-active", el.dataset.tab === tabId);
        });
    }

    function handlePreviewReset() {
        Preview.stop();
        Preview.start();
    }

    function closeSidebar() {
        document.getElementById("options-panel").classList.remove("sidebar-open");
        backdrop.classList.remove("active");
    }
}

function setDockClass(app, dock) {
    app.classList.remove("dock-side", "dock-bottom");
    app.classList.add(dock === "bottom" ? "dock-bottom" : "dock-side");
}

document.addEventListener("DOMContentLoaded", () => {
    init().catch(console.error);
});
