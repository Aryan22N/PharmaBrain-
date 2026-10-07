import os, sys
from sqlalchemy import create_engine, MetaData, Table, inspect

raw_url = "postgresql://postgres.dvydfsahkqzgluusdsnn:arn2252006%40123@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"

if raw_url.startswith("postgresql://"):
    url = "postgresql+psycopg2://" + raw_url[len("postgresql://"):]
else:
    url = raw_url

engine = create_engine(url)
inspector = inspect(engine)

for table_name in inspector.get_table_names():
    print(f"\nTable: {table_name}")
    columns = inspector.get_columns(table_name)
    for col in columns:
        print(f"  - {col['name']}: {col['type']}")
