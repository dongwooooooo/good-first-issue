export async function GET() {
  return new Response(
    "google-site-verification: google1b2f6d63e96002d8.html",
    {
      headers: { "Content-Type": "text/html" },
    }
  );
}
