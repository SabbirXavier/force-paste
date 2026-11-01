import os
import zipfile
import json

def package():
    with open("manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)

    version = manifest.get("version", "1.4.0")
    zip_filename = f"forcepaste-v{version}.zip"

    include_files = [
        "manifest.json",
        "background.js",
        "content.js",
        "page-probe.js",
        "popup.html",
        "popup.js",
        "offscreen.html",
        "offscreen.js",
        "icons/icon-16.png",
        "icons/icon-48.png",
        "icons/icon-128.png"
    ]

    print(f"Creating production package: {zip_filename}...")
    with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in include_files:
            if os.path.exists(file):
                zf.write(file, arcname=file)
                print(f"  + Added: {file}")
            else:
                print(f"  ! Warning: {file} not found!")

    size_kb = os.path.getsize(zip_filename) / 1024
    print(f"\nDone! Package successfully created: {zip_filename} ({size_kb:.1f} KB)")
    print("Ready for direct distribution on GitHub!")

if __name__ == "__main__":
    package()
