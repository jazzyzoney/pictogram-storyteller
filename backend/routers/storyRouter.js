import { Router } from 'express'
import db from '../database/connection.js' 
import Groq from "groq-sdk" 
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

// SIKKER INDLÆSNING AF SPROGFIL
let daLocale;
try {
    const localePath = path.join(__dirname, '../locales/da.json');
    daLocale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
} catch (err) {
    console.error("❌ Kunne ikke indlæse da.json. Tjek stien!", err.message);
    daLocale = { mappings: {} }; // Fallback så appen ikke crasher
}

// ---------------------------------------------------------
// RUTE 1: STORYTELLER (Fri tekst til piktogrammer)
// ---------------------------------------------------------
router.post('/api/stories/generate', async (req, res) => {
    const { text } = req.body
    console.log("📥 Tekst modtaget fra frontend:", text);

    if (!text || text.trim() === "") {
        return res.status(400).send("Ingen tekst modtaget.")
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).send("GROQ_API_KEY mangler i miljøvariabler.")
    }

    try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
        
        const prompt = `System: Du er en pædagogisk piktogram-generator. Du svarer KUN med rå JSON.
        Bruger: Analyser denne danske tekst: "${text}"

        Regler:
        1. Find de 3-5 vigtigste handlinger eller navneord.
        2. Oversæt ordene til ENGELSK (en) og behold den danske version (da).
        3. Returner en JSON-liste med objekter.

        Format eksempel: 
        [{"da": "tandbørste", "en": "toothbrush"}, {"da": "seng", "en": "bed"}]`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile", 
        })

        const fullText = completion.choices[0]?.message?.content || "";
        console.log("🤖 AI svarer:", fullText);

        let keywords;
        try {
            const cleanJSON = fullText.replace(/```json|```/g, "").trim();
            keywords = JSON.parse(cleanJSON);
        } catch (e) {
            console.error("❌ JSON parsing fejlede. Forsøger nød-parsing.");
            const match = fullText.match(/\[.*\]/s);
            if (match) {
                keywords = JSON.parse(match[0]);
            } else {
                throw new Error("AI svaret kunne ikke tolkes som JSON");
            }
        }

        const pictogramSequence = []

        for (const item of keywords) {
            const searchWord = item.en ? item.en.trim().toLowerCase() : ""; 
            const displayWord = item.da || searchWord;

            if (!searchWord) continue;

            try {
                const response = await fetch(`https://api.arasaac.org/api/pictograms/en/bestSearch/${encodeURIComponent(searchWord)}`);
                const data = await response.json();

                if (data && data.length > 0) {
                    const bestMatch = data.find(p => p.aacColor) || data[0];
                    const id = bestMatch._id; 

                    pictogramSequence.push({
                        keyword: displayWord, 
                        url: `https://static.arasaac.org/pictograms/${id}/${id}_300.png`, 
                        id: id
                    });
                }
            } catch (error) {
                console.error(`Fejl ved søgning på ${searchWord}:`, error);
            }
        }

        const result = await db.run(
            `INSERT INTO stories (title, raw_text, pictograms_json) VALUES (?, ?, ?)`,
            [text.substring(0, 30) + "...", text, JSON.stringify(pictogramSequence)]
        );

        return res.json({ 
            success: true, 
            storyId: result.lastID, 
            pictograms: pictogramSequence 
        })

    } catch (error) {
        console.error("Fejl i Storyteller:", error)
        if (!res.headersSent) {
            return res.status(500).send("Agenten eller API'et fejlede.")
        }
    }
})


// ---------------------------------------------------------
// RUTE 2: GENERER UGESKEMA (i18n + AI + Database)
// ---------------------------------------------------------
router.post('/api/schedules/generate', async (req, res) => {
    const { rows } = req.body;
    if (!rows) return res.status(400).json({ error: "Ingen data modtaget" });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const finalSchedule = [];

    try {
        // 1. Byg skemaet med piktogrammer
        for (let row of rows) {
            let processedRow = { time: row.time };
            
            for (let day of ['mon', 'tue', 'wed', 'thu', 'fri']) {
                let activity = row[day]?.trim() || "";
                
                if (activity !== "") {
                    const activityLower = activity.toLowerCase();
                    let englishKeyword = "";
                    let manualId = null;

                    if (daLocale.mappings[activityLower]) {
                        englishKeyword = daLocale.mappings[activityLower].en;
                        manualId = daLocale.mappings[activityLower].manualId;
                    } else {
                        const prompt = `Translate to 1 English keyword for pictogram search: "${activity}". Return only the word.`;
                        const completion = await groq.chat.completions.create({
                            messages: [{ role: "user", content: prompt }],
                            model: "llama-3.3-70b-versatile",
                        });
                        englishKeyword = completion.choices[0]?.message?.content.trim();
                    }

                    let url = "";
                    if (manualId) {
                        url = `https://static.arasaac.org/pictograms/${manualId}/${manualId}_300.png`;
                    } else {
                        const response = await fetch(`https://api.arasaac.org/api/pictograms/en/bestSearch/${encodeURIComponent(englishKeyword)}`);
                        const data = await response.json();
                        if (data && data.length > 0) {
                            const id = data[0]._id;
                            url = `https://static.arasaac.org/pictograms/${id}/${id}_300.png`;
                        }
                    }
                    processedRow[day] = { keyword: activity, url: url };
                } else {
                    processedRow[day] = null;
                }
            }
            finalSchedule.push(processedRow);
        }

        // 2. Gem i databasen EN GANG
        const result = await db.run(
            `INSERT INTO schedules (title, schedule_json) VALUES (?, ?)`,
            ["Ugeskema", JSON.stringify(finalSchedule)]
        );

        // 3. Send ét samlet svar tilbage med ID'et
        return res.json({ 
            success: true, 
            schedule: finalSchedule,
            id: result.lastID 
        });

    } catch (error) {
        console.error("Skema fejl:", error);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
});


// ---------------------------------------------------------
// RUTE 3: HENT ET SPECIFIKT SKEMA (Til links / PDF visning)
// ---------------------------------------------------------
router.get('/api/schedules/:id', async (req, res) => {
    try {
        const schedule = await db.get("SELECT * FROM schedules WHERE id = ?", [req.params.id]);
        
        if (!schedule) {
            return res.status(404).json({ success: false, error: "Skemaet blev ikke fundet." });
        }

        return res.json({ 
            success: true, 
            data: JSON.parse(schedule.schedule_json),
            title: schedule.title
        });
    } catch (error) {
        console.error("Fejl ved hentning:", error);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
});

export default router