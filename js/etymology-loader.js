// Etymology notes loader
// Fetches etymology notes from JSON file and makes them available globally

let ETYMOLOGY_NOTES = {};
let etymologyNotesLoaded = false;

// Load etymology notes from JSON file
async function loadEtymologyNotes() {
    try {
        const response = await fetch('data/etymology-notes.json');
        if (!response.ok) {
            console.warn('Could not load etymology notes:', response.statusText);
            return false;
        }
        ETYMOLOGY_NOTES = await response.json();
        etymologyNotesLoaded = true;
        console.log(`Loaded ${Object.keys(ETYMOLOGY_NOTES).length} etymology notes`);
        return true;
    } catch (error) {
        console.warn('Failed to load etymology notes:', error);
        return false;
    }
}

// Initialize immediately
loadEtymologyNotes();
