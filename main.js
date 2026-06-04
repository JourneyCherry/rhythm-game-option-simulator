import { loadPresets } from "./constants/Preset.mjs";
import * as OptionService from "./services/Option.mjs";
import * as GFKonasutePreview from "./services/GFKonasutePreview.mjs";
import * as GFArenaPreview from "./services/GFArenaPreview.mjs";
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

    const { defaultPresetId, presetMap } = await loadPresets();
    let currentPreset = presetMap[defaultPresetId];

    const config = OptionService.initConfig(currentPreset);

    const app = document.getElementById("app");
    setDockClass(app, currentPreset.optionsDock);

    // gameProfile → 캔버스 렌더러 모듈 맵. 게임 추가 시 여기에 항목을 추가한다.
    const PREVIEWS = {
        konasute: GFKonasutePreview,
        arena: GFArenaPreview,
    };

    // 현재 활성 렌더러 모듈
    let _activePreview = null;

    // ---- TopBar ----
    TopBar.init(document.getElementById("top-bar"), {
        presets: Object.values(presetMap),
        currentPresetId: defaultPresetId,
        onGameChange: handleGameChange,
        onMonitorClick: () => MonitorModal.open(false),
        onHamburger: handleHamburger,
    });

    // ---- PreviewArea ----
    // 재생/일시정지/리셋 콜백은 activatePreview()가 활성 렌더러에 맞춰 설정한다.
    PreviewArea.init(document.getElementById("preview-area"), {
        previewAspect: currentPreset.previewAspect ?? 16 / 9,
    });

    // ---- AnalysisPanel ----
    // 분석 계산은 활성 렌더러(_activePreview)의 getAnalysis에 위임된다.
    const analysisPanel = AnalysisPanel.init(
        document.getElementById("analysis-panel"),
        {
            getAnalysis: () => Analysis.getAnalysis(config, _activePreview),
        },
    );

    // ---- OptionsPanel ----
    OptionsPanel.init(document.getElementById("options-panel"), {
        layout: currentPreset.optionsLayout ?? "rows",
        options: currentPreset.options,
        values: config,
        onChange: (id, value) => {
            OptionService.applyOptionChange(id, value);
            analysisPanel.update();
        },
    });

    // ---- MonitorSettingsModal ----
    MonitorModal.init(document.getElementById("modal-root"), {
        onSave: (data) => {
            Monitor.save(data);
            TopBar.updateMonitorSummary(Monitor.getSummaryText());
            analysisPanel.update(); // 노트 속도는 모니터에 의존
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

    // 기본 프리셋의 렌더러로 시작
    activatePreview(currentPreset);

    // ======== 핸들러 ========

    // gameProfile에 맞는 캔버스 렌더러를 활성화한다.
    // 초기 진입과 게임 전환(konasute↔arena 등) 모두 이 함수를 통한다.
    function activatePreview(preset) {
        const preview = PREVIEWS[preset.gameProfile] ?? GFKonasutePreview;
        _activePreview = preview;
        preview.init({ canvas: PreviewArea.getCanvas(), config });
        PreviewArea.setCallbacks({
            onPlay: () => preview.start(),
            onPause: () => preview.stop(),
            onReset: () => preview.reset(),
        });
        BMSInput.setContent(preview.DEFAULT_BMS);
        preview.start();
        PreviewArea.setPlayState(true);
        analysisPanel.update();
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
            // 이전 렌더러 정지 후 새 게임 렌더러 활성화
            _activePreview?.stop();
            activatePreview(newPreset);
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
