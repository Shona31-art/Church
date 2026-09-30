import { LoginForm } from "./LoginForm";

// Server component: reads the query string here (instead of useSearchParams
// in the client) so the form is in the initial HTML — no blank flash.
export default function LoginPage({ searchParams }: { searchParams: { expired?: string; next?: string } }) {
  return <LoginForm expired={searchParams.expired === "1"} nextPath={searchParams.next ?? null} />;
}
