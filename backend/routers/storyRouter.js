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


// router.get('/api/stories', async (req, res) => {
//     try {
//         const stories = await db.all("SELECT * FROM stories ORDER BY created_at DESC");
//         res.json({ data: stories });
//     } catch (error) {
//         res.status(500).json({ error: "Kunne ikke hente historier" });
//     }
// });

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
        
        // 1. AI AGENT: Udtræk keywords

        // første prompt forsøg
        // const prompt = `System: Du er en piktogram-maskine. Du må KUN svare med rå JSON. Ingen forklaringer, ingen høflighed, ingen tekst før eller efter listen.
        // Bruger: Oversæt disse danske ord til engelske piktogram-keywords i en JSON-liste: "${text}"
        // Svar format: ["word1", "word2"]`;
        
        // andet forsøg med prompt
        // const prompt = `System: Du er en pædagogisk piktogram-generator. Du er ekspert i at støtte børn med autisme gennem visuel struktur. 
        // Du svarer KUN med rå JSON-data. Ingen forklaringer eller indledende tekst.

        // Bruger: Analyser denne danske tekst: "${text}"

        // Regler:
        // 1. Find de 3-5 vigtigste konkrete handlinger eller navneord.
        // 2. Oversæt ordene til ENGELSK (til brug i billedsøgning).
        // 3. Returner en JSON-liste med objekter.

        // Format eksempel: 
        // ["word1", "word2"]`;

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

        // ROBUST JSON PARSING: Vi fjerner evt. tekst udenom selve listen
        let keywords;
        try {
            const cleanJSON = fullText.replace(/```json|```/g, "").trim();
            keywords = JSON.parse(cleanJSON);
        } catch (e) {
            console.error("❌ JSON parsing fejlede. Forsøger nød-parsing.");
            // Hvis AI'en stadig snakker, prøver vi at finde alt mellem [ og ]
            const match = fullText.match(/\[.*\]/s);
            if (match) {
                keywords = JSON.parse(match[0]);
            } else {
                throw new Error("AI svaret kunne ikke tolkes som JSON");
            }
        }

        // 2. ARASAAC INTEGRATION
        const pictogramSequence = []

// for (const word of keywords) {
//     const cleanWord = word.trim().toLowerCase(); 

//     try {
//         // Vi bruger 'en' i stedet for 'da' i URL'en nu
//         const response = await fetch(`https://api.arasaac.org/api/pictograms/en/bestSearch/${encodeURIComponent(cleanWord)}`);
//         const data = await response.json();

//         if (data && data.length > 0) {
//             // Vi vælger det første match, men prioriterer 'aacColor: true' hvis muligt
//             const bestMatch = data.find(p => p.aacColor) || data[0];
//             const id = bestMatch._id; 

//             pictogramSequence.push({
//                 keyword: word, // Det engelske ord (eller din AI kan give dig begge)
//                 url: `https://static.arasaac.org/pictograms/${id}/${id}_300.png`, 
//                 id: id
//             });
//         }
//     } catch (error) {
//         console.error(`Fejl ved søgning på ${cleanWord}:`, error);
//     }
// }


for (const item of keywords) {
    // Da 'item' nu er et objekt f.eks. {"da": "tand", "en": "tooth"}
    // bruger vi 'en' til søgning og 'da' til display
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
                keyword: displayWord, // Her gemmes det danske ord til din frontend!
                url: `https://static.arasaac.org/pictograms/${id}/${id}_300.png`, 
                id: id
            });
        }
    } catch (error) {
        console.error(`Fejl ved søgning på ${searchWord}:`, error);
    }
}

        // 3. DATABASE: Gem historien
        // Vi bruger kolonnenavne fra din setup.js
        const result = await db.run(
            `INSERT INTO stories (title, raw_text, pictograms_json) VALUES (?, ?, ?)`,
            [
                text.substring(0, 30) + "...", 
                text,
                JSON.stringify(pictogramSequence)
            ]
        );

        res.json({ 
            success: true, 
            storyId: result.lastID, 
            pictograms: pictogramSequence 
        })

    } catch (error) {
        console.error("Fejl i Storyteller:", error)
        res.status(500).send("Agenten eller API'et fejlede.")
    }
})

router.post('/api/schedules/generate', async (req, res) => {
    const { rows } = req.body;
    if (!rows) return res.status(400).json({ error: "Ingen data modtaget" });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const finalSchedule = [];

    try {
        for (let row of rows) {
            let processedRow = { time: row.time };
            
            for (let day of ['mon', 'tue', 'wed', 'thu', 'fri']) {
                let activity = row[day]?.trim() || "";
                
                if (activity !== "") {
                    const activityLower = activity.toLowerCase();
                    let englishKeyword = "";
                    let manualId = null;

                    // Tjek ordbogen først
                    if (daLocale.mappings[activityLower]) {
                        englishKeyword = daLocale.mappings[activityLower].en;
                        manualId = daLocale.mappings[activityLower].manualId;
                    } else {
                        // AI Fallback
                        const prompt = `Translate to 1 English keyword for pictogram search: "${activity}". Return only the word.`;
                        const completion = await groq.chat.completions.create({
                            messages: [{ role: "user", content: prompt }],
                            model: "llama-3.3-70b-versatile",
                        });
                        englishKeyword = completion.choices[0]?.message?.content.trim();
                    }

                    // ARASAAC Fetch
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

        res.json({ success: true, schedule: finalSchedule });
    } catch (error) {
        console.error("Skema fejl:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router