import cv2
import json

def test_cv2_qr():
    image_path = "uploads/qrcodes/1774260145365-890837100.jpeg"
    img = cv2.imread(image_path)
    
    if img is None:
        print(json.dumps({"success": False, "error": "Image not found"}))
        return

    # Method 1: Standard OpenCV QRCodeDetector
    detector = cv2.QRCodeDetector()
    data, bbox, _ = detector.detectAndDecode(img)
    
    if data:
        print(json.dumps({"success": True, "method": "cv2", "upiId": data}))
        return

    # Method 2: Try WeChatQRCode if available (usually requires opencv-contrib-python but let's check)
    try:
        wechat = cv2.wechat_qrcode_WeChatQRCode()
        res, points = wechat.detectAndDecode(img)
        if res and len(res) > 0:
            print(json.dumps({"success": True, "method": "wechat", "upiId": res[0]}))
            return
    except AttributeError:
        pass
        
    print(json.dumps({"success": False, "error": "cv2 failed to detect QR"}))

test_cv2_qr()
