<script lang="ts">
    import toastr from 'toastr';
    import 'toastr/build/toastr.min.css';
    import { onMount } from 'svelte';

    let loading = false;
    let scheduleRows: Array<{ time: string; [key: string]: string }> = [
        { time: "08:00 - 09:00", mon: "", tue: "", wed: "", thu: "", fri: "" }
    ];
    let generatedSchedule: any = null;
    let shareLink = "";

    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];

    // 1. Tjek om vi er i "Rediger-tilstand" (Edit Mode)
    onMount(async () => {
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const editId = urlParams.get('edit');

        if (editId) {
            loading = true;
            try {
                const response = await fetch(`http://localhost:8080/api/schedules/${editId}`);
                const data = await response.json();
                
                if (data.success && data.data) {
                    // Hvis skemaet findes, mapper vi det tilbage til vores editor-format
                    scheduleRows = data.data.map((row: any) => {
                        let newRow: { time: string; [key: string]: string } = { time: row.time };
                        days.forEach(day => {
                            // Hvis der er et ord, men det ikke er i vores dropdown, sætter vi det til custom
                            if (row[day] && row[day].keyword) {
                                const keyword = row[day].keyword;
                                // Her antager vi, at hvis det ikke er i activities, så var det 'custom'
                                // For at gøre det simpelt lader vi dropdownen stå på custom, hvis det ikke matcher scenariet
                                newRow[day] = "custom"; 
                                newRow[day + "_custom"] = keyword;
                            } else {
                                newRow[day] = "";
                            }
                        });
                        return newRow;
                    });
                    toastr.info("Indlæste skema til redigering.");
                }
            } catch (err) {
                console.error("Kunne ikke hente gammelt skema:", err);
            } finally {
                loading = false;
            }
        }
    });

    function addRow() {
        scheduleRows = [...scheduleRows, { time: "", mon: "", tue: "", wed: "", thu: "", fri: "" }];
    }

    async function generateSchedule() {
        loading = true;
        
        // 2. Rens data før API kald
        const preparedRows = scheduleRows.map(row => {
            let newRow: { time: string; [key: string]: string } = { time: row.time };
            days.forEach(day => {
                if (row[day] === 'custom') {
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
                // Generer det rigtige delbare link baseret på Svelte's hash-routing
                shareLink = window.location.origin + "/#/view-schedule/" + data.id;
                toastr.success("Ugeskema genereret og er klar til deling! 📅");
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
                {loading ? "Arbejder..." : "Færdiggør skema ✨"}
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
    
    {#if generatedSchedule}
        <div class="actions no-print" style="margin-top: 20px;">
            <button class="primary" on:click={() => window.print()}>
                🖨️ Eksporter som PDF / Print
            </button>
        </div>

        <div class="final-schedule">
            </div>
    {/if}

    {#if shareLink}
        <div class="share-box no-print">
            <h3>✨ Skemaet er gemt og klar</h3>
            <p>Kopier linket herunder for at gemme det til senere eller dele det med andre:</p>
            <div class="copy-container">
                <input readonly value={shareLink} id="shareInput" />
                <button on:click={() => {
                    const copyText = document.getElementById("shareInput") as HTMLInputElement;
                    copyText.select();
                    document.execCommand("copy");
                    toastr.success("Link kopieret til udklipsholder! 📋");
                }}>Kopier link</button>
            </div>
            <div style="margin-top: 15px;">
                <button class="primary" on:click={() => window.print()}>
                    🖨️ Gem som PDF / Print nu
                </button>
            </div>
        </div>
    {/if}

</main>

<style>
    /* Tilføj dette til din eksisterende style */
    .share-box {
        background: #f0f7ff;
        border: 2px solid #007bff;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        margin: 30px 0;
    }
    .copy-container {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin: 10px 0;
    }
    .copy-container input {
        width: 60%;
        background: white;
        border: 1px solid #ccc;
    }
    .share-box h3 { margin-top: 0; color: #0056b3; }

    /* CSS er uændret */
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background: white; }
    th, td { border: 1px solid #ddd; padding: 8px; }
    input, select { width: 100%; border: 1px solid #ddd; padding: 5px; }
    .controls { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
    .controls label { display: block; margin-bottom: 8px; font-weight: bold; }
    .controls select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
    .actions { display: flex; gap: 10px; justify-content: center; margin-bottom: 40px; }
    .final-schedule { display: grid; grid-template-columns: 100px repeat(5, 1fr); gap: 5px; background: #eee; padding: 10px; border-radius: 10px; margin-bottom: 20px; }
    .grid-header { background: #d63384; color: white; padding: 10px; font-weight: bold; text-align: center; }
    .time-cell { background: #f8f9fa; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;}
    .pic-cell { background: white; padding: 5px; display: flex; flex-direction: column; align-items: center; min-height: 80px; }
    .pic-cell img { width: 50px; height: 50px; object-fit: contain; }
    .pic-cell span { font-size: 0.7rem; margin-top: 5px; text-align: center; }
</style>