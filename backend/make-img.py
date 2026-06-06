from PIL import Image
import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(script_dir, 'test-img.jpg')

img = Image.new('RGB', (100, 100), 'red')
img.save(output_path)
print(f'done: {output_path}')
