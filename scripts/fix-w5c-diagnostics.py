from pathlib import Path

path = Path('src/components/solar-system/webgpu/WebGPULab.tsx')
text = path.read_text()

old_object = '''      textureFormats,
      textureLastError,
      metrics,
'''
new_object = '''      textureFormats,
      textureLastError,
      postProcessingEnabled,
      metrics,
'''
if new_object not in text:
    if old_object not in text:
        raise SystemExit('Could not find W5c diagnostics object insertion point')
    text = text.replace(old_object, new_object, 1)

old_dependencies = '''  }, [
    metrics,
    rendererInfo,
'''
new_dependencies = '''  }, [
    metrics,
    postProcessingEnabled,
    rendererInfo,
'''
if new_dependencies not in text:
    if old_dependencies not in text:
        raise SystemExit('Could not find W5c diagnostics dependency insertion point')
    text = text.replace(old_dependencies, new_dependencies, 1)

path.write_text(text)
Path(__file__).unlink()
