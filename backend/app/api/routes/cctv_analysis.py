from typing import Any
import os
import base64
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.api.middleware.auth_middleware import get_current_user
from app.api.routes import ok
import google.generativeai as genai

router = APIRouter(dependencies=[Depends(get_current_user)])

class AnalyzeImageRequest(BaseModel):
    image_data: str  # Base64 data URL

@router.post("/analyze")
async def analyze_cctv_image(request: AnalyzeImageRequest) -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured.")

    genai.configure(api_key=api_key)

    try:
        # Extract base64 data
        if "," in request.image_data:
            base64_data = request.image_data.split(",")[1]
            mime_type = request.image_data.split(",")[0].split(":")[1].split(";")[0]
        else:
            base64_data = request.image_data
            mime_type = "image/jpeg"

        image_bytes = base64.b64decode(base64_data)
        
        # We can pass the data directly to Gemini 1.5 Flash using the appropriate format
        prompt = (
            "You are a CCTV monitoring assistant. Describe the scene and identify objects, vehicles, and people. "
            "Do NOT attempt to identify specific individuals or match faces to identities. Focus on clothing, "
            "actions, items they are holding, and general scene context."
        )

        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content([
            prompt,
            {
                "mime_type": mime_type,
                "data": image_bytes
            }
        ])

        return ok({"analysis": response.text})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {str(e)}")
