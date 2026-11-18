export default function Top({ title, signOut = false }: { title: string; signOut?: boolean }) {
  return (
    <header className="top">
      <h1>{title}</h1>
      {signOut && (
        <form action="/api/logout" method="post">
          <button type="submit">Sign out</button>
        </form>
      )}
    </header>
  );
}
