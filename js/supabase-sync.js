// =============================================================================
// SUPABASE CONFIDENCE SCORE SYNC
// =============================================================================

const SUPABASE_URL = 'https://nekdqvzknuqrhuwxpujt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5la2RxdnprbnVxcmh1d3hwdWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxOTE4MjgsImV4cCI6MjA3OTc2NzgyOH0.2paRC5GBr2EY1BIxqND0JS8J7jdfSPBaw0oSMEQ1CRk';

let supabaseClient = null;
let currentUserId = null;
let syncEnabled = true;
let syncDebounceTimer = null;
const SYNC_DEBOUNCE_MS = 500; // Batch updates every 500ms (reduced for reliability)

// Initialize Supabase client
function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.warn('Supabase SDK not loaded');
        return false;
    }
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized');
    return true;
}

// Sign in anonymously and get user ID
async function ensureAuthenticated() {
    if (!supabaseClient) return false;

    try {
        // Check if already signed in
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session?.user) {
            currentUserId = session.user.id;
            console.log('Already authenticated:', currentUserId);
            return true;
        }

        // Sign in anonymously
        const { data, error } = await supabaseClient.auth.signInAnonymously();

        if (error) {
            console.warn('Anonymous sign-in failed:', error);
            return false;
        }

        currentUserId = data.user.id;
        console.log('Signed in anonymously:', currentUserId);
        return true;
    } catch (e) {
        console.warn('Auth error:', e);
        return false;
    }
}

// Get current page key (matches SR data key format)
function getSyncPageKey() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf('/') + 1).replace('.html', '');
}

// Sync a single stat to Supabase (debounced)
let pendingUpdates = {};

function queueConfidenceSync(char, skillKey, stats) {
    if (!syncEnabled || !supabaseClient || !currentUserId) return;

    const key = `${char}::${skillKey}`;
    pendingUpdates[key] = {
        char,
        skillKey,
        stats: { ...stats }
    };

    // Debounce the actual sync
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(flushPendingUpdates, SYNC_DEBOUNCE_MS);
}

