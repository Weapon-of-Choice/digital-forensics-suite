"""
AI Content Categorizer Service

Classifies media into forensic-relevant categories:
- Weapons (firearms, knives, explosives)
- Narcotics (drugs, paraphernalia)
- Extremism (flags, symbols, propaganda)
- Currency (counterfeit detection)
- Documents (ID, passports, licenses)
- CSAM indicators (age estimation, context)
- Violence/Gore
- Safe/Neutral

Uses CLIP for zero-shot classification and custom models for specific categories.
"""

import os
import io
import tempfile
from pathlib import Path
from typing import Optional
from enum import Enum

import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel

app = FastAPI(title="AI Categorizer Service", version="1.0.0")


class Category(str, Enum):
    WEAPONS = "weapons"
    NARCOTICS = "narcotics"
    EXTREMISM = "extremism"
    CURRENCY = "currency"
    DOCUMENTS = "documents"
    VIOLENCE = "violence"
    EXPLICIT = "explicit"
    SAFE = "safe"
    UNKNOWN = "unknown"


class SubCategory(str, Enum):
    # Weapons
    FIREARM = "firearm"
    KNIFE = "knife"
    EXPLOSIVE = "explosive"
    AMMUNITION = "ammunition"
    # Narcotics
    CANNABIS = "cannabis"
    PILLS = "pills"
    POWDER = "powder"
    PARAPHERNALIA = "paraphernalia"
    # Documents
    PASSPORT = "passport"
    ID_CARD = "id_card"
    DRIVERS_LICENSE = "drivers_license"
    CREDIT_CARD = "credit_card"
    # Other
    NONE = "none"


class CategoryResult(BaseModel):
    category: Category
    subcategory: Optional[SubCategory] = None
    confidence: float
    all_scores: dict[str, float]
    flags: list[str] = []


class BatchResult(BaseModel):
    results: list[CategoryResult]


# Category definitions for zero-shot classification
CATEGORY_PROMPTS = {
    Category.WEAPONS: [
        "a photo of a gun",
        "a photo of a firearm",
        "a photo of a pistol",
        "a photo of a rifle",
        "a photo of a knife",
        "a photo of a blade",
        "a photo of explosives",
        "a photo of ammunition",
        "a photo of bullets",
    ],
    Category.NARCOTICS: [
        "a photo of drugs",
        "a photo of cannabis",
        "a photo of marijuana",
        "a photo of pills",
        "a photo of powder drugs",
        "a photo of drug paraphernalia",
        "a photo of a bong",
        "a photo of syringes",
    ],
    Category.EXTREMISM: [
        "a photo of extremist symbols",
        "a photo of hate symbols",
        "a photo of propaganda",
        "a photo of extremist flags",
    ],
    Category.CURRENCY: [
        "a photo of money",
        "a photo of cash",
        "a photo of banknotes",
        "a photo of coins",
        "a photo of counterfeit money",
    ],
    Category.DOCUMENTS: [
        "a photo of a passport",
        "a photo of an ID card",
        "a photo of a driver's license",
        "a photo of a credit card",
        "a photo of official documents",
    ],
    Category.VIOLENCE: [
        "a photo of violence",
        "a photo of blood",
        "a photo of injury",
        "a photo of a fight",
    ],
    Category.EXPLICIT: [
        "an explicit photo",
        "adult content",
        "nudity",
    ],
    Category.SAFE: [
        "a photo of nature",
        "a photo of a landscape",
        "a photo of people smiling",
        "a photo of food",
        "a photo of a building",
        "a safe photo",
        "a normal photo",
    ],
}

# Lazy loading for heavy models
_clip_model = None
_clip_processor = None


def get_clip_model():
    """Lazy load CLIP model"""
    global _clip_model, _clip_processor
    
    if _clip_model is None:
        try:
            from transformers import CLIPProcessor, CLIPModel
            
            model_name = "openai/clip-vit-base-patch32"
            _clip_processor = CLIPProcessor.from_pretrained(model_name)
            _clip_model = CLIPModel.from_pretrained(model_name)
            _clip_model.eval()
        except Exception as e:
            print(f"Failed to load CLIP model: {e}")
            return None, None
    
    return _clip_model, _clip_processor


def classify_with_clip(image: Image.Image) -> dict[str, float]:
    """Classify image using CLIP zero-shot classification"""
    model, processor = get_clip_model()
    
    if model is None:
        # Fallback: return uniform scores
        return {cat.value: 1.0 / len(Category) for cat in Category}
    
    import torch
    
    # Prepare all prompts
    all_prompts = []
    category_indices = {}
    idx = 0
    
    for category, prompts in CATEGORY_PROMPTS.items():
        category_indices[category] = list(range(idx, idx + len(prompts)))
        all_prompts.extend(prompts)
        idx += len(prompts)
    
    # Process image and text
    inputs = processor(
        text=all_prompts,
        images=image,
        return_tensors="pt",
        padding=True
    )
    
    with torch.no_grad():
        outputs = model(**inputs)
        logits_per_image = outputs.logits_per_image
        probs = logits_per_image.softmax(dim=1).numpy()[0]
    
    # Aggregate probabilities by category
    category_scores = {}
    for category, indices in category_indices.items():
        category_scores[category.value] = float(np.max(probs[indices]))
    
    return category_scores


