import glob
import os

output_file = "codebase_export.md"
include_globs = [
    "main.py",
    "app/**/*.py",
    "frontend/web/src/**/*.js",
    "frontend/web/src/**/*.jsx",
    "frontend/web/src/**/*.css",
    "frontend/web/index.html",
    "frontend/web/vite.config.js",
    "frontend/web/package.json",
    "pyproject.toml"
]

with open(output_file, "w", encoding="utf-8") as out:
    out.write("# Codebase Export\n\n")
    for pattern in include_globs:
        for filepath in glob.glob(pattern, recursive=True):
            if not os.path.isfile(filepath):
                continue
            out.write(f"## {filepath}\n")

            ext = os.path.splitext(filepath)[1].lower()
            lang = "text"
            if ext in [".py"]: lang = "python"
            elif ext in [".js", ".jsx"]: lang = "javascript"
            elif ext in [".css"]: lang = "css"
            elif ext in [".json"]: lang = "json"
            elif ext in [".html"]: lang = "html"
            elif ext in [".toml"]: lang = "toml"

            out.write(f"```{lang}\n")
            try:
                with open(filepath, encoding="utf-8") as f:
                    out.write(f.read())
            except Exception as e:
                out.write(f"Error reading file: {e}\n")
            out.write("\n```\n\n")

print(f"Exported to {output_file}")
