import sqlite3

conn = sqlite3.connect("water_quality.db")
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(water_samples)")
for row in cursor.fetchall():
    print(row)

import sqlite3

DB_PATH = "D:/Code/Projects/Jal-Sanket-Kendra/water_quality.db"


def list_tables():
    """List all tables in the SQLite database."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # List all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        print("Tables in database:")
        for table in tables:
            print(f"  - {table[0]}")

        return tables

    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return []
    finally:
        if conn:
            conn.close()


def describe_table(table_name):
    """Show the schema (columns and types) of a specific table."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Get table columns
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()

        print(f"\nSchema for table '{table_name}':")
        print("-" * 50)
        print("Column Name | Type | Not Null | Default | Primary Key")
        print("-" * 50)

        for col in columns:
            col_name = col[1]
            col_type = col[2]
            not_null = "YES" if col[3] else "NO"
            default_val = col[4] if col[4] is not None else "-"
            pk = "YES" if col[5] else "NO"

            print(f"{col_name:12s} | {col_type:10s} | {not_null:8s} | {default_val:9s} | {pk}")

    except sqlite3.Error as e:
        print(f"Error describing table '{table_name}': {e}")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    tables = list_tables()

    if tables:
        # Describe all tables
        for table in tables:
            describe_table(table[0])

list_tables()
describe_table("water_samples")
