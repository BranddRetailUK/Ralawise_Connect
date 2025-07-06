import pandas as pd
from sqlalchemy import create_engine

# === CONFIGURATION ===
CSV_PATH = "/Users/scottcharles/Desktop/ralawise_colour_map.csv"
DB_URL = "postgresql://postgres:liZNeCpQgUIrqoGORWfqKdjVtOKJGMMO@trolley.proxy.rlwy.net:15560/railway"

# === LOAD AND CLEAN ===
df = pd.read_csv(CSV_PATH)
df.columns = [col.strip() for col in df.columns]
df['input_name'] = df['input_name'].astype(str).str.strip()
df['sku_code'] = df['sku_code'].astype(str).str.strip()
print(f"✅ Loaded {len(df)} rows from CSV")

# === UPLOAD TO DATABASE USING to_sql ===
engine = create_engine(DB_URL)
df.to_sql('colour_map', engine, if_exists='append', index=False)
print("✅ Data uploaded successfully to 'colour_map'")
