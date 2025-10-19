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

        // Load lesson 1-2 etymology
        try {
            const lessonResponse = await fetch('data/lesson1-2-etymology.json');
            if (lessonResponse.ok) {
                const lesson12Notes = await lessonResponse.json();
                lessonNotes = { ...lessonNotes, ...lesson12Notes };
            } else {
                console.warn('Lesson 1-2 etymology notes unavailable:', lessonResponse.statusText);
            }
        } catch (lessonError) {
            console.warn('Failed to load lesson 1-2 etymology notes:', lessonError);
        }

        // Load lesson 3 etymology
        try {
            const lesson3Response = await fetch('data/lesson3-etymology.json');
            if (lesson3Response.ok) {
                const lesson3Notes = await lesson3Response.json();
                lessonNotes = { ...lessonNotes, ...lesson3Notes };
            } else {
                console.warn('Lesson 3 etymology notes unavailable:', lesson3Response.statusText);
            }
        } catch (lesson3Error) {
            console.warn('Failed to load lesson 3 etymology notes:', lesson3Error);
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
