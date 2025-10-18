// Etymology notes loader
// Fetches etymology notes from JSON file and makes them available globally

let ETYMOLOGY_NOTES = {};
let etymologyNotesLoaded = false;

// Load etymology notes from JSON file
async function loadEtymologyNotes() {
    try {
        const commonResponse = await fetch('data/common-2500-etymology.json');
        if (!commonResponse.ok) {
            console.warn('Could not load common etymology notes:', commonResponse.statusText);
            return false;
        }

        const commonNotes = await commonResponse.json();
        let lessonNotes = {};

        try {
            const lessonResponse = await fetch('data/lesson1-2-etymology.json');
            if (lessonResponse.ok) {
                lessonNotes = await lessonResponse.json();
            } else {
                console.warn('Lesson etymology notes unavailable:', lessonResponse.statusText);
            }
        } catch (lessonError) {
            console.warn('Failed to load lesson etymology notes:', lessonError);
        }

        ETYMOLOGY_NOTES = { ...commonNotes, ...lessonNotes };
        etymologyNotesLoaded = true;
        const totalCount = Object.keys(ETYMOLOGY_NOTES).length;
        const lessonCount = Object.keys(lessonNotes).length;
        console.log(`Loaded ${totalCount} etymology notes (including ${lessonCount} lesson overrides)`);
        return true;
    } catch (error) {
        console.warn('Failed to load etymology notes:', error);
        return false;
    }
}

// Initialize immediately
loadEtymologyNotes();
