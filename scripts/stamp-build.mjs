import { readFile, writeFile } from 'node:fs/promises';
const sha = process.env.BUILD_SHA;
if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('BUILD_SHA must be a full Git SHA');
const path = process.argv[2];
const html = await readFile(path, 'utf8');
await writeFile(path, html.replace(/(<meta name="build" content=")[^"]*(" \/>)/, `$1${sha}$2`)
  .replace(/(<code data-testid="build-sha">)[^<]*(<\/code>)/, `$1${sha}$2`));
