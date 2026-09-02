from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json
import os
import io
import base64
import re
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel
from PIL import Image

# Load .env file from root or backend directory with override=True
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env', override=True)
load_dotenv(dotenv_path=Path(__file__).parent / '.env', override=True)

try:
    from . import models
    from .database import engine, get_db
except (ImportError, ValueError):
    import models
    from database import engine, get_db

# Try importing Groq and Google Generative AI
try:
    from groq import Groq
except ImportError:
    Groq = None

try:
    import google.generativeai as genai
except ImportError:
    genai = None

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Portfolio Fact Sheets API")

class Holding(BaseModel):
    company_name: str
    weight_percentage: float
    sector: Optional[str] = None

class Sector(BaseModel):
    sector_name: str
    weight_percentage: float

class PeriodReturn(BaseModel):
    fund_cagr: Optional[float] = None
    benchmark_cagr: Optional[float] = None

class ReturnsComparison(BaseModel):
    benchmark_name: Optional[str] = None
    one_year: Optional[PeriodReturn] = None
    three_year: Optional[PeriodReturn] = None
    five_year: Optional[PeriodReturn] = None
    since_inception: Optional[PeriodReturn] = None

class DebtCreditQuality(BaseModel):
    sovereign_percentage: Optional[float] = None
    aaa_percentage: Optional[float] = None
    aa_percentage: Optional[float] = None
    a1_plus_percentage: Optional[float] = None
    cash_and_equivalent_percentage: Optional[float] = None

class DebtMetrics(BaseModel):
    ytm_percentage: Optional[float] = None
    modified_duration_years_or_days: Optional[str] = None
    average_maturity_years_or_days: Optional[str] = None
    macaulay_duration_years_or_days: Optional[str] = None
    credit_quality: Optional[DebtCreditQuality] = None

class RiskMetrics(BaseModel):
    sharpe_ratio: Optional[float] = None
    beta: Optional[float] = None
    standard_deviation_percentage: Optional[float] = None
    portfolio_turnover_ratio_percentage: Optional[float] = None
    tracking_error_percentage: Optional[float] = None

class FundManager(BaseModel):
    name: str
    tenure: Optional[str] = None
    experience_or_role: Optional[str] = None

class DiagnosticFlag(BaseModel):
    category: str  # cost_and_size | portfolio_quality | performance | risk | fund_manager
    title: str
    status: str    # good | warning | danger | info
    message: str

class InvestorVerdict(BaseModel):
    action: Optional[str] = None  # SUITABLE_FOR_ALLOCATION | HOLD_AND_MONITOR | REVIEW_CAUTION
    thesis: Optional[str] = None
    key_strengths: List[str] = []
    key_risks_to_watch: List[str] = []
    investor_takeaway: Optional[str] = None

class FactSheetResult(BaseModel):
    detected_fund_name: str
    matched_portfolio_fund: str
    as_of_date: str
    
    # 1. Cost & Size
    aum_in_crores: Optional[float] = None
    ter_direct_percentage: Optional[float] = None
    ter_regular_percentage: Optional[float] = None
    cost_and_size_verdict: Optional[str] = None
    
    # 2. Portfolio Quality
    cash_level_percentage: Optional[float] = None
    top_10_concentration_percentage: Optional[float] = None
    top_holdings: List[Holding] = []
    sector_allocation: List[Sector] = []
    
    # 3. Performance & Discipline
    returns_comparison: Optional[ReturnsComparison] = None
    
    # 4. Risk Metrics
    risk_metrics: Optional[RiskMetrics] = None
    
    # 5. Debt / Liquid Specifics
    debt_metrics: Optional[DebtMetrics] = None
    
    # 6. Fund Managers
    fund_managers: List[FundManager] = []
    
    # 7. AI Diagnostic Checks & Takeaways
    diagnostic_flags: List[DiagnosticFlag] = []
    investor_verdict: Optional[InvestorVerdict] = None
    notes_or_highlights: str

