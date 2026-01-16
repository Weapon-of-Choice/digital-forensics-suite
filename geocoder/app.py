from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)
NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org")

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/reverse")
def reverse_geocode():
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    if not lat or not lon:
        return jsonify({"error": "lat and lon required"}), 400
    
    try:
        resp = requests.get(
            f"{NOMINATIM_URL}/reverse",
            params={"lat": lat, "lon": lon, "format": "json"},
            headers={"User-Agent": "ForensicsPlatform/1.0"},
            timeout=10
        )
        data = resp.json()
        return jsonify({
            "display_name": data.get("display_name"),
            "address": data.get("address", {}),
            "lat": data.get("lat"),
            "lon": data.get("lon"),
            "osm_id": data.get("osm_id"),
            "osm_type": data.get("osm_type")
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/search")
def search():
    q = request.args.get("q")
    if not q:
        return jsonify({"error": "q (query) required"}), 400
    
    try:
        resp = requests.get(
            f"{NOMINATIM_URL}/search",
            params={"q": q, "format": "json", "limit": 10},
            headers={"User-Agent": "ForensicsPlatform/1.0"},
            timeout=10
        )
        results = resp.json()
        return jsonify([{
            "display_name": r.get("display_name"),
            "lat": r.get("lat"),
            "lon": r.get("lon"),
            "type": r.get("type"),
            "importance": r.get("importance")
        } for r in results])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/batch", methods=["POST"])
def batch_reverse():
    data = request.json
    coordinates = data.get("coordinates", [])
    results = []
    
    for coord in coordinates[:50]:
        try:
            resp = requests.get(
                f"{NOMINATIM_URL}/reverse",
                params={"lat": coord["lat"], "lon": coord["lon"], "format": "json"},
                headers={"User-Agent": "ForensicsPlatform/1.0"},
                timeout=10
            )
            r = resp.json()
            results.append({
                "lat": coord["lat"],
                "lon": coord["lon"],
                "display_name": r.get("display_name"),
                "address": r.get("address", {})
            })
        except:
            results.append({"lat": coord["lat"], "lon": coord["lon"], "error": "failed"})
    
    return jsonify(results)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
