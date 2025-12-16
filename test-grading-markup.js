// Test the grading markup parsing

// The regex patterns from quiz-engine.js (using | separator)
function parseMarkup(markup) {
    return markup
        .replace(/\[OK:([^\]]+)\]/g, '<span style="color: #16a34a; font-weight: 600;">$1</span>')
        // Handle [ERR:text|reason] format - show text with tooltip for reason
        .replace(/\[ERR:([^|\]]+)\|([^\]]+)\]/g, '<span style="color: #dc2626; font-weight: 600; text-decoration: underline wavy #dc2626; cursor: help;" title="$2">$1</span> <span style="display: inline-block; font-size: 11px; color: #991b1b; background: #fee2e2; padding: 1px 4px; border-radius: 3px; margin-left: 2px;">$2</span>')
        // Fallback for [ERR:text] without reason
        .replace(/\[ERR:([^\]]+)\]/g, '<span style="color: #dc2626; font-weight: 600; text-decoration: underline wavy #dc2626;">$1</span>');
}

// Test cases (using | separator for reasons)
const testCases = [
    {
        name: "Simple OK",
        input: "[OK:I am happy]",
        shouldContain: ["I am happy", "color: #16a34a"],
        shouldNotContain: ["dc2626"]
    },
    {
        name: "Simple ERR without reason",
        input: "[ERR:she is coming]",
        shouldContain: ["she is coming", "color: #dc2626", "underline wavy"],
        shouldNotContain: ["title="]
    },
    {
        name: "ERR with reason (pipe separator)",
        input: "[ERR:she is coming|should be 'he' - 他 means he]",
        shouldContain: ["she is coming", "should be 'he'", "title=", "fee2e2"],
        shouldNotContain: []
    },
    {
        name: "Mixed OK and ERR with reason",
        input: "[OK:He said] [ERR:she is coming|should be 'he is coming'] [OK:tomorrow]",
        shouldContain: ["He said", "she is coming", "should be 'he is coming'", "tomorrow", "#16a34a", "#dc2626"],
        shouldNotContain: []
    },
    {
        name: "ERR with colon in text (now works!)",
        input: "[ERR:10:30 AM|should be 10:30 PM]",
        shouldContain: ["10:30 AM", "should be 10:30 PM"],
        shouldNotContain: []
    },
    {
        name: "Multiple ERRs with reasons",
        input: "[ERR:cat|should be dog] and [ERR:ran|should be walked]",
        shouldContain: ["cat", "should be dog", "ran", "should be walked"],
        shouldNotContain: []
    }
];

console.log("Testing grading markup parsing:\n");

let passed = 0;
let failed = 0;

for (const test of testCases) {
    const result = parseMarkup(test.input);
    let testPassed = true;
    let errors = [];

    for (const str of test.shouldContain) {
        if (!result.includes(str)) {
            testPassed = false;
            errors.push(`Missing: "${str}"`);
        }
    }

    for (const str of test.shouldNotContain) {
        if (result.includes(str)) {
            testPassed = false;
            errors.push(`Should not contain: "${str}"`);
        }
    }

    if (testPassed) {
        console.log(`✓ ${test.name}`);
        passed++;
    } else {
        console.log(`✗ ${test.name}`);
        console.log(`  Input: ${test.input}`);
        console.log(`  Output: ${result}`);
        errors.forEach(e => console.log(`  Error: ${e}`));
        failed++;
    }
}

console.log(`\n${passed} passed, ${failed} failed`);

// Show actual output for the complex case
console.log("\n--- Sample output for ERR with reason ---");
const sample = "[OK:He said] [ERR:she is coming|should be 'he is coming' - 他 means he not she] [OK:tomorrow]";
console.log("Input:", sample);
console.log("Output:", parseMarkup(sample));

// Test realistic AI responses that might be malformed
console.log("\n--- Testing realistic/edge case AI responses ---");

const realisticCases = [
    // AI might forget the pipe for reason
    "[ERR:wrong]",
    // AI might use spaces around pipe
    "[ERR: wrong | reason here ]",
    // AI might not use brackets at all
    "wrong (should be right)",
    // Reason with special chars
    "[ERR:wrong|should be \"right\" - it's 对]",
    // Colons in text now work with pipe separator!
    "[ERR:10:30 AM|should be 10:30 PM]",
    // Colon in reason also works
    "[ERR:wrong|the Chinese says: 他不是]",
];

console.log("\nRealistic cases:");
for (const input of realisticCases) {
    console.log(`Input:  ${input}`);
    console.log(`Output: ${parseMarkup(input)}`);
    console.log("");
}
