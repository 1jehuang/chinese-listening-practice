// Regression tests for Supabase auth persistence / session restore
// Run with: node test-supabase-sync.js

const fs = require('fs');
const vm = require('vm');

const storage = {};
let createClientOptions = null;
let currentClient = null;

const localStorageStub = {
    getItem(key) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
    },
    setItem(key, value) {
        storage[key] = String(value);
    },
    removeItem(key) {
        delete storage[key];
    }
};

const documentStub = {
    readyState: 'loading',
    addEventListener() {},
    querySelector() { return null; },
    getElementById() { return null; },
    createElement() {
        return {
            style: {},
            classList: { add(){}, remove(){} },
            appendChild() {},
            set innerHTML(_) {},
        };
    },
    body: { appendChild() {} }
};

const context = vm.createContext({
    window: {
        location: { pathname: '/lesson-15-part-2.html', href: 'https://example.test/lesson-15-part-2.html' },
        addEventListener() {},
        removeEventListener() {},
        reload() {},
        localStorage: localStorageStub,
    },
    localStorage: localStorageStub,
    document: documentStub,
    supabase: {
        createClient(url, key, options) {
            createClientOptions = options;
            return currentClient;
        }
    },
    console,
    setTimeout,
    clearTimeout,
    Blob: class {},
    fetch: () => Promise.resolve({ ok: true }),
    Promise,
    JSON,
    Date,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    TypeError,
});

const code = fs.readFileSync('./js/supabase-sync.js', 'utf8');
vm.runInContext(code, context, { filename: 'supabase-sync.js' });
vm.runInContext(`
    function __initSupabase() { return initSupabase(); }
    async function __ensureAuthenticated() { return ensureAuthenticated(); }
    function __getCurrentUserId() { return currentUserId; }
    function __getAuthStorageKey() { return SUPABASE_AUTH_STORAGE_KEY; }
`, context);

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`✓ ${name}`);
    } catch (err) {
        failed++;
        console.log(`✗ ${name}`);
        console.log(`  ${err.message}`);
    }
}

function reset(clientImpl) {
    createClientOptions = null;
    for (const key of Object.keys(storage)) delete storage[key];
    currentClient = clientImpl;
    vm.runInContext(`supabaseClient = null; currentUserId = null;`, context);
}

function makeClient(authOverrides = {}) {
    return {
        auth: {
            getSession: async () => ({ data: { session: null } }),
            signInAnonymously: async () => ({ data: { user: { id: 'anon-user' } }, error: null }),
            refreshSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
            signOut: async () => ({ error: null }),
            ...authOverrides,
        }
    };
}

(async () => {
    await test('initSupabase enables persistent local auth sessions', async () => {
        reset(makeClient());
        assert(context.__initSupabase() === true, 'initSupabase should succeed');
        assert(createClientOptions && createClientOptions.auth, 'createClient auth options should be provided');
        assert(createClientOptions.auth.persistSession === true, 'persistSession should be enabled');
        assert(createClientOptions.auth.autoRefreshToken === true, 'autoRefreshToken should be enabled');
        assert(createClientOptions.auth.detectSessionInUrl === true, 'detectSessionInUrl should be enabled');
        assert(createClientOptions.auth.storageKey === context.__getAuthStorageKey(), 'auth storage key should be explicit');
        assert(createClientOptions.auth.storage === localStorageStub, 'localStorage should back auth persistence');
    });

    await test('ensureAuthenticated reuses existing signed-in session without anonymous fallback', async () => {
        let anonymousCalls = 0;
        reset(makeClient({
            getSession: async () => ({ data: { session: { user: { id: 'google-user', is_anonymous: false } } } }),
            signInAnonymously: async () => {
                anonymousCalls++;
                return { data: { user: { id: 'anon-user' } }, error: null };
            }
        }));

        context.__initSupabase();
        const ok = await context.__ensureAuthenticated();
        assert(ok === true, 'existing session should authenticate');
        assert(context.__getCurrentUserId() === 'google-user', 'current user should be restored from session');
        assert(anonymousCalls === 0, 'anonymous sign-in should not run when already signed in');
    });

    await test('ensureAuthenticated restores stored session via refresh token before falling back', async () => {
        let anonymousCalls = 0;
        reset(makeClient({
            getSession: async () => ({ data: { session: null } }),
            refreshSession: async ({ refresh_token }) => ({
                data: { session: { user: { id: `restored:${refresh_token}` } } },
                error: null,
            }),
            signInAnonymously: async () => {
                anonymousCalls++;
                return { data: { user: { id: 'anon-user' } }, error: null };
            }
        }));

        storage[context.__getAuthStorageKey()] = JSON.stringify({ refresh_token: 'refresh-123', access_token: 'access-123' });
        context.__initSupabase();
        const ok = await context.__ensureAuthenticated();
        assert(ok === true, 'stored refresh token should restore session');
        assert(context.__getCurrentUserId() === 'restored:refresh-123', 'current user should come from refreshed session');
        assert(anonymousCalls === 0, 'anonymous sign-in should not run after refresh-token recovery');
    });

    await test('ensureAuthenticated waits for delayed initial session before using anonymous auth', async () => {
        let anonymousCalls = 0;
        reset(makeClient({
            getSession: async () => ({ data: { session: null } }),
            refreshSession: async () => ({ data: { session: null }, error: { message: 'no refresh' } }),
            onAuthStateChange: (cb) => {
                setTimeout(() => cb('INITIAL_SESSION', { user: { id: 'delayed-user', is_anonymous: false } }), 0);
                return { data: { subscription: { unsubscribe() {} } } };
            },
            signInAnonymously: async () => {
                anonymousCalls++;
                return { data: { user: { id: 'anon-user' } }, error: null };
            }
        }));

        storage[context.__getAuthStorageKey()] = JSON.stringify({ access_token: 'access-123' });
        context.__initSupabase();
        const ok = await context.__ensureAuthenticated();
        assert(ok === true, 'delayed initial session should be accepted');
        assert(context.__getCurrentUserId() === 'delayed-user', 'current user should come from delayed recovered session');
        assert(anonymousCalls === 0, 'anonymous sign-in should wait for delayed session recovery');
    });

    await test('ensureAuthenticated falls back to anonymous auth only when no session can be restored', async () => {
        let anonymousCalls = 0;
        reset(makeClient({
            getSession: async () => ({ data: { session: null } }),
            signInAnonymously: async () => {
                anonymousCalls++;
                return { data: { user: { id: 'anon-user' } }, error: null };
            }
        }));

        context.__initSupabase();
        const ok = await context.__ensureAuthenticated();
        assert(ok === true, 'anonymous fallback should still work');
        assert(context.__getCurrentUserId() === 'anon-user', 'anonymous user should be recorded');
        assert(anonymousCalls === 1, 'anonymous sign-in should run exactly once when needed');
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
})();
