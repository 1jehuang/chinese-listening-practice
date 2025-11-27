// =============================================================================
// SUPABASE CONFIDENCE SCORE SYNC
// =============================================================================

const SUPABASE_URL = 'https://nekdqvzknuqrhuwxpujt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5la2RxdnprbnVxcmh1d3hwdWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxOTE4MjgsImV4cCI6MjA3OTc2NzgyOH0.2paRC5GBr2EY1BIxqND0JS8J7jdfSPBaw0oSMEQ1CRk';

let supabaseClient = null;
let currentUserId = null;
let syncEnabled = true;
let syncDebounceTimer = null;
const SYNC_DEBOUNCE_MS = 2000; // Batch updates every 2 seconds

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

// Load confidence scores from Supabase for current page
async function loadConfidenceFromSupabase() {
    if (!supabaseClient || !currentUserId) return null;

    const pageKey = getSyncPageKey();

    try {
        const { data, error } = await supabaseClient
            .from('confidence_scores')
            .select('*')
            .eq('page_key', pageKey);
        // RLS automatically filters by user_id

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
    if (!data || data.length === 0) return;

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
            lastServed: Math.max(local.lastServed || 0, row.last_served || 0) || null
        };
    }

    console.log(`Merged ${data.length} confidence scores from Supabase`);

    // Refresh confidence panel if it exists
    if (typeof updateConfidenceList === 'function') {
        updateConfidenceList();
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

    // Load existing data from Supabase
    await mergeSupabaseStats();

    // Hook into outcome tracking
    hookSchedulerSync();

    // Flush pending updates before page unload
    window.addEventListener('beforeunload', () => {
        if (Object.keys(pendingUpdates).length > 0) {
            flushPendingUpdates();
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

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href
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
    authContainer.className = 'fixed top-4 right-4 z-50';
    authContainer.innerHTML = `
        <button id="auth-btn" class="bg-white hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg shadow border border-gray-200 transition text-sm flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span id="auth-text">Sign in</span>
        </button>
    `;
    document.body.appendChild(authContainer);

    const authBtn = document.getElementById('auth-btn');
    const authText = document.getElementById('auth-text');

    // Update button based on auth state
    async function updateAuthButton() {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session?.user) {
            if (session.user.is_anonymous) {
                authText.textContent = 'Sign in';
                authBtn.onclick = signInWithGoogle;
            } else {
                // Show user email/name
                const email = session.user.email || 'Signed in';
                authText.textContent = email.split('@')[0];
                authBtn.onclick = signOut;
            }
        } else {
            authText.textContent = 'Sign in';
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

// Expose functions globally
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;

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
