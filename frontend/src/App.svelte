<script>
    import { onMount } from 'svelte';
    import Home from './pages/Home.svelte';
    import Dashboard from './pages/Dashboard.svelte';
    import CreateStory from './pages/CreateStory.svelte';
    import CreateSchedule from './pages/CreateSchedule.svelte';
    import ViewSchedule from './pages/ViewSchedule.svelte';

    import { user } from './stores/userStore.js';
    import { currentPage } from './stores/pageStore.js';

    import 'toastr/build/toastr.min.css'

    function navigate(page) {
        $currentPage = page;
    }

    const routes = {
    '/': Home,
    '/create-schedule': CreateSchedule,
    // Denne linje er vigtig - den fanger ID'et fra URL'en
    '/view-schedule/:id': ViewSchedule, 
  };
</script>

<header>
    <div class="branding">
        <h1 class="site-title">Pictogram Storyteller</h1>
    </div>

    <nav>
        <button on:click={() => navigate('home')} class:active={$currentPage === 'home'}>
            🏠 Hjem
        </button>
        
        <button on:click={() => navigate('create')} class:active={$currentPage === 'create'}>
            ✨ Lav historie
        </button>

        <button on:click={() => navigate('schedule')} class:active={$currentPage === 'schedule'}>
            ✨ Lav skema
        </button>

        </nav>
</header>

<main>
    <div class="content-card">
        {#key $currentPage} 
            {#if $currentPage === 'home'}
                <Home />
            {:else if $currentPage === 'create'} 
                <CreateStory />
            {:else if $currentPage === 'login'}
                <Dashboard />
            {:else if $currentPage === 'schedule'}
                <CreateSchedule />
            {/if}
        {/key}
    </div>
</main>

<style>
    header {
        background-color: white;
        padding-top: 10px;
        padding-bottom: 10px;
        box-shadow: 0 4px 15px rgba(255, 105, 180, 0.2);
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 30px;
        
        width: 100%;
        position: sticky; 
        top: 0;
        z-index: 1000;
    }

    .branding {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
        margin-bottom: 10px;
        width: 100%;
    }
/* 
    .site-logo {
        height: 50px;
        width: auto;
    } */

    .site-title {
        margin: 0;
        font-size: 3rem;
        color: #d63384;
        letter-spacing: 2px;
        text-shadow: 2px 2px 0px #ffc0cb;
    }

    /* .site-title a {
    text-decoration: none; 
    color: inherit; 
    cursor: pointer;
    } */

    nav { 
        display: flex; 
        gap: 15px; 
        padding: 10px; 
        justify-content: center;
        flex-wrap: wrap;
        width: 100%;
        background-color: rgba(255, 255, 255, 0.9); 
        border-top: 1px solid #ffe4e1;
    }

    button {
        padding: 8px 16px;
        cursor: pointer;
        border: 2px solid transparent;
        background: white;
        border-radius: 25px;
        font-size: 0.9rem;
        font-weight: bold;
        color: #555;
        transition: all 0.2s ease;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    button:hover { 
        background-color: #fff0f5; 
        color: #d63384;
        transform: translateY(-2px);
    }

    button.active {
        background-color: #d63384;
        color: white;
        box-shadow: 0 4px 10px rgba(214, 51, 132, 0.4);
    }

    main {
        padding: 20px;
        max-width: 1200px; /* Keeps content readable/centered */
        margin: 0 auto;    /* Centers the main block */
        width: 90%;        /* Adds padding on small screens */
    }

    .content-card {
        background: rgba(255, 255, 255, 0.8);
        padding: 20px;
        border-radius: 20px;
    }

    /* .logout-btn {
        background-color: #ffebee;
        color: #c62828;
        border: 1px solid #c62828;
    }
    .logout-btn:hover {
        background-color: #c62828;
        color: white;
    } */
</style>