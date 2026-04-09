// Regression tests for Groq AI service helpers
// Run with: node test-ai-service.js

const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('./js/engine/ai-service.js', 'utf8');

function createStorage(initial = {}) {
    const data = { ...initial };
    return {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        setItem(key, value) {
            data[key] = String(value);
        },
        removeItem(key) {
            delete data[key];
        }
    };
}

function loadContext({ windowOverrides = {}, storageInitial = {}, fetchImpl } = {}) {
    const localStorage = createStorage(storageInitial);
    const context = vm.createContext({
        window: {
            location: { href: 'https://example.test/quiz.html' },
            ...windowOverrides,
        },
        localStorage,
        fetch: fetchImpl || (() => Promise.reject(new Error('fetch not stubbed'))),
        console,
        URL,
        JSON,
        Error,
        String,
        Number,
        Boolean,
        Math,
        Promise,
        setTimeout,
        clearTimeout,
    });

    vm.runInContext(code, context, { filename: 'ai-service.js' });
    vm.runInContext(`
        globalThis.__readGroqApiKey = readGroqApiKey;
        globalThis.__callGroqChat = callGroqChat;
    `, context);

    return { context, localStorage };
}

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
    } catch (error) {
        failed++;
        console.log(`✗ ${name}`);
        console.log(`  ${error.message}`);
    }
}

(async () => {
    await test('readGroqApiKey falls back to localStorage when window getter points elsewhere', async () => {
        const { context } = loadContext({
            windowOverrides: {
                getGroqApiKey: () => 'external-key'
            },
            storageInitial: {
                groq_api_key: 'stored-key'
            }
        });

        assert(context.__readGroqApiKey() === 'external-key', 'should prefer external getter when available');
    });

    await test('readGroqApiKey avoids recursive self-calls and reads localStorage directly', async () => {
        const { context, localStorage } = loadContext({
            storageInitial: {
                groq_api_key: 'stored-key'
            }
        });

        context.window.getGroqApiKey = context.__readGroqApiKey;

        assert(context.__readGroqApiKey() === 'stored-key', 'should return stored key without recursion');
        assert(localStorage.getItem('groq_api_key') === 'stored-key', 'stored key should remain intact');
    });

    await test('callGroqChat uses recovered key and sends request payload', async () => {
        let request = null;
        const { context } = loadContext({
            storageInitial: {
                groq_api_key: 'stored-key'
            },
            fetchImpl: async (url, options) => {
                request = { url, options };
                return {
                    ok: true,
                    async json() {
                        return {
                            choices: [
                                { message: { content: 'hello back' } }
                            ]
                        };
                    }
                };
            }
        });

        context.window.getGroqApiKey = context.__readGroqApiKey;
        const reply = await context.__callGroqChat({
            system: 'You are helpful.',
            messages: [{ role: 'user', content: 'hi' }],
            maxTokens: 123,
            temperature: 0.2
        });

        assert(reply === 'hello back', 'should return assistant response content');
        assert(request && request.url.includes('api.groq.com/openai/v1/chat/completions'), 'should call Groq chat endpoint');
        assert(request.options.headers.Authorization === 'Bearer stored-key', 'should send stored API key');

        const payload = JSON.parse(request.options.body);
        assert(payload.messages.length === 2, 'should send system and user messages');
        assert(payload.messages[0].role === 'system', 'first message should be system');
        assert(payload.messages[1].content === 'hi', 'second message should be latest user message');
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
})();
