from app.routers import shortener
from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(
    #docs_url=None,
    #redoc_url=None,
    #openapi_url=None
)

# BaseDir
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Home
@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Include all routers
app.include_router(shortener.router)