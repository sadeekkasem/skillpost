# Builds test samples in ./samples. Usage: python3 make_samples.py <clean.xlsx> <any.png>
import os, sys, shutil, zipfile
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples"); os.makedirs(d, exist_ok=True)
src, png = sys.argv[1], sys.argv[2]
shutil.copy(src, f"{d}/clean.xlsx"); shutil.copy(png, f"{d}/image.png")
def variant(out, extra):
    with zipfile.ZipFile(src) as zi, zipfile.ZipFile(f"{d}/{out}", "w", zipfile.ZIP_DEFLATED) as zo:
        for i in zi.infolist(): zo.writestr(i, zi.read(i.filename))
        for n, data in extra.items(): zo.writestr(n, data)
variant("vba.xlsx", {"xl/vbaProject.bin": b"\xd0\xcf\x11\xe0fake-vba"})
variant("extlinks.xlsx", {"xl/externalLinks/externalLink1.xml": b"<externalLink/>",
  "xl/externalLinks/_rels/externalLink1.xml.rels": b'<Relationships><Relationship Id="r1" Target="file:///C:/evil.xlsx" TargetMode="External"/></Relationships>'})
open(f"{d}/exe_renamed.xlsx", "wb").write(b"MZ\x90\x00" + b"\x00" * 60 + b"This program cannot be run in DOS mode" + os.urandom(512))
open(f"{d}/fake.png", "wb").write(b"<html><script>alert(1)</script></html>")
open(f"{d}/hyperlink.csv", "w", encoding="utf-8").write('name,link\nتجربة,"=HYPERLINK(""http://evil.example"",""click"")"\n')
open(f"{d}/clean.csv", "w", encoding="utf-8").write("المنتج,السعر,الهامش\nقهوة,12.5,-3\nشاي,8,30%\n")
pdf = lambda body: (b"%PDF-1.4\n1 0 obj<</Type/Catalog" + body + b">>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")
open(f"{d}/js.pdf", "wb").write(pdf(b"/OpenAction<</S/JavaScript/JS(app.alert(1))>>"))
open(f"{d}/obfuscated.pdf", "wb").write(pdf(b"/OpenAction<</S/J#61vaScript/J#53(app.alert(1))>>"))
open(f"{d}/clean.pdf", "wb").write(pdf(b"/Pages 2 0 R"))