def clean_json_string(text: str) -> str:
    """Clean markdown code blocks from model response."""
    text = text.strip()
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if match:
        return match.group(1).strip()
    return text

def compute_diagnostic_flags(data: dict) -> list:
    """Ensure key financial criteria checks are generated deterministically."""
    flags = list(data.get("diagnostic_flags") or [])
    existing_titles = {f.get("title") for f in flags if isinstance(f, dict)}

    # Check 1: Expense Ratio (Direct TER)
    ter_direct = data.get("ter_direct_percentage")
    if ter_direct is not None:
        if "Direct TER Assessment" not in existing_titles:
            if ter_direct < 0.5:
                flags.append({
                    "category": "cost_and_size",
                    "title": "Direct TER Assessment",
                    "status": "good",
                    "message": f"Low Direct TER ({ter_direct}%) protects long-term compounding returns."
                })
            elif ter_direct > 1.2:
                flags.append({
                    "category": "cost_and_size",
                    "title": "Direct TER Assessment",
                    "status": "warning",
                    "message": f"Elevated Direct TER ({ter_direct}%) exceeds typical cost efficiency."
                })

    # Check 2: Cash Level Drag
    cash = data.get("cash_level_percentage")
    if cash is not None and "Cash Level Assessment" not in existing_titles:
        if cash > 10.0:
            flags.append({
                "category": "portfolio_quality",
                "title": "Cash Level Assessment",
                "status": "danger",
                "message": f"High cash level ({cash}%) signals defensive stance and potential idle cash return drag."
            })
        elif cash > 7.0:
            flags.append({
                "category": "portfolio_quality",
                "title": "Cash Level Assessment",
                "status": "warning",
                "message": f"Moderate cash allocation ({cash}%) indicates tactical cash buffering."
            })
        else:
            flags.append({
                "category": "portfolio_quality",
                "title": "Cash Level Assessment",
                "status": "good",
                "message": f"Lean cash holding ({cash}%) keeps capital fully deployed."
            })

    # Check 3: Top 10 Concentration
    top_10 = data.get("top_10_concentration_percentage")
    if top_10 is None and data.get("top_holdings"):
        top_10 = round(sum(h.get("weight_percentage", 0) for h in data.get("top_holdings", [])[:10]), 2)
        data["top_10_concentration_percentage"] = top_10

    if top_10 is not None and "Top 10 Concentration" not in existing_titles:
        if top_10 > 50.0:
            flags.append({
                "category": "portfolio_quality",
                "title": "Top 10 Concentration",
                "status": "warning",
                "message": f"High concentration ({top_10}% in top 10) elevates single-stock exposure risk."
            })
        else:
            flags.append({
                "category": "portfolio_quality",
                "title": "Top 10 Concentration",
                "status": "good",
                "message": f"Healthy diversification ({top_10}% in top 10) mitigates stock-specific drawdowns."
            })

    # Check 4: Portfolio Turnover
    rm = data.get("risk_metrics") or {}
    turnover = rm.get("portfolio_turnover_ratio_percentage")
    if turnover is not None and "Portfolio Turnover" not in existing_titles:
        if turnover > 100.0:
            flags.append({
                "category": "risk",
                "title": "Portfolio Turnover",
                "status": "warning",
                "message": f"High turnover ({turnover}%) signals frequent churning and elevated trading friction costs."
            })
        else:
            flags.append({
                "category": "risk",
                "title": "Portfolio Turnover",
                "status": "good",
                "message": f"Disciplined turnover ({turnover}%) reflects patient buy-and-hold conviction."
            })

    # Check 5: Beta Volatility
    beta = rm.get("beta")
    if beta is not None and "Market Beta" not in existing_titles:
        if beta > 1.1:
            flags.append({
                "category": "risk",
                "title": "Market Beta",
                "status": "warning",
                "message": f"Beta of {beta} indicates higher volatility and amplification during market swings."
            })
        elif beta < 0.9:
            flags.append({
                "category": "risk",
                "title": "Market Beta",
                "status": "info",
                "message": f"Beta of {beta} offers defensive cushion against broader market declines."
            })

    # Check 6: 3-Year / 5-Year Benchmark Returns
    ret = data.get("returns_comparison") or {}
    three_yr = ret.get("three_year") or {}
    f_3y, b_3y = three_yr.get("fund_cagr"), three_yr.get("benchmark_cagr")
    if f_3y is not None and b_3y is not None and "3-Year Benchmark Comparison" not in existing_titles:
        diff = round(f_3y - b_3y, 2)
        if diff >= 0:
            flags.append({
                "category": "performance",
                "title": "3-Year Benchmark Comparison",
                "status": "good",
                "message": f"Outperformed benchmark by +{diff}% CAGR over 3 years (Fund: {f_3y}% vs Index: {b_3y}%)."
            })
        else:
            flags.append({
                "category": "performance",
                "title": "3-Year Benchmark Comparison",
                "status": "warning",
                "message": f"Lagged benchmark by {diff}% CAGR over 3 years (Fund: {f_3y}% vs Index: {b_3y}%)."
            })

    return flags

