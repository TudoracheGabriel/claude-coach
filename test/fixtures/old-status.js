// Stands in for a user's existing status line command.
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  const delay = Number(process.argv[2] || 0);
  setTimeout(() => {
    let id = '?';
    try {
      id = JSON.parse(input).session_id;
    } catch {}
    process.stdout.write(`OLD-LINE session=${id}\n`);
  }, delay);
});
