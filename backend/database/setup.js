import db from './connection.js';

async function setup() {
    // Story-tabellen (anonym)
    await db.exec(`CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        raw_text TEXT,
        pictograms_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ugeskema-tabellen (anonym)
    await db.exec(`CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        schedule_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log("✅ Database created.");
}

setup();