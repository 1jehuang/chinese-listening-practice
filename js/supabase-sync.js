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
