import { loadPresets } from "./constants/Preset.mjs";
import * as OptionService from "./services/Option.mjs";
import * as GFKonasutePreview from "./services/GFKonasutePreview.mjs";
import * as GFArenaPreview from "./services/GFArenaPreview.mjs";
import * as Monitor from "./services/Monitor.mjs";
import * as Analysis from "./services/Analysis.mjs";
import * as TopBar from "./views/TopBar.mjs";
import * as OptionsPanel from "./views/OptionsPanel.mjs";
import * as PreviewArea from "./views/PreviewArea.mjs";
import * as AnalysisPanel from "./views/AnalysisPanel.mjs";
import * as MonitorModal from "./views/MonitorSettingsModal.mjs";
import * as MobilePreviewTabs from "./views/MobilePreviewTabs.mjs";

async function init() {
    Monitor.init();

    const { defaultPresetId, presetMap } = await loadPresets();
    let currentPreset = presetMap[defaultPresetId];

    // 모니터 설정은 게임에 종속 — 기본 게임의 기본 모니터로 덮어쓴다.
    // (개인 모니터 영속화는 추후 쿠키 등으로 별도 처리 예정)
    if (currentPreset.defaultMonitor) Monitor.save(currentPreset.defaultMonitor);

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
            // 일시정지 중에도 변경을 즉시 반영(재생 중에는 무해한 추가 1프레임).
            _activePreview?.redraw();
        },
        // 프리셋(버튼형) 옵션: applies 맵을 config에 일괄 반영하고 패널을 재렌더해
        // 영향받은 옵션의 슬라이더/칩 표시를 갱신한다. 프리셋 버튼 자체는 무상태.
        onApplyPreset: (applies) => {
            for (const [k, v] of Object.entries(applies)) {
                OptionService.applyOptionChange(k, v);
            }
            OptionsPanel.render(currentPreset.options, config);
            analysisPanel.update();
            _activePreview?.redraw();
        },
    });

    // ---- MonitorSettingsModal ----
    MonitorModal.init(document.getElementById("modal-root"), {
        onSave: (data) => {
            Monitor.save(data);
            TopBar.updateMonitorSummary(Monitor.getSummaryText());
            analysisPanel.update(); // 노트 속도는 모니터에 의존
        },
        // 초기화: 현재 게임의 기본 모니터로 되돌리고(저장·요약·폼·분석 갱신) 모달은 열어 둔다.
        onReset: () => applyGameMonitor(currentPreset),
        monitor: Monitor.getMonitor(),
    });

    // ---- 모바일 상단 세그먼트 탭 ([프리뷰][분석]) ----
    // 모바일에선 상단 존(#preview-area)에서 프리뷰↔분석을 전환하고, 옵션은 항상 아래에 표시된다.
    const previewArea = document.getElementById("preview-area");
    const analysisEl = document.getElementById("analysis-panel");

    const segTabsEl = document.createElement("div");
    previewArea.prepend(segTabsEl);
    MobilePreviewTabs.init(segTabsEl, {
        onModeChange: (mode) => {
            previewArea.classList.toggle("mode-analysis", mode === "analysis");
        },
    });

    // 분석 패널 위치 동기화: 모바일=상단 존(#preview-area) 내부, 그 외=그리드 영역(#app 직속).
    // (그리드 배치는 grid-area로 결정되므로 #app 내 DOM 순서는 무관)
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    function syncAnalysisPosition(e) {
        if (e.matches) previewArea.appendChild(analysisEl);
        else app.appendChild(analysisEl);
    }
    mobileQuery.addEventListener("change", syncAnalysisPosition);
    syncAnalysisPosition(mobileQuery);

    // ---- 사이드바 백드롭 ----
    const backdrop = document.getElementById("sidebar-backdrop");
    backdrop.addEventListener("click", closeSidebar);

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
            // 게임별 기본 모니터로 덮어쓰기
            applyGameMonitor(newPreset);
            // 이전 렌더러 정지 후 새 게임 렌더러 활성화
            _activePreview?.stop();
            activatePreview(newPreset);
        });
        TopBar.setSelectedPreset(presetId);
    }

    // 선택된 게임의 기본 모니터로 모니터 설정을 덮어쓰고 관련 UI를 갱신한다.
    function applyGameMonitor(preset) {
        if (!preset.defaultMonitor) return;
        Monitor.save(preset.defaultMonitor);
        TopBar.updateMonitorSummary(Monitor.getSummaryText());
        MonitorModal.setMonitor(Monitor.getMonitor());
        analysisPanel.update(); // 노트 속도는 모니터에 의존
    }

    function handleHamburger() {
        const panel = document.getElementById("options-panel");
        const isOpen = panel.classList.toggle("sidebar-open");
        backdrop.classList.toggle("active", isOpen);
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
