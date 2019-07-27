import requests
import io
from PIL import Image

s = requests.Session()


def proxy(url):
    res = s.get(url, stream=False)
    mime = res.headers.get('content-type', 'application/octet-stream')
    content = res.content

    if mime.lower().startswith('image/'):
        orig = io.BytesIO(content)
        i = Image.open(orig)
        i = i.convert('RGB')
        i.thumbnail([500, 1000])

        png = io.BytesIO()
        i.save(png, 'PNG')
        png = png.getvalue()
        if len(content) > len(png):
            content = png
            mime = 'image/png'

        jpeg = io.BytesIO()
        i.save(jpeg, 'JPEG', optimize=True, quality=65)
        jpeg = jpeg.getvalue()
        if len(content) > len(jpeg):
            content = jpeg
            mime = 'image/jpeg'

    return [content, mime]
