"""Build the collision-safe APKG and its optional current local preview."""
from build_react_package import build, SITE
if __name__ == '__main__':
    build()
    print(SITE/'index.html')
