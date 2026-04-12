export async function loadPresets() {
    const res = await fetch("./game_presets.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`failed to load presets: ${res.status}`);
    const data = await res.json();
    const presetMap = Object.fromEntries(data.presets.map((p) => [p.id, p]));
    return { defaultPresetId: data.defaultPresetId, presetMap };
}
