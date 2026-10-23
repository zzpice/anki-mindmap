"""Legacy CLI alias: assembles test assets only, never publishes a Release."""
from build_react_package import build
if __name__ == '__main__':
    print(build())
