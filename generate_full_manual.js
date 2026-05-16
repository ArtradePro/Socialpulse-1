const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs');
const indexFile = path.join(__dirname, 'SOCIALPULSE_MANUAL.md');
const outputFile = path.join(__dirname, 'SOCIALPULSE_FULL_MANUAL.md');

async function createFullManual() {
    console.log('Generating Full Manual...');
    
    let fullContent = '# SocialPulse: The Complete Instruction Manual\n\n';
    fullContent += '> This is the consolidated version of the SocialPulse documentation suite.\n\n---\n\n';

    // 1. Get all doc files in order
    const files = fs.readdirSync(docsDir)
        .filter(f => f.endsWith('.md') && f.match(/^\d+/))
        .sort();

    for (const file of files) {
        console.log(`Processing ${file}...`);
        const content = fs.readFileSync(path.join(docsDir, file), 'utf8');
        
        // Remove navigation footers from individual files for the combined version
        const cleanContent = content.split('---')[0].trim();
        
        fullContent += cleanContent + '\n\n---\n\n';
    }

    fs.writeFileSync(outputFile, fullContent);
    console.log(`Success! Full manual created at: ${outputFile}`);
}

createFullManual();