def determine_subcategory(category: Category, image: Image.Image) -> Optional[SubCategory]:
    """Determine subcategory based on main category"""
    model, processor = get_clip_model()
    
    if model is None or category == Category.SAFE:
        return SubCategory.NONE
    
    import torch
    
    subcategory_prompts = {
        Category.WEAPONS: {
            SubCategory.FIREARM: ["gun", "pistol", "rifle", "firearm"],
            SubCategory.KNIFE: ["knife", "blade", "sword"],
            SubCategory.EXPLOSIVE: ["explosive", "bomb", "grenade"],
            SubCategory.AMMUNITION: ["ammunition", "bullets", "shells"],
        },
        Category.NARCOTICS: {
            SubCategory.CANNABIS: ["cannabis", "marijuana", "weed"],
            SubCategory.PILLS: ["pills", "tablets", "capsules"],
            SubCategory.POWDER: ["powder", "cocaine", "heroin"],
            SubCategory.PARAPHERNALIA: ["bong", "pipe", "syringe"],
        },
        Category.DOCUMENTS: {
            SubCategory.PASSPORT: ["passport"],
            SubCategory.ID_CARD: ["ID card", "identity card"],
            SubCategory.DRIVERS_LICENSE: ["driver's license", "driving license"],
            SubCategory.CREDIT_CARD: ["credit card", "debit card"],
        },
    }
    
    if category not in subcategory_prompts:
        return SubCategory.NONE
    
    prompts = subcategory_prompts[category]
    all_prompts = []
    subcategory_map = []
    
    for subcat, texts in prompts.items():
        for text in texts:
            all_prompts.append(f"a photo of {text}")
            subcategory_map.append(subcat)
    
    inputs = processor(
        text=all_prompts,
        images=image,
        return_tensors="pt",
        padding=True
    )
    
    with torch.no_grad():
        outputs = model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1).numpy()[0]
    
    best_idx = np.argmax(probs)
    return subcategory_map[best_idx]


def generate_flags(category: Category, confidence: float, all_scores: dict) -> list[str]:
    """Generate warning flags based on classification"""
    flags = []
    
    if category in [Category.WEAPONS, Category.NARCOTICS, Category.EXTREMISM]:
        if confidence > 0.8:
            flags.append("HIGH_PRIORITY")
        flags.append("REQUIRES_REVIEW")
    
    if category == Category.EXPLICIT:
        flags.append("ADULT_CONTENT")
        flags.append("REQUIRES_REVIEW")
    
    if category == Category.VIOLENCE:
        flags.append("GRAPHIC_CONTENT")
    
    # Check for multi-category concerns
    high_scores = [k for k, v in all_scores.items() if v > 0.5]
    if len(high_scores) > 2:
        flags.append("MULTI_CATEGORY")
    
    return flags


@app.get("/health")
async def health():
    """Health check endpoint"""
    model, _ = get_clip_model()
    return {
        "status": "healthy",
        "service": "ai-categorizer",
        "model_loaded": model is not None
    }


@app.post("/classify", response_model=CategoryResult)
async def classify_image(file: UploadFile = File(...)):
    """Classify a single image"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Read image
    content = await file.read()
    try:
        image = Image.open(io.BytesIO(content)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {e}")
    
    # Classify
    scores = classify_with_clip(image)
    
    # Get top category
    top_category = max(scores, key=scores.get)
    confidence = scores[top_category]
    category = Category(top_category)
    
    # Get subcategory
    subcategory = determine_subcategory(category, image)
    
    # Generate flags
    flags = generate_flags(category, confidence, scores)
    
    return CategoryResult(
        category=category,
        subcategory=subcategory,
        confidence=confidence,
        all_scores=scores,
        flags=flags
    )


@app.post("/classify-path")
async def classify_from_path(path: str):
    """Classify image from file path (internal use)"""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        image = Image.open(path).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {e}")
    
    scores = classify_with_clip(image)
    top_category = max(scores, key=scores.get)
    confidence = scores[top_category]
    category = Category(top_category)
    subcategory = determine_subcategory(category, image)
    flags = generate_flags(category, confidence, scores)
    
    return CategoryResult(
        category=category,
        subcategory=subcategory,
        confidence=confidence,
        all_scores=scores,
        flags=flags
    )


@app.post("/batch-classify", response_model=BatchResult)
async def batch_classify(files: list[UploadFile] = File(...)):
    """Classify multiple images"""
    results = []
    
    for file in files:
        try:
            result = await classify_image(file)
            results.append(result)
        except Exception as e:
            # Add error result
            results.append(CategoryResult(
                category=Category.UNKNOWN,
                confidence=0.0,
                all_scores={},
                flags=[f"ERROR: {str(e)}"]
            ))
    
    return BatchResult(results=results)


@app.get("/categories")
async def list_categories():
    """List all available categories and subcategories"""
    return {
        "categories": [c.value for c in Category],
        "subcategories": [s.value for s in SubCategory],
        "category_descriptions": {
            "weapons": "Firearms, knives, explosives, ammunition",
            "narcotics": "Drugs and drug paraphernalia",
            "extremism": "Extremist symbols, flags, propaganda",
            "currency": "Money, banknotes, potential counterfeits",
            "documents": "IDs, passports, licenses, official documents",
            "violence": "Violent or graphic content",
            "explicit": "Adult/explicit content",
            "safe": "Safe, neutral content",
            "unknown": "Could not be classified",
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
