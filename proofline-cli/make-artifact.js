// Strips the standalone <html>/<head>/<body> wrapper off a generated
// Proofline report so the same real content can be published to a host that
// supplies its own document skeleton. Content is passed through untouched --
// this must never become a place where the published version diverges from
// what the tool actually generates.
const fs = require('fs');

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('usage: node make-artifact.js <report.html> <out.html>');
  process.exit(1);
}

const html = fs.readFileSync(inPath, 'utf-8');
const title = (html.match(/<title>([^<]*)<\/title>/) || [, 'Proofline evidence report'])[1];
const style = (html.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
const body = (html.match(/<body>([\s\S]*?)<\/body>/) || [, ''])[1];

fs.writeFileSync(outPath, `<title>${title}</title>\n${style}\n${body}\n`, 'utf-8');
console.log(`wrote ${outPath} (${fs.statSync(outPath).size} bytes)`);
