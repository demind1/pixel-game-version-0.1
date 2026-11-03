"""Build a self-contained HTML game plus a ZIP. Python stdlib only."""
from pathlib import Path
import argparse
import base64
import json
import mimetypes
import re
import zipfile

ROOT = Path(__file__).resolve().parent

def build(output=None):
    tag='v'+json.loads((ROOT/'package.json').read_text())['version'].replace('.','')
    output = Path(output) if output else ROOT / 'dist'
    output.mkdir(parents=True, exist_ok=True)
    assets = {}
    for file in sorted((ROOT / 'assets').iterdir()):
        if file.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.ogg', '.mp3', '.wav'}:
            continue
        mime = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
        assets[file.name] = 'data:' + mime + ';base64,' + base64.b64encode(file.read_bytes()).decode('ascii')
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
        lambda m: '<style>\n' + (ROOT/m[1]).read_text(encoding='utf-8') + '\n</style>', html)
    # Apply asset resolution to inline and generated audio/image URLs. No fetch.
    prefix = '<script>window.HIVE_ASSETS=' + json.dumps(assets, separators=(',', ':')) + ';\n'
    prefix += 'window.hiveAsset=(name)=>window.HIVE_ASSETS[name]||"assets/"+name;</script>'
    def script(match):
        source = (ROOT / match[1]).read_text(encoding='utf-8')
        source = source.replace("image.src='assets/'+file;", "image.src=window.hiveAsset(file);")
        source = source.replace("new Audio('assets/'+name+'.ogg')", "new Audio(window.hiveAsset(name+'.ogg'))")
        return '<script>\n' + source.replace('</script', '<\\/script') + '\n</script>'
    html = re.sub(r'<script src="([^"]+)"></script>', script, html)
    html = html.replace('<head>', '<head>\n' + prefix)
    html = re.sub(r'src="assets/([^"]+)"', lambda m: 'src="'+assets[m[1]]+'"', html)
    target = output / f'HIVEBREAK_REFORGED_{tag}.html'
    target.write_text(html, encoding='utf-8')
    archive = output / f'HIVEBREAK_REFORGED_{tag}.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(target, target.name)
        for filename in ['README.md', 'CHANGELOG.md', 'docs/VALIDATION.md','docs/VERSION_1_0.md','vendor/THREE_LICENSE.txt']:
            file=ROOT/filename
            if file.exists(): z.write(file, filename)
    print(f'{target}: {target.stat().st_size:,} bytes; {len(assets)} embedded assets')
    print(f'{archive}: {archive.stat().st_size:,} bytes')
    return target

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output', type=Path)
    build(parser.parse_args().output)
