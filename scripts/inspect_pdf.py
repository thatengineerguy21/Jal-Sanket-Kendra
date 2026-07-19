import sys

import tabula

pdf_path = sys.argv[1]
try:
    tables = tabula.read_pdf(pdf_path, pages="all", multiple_tables=True)
    print(f"Found {len(tables)} tables")
    for i, table in enumerate(tables):
        print(f"--- Table {i} ---")
        print(table.head())
except Exception as e:
    print(f"Error: {e}")
