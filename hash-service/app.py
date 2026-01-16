from flask import Flask, request, jsonify
import imagehash
from PIL import Image
import hashlib
import magic
import cv2
import numpy as np
import io
import base64

app = Flask(__name__)


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


def load_image_from_request():
    """
    Load image from request.
    
    Accepts:
    - JSON body with "image_b64" (base64 encoded image)
    - multipart/form-data with "file" field
    
    Returns:
        Tuple of (PIL Image, raw bytes) or (None, None)
    """
    if request.is_json:
        data = request.json
        if "image_b64" in data:
            image_data = base64.b64decode(data["image_b64"])
            return Image.open(io.BytesIO(image_data)), image_data
    
    elif "file" in request.files:
        file = request.files["file"]
        image_data = file.read()
        return Image.open(io.BytesIO(image_data)), image_data
    
    return None, None


@app.route("/hash", methods=["POST"])
def compute_hashes():
    """Compute perceptual and cryptographic hashes for an image."""
    img, raw_data = load_image_from_request()
    
    if img is None:
        return jsonify({"error": "image_b64 (JSON) or file (form-data) required"}), 400
    
    result = {
        "phash": str(imagehash.phash(img)),
        "dhash": str(imagehash.dhash(img)),
        "whash": str(imagehash.whash(img)),
        "average_hash": str(imagehash.average_hash(img)),
        "md5": hashlib.md5(raw_data).hexdigest(),
        "sha256": hashlib.sha256(raw_data).hexdigest(),
        "sha1": hashlib.sha1(raw_data).hexdigest()
    }
    
    return jsonify(result)


@app.route("/signature", methods=["POST"])
def extract_signature():
    """Extract ORB keypoints and color histogram signature."""
    img_pil, raw_data = load_image_from_request()
    
    if img_pil is None:
        return jsonify({"error": "image_b64 (JSON) or file (form-data) required"}), 400
    
    # Convert to OpenCV format
    nparr = np.frombuffer(raw_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return jsonify({"error": "failed to decode image"}), 400
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    orb = cv2.ORB_create(nfeatures=500)
    keypoints, descriptors = orb.detectAndCompute(gray, None)
    
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
    hist = cv2.normalize(hist, hist).flatten()
    
    result = {
        "keypoint_count": len(keypoints),
        "orb_descriptors": base64.b64encode(descriptors.tobytes()).decode() if descriptors is not None else None,
        "color_histogram": base64.b64encode(hist.astype(np.float32).tobytes()).decode()
    }
    
    return jsonify(result)


@app.route("/compare", methods=["POST"])
def compare_hashes():
    """Compare two perceptual hashes."""
    data = request.json
    hash1 = data.get("hash1")
    hash2 = data.get("hash2")
    hash_type = data.get("type", "phash")
    
    if not hash1 or not hash2:
        return jsonify({"error": "hash1 and hash2 required"}), 400
    
    h1 = imagehash.hex_to_hash(hash1)
    h2 = imagehash.hex_to_hash(hash2)
    distance = h1 - h2
    
    return jsonify({
        "distance": distance,
        "similar": distance <= 10,
        "identical": distance == 0
    })


@app.route("/compare-signatures", methods=["POST"])
def compare_signatures():
    """Compare two image signatures (ORB descriptors and color histograms)."""
    data = request.json
    desc1_b64 = data.get("descriptors1")
    desc2_b64 = data.get("descriptors2")
    hist1_b64 = data.get("histogram1")
    hist2_b64 = data.get("histogram2")
    
    result = {"orb_score": None, "color_score": None, "combined_score": None}
    
    if desc1_b64 and desc2_b64:
        desc1 = np.frombuffer(base64.b64decode(desc1_b64), dtype=np.uint8).reshape(-1, 32)
        desc2 = np.frombuffer(base64.b64decode(desc2_b64), dtype=np.uint8).reshape(-1, 32)
        
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(desc1, desc2)
        
        if len(matches) > 0:
            avg_distance = sum(m.distance for m in matches) / len(matches)
            result["orb_score"] = float(1 - (avg_distance / 256))
            result["orb_matches"] = len(matches)
    
    if hist1_b64 and hist2_b64:
        hist1 = np.frombuffer(base64.b64decode(hist1_b64), dtype=np.float32)
        hist2 = np.frombuffer(base64.b64decode(hist2_b64), dtype=np.float32)
        
        correlation = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
        result["color_score"] = float(correlation)
    
    scores = [s for s in [result["orb_score"], result["color_score"]] if s is not None]
    if scores:
        result["combined_score"] = sum(scores) / len(scores)
    
    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
