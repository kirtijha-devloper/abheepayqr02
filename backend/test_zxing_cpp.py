import cv2
import json
import inspect

try:
    import zxingcpp
except ImportError:
    print(json.dumps({"success": False, "error": "zxingcpp not installed"}))
    exit(1)

def test_zxing():
    image_path = "uploads/qrcodes/1774260145365-890837100.jpeg"
    img = cv2.imread(image_path)
    
    if img is None:
        print(json.dumps({"success": False, "error": "Image not found"}))
        return

    try:
        results = zxingcpp.read_barcodes(img)
        if results and len(results) > 0:
            print(json.dumps({"success": True, "method": "zxing-cpp", "upiId": results[0].text}))
            return
            
        # Try with Binarizer LocalAverage for hard to read codes
        results = zxingcpp.read_barcodes(img, binarizer=zxingcpp.Binarizer.LocalAverage)
        if results and len(results) > 0:
            print(json.dumps({"success": True, "method": "zxing-cpp-localaverage", "upiId": results[0].text}))
            return
            
        print(json.dumps({"success": False, "error": "zxing-cpp failed to detect QR"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

test_zxing()
