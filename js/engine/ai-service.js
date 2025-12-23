// Shared LLM + markdown helpers used by quiz-engine and chat panels.

function getGroqApiKey() {
    return window.getGroqApiKey ? window.getGroqApiKey() : '';
}

async function callGroqChat({ system, messages = [], maxTokens = 400, temperature = 0.7, model = 'moonshotai/kimi-k2-instruct' }) {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
        const err = new Error('MISSING_API_KEY');
        err.code = 'MISSING_API_KEY';
        throw err;
    }

    const payload = {
        model,
        messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
        max_tokens: maxTokens,
        temperature
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        let message = `API error ${response.status}`;
        try {
            const errorJson = JSON.parse(errorBody);
            message = errorJson.error?.message || message;
        } catch {}
        if (response.status === 401) {
            message = 'Invalid API key. Please set a valid Groq API key (Ctrl+K → "Set Groq API Key")';
        }
        const err = new Error(message);
        err.code = response.status;
        throw err;
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || '';
}

function sanitizeMarkdownUrl(rawUrl) {
    if (!rawUrl) return '';
    const trimmed = rawUrl.trim().replace(/^<|>$/g, '');
    try {
        const parsed = new URL(trimmed, window.location.href);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
    } catch (err) {
        return '';
    }
    return '';
}

function renderMarkdownSafe(text) {
    if (!text) return '';

    const codeBlocks = [];
    let raw = text.replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const index = codeBlocks.length;
        codeBlocks.push({ lang: lang || '', code: code || '' });
        return `@@CODEBLOCK${index}@@`;
    });

    let escaped = escapeHtml(raw);

    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Bold + italic
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    escaped = escaped.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
    escaped = escaped.replace(/(^|[^_])_([^_]+)_(?!_)/g, '$1<em>$2</em>');

    // Links
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        const safeUrl = sanitizeMarkdownUrl(url);
        if (!safeUrl) {
            return `${label} (${url})`;
        }
        return `<a class="md-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    // Headings
    escaped = escaped.replace(/^######\s+(.+)$/gm, '<div class="md-heading md-h6">$1</div>');
    escaped = escaped.replace(/^#####\s+(.+)$/gm, '<div class="md-heading md-h5">$1</div>');
    escaped = escaped.replace(/^####\s+(.+)$/gm, '<div class="md-heading md-h4">$1</div>');
    escaped = escaped.replace(/^###\s+(.+)$/gm, '<div class="md-heading md-h3">$1</div>');
    escaped = escaped.replace(/^##\s+(.+)$/gm, '<div class="md-heading md-h2">$1</div>');
    escaped = escaped.replace(/^#\s+(.+)$/gm, '<div class="md-heading md-h1">$1</div>');

    const lines = escaped.split(/\n/);
    let html = '';
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
        if (inUl) {
            html += '</ul>';
            inUl = false;
        }
        if (inOl) {
            html += '</ol>';
            inOl = false;
        }
    };

    for (const line of lines) {
        const trimmed = line.trim();
        const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
        const olMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);

        if (ulMatch) {
            if (!inUl) {
                closeLists();
                html += '<ul class="md-list md-list-ul">';
                inUl = true;
            }
            html += `<li>${ulMatch[1]}</li>`;
            continue;
        }

        if (olMatch) {
            if (!inOl) {
                closeLists();
                html += '<ol class="md-list md-list-ol">';
                inOl = true;
            }
            html += `<li>${olMatch[2]}</li>`;
            continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            closeLists();
            html += '<hr class="md-hr" />';
            continue;
        }

        if (trimmed.startsWith('>')) {
            closeLists();
            const quote = trimmed.replace(/^>\s?/, '');
            html += `<blockquote class="md-quote">${quote}</blockquote>`;
            continue;
        }

        closeLists();
        if (!trimmed) {
            html += '<div class="md-spacer"></div>';
        } else {
            html += `<div class="md-line">${line}</div>`;
        }
    }

    closeLists();

    html = html.replace(/@@CODEBLOCK(\d+)@@/g, (match, index) => {
        const block = codeBlocks[Number(index)];
        if (!block) return '';
        const langClass = block.lang ? ` language-${block.lang}` : '';
        const codeHtml = escapeHtml(block.code);
        return `<pre class="md-code"><code class="md-code-inner${langClass}">${codeHtml}</code></pre>`;
    });

    return html;
}
