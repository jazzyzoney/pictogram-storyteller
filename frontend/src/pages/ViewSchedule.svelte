<script lang="ts">
    import { onMount } from 'svelte';
    
    // svelte-spa-router sender automatisk params med id'et herind
    export let params: { id?: string } = { id: '' }; 
    let id = params.id; 

    let schedule: any = null;
    let loading = true;

    onMount(async () => {
        if (!id) return;
        try {
            const response = await fetch(`http://localhost:8080/api/schedules/${id}`);
            const data = await response.json();
            if (data.success) {
                schedule = data.data;
            }
        } catch (error) {
            console.error("Fejl ved hentning af skema:", error);
        } finally {
            loading = false;
        }
    });
    
    function editSchedule() {
        window.location.hash = `/create-schedule?edit=${id}`;
    }
</script>

<main>
    {#if loading}
        <div class="loading">Henter skema... ⏳</div>
    {:else if errorMsg}
        <div class="error">{errorMsg}</div>
    {:else if schedule}
        
        <div class="header-actions no-print">
            <button class="primary" on:click={() => window.print()}>🖨️ Print Skema</button>
            <button class="secondary" on:click={editSchedule}>✏️ Lav kopi / Rediger</button>
        </div>

        <div class="final-schedule">
            <div class="grid-header">Tid</div>
            <div class="grid-header">Man</div>
            <div class="grid-header">Tirs</div>
            <div class="grid-header">Ons</div>
            <div class="grid-header">Tors</div>
            <div class="grid-header">Fre</div>

            {#each schedule as row}
                <div class="time-cell">{row.time}</div>
                {#each ['mon', 'tue', 'wed', 'thu', 'fri'] as day}
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
    main { padding: 20px; max-width: 1200px; margin: 0 auto; }
    .loading, .error { text-align: center; margin-top: 50px; font-size: 1.2rem; }
    .error { color: red; }

    .header-actions { display: flex; gap: 15px; justify-content: center; margin-bottom: 20px; }
    .header-actions button { padding: 10px 20px; font-size: 1rem; cursor: pointer; border: none; border-radius: 5px; }
    .primary { background-color: #4CAF50; color: white; }
    .secondary { background-color: #f1f1f1; color: #333; border: 1px solid #ccc !important; }

    .final-schedule { display: grid; grid-template-columns: 80px repeat(5, 1fr); gap: 5px; background: #eee; padding: 10px; border-radius: 10px;}
    .grid-header { background: #333; color: white; padding: 10px; text-align: center; font-weight: bold;}
    .time-cell { background: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem; text-align: center; }
    .pic-cell { background: white; border: 1px solid #ddd; display: flex; flex-direction: column; align-items: center; padding: 10px; min-height: 80px; }
    .pic-cell img { width: 60px; height: 60px; object-fit: contain; }
    .pic-cell span { font-size: 0.75rem; margin-top: 5px; text-align: center;}
    
    /* CSS der gør magien for PDF-eksporten */
    @media print {
        .no-print { display: none !important; } /* Skjul knapper */
        body, main { background: white; padding: 0; margin: 0; }
        .final-schedule { width: 100%; border: none; padding: 0; gap: 2px; background: white;}
        .grid-header { -webkit-print-color-adjust: exact; background-color: #333 !important; color: white !important; }
        .pic-cell { border: 1px solid #000; }
    }
</style>