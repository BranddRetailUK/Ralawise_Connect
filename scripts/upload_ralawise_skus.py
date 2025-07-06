import pandas as pd
from sqlalchemy import create_engine, text

# === CONFIGURATION ===
CSV_PATH = "/Users/scottcharles/Desktop/RALAWISE MASTER PRODUCT SKUS.csv"  # Or update if moved
DB_URL = "postgresql://postgres:liZNeCpQgUIrqoGORWfqKdjVtOKJGMMO@trolley.proxy.rlwy.net:15560/railway"

# === STEP 1: LOAD AND CLEAN CSV ===
try:
    df = pd.read_csv(CSV_PATH, encoding="latin1")
    df.columns = [col.strip() for col in df.columns]  # Clean whitespace
    print("✅ CSV loaded successfully.")
    print("📄 Columns found:", df.columns.tolist())
except Exception as e:
    print("❌ Failed to load CSV:", e)
    exit()

# Rename columns to match DB schema
expected_cols = ['Sku Code', 'Style Code', 'Colour Name', 'Size Code']
if set(expected_cols).issubset(df.columns):
    df = df[expected_cols]
    df.columns = ['sku_code', 'style_code', 'colour_name', 'size_code']
else:
    print("❌ CSV does not have expected columns:", expected_cols)
    exit()

# === STEP 2: CONNECT TO DATABASE ===
try:
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("✅ Database connection successful.")
except Exception as e:
    print("❌ Failed to connect to database:", e)
    exit()

# === STEP 3: UPLOAD TO DATABASE ===
try:
    df.to_sql('ralawise_skus', engine, if_exists='append', index=False)
    print("✅ Data uploaded successfully to 'ralawise_skus'")
except Exception as e:
    print("❌ Upload failed:", e)
