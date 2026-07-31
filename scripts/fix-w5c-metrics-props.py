from pathlib import Path

path = Path('src/components/solar-system/webgpu/WebGPULabScene.tsx')
text = path.read_text()
old = 'function LabMetricsProbe({ onMetrics }: WebGPULabSceneProps) {'
new = "function LabMetricsProbe({\n  onMetrics,\n}: Pick<WebGPULabSceneProps, 'onMetrics'>) {"
if new not in text:
    if old not in text:
        raise SystemExit('Could not find LabMetricsProbe prop type')
    text = text.replace(old, new, 1)
path.write_text(text)
Path(__file__).unlink()
