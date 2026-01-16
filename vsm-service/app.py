"""
Video Signature Matching (VSM) Service

Extracts video fingerprints for:
- Video deduplication
- Near-duplicate detection
- Known content matching (like Griffeye VSM)
"""

import os
import tempfile
import subprocess
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(title="VSM Service", version="1.0.0")


class VideoSignature(BaseModel):
    """Video signature containing multiple fingerprint types"""
    duration: float
    fps: float
    frame_count: int
    resolution: tuple[int, int]
    keyframe_hashes: list[str]  # pHash of keyframes
    temporal_signature: str  # Temporal pattern hash
    audio_fingerprint: Optional[str] = None
    color_histogram: list[float]


class CompareResult(BaseModel):
    similarity: float
    keyframe_matches: int
    temporal_match: float
    is_match: bool


def extract_keyframes(video_path: str, num_keyframes: int = 10) -> list[np.ndarray]:
    """Extract evenly distributed keyframes from video"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Cannot open video file")
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames == 0:
        raise HTTPException(status_code=400, detail="Video has no frames")
    
    # Calculate frame indices to extract
    indices = np.linspace(0, total_frames - 1, num_keyframes, dtype=int)
    keyframes = []
    
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret:
            keyframes.append(frame)
    
    cap.release()
    return keyframes


def compute_phash(image: np.ndarray, hash_size: int = 8) -> str:
    """Compute perceptual hash of image"""
    # Resize to hash_size + 1 for DCT
    resized = cv2.resize(image, (hash_size + 1, hash_size))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else resized
    
    # Compute DCT
    dct = cv2.dct(np.float32(gray))
    dct_low = dct[:hash_size, :hash_size]
    
    # Compute hash from median
    median = np.median(dct_low)
    hash_bits = (dct_low > median).flatten()
    
    # Convert to hex string
    hash_int = sum([2**i for i, v in enumerate(hash_bits) if v])
    return format(hash_int, '016x')


def compute_temporal_signature(video_path: str, sample_frames: int = 30) -> str:
    """Compute temporal pattern signature based on frame differences"""
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if total_frames < 2:
        return "0" * 16
    
    indices = np.linspace(0, total_frames - 1, sample_frames, dtype=int)
    differences = []
    prev_frame = None
    
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            continue
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, (16, 16))
        
        if prev_frame is not None:
            diff = np.mean(np.abs(small.astype(float) - prev_frame.astype(float)))
            differences.append(diff)
        
        prev_frame = small
    
    cap.release()
    
    if not differences:
        return "0" * 16
    
    # Quantize differences into signature
    median_diff = np.median(differences)
    bits = [1 if d > median_diff else 0 for d in differences]
    
    # Pad or truncate to 64 bits
    bits = (bits + [0] * 64)[:64]
    hash_int = sum([2**i for i, v in enumerate(bits) if v])
    return format(hash_int, '016x')


def compute_color_histogram(video_path: str, bins: int = 32) -> list[float]:
    """Compute average color histogram across video"""
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    sample_indices = np.linspace(0, total_frames - 1, 10, dtype=int)
    histograms = []
    
    for idx in sample_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            continue
        
        # Compute histogram for each channel
        hist = []
        for i in range(3):
            h = cv2.calcHist([frame], [i], None, [bins], [0, 256])
            hist.extend(h.flatten())
        
        histograms.append(np.array(hist))
    
    cap.release()
    
    if not histograms:
        return [0.0] * (bins * 3)
    
    # Average and normalize
    avg_hist = np.mean(histograms, axis=0)
    avg_hist = avg_hist / (avg_hist.sum() + 1e-7)
    return avg_hist.tolist()


def hamming_distance(hash1: str, hash2: str) -> int:
    """Compute Hamming distance between two hex hashes"""
    if len(hash1) != len(hash2):
        return max(len(hash1), len(hash2)) * 4  # Max distance
    
    diff = int(hash1, 16) ^ int(hash2, 16)
    return bin(diff).count('1')


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "vsm"}


@app.post("/extract", response_model=VideoSignature)
async def extract_signature(file: UploadFile = File(...)):
    """Extract video signature/fingerprint"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Save uploaded file temporarily
    suffix = Path(file.filename).suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Cannot open video file")
        
        # Get video metadata
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = frame_count / fps if fps > 0 else 0
        cap.release()
        
        # Extract keyframes and compute hashes
        keyframes = extract_keyframes(tmp_path)
        keyframe_hashes = [compute_phash(kf) for kf in keyframes]
        
        # Compute temporal signature
        temporal_sig = compute_temporal_signature(tmp_path)
        
        # Compute color histogram
        color_hist = compute_color_histogram(tmp_path)
        
        return VideoSignature(
            duration=duration,
            fps=fps,
            frame_count=frame_count,
            resolution=(width, height),
            keyframe_hashes=keyframe_hashes,
            temporal_signature=temporal_sig,
            color_histogram=color_hist
        )
    
    finally:
        os.unlink(tmp_path)


