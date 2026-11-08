import math
import os
import tempfile
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from svgpathtools import svg2paths
from shapely.geometry import Polygon, LineString
from shapely.affinity import scale
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Panel:
    def __init__(self, panel_id):
        self.id = panel_id
        self.segments = {}

def parse_all_svg_paths(filepath, dpi=96, points_resolution=200, svg_units="mm"):
    paths, attributes = svg2paths(filepath)
    if not paths:
        raise ValueError("No paths found in SVG.")

    all_shapes_points = []
    for path in paths:
        points_in_inches = []
        for t in np.linspace(0, 1, points_resolution):
            point = path.point(t)
            if svg_units == "mm":
                x_inch, y_inch = point.real / 25.4, point.imag / 25.4
            elif svg_units == "in":
                x_inch, y_inch = point.real, point.imag
            else:
                x_inch, y_inch = point.real / dpi, point.imag / dpi
            points_in_inches.append((x_inch, -y_inch))

        min_y = min([p[1] for p in points_in_inches])
        min_x = min([p[0] for p in points_in_inches])
        normalized = [(x - min_x, y - min_y) for x, y in points_in_inches]
        all_shapes_points.append(normalized)
    return all_shapes_points

def slice_to_panels(stitch_poly, max_stitches=None):
    min_x, min_y, max_x, max_y = stitch_poly.bounds
    start_row = math.floor(min_y)
    end_row = math.ceil(max_y)

    active_panels, finished_panels = [], []
    panel_counter = 0

    for row in range(start_row, end_row):
        scan_y = row + 0.5
        scanline = LineString([(min_x - 1, scan_y), (max_x + 1, scan_y)])
        intersection = stitch_poly.intersection(scanline)

        if intersection.is_empty:
            if active_panels:
                finished_panels.extend(active_panels)
                active_panels = []
            continue

        if intersection.geom_type == 'GeometryCollection':
            lines = [geom for geom in intersection.geoms if geom.geom_type == 'LineString']
        elif intersection.geom_type == 'MultiLineString':
            lines = list(intersection.geoms)
        elif intersection.geom_type == 'LineString':
            lines = [intersection]
        else:
            lines = []

        current_segments = []
        for line in lines:
            if line.is_empty: continue
            s_start, s_end = round(line.bounds[0]), round(line.bounds[2])
            if s_end <= s_start: continue

            if max_stitches:
                curr = s_start
                while curr < s_end:
                    chunk_end = min(curr + max_stitches, s_end)
                    current_segments.append((curr, chunk_end))
                    curr += max_stitches
            else:
                current_segments.append((s_start, s_end))

        if not current_segments:
            finished_panels.extend(active_panels)
            active_panels = []
            continue

        overlaps = []
        for p_idx, p in enumerate(active_panels):
            last_row = max(p.segments.keys())
            if last_row == row - 1:
                last_seg = p.segments[last_row]
                for s_idx, s in enumerate(current_segments):
                    overlap = max(0, min(last_seg[1], s[1]) - max(last_seg[0], s[0]))
                    if overlap > 0: overlaps.append((overlap, p_idx, s_idx))

        overlaps.sort(reverse=True)
        used_panels, used_segments = set(), set()
        next_active = []

        for overlap_size, p_idx, s_idx in overlaps:
            if p_idx not in used_panels and s_idx not in used_segments:
                active_panels[p_idx].segments[row] = current_segments[s_idx]
                next_active.append(active_panels[p_idx])
                used_panels.add(p_idx), used_segments.add(s_idx)

        for s_idx, s in enumerate(current_segments):
            if s_idx not in used_segments:
                new_p = Panel(panel_counter)
                panel_counter += 1
                new_p.segments[row] = s
                next_active.append(new_p)

        for p_idx, p in enumerate(active_panels):
            if p_idx not in used_panels:
                finished_panels.append(active_panels[p_idx])

        active_panels = next_active

    finished_panels.extend(active_panels)
    return [p for p in finished_panels if p.segments]

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.get("/")
async def serve_frontend():
    try:
        with open("index.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Error: index.html not found</h1>", status_code=404)

@app.post("/api/analyze")
async def analyze_svg(file: UploadFile = File(...)):
    """Quick parse to count shapes in the SVG."""
    fd, tmppath = tempfile.mkstemp(suffix=".svg", dir="/tmp")
    try:
        content = await file.read()
        with os.fdopen(fd, "wb") as f: f.write(content)
        all_shapes = parse_all_svg_paths(tmppath)
        return JSONResponse(content={"shape_count": len(all_shapes)})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    finally:
        if os.path.exists(tmppath):
            os.unlink(tmppath)

@app.post("/api/slice")
async def slice_shape(
    file: UploadFile = File(...),
    sts_per_unit: float = Form(22),
    rows_per_unit: float = Form(30),
    gauge_unit: str = Form("100mm"),
    shape_index: int = Form(0)
):
    fd, tmppath = tempfile.mkstemp(suffix=".svg", dir="/tmp")
    try:
        content = await file.read()
        with os.fdopen(fd, "wb") as f: f.write(content)

        if gauge_unit == "100mm":
            sts_per_inch = sts_per_unit * (25.4 / 100)
            rows_per_inch = rows_per_unit * (25.4 / 100)
        else:
            sts_per_inch, rows_per_inch = sts_per_unit, rows_per_unit

        all_shapes = parse_all_svg_paths(tmppath)
        if shape_index >= len(all_shapes):
            shape_index = 0

        poly = Polygon(all_shapes[shape_index])
        stitch_poly = scale(poly, xfact=sts_per_inch, yfact=rows_per_inch, origin=(0, 0))
        panels = slice_to_panels(stitch_poly, max_stitches=None)

        project_data = {
            "bounds": list(stitch_poly.bounds),
            "panels": [
                {
                    "id": p.id,
                    "segments": {str(row): coords for row, coords in p.segments.items()}
                } for p in panels
            ]
        }
        return JSONResponse(content=project_data)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)
    finally:
        if os.path.exists(tmppath):
            os.unlink(tmppath)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
