export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="ph login">
      <h1>Social Autopilot</h1>
      <p className="m">Sign in to your admin panel</p>
      <form action="/api/login" method="post">
        <div className="f">
          <label className="l" htmlFor="username">Username</label>
          <input id="username" name="username" className="in" defaultValue="admin" autoComplete="username" required />
        </div>
        <div className="f">
          <label className="l" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" className="in" autoComplete="current-password" required />
        </div>
        {error && <p className="err" role="alert">Wrong username or password.</p>}
        <button type="submit" className="s full" style={{ marginTop: 10 }}>Sign in</button>
      </form>
    </main>
  );
}
