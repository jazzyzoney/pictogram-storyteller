<script lang="ts">
    import toastr from 'toastr';
    import 'toastr/build/toastr.min.css';

    let loading = false;
    let scheduleRows: Array<{ time: string; [key: string]: string }> = [
        { time: "08:00 - 09:00", mon: "", tue: "", wed: "", thu: "", fri: "" }
    ];
    let generatedSchedule: any = null;

    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];

    function addRow() {
        scheduleRows = [...scheduleRows, { time: "", mon: "", tue: "", wed: "", thu: "", fri: "" }];
    }

    async function generateSchedule() {
        loading = true;
        
        // Vi forbereder dataene: Hvis "custom" er valgt, bruger vi den indtastede tekst fra hjælpe-feltet
        const preparedRows = scheduleRows.map(row => {
            let newRow: { time: string; [key: string]: string } = { time: row.time };
            days.forEach(day => {
                if (row[day] === 'custom') {
                    // Brug den tekst, brugeren skrev i input-feltet
                    newRow[day] = row[day + "_custom"] || "";
                } else {
                    newRow[day] = row[day];
                }
            });
            return newRow;
        });

        try {
            const response = await fetch('http://localhost:8080/api/schedules/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: preparedRows }),
                credentials: 'include'
            });

            const data = await response.json();
            if (data.success) {
                generatedSchedule = data.schedule;
                toastr.success("Ugeskema genereret! 📅");
            } else {
                toastr.error("Kunne ikke generere skema: " + (data.error || "Ukendt fejl"));
            }
        } catch (error) {
            toastr.error("Serverfejl ved generering af skema.");
            console.error(error);
        } finally {
            loading = false;
        }
    }

    let scenarios: { [key: string]: string[] } = {
        "school": ["Dansk", "Matematik", "Pause", "Frokost", "Idræt"],
        "home": ["Børste tænder", "Morgenmad", "Lege", "Pause", "Sove"]
    };
    
    let selectedScenario = "school";
    $: activities = scenarios[selectedScenario] || [];
</script>

<main>
    <h1>Lav ugeskema</h1>
    
    <div class="controls">
        <label for="scenario-select">Vælg scenarie:</label>
        <select id="scenario-select" bind:value={selectedScenario}>
            <option value="school">Skole</option>
            <option value="home">Hjemme</option>
        </select>
    </div>
    
    <div class="editor">
        <table>
            <thead>
                <tr>
                    <th>Tid</th>
                    <th>Mandag</th>
                    <th>Tirsdag</th>
                    <th>Onsdag</th>
                    <th>Torsdag</th>
                    <th>Fredag</th>
                </tr>
            </thead>
            <tbody>
                {#each scheduleRows as row}
                    <tr>
                        <td><input type="text" bind:value={row.time} placeholder="Tid..."></td>
                        {#each days as day}
                            <td>
                                <select bind:value={row[day]}>
                                    <option value="">-- Vælg --</option>
                                    {#each activities as act}
                                        <option value={act}>{act}</option>
                                    {/each}
                                    <option value="custom">Andet...</option>
                                </select>

                                {#if row[day] === 'custom'}
                                    <input 
                                        type="text" 
                                        placeholder="Skriv selv..." 
                                        bind:value={row[day + "_custom"]}
                                        style="margin-top: 5px; font-size: 0.8rem;"
                                    />
                                {/if}
                            </td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
        
        <div class="actions">
            <button class="secondary" on:click={addRow}>➕ Tilføj række</button>
            <button on:click={generateSchedule} disabled={loading}>
                {loading ? "Henter billeder..." : "Færdiggør skema ✨"}
            </button>
        </div>
    </div>

    {#if generatedSchedule}
        <div class="final-schedule">
            <div class="grid-header">Tid</div>
            <div class="grid-header">Man</div>
            <div class="grid-header">Tirs</div>
            <div class="grid-header">Ons</div>
            <div class="grid-header">Tors</div>
            <div class="grid-header">Fre</div>

            {#each generatedSchedule as row}
                <div class="time-cell">{row.time}</div>
                {#each days as day}
                    <div class="pic-cell">
                        {#if row[day]}
                            <img src={row[day].url} alt={row[day].keyword} />
                            <span>{row[day].keyword}</span>
                        {/if}
                    </div>
                {/each}
            {/each}
        </div>
    {/if}
</main>

<style>
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background: white; }
    th, td { border: 1px solid #ddd; padding: 8px; }
    input, select { width: 100%; border: 1px solid #ddd; padding: 5px; }
    
    .controls { 
        margin-bottom: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 5px;
    }
    
    .controls label { 
        display: block;
        margin-bottom: 8px;
        font-weight: bold;
    }
    
    .controls select {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }
    
    .actions { display: flex; gap: 10px; justify-content: center; margin-bottom: 40px; }
    
    .final-schedule {
        display: grid;
        grid-template-columns: 100px repeat(5, 1fr);
        gap: 5px;
        background: #eee;
        padding: 10px;
        border-radius: 10px;
    }
    
    .grid-header { background: #d63384; color: white; padding: 10px; font-weight: bold; }
    .time-cell { background: #f8f9fa; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }
    .pic-cell { background: white; padding: 5px; display: flex; flex-direction: column; align-items: center; min-height: 80px; }
    .pic-cell img { width: 50px; height: 50px; }
    .pic-cell span { font-size: 0.7rem; margin-top: 5px; }
</style>