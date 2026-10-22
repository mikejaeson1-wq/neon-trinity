"""Build the Fire OS wrapper with the Android SDK; no third-party Android runtime."""
import os,subprocess,shutil,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sdk=Path(os.environ.get('ANDROID_HOME',os.environ.get('ANDROID_SDK_ROOT','/usr/local/lib/android/sdk')))
android=sdk/'platforms/android-35/android.jar'
tools=sdk/'build-tools/35.0.0'
if not android.is_file() or not tools.is_dir():raise SystemExit('Android SDK platform 35 and build-tools 35.0.0 are required.')
out=root/'release-tv';out.mkdir(exist_ok=True)
classes=out/'classes';classes.mkdir(exist_ok=True)
res=out/'res/drawable';res.mkdir(parents=True,exist_ok=True)
shutil.copyfile(root/'app/assets/icon.png',res/'icon.png')
shutil.copyfile(root/'app/assets/icon.png',res/'banner.png')
subprocess.run(['javac','-source','8','-target','8','-classpath',str(android),'-d',str(classes),str(root/'tv/android/src/music/neontrinity/tv/MainActivity.java')],check=True)
dex=out/'dex';dex.mkdir(exist_ok=True)
subprocess.run([str(tools/'d8'),'--min-api','23','--lib',str(android),'--output',str(dex),*[str(p) for p in classes.rglob('*.class')]],check=True)
raw=out/'base.apk';apk=out/'Neon-Trinity-TV-unsigned.apk'
subprocess.run([str(tools/'aapt'),'package','-f','-M',str(root/'tv/android/AndroidManifest.xml'),'-S',str(out/'res'),'-I',str(android),'-F',str(raw)],check=True)
with zipfile.ZipFile(raw,'a',compression=zipfile.ZIP_DEFLATED) as z:z.write(dex/'classes.dex','classes.dex')
subprocess.run([str(tools/'zipalign'),'-f','-p','4',str(raw),str(apk)],check=True)
shutil.copyfile(tools/'lib/apksigner.jar',out/'apksigner.jar')
print('Fire-OS-App gebaut:',apk.name,apk.stat().st_size,'Bytes')
