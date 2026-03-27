import cv2
import json
import zxingcpp
import os
import glob

def test_all():
    images = glob.glob("uploads/qrcodes/*.jpeg") + glob.glob("uploads/qrcodes/*.png") + glob.glob("uploads/qrcodes/*.jpg")
    success_count = 0
    
    for img_path in images:
        img = cv2.imread(img_path)
        if img is None: continue
        
        try:
            results = zxingcpp.read_barcodes(img)
            if results and len(results) > 0:
                success_count += 1
                continue
            
            results = zxingcpp.read_barcodes(img, binarizer=zxingcpp.Binarizer.LocalAverage)
            if results and len(results) > 0:
                success_count += 1
                continue
                
            # Try converting to grayscale and increasing contrast
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=0)
            results = zxingcpp.read_barcodes(gray)
            if results and len(results) > 0:
                success_count += 1
                continue
                
        except Exception:
            pass
            
    print(f"ZXing-cpp decoded {success_count} out of {len(images)} images.")

test_all()
