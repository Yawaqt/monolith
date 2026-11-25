# Adds ?v=<version> to every local script/style reference so browsers load fresh files after an update.
# Run before each commit:  python3 tools/bump-version.py
import re, pathlib, time
v = time.strftime('%Y%m%d%H%M')
root = pathlib.Path(__file__).resolve().parent.parent
pat = re.compile(r"""((?:from\s+|import\s+)['"]\./[\w-]+\.js)(\?v=\d+)?(['"])""")
for f in (root / 'assets').glob('*.js'):
    s = f.read_text(); n = pat.sub(lambda m: f"{m.group(1)}?v={v}{m.group(3)}", s)
    if n != s: f.write_text(n)
h = root / 'index.html'; s = h.read_text()
s = re.sub(r'(assets/[\w.-]+\.(?:js|css))(\?v=\d+)?"', lambda m: f'{m.group(1)}?v={v}"', s)
h.write_text(s); print('version', v)
