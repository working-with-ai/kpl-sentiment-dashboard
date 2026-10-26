CREATE TABLE archive_days (
 trade_date TEXT PRIMARY KEY,
 saved_at TEXT NOT NULL,
 stock_count INTEGER NOT NULL,
 compressed_bytes INTEGER NOT NULL
);
CREATE TABLE archive_chunks (
 trade_date TEXT NOT NULL,
 dataset TEXT NOT NULL,
 part INTEGER NOT NULL,
 payload BLOB NOT NULL,
 PRIMARY KEY (trade_date,dataset,part)
);
