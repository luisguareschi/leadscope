if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://leadscope:leadscope@localhost:5432/leadscope";
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}
if (!process.env.SECRETS_ENCRYPTION_KEY) {
  process.env.SECRETS_ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
}
