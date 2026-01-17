from flask import Flask, request, jsonify
import numpy as np
from deepface import DeepFace
from PIL import Image
import io
import base64
import os
import cv2

app = Flask(__name__)

# Configuration
MODEL_NAME = "Facenet"  # Produces 128D embeddings, compatible with current DB schema size
DETECTOR_BACKEND = "opencv" # Lightweight, or 'retinaface' for accuracy if available
DISTANCE_METRIC = "euclidean_l2"

@app.route("/health")
def health():
    return jsonify({"status": "ok", "backend": "deepface", "model": MODEL_NAME})

def load_image_from_request():
    """Load image from request (JSON or Multipart) and convert to numpy array (RGB)"""
    img_bytes = None
    
    if request.is_json:
        data = request.json
        if "image_b64" in data:
            img_bytes = base64.b64decode(data["image_b64"])
    elif "file" in request.files:
        img_bytes = request.files["file"].read()
        
    if img_bytes is None:
        return None
        
    # Convert to PIL then to Numpy (DeepFace expects BGR or RGB numpy array)
    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(pil_img)

@app.route("/detect", methods=["POST"])
def detect_faces():
    """Detect faces and return locations + encodings."""
    img_arr = load_image_from_request()
    if img_arr is None:
        return jsonify({"error": "image_b64 (JSON) or file (form-data) required"}), 400

    try:
        # DeepFace.represent returns a list of dicts: 
        # [{'embedding': [...], 'facial_area': {'x': 0, 'y': 0, 'w': 0, 'h': 0}, 'face_confidence': 0.9}]
        try:
            results = DeepFace.represent(
                img_path=img_arr,
                model_name=MODEL_NAME,
                detector_backend="retinaface",
                enforce_detection=True,
                align=True
            )
        except Exception as e:
            print(f"RetinaFace failed: {e}, falling back to OpenCV")
            results = DeepFace.represent(
                img_path=img_arr,
                model_name=MODEL_NAME,
                detector_backend="opencv",
                enforce_detection=True,
                align=True
            )
        
        faces = []
        for res in results:
            area = res["facial_area"]
            embedding = res["embedding"]
            
            # Normalize embedding to float64 numpy array for consistency
            emb_np = np.array(embedding, dtype=np.float64)
            
            # Map x, y, w, h to top, right, bottom, left
            x, y, w, h = area["x"], area["y"], area["w"], area["h"]
            
            faces.append({
                "top": y,
                "right": x + w,
                "bottom": y + h,
                "left": x,
                "encoding": base64.b64encode(emb_np.tobytes()).decode(),
                "confidence": res.get("face_confidence", 1.0)
            })
            
        return jsonify({"count": len(faces), "faces": faces})

    except ValueError:
        # DeepFace raises ValueError if no face detected and enforce_detection=True
        return jsonify({"count": 0, "faces": []})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/compare", methods=["POST"])
def compare_faces():
    """Compare two face encodings."""
    data = request.json
    encoding1_b64 = data.get("encoding1")
    encoding2_b64 = data.get("encoding2")
    
    if not encoding1_b64 or not encoding2_b64:
        return jsonify({"error": "encoding1 and encoding2 required"}), 400
    
    enc1 = np.frombuffer(base64.b64decode(encoding1_b64), dtype=np.float64)
    enc2 = np.frombuffer(base64.b64decode(encoding2_b64), dtype=np.float64)
    
    # Calculate Euclidean Distance
    distance = np.linalg.norm(enc1 - enc2)
    
    # Threshold for Facenet L2 is typically around 0.75-0.80. 
    # Backend uses 0.6 by default.
    threshold = 0.75 
    match = distance < threshold
    
    return jsonify({
        "distance": float(distance),
        "match": match,
        "confidence": float(1 - distance/2) if match else 0 # Rough confidence approx
    })

@app.route("/search", methods=["POST"])
def search_faces():
    """Search for matching faces among candidates."""
    data = request.json
    target_b64 = data.get("target_encoding")
    candidates = data.get("candidates", [])
    
    # Use provided threshold or default to Facenet's
    threshold = data.get("threshold", 0.75)
    
    if not target_b64:
        return jsonify({"error": "target_encoding required"}), 400
    
    target = np.frombuffer(base64.b64decode(target_b64), dtype=np.float64)
    matches = []
    
    for candidate in candidates:
        try:
            enc = np.frombuffer(base64.b64decode(candidate["encoding"]), dtype=np.float64)
            distance = np.linalg.norm(target - enc)
            
            if distance < threshold:
                matches.append({
                    "id": candidate.get("id"),
                    "distance": float(distance),
                    "confidence": float(1 - distance/2)
                })
        except Exception:
            continue
    
    matches.sort(key=lambda x: x["distance"])
    return jsonify({"matches": matches})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
