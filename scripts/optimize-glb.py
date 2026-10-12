"""Losslessly repack embedded PNGs as WebP when smaller; preserve geometry.

One-off asset maintenance tool, excluded from _site. Requires Pillow.
Usage: python3 scripts/optimize-glb.py original.glb optimized.glb
Recover originals from the baseline commit documented in docs/performance.md.
"""
import io
import json
from pathlib import Path
import struct
import sys
from PIL import Image


def optimize(source, destination):
    data = source.read_bytes()
    assert data[:4] == b'glTF' and struct.unpack_from('<I', data, 4)[0] == 2
    size = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + size])
    binary = data[28 + size:]
    assert len(gltf['buffers']) == 1 and 'uri' not in gltf['buffers'][0]
    views = [binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
             for v in gltf['bufferViews']]
    converted = set()
    for index, image in enumerate(gltf.get('images', [])):
        if image['mimeType'] != 'image/png':
            continue
        original = Image.open(io.BytesIO(views[image['bufferView']]))
        output = io.BytesIO()
        original.save(output, format='WEBP', lossless=True, method=6, exact=True)
        encoded = output.getvalue()
        # Compare every decoded RGBA channel, including alpha; never accept loss.
        assert original.convert('RGBA').tobytes() == Image.open(io.BytesIO(encoded)).convert('RGBA').tobytes()
        if len(encoded) >= len(views[image['bufferView']]):
            continue
        print(image.get('name', index), len(views[image['bufferView']]), '->', len(encoded))
        views[image['bufferView']] = encoded
        image['mimeType'] = 'image/webp'
        if image.get('name', '').endswith('.png'):
            image['name'] = image['name'][:-4] + '.webp'
        converted.add(index)
    if converted:
        for texture in gltf['textures']:
            if texture.get('source') in converted:
                texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': texture.pop('source')}
        for field in ['extensionsUsed', 'extensionsRequired']:
            gltf.setdefault(field, []).append('EXT_texture_webp')
    packed = bytearray()
    for view, content in zip(gltf['bufferViews'], views):
        packed.extend(b'\0' * (-len(packed) % 4))
        view['byteOffset'] = len(packed)
        view['byteLength'] = len(content)
        packed.extend(content)
    gltf['buffers'][0]['byteLength'] = len(packed)
    packed.extend(b'\0' * (-len(packed) % 4))
    encoded_json = json.dumps(gltf, separators=(',', ':'), ensure_ascii=False).encode()
    encoded_json += b' ' * (-len(encoded_json) % 4)
    output = (struct.pack('<4sII', b'glTF', 2, 28 + len(encoded_json) + len(packed))
              + struct.pack('<I4s', len(encoded_json), b'JSON') + encoded_json
              + struct.pack('<I4s', len(packed), b'BIN\0') + packed)
    destination.write_bytes(output)
    print(source.name, len(data), '->', len(output))


if __name__ == '__main__':
    optimize(Path(sys.argv[1]), Path(sys.argv[2]))
