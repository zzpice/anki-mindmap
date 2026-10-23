"""Compatibility CLI: always creates the independent React test package."""
from build_react_package import build
if __name__ == '__main__':
    print(build())