def optimize_image_for_vision(file_bytes: bytes, max_dim: int = 1100) -> tuple[bytes, str]:
    """Resize and compress screenshot to minimize token count while preserving text clarity."""
    try:
        img = Image.open(io.BytesIO(file_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        w, h = img.size
        if max(w, h) > max_dim:
            scale = max_dim / float(max(w, h))
            new_size = (int(w * scale), int(h * scale))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80, optimize=True)
        return buf.getvalue(), "image/jpeg"
    except Exception as e:
        print(f"Image optimization note: {e}")
        return file_bytes, "image/png"

@app.post("/api/factsheets/analyze-multiple")
async def analyze_multiple_factsheets(
    files: List[UploadFile] = File(...),
    target_fund: str = Form(...)
):
    groq_key = os.environ.get("GROQ_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")

    if not groq_key and not gemini_key:
        raise HTTPException(
            status_code=400,
            detail="No API key found. Please set GROQ_API_KEY in your .env file."
        )

    system_prompt = f"""
You are an institutional mutual fund analyst and quantitative researcher.
Analyze the provided screenshots of a multi-page mutual fund fact sheet.
Extract comprehensive data across all pages into a consolidated JSON object.
Target portfolio fund: {target_fund}.

Strictly extract and evaluate all of the following parameters:
1. Cost & Size:
   - Direct TER (%) and Regular TER (%)
   - AUM (₹ in Crores)
   - Cost & size verdict (evaluate agility vs overhead)
2. Portfolio Quality:
   - Cash / TREPS / Liquid / Net Current Assets level (%)
   - Top 10 Holdings total concentration (%)
   - Top holdings list (company name, weight %, sector)
   - Sector allocation breakdown (sector name, weight %)
3. Performance & Discipline:
   - Benchmark Name (e.g. Nifty 50 TRI, Nifty Midcap 150 TRI, etc.)
   - CAGR Returns (1-Year, 3-Year, 5-Year, Since Inception) for both Fund and Benchmark
   - Portfolio Turnover Ratio (%)
   - Tracking Error (%) [if index fund]
4. Risk Metrics:
   - Sharpe Ratio
   - Beta (volatility against benchmark)
   - Standard Deviation (%)
5. Debt / Liquid Fund Metrics (if applicable):
   - YTM (%)
   - Modified Duration & Average Maturity / Macaulay Duration
   - Credit Quality Breakdown (Sovereign %, AAA %, AA %, A1+ %, Cash %)
6. Fund Management:
   - Fund Manager name(s), tenure managing this fund, and roles
7. Key diagnostic insights and highlights

Strictly return ONLY valid JSON matching this exact schema:
{{
  "detected_fund_name": "Full name found in factsheet",
  "matched_portfolio_fund": "One of: HDFC Nifty 50 | Nippon India Growth | Edelweiss Small Cap | Axis Liquid | Other",
  "as_of_date": "YYYY-MM-DD or Month Year",
  "aum_in_crores": 0.0,
  "ter_direct_percentage": 0.0,
  "ter_regular_percentage": 0.0,
  "cost_and_size_verdict": "1-2 sentences on cost efficiency & AUM agility",
  "cash_level_percentage": 0.0,
  "top_10_concentration_percentage": 0.0,
  "top_holdings": [
    {{ "company_name": "string", "weight_percentage": 0.0, "sector": "string" }}
  ],
  "sector_allocation": [
    {{ "sector_name": "string", "weight_percentage": 0.0 }}
  ],
  "returns_comparison": {{
    "benchmark_name": "string",
    "one_year": {{ "fund_cagr": null, "benchmark_cagr": null }},
    "three_year": {{ "fund_cagr": null, "benchmark_cagr": null }},
    "five_year": {{ "fund_cagr": null, "benchmark_cagr": null }},
    "since_inception": {{ "fund_cagr": null, "benchmark_cagr": null }}
  }},
  "risk_metrics": {{
    "sharpe_ratio": null,
    "beta": null,
    "standard_deviation_percentage": null,
    "portfolio_turnover_ratio_percentage": null,
    "tracking_error_percentage": null
  }},
  "debt_metrics": {{
    "ytm_percentage": null,
    "modified_duration_years_or_days": null,
    "average_maturity_years_or_days": null,
    "macaulay_duration_years_or_days": null,
    "credit_quality": {{
      "sovereign_percentage": null,
      "aaa_percentage": null,
      "aa_percentage": null,
      "a1_plus_percentage": null,
      "cash_and_equivalent_percentage": null
    }}
  }},
  "fund_managers": [
    {{ "name": "Manager Name", "tenure": "e.g. 5 Years (Since Aug 2019)", "experience_or_role": "string" }}
  ],
  "diagnostic_flags": [
    {{ "category": "cost_and_size|portfolio_quality|performance|risk|fund_manager", "title": "string", "status": "good|warning|danger|info", "message": "string" }}
  ],
  "investor_verdict": {{
    "action": "SUITABLE_FOR_ALLOCATION | HOLD_AND_MONITOR | REVIEW_CAUTION",
    "thesis": "Concise 1-2 sentence core investment verdict based on factsheet metrics",
    "key_strengths": ["Clear advantage 1", "Clear advantage 2", "Clear advantage 3"],
    "key_risks_to_watch": ["Key risk or watchpoint 1", "Key risk or watchpoint 2"],
    "investor_takeaway": "Actionable takeaway for portfolio compounding"
  }},
  "notes_or_highlights": "Concise key takeaway on portfolio health, benchmark discipline, and manager consistency."
}}
"""

    # 1. Primary: Groq Vision API
    if groq_key and Groq is not None:
        try:
            client = Groq(api_key=groq_key)
            content = [{"type": "text", "text": system_prompt}]
            
            for file in files:
                file_bytes = await file.read()
                opt_bytes, mime = optimize_image_for_vision(file_bytes, max_dim=1100)
                b64_img = base64.b64encode(opt_bytes).decode('utf-8')
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime};base64,{b64_img}"
                    }
                })

            completion = client.chat.completions.create(
                model="qwen/qwen3.8-27b",
                messages=[
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                temperature=0.1,
                max_completion_tokens=1800,
                response_format={"type": "json_object"}
            )
            
            raw_text = completion.choices[0].message.content
            cleaned = clean_json_string(raw_text)
            parsed = json.loads(cleaned)
            parsed["diagnostic_flags"] = compute_diagnostic_flags(parsed)
            return parsed

        except Exception as e:
            err_str = str(e)
            print(f"Groq Vision analysis failed: {err_str}")
            
            # If token limit was exceeded, auto-retry with aggressive compression
            if "rate_limit_exceeded" in err_str or "413" in err_str or "too large" in err_str.lower():
                try:
                    print("Retrying Groq Vision with compact resolution...")
                    retry_content = [{"type": "text", "text": system_prompt}]
                    for file in files:
                        await file.seek(0)
                        file_bytes = await file.read()
                        opt_bytes, mime = optimize_image_for_vision(file_bytes, max_dim=850)
                        b64_img = base64.b64encode(opt_bytes).decode('utf-8')
                        retry_content.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{b64_img}"
                            }
                        })
                    completion = client.chat.completions.create(
                        model="qwen/qwen3.8-27b",
                        messages=[{"role": "user", "content": retry_content}],
                        temperature=0.1,
                        max_completion_tokens=1500,
                        response_format={"type": "json_object"}
                    )
                    raw_text = completion.choices[0].message.content
                    cleaned = clean_json_string(raw_text)
                    parsed = json.loads(cleaned)
                    parsed["diagnostic_flags"] = compute_diagnostic_flags(parsed)
                    return parsed
                except Exception as retry_err:
                    print(f"Groq compact retry error: {retry_err}")

            if not gemini_key:
                raise HTTPException(status_code=500, detail=f"Groq Vision Error: {str(e)}")

    # 2. Fallback: Google Gemini Flash
    if gemini_key and genai is not None:
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            contents = []
            for file in files:
                await file.seek(0)
                file_bytes = await file.read()
                contents.append({
                    "mime_type": file.content_type or "image/png",
                    "data": file_bytes
                })
            contents.append(system_prompt)

            response = model.generate_content(
                contents,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=FactSheetResult
                )
            )
            parsed = json.loads(response.text)
            parsed["diagnostic_flags"] = compute_diagnostic_flags(parsed)
            return parsed
        except Exception as e:
            print(f"Gemini analysis failed: {e}")
            raise HTTPException(status_code=500, detail=f"Gemini Error: {str(e)}")

    raise HTTPException(status_code=500, detail="Vision AI provider failed to process request.")



