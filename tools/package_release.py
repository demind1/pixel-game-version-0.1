"""Publish local release files after building and verifying the portable HTML.
Run from any directory: python3 tools/package_release.py
The source ZIP includes tracked source files, never previous release archives.
"""
from pathlib import Path
import hashlib,json,shutil,subprocess,zipfile
ROOT=Path(__file__).resolve().parents[1]

def package():
 version=json.loads((ROOT/'package.json').read_text())['version'];tag='v'+version.replace('.','')
 out=ROOT/'downloads';out.mkdir(exist_ok=True)
 portable=ROOT/'dist'/f'HIVEBREAK_REFORGED_{tag}.html'
 game=out/f'HIVEBREAK_REFORGED_{tag}.zip'
 source=out/f'HIVEBREAK_REFORGED_{tag}_SOURCE.zip'
 built=ROOT/'dist'/game.name
 commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 names=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
 names=[n for n in names if n and not n.startswith(('downloads/','dist/','artifacts/','node_modules/'))]
 shutil.copy2(built,game)
 with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as archive:
  for name in sorted(names):archive.write(ROOT/name,f'HIVEBREAK_REFORGED_{tag}/{name}')
 for path in (game,source):
  with zipfile.ZipFile(path) as archive:
   assert archive.testzip() is None,f'Corrupt ZIP: {path.name}'
 with zipfile.ZipFile(game) as archive:assert archive.read(portable.name)==portable.read_bytes(),'Packaged HTML differs from verified build'
 describe=lambda p:{'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 result={'version':version,'source_commit':commit,'files':[describe(game),describe(source)],'standalone_html':describe(portable),'zip_crc':'passed','packaged_html_matches_build':True}
 (out/f'release-{tag}.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))

if __name__=='__main__':package()