async function flushPendingUpdates() {
    if (!supabaseClient || !currentUserId || Object.keys(pendingUpdates).length === 0) return;

    const pageKey = getSyncPageKey();
    const updates = Object.values(pendingUpdates);
    pendingUpdates = {};

    try {
        // Upsert all pending updates with user_id
        const rows = updates.map(u => ({
            user_id: currentUserId,
            page_key: pageKey,
            char: u.char,
            skill_key: u.skillKey,
            served: u.stats.served || 0,
            correct: u.stats.correct || 0,
            wrong: u.stats.wrong || 0,
            streak: u.stats.streak || 0,
            last_wrong: u.stats.lastWrong || null,
            last_served: u.stats.lastServed || null,
            last_correct: u.stats.lastCorrect || null,
            bkt_p_learned: u.stats.bktPLearned ?? 0.0,
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabaseClient
            .from('confidence_scores')
            .upsert(rows, { onConflict: 'user_id,page_key,char,skill_key' });

        if (error) {
            console.warn('Supabase sync error:', error);
        } else {
            console.log(`Synced ${rows.length} confidence scores`);
        }
    } catch (e) {
        console.warn('Failed to sync confidence scores:', e);
    }
}

// Synchronous version using sendBeacon for page unload (guaranteed to complete)
function flushPendingUpdatesSync() {
    if (!currentUserId || Object.keys(pendingUpdates).length === 0) return;

    const pageKey = getSyncPageKey();
    const updates = Object.values(pendingUpdates);
    pendingUpdates = {};

    const rows = updates.map(u => ({
        user_id: currentUserId,
        page_key: pageKey,
        char: u.char,
        skill_key: u.skillKey,
        served: u.stats.served || 0,
        correct: u.stats.correct || 0,
        wrong: u.stats.wrong || 0,
        streak: u.stats.streak || 0,
        last_wrong: u.stats.lastWrong || null,
        last_served: u.stats.lastServed || null,
        last_correct: u.stats.lastCorrect || null,
        bkt_p_learned: u.stats.bktPLearned ?? 0.0,
        updated_at: new Date().toISOString()
    }));

    // Use sendBeacon with Supabase REST API directly
    const url = `${SUPABASE_URL}/rest/v1/confidence_scores?on_conflict=user_id,page_key,char,skill_key`;
    const blob = new Blob([JSON.stringify(rows)], { type: 'application/json' });

    // Get current session token for auth
    const sessionData = localStorage.getItem('sb-nekdqvzknuqrhuwxpujt-auth-token');
    let accessToken = SUPABASE_ANON_KEY;
    if (sessionData) {
        try {
            const parsed = JSON.parse(sessionData);
            if (parsed.access_token) {
                accessToken = parsed.access_token;
            }
        } catch (e) {}
    }

    // sendBeacon doesn't support custom headers, so use fetch with keepalive instead
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(rows),
        keepalive: true // This ensures the request completes even if the page closes
    }).catch(() => {}); // Ignore errors on unload

    console.log(`Queued ${rows.length} confidence scores for sync (keepalive)`);
}

// Load confidence scores from Supabase for current page
async function loadConfidenceFromSupabase() {
    if (!supabaseClient || !currentUserId) return null;

    const pageKey = getSyncPageKey();

    try {
        const { data, error } = await supabaseClient
            .from('confidence_scores')
            .select('*')
            .eq('user_id', currentUserId)
            .eq('page_key', pageKey);

        if (error) {
            console.warn('Failed to load confidence scores:', error);
            return null;
        }

        return data;
    } catch (e) {
        console.warn('Failed to load confidence scores:', e);
        return null;
    }
}

// Merge Supabase data into scheduler stats
async function mergeSupabaseStats() {
    const data = await loadConfidenceFromSupabase();

    // Always render confidence list after merge attempt
    const doRender = () => {
        if (typeof renderConfidenceList === 'function') {
            renderConfidenceList();
        }
    };

    if (!data || data.length === 0) {
        doRender();
        return;
    }

    // schedulerStats is global from quiz-engine.js
    if (typeof schedulerStats === 'undefined') return;

    for (const row of data) {
        const key = `${row.char}::${row.skill_key}`;
        if (!schedulerStats[key]) {
            schedulerStats[key] = {};
        }
        // Merge: take the higher values (in case local has newer data)
        const local = schedulerStats[key];
        schedulerStats[key] = {
            served: Math.max(local.served || 0, row.served || 0),
            correct: Math.max(local.correct || 0, row.correct || 0),
            wrong: Math.max(local.wrong || 0, row.wrong || 0),
            streak: row.streak || local.streak || 0, // prefer remote streak
            lastWrong: Math.max(local.lastWrong || 0, row.last_wrong || 0) || null,
            lastServed: Math.max(local.lastServed || 0, row.last_served || 0) || null,
            lastCorrect: Math.max(local.lastCorrect || 0, row.last_correct || 0) || null,
            bktPLearned: Math.max(local.bktPLearned ?? 0, row.bkt_p_learned ?? 0)
        };
    }

    console.log(`Merged ${data.length} confidence scores from Supabase`);

    // Save merged data back to localStorage
    if (typeof saveSchedulerStats === 'function') {
        saveSchedulerStats();
    }

    // Refresh confidence panel if it exists
    if (typeof updateConfidenceList === 'function') {
        updateConfidenceList();
    }
    if (typeof renderConfidenceList === 'function') {
        renderConfidenceList();
    }
}

// Hook into the existing markSchedulerOutcome function
function hookSchedulerSync() {
    if (typeof window.originalMarkSchedulerOutcome === 'undefined' &&
        typeof markSchedulerOutcome === 'function') {

        window.originalMarkSchedulerOutcome = markSchedulerOutcome;

        window.markSchedulerOutcome = function(correct) {
            // Call original function
            window.originalMarkSchedulerOutcome(correct);

            // Queue sync if we have a current question
            if (typeof currentQuestion !== 'undefined' && currentQuestion && currentQuestion.char) {
                const skillKey = typeof getCurrentSkillKey === 'function' ? getCurrentSkillKey() : 'general';
                const stats = typeof getSchedulerStats === 'function' ? getSchedulerStats(currentQuestion.char) : null;
                if (stats) {
                    queueConfidenceSync(currentQuestion.char, skillKey, stats);
                }
            }
        };

        console.log('Hooked markSchedulerOutcome for Supabase sync');
    }
}

// Initialize on page load
async function initSupabaseSync() {
    if (!initSupabase()) return;

    // Authenticate first
    const authenticated = await ensureAuthenticated();
    if (!authenticated) {
        console.warn('Supabase sync disabled - authentication failed');
        return;
    }

    // Load and apply user preferences from Supabase BEFORE loading stats
    await applySupabasePreferences();

    // Load existing data from Supabase
    await mergeSupabaseStats();

    // If quiz characters aren't loaded yet, schedule a retry to render confidence list
    const quizCharsLoaded = typeof originalQuizCharacters !== 'undefined' && originalQuizCharacters?.length > 0;
    if (!quizCharsLoaded) {
        setTimeout(() => {
            if (typeof renderConfidenceList === 'function') {
                renderConfidenceList();
            }
        }, 500);
    }

    // Hook into outcome tracking
    hookSchedulerSync();

    // Hook into localStorage for preference sync
    hookPreferenceSync();

    // Flush pending updates using sendBeacon (survives page close)
    window.addEventListener('beforeunload', () => {
        if (Object.keys(pendingUpdates).length > 0) {
            flushPendingUpdatesSync(); // Use sync version with sendBeacon
        }
    });

    // Also flush on visibility change (tab hidden/closed)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && Object.keys(pendingUpdates).length > 0) {
            flushPendingUpdatesSync();
        }
    });
}