@app.get("/api/portfolio/summary")
def get_portfolio_summary(db: Session = Depends(get_db)):
    # Returns latest monthly metrics, sector weights, and asset class breakdown
    # In a real app, this would aggregate from the latest FactSheetSnapshots
    snapshots = db.query(models.FactSheetSnapshot).all()
    # Mock data for now until we parse real PDFs
    return {
        "status": "success",
        "message": "Portfolio summary endpoint",
        "snapshot_count": len(snapshots)
    }

@app.get("/api/funds/{fund_id}/latest")
def get_latest_fund_data(fund_id: str, db: Session = Depends(get_db)):
    fund = db.query(models.Fund).filter(models.Fund.id == fund_id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    
    snapshot = db.query(models.FactSheetSnapshot)\
                 .filter(models.FactSheetSnapshot.fund_id == fund_id)\
                 .order_by(models.FactSheetSnapshot.created_at.desc())\
                 .first()
                 
    return {
        "fund": {
            "id": fund.id,
            "name": fund.name,
            "amc": fund.amc,
            "category": fund.category
        },
        "latest_snapshot": snapshot
    }

@app.post("/api/pipeline/sync")
def trigger_pipeline_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # This endpoint would trigger the scraping process.
    # For now, it will just seed some dummy funds if they don't exist
    seed_funds(db)
    
    # In a real scenario we'd use background_tasks.add_task(run_scrapers)
    return {"status": "success", "message": "Pipeline sync triggered (mocked)"}


def seed_funds(db: Session):
    target_funds = [
        {"id": "hdfc-nifty-50", "name": "HDFC Nifty 50 Index Fund", "amc": "HDFC", "category": "Large Cap / Index"},
        {"id": "nippon-india-growth", "name": "Nippon India Growth Fund", "amc": "Nippon India", "category": "Mid Cap"},
        {"id": "edelweiss-small-cap", "name": "Edelweiss Small Cap Fund", "amc": "Edelweiss", "category": "Small Cap"},
        {"id": "axis-liquid", "name": "Axis Liquid Fund", "amc": "Axis", "category": "Debt / Liquid"}
    ]
    
    for f_data in target_funds:
        existing = db.query(models.Fund).filter(models.Fund.id == f_data["id"]).first()
        if not existing:
            fund = models.Fund(**f_data)
            db.add(fund)
    db.commit()