@app.post("/extract-from-path")
async def extract_from_path(path: str):
    """Extract video signature from file path (for internal use)"""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Cannot open video file")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = frame_count / fps if fps > 0 else 0
    cap.release()
    
    keyframes = extract_keyframes(path)
    keyframe_hashes = [compute_phash(kf) for kf in keyframes]
    temporal_sig = compute_temporal_signature(path)
    color_hist = compute_color_histogram(path)
    
    return VideoSignature(
        duration=duration,
        fps=fps,
        frame_count=frame_count,
        resolution=(width, height),
        keyframe_hashes=keyframe_hashes,
        temporal_signature=temporal_sig,
        color_histogram=color_hist
    )


@app.post("/compare", response_model=CompareResult)
async def compare_videos(
    file1: UploadFile = File(...),
    file2: UploadFile = File(...)
):
    """Compare two videos for similarity"""
    # Extract signatures for both
    sig1 = await extract_signature(file1)
    sig2 = await extract_signature(file2)
    
    return compare_signatures(sig1, sig2)


@app.post("/compare-signatures", response_model=CompareResult)
async def compare_signatures_endpoint(sig1: VideoSignature, sig2: VideoSignature):
    """Compare two pre-computed video signatures"""
    return compare_signatures(sig1, sig2)


def compare_signatures(sig1: VideoSignature, sig2: VideoSignature) -> CompareResult:
    """Compare two video signatures"""
    # Compare keyframe hashes
    keyframe_matches = 0
    min_len = min(len(sig1.keyframe_hashes), len(sig2.keyframe_hashes))
    
    for i in range(min_len):
        dist = hamming_distance(sig1.keyframe_hashes[i], sig2.keyframe_hashes[i])
        if dist <= 10:  # Threshold for similarity
            keyframe_matches += 1
    
    keyframe_similarity = keyframe_matches / max(min_len, 1)
    
    # Compare temporal signatures
    temporal_dist = hamming_distance(sig1.temporal_signature, sig2.temporal_signature)
    temporal_similarity = 1.0 - (temporal_dist / 64.0)
    
    # Compare color histograms
    hist1 = np.array(sig1.color_histogram)
    hist2 = np.array(sig2.color_histogram)
    hist_similarity = float(cv2.compareHist(
        hist1.astype(np.float32).reshape(-1, 1),
        hist2.astype(np.float32).reshape(-1, 1),
        cv2.HISTCMP_CORREL
    ))
    
    # Combined similarity score
    overall_similarity = (
        0.5 * keyframe_similarity +
        0.3 * temporal_similarity +
        0.2 * max(0, hist_similarity)
    )
    
    return CompareResult(
        similarity=overall_similarity,
        keyframe_matches=keyframe_matches,
        temporal_match=temporal_similarity,
        is_match=overall_similarity > 0.7
    )


@app.post("/search")
async def search_similar(
    signature: VideoSignature,
    database: list[dict],
    threshold: float = 0.7
):
    """Search for similar videos in a database of signatures"""
    results = []
    
    for entry in database:
        db_sig = VideoSignature(**entry["signature"])
        comparison = compare_signatures(signature, db_sig)
        
        if comparison.similarity >= threshold:
            results.append({
                "id": entry.get("id"),
                "similarity": comparison.similarity,
                "keyframe_matches": comparison.keyframe_matches,
                "is_match": comparison.is_match
            })
    
    # Sort by similarity descending
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