// =============================================================================
// GOOGLE SIGN-IN (Optional - to sync across devices)
// =============================================================================

async function signInWithGoogle() {
    if (!supabaseClient) {
        console.warn('Supabase not initialized');
        return;
    }

    // Store current page to redirect back after auth
    const currentPage = window.location.href.split('#')[0];

    // Always use regular OAuth sign-in (linkIdentity is disabled in Supabase)
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: currentPage
        }
    });

    if (error) {
        console.error('Google sign-in failed:', error);
        alert('Sign in failed: ' + error.message);
    }
}

async function signOut() {
    if (!supabaseClient) return;

    await supabaseClient.auth.signOut();
    currentUserId = null;
    window.location.reload();
}

function getCurrentUser() {
    return supabaseClient?.auth?.getUser?.() || null;
}

function isAnonymousUser() {
    return supabaseClient?.auth?.getSession?.()?.then(({ data }) => {
        return data?.session?.user?.is_anonymous === true;
    });
}

// Create and insert auth UI button
function createAuthUI() {
    // Check if we're on a page with the home link (quiz pages)
    const homeLink = document.querySelector('a[href="home.html"]');
    if (!homeLink) return;

    const authContainer = document.createElement('div');
    authContainer.id = 'auth-container';
    authContainer.className = 'fixed top-4 left-28 z-50';
    authContainer.innerHTML = `
        <button id="auth-btn" class="bg-white hover:bg-gray-100 text-gray-700 w-10 h-10 rounded-full shadow border border-gray-200 transition flex items-center justify-center" title="Sign in">
            <svg id="auth-icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <img id="auth-avatar" class="w-8 h-8 rounded-full hidden" alt="Profile" />
        </button>
    `;
    document.body.appendChild(authContainer);

    const authBtn = document.getElementById('auth-btn');
    const authIcon = document.getElementById('auth-icon');
    const authAvatar = document.getElementById('auth-avatar');

    // Update button based on auth state
    async function updateAuthButton() {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session?.user) {
            if (session.user.is_anonymous) {
                authIcon.classList.remove('hidden');
                authAvatar.classList.add('hidden');
                authBtn.title = 'Sign in with Google';
                authBtn.onclick = signInWithGoogle;
            } else {
                // Show user avatar
                const avatarUrl = session.user.user_metadata?.avatar_url;
                if (avatarUrl) {
                    authAvatar.src = avatarUrl;
                    authAvatar.classList.remove('hidden');
                    authIcon.classList.add('hidden');
                } else {
                    authIcon.classList.remove('hidden');
                    authAvatar.classList.add('hidden');
                }
                authBtn.title = session.user.email || 'Sign out';
                authBtn.onclick = signOut;
            }
        } else {
            authIcon.classList.remove('hidden');
            authAvatar.classList.add('hidden');
            authBtn.title = 'Sign in with Google';
            authBtn.onclick = signInWithGoogle;
        }
    }

    // Update on auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            updateAuthButton();
            if (session?.user) {
                currentUserId = session.user.id;
            }
        }
    });

    updateAuthButton();
}

