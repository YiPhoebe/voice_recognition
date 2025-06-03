

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="tem")

@router.get("/", response_class=HTMLResponse)
async def get_home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/intro", response_class=HTMLResponse)
async def get_intro(request: Request):
    return templates.TemplateResponse("intro.html", {"request": request})

@router.get("/test", response_class=HTMLResponse)
async def get_test(request: Request):
    return templates.TemplateResponse("adhd_test.html", {"request": request})

@router.get("/result", response_class=HTMLResponse)
async def get_result(request: Request):
    return templates.TemplateResponse("result.html", {"request": request})