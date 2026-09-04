// Prints the connection string for the `database` relationship.
//
// The app itself only knows DATABASE_URL, which is what you set locally in
// .env. Upsun hands the credentials over in one of a few shapes depending on
// how the project is configured, so this translates whichever one is present
// and stays out of src/.
function url({ username, password, host, port, path }) {
  const user = encodeURIComponent(username ?? 'main');
  const secret = encodeURIComponent(password ?? '');
  return `postgres://${user}:${secret}@${host}:${port ?? 5432}/${path ?? 'main'}`;
}

// 1. Already set - a manually defined variable, or a local .env.
if (process.env.DATABASE_URL) {
  console.log(process.env.DATABASE_URL);
  process.exit(0);
}

// 2. Service environment variables, one per field.
if (process.env.DATABASE_HOST) {
  console.log(
    url({
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      path: process.env.DATABASE_PATH,
    }),
  );
  process.exit(0);
}

// 3. The base64 relationships blob.
const encoded = process.env.PLATFORM_RELATIONSHIPS;
if (encoded) {
  const relationships = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  const database = relationships['database']?.[0];
  if (database) {
    console.log(url(database));
    process.exit(0);
  }
}

// Nothing matched. Say what the container actually has, so the next deploy
// log answers the question instead of posing it again.
const visible = Object.keys(process.env)
  .filter((key) => /DATABASE|POSTGRES|PLATFORM/i.test(key))
  .sort();
console.error(
  'no database relationship found. Candidate variables in this container: ' +
    (visible.length > 0 ? visible.join(', ') : '(none)'),
);
process.exit(1);