// =============================================================================
// USER PREFERENCES SYNC
// =============================================================================

const SYNCED_PREFERENCES = [
    'quiz_scheduler_mode',      // Which scheduler mode (weighted, batch_5, etc.)
    'confidence_formula'        // heuristic or bkt
];

async function savePreferenceToSupabase(key, value) {
    if (!supabaseClient || !currentUserId) return;

    try {
        const { error } = await supabaseClient
            .from('user_preferences')
            .upsert({
                user_id: currentUserId,
                preference_key: key,
                preference_value: String(value),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,preference_key' });

        if (error) {
            console.warn('Failed to save preference:', key, error);
        } else {
            console.log('Saved preference:', key, '=', value);
        }
    } catch (e) {
        console.warn('Failed to save preference:', key, e);
    }
}

async function loadPreferencesFromSupabase() {
    if (!supabaseClient || !currentUserId) return {};

    try {
        const { data, error } = await supabaseClient
            .from('user_preferences')
            .select('preference_key, preference_value')
            .eq('user_id', currentUserId);

        if (error) {
            console.warn('Failed to load preferences:', error);
            return {};
        }

        const prefs = {};
        for (const row of (data || [])) {
            prefs[row.preference_key] = row.preference_value;
        }
        console.log('Loaded preferences from Supabase:', prefs);
        return prefs;
    } catch (e) {
        console.warn('Failed to load preferences:', e);
        return {};
    }
}

// Hook into localStorage to sync preferences
function hookPreferenceSync() {
    const originalSetItem = localStorage.setItem.bind(localStorage);

    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);

        // Sync specific preference keys to Supabase
        if (SYNCED_PREFERENCES.includes(key)) {
            savePreferenceToSupabase(key, value);
        }
    };

    console.log('Hooked localStorage for preference sync');
}

// Apply synced preferences from Supabase to localStorage
async function applySupabasePreferences() {
    const prefs = await loadPreferencesFromSupabase();

    for (const key of SYNCED_PREFERENCES) {
        if (prefs[key] !== undefined) {
            const localValue = localStorage.getItem(key);
            // Only apply if local doesn't have it or remote is different
            if (localValue !== prefs[key]) {
                localStorage.setItem(key, prefs[key]);
                console.log('Applied preference from Supabase:', key, '=', prefs[key]);
            }
        }
    }
}

// =============================================================================
// DEBUG FUNCTIONS
// =============================================================================

// Debug function to check sync status
async function debugSyncStatus() {
    console.group('🔍 Supabase Sync Debug');
    console.log('supabaseClient:', !!supabaseClient);
    console.log('currentUserId:', currentUserId);
    console.log('syncEnabled:', syncEnabled);
    console.log('pendingUpdates:', Object.keys(pendingUpdates).length, pendingUpdates);
    console.log('pageKey:', getSyncPageKey());

    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        console.log('session:', session ? { userId: session.user?.id, isAnonymous: session.user?.is_anonymous, email: session.user?.email } : null);
    }

    const data = await loadConfidenceFromSupabase();
    console.log('Data in Supabase for this page:', data?.length || 0, 'rows');
    if (data && data.length > 0) {
        console.table(data.slice(0, 10)); // Show first 10 rows
    }

    console.log('Local schedulerStats:', typeof schedulerStats !== 'undefined' ? Object.keys(schedulerStats).length : 'not defined', 'keys');
    console.groupEnd();

    return { userId: currentUserId, supabaseRows: data?.length || 0, pendingUpdates: Object.keys(pendingUpdates).length };
}

// Force immediate sync
async function forceSyncNow() {
    console.log('🔄 Force syncing...');
    clearTimeout(syncDebounceTimer);
    await flushPendingUpdates();
    console.log('✅ Force sync complete');
}

// Expose functions globally
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.savePreferenceToSupabase = savePreferenceToSupabase;
window.debugSyncStatus = debugSyncStatus;
window.forceSyncNow = forceSyncNow;
window.flushPendingUpdates = flushPendingUpdates;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await initSupabaseSync();
        createAuthUI();
    });
} else {
    // Small delay to ensure quiz-engine.js has initialized
    setTimeout(async () => {
        await initSupabaseSync();
        createAuthUI();
    }, 100);
}
